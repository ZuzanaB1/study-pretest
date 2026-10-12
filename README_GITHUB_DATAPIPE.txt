STUDY PRETEST — GitHub Pages + DataPipe
=======================================

Upload all files in this ZIP to the ROOT of the GitHub repository.
The site expects these exact filenames:
- index.html
- experiment.js
- style.css
- A_O.png, A_C.png, A_N.png
- B_O.png, B_C.png, B_N.png

DataPipe
--------
Experiment ID: G8odHllMqTuG
Condition 0 -> Topic A
Condition 1 -> Topic B
Topic allocation is sequential/balanced in DataPipe.
Stimulus order O/C/N remains randomized locally for each respondent.
Trait-row order and semantic-row order are randomized independently for every stimulus.

UI / interaction in this version
--------------------------------
- Red Hat Display with system-font fallback.
- Equal-size 1–7 circles retained.
- Full stimulus exposure before each evaluation.
- Desktop: sticky stimulus on the right, continuous scrollable questions on the left.
- Mobile: the stimulus photo remains visible in a compact sticky bar; tap it to enlarge.
- Tap/click any stimulus image to open a full-screen enlargement.
- Current question is visually focused; surrounding questions are muted.
- First response to a question smoothly advances focus to the next question.
- Respondents can manually scroll anywhere and change earlier responses.
- Changing an already-answered response does NOT force another auto-scroll.
- Desktop keyboard shortcuts 1–7 work for the active question.
- Local progress shows number of answered items for the current stimulus.
- Continue is disabled until all items for that stimulus are answered.
- prefers-reduced-motion is respected.

IMPORTANT QUESTION COUNT
------------------------
The preserved content in the current instrument contains 14 ratings per stimulus:
10 trait statements + 4 semantic-differential ratings.
The interface therefore correctly displays progress out of 14.
No new substantive question was invented merely to make the total 15.

Images
------
The six stimulus PNGs have been losslessly trimmed to their non-transparent bounds.
Only fully transparent side padding was removed; the visible stimulus pixels were not altered.
This prevents the browser from reserving a large invisible/white-looking margin around the post.

Data output
-----------
The final_summary row contains one-row-per-participant analysis data.
Wide-format columns are pre-initialized for BOTH A and B stimulus sets so participant CSV schemas stay consistent.
Long stimulus_evaluation rows still retain stimulus position, question order, semantic order, and individual responses.

Testing helpers
---------------
Normal respondents: open the plain GitHub Pages URL.
Optional test parameters are still supported:
  ?topic=A
  ?topic=B
  ?order=OCN
Example: ?topic=A&order=OCN
Using a forced topic bypasses normal DataPipe topic assignment for that test URL.

Deployment
----------
GitHub Pages should remain:
Settings -> Pages -> Deploy from a branch -> main -> /(root)

After replacing files, allow GitHub Pages to deploy, then hard-refresh the site or add a temporary query string such as ?v=4.
