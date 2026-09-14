/* ==========================================================================
   L'atelier du prompt — logique de l'application
   Tout se passe en local : aucune donnée n'est envoyée sur le réseau.
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "atelierDuPromptState";
  const TOTAL_STEPS = 5;

  /* ------------------------------------------------------------------ */
  /* État de l'application                                              */
  /* ------------------------------------------------------------------ */

  const defaultState = {
    currentStep: 1,
    maxStepReached: 1,
    situation: null,
    missingChecks: {},
    missingVerified: false,
    fields: {
      objectif: "",
      contexte: "",
      role: "",
      contraintes: "",
      format: ""
    },
    finalPrompt: "",
    finalPromptGenerated: false,
    challengeSelected: null,
    challengeAnswers: { "1": "", "2": "", "3": "" },
    pisteVisible: false,
    checklist: {}
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneState(defaultState);
      const parsed = JSON.parse(raw);
      // Fusion défensive : garantit la présence de toutes les clés attendues.
      return Object.assign(structuredCloneState(defaultState), parsed, {
        fields: Object.assign({}, defaultState.fields, parsed.fields),
        challengeAnswers: Object.assign({}, defaultState.challengeAnswers, parsed.challengeAnswers),
        missingChecks: Object.assign({}, defaultState.missingChecks, parsed.missingChecks),
        checklist: Object.assign({}, defaultState.checklist, parsed.checklist)
      });
    } catch (err) {
      return structuredCloneState(defaultState);
    }
  }

  function structuredCloneState(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      // Le stockage local peut être indisponible (navigation privée, quota) :
      // l'atelier reste utilisable, seule la sauvegarde automatique est perdue.
    }
  }

  /* ------------------------------------------------------------------ */
  /* Références DOM                                                     */
  /* ------------------------------------------------------------------ */

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // Boîte de dialogue de confirmation maison : plus fiable que window.confirm()
  // (que certains contextes embarqués bloquent silencieusement) et mieux intégrée
  // visuellement. Retourne une promesse résolue à true (confirmé) ou false (annulé).
  function showConfirm(message, options) {
    options = options || {};
    return new Promise((resolve) => {
      const overlay = $("#modal-overlay");
      const msgEl = $("#modal-message");
      const confirmBtn = $("#modal-confirm");
      const cancelBtn = $("#modal-cancel");
      msgEl.textContent = message;
      confirmBtn.textContent = options.confirmLabel || "Confirmer";
      cancelBtn.textContent = options.cancelLabel || "Annuler";
      overlay.hidden = false;
      const previouslyFocused = document.activeElement;
      confirmBtn.focus();

      function cleanup(result) {
        overlay.hidden = true;
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onOverlayClick);
        document.removeEventListener("keydown", onKeydown);
        if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
        resolve(result);
      }
      function onConfirm() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }
      function onKeydown(e) { if (e.key === "Escape") cleanup(false); }

      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", onOverlayClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  // Navigation au clavier (flèches) pour les groupes de boutons role="radiogroup".
  function enableRadiogroupArrowKeys(container) {
    const items = $$('[role="radio"]', container);
    items.forEach((item, index) => {
      item.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
        e.preventDefault();
        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const nextIndex = (index + delta + items.length) % items.length;
        items[nextIndex].focus();
      });
    });
  }

  const steps = $$(".step");
  const stepperButtons = $$(".stepper__button");
  const progressFill = $("#progress-fill");
  const bottomNavStatus = $("#bottom-nav-status");
  const btnPrev = $("#btn-prev");
  const btnNext = $("#btn-next");

  /* ------------------------------------------------------------------ */
  /* Navigation entre étapes                                            */
  /* ------------------------------------------------------------------ */

  function goToStep(stepNumber, options) {
    options = options || {};
    stepNumber = Math.min(Math.max(stepNumber, 1), TOTAL_STEPS);

    // On ne permet de sauter en avant que jusqu'à l'étape la plus loin déjà atteinte.
    if (!options.force && stepNumber > state.maxStepReached) {
      stepNumber = state.maxStepReached;
    }

    state.currentStep = stepNumber;
    state.maxStepReached = Math.max(state.maxStepReached, stepNumber);
    saveState();
    renderStep();

    // Replace le focus en haut de la nouvelle étape, utile au clavier / lecteurs d'écran.
    const activeSection = $(`#step-${stepNumber}`);
    if (activeSection) {
      const heading = activeSection.querySelector("h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: false });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderStep() {
    steps.forEach((section) => {
      const num = Number(section.dataset.step);
      section.hidden = num !== state.currentStep;
    });

    stepperButtons.forEach((btn) => {
      const num = Number(btn.dataset.goto);
      btn.classList.toggle("is-done", num < state.currentStep);
      if (num === state.currentStep) {
        btn.setAttribute("aria-current", "step");
      } else {
        btn.removeAttribute("aria-current");
      }
      btn.disabled = num > state.maxStepReached;
    });

    const percent = (state.currentStep / TOTAL_STEPS) * 100;
    progressFill.style.width = percent + "%";
    bottomNavStatus.textContent = `Étape ${state.currentStep} sur ${TOTAL_STEPS}`;

    btnPrev.hidden = state.currentStep === 1;
    btnNext.hidden = state.currentStep === TOTAL_STEPS;

    if (state.currentStep === 5) {
      renderStep5();
    }
  }

  btnPrev.addEventListener("click", () => goToStep(state.currentStep - 1));
  btnNext.addEventListener("click", () => goToStep(state.currentStep + 1, { force: true }));

  stepperButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const num = Number(btn.dataset.goto);
      if (num <= state.maxStepReached) {
        goToStep(num, { force: true });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Étape 1 — situation de départ                                      */
  /* ------------------------------------------------------------------ */

  const situationCards = $$(".situation-card");
  situationCards.forEach((card) => {
    card.addEventListener("click", () => {
      const value = card.dataset.situation;
      state.situation = state.situation === value ? null : value;
      situationCards.forEach((c) => c.setAttribute("aria-checked", String(c.dataset.situation === state.situation)));
      saveState();
    });
  });

  function restoreStep1() {
    situationCards.forEach((c) => c.setAttribute("aria-checked", String(c.dataset.situation === state.situation)));
  }

  $("#btn-start").addEventListener("click", () => goToStep(2, { force: true }));

  /* ------------------------------------------------------------------ */
  /* Étape 2 — éléments manquants                                       */
  /* ------------------------------------------------------------------ */

  const missingCheckboxes = $$(".missing-checkbox");

  // "present" décrit la réalité de la demande de départ (voir l'étape 2) :
  // le niveau et l'objectif y sont déjà donnés, le reste ne l'est pas.
  // whenChecked / whenUnchecked sont les commentaires affichés selon le choix de l'utilisateur.
  const missingItemsInfo = {
    niveau: {
      present: true,
      whenChecked: "En réalité, le niveau scolaire est déjà précisé dans la demande (« 4e secondaire »). Le réflexe de le vérifier reste toutefois une bonne habitude.",
      whenUnchecked: "Vous avez raison de ne pas cocher le niveau scolaire : il est déjà précisé dans la demande."
    },
    duree: {
      present: false,
      whenChecked: "La durée manque bien à cette demande : sans elle, difficile de savoir si l'activité tient en 50 minutes ou nécessite deux séances.",
      whenUnchecked: "Vous pourriez aussi cocher la durée : sans elle, difficile de savoir si l'activité tient en 50 minutes ou nécessite deux séances."
    },
    objectifs: {
      present: true,
      whenChecked: "En réalité, l'objectif d'apprentissage est déjà précisé dans la demande (« comprendre les causes principales du phénomène »).",
      whenUnchecked: "Vous avez raison de ne pas cocher les objectifs d'apprentissage : ils sont déjà précisés dans la demande."
    },
    contexte: {
      present: false,
      whenChecked: "Le contexte de classe manque bien : le nombre d'élèves, leur profil ou le matériel disponible ne sont pas précisés.",
      whenUnchecked: "Vous pourriez aussi cocher le contexte de classe : le nombre d'élèves, leur profil ou le matériel disponible ne sont pas précisés."
    },
    contraintes: {
      present: false,
      whenChecked: "Les contraintes manquent bien : aucune limite de temps, de matériel ou de démarche n'est indiquée.",
      whenUnchecked: "Vous pourriez aussi cocher les contraintes : aucune limite de temps, de matériel ou de démarche n'est indiquée."
    },
    format: {
      present: false,
      whenChecked: "Le format manque bien : la forme attendue de la réponse (tableau, liste, fiche…) n'est pas précisée.",
      whenUnchecked: "Vous pourriez aussi cocher le format souhaité : la forme attendue de la réponse (tableau, liste, fiche…) n'est pas précisée."
    }
  };

  missingCheckboxes.forEach((box) => {
    box.addEventListener("change", () => {
      const key = box.dataset.missing;
      state.missingChecks[key] = box.checked;
      // Une nouvelle case cochée invalide la vérification précédente : on invite à revérifier.
      state.missingVerified = false;
      $("#missing-result").hidden = true;
      saveState();
    });
  });

  function renderMissingVerification() {
    const aligned = [];
    const toReconsider = [];

    missingCheckboxes.forEach((box) => {
      const key = box.dataset.missing;
      const info = missingItemsInfo[key];
      const checked = box.checked;
      // "aligned" = le choix de l'utilisateur correspond à la réalité de la demande.
      const isAligned = checked !== info.present;
      const text = checked ? info.whenChecked : info.whenUnchecked;
      // ✅ coché à raison · 👍 laissé décoché à raison · 🤔 coché alors que c'est déjà présent · ➕ oublié alors que ça manque
      const icon = isAligned ? (checked ? "✅" : "👍") : (checked ? "🤔" : "➕");
      const cls = isAligned ? "found" : "missing";
      const item = `<li class="${cls}">${icon} ${text}</li>`;
      (isAligned ? aligned : toReconsider).push(item);
    });

    let html = "";
    if (aligned.length) {
      html += `<p><strong>Bien vu :</strong></p><ul>${aligned.join("")}</ul>`;
    }
    if (toReconsider.length) {
      html += `<p><strong>À reconsidérer :</strong></p><ul>${toReconsider.join("")}</ul>`;
    }
    html += `<p class="muted small">Cette demande précise déjà le niveau et l'objectif : ce sont surtout la durée, le contexte de classe, les contraintes et le format qui restent à ajouter pour la rendre vraiment exploitable.</p>`;

    const box = $("#missing-result");
    box.innerHTML = html;
    box.hidden = false;
  }

  $("#btn-check-missing").addEventListener("click", () => {
    state.missingVerified = true;
    saveState();
    renderMissingVerification();
  });

  function restoreStep2() {
    missingCheckboxes.forEach((box) => {
      box.checked = !!state.missingChecks[box.dataset.missing];
    });
    if (state.missingVerified) {
      renderMissingVerification();
    } else {
      $("#missing-result").hidden = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Étape 3 — constructeur O-C-R-C-F                                   */
  /* ------------------------------------------------------------------ */

  const fieldIds = {
    objectif: "field-objectif",
    contexte: "field-contexte",
    role: "field-role",
    contraintes: "field-contraintes",
    format: "field-format"
  };

  const exampleCompletee = {
    objectif: "Proposer une activité d'introduction sur le tri des déchets et le recyclage.",
    contexte: "Pour des élèves de 2e secondaire, en sciences, avec une classe de 24 élèves qui n'a jamais abordé le sujet.",
    role: "Agis comme un conseiller pédagogique en sciences, habitué à concevoir des activités actives.",
    contraintes: "Prévoir 50 minutes, peu de matériel, une démarche active et un vocabulaire accessible.",
    format: "Présente la proposition sous la forme d'un tableau avec les étapes, la durée, le matériel et les consignes élèves."
  };

  Object.keys(fieldIds).forEach((key) => {
    const el = $(`#${fieldIds[key]}`);
    el.addEventListener("input", () => {
      state.fields[key] = el.value;
      updateLivePreview();
      saveState();
    });
  });

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.closest(".chip-group");
      const targetId = group.dataset.chipsFor;
      const textarea = $(`#${targetId}`);
      if (!textarea) return;
      const sep = textarea.value.trim().length ? " " : "";
      textarea.value = (textarea.value.trim() + sep + chip.textContent.trim()).trim();
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
    });
  });

  // Version courte, pour l'aperçu en direct pendant la saisie.
  function buildPromptFromFields(fields) {
    const parts = [];
    if (fields.role.trim()) parts.push(fields.role.trim());
    if (fields.objectif.trim()) parts.push(`Objectif : ${fields.objectif.trim()}`);
    if (fields.contexte.trim()) parts.push(`Contexte : ${fields.contexte.trim()}`);
    if (fields.contraintes.trim()) parts.push(`Contraintes : ${fields.contraintes.trim()}`);
    if (fields.format.trim()) parts.push(`Format attendu : ${fields.format.trim()}`);
    return parts.join("\n\n");
  }

  // Version structurée en Markdown, pour le prompt final (un titre par section O-C-R-C-F).
  function buildMarkdownFromFields(fields) {
    const sections = [];
    if (fields.role.trim()) sections.push(`## Rôle\n${fields.role.trim()}`);
    if (fields.objectif.trim()) sections.push(`## Objectif\n${fields.objectif.trim()}`);
    if (fields.contexte.trim()) sections.push(`## Contexte\n${fields.contexte.trim()}`);
    if (fields.contraintes.trim()) sections.push(`## Contraintes\n${fields.contraintes.trim()}`);
    if (fields.format.trim()) sections.push(`## Format attendu\n${fields.format.trim()}`);
    return sections.join("\n\n");
  }

  function updateLivePreview() {
    const preview = $("#live-preview");
    const text = buildPromptFromFields(state.fields);
    if (!text) {
      preview.innerHTML = '<p class="muted small">Votre prompt apparaîtra ici au fur et à mesure que vous complétez les sections.</p>';
      return;
    }
    preview.textContent = text;
  }

  $("#btn-generate").addEventListener("click", async () => {
    const text = buildMarkdownFromFields(state.fields);
    const finalField = $("#field-final-prompt");

    if (state.finalPromptGenerated && finalField.value.trim() && finalField.value.trim() !== state.finalPrompt.trim()) {
      const confirmed = await showConfirm(
        "Vous avez déjà modifié votre prompt final. Voulez-vous vraiment le remplacer par une nouvelle structure Markdown générée à partir des cinq sections ?",
        { confirmLabel: "Remplacer", cancelLabel: "Garder mon texte" }
      );
      if (!confirmed) return;
    }

    finalField.value = text || "Complétez au moins une section ci-dessus pour générer votre prompt.";
    state.finalPrompt = finalField.value;
    state.finalPromptGenerated = true;
    saveState();
    finalField.focus();
  });

  $("#field-final-prompt").addEventListener("input", (e) => {
    state.finalPrompt = e.target.value;
    saveState();
  });

  $("#btn-fill-example").addEventListener("click", async () => {
    const hasContent = state.fields.objectif || state.fields.contexte || state.fields.role || state.fields.contraintes || state.fields.format;
    if (hasContent) {
      const confirmed = await showConfirm(
        "Remplir l'exemple effacera le contenu actuel des cinq sections. Continuer ?",
        { confirmLabel: "Remplacer par l'exemple", cancelLabel: "Annuler" }
      );
      if (!confirmed) return;
    }

    Object.keys(fieldIds).forEach((key) => {
      state.fields[key] = exampleCompletee[key];
      $(`#${fieldIds[key]}`).value = exampleCompletee[key];
    });
    updateLivePreview();
    saveState();
  });

  function restoreStep3() {
    Object.keys(fieldIds).forEach((key) => {
      $(`#${fieldIds[key]}`).value = state.fields[key] || "";
    });
    updateLivePreview();
    $("#field-final-prompt").value = state.finalPrompt || "";
  }

  /* ------------------------------------------------------------------ */
  /* Étape 4 — défis                                                    */
  /* ------------------------------------------------------------------ */

  const challenges = {
    1: {
      original: "Prépare une interrogation sur les fractions.",
      piste: "Agis comme un professeur de mathématiques expérimenté. Objectif : créer une interrogation sur les fractions (addition et comparaison) pour des élèves de 4e primaire. Contexte : classe de 20 élèves, 30 minutes disponibles, addition de fractions de même dénominateur déjà vue. Contraintes : 5 questions maximum, vocabulaire simple, une question de mise en situation concrète. Format attendu : présente les questions sous la forme d'un tableau, avec une colonne « points » pour chaque question."
    },
    2: {
      original: "Explique la photosynthèse à mes élèves.",
      piste: "Agis comme un conseiller pédagogique en sciences. Objectif : proposer une explication de la photosynthèse compréhensible pour des élèves de 1re secondaire. Contexte : élèves n'ayant pas encore vu la notion de cellule. Contraintes : vocabulaire accessible, une analogie concrète, pas plus de 15 lignes. Format attendu : un texte court suivi de trois questions de vérification de compréhension."
    },
    3: {
      original: "Fais une activité pour travailler l'orthographe.",
      piste: "Agis comme un instituteur en langue française. Objectif : proposer une activité pour travailler l'accord du participe passé avec l'auxiliaire avoir. Contexte : élèves de 6e primaire, difficultés fréquentes sur ce point. Contraintes : activité de 20 minutes, en sous-groupes de deux, sans matériel numérique. Format attendu : présente la consigne élève, puis une liste de dix phrases à corriger."
    }
  };

  const challengeCards = $$(".challenge-card");
  challengeCards.forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.challenge;
      state.challengeSelected = id;
      state.pisteVisible = false;
      $("#analysis-result").hidden = true;
      $("#piste-box").hidden = true;
      $("#btn-toggle-piste").textContent = "Afficher une piste d'amélioration";
      saveState();
      renderChallengeSelection();
    });
  });

  function renderChallengeSelection() {
    challengeCards.forEach((c) => c.setAttribute("aria-checked", String(c.dataset.challenge === state.challengeSelected)));
    const workspace = $("#challenge-workspace");
    if (!state.challengeSelected) {
      workspace.hidden = true;
      return;
    }
    workspace.hidden = false;
    const data = challenges[state.challengeSelected];
    $("#challenge-original").textContent = `« ${data.original} »`;
    $("#field-challenge-answer").value = state.challengeAnswers[state.challengeSelected] || "";
    $("#piste-text").textContent = data.piste;
    $("#piste-box").hidden = !state.pisteVisible;
    $("#btn-toggle-piste").textContent = state.pisteVisible ? "Masquer la piste d'amélioration" : "Afficher une piste d'amélioration";
  }

  $("#field-challenge-answer").addEventListener("input", (e) => {
    if (!state.challengeSelected) return;
    state.challengeAnswers[state.challengeSelected] = e.target.value;
    saveState();
  });

  $("#btn-toggle-piste").addEventListener("click", () => {
    state.pisteVisible = !state.pisteVisible;
    $("#piste-box").hidden = !state.pisteVisible;
    $("#btn-toggle-piste").textContent = state.pisteVisible ? "Masquer la piste d'amélioration" : "Afficher une piste d'amélioration";
    saveState();
  });

  /* --- Analyse locale du prompt (aucun appel réseau, aucune IA) --- */

  function analyzePrompt(text) {
    const lower = text.toLowerCase();
    const wordCount = text.trim().length ? text.trim().split(/\s+/).length : 0;

    const checks = {
      niveau: /(maternelle|primaire|secondaire|degré|1re|2e|3e|4e|5e|6e|première|deuxième|troisième|\bans\b)/i.test(lower),
      duree: /(\d+\s?(min|minute|minutes|heure|heures|h)\b)/i.test(lower),
      role: /(agis comme|en tant que|tu es un|tu es une|adopte le rôle|adopte le ton|joue le rôle)/i.test(lower),
      format: /(tableau|liste|questionnaire|grille|fiche|résumé|présentation|paragraphe|plan|tableau récapitulatif|puces)/i.test(lower),
      contraintes: /(contrainte|maximum|minimum|sans |avec |doit |éviter|vocabulaire|matériel|nombre de|pas plus de|au moins)/i.test(lower),
      contexteClasse: /(élèves|classe de|groupe|effectif|besoins spécifiques)/i.test(lower)
    };

    return { checks, wordCount };
  }

  function renderAnalysis(result) {
    const { checks, wordCount } = result;
    const box = $("#analysis-result");
    box.hidden = false;

    const messages = {
      niveau: {
        found: "Vous indiquez un niveau ou un âge : l'IA peut mieux calibrer son vocabulaire et sa complexité.",
        missing: "Vous pourriez préciser le niveau ou l'âge des élèves visés."
      },
      duree: {
        found: "Une durée est mentionnée : cela aide à dimensionner l'activité.",
        missing: "Aucune durée ne semble indiquée. Combien de temps voulez-vous y consacrer ?"
      },
      role: {
        found: "Vous proposez une posture à l'IA (un rôle) : cela oriente le ton et le niveau d'expertise de la réponse.",
        missing: "Vous pourriez suggérer une posture à l'IA, par exemple « agis comme… »."
      },
      format: {
        found: "Le format de réponse souhaité est assez clair.",
        missing: "Le format attendu (tableau, liste, texte court…) n'apparaît pas clairement."
      },
      contraintes: {
        found: "Des contraintes ou conditions sont présentes : cela cadre la réponse.",
        missing: "Aucune contrainte claire (matériel, longueur, vocabulaire…) n'est repérée."
      },
      contexteClasse: {
        found: "Le contexte de classe (élèves, groupe…) est évoqué.",
        missing: "Le contexte de classe (nombre d'élèves, profil du groupe) pourrait être précisé."
      }
    };

    const foundItems = [];
    const missingItems = [];
    Object.keys(checks).forEach((key) => {
      const target = checks[key] ? foundItems : missingItems;
      target.push(messages[key][checks[key] ? "found" : "missing"]);
    });

    let lengthNote = "";
    if (wordCount === 0) {
      lengthNote = "Le champ est vide pour l'instant : commencez par reformuler la demande de départ.";
    } else if (wordCount < 8) {
      lengthNote = "Votre prompt est encore très court : quelques précisions supplémentaires pourraient l'enrichir.";
    } else {
      lengthNote = "Votre prompt est suffisamment développé pour donner du contexte à l'IA.";
    }

    let html = `<p><strong>Ce que votre reformulation apporte déjà :</strong></p>`;
    if (foundItems.length) {
      html += "<ul>" + foundItems.map((m) => `<li class="found">✅ ${m}</li>`).join("") + "</ul>";
    } else {
      html += `<p class="muted small">Pour l'instant, peu d'éléments précis sont repérés — c'est un bon point de départ pour continuer.</p>`;
    }

    if (missingItems.length) {
      html += `<p><strong>Ce que vous pourriez encore préciser :</strong></p>`;
      html += "<ul>" + missingItems.map((m) => `<li class="missing">➕ ${m}</li>`).join("") + "</ul>";
    } else {
      html += `<p><strong>Votre reformulation couvre déjà tous les repères de la méthode O-C-R-C-F.</strong> Vous pouvez encore l'affiner selon votre sensibilité.</p>`;
    }

    html += `<p class="muted small">${lengthNote}</p>`;
    html += `<p class="muted small">Cette analyse repère simplement des mots-clés : elle ne juge pas la qualité pédagogique de votre prompt, et il n'y a pas de « bonne note » à obtenir.</p>`;

    box.innerHTML = html;
  }

  $("#btn-analyze").addEventListener("click", () => {
    if (!state.challengeSelected) return;
    const text = $("#field-challenge-answer").value;
    const result = analyzePrompt(text);
    renderAnalysis(result);
  });

  /* ------------------------------------------------------------------ */
  /* Étape 5 — réutiliser                                                */
  /* ------------------------------------------------------------------ */

  function getChecklistText() {
    return [
      "Avant d'utiliser la réponse de l'IA :",
      "- Je relis et j'adapte la réponse à mes élèves et à mon contexte.",
      "- Je vérifie les faits, les dates, les sources et les éventuelles erreurs.",
      "- Je protège les données personnelles : je ne transmets pas d'informations identifiantes sur mes élèves.",
      "- Je respecte les règles de mon établissement et les droits d'auteur.",
      "- Je reste responsable de la décision pédagogique finale."
    ].join("\n");
  }

  function renderStep5() {
    const display = $("#field-final-display");
    const hasPrompt = !!(state.finalPrompt && state.finalPrompt.trim());
    display.value = hasPrompt ? state.finalPrompt : "Vous n'avez pas encore généré de prompt. Retournez à l'étape 3 (« Construire ») pour le construire.";
    $("#btn-copy").disabled = !hasPrompt;
    $("#btn-download").disabled = !hasPrompt;
  }

  $("#btn-copy").addEventListener("click", async () => {
    const text = state.finalPrompt || "";
    const feedback = $("#copy-feedback");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
      }
      feedback.textContent = "Prompt copié dans le presse-papiers ✅";
    } catch (err) {
      feedback.textContent = "La copie automatique n'a pas fonctionné. Sélectionnez le texte manuellement.";
    }
    window.setTimeout(() => { feedback.textContent = ""; }, 4000);
  });

  $("#btn-download").addEventListener("click", () => {
    const content = `L'ATELIER DU PROMPT — mon prompt final\n${"=".repeat(40)}\n\n${state.finalPrompt}\n\n${"=".repeat(40)}\n${getChecklistText()}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mon-prompt.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  $("#btn-restart").addEventListener("click", async () => {
    const confirmed = await showConfirm(
      "Voulez-vous vraiment recommencer ? Toutes vos réponses seront effacées et vous reviendrez à la première étape.",
      { confirmLabel: "Recommencer", cancelLabel: "Annuler" }
    );
    if (!confirmed) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Rien à faire si le stockage local est inaccessible.
    }
    state = structuredCloneState(defaultState);
    applyStateToForm();
    goToStep(1, { force: true });
  });

  $$(".checklist-item").forEach((box) => {
    box.addEventListener("change", () => {
      state.checklist[box.dataset.check] = box.checked;
      saveState();
    });
  });

  function restoreStep5Checklist() {
    $$(".checklist-item").forEach((box) => {
      box.checked = !!state.checklist[box.dataset.check];
    });
  }

  /* ------------------------------------------------------------------ */
  /* Initialisation                                                     */
  /* ------------------------------------------------------------------ */

  function applyStateToForm() {
    restoreStep1();
    restoreStep2();
    restoreStep3();
    renderChallengeSelection();
    restoreStep5Checklist();
    renderStep();
  }

  enableRadiogroupArrowKeys($("#situation-grid"));
  enableRadiogroupArrowKeys($("#challenge-picker"));

  applyStateToForm();
  goToStep(state.currentStep, { force: true });
})();
