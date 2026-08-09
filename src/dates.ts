export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** A `YYYY-MM-DD` key as a local date, so day boundaries match the user's clock. */
export function parseDate(key: string): Date {
  const [year = '1970', month = '01', day = '01'] = key.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** `Mon 28 Jul` from a `YYYY-MM-DD` key. */
export function formatDate(key: string): string {
  const [, , day = '01'] = key.split('-');
  const date = parseDate(key);
  return `${WEEKDAYS[date.getDay()]} ${day} ${MONTHS[date.getMonth()]}`;
}

export function isWeekend(key: string): boolean {
  const weekday = parseDate(key).getDay();
  return weekday === 0 || weekday === 6;
}

export function isToday(key: string): boolean {
  return parseDate(key).toDateString() === new Date().toDateString();
}

/** Two-digit day of month, so labels line up under their two-column bars. */
export function dayOfMonth(key: string): string {
  const [, , day = '01'] = key.split('-');
  return day.padStart(2, '0');
}
