import { dateInZone } from './dates.js'

export function activeOwnRelationship(bootstrap) {
  return bootstrap?.relationships?.find(relationship => relationship.status === 'active') || null
}

export function hasActiveCoachPlan(workspace, now = new Date()) {
  if (workspace?.relationship?.status !== 'active') return false
  if (workspace.workout?.content) return true
  const today = dateInZone(now, workspace.relationship.timeZone)
  return (workspace.occurrences || workspace.workout?.occurrences || []).some(row =>
    resumableOccurrence(row) || (row.state === 'scheduled' && row.scheduledDate >= today))
}

export function ownAssignmentSchedule(workspace, now = new Date()) {
  const relationship = workspace?.relationship
  if (relationship?.status !== 'active') return { relationshipDate: null, today: null, todayStatus: null, upcoming: [], canceled: [], past: [] }
  const relationshipDate = dateInZone(now, relationship.timeZone)
  const rows = workspace.occurrences || workspace.workout?.occurrences || []
  const scheduled = rows.filter(row => row.state === 'scheduled')
  const startedToday = rows.filter(row => resumableOccurrence(row) && row.scheduledDate === relationshipDate)
  const todayStatus = occurrenceOnDate(workspace, relationshipDate)
  return {
    relationshipDate,
    today: todayStatus && (todayStatus.state === 'scheduled' || resumableOccurrence(todayStatus)) ? todayStatus : null,
    todayStatus,
    upcoming: [...startedToday, ...scheduled.filter(row => row.scheduledDate >= relationshipDate)].sort(byDate),
    canceled: rows.filter(row => row.state === 'canceled' && row.cancellationReason === 'explicit' && row.scheduledDate >= relationshipDate).sort(byDate),
    past: rows.filter(row => row.scheduledDate < relationshipDate || row.state === 'completed').sort((a, b) => byDate(b, a))
  }
}

export function occurrenceOnDate(workspace, date) {
  const priority = { started: 0, scheduled: 1, completed: 2, canceled: 3 }
  return (workspace?.occurrences || workspace?.workout?.occurrences || [])
    .filter(row => row.scheduledDate === date && (row.state !== 'canceled' || row.cancellationReason === 'explicit'))
    .sort((a, b) => (priority[a.state] ?? 9) - (priority[b.state] ?? 9))[0] || null
}

function byDate(a, b) {
  return a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id)
}

function resumableOccurrence(row) {
  return row.state === 'started' && !['abandoned', 'completed', 'partial', 'zero'].includes(row.displayState || row.day?.state)
}
