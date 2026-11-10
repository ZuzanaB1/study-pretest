const DATAPIPE_EXPERIMENT_ID = "G8odHllMqTuG";
const STUDY_VERSION = "pretest-2026-10-27-v5";
const RESEARCHER_EMAIL = "46029318@fsv.cuni.cz";
const TOPIC_NAMES = {
  A: "zdravotnictvi",
  B: "byrokracie"
};

const params = new URLSearchParams(window.location.search);
const TEST_MODE = params.get("test") === "1";

function makeParticipantId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanTopic(x) {
  const t = (x || "").toUpperCase();
  return (t === "A" || t === "B") ? t : null;
}

function cleanOrder(x) {
  if (!x) return null;
  const chars = x.toUpperCase().replace(/[^OCN]/g, "").split("");
  if (chars.length !== 3) return null;
  return [...chars].sort().join("") === "CNO" ? chars : null;
}

// Forced topic/order are intentionally available only in explicit test mode.
// This prevents a copied testing URL from contaminating the real allocation.
const forcedTopic = TEST_MODE ? cleanTopic(params.get("topic")) : null;
const forcedOrder = TEST_MODE ? cleanOrder(params.get("order")) : null;

if (TEST_MODE) {
  document.documentElement.classList.add("test-mode");
}

// Keep the same assignment if a real respondent reloads the page, or closes the
// tab and opens the link again in the same browser. This does not restore
// answers; it only prevents a new DataPipe condition from being drawn and keeps
// the same participant ID, topic and O/C/N order. Stored in localStorage (not
// sessionStorage) so it survives closing the tab. An unfinished assignment
// expires after ASSIGNMENT_MAX_AGE_MS, so a shared computer does not hand an old
// assignment to a different person days later.
const SESSION_STATE_KEY = `${DATAPIPE_EXPERIMENT_ID}:${STUDY_VERSION}:assignment`;
const ASSIGNMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function loadPersistedAssignment() {
  if (TEST_MODE) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_STATE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);
    const savedTopic = cleanTopic(saved.topic);
    const savedOrder = cleanOrder(saved.stimulus_order);
    const savedCondition = Number(saved.datapipe_condition);
    const validCondition = savedCondition === 0 || savedCondition === 1;
    const topicMatchesCondition =
      (savedCondition === 0 && savedTopic === "A") ||
      (savedCondition === 1 && savedTopic === "B");
    const validParticipantId = typeof saved.participant_id === "string" && saved.participant_id.length > 0;
    const validStartedAt = typeof saved.started_at === "string" && !Number.isNaN(Date.parse(saved.started_at));
    const notExpired = validStartedAt && (Date.now() - Date.parse(saved.started_at)) < ASSIGNMENT_MAX_AGE_MS;
    const previousReloads = Number.isInteger(saved.reload_count) && saved.reload_count >= 0 ? saved.reload_count : 0;

    if (!validCondition || !topicMatchesCondition || !savedOrder || !validParticipantId || !validStartedAt || !notExpired) {
      window.localStorage.removeItem(SESSION_STATE_KEY);
      return null;
    }

    return {
      participant_id: saved.participant_id,
      datapipe_condition: savedCondition,
      topic: savedTopic,
      variants: savedOrder,
      started_at: saved.started_at,
      // This page load is one more restart of the same assignment.
      reload_count: previousReloads + 1
    };
  } catch (error) {
    console.warn("Could not restore persisted assignment:", error);
    return null;
  }
}

function persistAssignment(state) {
  try {
    window.localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not persist assignment for reload protection:", error);
  }
}

function clearPersistedAssignment() {
  try {
    window.localStorage.removeItem(SESSION_STATE_KEY);
  } catch (error) {
    console.warn("Could not clear persisted assignment:", error);
  }
}

const persistedAssignment = loadPersistedAssignment();
const participantId = persistedAssignment?.participant_id || makeParticipantId();
const startedAt = persistedAssignment?.started_at || new Date().toISOString();
// 0 = first time this assignment was loaded; 1+ = how many times the respondent
// reloaded or reopened the link before this (now saved) run. Always 0 in test mode.
const reloadCount = persistedAssignment?.reload_count || 0;
let dataPipeSession = null;

function showSavingMessage() {
  document.body.innerHTML = `
    <div class="survey-card welcome-card save-card">
      <h1>Ukládání odpovědí…</h1>
      <p>Prosím, nezavírejte tuto stránku.</p>
    </div>`;
}

function showSavedMessage() {
  document.body.innerHTML = `
    <div class="survey-card welcome-card save-card">
      <h1>Děkujeme</h1>
      <p>Vaše odpovědi byly úspěšně uloženy.</p>
      <p>Nyní můžete toto okno zavřít.</p>
    </div>`;
}

function showSaveError() {
  document.body.innerHTML = `
    <div class="survey-card welcome-card save-card">
      <h1>Odpovědi se nepodařilo uložit</h1>
      <p>Prosím, nezavírejte tuto stránku a kontaktujte výzkumníka na
        <a href="mailto:${RESEARCHER_EMAIL}">${RESEARCHER_EMAIL}</a>.</p>
    </div>`;
}

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: true,
  message_progress_bar: "",
  on_data_update: (data) => {
    if (!TEST_MODE && dataPipeSession) {
      dataPipeSession.record(data);
    }
  },
  on_finish: async () => {
    if (TEST_MODE) {
      document.body.innerHTML = `
        <div class="survey-card welcome-card save-card">
          <h1>Test dokončen</h1>
          <p>Testovací režim byl dokončen. Data nebyla odeslána do DataPipe.</p>
        </div>`;
      return;
    }

    showSavingMessage();
    const saveStarted = performance.now();

    let result;
    try {
      result = await DataPipe.saveData({
        experiment_id: DATAPIPE_EXPERIMENT_ID,
        filename: `${participantId}.csv`,
        data: jsPsych.data.get().csv(),
        session: dataPipeSession
      });
    } catch (error) {
      console.error("DataPipe final save threw unexpectedly:", error);
      result = { ok: false, status: 0, body: error };
    }

    console.log(`DataPipe final save completed in ${Math.round(performance.now() - saveStarted)} ms`, result);

    if (result?.ok) {
      // The participant sees confirmation as soon as the complete CSV is safely accepted.
      // Session cleanup can finish afterwards without holding the success screen hostage.
      clearPersistedAssignment();
      showSavedMessage();
      if (dataPipeSession) {
        void dataPipeSession.close({ submitted: true });
      }
    } else {
      showSaveError();
      if (dataPipeSession) {
        void dataPipeSession.close({ submitted: false });
      }
    }
  }
});

let topic = null;
let condition = null;
let variants = null;
let stimulusOrder = null;
let stimulusCodes = null;

const traitItems = [
  { id: "O1", text: "Příspěvek zdůrazňuje hledání nových možností a jiných způsobů, jak problém řešit." },
  { id: "O2", text: "Příspěvek vybízí k tomu, abychom se na problém podívali z jiného úhlu a přehodnotili zavedené postupy." },
  { id: "C1", text: "Příspěvek zdůrazňuje plánování, organizovanost a systematický postup." },
  { id: "C2", text: "Příspěvek klade důraz na odpovědnost, důsledné plnění úkolů a dotažení řešení do konce." },
  { id: "N1", text: "Příspěvek zdůrazňuje obavy a nejistotu, které může daný problém lidem způsobovat." },
  { id: "N2", text: "Příspěvek nabízí pocit klidu, jistoty nebo ochrany." },
  { id: "A1", text: "Příspěvek zdůrazňuje soucit a zájem o to, jak se daný problém dotýká druhých lidí." },
  { id: "A2", text: "Příspěvek klade důraz na respekt a spolupráci, vstřícnost a důvěru mezi lidmi." },
  { id: "E1", text: "Příspěvek zdůrazňuje kontakt s lidmi, společné zapojení a aktivní účast." },
  { id: "E2", text: "Příspěvek působí společensky a energicky a snaží se pro své řešení nadchnout ostatní." }
];

const semanticItems = [
  { id: "POP", left: "NEPOPULISTICKY", right: "POPULISTICKY" },
  { id: "LR", left: "LEVICOVĚ", right: "PRAVICOVĚ" },
  { id: "PROF", left: "NEPROFESIONÁLNĚ", right: "PROFESIONÁLNĚ" },
  { id: "EMO", left: "VĚCNĚ", right: "EMOCIONÁLNĚ" }
];

const allMeasureIds = [...traitItems.map(x => x.id), ...semanticItems.map(x => x.id)];
const totalStimulusQuestions = allMeasureIds.length;
const participantSummary = {};

// Keep the final-row schema identical for Topic A and Topic B respondents.
["A_O", "A_C", "A_N", "B_O", "B_C", "B_N"].forEach(code => {
  const prefix = code.replace("_", "");
  allMeasureIds.forEach(id => participantSummary[`${prefix}_${id}`] = "");
  participantSummary[`${prefix}_position`] = "";
  participantSummary[`${prefix}_trait_row_order`] = "";
  participantSummary[`${prefix}_semantic_row_order`] = "";
  participantSummary[`${prefix}_integrity_ok`] = "";
});

const expectedTraitIds = traitItems.map(x => x.id);
const expectedSemanticIds = semanticItems.map(x => x.id);
const preloadedStimulusImages = [];

function showLaunchLoading() {
  document.body.innerHTML = `
    <div class="launch-loading" role="status" aria-live="polite">
      <div class="launch-loading-spinner" aria-hidden="true"></div>
      <p>Načítání dotazníku…</p>
    </div>`;
}

function isExactPermutation(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return [...actual].sort().join("|") === [...expected].sort().join("|");
}

function assertExactPermutation(actual, expected, label) {
  if (!isExactPermutation(actual, expected)) {
    throw new Error(`${label} is not a valid permutation: ${actual.join("-")}`);
  }
}

function parseScaleResponse(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}

async function preloadStimuli(codes) {
  const loads = codes.map((code, index) => new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    if ("fetchPriority" in img) img.fetchPriority = index === 0 ? "high" : "auto";

    const finish = () => resolve(code);
    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", () => reject(new Error(`Stimulus image failed to load: ${code}.png`)), { once: true });
    img.src = `${code}.png`;
    preloadedStimulusImages.push(img);

    // Cached images can already be complete before the event listener fires.
    if (img.complete && img.naturalWidth > 0) finish();
  }));

  await Promise.all(loads);
}

function scaleOptions(name, leftLabel, rightLabel) {
  return `
    <div class="scale-control" data-scale-name="${name}">
      <span class="endpoint-label endpoint-left">${leftLabel}</span>
      <div class="scale-options" role="radiogroup" aria-label="${leftLabel} až ${rightLabel}">
        ${Array.from({ length: 7 }, (_, i) => {
          const value = i + 1;
          return `
            <label class="scale-choice" aria-label="${value}">
              <input type="radio" name="${name}" value="${value}" required>
              <span class="choice-circle"></span>
              <span class="choice-number">${value}</span>
            </label>`;
        }).join("")}
      </div>
      <span class="endpoint-label endpoint-right">${rightLabel}</span>
    </div>`;
}

function traitSectionHTML(items) {
  return `
    <section class="question-section trait-section">
      <div class="section-intro">
        <h2>Do jaké míry podle Vás následující výroky vystihují hlavní způsob, jakým tento příspěvek argumentuje?</h2>
        <p>Vyberte jednu možnost u každého výroku.</p>
      </div>
      <div class="scale-stack">
        ${items.map(item => `
          <div class="scale-question" data-question-id="${item.id}" data-question-group="trait">
            <div class="statement-text">${item.text}</div>
            ${scaleOptions(item.id, "Vůbec nevystihuje", "Zcela vystihuje")}
          </div>`).join("")}
      </div>
    </section>`;
}

function semanticSectionHTML(items) {
  return `
    <section class="question-section semantic-section">
      <div class="section-intro semantic-intro">
        <h2>Jak na Vás příspěvek celkově působí?</h2>
        <p>Hodnota 1 odpovídá výrazu vlevo, hodnota 7 výrazu vpravo.</p>
      </div>
      <div class="scale-stack">
        ${items.map(item => `
          <div class="scale-question semantic-question" data-question-id="${item.id}" data-question-group="semantic">
            ${scaleOptions(item.id, item.left, item.right)}
          </div>`).join("")}
      </div>
    </section>`;
}

function stimulusIntroHTML(stimulusCode, position) {
  return `
    <section class="stimulus-intro" data-stimulus-intro>
      <div class="intro-meta">Příspěvek ${position} ze 3</div>
      <h1>Pozorně si prosím prohlédněte následující příspěvek.</h1>
      <p>Zaměřte se prosím především na text přímo v grafice. Poté odpovězte na několik otázek týkajících se toho, jak příspěvek působí a co podle Vás zdůrazňuje. Během odpovídání se k němu budete moci kdykoli vrátit.</p>
      <button type="button" class="intro-image-button" data-open-stimulus aria-label="Zvětšit příspěvek">
        <img class="intro-stimulus-image" src="${stimulusCode}.png" alt="Příspěvek k hodnocení" loading="eager" decoding="async" fetchpriority="high">
      </button>
      <button type="button" class="start-evaluation-btn" data-start-evaluation>Hodnotit příspěvek</button>
    </section>`;
}

function evaluationHTML(stimulusCode, position, shuffledTraitItems, shuffledSemanticItems) {
  return `
    <div class="evaluation-shell" data-evaluation-shell hidden>
      <div class="mobile-stimulus-bar" data-mobile-stimulus-bar>
        <button type="button" class="mobile-stimulus-button" data-open-stimulus aria-label="Zvětšit příspěvek">
          <img src="${stimulusCode}.png" alt="Náhled příspěvku" loading="eager" decoding="async">
          <span class="mobile-stimulus-copy">
            <strong>Příspěvek ${position} ze 3</strong>
            <span data-mobile-progress>0 z ${totalStimulusQuestions} zodpovězeno</span>
            <small>Klepnutím zvětšit</small>
          </span>
        </button>
      </div>

      <div class="evaluation-grid">
        <main class="question-column">
          <div class="evaluation-status" aria-live="polite">
            <span>Příspěvek ${position} ze 3</span>
            <strong data-desktop-progress>0 z ${totalStimulusQuestions} zodpovězeno</strong>
          </div>
          ${traitSectionHTML(shuffledTraitItems)}
          ${semanticSectionHTML(shuffledSemanticItems)}
        </main>

        <aside class="stimulus-column" aria-label="Příspěvek k hodnocení">
          <div class="desktop-stimulus-card">
            <div class="desktop-stimulus-meta">
              <span>Příspěvek ${position} ze 3</span>
              <button type="button" data-open-stimulus>Zvětšit</button>
            </div>
            <button type="button" class="desktop-stimulus-button" data-open-stimulus aria-label="Zvětšit příspěvek">
              <img src="${stimulusCode}.png" alt="Příspěvek k hodnocení" loading="eager" decoding="async">
            </button>
          </div>
        </aside>
      </div>
    </div>

    <div class="stimulus-modal" data-stimulus-modal hidden role="dialog" aria-modal="true" aria-label="Zvětšený příspěvek">
      <button type="button" class="stimulus-modal-close" data-close-stimulus aria-label="Zavřít">×</button>
      <div class="stimulus-modal-backdrop" data-close-stimulus></div>
      <div class="stimulus-modal-content">
        <img src="${stimulusCode}.png" alt="Zvětšený příspěvek" loading="eager" decoding="async">
      </div>
    </div>`;
}

function getSubmitButton(form) {
  return form.querySelector('#jspsych-survey-html-form-next, input[type="submit"], button[type="submit"], .jspsych-btn');
}

function setupStimulusExperience(stimulusCode, position) {
  const form = document.querySelector("form");
  if (!form) return;

  const intro = form.querySelector("[data-stimulus-intro]");
  const shell = form.querySelector("[data-evaluation-shell]");
  const startButton = form.querySelector("[data-start-evaluation]");
  const modal = form.querySelector("[data-stimulus-modal]");
  const submitButton = getSubmitButton(form);
  const rows = Array.from(form.querySelectorAll(".scale-question"));
  const desktopProgress = form.querySelector("[data-desktop-progress]");
  const mobileProgress = form.querySelector("[data-mobile-progress]");

  let activeRow = null;
  let evaluationStarted = false;
  let programmaticScrollUntil = 0;
  let rafPending = false;

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.classList.remove("is-disabled");
    submitButton.style.display = "none";
  }

  rows.forEach(row => {
    row.classList.add("is-muted");
    const alreadyAnswered = Boolean(row.querySelector('input[type="radio"]:checked'));
    row.dataset.everAnswered = alreadyAnswered ? "1" : "0";
    row.classList.toggle("is-answered", alreadyAnswered);
  });

  function setActiveRow(row) {
    if (!row) return;
    activeRow = row;
    rows.forEach(r => {
      const active = r === row;
      const answered = Boolean(r.querySelector('input[type="radio"]:checked'));
      r.classList.toggle("is-answered", answered);
      r.classList.toggle("is-active", active);
      // Answered rows remain visually muted even when revisited.
      r.classList.toggle("is-muted", !active || answered);
      if (active) r.setAttribute("aria-current", "true");
      else r.removeAttribute("aria-current");
    });
  }

  function answeredCount() {
    return rows.filter(row => row.querySelector('input[type="radio"]:checked')).length;
  }

  function updateProgress() {
    const count = answeredCount();
    const text = `${count} z ${totalStimulusQuestions} zodpovězeno`;
    if (desktopProgress) desktopProgress.textContent = text;
    if (mobileProgress) mobileProgress.textContent = text;
  }

  function stickyOffset() {
    const bar = form.querySelector("[data-mobile-stimulus-bar]");
    const barVisible = bar && window.getComputedStyle(bar).display !== "none";
    if (barVisible) {
      return (bar.getBoundingClientRect().height || 104) + 12;
    }
    return 58;
  }

  function scrollElementBelowSticky(element, behavior = "smooth") {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const targetTop = Math.max(0, window.scrollY + rect.top - stickyOffset() - 4);
    programmaticScrollUntil = Date.now() + (behavior === "smooth" ? 560 : 80);
    window.scrollTo({ top: targetTop, behavior });
  }

  function targetFocusY() {
    const offset = stickyOffset();
    const usable = Math.max(320, window.innerHeight - offset);
    return offset + usable * 0.36;
  }

  function rowScaleCenterY(row) {
    const scale = row?.querySelector('.scale-options');
    if (scale) {
      const rect = scale.getBoundingClientRect();
      return rect.top + rect.height / 2;
    }
    const rect = row.getBoundingClientRect();
    return rect.top + rect.height * 0.55;
  }

  function closestRowToFocusLine() {
    const target = targetFocusY();
    let best = null;
    let bestDistance = Infinity;
    rows.forEach(row => {
      const rect = row.getBoundingClientRect();
      // Ignore rows far outside the viewport so section transitions do not jump focus oddly.
      if (rect.bottom < stickyOffset() - 80 || rect.top > window.innerHeight + 120) return;
      const center = rowScaleCenterY(row);
      const distance = Math.abs(center - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    });
    return best;
  }

  function refreshActiveFromScroll() {
    rafPending = false;
    if (!evaluationStarted || Date.now() < programmaticScrollUntil) return;
    const nearest = closestRowToFocusLine();
    if (nearest && nearest !== activeRow) setActiveRow(nearest);
  }

  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(refreshActiveFromScroll);
  }

  function scrollRowIntoFocus(row, behavior = "smooth") {
    if (!row) return;
    const desiredCenter = targetFocusY();
    const currentCenter = rowScaleCenterY(row);
    programmaticScrollUntil = Date.now() + (behavior === "smooth" ? 520 : 80);
    window.scrollTo({
      top: Math.max(0, window.scrollY + currentCenter - desiredCenter),
      behavior
    });
  }

  // Move the next response scale to the exact vertical position of the scale
  // the respondent just clicked. This keeps the mouse/finger aligned with the
  // same 1–7 response row even after manual scrolling.
  function scrollNextScaleToSameSpot(currentRow, nextRow, selectedValue) {
    if (!currentRow || !nextRow) return;
    const currentChoice = currentRow.querySelector(`input[type="radio"][value="${selectedValue}"]`)?.closest('.scale-choice');
    const nextChoice = nextRow.querySelector(`input[type="radio"][value="${selectedValue}"]`)?.closest('.scale-choice');
    const currentScale = currentRow.querySelector('.scale-options');
    const nextScale = nextRow.querySelector('.scale-options');

    const fromEl = currentChoice || currentScale;
    const toEl = nextChoice || nextScale;
    if (!fromEl || !toEl) {
      scrollRowIntoFocus(nextRow, "smooth");
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const fromY = fromRect.top + fromRect.height / 2;
    const toY = toRect.top + toRect.height / 2;
    const delta = toY - fromY;

    programmaticScrollUntil = Date.now() + 520;
    window.scrollBy({ top: delta, behavior: "smooth" });
  }

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    document.documentElement.classList.add("modal-open");
    const close = modal.querySelector("[data-close-stimulus]");
    if (close) close.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove("modal-open");
  }

  form.querySelectorAll("[data-open-stimulus]").forEach(button => {
    button.addEventListener("click", openModal);
  });
  form.querySelectorAll("[data-close-stimulus]").forEach(button => {
    button.addEventListener("click", closeModal);
  });

  rows.forEach((row, index) => {
    row.addEventListener("pointerdown", () => setActiveRow(row), { passive: true });
    row.addEventListener("focusin", () => setActiveRow(row));

    row.addEventListener("change", event => {
      if (!event.target.matches('input[type="radio"]')) return;

      const firstAnswer = row.dataset.everAnswered !== "1";
      row.dataset.everAnswered = "1";
      row.classList.add("is-answered");
      setActiveRow(row);
      updateProgress();

      if (!firstAnswer) return;

      const next = rows[index + 1];
      if (next) {
        const selectedValue = event.target.value;
        const sectionChanged = row.dataset.questionGroup !== next.dataset.questionGroup;
        setTimeout(() => {
          setActiveRow(next);
          if (sectionChanged) {
            // The scale meaning changes here. Keep the semantic-section heading visible
            // instead of aligning the next circle and scrolling the instructions away.
            const nextIntro = next.closest(".question-section")?.querySelector(".section-intro");
            scrollElementBelowSticky(nextIntro || next, "smooth");
          } else {
            // Preserve the exact vertical position of the selected circle.
            // This remains correct even if the respondent manually scrolled first.
            scrollNextScaleToSameSpot(row, next, selectedValue);
          }
        }, 150);
      } else if (submitButton) {
        setTimeout(() => {
          submitButton.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 190);
      }
    });
  });

  // Keep Pokračovat clickable. If anything is missing, return the respondent
  // to the first unanswered item instead of leaving them at a dead end.
  submitButton?.addEventListener("click", event => {
    const firstUnanswered = rows.find(row => !row.querySelector('input[type="radio"]:checked'));
    if (!firstUnanswered) return;

    event.preventDefault();
    event.stopPropagation();
    setActiveRow(firstUnanswered);
    firstUnanswered.classList.add("needs-answer");
    scrollRowIntoFocus(firstUnanswered, "smooth");
    window.setTimeout(() => firstUnanswered.classList.remove("needs-answer"), 900);
  }, true);

  startButton?.addEventListener("click", () => {
    evaluationStarted = true;
    intro.hidden = true;
    shell.hidden = false;
    if (submitButton) submitButton.style.display = "inline-flex";
    setActiveRow(rows[0]);
    updateProgress();
    window.scrollTo({ top: 0, behavior: "auto" });
    // Let the layout settle before positioning the first item.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollRowIntoFocus(rows[0], "auto")));
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  // Cleanup scroll listeners when jsPsych replaces the trial DOM.
  form.addEventListener("submit", () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  }, { once: true });
}

function buildStimulusTrial(stimulusCode, position) {
  const shuffledTraitItems = jsPsych.randomization.shuffle([...traitItems]);
  const shuffledSemanticItems = jsPsych.randomization.shuffle([...semanticItems]);

  const traitIds = shuffledTraitItems.map(x => x.id);
  const semanticIds = shuffledSemanticItems.map(x => x.id);
  assertExactPermutation(traitIds, expectedTraitIds, "Trait-row order");
  assertExactPermutation(semanticIds, expectedSemanticIds, "Semantic-row order");

  const traitRowOrder = traitIds.join("-");
  const semanticRowOrder = semanticIds.join("-");
  const stimulusTrait = stimulusCode.split("_")[1];
  const topicName = TOPIC_NAMES[stimulusCode.split("_")[0]] || null;

  return {
    type: jsPsychSurveyHtmlForm,
    html:
      stimulusIntroHTML(stimulusCode, position) +
      evaluationHTML(stimulusCode, position, shuffledTraitItems, shuffledSemanticItems),
    button_label: "Pokračovat",
    autocomplete: false,
    data: {
      trial_kind: "stimulus_evaluation",
      stimulus_code: stimulusCode,
      stimulus_trait: stimulusTrait,
      topic_code: stimulusCode.split("_")[0],
      topic_name: topicName,
      stimulus_position: position,
      trait_row_order: traitRowOrder,
      semantic_row_order: semanticRowOrder
    },
    on_load: function() {
      window.scrollTo({ top: 0, behavior: "auto" });
      setupStimulusExperience(stimulusCode, position);
    },
    on_finish: function(data) {
      const r = data.response || {};
      const prefix = stimulusCode.replace("_", "");
      const invalidFields = [];

      allMeasureIds.forEach(key => {
        const value = parseScaleResponse(r[key]);
        if (value === null) invalidFields.push(key);
        data[key] = value;
        participantSummary[`${prefix}_${key}`] = value;
      });

      const integrityOk = invalidFields.length === 0
        && isExactPermutation(traitIds, expectedTraitIds)
        && isExactPermutation(semanticIds, expectedSemanticIds);

      data.response_integrity_ok = integrityOk;
      data.invalid_response_fields = invalidFields.join("|") || "";
      participantSummary[`${prefix}_position`] = position;
      participantSummary[`${prefix}_trait_row_order`] = traitRowOrder;
      participantSummary[`${prefix}_semantic_row_order`] = semanticRowOrder;
      participantSummary[`${prefix}_integrity_ok`] = integrityOk;
      delete data.response;
    }
  };
}

const welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="survey-card welcome-card">
      <h1>Výzkum politické komunikace</h1>
      <p>V následujícím dotazníku uvidíte <strong>tři krátké politické příspěvky</strong> podobné těm, které se mohou objevit na sociálních sítích. Po každém příspěvku budete požádán/a o jeho zhodnocení.</p>
      <p>Při hodnocení prosím vycházejte ze svého prvního dojmu. Neexistují správné ani špatné odpovědi.</p>
      <p>Vyplnění dotazníku zabere přibližně <strong>8 minut</strong>. Odpovědi jsou zcela anonymní a budou využity pouze pro účely akademického výzkumu. Výzkum je součástí širšího projektu, jehož další fáze bude realizována ve spolupráci s agenturou <strong>NMS Market Research</strong> na reprezentativním vzorku české populace.</p>
      <p>V případě dotazů můžete kontaktovat výzkumníka na <a href="mailto:${RESEARCHER_EMAIL}">${RESEARCHER_EMAIL}</a>.</p>
      <p>Pokračováním potvrzujete, že jste starší 18 let a souhlasíte s účastí ve výzkumu.</p>
    </div>`,
  choices: ["Začít"],
  data: { trial_kind: "welcome" }
};

function finalHTML() {
  return `
    <div class="survey-card final-card">
      <div class="eyebrow">Poslední krok</div>
      <section class="question-section final-section">
        <h2>Na závěr několik krátkých otázek</h2>

        <div class="final-question">
          <p class="final-question-title">Jaký je Váš věk?</p>
          <div class="choice-list">
            <label class="choice-line"><input type="radio" name="AGE" value="18-24" required><span>18–24 let</span></label>
            <label class="choice-line"><input type="radio" name="AGE" value="25-34" required><span>25–34 let</span></label>
            <label class="choice-line"><input type="radio" name="AGE" value="35-44" required><span>35–44 let</span></label>
            <label class="choice-line"><input type="radio" name="AGE" value="45-54" required><span>45–54 let</span></label>
            <label class="choice-line"><input type="radio" name="AGE" value="55-64" required><span>55–64 let</span></label>
            <label class="choice-line"><input type="radio" name="AGE" value="65+" required><span>65 let a více</span></label>
          </div>
        </div>

        <div class="final-question">
          <p class="final-question-title">Jaké je Vaše pohlaví?</p>
          <div class="choice-list">
            <label class="choice-line"><input type="radio" name="GENDER" value="zena" required><span>Žena</span></label>
            <label class="choice-line"><input type="radio" name="GENDER" value="muz" required><span>Muž</span></label>
            <label class="choice-line"><input type="radio" name="GENDER" value="jine" required><span>Jiné</span></label>
          </div>
        </div>


        <div class="final-question">
          <p class="final-question-title">Z jaké země pocházíte?</p>
          <div class="choice-list">
            <label class="choice-line"><input type="radio" name="COUNTRY" value="CZ" required><span>Česká republika</span></label>
            <label class="choice-line"><input type="radio" name="COUNTRY" value="SK" required><span>Slovensko</span></label>
            <label class="choice-line"><input type="radio" name="COUNTRY" value="OTHER" required><span>Jiná země</span></label>
          </div>
        </div>

        <div class="final-question final-validity-question">
          <div class="statement-text final-scale-title">Příspěvky, které jste viděli, vypadají jako něco, co by mohl skutečně zveřejnit politik na sociálních sítích.</div>
          ${scaleOptions("ECO_VALIDITY", "Rozhodně nesouhlasím", "Rozhodně souhlasím")}
        </div>

        <div class="final-question">
          <label class="final-question-title" for="COMMENT">Máte k příspěvkům nebo dotazníku nějakou poznámku? <span class="optional-note">(nepovinné)</span></label>
          <textarea id="COMMENT" name="COMMENT" class="comment-field" rows="5" maxlength="2000" placeholder="Vaši poznámku můžete napsat sem."></textarea>
        </div>
      </section>
    </div>`;
}

const finalSurvey = {
  type: jsPsychSurveyHtmlForm,
  html: finalHTML(),
  button_label: "Odeslat",
  autocomplete: false,
  data: { trial_kind: "final_summary" },
  on_load: () => window.scrollTo({ top: 0, behavior: "auto" }),
  on_finish: function(data) {
    const r = data.response || {};
    data.AGE = r.AGE || null;
    data.GENDER = r.GENDER || null;
    data.COUNTRY = r.COUNTRY || null;
    data.ECO_VALIDITY = parseScaleResponse(r.ECO_VALIDITY);
    data.COMMENT = typeof r.COMMENT === "string" && r.COMMENT.trim() ? r.COMMENT.trim() : "";
    data.completed_at = new Date().toISOString();

    const validAge = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"].includes(data.AGE);
    const validGender = ["zena", "muz", "jine"].includes(data.GENDER);
    const validCountry = ["CZ", "SK", "OTHER"].includes(data.COUNTRY);
    data.final_integrity_ok = validAge && validGender && validCountry && data.ECO_VALIDITY !== null;

    participantSummary.AGE = data.AGE;
    participantSummary.GENDER = data.GENDER;
    participantSummary.COUNTRY = data.COUNTRY;
    participantSummary.ECO_VALIDITY = data.ECO_VALIDITY;
    participantSummary.COMMENT = data.COMMENT;
    participantSummary.final_integrity_ok = data.final_integrity_ok;
    Object.assign(data, participantSummary);
    delete data.response;
  }
};

async function createExperiment() {
  showLaunchLoading();

  try {
    if (TEST_MODE) {
      topic = forcedTopic || jsPsych.randomization.shuffle(["A", "B"])[0];
      condition = null;
    } else if (persistedAssignment) {
      condition = persistedAssignment.datapipe_condition;
      topic = persistedAssignment.topic;
    } else {
      condition = await DataPipe.getCondition({ experiment_id: DATAPIPE_EXPERIMENT_ID });
      if (condition !== 0 && condition !== 1) {
        throw new Error(`Unexpected DataPipe condition: ${condition}. Expected only 0 or 1.`);
      }
      topic = condition === 0 ? "A" : "B";
    }
  } catch (error) {
    document.body.innerHTML = `
      <div class="launch-error">
        <h2>Dotazník se nepodařilo spustit.</h2>
        <p>Zkuste prosím stránku obnovit. Pokud problém přetrvává, kontaktujte výzkumníka na
          <a href="mailto:${RESEARCHER_EMAIL}">${RESEARCHER_EMAIL}</a>.</p>
      </div>`;
    console.error("DataPipe condition assignment failed:", error);
    throw error;
  }

  variants = forcedOrder || persistedAssignment?.variants || jsPsych.randomization.shuffle(["O", "C", "N"]);
  assertExactPermutation(variants, ["O", "C", "N"], "Stimulus order");
  stimulusOrder = variants.join("-");
  stimulusCodes = variants.map(variant => `${topic}_${variant}`);

  if (!TEST_MODE) {
    // Written on first assignment and re-written on every restart, so the
    // stored reload_count keeps counting up until the completed file is saved.
    persistAssignment({
      participant_id: participantId,
      datapipe_condition: condition,
      topic: topic,
      stimulus_order: stimulusOrder,
      started_at: startedAt,
      reload_count: reloadCount
    });
  }

  // Start a streaming session only for real respondents. Trials are staged as
  // they finish, so incomplete sessions remain recoverable. The final save
  // uses datapipe-client 0.2.0's session-aware API, which waits only for the
  // session to start and does NOT block on a full staged-data flush.
  if (!TEST_MODE) {
    dataPipeSession = DataPipe.createSession({
      experiment_id: DATAPIPE_EXPERIMENT_ID,
      filename: `${participantId}.csv`
    });
  }

  // Load all three assigned images before the questionnaire starts. This makes
  // the first stimulus appear immediately and avoids later mobile-network stalls.
  try {
    await preloadStimuli(stimulusCodes);
  } catch (error) {
    document.body.innerHTML = `
      <div class="launch-error">
        <h2>Dotazník se nepodařilo načíst.</h2>
        <p>Zkuste prosím stránku obnovit. Pokud problém přetrvává, kontaktujte výzkumníka na
          <a href="mailto:${RESEARCHER_EMAIL}">${RESEARCHER_EMAIL}</a>.</p>
      </div>`;
    console.error("Stimulus preloading failed:", error);
    throw error;
  }

  document.body.innerHTML = "";

  const firstStimulusTrait = variants[0];
  const firstStimulusCode = stimulusCodes[0];

  jsPsych.data.addProperties({
    study_version: STUDY_VERSION,
    participant_id: participantId,
    started_at: startedAt,
    reload_count: reloadCount,
    test_mode: TEST_MODE,
    datapipe_condition: condition,
    topic: topic,
    topic_name: TOPIC_NAMES[topic],
    stimulus_order: stimulusOrder,
    stimulus_sequence_codes: stimulusCodes.join("-"),
    first_stimulus_trait: firstStimulusTrait,
    first_stimulus_code: firstStimulusCode,
    topic_assignment_source: TEST_MODE
      ? (forcedTopic ? "test_url_forced" : "test_random")
      : "datapipe_sequence",
    order_assignment_source: forcedOrder ? "test_url_forced" : "random"
  });

  const stimulusTrials = stimulusCodes.map((stimulusCode, i) =>
    buildStimulusTrial(stimulusCode, i + 1)
  );

  jsPsych.run([
    welcome,
    ...stimulusTrials,
    finalSurvey
  ]);
}

createExperiment();
