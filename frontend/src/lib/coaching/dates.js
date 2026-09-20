export function dateInZone(date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = type => parts.find(part => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function mondayInZone(date, timeZone = 'UTC') {
  const value = new Date(`${dateInZone(date, timeZone)}T12:00:00Z`)
  const weekday = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 1 - weekday)
  return value.toISOString().slice(0, 10)
}
