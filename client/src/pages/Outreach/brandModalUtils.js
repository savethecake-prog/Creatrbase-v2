'use strict';

export const CATEGORY_LABELS = {
  gaming_hardware:      'Gaming Hardware',
  gaming_software:      'Gaming Software',
  gaming_nutrition:     'Gaming Nutrition',
  gaming_apparel:       'Gaming Apparel',
  d2c_grooming:         'D2C Grooming',
  d2c_wellness:         'D2C Wellness',
  d2c_tech_accessories: 'D2C Tech',
  publisher:            'Publisher',
  other:                'Other',
};

export const PROGRAMME_LABELS = {
  direct:           'Direct programme',
  agency_managed:   'Agency managed',
  platform_managed: 'Platform managed',
  unknown:          'Programme unknown',
};

export const CONFIDENCE_VARIANT = {
  established: 'mint',
  partial:     'peach',
  minimal:     'lavender',
};

export function formatRate(low, high, currency) {
  const sym = currency === 'USD' ? '$' : '£';
  const fmt = n => {
    const v = Math.round(n / 100);
    return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v}`;
  };
  if (!low && !high) return null;
  if (low && high) return `${fmt(low)} – ${fmt(high)}`;
  if (high) return `up to ${fmt(high)}`;
  return fmt(low);
}

export function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildEmailTemplate({ brand, niche, displayName }) {
  const nicheStr = niche ? niche.replace(/_/g, ' ') : 'gaming';
  return `Subject: Creator Partnership Inquiry — ${displayName}

Hi ${brand.brand_name} Partnerships Team,

My name is ${displayName} and I'm a ${nicheStr} content creator on YouTube.

I'm reaching out to explore a potential partnership with ${brand.brand_name}. Your products align closely with the content I create, and I believe there's a genuine fit with my audience.

I'd love to learn more about your current creator programme or discuss what a collaboration could look like.

Would you be open to a quick conversation, or could you point me to the right person?

Best regards,
${displayName}`;
}
