// Regular meeting schedule: first Wednesday of every month, 5:30pm.
export const MEETING_WEEKDAY = 3; // 0 = Sunday … 3 = Wednesday
export const MEETING_START = { hour: 17, minute: 30 };
export const MEETING_END = { hour: 18, minute: 30 };

function firstWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset);
}

/** Returns the date of the next regular meeting. Today's meeting counts until it has finished. */
export function getNextMeetingDate(now: Date = new Date()): Date {
  let year = now.getFullYear();
  let month = now.getMonth();
  for (;;) {
    const candidate = firstWeekdayOfMonth(year, month, MEETING_WEEKDAY);
    const end = new Date(candidate);
    end.setHours(MEETING_END.hour, MEETING_END.minute, 0, 0);
    if (end > now) return candidate;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
}

export function formatMeetingDate(date: Date): string {
  const day = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${day}, 5:30pm`;
}
