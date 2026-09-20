export class CoachingApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || null;
  }
}

export function mutationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

export async function coachingApi(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api/coaching${path}`, {
    method,
    credentials: 'same-origin',
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  let payload = null
  try { payload = await response.json() } catch { /* normalized below */ }
  if (!response.ok) {
    const error = payload?.error || {}
    throw new CoachingApiError(response.status, error.code || 'REQUEST_FAILED', error.message || 'Unable to save this change', error.fields)
  }
  return payload?.data
}

export async function coachingMutation(path, body, options = {}) {
  return coachingApi(path, { ...options, method: options.method || 'POST', body: { mutationId: body.mutationId || mutationId(), ...body } })
}

export async function retryableCoachingMutation(path, body, options = {}) {
  const request = { ...body, mutationId: body.mutationId || mutationId() }
  try {
    return await coachingMutation(path, request, options)
  } catch (error) {
    // Reuse the mutation ID so a lost response returns the original result and a
    // rolled-back transient failure gets one safe retry without duplicate writes.
    if (error.status !== 500) throw error
    return coachingMutation(path, request, options)
  }
}
