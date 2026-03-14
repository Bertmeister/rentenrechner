/**
 * render.js – DOM rendering functions
 */

import { GRV_AGE, GRV_NET_PCT, MINIJOB_AG_ANTEIL, RV_BEITRAGSSATZ } from './calc.js';

export function fmt(n, dec = 0) {
  if (isNaN(n) || !isFinite(n)) return '–';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}

export function fmtV(n, dec = 0) {
  return fmt(n, dec);
}

function fmtGap(g) {
  return `${g >= 0 ? '+' : '−'}${fmt(Math.abs(g))} €`;
}

export function getTag(pct) {
  if (pct >= 90) return ['tag-good',   'Erreichbar ✓'];
  if (pct >= 60) return ['tag-good',   'Realistisch'];
  if (pct >= 35) return ['tag-medium', 'Möglich'];
  if (pct >= 20) return ['tag-hard',   'Ambitioniert'];
  return               ['tag-hard',   'Sehr ambitioniert'];
}

export function col(pct) {
  if (pct >= 70) return 'var(--green)';
  if (pct >= 35) return 'var(--yellow)';
  return 'var(--red)';
}

function gapCol(gap, pct) {
  return gap >= 0 ? 'var(--green)' : (pct >= 35 ? 'var(--yellow)' : 'var(--red)');
}

/** Update breakeven display in header */
export function updateBreakeven(breakevenAge, age) {
  const bvEl = document.getElementById('breakeven-value');
  const bsEl = document.getElementById('breakeven-sub');
  if (!bvEl || !bsEl) return;

  if (breakevenAge === null) {
    bvEl.textContent = 'Nicht erreichbar';
    bvEl.className = 'breakeven-value never';
    bsEl.textContent = 'Auch ab 67 reicht das ETF nicht für Phase 2';
  } else if (breakevenAge === age) {
    bvEl.textContent = 'Bereits jetzt möglich';
    bvEl.className = 'breakeven-value now';
    bsEl.textContent = 'ETF-Restwert bei 67 deckt die Rentenlücke schon heute';
  } else {
    bvEl.textContent = `Alter ${breakevenAge}`;
    bvEl.className = 'breakeven-value now';
    const yearsAway = breakevenAge - age;
    bsEl.textContent = `In ${yearsAway} Jahr${yearsAway === 1 ? '' : 'en'} erreichbar`;
  }
}

/**
 * Update RPJ0 hint and auto-fill suggestion.
 * Call ONLY when Nettogehalt (inp-netto) or Abgabenquote (inp-abgaben) changes.
 */
export function updateHintRpj0(params) {
  const { netto, abgaben, durchschnittsentgelt } = params;
  const hintBrutto = document.getElementById('hint-brutto');
  const hintRpj0   = document.getElementById('hint-rpj0');
  const rpj0El     = document.getElementById('inp-rpj0');
  const slRpj0     = document.getElementById('sl-rpj0');

  if (netto > 0 && abgaben > 0) {
    const brutto       = netto / (1 - abgaben / 100);
    const jahresbrutto = Math.round(brutto * 12);
    const vorschlag    = Math.round((jahresbrutto / durchschnittsentgelt) * 100) / 100;
    const capped       = Math.min(vorschlag, 2);
    if (rpj0El) rpj0El.value = capped;
    if (slRpj0) slRpj0.value = capped;
    if (hintRpj0) {
      hintRpj0.style.display = 'block';
      hintRpj0.innerHTML =
        `Brutto ~${fmt(Math.round(brutto))} €/Mo (${abgaben}% Abgaben)<br>` +
        `<span style="color:var(--teal)">${fmt(Math.round(brutto))} × 12 ÷ ${fmt(durchschnittsentgelt)} ` +
        `= <strong>${capped} Pkt/Jahr</strong></span>`;
    }
    if (hintBrutto) {
      hintBrutto.style.display = 'block';
      hintBrutto.textContent = `→ Brutto ~${fmt(Math.round(brutto))} €/Mo bei ${abgaben}% Abgaben`;
      hintBrutto.style.color = 'var(--text-dim)';
    }
  } else {
    if (rpj0El) { rpj0El.value = 0; }
    if (slRpj0) { slRpj0.value = 0; }
    if (hintRpj0)   hintRpj0.style.display   = 'none';
    if (hintBrutto) hintBrutto.style.display = 'none';
  }
}

/**
 * Update RPJ1 hint and auto-fill suggestion.
 * Call ONLY when Nebeneinkommen (inp-extra) or Abgabenquote (inp-abgaben) changes.
 */
export function updateHintRpj1(params) {
  const { extra, abgaben, durchschnittsentgelt, isMinijob, minijobAufstockung } = params;
  const hintRpj1 = document.getElementById('hint-rpj1');
  const rpj1El   = document.getElementById('inp-rpj1');
  const slRpj1   = document.getElementById('sl-rpj1');

  if (extra > 0) {
    let vorschlag, hintHTML;
    if (isMinijob) {
      if (minijobAufstockung) {
        // Voller Beitragssatz durch Aufstockung: RPJ = Jahreslohn / DE
        vorschlag = Math.round((extra * 12 / durchschnittsentgelt) * 100) / 100;
        const capped = Math.min(vorschlag, 1);
        hintHTML =
          `Minijob mit Aufstockung (voller RV-Beitrag):<br>` +
          `<span style="color:var(--teal)">${fmt(extra)} × 12 ÷ ${fmt(durchschnittsentgelt)} ` +
          `= <strong>${capped} Pkt/Jahr</strong></span>`;
        vorschlag = capped;
      } else {
        // Nur AG-Pauschale 15 % statt 18,6 %: RPJ = (Lohn × 12 × 0.15/0.186) / DE
        const faktor = MINIJOB_AG_ANTEIL / RV_BEITRAGSSATZ;
        vorschlag = Math.round((extra * 12 * faktor / durchschnittsentgelt) * 100) / 100;
        const capped = Math.min(vorschlag, 1);
        const pctStr = `${(MINIJOB_AG_ANTEIL * 100).toFixed(0)}% ÷ ${(RV_BEITRAGSSATZ * 100).toFixed(1)}%`;
        hintHTML =
          `Minijob ohne Aufstockung (AG-Pauschale ${(MINIJOB_AG_ANTEIL * 100).toFixed(0)}%):<br>` +
          `<span style="color:var(--teal)">${fmt(extra)} × 12 × (${pctStr}) ÷ ${fmt(durchschnittsentgelt)} ` +
          `= <strong>${capped} Pkt/Jahr</strong></span>`;
        vorschlag = capped;
      }
    } else if (abgaben > 0) {
      const brutto   = extra / (1 - abgaben / 100);
      vorschlag = Math.round((brutto * 12 / durchschnittsentgelt) * 100) / 100;
      const capped = Math.min(vorschlag, 1);
      hintHTML =
        `Brutto ~${fmt(Math.round(brutto))} €/Mo (${abgaben}% Abgaben)<br>` +
        `<span style="color:var(--teal)">${fmt(Math.round(brutto))} × 12 ÷ ${fmt(durchschnittsentgelt)} ` +
        `= <strong>${capped} Pkt/Jahr</strong></span>`;
      vorschlag = capped;
    } else {
      vorschlag = 0;
      hintHTML = '';
    }
    if (rpj1El) rpj1El.value = vorschlag;
    if (slRpj1) slRpj1.value = vorschlag;
    if (hintRpj1 && hintHTML) {
      hintRpj1.style.display = 'block';
      hintRpj1.innerHTML = hintHTML;
    } else if (hintRpj1) {
      hintRpj1.style.display = 'none';
    }
  } else {
    if (rpj1El) { rpj1El.value = 0; }
    if (slRpj1) { slRpj1.value = 0; }
    if (hintRpj1) hintRpj1.style.display = 'none';
  }
}

/** Update all other hints (verbleib, ETF-Entnahme, Realrendite). NOT RPJ. */
export function updateHints(params) {
  const { netto, spar, extra, need, retBrutto, tax, inf } = params;

  // Verbleib nach Sparrate
  const hintVerbleib = document.getElementById('hint-verbleib');
  if (hintVerbleib) {
    if (netto > 0) {
      const verbleib = netto - spar;
      hintVerbleib.style.display = 'block';
      hintVerbleib.textContent = `→ ${fmt(verbleib)} € verbleiben nach Sparrate`;
      hintVerbleib.style.color = verbleib >= 0 ? 'var(--teal)' : 'var(--red)';
    } else {
      hintVerbleib.style.display = 'none';
    }
  }

  // ETF Entnahme hint
  const hintEntnahme = document.getElementById('hint-etf-entnahme');
  if (hintEntnahme) {
    const luecke = need - extra;
    if (luecke > 0 && need > 0) {
      hintEntnahme.style.display = 'block';
      hintEntnahme.textContent = `→ ${fmt(luecke)} € /Mo müssen aus dem ETF entnommen werden`;
      hintEntnahme.style.color = 'var(--teal)';
    } else if (luecke <= 0 && extra > 0) {
      hintEntnahme.style.display = 'block';
      hintEntnahme.textContent = `→ Bedarf vollständig durch Nebeneinkommen gedeckt`;
      hintEntnahme.style.color = 'var(--teal)';
    } else {
      hintEntnahme.style.display = 'none';
    }
  }

  // Net return hint
  const netRet  = retBrutto * (1 - tax / 100);
  const realRet = ((1 + netRet / 100) / (1 + inf) - 1) * 100;
  const hintReal = document.getElementById('hint-realrendite');
  if (hintReal) {
    hintReal.style.display = 'block';
    hintReal.innerHTML =
      `${retBrutto.toFixed(1)}% × (1 − ${tax.toFixed(1)}%) = ` +
      `<span style="color:var(--blue);font-family:'DM Mono',monospace">${netRet.toFixed(2)}% netto</span><br>` +
      `nach Inflation: <span style="color:var(--blue);font-family:'DM Mono',monospace">→ ${realRet.toFixed(2)}% real</span>`;
  }
}

/** Render desktop table */
export function renderTable(scenarios, breakevenAge, onRowClick) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  scenarios.forEach(s => {
    const { retireAge, age, yearsToRetire, yearsTo67 } = s;
    const isSofort    = retireAge === age;
    const isBreakeven = breakevenAge !== null && retireAge === breakevenAge && !isSofort;
    const pctPrimary  = s.p2pctReal;
    const [tagClass, tagText] = getTag(pctPrimary);
    const retireSub = isSofort
      ? `Sofort · ${yearsTo67} J. bis GRV`
      : `in ${yearsToRetire} J. · ${yearsTo67} J. bis GRV`;

    const tr = document.createElement('tr');
    if (isSofort)    tr.classList.add('sofort-row');
    if (isBreakeven) tr.classList.add('breakeven-row');
    tr.innerHTML = `
      <td>
        <div class="rente-age">${isSofort ? age : retireAge}</div>
        <div class="rente-sub">${retireSub}</div>
        ${isSofort
          ? '<span class="sofort-badge">Sofort</span>'
          : isBreakeven
            ? '<span class="sofort-badge" style="background:rgba(78,203,141,0.15);color:var(--green)">Breakeven</span>'
            : `<span class="tag ${tagClass}">${tagText}</span>`}
      </td>
      <td class="c-kap"><div class="val-main" style="color:var(--purple)">${fmt(s.rpAtRetire,1)} Pkt</div><div class="val-sub">bei Übergangsphase</div></td>
      <td class="c-kap"><div class="val-main" style="color:var(--purple)">${fmt(s.rpAt67,1)} Pkt</div><div class="val-sub">bei 67 (inkl. P1)</div></td>
      <td class="phase-sep-td p1"></td>
      <td class="c-kauf"><div class="val-main">${fmt(s.kaufNomRetire)} €</div><div class="val-sub">/Mo</div></td>
      <td class="c-kauf"><div class="val-main">${fmt(s.need)} €</div><div class="val-sub">/Mo · konstant</div></td>
      <td class="c-extra"><div class="val-main" style="color:var(--teal)">${fmt(s.extraNomRetire)} €</div><div class="val-sub">/Mo nominal</div></td>
      <td class="c-extra"><div class="val-main" style="color:var(--teal)">${fmt(s.extra)} €</div><div class="val-sub">/Mo real</div></td>
      <td class="c-lueck"><div class="val-main" style="color:${s.lueckeNomRetire<0?'var(--green)':'var(--yellow)'}">${s.lueckeNomRetire<0?'+ '+fmt(-s.lueckeNomRetire):fmt(s.lueckeNomRetire)} €</div><div class="val-sub">/Mo · ${s.lueckeNomRetire<0?'ins ETF':'aus ETF'}</div></td>
      <td class="c-lueck"><div class="val-main" style="color:${s.lueckeReal<0?'var(--green)':'var(--yellow)'}">${s.lueckeReal<0?'+ '+fmt(-s.lueckeReal):fmt(s.lueckeReal)} €</div><div class="val-sub">/Mo real</div></td>
      <td class="c-etf"><div class="val-main" style="color:${col(s.p1pctNom)}">${fmt(s.etfRetireNom)} €</div><div class="bar-wrap"><div class="bar-fill" style="width:${s.p1pctNom.toFixed(1)}%;background:${col(s.p1pctNom)}"></div></div><div class="val-sub">${fmt(s.p1pctNom,0)}% Ziel</div></td>
      <td class="c-etf"><div class="val-main" style="color:${col(s.p1pctReal)}">${fmt(s.etfRetireReal)} €</div><div class="bar-wrap"><div class="bar-fill" style="width:${s.p1pctReal.toFixed(1)}%;background:${col(s.p1pctReal)}"></div></div><div class="val-sub">${fmt(s.p1pctReal,0)}% Ziel</div></td>
      <td class="phase-sep-td p2"></td>
      <td class="c-kauf"><div class="val-main">${fmt(s.kaufNom67)} €</div><div class="val-sub">/Mo ab 67</div></td>
      <td class="c-kauf"><div class="val-main">${fmt(s.need2)} €</div><div class="val-sub">/Mo · konstant</div></td>
      <td class="c-grv"><div class="val-main" style="color:var(--purple)">${fmt(s.grvNettoNom)} €</div><div class="val-sub">/Mo · ${s.zusatz>0?`+${fmt(s.zusatz)} € Zusatz`:''}</div></td>
      <td class="c-grv"><div class="val-main" style="color:var(--purple)">${fmt(s.grvNettoReal)} €</div><div class="val-sub">/Mo real · deckt ${fmt(s.need2>0?Math.min(100,(s.grvNettoReal/s.need2)*100):0,0)}%</div></td>
      <td class="c-rluck"><div class="val-main" style="color:var(--yellow)">${fmt(s.rentenlueckeNomMonth)} €</div><div class="val-sub">/Mo ab 67</div></td>
      <td class="c-rluck"><div class="val-main" style="color:var(--yellow)">${fmt(s.rentenlueckeRealMonth)} €</div><div class="val-sub">/Mo real</div></td>
      <td class="c-kap"><div class="val-main" style="color:var(--blue)">${fmt(s.cap2_at67_nom)} €</div><div class="val-sub">bei 67 benötigt</div></td>
      <td class="c-kap"><div class="val-main" style="color:var(--blue)">${fmt(s.cap2_at67_real)} €</div><div class="val-sub">in heutigen €</div></td>
      <td class="c-etf"><div class="val-main" style="color:${col(s.p2pctNom)}">${fmt(Math.max(0,s.etfRes67Nom))} €</div><div class="bar-wrap"><div class="bar-fill" style="width:${s.p2pctNom.toFixed(1)}%;background:${col(s.p2pctNom)}"></div></div><div class="val-sub">${fmt(s.p2pctNom,0)}% Ziel</div></td>
      <td class="c-etf"><div class="val-main" style="color:${col(s.p2pctReal)}">${fmt(Math.max(0,s.etfRes67Real))} €</div><div class="bar-wrap"><div class="bar-fill" style="width:${s.p2pctReal.toFixed(1)}%;background:${col(s.p2pctReal)}"></div></div><div class="val-sub">${fmt(s.p2pctReal,0)}% Ziel</div></td>
      <td class="right"><div class="val-main" style="color:${gapCol(s.p2gapNom,s.p2pctNom)}">${fmtGap(s.p2gapNom)}</div><div class="val-sub">${fmt(s.p2pctNom,0)}% nom.</div></td>
      <td class="right"><div class="val-main" style="color:${gapCol(s.p2gapReal,s.p2pctReal)}">${fmtGap(s.p2gapReal)}</div><div class="val-sub">${fmt(s.p2pctReal,0)}% real</div></td>
    `;
    tr.addEventListener('click', () => onRowClick(s, tr));
    tbody.appendChild(tr);
  });
}

/** Render mobile cards */
export function renderCards(scenarios, breakevenAge, onCardClick) {
  const container = document.getElementById('mobile-cards');
  if (!container) return;
  container.innerHTML = '';

  scenarios.forEach(s => {
    const { retireAge, age, yearsToRetire, yearsTo67 } = s;
    const isSofort    = retireAge === age;
    const isBreakeven = breakevenAge !== null && retireAge === breakevenAge && !isSofort;
    const [tagClass, tagText] = getTag(s.p2pctReal);

    const card = document.createElement('div');
    card.className = 'scenario-card';
    if (isSofort)    card.classList.add('card-sofort');
    if (isBreakeven) card.classList.add('card-breakeven');

    const badgeHtml = isSofort
      ? '<span class="sofort-badge">Sofort</span>'
      : isBreakeven
        ? '<span class="sofort-badge" style="background:rgba(78,203,141,0.15);color:var(--green)">Breakeven ⚡</span>'
        : `<span class="tag ${tagClass}">${tagText}</span>`;

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-age">${isSofort ? age : retireAge}</div>
          <div class="card-sub">${isSofort ? 'Sofort' : `in ${yearsToRetire} Jahr${yearsToRetire===1?'':'en'}`} · ${yearsTo67} J. bis GRV</div>
        </div>
        <div class="card-badge">${badgeHtml}</div>
      </div>

      <div class="card-metrics">
        <div class="card-metric">
          <div class="card-metric-label">ETF bei Übergangsphase</div>
          <div class="card-metric-value" style="color:${col(s.p1pctReal)}">${fmt(s.etfRetireReal)} €</div>
          <div class="bar-wrap" style="margin-top:0.35rem">
            <div class="bar-fill" style="width:${s.p1pctReal.toFixed(1)}%;background:${col(s.p1pctReal)}"></div>
          </div>
          <div class="card-metric-sub">${fmt(s.p1pctReal,0)}% des Ziels (${fmt(s.cap1_atRetire_real)} € benötigt)</div>
        </div>

        <div class="card-metric">
          <div class="card-metric-label">ETF-Restwert bei 67</div>
          <div class="card-metric-value" style="color:${col(s.p2pctReal)}">${fmt(Math.max(0,s.etfRes67Real))} €</div>
          <div class="bar-wrap" style="margin-top:0.35rem">
            <div class="bar-fill" style="width:${s.p2pctReal.toFixed(1)}%;background:${col(s.p2pctReal)}"></div>
          </div>
          <div class="card-metric-sub">${fmt(s.p2pctReal,0)}% des Ziels (${fmt(s.cap2_at67_real)} € benötigt)</div>
        </div>

        <div class="card-gap-row">
          <div class="card-gap-item">
            <span class="card-gap-label">Lücke/Überschuss (real)</span>
            <span class="card-gap-value" style="color:${gapCol(s.p2gapReal,s.p2pctReal)}">${fmtGap(s.p2gapReal)}</span>
          </div>
          <div class="card-gap-item">
            <span class="card-gap-label">Rente ab 67</span>
            <span class="card-gap-value" style="color:var(--purple)">${fmt(s.grvNettoReal)} €/Mo</span>
          </div>
        </div>
      </div>

      <button class="card-detail-btn">Rechenschritte ansehen →</button>
    `;

    card.querySelector('.card-detail-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onCardClick(s);
    });
    card.addEventListener('click', () => onCardClick(s));
    container.appendChild(card);
  });
}

/** Render verification panel */
export function renderVerif(data) {
  document.getElementById('verif-age').textContent = data.retireAge;
  document.getElementById('verif-intro')?.classList.remove('visible');
  document.getElementById('verif-panel')?.classList.add('visible');

  const {
    age, retireAge, yearsToRetire, yearsTo67,
    ret, inf, spar, etf0: etf0raw,
    need, extra, need2, zusatz, ent, ohne,
    rpAtRetire, rpAt67, rpWert67, rpj1,
    grvBruttoNom, grvNettoNom, grvNettoReal,
    kaufNomRetire, kaufNom67,
    lueckeNomRetire, lueckeReal,
    rentenlueckeNomMonth, rentenlueckeRealMonth,
    etfRetireNom, etfRes67Nom, etfRes67Real,
    cap2_at67_nom, cap2_at67_real,
    inflToRetire, inflTo67, retReal, yearsP2,
  } = data;

  const etf0 = etf0raw ?? 0;

  const blocks = [
    // ── Phase 0 (gold) ────────────────────────────────────────────────────────
    {
      title: 'Phase 0 · ETF bei Übergangsphase',
      color: 'var(--accent)',
      steps: [
        [`ETF heute`, `${fmtV(etf0)} €`],
        [`Wachstum (1 + ${fmtV(ret*100,1)}%)^${yearsToRetire} J.`, `× ${fmtV(Math.pow(1+ret,yearsToRetire),3)}`],
        [`Sparrate ${fmtV(spar)} €/Mo`, `+ ca. ${fmtV(ret>0 ? spar*12*(Math.pow(1+ret,yearsToRetire)-1)/ret : spar*12*yearsToRetire)} €`],
        [`= ETF bei Übergangsphase (nominal)`, `${fmtV(etfRetireNom)} €`, true],
      ],
      hint: 'Einmalzahlungen werden zusätzlich aufaddiert'
    },
    {
      title: 'Phase 0 · GRV-Punkte',
      color: 'var(--accent)',
      steps: [
        [`Punkte heute + Phase 0`, `${fmtV(rpAtRetire,1)} Pkt bei Übergangsphase`, true],
        [`+ ${yearsTo67} J. Phase 1`, `+ ${fmtV(yearsTo67*(rpj1??0),1)} Pkt`],
        [`= Punkte bei 67`, `${fmtV(rpAt67,1)} Pkt`, true],
      ],
      hint: 'Rentenpunktwert 2025: 40,79 € × 1,5% Wachstum p.a.'
    },
    // ── Phase 1 (teal/grün) ───────────────────────────────────────────────────
    {
      title: 'Phase 1 · Monatliche Lücke',
      color: 'var(--teal)',
      steps: [
        [`Monatsbedarf Phase 1 (real, heute €)`, `${fmtV(need)} €/Mo`],
        [`Kaufkraft bei Übergangsphase (nominal)`, `${fmtV(kaufNomRetire)} €/Mo`],
        [`− Nebeneinkommen (nominal)`, `− ${fmtV(extra * Math.pow(1+inf, yearsToRetire))} €/Mo`],
        lueckeNomRetire > 0
          ? [`= Lücke → monatlich aus ETF entnehmen`, `${fmtV(lueckeNomRetire)} €/Mo`, true]
          : [`= Überschuss → monatlich ins ETF`, `${fmtV(-lueckeNomRetire)} €/Mo`, true],
      ],
      hint: `Real (heutige €): ${fmtV(Math.abs(lueckeReal))} €/Mo · Entnahmen wachsen mit Inflation`
    },
    // ── Phase 2 (lila) ────────────────────────────────────────────────────────
    {
      title: 'Phase 2 · Benötigtes Kapital bei 67',
      color: 'var(--purple)',
      steps: [
        [`Monatsbedarf ab 67 (real)`, `${fmtV(need2)} €/Mo`],
        [`− GRV netto real (heutige €)`, `− ${fmtV(grvNettoReal)} €/Mo`],
        [`= Rentenlücke real`, `${fmtV(rentenlueckeRealMonth)} €/Mo · ${fmtV(rentenlueckeRealMonth*12)} €/J.`, true],
        ohne
          ? [`÷ Entnahmerate ${fmtV(ent*100,1)}%`, `= ${fmtV(rentenlueckeRealMonth*12/ent)} €`]
          : [`Barwert über ${yearsP2} J. (reale Nettorendite)`, `= ${fmtV(cap2_at67_real)} €`],
        [`= Benötigtes Kapital (real, heute €)`, `${fmtV(cap2_at67_real)} €`, true],
        [`= Benötigtes Kapital (nominal bei 67)`, `${fmtV(cap2_at67_nom)} €`],
      ]
    },
    {
      title: 'Phase 2 · GRV netto bei 67',
      color: 'var(--purple)',
      steps: [
        [`${fmtV(rpAt67,1)} Pkt × ${fmtV(rpWert67,2)} €/Pkt (Rentenwert bei 67)`, `= ${fmtV(grvBruttoNom)} € brutto`],
        [`× 89,5% (nach KV + PV-Beitrag)`, `= ${fmtV(grvBruttoNom*GRV_NET_PCT)} €`],
        ...(zusatz > 0 ? [[`+ Zusatzrente (nominal)`, `+ ${fmtV(zusatz)} €`]] : []),
        [`= Rente gesamt netto/Mo (nominal)`, `${fmtV(grvNettoNom)} €`, true],
        [`Real (heute €, inflationsbereinigt)`, `${fmtV(grvNettoReal)} €/Mo`],
      ],
      hint: `Deckt ${fmtV(need2>0?Math.min(100,(grvNettoReal/need2)*100):0,0)}% des Bedarfs in Phase 2`
    },
    {
      title: 'ETF-Restwert bei 67 · Kern-Check',
      color: 'var(--purple)',
      steps: [
        [`ETF bei Übergangsphase (nominal)`, `${fmtV(etfRetireNom)} €`],
        [`Wächst ${yearsTo67} J. mit ${fmtV(ret*100,1)}% Rendite`, `× ${fmtV(Math.pow(1+ret,yearsTo67),3)}`],
        [`− Entnahmen Phase 1 (wachsen mit Inflation)`, `− ...`],
        [`= ETF-Restwert bei 67 (nominal)`, `${fmtV(etfRes67Nom)} €`, true],
        [`= ETF-Restwert bei 67 (real, heute €)`, `${fmtV(etfRes67Real)} €`, true],
        [`Benötigtes Kapital Phase 2 (nominal)`, `${fmtV(cap2_at67_nom)} €`],
        etfRes67Nom >= cap2_at67_nom
          ? [`✓ Überschuss`, `+${fmtV(etfRes67Nom - cap2_at67_nom)} €`, true]
          : [`✗ Lücke`, `${fmtV(etfRes67Nom - cap2_at67_nom)} €`, true],
      ],
      hint: 'Positiv = Plan geht auf. Negativ = mehr Kapital oder späterer Start nötig.'
    },
  ];

  const grid = document.getElementById('verif-grid');
  if (!grid) return;
  grid.innerHTML = blocks.map(b => `
    <div class="verif-block">
      <div class="verif-block-title" style="color:${b.color}">${b.title}</div>
      ${b.steps.map(([label, num, isResult]) => `
        <div class="verif-step${isResult ? ' result' : ''}">
          <span>${label}</span>
          <span class="verif-num">${num}</span>
        </div>
      `).join('')}
      ${b.hint ? `<div class="verif-hint">${b.hint}</div>` : ''}
    </div>
  `).join('');
}

/** Update subtitle in header */
export function updateSubtitle(params) {
  const { ret, inf, ohne } = params;
  const retReal = (1 + ret) / (1 + inf) - 1;
  const el = document.getElementById('subtitle');
  if (el) {
    el.textContent =
      `${ohne ? 'Ohne' : 'Mit'} Kapitalverzehr · ${fmt(ret*100,2)}% Rendite netto · ` +
      `${fmt(inf*100,1)}% Inflation · ${fmt(retReal*100,2)}% reale Nettorendite`;
  }
}
