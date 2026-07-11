export function cleanJunk(val: string): string {
  const trimmed = val.trim();
  const junkValues = ['n/a', 'na', 'none', 'null', '-'];
  if (junkValues.includes(trimmed.toLowerCase())) {
    return '';
  }
  return trimmed;
}

export function sanitizeFormulaInjection(val: string): string {
  if (!val) return val;
  const firstChar = val.charAt(0);
  if (['=', '+', '-', '@'].includes(firstChar)) {
    return `'` + val;
  }
  return val;
}

// Replace actual newline characters (\r\n, \r, \n) with literal "\n" text
// so multiline values don't break CSV row boundaries on export.
export function sanitizeNewlines(val: string): string {
  if (!val) return val;
  return val.replace(/\r\n|\r|\n/g, '\\n');
}
