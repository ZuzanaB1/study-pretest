const DATAPIPE_EXPERIMENT_ID = "G8odHllMqTuG";

function makeParticipantId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const participantId = makeParticipantId();

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: true,
  message_progress_bar: "",
  extensions: [
    {
      type: jsPsychExtensionPipe,
      params: {
        experiment_id: DATAPIPE_EXPERIMENT_ID,
        filename: () => `${participantId}.csv`,
        wait_message: `
          <div class="survey-card welcome-card save-card">
            <h1>Ukládání odpovědí…</h1>
            <p>Prosím, nezavírejte tuto stránku.</p>
          </div>`,
        done_message: `
          <div class="survey-card welcome-card save-card">
            <h1>Děkujeme</h1>
            <p>Vaše odpovědi byly úspěšně uloženy.</p>
            <p>Nyní můžete toto okno zavřít.</p>
          </div>`,
        on_save: (result) => {
          console.log("DataPipe final save result:", result);
          if (!result.ok) {
            document.body.innerHTML = `
              <div class="survey-card welcome-card save-card">
                <h1>Odpovědi se nepodařilo uložit</h1>
                <p>Prosím, nezavírejte tuto stránku a kontaktujte výzkumníka.</p>
              </div>`;
          }
        }
      }
    }
  ]
});

const params = new URLSearchParams(window.location.search);

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

const forcedTopic = cleanTopic(params.get("topic"));
const forcedOrder = cleanOrder(params.get("order"));

let topic = null;
let condition = null;
let variants = null;
let stimulusOrder = null;

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
  allMeasureIds.forEach(id => participantSummary[`${prefix}_${id}`] = null);
  participantSummary[`${prefix}_position`] = null;
  participantSummary[`${prefix}_trait_row_order`] = null;
  participantSummary[`${prefix}_semantic_row_order`] = null;
});

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
        <h2>Do jaké míry podle Vás následující výroky vystihují způsob, jakým text představuje problém a jeho řešení?</h2>
        <p>Vyberte jednu možnost u každého výroku.</p>
      </div>
      <div class="scale-stack">
        ${items.map(item => `
          <div class="scale-question" data-question-id="${item.id}" data-question-group="trait">
            <div class="statement-text">${item.text}</div>
            ${scaleOptions(item.id, "Rozhodně nesouhlasím", "Rozhodně souhlasím")}
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
      <h1>Prohlédněte si prosím následující příspěvek.</h1>
      <p>Poté budete hodnotit, jak na Vás příspěvek působí. Během odpovídání se k němu budete moci kdykoli vrátit.</p>
      <button type="button" class="intro-image-button" data-open-stimulus aria-label="Zvětšit příspěvek">
        <img class="intro-stimulus-image" src="${stimulusCode}.png" alt="Příspěvek k hodnocení">
      </button>
      <button type="button" class="start-evaluation-btn" data-start-evaluation>Hodnotit příspěvek</button>
    </section>`;
}

function evaluationHTML(stimulusCode, position, shuffledTraitItems, shuffledSemanticItems) {
  return `
    <div class="evaluation-shell" data-evaluation-shell hidden>
      <div class="mobile-stimulus-bar" data-mobile-stimulus-bar>
        <button type="button" class="mobile-stimulus-button" data-open-stimulus aria-label="Zvětšit příspěvek">
          <img src="${stimulusCode}.png" alt="Náhled příspěvku">
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
            <span class="keyboard-hint">Klávesy 1–7 můžete použít pro rychlou odpověď.</span>
          </div>
          ${traitSectionHTML(shuffledTraitItems)}
          ${semanticSectionHTML(shuffledSemanticItems)}
          <div class="completion-note" data-completion-note hidden>Všechny položky jsou zodpovězené. Můžete pokračovat.</div>
        </main>

        <aside class="stimulus-column" aria-label="Příspěvek k hodnocení">
          <div class="desktop-stimulus-card">
            <div class="desktop-stimulus-meta">
              <span>Příspěvek ${position} ze 3</span>
              <button type="button" data-open-stimulus>Zvětšit</button>
            </div>
            <button type="button" class="desktop-stimulus-button" data-open-stimulus aria-label="Zvětšit příspěvek">
              <img src="${stimulusCode}.png" alt="Příspěvek k hodnocení">
            </button>
          </div>
        </aside>
      </div>
    </div>

    <div class="stimulus-modal" data-stimulus-modal hidden role="dialog" aria-modal="true" aria-label="Zvětšený příspěvek">
      <button type="button" class="stimulus-modal-close" data-close-stimulus aria-label="Zavřít">×</button>
      <div class="stimulus-modal-backdrop" data-close-stimulus></div>
      <div class="stimulus-modal-content">
        <img src="${stimulusCode}.png" alt="Zvětšený příspěvek">
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
  const completionNote = form.querySelector("[data-completion-note]");

  let activeRow = null;
  let evaluationStarted = false;
  let programmaticScrollUntil = 0;
  let rafPending = false;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.add("is-disabled");
    submitButton.style.display = "none";
  }

  rows.forEach(row => {
    row.classList.add("is-muted");
    row.dataset.everAnswered = row.querySelector('input[type="radio"]:checked') ? "1" : "0";
  });

  function setActiveRow(row) {
    if (!row) return;
    activeRow = row;
    rows.forEach(r => {
      const active = r === row;
      r.classList.toggle("is-active", active);
      r.classList.toggle("is-muted", !active);
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

    const complete = count === totalStimulusQuestions;
    if (submitButton) {
      submitButton.disabled = !complete;
      submitButton.classList.toggle("is-disabled", !complete);
    }
    if (completionNote) completionNote.hidden = !complete;
  }

  function stickyOffset() {
    if (window.matchMedia("(max-width: 820px)").matches) {
      const bar = form.querySelector("[data-mobile-stimulus-bar]");
      return (bar?.getBoundingClientRect().height || 104) + 12;
    }
    return 58;
  }

  function targetFocusY() {
    const offset = stickyOffset();
    const usable = Math.max(320, window.innerHeight - offset);
    return offset + usable * 0.36;
  }

  function closestRowToFocusLine() {
    const target = targetFocusY();
    let best = null;
    let bestDistance = Infinity;
    rows.forEach(row => {
      const rect = row.getBoundingClientRect();
      // Ignore rows far outside the viewport so section transitions do not jump focus oddly.
      if (rect.bottom < stickyOffset() - 80 || rect.top > window.innerHeight + 120) return;
      const center = rect.top + rect.height * 0.46;
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
    const rect = row.getBoundingClientRect();
    const desiredCenter = targetFocusY();
    const currentCenter = rect.top + rect.height * 0.46;
    programmaticScrollUntil = Date.now() + (behavior === "smooth" ? 650 : 80);
    window.scrollTo({
      top: Math.max(0, window.scrollY + currentCenter - desiredCenter),
      behavior
    });
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

  const keyHandler = event => {
    if (event.key === "Escape" && modal && !modal.hidden) {
      closeModal();
      return;
    }
    if (!evaluationStarted || (modal && !modal.hidden)) return;
    if (!/^[1-7]$/.test(event.key)) return;
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName)) return;
    if (!activeRow) return;

    const input = activeRow.querySelector(`input[type="radio"][value="${event.key}"]`);
    if (!input) return;
    event.preventDefault();
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  document.addEventListener("keydown", keyHandler);

  rows.forEach((row, index) => {
    row.addEventListener("pointerdown", () => setActiveRow(row), { passive: true });
    row.addEventListener("focusin", () => setActiveRow(row));

    row.addEventListener("change", event => {
      if (!event.target.matches('input[type="radio"]')) return;

      const firstAnswer = row.dataset.everAnswered !== "1";
      row.dataset.everAnswered = "1";
      setActiveRow(row);
      updateProgress();

      if (!firstAnswer) return;

      const next = rows[index + 1];
      if (next) {
        setTimeout(() => {
          setActiveRow(next);
          scrollRowIntoFocus(next, "smooth");
        }, 190);
      } else if (submitButton) {
        setTimeout(() => {
          submitButton.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 190);
      }
    });
  });

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

  // Cleanup is mostly handled when jsPsych replaces the trial DOM. Remove the global key handler on submit.
  form.addEventListener("submit", () => {
    document.removeEventListener("keydown", keyHandler);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  }, { once: true });
}

function buildStimulusTrial(stimulusCode, position) {
  const shuffledTraitItems = jsPsych.randomization.shuffle([...traitItems]);
  const shuffledSemanticItems = jsPsych.randomization.shuffle([...semanticItems]);

  const traitRowOrder = shuffledTraitItems.map(x => x.id).join("-");
  const semanticRowOrder = shuffledSemanticItems.map(x => x.id).join("-");

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
      allMeasureIds.forEach(key => {
        const value = r[key] === undefined ? null : Number(r[key]);
        data[key] = value;
        participantSummary[`${prefix}_${key}`] = value;
      });
      participantSummary[`${prefix}_position`] = position;
      participantSummary[`${prefix}_trait_row_order`] = traitRowOrder;
      participantSummary[`${prefix}_semantic_row_order`] = semanticRowOrder;
      delete data.response;
    }
  };
}

const welcome = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="survey-card welcome-card">
      <div class="eyebrow">Pretest</div>
      <h1>Vítejte</h1>
      <p>V průběhu dotazníku uvidíte <strong>tři příspěvky</strong> a u každého z nich odpovíte na několik otázek o tom, jak na Vás působí.</p>
      <p>Neexistují správné ani špatné odpovědi. Odpovídejte prosím podle svého vlastního dojmu.</p>
      <p>Vyplnění zabere přibližně <strong>7–10 minut</strong>.</p>
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
            <label class="choice-line"><input type="radio" name="GENDER" value="jine" required><span>Jiné / jinak se identifikuji</span></label>
            <label class="choice-line"><input type="radio" name="GENDER" value="nechci_uvest" required><span>Nechci uvést</span></label>
          </div>
        </div>

        <div class="final-question final-validity-question">
          <div class="statement-text final-scale-title">Příspěvky, které jste viděli, vypadají jako něco, co by mohl skutečně zveřejnit politik na sociálních sítích.</div>
          ${scaleOptions("ECO_VALIDITY", "Rozhodně nesouhlasím", "Rozhodně souhlasím")}
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
    data.ECO_VALIDITY = r.ECO_VALIDITY === undefined ? null : Number(r.ECO_VALIDITY);
    participantSummary.AGE = data.AGE;
    participantSummary.GENDER = data.GENDER;
    participantSummary.ECO_VALIDITY = data.ECO_VALIDITY;
    Object.assign(data, participantSummary);
    delete data.response;
  }
};

async function createExperiment() {
  try {
    if (forcedTopic) {
      topic = forcedTopic;
      condition = forcedTopic === "A" ? 0 : 1;
    } else {
      condition = await jsPsychExtensionPipe.getCondition(DATAPIPE_EXPERIMENT_ID);
      topic = condition === 0 ? "A" : "B";
    }
  } catch (error) {
    document.body.innerHTML = `
      <div class="launch-error">
        <h2>Dotazník se nepodařilo spustit.</h2>
        <p>Zkuste prosím stránku obnovit. Pokud problém přetrvává, kontaktujte výzkumníka.</p>
      </div>`;
    console.error("DataPipe condition assignment failed:", error);
    throw error;
  }

  variants = forcedOrder || jsPsych.randomization.shuffle(["O", "C", "N"]);
  stimulusOrder = variants.join("-");

  jsPsych.data.addProperties({
    participant_id: participantId,
    datapipe_condition: condition,
    topic: topic,
    stimulus_order: stimulusOrder,
    topic_assignment_source: forcedTopic ? "url_forced" : "datapipe_sequence",
    order_assignment_source: forcedOrder ? "url_forced" : "random"
  });

  const stimulusTrials = variants.map((variant, i) =>
    buildStimulusTrial(`${topic}_${variant}`, i + 1)
  );

  jsPsych.run([
    welcome,
    ...stimulusTrials,
    finalSurvey
  ]);
}

createExperiment();
