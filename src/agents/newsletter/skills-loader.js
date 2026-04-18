'use strict';

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../../skills');

/**
 * Load skill files and build a system prompt section.
 * @param {string[]} skillNames - which skills to load
 * @returns {string} combined skills text for the system prompt
 */
function loadSkills(skillNames) {
  const parts = [];

  for (const name of skillNames) {
    const filePath = path.join(SKILLS_DIR, name, 'SKILL.md');
    if (!fs.existsSync(filePath)) {
      console.warn(`[skills-loader] Skill not found: ${name}`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    parts.push(`<skill name="${name}">\n${content}\n</skill>`);
  }

  return parts.join('\n\n');
}

/**
 * List all available skills.
 */
function listSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const filePath = path.join(SKILLS_DIR, d.name, 'SKILL.md');
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf8');
      const descMatch = content.match(/^## Description\n(.+)/m);
      return {
        name: d.name,
        description: descMatch ? descMatch[1].trim() : '',
        path: filePath,
        content,
      };
    })
    .filter(Boolean);
}

module.exports = { loadSkills, listSkills };
