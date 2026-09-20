const KEY = 'transforma_coaching_join_token'

const storageOrSession = storage => storage || (typeof sessionStorage === 'undefined' ? null : sessionStorage)

export function rememberJoinIntent(token, storage) {
  const target = storageOrSession(storage)
  if (target && token) target.setItem(KEY, String(token))
}

export function joinIntent(storage) {
  return storageOrSession(storage)?.getItem(KEY) || null
}

export function clearJoinIntent(storage) {
  storageOrSession(storage)?.removeItem(KEY)
}

export function buildAcceptance({ token, consentVersion, confirmSharing }) {
  if (!token) throw new Error('Invitation token is missing')
  if (confirmSharing !== true) throw new Error('Please confirm sharing before joining')
  return { token, consentVersion, confirmSharing: true }
}

export function modesFor(bootstrap = {}) {
  const modes = []
  if (bootstrap.capabilities?.trainer) modes.push('studio')
  if ((bootstrap.relationships || []).some(item => item.status === 'active')) modes.push('coaching')
  modes.push('personal')
  return modes
}
