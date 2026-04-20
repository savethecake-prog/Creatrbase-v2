export const TIER_GRADE = {
  established:    'A',
  viable:         'B',
  emerging:       'C',
  pre_commercial: 'D',
};

export const TIER_LABEL = {
  established:    'Established',
  viable:         'Viable',
  emerging:       'Emerging',
  pre_commercial: 'Pre-commercial',
};

export const TIER_VERDICT = {
  established:    'premium partner tier',
  viable:         'partnership ready',
  emerging:       'early traction visible',
  pre_commercial: 'building audience base',
};

// "B tier"
export function tierShort(tier) {
  const g = TIER_GRADE[tier];
  return g ? `${g} tier` : (tier?.replace(/_/g, ' ') ?? '');
}

// "B tier — Viable"
export function tierMedium(tier) {
  const g = TIER_GRADE[tier];
  const l = TIER_LABEL[tier];
  return (g && l) ? `${g} tier \u2014 ${l}` : (tier?.replace(/_/g, ' ') ?? '');
}
