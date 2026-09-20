export const isoDate = date => date.toISOString().slice(0, 10);

export function dateInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(iso, count) {
  const date = new Date(`${iso}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() + count); return isoDate(date);
}

export function isoWeekday(iso) {
  const day = new Date(`${iso}T12:00:00.000Z`).getUTCDay(); return day === 0 ? 7 : day;
}

export function mondayOf(iso) { return addDays(iso, 1 - isoWeekday(iso)); }

export const validIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
