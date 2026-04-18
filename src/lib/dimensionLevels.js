'use strict';

/**
 * Map a dimension score (0-100) to a semantic level and colour.
 * Used by score card templates and OG image generator.
 */
function getDimensionLevel(score) {
  if (score == null) return { level: 'unknown', color: '#555A66', label: 'No data' };
  if (score >= 60)   return { level: 'positive', color: '#6EDDB1', label: 'Strong' };
  if (score >= 40)   return { level: 'info',     color: '#A284E0', label: 'Developing' };
  return                     { level: 'warning',  color: '#F09870', label: 'Needs work' };
}

module.exports = { getDimensionLevel };
