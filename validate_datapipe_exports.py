#!/usr/bin/env python3
"""Validate completed DataPipe CSV exports from the pretest.

Usage:
    python validate_datapipe_exports.py /path/to/downloaded/files

The script never modifies data. It reports participant files that violate the
expected randomization/schema logic, flags participant IDs that occur in more
than one file, and prints a (non-failing) summary of the A/B allocation, O/C/N
orders, first-shown frames and reloads across all valid files.
"""

from __future__ import annotations

import csv
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

EXPECTED_VERSION = "pretest-2026-10-27-v5"
TRAITS = ["O", "C", "N"]
TRAIT_ITEMS = ["O1", "O2", "C1", "C2", "N1", "N2", "A1", "A2", "E1", "E2"]
SEMANTIC_ITEMS = ["POP", "LR", "PROF", "EMO"]
MEASURES = TRAIT_ITEMS + SEMANTIC_ITEMS
TOPIC_CODES = {"A": 0, "B": 1}
TOPIC_NAMES = {"A": "zdravotnictvi", "B": "byrokracie"}
WIDE_EXTRA = ["position", "trait_row_order", "semantic_row_order", "integrity_ok"]


def blank(v: str | None) -> bool:
    return v is None or str(v).strip() in {"", "null", "None", "NA"}


def parse_int(v: str | None):
    if blank(v):
        return None
    try:
        # CSVs sometimes represent numeric values as 1.0.
        f = float(v)
        return int(f) if f.is_integer() else None
    except (TypeError, ValueError):
        return None


def parse_iso_datetime(v: str | None):
    if blank(v):
        return None
    try:
        value = str(v).strip()
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def split_order(v: str | None):
    return [] if blank(v) else str(v).split("-")


def is_perm(actual, expected):
    return len(actual) == len(expected) and sorted(actual) == sorted(expected)


def validate_file(path: Path):
    errors = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return ["empty CSV"]

    versions = {r.get("study_version", "") for r in rows if not blank(r.get("study_version"))}
    if versions != {EXPECTED_VERSION}:
        errors.append(f"study_version={sorted(versions)!r}, expected only {EXPECTED_VERSION!r}")

    participant_ids = {r.get("participant_id", "") for r in rows if not blank(r.get("participant_id"))}
    if len(participant_ids) != 1:
        errors.append(f"expected one participant_id, found {sorted(participant_ids)!r}")

    started_values = {r.get("started_at", "") for r in rows if not blank(r.get("started_at"))}
    if len(started_values) != 1:
        errors.append(f"expected one started_at value, found {sorted(started_values)!r}")
        started_at = None
    else:
        started_raw = next(iter(started_values))
        started_at = parse_iso_datetime(started_raw)
        if started_at is None:
            errors.append(f"invalid started_at timestamp: {started_raw!r}")

    topics = {r.get("topic", "") for r in rows if not blank(r.get("topic"))}
    if len(topics) != 1 or next(iter(topics), None) not in TOPIC_CODES:
        errors.append(f"invalid/multiple topic values: {sorted(topics)!r}")
        topic = None
    else:
        topic = next(iter(topics))

    if topic:
        conditions = {parse_int(r.get("datapipe_condition")) for r in rows if not blank(r.get("datapipe_condition"))}
        if conditions != {TOPIC_CODES[topic]}:
            errors.append(f"condition/topic mismatch: topic={topic}, conditions={conditions}")

    orders = {r.get("stimulus_order", "") for r in rows if not blank(r.get("stimulus_order"))}
    if len(orders) != 1:
        errors.append(f"expected one stimulus_order, found {sorted(orders)!r}")
        stimulus_order = []
    else:
        stimulus_order = split_order(next(iter(orders)))
        if not is_perm(stimulus_order, TRAITS):
            errors.append(f"invalid stimulus_order: {stimulus_order}")

    reloads = {r.get("reload_count", "") for r in rows if not blank(r.get("reload_count"))}
    reload_values = {parse_int(x) for x in reloads}
    if len(reloads) != 1 or None in reload_values or min(reload_values) < 0:
        errors.append(f"expected one non-negative integer reload_count, found {sorted(reloads)!r}")

    # Redundant order/topic fields must agree with topic + stimulus_order.
    if topic and is_perm(stimulus_order, TRAITS):
        expected_sequence = "-".join(f"{topic}_{t}" for t in stimulus_order)
        for field, expected in [
            ("stimulus_sequence_codes", expected_sequence),
            ("first_stimulus_trait", stimulus_order[0]),
            ("first_stimulus_code", f"{topic}_{stimulus_order[0]}"),
            ("topic_name", TOPIC_NAMES[topic]),
        ]:
            found = {r.get(field, "") for r in rows if not blank(r.get(field))}
            if found != {expected}:
                errors.append(f"{field}={sorted(found)!r}, expected {expected!r}")

    stim_rows = [r for r in rows if r.get("trial_kind") == "stimulus_evaluation"]
    finals = [r for r in rows if r.get("trial_kind") == "final_summary"]
    if len(stim_rows) != 3:
        errors.append(f"expected 3 stimulus_evaluation rows, found {len(stim_rows)}")
    if len(finals) != 1:
        errors.append(f"expected 1 final_summary row, found {len(finals)}")

    if len(stim_rows) == 3 and topic:
        positions = [parse_int(r.get("stimulus_position")) for r in stim_rows]
        if sorted(x for x in positions if x is not None) != [1, 2, 3]:
            errors.append(f"invalid stimulus positions: {positions}")

        by_position = {parse_int(r.get("stimulus_position")): r for r in stim_rows}
        for pos, expected_trait in enumerate(stimulus_order, 1):
            row = by_position.get(pos)
            if not row:
                continue
            expected_code = f"{topic}_{expected_trait}"
            if row.get("stimulus_code") != expected_code:
                errors.append(
                    f"position {pos}: stimulus_code={row.get('stimulus_code')!r}, expected {expected_code!r}"
                )
            if row.get("stimulus_trait") != expected_trait:
                errors.append(
                    f"position {pos}: stimulus_trait={row.get('stimulus_trait')!r}, expected {expected_trait!r}"
                )

        codes = [r.get("stimulus_code") for r in stim_rows]
        expected_codes = [f"{topic}_{x}" for x in TRAITS]
        if sorted(codes) != sorted(expected_codes):
            errors.append(f"invalid stimulus set: {codes}")

        for row in stim_rows:
            code = row.get("stimulus_code", "?")
            trait_order = split_order(row.get("trait_row_order"))
            semantic_order = split_order(row.get("semantic_row_order"))
            if not is_perm(trait_order, TRAIT_ITEMS):
                errors.append(f"{code}: invalid trait_row_order={trait_order}")
            if not is_perm(semantic_order, SEMANTIC_ITEMS):
                errors.append(f"{code}: invalid semantic_row_order={semantic_order}")

            for key in MEASURES:
                value = parse_int(row.get(key))
                if value is None or not (1 <= value <= 7):
                    errors.append(f"{code}: {key}={row.get(key)!r} is not an integer 1-7")

            if str(row.get("response_integrity_ok", "")).lower() not in {"true", "1"}:
                errors.append(f"{code}: response_integrity_ok is not true")
            if not blank(row.get("invalid_response_fields")):
                errors.append(f"{code}: invalid_response_fields={row.get('invalid_response_fields')!r}")
            if row.get("topic_code") != topic:
                errors.append(f"{code}: topic_code={row.get('topic_code')!r}, expected {topic!r}")

        # Stimulus rows must appear in the data in the order they were shown.
        indices = [parse_int(r.get("trial_index")) for r in stim_rows]
        if None not in indices:
            by_time = [parse_int(r.get("stimulus_position")) for _, r in sorted(zip(indices, stim_rows), key=lambda x: x[0])]
            if by_time != [1, 2, 3]:
                errors.append(f"stimulus rows recorded in position order {by_time}, expected [1, 2, 3]")

    if len(finals) == 1:
        final = finals[0]
        if final.get("AGE") not in {"18-24", "25-34", "35-44", "45-54", "55-64", "65+"}:
            errors.append(f"final: invalid AGE={final.get('AGE')!r}")
        if final.get("GENDER") not in {"zena", "muz", "jine"}:
            errors.append(f"final: invalid GENDER={final.get('GENDER')!r}")
        if final.get("COUNTRY") not in {"CZ", "SK", "OTHER"}:
            errors.append(f"final: invalid COUNTRY={final.get('COUNTRY')!r}")

        completed_raw = final.get("completed_at", "")
        completed_at = parse_iso_datetime(completed_raw)
        if completed_at is None:
            errors.append(f"final: invalid/missing completed_at timestamp: {completed_raw!r}")
        elif started_at is not None and completed_at < started_at:
            errors.append("final: completed_at is earlier than started_at")

        eco = parse_int(final.get("ECO_VALIDITY"))
        if eco is None or not 1 <= eco <= 7:
            errors.append(f"final: ECO_VALIDITY={final.get('ECO_VALIDITY')!r} is not 1-7")
        if str(final.get("final_integrity_ok", "")).lower() not in {"true", "1"}:
            errors.append("final: final_integrity_ok is not true")

        # Check wide final row against the three stimulus rows.
        for row in stim_rows:
            code = row.get("stimulus_code", "")
            if "_" not in code:
                continue
            prefix = code.replace("_", "")
            for key in MEASURES:
                wide = parse_int(final.get(f"{prefix}_{key}"))
                long = parse_int(row.get(key))
                if wide != long:
                    errors.append(f"{code}: final {prefix}_{key}={wide} != stimulus-row {key}={long}")
            if parse_int(final.get(f"{prefix}_position")) != parse_int(row.get("stimulus_position")):
                errors.append(f"{code}: wide position does not match stimulus row")
            if final.get(f"{prefix}_trait_row_order") != row.get("trait_row_order"):
                errors.append(f"{code}: wide trait_row_order does not match stimulus row")
            if final.get(f"{prefix}_semantic_row_order") != row.get("semantic_row_order"):
                errors.append(f"{code}: wide semantic_row_order does not match stimulus row")
            if str(final.get(f"{prefix}_integrity_ok", "")).lower() not in {"true", "1"}:
                errors.append(f"{code}: wide {prefix}_integrity_ok is not true")

        if topic:
            other = "B" if topic == "A" else "A"
            for trait in TRAITS:
                prefix = f"{other}{trait}"
                for key in MEASURES + WIDE_EXTRA:
                    if not blank(final.get(f"{prefix}_{key}")):
                        errors.append(f"final: unassigned-topic field {prefix}_{key} should be blank")

    return errors


def file_info(path: Path):
    """Key facts of a file for the duplicate check and the summary."""
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    first = rows[0] if rows else {}
    final = next((r for r in rows if r.get("trial_kind") == "final_summary"), {})
    return {
        "participant_id": first.get("participant_id", ""),
        "topic": first.get("topic", ""),
        "stimulus_order": first.get("stimulus_order", ""),
        "first": first.get("first_stimulus_trait", ""),
        "reload_count": parse_int(first.get("reload_count")),
        "country": final.get("COUNTRY", ""),
    }


def print_summary(infos, partial_count):
    def line(label, counter):
        print(f"  {label:<20} " + ", ".join(f"{k}={v}" for k, v in sorted(counter.items())))

    print("\nSummary of valid files (information only, never a failure):")
    line("topic", Counter(i["topic"] for i in infos))
    for t in sorted({i["topic"] for i in infos}):
        sub = [i for i in infos if i["topic"] == t]
        line(f"topic {t} first shown", Counter(i["first"] for i in sub))
        line(f"topic {t} order", Counter(i["stimulus_order"] for i in sub))
    line("country", Counter(i["country"] for i in infos))
    reloaded = sum(1 for i in infos if (i["reload_count"] or 0) > 0)
    print(f"  {'reloaded/reopened':<20} {reloaded} of {len(infos)} (reload_count > 0; these respondents may have seen a post before rating it)")
    print(f"  {'.partial.json files':<20} {partial_count} (abandoned sessions; not validated, not included above)")


def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_datapipe_exports.py /path/to/datapipe_folder")
        raise SystemExit(2)

    root = Path(sys.argv[1])
    files = sorted(root.rglob("*.csv")) if root.is_dir() else [root]
    if not files:
        print("No CSV files found.")
        raise SystemExit(2)

    # The same participant_id in more than one file is always an error.
    ids = {}
    for path in files:
        try:
            ids.setdefault(file_info(path)["participant_id"], []).append(path.name)
        except Exception:
            pass
    duplicated = {pid: names for pid, names in ids.items() if pid and len(names) > 1}

    bad = 0
    valid_infos = []
    for path in files:
        errors = validate_file(path)
        try:
            info = file_info(path)
        except Exception:
            info = None
        if info and info["participant_id"] in duplicated:
            others = [n for n in duplicated[info["participant_id"]] if n != path.name]
            errors.append(f"participant_id {info['participant_id']} also appears in {others}")
        if errors:
            bad += 1
            print(f"FAIL  {path.name}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK    {path.name}")
            valid_infos.append(info)

    print(f"\nChecked {len(files)} CSV file(s): {len(files)-bad} OK, {bad} with errors.")
    partial_count = len(list(root.rglob("*.partial.json"))) if root.is_dir() else 0
    print_summary(valid_infos, partial_count)
    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
