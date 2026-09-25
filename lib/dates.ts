/** Interpret <input type="date"> as 23:59:59.999 on that calendar day in Jakarta (UTC+7). */
export function parseDeadlineInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarMidnightUtc = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarMidnightUtc.getUTCFullYear() !== year ||
    calendarMidnightUtc.getUTCMonth() !== month - 1 ||
    calendarMidnightUtc.getUTCDate() !== day
  ) {
    return null;
  }

  const jakartaEndOfDayUtcMs =
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 7 * 60 * 60 * 1000;
  return new Date(jakartaEndOfDayUtcMs);
}

export function deadlineToSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}
