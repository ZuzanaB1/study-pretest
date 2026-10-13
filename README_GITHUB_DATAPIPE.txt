STUDY PRETEST — GitHub Pages + DataPipe
========================================

DataPipe experiment ID: G8odHllMqTuG
GitHub Pages deployment: main branch / repository root

This build includes:
- sequential balanced topic allocation via DataPipe (0=A, 1=B)
- randomized O/C/N stimulus order within topic
- randomized trait-item and semantic-differential order for every stimulus
- restored full study introduction / consent wording
- Red Hat Display UI font override (including jsPsych's own display element)
- continuous 16Personalities-inspired question flow
- active row focus: dark text + green unselected outlines
- selected responses remain grey after selection
- larger equal-size 1–7 circles with thinner outlines
- smoother eased auto-advance after first response; free manual scrolling remains possible
- changing an existing response does not auto-advance
- desktop sticky stimulus column
- mobile persistent sticky stimulus preview + tap to enlarge
- enlarged first-exposure stimulus screen
- keyboard 1–7 responses on desktop
- stable wide final-row CSV schema for both topic conditions

Testing helpers:
?topic=A&order=OCN
?topic=B&order=NCO

IMPORTANT: URL-forced topic/order is for testing only. Normal respondents should use the clean GitHub Pages URL so DataPipe assigns the sequential A/B condition.
