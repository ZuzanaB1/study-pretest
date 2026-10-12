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
  message_progress_bar: "Průběh",
  extensions: [
    {
      type: jsPsychExtensionPipe,
      params: {
        experiment_id: DATAPIPE_EXPERIMENT_ID,
        filename: () => `${participantId}.csv`,
        wait_message: `
          <div class="survey-card welcome-card">
            <h1>Ukládání odpovědí…</h1>
            <p>Prosím, nezavírejte tuto stránku.</p>
          </div>`,
        done_message: `
          <div class="survey-card welcome-card">
            <h1>Děkujeme</h1>
            <p>Vaše odpovědi byly úspěšně uloženy.</p>
            <p>Nyní můžete toto okno zavřít.</p>
          </div>`,
        on_save: (result) => {
          console.log("DataPipe final save result:", result);
          if (!result.ok) {
            document.body.innerHTML = `
              <div class="survey-card welcome-card">
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

const participantSummary = {};

function scaleOptions(name, leftLabel, rightLabel) {
  const sizes = ["xl", "lg", "md", "sm", "md", "lg", "xl"];
  return `
    <div class="scale-labels">
      <span>${leftLabel}</span>
      <span>${rightLabel}</span>
    </div>
    <div class="scale-options">
      ${Array.from({ length: 7 }, (_, i) => {
        const value = i + 1;
        return `
          <label class="scale-choice size-${sizes[i]}" aria-label="${value}">
            <input type="radio" name="${name}" value="${value}" required>
            <span class="choice-circle"></span>
            <span class="choice-number">${value}</span>
          </label>`;
      }).join("")}
    </div>`;
}

function traitSectionHTML(items) {
  return `
    <section class="question-section">
      <h2>Do jaké míry podle Vás následující výroky vystihují způsob, jakým text představuje problém a jeho řešení?</h2>
      <p class="section-note">Vyberte jednu možnost u každého výroku.</p>
      <div class="scale-stack">
        ${items.map(item => `
          <div class="scale-question">
            <div class="statement-text">${item.text}</div>
            ${scaleOptions(item.id, "Rozhodně nesouhlasím", "Rozhodně souhlasím")}
          </div>`).join("")}
      </div>
    </section>`;
}

function semanticSectionHTML(items) {
  return `
    <section class="question-section semantic-section">
      <h2>Jak na Vás příspěvek celkově působí?</h2>
      <p class="section-note">Hodnota 1 odpovídá výrazu vlevo, hodnota 7 výrazu vpravo.</p>
      <div class="scale-stack">
        ${items.map(item => `
          <div class="scale-question semantic-question">
            ${scaleOptions(item.id, item.left, item.right)}
          </div>`).join("")}
      </div>
    </section>`;
}

function stimulusHTML(stimulusCode) {
  return `
    <section class="stimulus-section">
      <p class="instruction">
        <strong>Pozorně si prosím prohlédněte následující příspěvek.</strong>
        Zaměřte se prosím především na text přímo v grafice. Poté odpovězte na několik otázek týkajících se toho, jak příspěvek působí a co podle Vás zdůrazňuje.
      </p>
      <img class="stimulus-image" src="${stimulusCode}.png" alt="Příspěvek">
    </section>`;
}

function enableAutoAdvance() {
  const form = document.querySelector("form");
  if (!form) return;
  const rows = Array.from(form.querySelectorAll(".scale-question"));

  rows.forEach((row, index) => {
    row.addEventListener("change", event => {
      if (!event.target.matches('input[type="radio"]')) return;
      if (row.dataset.autoAdvanced === "1") return;
      row.dataset.autoAdvanced = "1";

      const next = rows[index + 1];
      const target = next || form.querySelector('.jspsych-btn, button[type="submit"], input[type="submit"]');
      if (!target) return;

      setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: next ? "center" : "end"
        });
      }, 180);
    });
  });
}

function buildStimulusTrial(stimulusCode, position) {
  const shuffledTraitItems = jsPsych.randomization.shuffle([...traitItems]);
  const shuffledSemanticItems = jsPsych.randomization.shuffle([...semanticItems]);

  const traitRowOrder = shuffledTraitItems.map(x => x.id).join("-");
  const semanticRowOrder = shuffledSemanticItems.map(x => x.id).join("-");

  return {
    type: jsPsychSurveyHtmlForm,
    preamble: stimulusHTML(stimulusCode),
    html: traitSectionHTML(shuffledTraitItems) + semanticSectionHTML(shuffledSemanticItems),
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
      window.scrollTo({ top: 0, behavior: "instant" });
      enableAutoAdvance();
    },
    on_finish: function(data) {
      const r = data.response || {};
      const prefix = stimulusCode.replace("_", "");
      [...traitItems.map(x => x.id), ...semanticItems.map(x => x.id)].forEach(key => {
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
      <h1>Výzkum politické komunikace</h1>

      <p>V následujícím dotazníku uvidíte několik krátkých politických příspěvků podobných těm, které se mohou objevit na sociálních sítích. Po každém příspěvku budete požádán/a o jeho zhodnocení.</p>

      <p>Vyplnění dotazníku zabere přibližně <strong>8 minut</strong>. Odpovědi jsou zcela anonymní a budou využity pouze pro účely akademického výzkumu. Výzkum je součástí širšího projektu, jehož další fáze bude realizována ve spolupráci s agenturou <strong>NMS Market Research</strong> na reprezentativním vzorku české populace.</p>

      <p>Pokračováním potvrzujete, že jste starší 18 let a souhlasíte s účastí ve výzkumu.</p>
    </div>`,
  choices: ["Začít"],
  data: { trial_kind: "welcome" }
};


function finalHTML() {
  return `
    <div class="survey-card final-card">
      <section class="question-section final-section">
        <h2>Na závěr několik krátkých otázek</h2>

        <div class="final-question">
          <p><strong>Jaký je Váš věk?</strong></p>
          <label class="choice-line"><input type="radio" name="AGE" value="18-24" required> 18–24 let</label>
          <label class="choice-line"><input type="radio" name="AGE" value="25-34" required> 25–34 let</label>
          <label class="choice-line"><input type="radio" name="AGE" value="35-44" required> 35–44 let</label>
          <label class="choice-line"><input type="radio" name="AGE" value="45-54" required> 45–54 let</label>
          <label class="choice-line"><input type="radio" name="AGE" value="55-64" required> 55–64 let</label>
          <label class="choice-line"><input type="radio" name="AGE" value="65+" required> 65 let a více</label>
        </div>

        <div class="final-question">
          <p><strong>Jaké je Vaše pohlaví?</strong></p>
          <label class="choice-line"><input type="radio" name="GENDER" value="zena" required> Žena</label>
          <label class="choice-line"><input type="radio" name="GENDER" value="muz" required> Muž</label>
          <label class="choice-line"><input type="radio" name="GENDER" value="jine" required> Jiné / jinak se identifikuji</label>
          <label class="choice-line"><input type="radio" name="GENDER" value="nechci_uvest" required> Nechci uvést</label>
        </div>

        <div class="final-question">
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
  on_load: () => window.scrollTo({ top: 0, behavior: "instant" }),
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
      <div style="max-width:720px;margin:60px auto;font-family:Arial,sans-serif;line-height:1.5">
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
