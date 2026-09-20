export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function publicError(error) {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Server error' } } };
}

export function expectedVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) throw new HttpError(422, 'INVALID_VERSION', 'Expected version must be a non-negative integer', { expectedVersion: 'invalid' });
  return version;
}

export function pageInput(query = {}) {
  const requested = Number(query.limit || 50);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.trunc(requested))) : 50;
  const cursor = typeof query.cursor === 'string' && query.cursor.length <= 500 ? query.cursor : null;
  return { limit, cursor };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function dateRange(from, to, maxDays = 366) {
  if (!DATE.test(from || '') || !DATE.test(to || '')) throw new HttpError(422, 'INVALID_DATE_RANGE', 'Use YYYY-MM-DD dates');
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = (end - start) / 86_400_000;
  if (days < 0 || days > maxDays) throw new HttpError(422, 'INVALID_DATE_RANGE', `Date range must be 0–${maxDays} days`);
  return { from, to };
}

export function text(value, field, { min = 1, max = 4_000, optional = false } = {}) {
  if (value == null && optional) return null;
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', { [field]: `must be ${min}–${max} characters` });
  return result;
}

export function uuid(value, field = 'id') {
  const result = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', { [field]: 'must be a UUID' });
  }
  return result;
}

export function validTimeZone(value) {
  const zone = text(value, 'businessTimeZone', { max: 100 });
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); }
  catch { throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', { businessTimeZone: 'must be an IANA time zone' }); }
  return zone;
}
