/**
 * scenarios.js – Scenario save/load via localStorage
 */

const SCENARIO_KEY  = 'rente_szenarien';
const MAX_SCENARIOS = 5;

export function getScenarios() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCENARIO_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter(s => s && typeof s === 'object' && s.name && s.values);
  } catch (e) { return []; }
}

export function saveScenarios(list) {
  try { localStorage.setItem(SCENARIO_KEY, JSON.stringify(list)); } catch (e) {}
}

/** Capture current input values for saving */
export function captureValues() {
  const g = id => parseFloat(document.getElementById(id)?.value) || 0;
  const einmal = [];
  document.querySelectorAll('.einmal-block').forEach(block => {
    const m = block.id.match(/einmal-block-(\d+)/);
    if (!m) return;
    const id = m[1];
    const b = parseFloat(document.getElementById(`inp-einmal-betrag-${id}`)?.value) || 0;
    const a = parseFloat(document.getElementById(`inp-einmal-alter-${id}`)?.value)  || 0;
    if (b > 0) einmal.push({ betrag: b, alter: a });
  });
  return {
    age:    g('inp-age'),    rp:      g('inp-rp'),
    netto:  g('inp-netto'),  abgaben: g('inp-abgaben'),
    etf:    g('inp-etf'),    spar:    g('inp-spar'),
    rpj0:   g('inp-rpj0'),   need:    g('inp-need'),
    extra:  g('inp-extra'),  rpj1:    g('inp-rpj1'),
    need2:  g('inp-need2'),  zusatz:  g('inp-zusatz'),
    life:   g('inp-life'),   ent:     g('inp-ent'),
    retBrutto: g('inp-ret-brutto') || 7.0,
    tax:    g('inp-tax')    || 18.5,
    inf:    g('inp-inf')    || 2.0,
    ohne:   document.getElementById('toggle-mode')?.checked ?? true,
    einmal,
  };
}

/** Apply saved values to inputs */
export function applyValues(v, addEinmalFn, recalcFn, updateHintsFn) {
  const setField = (id, val) => {
    const inp = document.getElementById(id);
    const sl  = document.getElementById(id.replace('inp-', 'sl-'));
    if (inp) inp.value = val;
    if (sl)  sl.value  = val;
  };
  setField('inp-age',      v.age);
  setField('inp-rp',       v.rp);
  setField('inp-netto',    v.netto);
  setField('inp-abgaben',  v.abgaben);
  setField('inp-etf',      v.etf);
  setField('inp-spar',     v.spar);
  setField('inp-rpj0',     v.rpj0);
  setField('inp-need',     v.need);
  setField('inp-extra',    v.extra);
  setField('inp-rpj1',     v.rpj1);
  setField('inp-need2',    v.need2);
  setField('inp-zusatz',   v.zusatz);
  setField('inp-life',     v.life);
  setField('inp-ent',      v.ent);
  setField('inp-ret-brutto', v.retBrutto || 7.0);
  setField('inp-tax',        v.tax       || 18.5);
  setField('inp-inf',      v.inf);

  const toggle = document.getElementById('toggle-mode');
  if (toggle) toggle.checked = v.ohne ?? true;

  // Restore Einmalzahlungen
  document.querySelectorAll('.einmal-block').forEach(b => b.remove());
  window._einmalCount = 0;
  const addBtn = document.getElementById('einmal-add-btn');
  if (addBtn) addBtn.style.display = '';

  if (v.einmal?.length) {
    v.einmal.forEach(e => {
      addEinmalFn();
      const id = window._einmalCount;
      const bi  = document.getElementById(`inp-einmal-betrag-${id}`);
      const bs  = document.getElementById(`sl-einmal-betrag-${id}`);
      const ai  = document.getElementById(`inp-einmal-alter-${id}`);
      const as_ = document.getElementById(`sl-einmal-alter-${id}`);
      if (bi)  bi.value  = e.betrag;
      if (bs)  bs.value  = e.betrag;
      if (ai)  ai.value  = e.alter;
      if (as_) as_.value = e.alter;
    });
  }
  updateHintsFn();
  recalcFn();
}

/** Render scenario list in modal */
export function renderScenarioList(onLoad, onDelete) {
  const list  = getScenarios();
  const el    = document.getElementById('scenario-list');
  if (!el) return;

  const valid = list.filter(s => s?.name && s?.values);
  if (valid.length === 0) {
    el.innerHTML = '<div class="scenario-empty">Noch keine Szenarien gespeichert</div>';
    return;
  }
  el.innerHTML = valid.map((s, i) => `
    <div class="scenario-item" data-idx="${i}">
      <div class="scenario-item-info">
        <div class="scenario-item-name">${s.name || '–'}</div>
        <div class="scenario-item-meta">Gespeichert: ${s.date || '–'}</div>
      </div>
      <div class="scenario-item-breakeven">⚡ ${s.breakeven || '–'}</div>
      <button class="scenario-delete" data-idx="${i}" title="Löschen">🗑</button>
    </div>
  `).join('');

  el.querySelectorAll('.scenario-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('scenario-delete')) return;
      onLoad(parseInt(item.dataset.idx));
    });
  });
  el.querySelectorAll('.scenario-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(parseInt(btn.dataset.idx));
    });
  });
}

export { MAX_SCENARIOS };
