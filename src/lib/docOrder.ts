// Sidebar ordering for docs: titles containing a date (e.g. "7th Oct '26 - Minutes")
// come first, newest first; everything else follows in natural title order.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Day, month name (any length, e.g. "Sept"), then a 2- or 4-digit year, optionally
// prefixed with an apostrophe: "7th Oct '26", "15th July 2026", "2 Sept 26".
const TITLE_DATE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+[''‘’]?(\d{4}|\d{2})\b/i;

/** Returns the timestamp of the first date found in a title, or null if there isn't one. */
export function titleDate(title: string): number | null {
  const match = title.match(TITLE_DATE);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
  if (month === -1) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return Date.UTC(year, month, Number(match[1]));
}

const natural = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

/** Natural string comparison, so "Item 2" sorts before "Item 10". */
export const naturalCompare = (a: string, b: string) => natural.compare(a, b);

/** Dated titles first (newest first), then undated titles in natural order. */
export function compareDocTitles(a: string, b: string): number {
  const dateA = titleDate(a);
  const dateB = titleDate(b);
  if (dateA !== null && dateB !== null && dateA !== dateB) return dateB - dateA;
  if (dateA !== null && dateB === null) return -1;
  if (dateA === null && dateB !== null) return 1;
  return naturalCompare(a, b);
}
