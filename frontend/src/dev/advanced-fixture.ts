/** Synthetic model outputs for the Advanced analytics page. No real data; keys are placeholders. */
import type { DeepDive, Level, Mortality, Risk } from '@/pages/advanced-page'

const lv = (level: string, n: number, rate: number, aor: number | null, lo: number | null, hi: number | null,
            flag: Level['flag'], ref = false): Level => ({
  level, n, resupp: Math.round(n * rate / 100), rate, ref, flag,
  or_: ref ? 1 : aor, or_lo: ref ? null : lo, or_hi: ref ? null : hi, or_p: ref ? null : 0.04,
  aor: ref ? 1 : aor, aor_lo: ref ? null : lo, aor_hi: ref ? null : hi, aor_p: ref ? null : flag === 'ns' ? 0.41 : 0.002,
})

export const DD: DeepDive = {
  ok: true, n_model: 1877, resupp_pct: 78.4,
  variables: [
    { key: 'sex', label: 'Sex', type: 'categorical', test: 'Chi-square', test_p: 0.21,
      levels: [lv('Female', 1230, 79.6, null, null, null, 'ref', true), lv('Male', 647, 76.1, 0.88, 0.69, 1.12, 'ns')] },
    { key: 'age_band', label: 'Age band', type: 'ordered', test: 'Cochran-Armitage trend', test_p: 0.0004,
      levels: [lv('20-34', 640, 80.2, null, null, null, 'ref', true), lv('10-19', 212, 64.6, 0.47, 0.33, 0.66, 'neg'),
               lv('0-9', 98, 61.2, 0.41, 0.26, 0.65, 'neg'), lv('35-49', 702, 81.9, 1.12, 0.86, 1.46, 'ns'),
               lv('50+', 225, 85.3, 1.52, 1.02, 2.27, 'pos')] },
    { key: 'idx_band', label: 'Index VL band', type: 'ordered', test: 'Cochran-Armitage trend', test_p: 0.003,
      levels: [lv('1,000-9,999', 810, 82.1, null, null, null, 'ref', true), lv('10,000-99,999', 720, 77.4, 0.79, 0.61, 1.02, 'ns'),
               lv('100,000+', 347, 70.9, 0.56, 0.41, 0.77, 'neg')] },
    { key: 'years_art', label: 'Years on ART', type: 'continuous', test: 'Mann-Whitney U', test_p: 0.03,
      aor: 1.04, aor_lo: 1.01, aor_hi: 1.07, aor_p: 0.01, flag: 'pos', median_resupp: 6.2, median_not: 5.1, unit: 'year' },
  ],
  cd4: { coverage_pct: 48.1, n_known: 903, levels: [
    { level: '<200', n: 255, resupp: 188, rate: 73.7 }, { level: '>=200', n: 648, resupp: 529, rate: 81.6 },
    { level: 'Not recorded', n: 974, resupp: 762, rate: 78.2 }], test: 'Chi-square (recorded only)', test_p: 0.008 },
}

export const RISK: Risk = {
  ok: true, auc: 0.829, baseline: 78.4, n_train: 1877, n_scored: 2010, n_left_care: 341,
  calibration: Array.from({ length: 10 }, (_, i) => ({ predicted: 30 + i * 7, observed: 26 + i * 7.4, n: 188 })),
  lowest_chance: Array.from({ length: 40 }, (_, i) => ({
    sn: `0.${String(700000000000 + i)}`, facility: `Facility ${String.fromCharCode(65 + (i % 8))}`, state: 'Delta',
    age: 12 + (i % 40), idx_vl: 120000 - i * 1500, sessions: i % 4,
    plan: ['A. Commence EAC, update register and EMR', 'B. Complete EAC, update register and EMR', 'C. Commence EAC, document register and EMR'][i % 3]!,
    p_resupp: Math.round((22 + i * 1.8) * 10) / 10,
  })),
}

export const MORT: Mortality = {
  ok: true, n: 4228, deaths: 30, crude_pct: 0.71,
  by_eac: [{ group: 'Completed EAC', n: 1653, deaths: 18, pct: 1.09 }, { group: 'Did not complete', n: 2575, deaths: 12, pct: 0.47 }],
}
