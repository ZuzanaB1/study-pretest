# Pretest data dictionary

## Global fields

- `study_version`: identifies the exact questionnaire/code build. Current build: `pretest-2026-10-27-v5`. Analyse only the intended launch version.
- `participant_id`: random 16-character participant identifier used as the DataPipe filename. For a real respondent, the same ID is reused after a reload, or after closing the tab and reopening the link in the same browser, until the completed file is successfully saved (see Reload persistence).
- `started_at`: ISO-8601 UTC timestamp created when the respondent is first assigned. It is preserved across reloads and reopening the link in the same browser.
- `reload_count`: `0` if the respondent completed the questionnaire on the first page load. `1` or more = how many times they reloaded the page or reopened the link before the run that was saved. A respondent with `reload_count > 0` started again from the welcome page and may have seen one or more posts before the run that was saved; consider excluding or checking them in a sensitivity analysis.
- `datapipe_condition`: `0` for Topic A, `1` for Topic B. `null` in local test mode (which is not saved).
- `topic`: `A` or `B`.
- `topic_name`: `zdravotnictvi` for A, `byrokracie` for B.
- `stimulus_order`: trait presentation order, e.g. `N-O-C`.
- `stimulus_sequence_codes`: exact image sequence, e.g. `A_N-A_O-A_C`.
- `first_stimulus_trait`: O, C or N shown first.
- `first_stimulus_code`: exact first stimulus, e.g. `A_N`.
- `topic_assignment_source`: normally `datapipe_sequence`.
- `order_assignment_source`: normally `random`.

## `stimulus_evaluation` rows

There should be exactly three per completed participant.

- `stimulus_code`: A_O, A_C, A_N, B_O, B_C or B_N.
- `stimulus_trait`: O, C or N.
- `stimulus_position`: 1, 2 or 3.
- `trait_row_order`: exact randomized order of `O1 O2 C1 C2 N1 N2 A1 A2 E1 E2`.
- `semantic_row_order`: exact randomized order of `POP LR PROF EMO`.
- `O1` ... `E2`: Big Five stimulus-perception ratings, integers 1-7.
- `POP`: nepopulisticky (1) to populisticky (7).
- `LR`: levicove (1) to pravicove (7).
- `PROF`: neprofesionalne (1) to profesionalne (7).
- `EMO`: vecne (1) to emocionalne (7).
- `response_integrity_ok`: should be `true` for a valid completed stimulus row.
- `invalid_response_fields`: blank for a valid completed stimulus row; otherwise contains the IDs of invalid/missing response fields separated by `|`.

## `final_summary` row

There should be exactly one per completed participant.

- `AGE`: 18-24, 25-34, 35-44, 45-54, 55-64, 65+.
- `GENDER`: zena, muz, jine.
- `COUNTRY`: CZ, SK, OTHER.
- `ECO_VALIDITY`: 1-7.
- `COMMENT`: optional free-text comment; blank if unused.
- `completed_at`: ISO-8601 UTC timestamp created when the final questionnaire form is submitted.
- `final_integrity_ok`: should be `true` for a completed final form.

The wide columns use prefixes `AO`, `AC`, `AN`, `BO`, `BC`, `BN`.
For example, `AN_O1` is the O1 rating given to the Topic-A Negative-Emotionality
stimulus. The three stimuli from the respondent's unassigned topic remain blank in the CSV.

For each prefix the final row also stores:
- `<prefix>_position`
- `<prefix>_trait_row_order`
- `<prefix>_semantic_row_order`
- `<prefix>_integrity_ok`

## Reload persistence

For real respondents, `participant_id`, `datapipe_condition`, `topic`, `stimulus_order`, `started_at` and `reload_count` are stored in browser `localStorage`. Reloading the page, or closing the tab and opening the link again in the same browser, therefore reuses the same participant ID, topic, and O/C/N order instead of requesting a new DataPipe condition; each such restart increases `reload_count` by one. This mechanism does not restore already entered answers or the respondent's questionnaire position (the questionnaire starts again from the welcome page, and the 10 + 4 item orders are re-randomized and saved for the run that is completed). The stored assignment is cleared after the completed CSV is successfully saved to DataPipe, and an unfinished assignment expires 24 hours after `started_at`. A different browser, device or private window always gets a new assignment.
