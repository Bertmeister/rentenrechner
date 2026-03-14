/**
 * calc.js – Pure calculation functions for Rentenplanung
 * No DOM dependencies
 */

export const GRV_AGE     = 67;
export const RP_BASE     = 40.79;   // Rentenpunktwert 2025
export const RP_GROW     = 0.015;
export const GRV_NET_PCT = 0.895;
export const DURCHSCHNITTSENTGELT = 45358; // vorläufiger Wert 2026

/** ETF future value with monthly savings (annual compounding) */
export function etfFV(etf0, sparMo, r, years) {
  if (years <= 0) return etf0;
  if (r === 0) return etf0 + sparMo * 12 * years;
  const g = Math.pow(1 + r, years);
  return etf0 * g + sparMo * 12 * (g - 1) / r;
}

/**
 * PV of growing annuity
 * pmt = annual payment
 * r   = discount rate
 * g   = payment growth rate
 * n   = years
 */
export function pvGA(pmt, r, g, n) {
  if (n <= 0) return 0;
  if (Math.abs(r - g) < 0.00001) return pmt * n / (1 + r);
  return pmt * (1 - Math.pow((1 + g) / (1 + r), n)) / (r - g);
}

/** Required capital at age 67 in real today's € */
export function calcP2_atAge67_real(gapAnnualReal, retReal, ent, yearsP2, ohne) {
  if (gapAnnualReal <= 0) return 0;
  if (ohne) return gapAnnualReal / ent;
  return pvGA(gapAnnualReal, retReal, 0, yearsP2);
}

/** Required capital at Übergangsphase in real today's € */
export function calcP1_atRetire_real(netNeedP1Annual, cap67Real, retReal, ent, yearsTo67, ohne) {
  if (ohne) {
    if (netNeedP1Annual <= 0) return Math.max(0, cap67Real / Math.pow(1 + retReal, yearsTo67));
    return Math.max(netNeedP1Annual / ent, cap67Real);
  } else {
    const phase1 = pvGA(netNeedP1Annual, retReal, 0, yearsTo67);
    const phase2discounted = cap67Real / Math.pow(1 + retReal, yearsTo67);
    return phase1 + phase2discounted;
  }
}

/** ETF residual at 67 (nominal) after Phase 1 withdrawals */
export function etfResidualAt67(etfRetireNom, netNeedP1NomAnnual_yr1, r, inf, yearsTo67) {
  if (yearsTo67 <= 0) return etfRetireNom;
  const fvETF = etfRetireNom * Math.pow(1 + r, yearsTo67);
  let fvWithdrawals;
  if (Math.abs(r - inf) < 0.00001) {
    fvWithdrawals = netNeedP1NomAnnual_yr1 * yearsTo67 * Math.pow(1 + r, yearsTo67 - 1);
  } else {
    fvWithdrawals = netNeedP1NomAnnual_yr1 * (Math.pow(1 + r, yearsTo67) - Math.pow(1 + inf, yearsTo67)) / (r - inf);
  }
  return fvETF - fvWithdrawals;
}

/** Read all input values from DOM and return a plain params object */
export function getParams() {
  const g = id => parseFloat(document.getElementById(id)?.value) || 0;
  const einmal = [];
  document.querySelectorAll('.einmal-block').forEach(block => {
    const m = block.id.match(/einmal-block-(\d+)/);
    if (!m) return;
    const id = m[1];
    const betrag = parseFloat(document.getElementById(`inp-einmal-betrag-${id}`)?.value) || 0;
    const alter  = parseFloat(document.getElementById(`inp-einmal-alter-${id}`)?.value)  || 0;
    if (betrag > 0 && alter > 0) einmal.push({ betrag, alter });
  });
  const ohne = document.getElementById('toggle-mode')?.checked ?? true;
  const retBrutto = g('inp-ret-brutto') || 7.0;
  const tax       = g('inp-tax') || 18.5;
  const ret       = retBrutto * (1 - tax / 100);
  const inf       = g('inp-inf') || 2.0;
  return {
    age:    g('inp-age')    || 20,
    life:   g('inp-life')   || 90,
    need:   g('inp-need')   || 0,
    etf0:   g('inp-etf')    || 0,
    inf:    inf / 100,
    ret:    ret / 100,
    ent:    (g('inp-ent')   || 3.5) / 100,
    rp0:    g('inp-rp')     || 0,
    rpj0:   g('inp-rpj0')   || 0,
    rpj1:   g('inp-rpj1')   || 0,
    spar:   g('inp-spar')   || 0,
    extra:  g('inp-extra')  || 0,
    need2:  g('inp-need2')  || 2000,
    zusatz: g('inp-zusatz') || 0,
    netto:  g('inp-netto')  || 0,
    abgaben:g('inp-abgaben')|| 36,
    retBrutto,
    tax,
    ohne,
    einmal,
  };
}

/** Compute all values for a single retirement scenario */
export function calcScenario(params, retireAge) {
  const { age, life, need, etf0, inf, ret, ent, rp0, rpj0, rpj1,
          spar, extra, need2, zusatz, ohne, einmal } = params;

  const retReal = (1 + ret) / (1 + inf) - 1;
  const yearsToRetire  = Math.max(0, retireAge - age);
  const yearsTo67      = Math.max(0, GRV_AGE - retireAge);
  const yearsP2        = Math.max(0, life - GRV_AGE);
  const yearsTo67Total = yearsToRetire + yearsTo67;

  const inflToRetire = Math.pow(1 + inf, yearsToRetire);
  const inflTo67     = Math.pow(1 + inf, yearsTo67Total);
  const rpWert67     = RP_BASE * Math.pow(1 + RP_GROW, GRV_AGE - age);

  // GRV points
  const rpAtRetire = rp0 + yearsToRetire * rpj0;
  const rpAt67     = rpAtRetire + yearsTo67 * rpj1;

  // GRV at 67
  const grvBruttoNom = rpAt67 * rpWert67;
  const grvNettoNom  = grvBruttoNom * GRV_NET_PCT + zusatz;
  const grvNettoReal = grvNettoNom / inflTo67;

  // Kaufkraft
  const kaufNomRetire = need * inflToRetire;
  const kaufNom67     = need2 * inflTo67;

  // Zusatzeinkommen Phase 1
  const extraNomRetire = extra * inflToRetire;

  // Monatliche Lücke Phase 1
  const lueckeNomRetire    = kaufNomRetire - extraNomRetire;
  const lueckeReal         = need - extra;
  const lueckeNomAnnual_yr1 = lueckeNomRetire * 12;
  const lueckeRealAnnual   = lueckeReal * 12;

  // Rentenlücke Phase 2
  const rentenlueckeNomMonth  = Math.max(0, kaufNom67 - grvNettoNom);
  const rentenlueckeRealMonth = Math.max(0, need2 - grvNettoReal);
  const rentenlueckeRealAnnual = rentenlueckeRealMonth * 12;

  // ETF at Übergangsphase (nominal)
  let etfRetireNom = etfFV(etf0, spar, ret, yearsToRetire);
  einmal.forEach(({ betrag, alter }) => {
    if (alter >= age && alter <= retireAge) {
      etfRetireNom += betrag * Math.pow(1 + ret, retireAge - alter);
    }
  });
  const etfRetireReal = etfRetireNom / inflToRetire;

  // Required capital Phase 2 at 67 (real today's €)
  const cap2_at67_real = calcP2_atAge67_real(rentenlueckeRealAnnual, retReal, ent, yearsP2, ohne);
  const cap2_at67_nom  = cap2_at67_real * inflTo67;

  // Required capital at Übergangsphase (real today's €)
  const cap1_atRetire_real = calcP1_atRetire_real(lueckeRealAnnual, cap2_at67_real, retReal, ent, yearsTo67, ohne);
  const cap1_atRetire_nom  = cap1_atRetire_real * inflToRetire;

  // ETF residual at 67 (nominal)
  const etfRes67Nom  = etfResidualAt67(etfRetireNom, lueckeNomAnnual_yr1, ret, inf, yearsTo67);
  const etfRes67Real = etfRes67Nom / inflTo67;

  // Percentages for display
  const p1pctNom  = cap1_atRetire_nom  > 0 ? Math.min(100, (etfRetireNom  / cap1_atRetire_nom)  * 100) : 100;
  const p1pctReal = cap1_atRetire_real > 0 ? Math.min(100, (etfRetireReal / cap1_atRetire_real) * 100) : 100;
  const p2pctNom  = cap2_at67_nom  > 0 ? Math.min(100, (Math.max(0, etfRes67Nom)  / cap2_at67_nom)  * 100) : 100;
  const p2pctReal = cap2_at67_real > 0 ? Math.min(100, (Math.max(0, etfRes67Real) / cap2_at67_real) * 100) : 100;

  const p2gapNom  = etfRes67Nom  - cap2_at67_nom;
  const p2gapReal = etfRes67Real - cap2_at67_real;

  return {
    retireAge, age,
    yearsToRetire, yearsTo67, yearsP2,
    inflToRetire, inflTo67, retReal,
    rpWert67, rpAtRetire, rpAt67,
    grvBruttoNom, grvNettoNom, grvNettoReal,
    kaufNomRetire, kaufNom67,
    extraNomRetire,
    lueckeNomRetire, lueckeReal, lueckeNomAnnual_yr1, lueckeRealAnnual,
    rentenlueckeNomMonth, rentenlueckeRealMonth, rentenlueckeRealAnnual,
    etfRetireNom, etfRetireReal,
    cap2_at67_real, cap2_at67_nom,
    cap1_atRetire_real, cap1_atRetire_nom,
    etfRes67Nom, etfRes67Real,
    p1pctNom, p1pctReal, p2pctNom, p2pctReal,
    p2gapNom, p2gapReal,
    // params passed through for verification panel
    zusatz, need, need2, extra, ent, ohne, ret, inf,
    spar, etf0, rp0, rpj0, rpj1,
  };
}

/** Compute breakeven age and all scenario ages */
export function calcAll(params) {
  const { age, life } = params;

  const scenarioOk = (retireAge) => {
    const s = calcScenario(params, retireAge);
    return s.etfRes67Nom >= s.cap2_at67_nom - 0.5;
  };

  let breakevenAge = null;
  if (scenarioOk(age)) {
    breakevenAge = age;
  } else {
    for (let a = age + 1; a <= GRV_AGE; a++) {
      if (scenarioOk(a)) { breakevenAge = a; break; }
    }
  }

  const baseAges = [age, 40, 45, 50, 55, 60, 65].filter(a => a >= age);
  let allAges = [...new Set(baseAges)];
  if (breakevenAge !== null && breakevenAge !== age && !allAges.includes(breakevenAge) && breakevenAge < GRV_AGE) {
    allAges = [...allAges, breakevenAge].sort((a, b) => a - b);
  }

  const scenarios = allAges
    .filter(a => a <= life)
    .map(a => calcScenario(params, a));

  return { breakevenAge, scenarios };
}
