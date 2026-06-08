function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildGespPublicId(year, month, level, questionNumber) {
  assertPositiveInteger(year, 'year');
  assertPositiveInteger(month, 'month');
  assertPositiveInteger(level, 'level');
  assertPositiveInteger(questionNumber, 'questionNumber');

  if (month > 12) throw new Error('month must be between 1 and 12');
  if (level > 99) throw new Error('level must be between 1 and 99');

  return `GESP${pad2(year % 100)}${pad2(month)}${pad2(level)}Q${questionNumber}`;
}

function parseGespRealExamName(name) {
  if (!name || typeof name !== 'string') return null;

  const match = name.match(/^\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*GESP\s*(\d{1,2})\s*级?\s*真题\s*$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    level: Number(match[3])
  };
}

module.exports = {
  buildGespPublicId,
  parseGespRealExamName
};
