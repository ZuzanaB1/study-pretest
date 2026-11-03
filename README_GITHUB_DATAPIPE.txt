STUDY PRETEST — GitHub Pages + DataPipe
========================================

Study version: pretest-2026-10-27-v5
DataPipe experiment ID: G8odHllMqTuG
GitHub Pages deployment: main branch / repository root
Research contact: 46029318@fsv.cuni.cz

FIXED DESIGN
------------
- Each respondent sees exactly ONE topic:
  - A = zdravotnictvi
  - B = byrokracie
- Topic assignment is sequentially balanced by DataPipe condition:
  - condition 0 -> A
  - condition 1 -> B
- Each respondent sees all three O/C/N versions of their assigned topic.
- O/C/N stimulus order is randomized once per respondent (independent
  randomization, not counterbalanced).
- The 10 Big Five perception items are randomized independently for each stimulus.
- The 4 semantic-differential rows are randomized independently for each stimulus.
- Ecological validity is asked once at the end for the set of posts.
- Final demographics include age, gender and country of origin (CZ / SK / OTHER).
- Final optional free-text comment field is included.

DATA INTEGRITY / ANALYSIS METADATA
----------------------------------
Every saved row contains:
- study_version
- participant_id
- started_at (ISO-8601 UTC, first assignment)
- reload_count (0 = no reload/reopen before the saved run)
- datapipe_condition
- topic and topic_name
- stimulus_order (e.g. N-O-C)
- stimulus_sequence_codes (e.g. A_N-A_O-A_C)
- first_stimulus_trait and first_stimulus_code
- topic_assignment_source
- order_assignment_source

Each stimulus_evaluation row additionally contains:
- stimulus_code (e.g. A_N)
- stimulus_trait (O/C/N)
- topic_code and topic_name
- stimulus_position (1/2/3)
- trait_row_order (exact order of all 10 Big Five items)
- semantic_row_order (exact order of all 4 semantic rows)
- O1, O2, C1, C2, N1, N2, A1, A2, E1, E2
- POP, LR, PROF, EMO
- response_integrity_ok
- invalid_response_fields

The final_summary row has a stable wide schema for BOTH A and B. The unassigned
other-topic columns are blank (empty cells). It also contains AGE, GENDER,
COUNTRY, ECO_VALIDITY, COMMENT, completed_at and final_integrity_ok.

Missing values are written as empty cells, never as the text "null", so the
rating columns read as numbers in R, SPSS and Python.

RELOAD / REOPEN HANDLING
------------------------
The assignment (participant ID, topic, O/C/N order, started_at) is stored in
the browser's localStorage. Reloading the page or closing the tab and opening
the link again in the same browser keeps the same participant ID, topic and
order and does NOT draw a new DataPipe condition. Each restart increases
reload_count by one. Answers are not restored: the respondent starts again from
the welcome page. The stored assignment is cleared once the completed CSV is
saved, and an unfinished one expires after 24 hours. A different browser,
device or private window gets a new assignment. See DATA_DICTIONARY.md.

IMPORTANT: completed DataPipe participant files are CSV. DataPipe's streaming
recovery may produce .partial.json for abandoned/incomplete sessions.

SAFE TESTING
------------
Testing must use test=1. Test mode disables DataPipe session creation and saving entirely,
so it neither consumes a DataPipe condition nor saves data.

Examples:
?test=1&topic=A&order=OCN
?test=1&topic=B&order=NCO

The topic/order URL parameters are ignored unless test=1 is present.
A visible TESTOVACI REZIM badge is displayed during test runs.

For real respondents use ONLY the clean public URL, with no query parameters.

RESPONSIVE / UI NOTES
---------------------
- Desktop keeps the stimulus fixed on the right when there is sufficient width.
- At <=1120 px the design switches to a one-column layout with sticky stimulus preview.
- Seven response points are fluid-width on small phones; there are no fixed
  50 px x 7 controls that can force horizontal overflow.
- Semantic-differential endpoint labels are anchored to the outer edges on mobile.
- The transition from Big Five items to semantic differentials scrolls the new
  section heading into view so the scale meaning is not missed.
- All three assigned stimulus PNGs are fully preloaded before the questionnaire starts.
  A short loading screen is shown while this completes, so the first stimulus cannot appear half-loaded.
- Data saving uses datapipe-client 0.2.0 directly. Streaming recovery remains enabled, but the final CSV save no longer waits for all staged writes to flush before submission.
- Semantic-differential rows use compact spacing on desktop and mobile; there are no large screen-sized gaps between rows.

STIMULUS FILES
--------------
Expected filenames (the study code refers to these exact names):
A_O.png, A_C.png, A_N.png, B_O.png, B_C.png, B_N.png

Stimulus content is maintained separately. When replacing images, keep the exact
filenames. For mobile performance, optimize/compress the final exported files
before launch; the code will preload the three files assigned to each respondent.

VALIDATION
----------
Run validate_datapipe_exports.py on the folder containing downloaded DataPipe
CSV files before analysis:

    python validate_datapipe_exports.py /path/to/folder

Per file it checks: study_version, one participant/topic/order, condition->topic
mapping, that O/C/N each appear exactly once and match the shown sequence and
first-post fields, all 10 + 4 items exactly once per post, 1-7 responses, final
answers (age, gender, country, eco-validity), timestamps, reload_count, and that
the wide final row matches the three post rows (other-topic columns blank).
Across files it fails any participant_id that appears more than once, and prints
an information-only summary: A/B counts, first-shown frame and order counts per
topic, country, number of reloaded respondents and number of .partial.json files.
The summary shows the balance among COMPLETED files; DataPipe alternates per
assignment, so dropouts can make completed A/B counts differ slightly.
