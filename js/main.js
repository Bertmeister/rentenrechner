/**
 * main.js – Entry point: event wiring, recalc loop, modal/tab management
 */

import { getParams, calcAll } from './calc.js';
import {
  renderTable, renderCards, renderVerif,
  updateBreakeven, updateHints, updateHintRpj0, updateHintRpj1,
  updateSubtitle, fmt
} from './render.js';
import {
  getScenarios, saveScenarios, captureValues, applyValues,
  renderScenarioList, MAX_SCENARIOS
} from './scenarios.js';

// ── GLOBAL STATE ──────────────────────────────────────────────────────────────
const AUTOSAVE_KEY = 'rentenplanung-autosave';
window._einmalCount = 0;
const MAX_EINMAL = 3;
let selectedRow  = null;
let activeScenarioName = null;
let pendingOverwriteName = null;
let pendingOverwriteIdx  = -1;

// ── MAIN RECALC ───────────────────────────────────────────────────────────────
export function recalc() {
  const params = getParams();
  const { breakevenAge, scenarios } = calcAll(params);

  updateSubtitle(params);
  updateBreakeven(breakevenAge, params.age);
  updateHints(params);

  // Desktop table
  renderTable(scenarios, breakevenAge, (scenarioData, tr) => {
    if (selectedRow) selectedRow.classList.remove('selected-row');
    selectedRow = tr;
    tr.classList.add('selected-row');
    renderVerif(scenarioData);
    document.getElementById('verif-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // On mobile switch to details tab
    if (window.innerWidth < 768) switchTab('tab-details');
  });

  // Mobile cards
  renderCards(scenarios, breakevenAge, (scenarioData) => {
    renderVerif(scenarioData);
    switchTab('tab-details');
  });

  // Sync scroll width for top scrollbar
  syncScrollWidth();

  // Update mode badge
  const ohne = document.getElementById('toggle-mode')?.checked;
  document.getElementById('mode-badge').textContent = ohne
    ? 'Kapital bleibt erhalten · nur Rendite entnehmen'
    : 'Kapital aufgebraucht bis Lebensende';

  // Show verif intro hint
  const vi = document.getElementById('verif-intro');
  if (vi && !document.getElementById('verif-panel')?.classList.contains('visible')) {
    vi.classList.add('visible');
  }

  // Auto-save current state
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(captureValues()));
  } catch (e) {}
}

// ── EINMALZAHLUNGEN ───────────────────────────────────────────────────────────
window.addEinmal = function addEinmal() {
  if (window._einmalCount >= MAX_EINMAL) return;
  window._einmalCount++;
  const id  = window._einmalCount;
  const age = parseFloat(document.getElementById('inp-age')?.value) || 40;
  const container = document.getElementById('einmal-container');
  const block = document.createElement('div');
  block.className = 'einmal-block';
  block.id = `einmal-block-${id}`;
  block.innerHTML = `
    <div class="einmal-title">Einmalzahlung ${id}</div>
    <button class="einmal-remove" onclick="removeEinmal(${id})" title="Entfernen">✕</button>
    <div class="input-group">
      <span class="input-label">Betrag</span>
      <div class="input-row">
        <input type="number" id="inp-einmal-betrag-${id}" value="10000" min="0" max="1000000" step="1000">
        <span class="input-unit">€</span>
      </div>
      <input type="range" id="sl-einmal-betrag-${id}" min="0" max="200000" step="1000" value="10000">
    </div>
    <div class="input-group">
      <span class="input-label">Im Alter</span>
      <div class="input-row">
        <input type="number" id="inp-einmal-alter-${id}" value="${Math.min(age+10, 60)}" min="${age}" max="67" step="1">
        <span class="input-unit">J.</span>
      </div>
      <input type="range" id="sl-einmal-alter-${id}" min="${age}" max="67" step="1" value="${Math.min(age+10, 60)}">
    </div>
  `;
  container.appendChild(block);

  // Wire sliders
  const betragInp = block.querySelector(`#inp-einmal-betrag-${id}`);
  const betragSl  = block.querySelector(`#sl-einmal-betrag-${id}`);
  const alterInp  = block.querySelector(`#inp-einmal-alter-${id}`);
  const alterSl   = block.querySelector(`#sl-einmal-alter-${id}`);
  betragInp.addEventListener('input', () => { betragSl.value = betragInp.value; recalc(); });
  betragSl.addEventListener('input',  () => { betragInp.value = betragSl.value; recalc(); });
  alterInp.addEventListener('input',  () => { alterSl.value = alterInp.value; recalc(); });
  alterSl.addEventListener('input',   () => { alterInp.value = alterSl.value; recalc(); });

  if (window._einmalCount >= MAX_EINMAL) {
    document.getElementById('einmal-add-btn').style.display = 'none';
  }
  recalc();
};

window.removeEinmal = function removeEinmal(id) {
  document.getElementById(`einmal-block-${id}`)?.remove();
  window._einmalCount--;
  document.getElementById('einmal-add-btn').style.display = '';
  recalc();
};

// ── INPUT WIRING ──────────────────────────────────────────────────────────────
const inputPairs = [
  ['inp-age','sl-age'],['inp-life','sl-life'],['inp-need','sl-need'],
  ['inp-etf','sl-etf'],['inp-inf','sl-inf'],
  ['inp-ret-brutto','sl-ret-brutto'],['inp-tax','sl-tax'],
  ['inp-ent','sl-ent'],['inp-rp','sl-rp'],['inp-rpj0','sl-rpj0'],
  ['inp-rpj1','sl-rpj1'],['inp-spar','sl-spar'],['inp-extra','sl-extra'],
  ['inp-need2','sl-need2'],['inp-zusatz','sl-zusatz'],
  ['inp-netto','sl-netto'],['inp-abgaben','sl-abgaben'],
  ['inp-durchschnittsentgelt','sl-durchschnittsentgelt'],
];

// RPJ0 aktualisiert sich NUR bei Nettogehalt- oder Abgabenquote-Änderung
const rpj0Triggers = new Set(['inp-netto', 'sl-netto', 'inp-abgaben', 'sl-abgaben', 'inp-durchschnittsentgelt', 'sl-durchschnittsentgelt']);
// RPJ1 aktualisiert sich NUR bei Nebeneinkommen- oder Abgabenquote-Änderung
const rpj1Triggers = new Set(['inp-extra', 'sl-extra', 'inp-abgaben', 'sl-abgaben', 'inp-durchschnittsentgelt', 'sl-durchschnittsentgelt']);

function wireInputs() {
  inputPairs.forEach(([a, b]) => {
    const inp = document.getElementById(a);
    const sl  = document.getElementById(b);
    if (!inp || !sl) return;
    inp.addEventListener('input', () => {
      sl.value = inp.value;
      if (rpj0Triggers.has(a)) { updateHintRpj0(getParams()); }
      if (rpj1Triggers.has(a)) { updateHintRpj1(getParams()); }
      recalc();
    });
    sl.addEventListener('input', () => {
      inp.value = sl.value;
      if (rpj0Triggers.has(b)) { updateHintRpj0(getParams()); }
      if (rpj1Triggers.has(b)) { updateHintRpj1(getParams()); }
      recalc();
    });
  });

  document.getElementById('toggle-mode')?.addEventListener('change', () => {
    const ohne = document.getElementById('toggle-mode').checked;
    document.getElementById('lbl-verzehr')?.classList.toggle('active', !ohne);
    document.getElementById('lbl-erhalt')?.classList.toggle('active',   ohne);
    document.getElementById('grp-life')?.classList.toggle('dimmed',  ohne);
    document.getElementById('grp-ent')?.classList.toggle('dimmed',  !ohne);
    recalc();
  });

  document.getElementById('chk-minijob')?.addEventListener('change', () => {
    const checked = document.getElementById('chk-minijob').checked;
    const lblAuf = document.getElementById('lbl-aufstockung');
    if (lblAuf) lblAuf.style.display = checked ? 'flex' : 'none';
    if (!checked) {
      const chkAuf = document.getElementById('chk-minijob-aufstockung');
      if (chkAuf) chkAuf.checked = false;
    }
    updateHintRpj1(getParams());
    recalc();
  });

  document.getElementById('chk-minijob-aufstockung')?.addEventListener('change', () => {
    updateHintRpj1(getParams());
    recalc();
  });
}

// ── TABS (mobile) ─────────────────────────────────────────────────────────────
export function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
}

function wireTabNav() {
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ── INPUTS TOGGLE ─────────────────────────────────────────────────────────────
window.toggleInputs = function() {
  const panel = document.getElementById('inputs-panel');
  const icon  = document.getElementById('inputs-toggle-icon');
  const open  = !panel.classList.contains('collapsed');
  panel.classList.toggle('collapsed', open);
  icon.textContent = open ? '▼' : '▲';
};

// ── RESET TO DEFAULTS ─────────────────────────────────────────────────────────
window.resetToDefaults = function() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}

  // Reset all standard number inputs + sliders to their HTML default values
  document.querySelectorAll('input[type="number"][id^="inp-"]').forEach(inp => {
    inp.value = inp.defaultValue;
    const sl = document.getElementById(inp.id.replace('inp-', 'sl-'));
    if (sl) sl.value = inp.defaultValue;
  });

  // Reset toggle-mode checkbox
  const toggleMode = document.getElementById('toggle-mode');
  if (toggleMode) toggleMode.checked = true;

  // Reset Minijob checkboxes
  const chkMj = document.getElementById('chk-minijob');
  if (chkMj) chkMj.checked = false;
  const chkAuf = document.getElementById('chk-minijob-aufstockung');
  if (chkAuf) chkAuf.checked = false;
  const lblAuf = document.getElementById('lbl-aufstockung');
  if (lblAuf) lblAuf.style.display = 'none';

  // Remove Einmalzahlungen
  document.querySelectorAll('.einmal-block').forEach(b => b.remove());
  window._einmalCount = 0;
  const addBtn = document.getElementById('einmal-add-btn');
  if (addBtn) addBtn.style.display = '';

  // Restore mode badge state
  document.getElementById('grp-life')?.classList.toggle('dimmed', true);
  document.getElementById('grp-ent')?.classList.toggle('dimmed', false);
  document.getElementById('lbl-verzehr')?.classList.toggle('active', false);
  document.getElementById('lbl-erhalt')?.classList.toggle('active', true);

  const p = getParams();
  updateHintRpj0(p);
  updateHintRpj1(p);
  recalc();
};

// ── THEME ─────────────────────────────────────────────────────────────────────
window.toggleTheme = function() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('theme-toggle').textContent = isLight ? '☾ Dunkles Design' : '☀ Helles Design';
  try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch (e) {}
};

// ── VERIF CLOSE ───────────────────────────────────────────────────────────────
window.closeVerif = function() {
  document.getElementById('verif-panel')?.classList.remove('visible');
  const vi = document.getElementById('verif-intro');
  if (vi) { vi.classList.remove('visible'); vi.classList.add('visible'); }
  if (selectedRow) { selectedRow.classList.remove('selected-row'); selectedRow = null; }
};

// ── SCROLL SYNC ───────────────────────────────────────────────────────────────
function syncScrollWidth() {
  const tableWrap = document.getElementById('table-wrap-main');
  const topInner  = document.getElementById('scroll-top-inner');
  if (tableWrap && topInner) topInner.style.width = tableWrap.scrollWidth + 'px';
}

function wireScrollSync() {
  const topBar    = document.getElementById('scroll-top-bar');
  const tableWrap = document.getElementById('table-wrap-main');
  if (!topBar || !tableWrap) return;
  topBar.addEventListener('scroll',    () => { tableWrap.scrollLeft = topBar.scrollLeft; });
  tableWrap.addEventListener('scroll', () => { topBar.scrollLeft = tableWrap.scrollLeft; });
  new MutationObserver(syncScrollWidth).observe(
    document.getElementById('main-table'),
    { childList: true, subtree: true }
  );
}

// ── SCENARIO MODAL ────────────────────────────────────────────────────────────
function getCurrentBreakeven() {
  return document.getElementById('breakeven-value')?.textContent?.trim() ?? '–';
}

window.openScenarioModal = function() {
  renderScenarioList(loadScenario, deleteScenario);
  document.getElementById('scenario-overlay').classList.remove('hidden');
  setTimeout(() => {
    const inp = document.getElementById('scenario-name-input');
    if (activeScenarioName) inp.value = activeScenarioName;
    inp.focus(); inp.select();
  }, 100);
};

window.closeScenarioModal = function() {
  document.getElementById('scenario-overlay').classList.add('hidden');
};

window.saveScenario = function() {
  const nameInput = document.getElementById('scenario-name-input');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  const list = getScenarios();
  const existingIdx = list.findIndex(s => s.name === name);
  if (existingIdx >= 0) {
    pendingOverwriteName = name;
    pendingOverwriteIdx  = existingIdx;
    document.getElementById('scenario-confirm-text').innerHTML =
      `Szenario <strong>"${name}"</strong> bereits vorhanden.<br>Aktuellen Stand überschreiben?`;
    document.getElementById('scenario-confirm-overlay').classList.add('visible');
    return;
  }
  if (list.length >= MAX_SCENARIOS) {
    alert(`Maximal ${MAX_SCENARIOS} Szenarien möglich. Bitte zuerst eines löschen.`);
    return;
  }
  list.push({
    id: Date.now(), name,
    date: new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }),
    breakeven: getCurrentBreakeven(),
    values: captureValues(),
  });
  saveScenarios(list);
  activeScenarioName = name;
  nameInput.value = '';
  renderScenarioList(loadScenario, deleteScenario);
};

function loadScenario(idx) {
  const list = getScenarios();
  const s = list[idx];
  if (!s) return;
  activeScenarioName = s.name;
  applyValues(s.values, window.addEinmal, recalc, () => {
    const params = getParams();
    updateHints(params);
    // RPJ-Hints zeigen, aber Werte NICHT überschreiben (updateHintRpj0/1 würde
    // die gespeicherten Werte durch Netto-Berechnung ersetzen – unerwünscht).
    // Hints werden beim nächsten Ändern von Netto/Extra automatisch aktualisiert.
  });
  window.closeScenarioModal();
}

function deleteScenario(idx) {
  const list = getScenarios();
  list.splice(idx, 1);
  saveScenarios(list);
  renderScenarioList(loadScenario, deleteScenario);
}

window.hideConfirm = function() {
  document.getElementById('scenario-confirm-overlay').classList.remove('visible');
  pendingOverwriteName = null;
  pendingOverwriteIdx  = -1;
};

window.confirmOverwrite = function() {
  if (pendingOverwriteIdx < 0 || !pendingOverwriteName) return;
  const list = getScenarios();
  list[pendingOverwriteIdx] = {
    id:        list[pendingOverwriteIdx]?.id ?? Date.now(),
    name:      pendingOverwriteName,
    date:      new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }),
    breakeven: getCurrentBreakeven(),
    values:    captureValues(),
  };
  saveScenarios(list);
  activeScenarioName = pendingOverwriteName;
  document.getElementById('scenario-name-input').value = '';
  window.hideConfirm();
  renderScenarioList(loadScenario, deleteScenario);
};

// ── ONBOARDING MODAL ──────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    title: 'Willkommen zur Rentenplanung',
    body: `
      <p>Dieses Tool hilft dir zu verstehen, <strong>wann du in Rente gehen kannst</strong> und wie viel ETF-Kapital du dafür brauchst.</p>
      <p>Die Planung ist in drei Phasen aufgeteilt:</p>
      <p>
        <span class="modal-pill p0">Phase 0</span> <strong>Ansparphase</strong> – du arbeitest und sparst in ETFs.<br>
        <span class="modal-pill p1">Phase 1</span> <strong>Übergangsphase</strong> – du hörst auf zu arbeiten, lebst von ETF-Entnahmen bis zur GRV mit 67.<br>
        <span class="modal-pill p2">Phase 2</span> <strong>Vollrente</strong> – ab 67 kommt die gesetzliche Rente dazu.
      </p>
      <div class="modal-highlight">Der <strong>Breakeven</strong> oben im Header zeigt dir: ab welchem Alter reicht dein ETF-Kapital, um bis ins Lebensende durchzuhalten.</div>
    `
  },
  {
    title: 'Ausgangsbasis eintragen',
    body: `
      <p>Im Bereich <strong>Ausgangsbasis</strong> trägst du ein, wo du heute stehst:</p>
      <p><strong>Aktuelles Alter</strong> – dein heutiges Alter.</p>
      <p><strong>Erworbene Rentenpunkte</strong> – findest du auf deiner jährlichen Renteninformation der DRV.</p>
      <p><strong>Nettogehalt</strong> – dein monatliches Netto. Daraus wird der jährliche Rentenpunkte-Zuwachs vorgeschlagen.</p>
      <div class="modal-highlight">Die <strong>Abgabenquote</strong> kannst du vom Gehaltszettel ablesen: <em>(Brutto − Netto) ÷ Brutto</em>. Typisch für Steuerklasse I: 37–40 %.</div>
    `
  },
  {
    title: 'Phasen konfigurieren',
    body: `
      <p>In <strong>Phase 0</strong> gibst du an, wie viel du monatlich in ETFs sparst und wie viele Rentenpunkte du pro Jahr sammelst.</p>
      <p>In <strong>Phase 1</strong> legst du fest, wie viel du monatlich brauchst und ob du noch Nebeneinkommen hast.</p>
      <p>In <strong>Phase 2</strong> gibst du deinen Bedarf ab 67 an sowie etwaige Zusatzrenten (bAV, Riester etc.).</p>
      <div class="modal-highlight">Mit <strong>Einmalzahlungen</strong> (z.B. Erbschaft, Boni) kannst du gezielt Kapital zu einem bestimmten Alter einplanen.</div>
    `
  },
  {
    title: 'Die Ergebnisse lesen',
    body: `
      <p>Jede Zeile/Karte zeigt ein <strong>Übergangsszenario</strong> – Sofort, mit 40, 45, 50 usw.</p>
      <p><strong>Real</strong> = inflationsbereinigt in heutigen Euro – für Vergleiche die aussagekräftigere Zahl.</p>
      <p>Die <strong>Ampelfarben</strong> zeigen ob dein ETF-Kapital bei 67 ausreicht:<br>
        🟢 Grün = Ziel erreicht &nbsp;·&nbsp; 🟡 Gelb = knapp &nbsp;·&nbsp; 🔴 Rot = Lücke
      </p>
      <div class="modal-highlight">Auf dem Smartphone siehst du Karten statt Tabelle. Tippe auf eine Karte für die Rechenschritte.</div>
    `
  }
];
let currentStep = 0;

function renderModalStep() {
  const step = ONBOARDING_STEPS[currentStep];
  document.getElementById('modal-step-label').textContent = `Schritt ${currentStep + 1} von ${ONBOARDING_STEPS.length}`;
  document.getElementById('modal-title').textContent  = step.title;
  document.getElementById('modal-body').innerHTML     = step.body;
  const prog = document.getElementById('modal-progress');
  prog.innerHTML = ONBOARDING_STEPS.map((_, i) =>
    `<div class="modal-dot ${i === currentStep ? 'active' : ''}"></div>`
  ).join('');
  document.getElementById('modal-next').textContent =
    currentStep === ONBOARDING_STEPS.length - 1 ? "Los geht's ✓" : "Weiter →";
}

window.nextStep = function() {
  if (currentStep < ONBOARDING_STEPS.length - 1) {
    currentStep++;
    renderModalStep();
  } else {
    window.closeModal();
  }
};

window.openModal = function() {
  currentStep = 0;
  renderModalStep();
  document.getElementById('modal-overlay').classList.remove('hidden');
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.add('hidden');
  try { localStorage.setItem('onboarding_done', '1'); } catch (e) {}
};

// ── MOBILE ACCORDION (inputs) ─────────────────────────────────────────────────
function wireMobileAccordion() {
  document.querySelectorAll('.inputs-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.inputs-section');
      section.classList.toggle('collapsed');
    });
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  // Restore theme
  try {
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light');
      document.getElementById('theme-toggle').textContent = '☾ Dunkles Design';
    }
  } catch (e) {}

  wireInputs();
  wireTabNav();
  wireScrollSync();
  wireMobileAccordion();

  // Initial mode badge state
  const ohne = document.getElementById('toggle-mode')?.checked;
  document.getElementById('grp-life')?.classList.toggle('dimmed', ohne ?? true);
  document.getElementById('grp-ent')?.classList.toggle('dimmed', !(ohne ?? true));
  document.getElementById('lbl-verzehr')?.classList.toggle('active', !(ohne ?? true));
  document.getElementById('lbl-erhalt')?.classList.toggle('active',  ohne ?? true);

  // Scenario modal key handler
  document.getElementById('scenario-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window.saveScenario();
  });

  // Overlay click-outside to close
  document.getElementById('scenario-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('scenario-overlay')) window.closeScenarioModal();
  });

  // Initial tab state: start on results tab on mobile
  if (window.innerWidth < 768) {
    switchTab('tab-results');
  }

  // Restore auto-saved state (if present)
  let restoredFromAutosave = false;
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      const v = JSON.parse(saved);
      applyValues(v, window.addEinmal, recalc, () => {
        const p = getParams();
        updateHintRpj0(p);
        updateHintRpj1(p);
      });
      restoredFromAutosave = true;
    }
  } catch (e) {}

  if (!restoredFromAutosave) {
    // Initialize RPJ hints once from default input values
    const initParams = getParams();
    updateHintRpj0(initParams);
    updateHintRpj1(initParams);
    // First run
    recalc();
  }

  // Show onboarding
  try {
    if (!localStorage.getItem('onboarding_done')) window.openModal();
  } catch (e) { window.openModal(); }
}

document.addEventListener('DOMContentLoaded', init);
