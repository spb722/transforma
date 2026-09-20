import { dateInZone } from './dates.js'

export function activeOwnRelationship(bootstrap) {
  return bootstrap?.relationships?.find(relationship => relationship.status === 'active') || null
}

export function hasActiveCoachPlan(workspace) {
  return workspace?.relationship?.status === 'active' && Boolean(workspace?.workout?.content)
}

export function ownAssignmentSchedule(workspace, now = new Date()) {
  const relationship = workspace?.relationship
  const workout = workspace?.workout
  if (!hasActiveCoachPlan(workspace)) return { relationshipDate: null, today: null, todayStatus: null, upcoming: [], canceled: [], past: [] }
  const relationshipDate = dateInZone(now, relationship.timeZone)
  const rows = workout.occurrences || []
  const scheduled = rows.filter(row => row.state === 'scheduled')
  const startedToday = rows.filter(row => row.state === 'started' && row.scheduledDate === relationshipDate)
  const todayStatus = occurrenceOnDate(workspace, relationshipDate)
  return {
    relationshipDate,
    today: todayStatus && ['scheduled', 'started'].includes(todayStatus.state) ? todayStatus : null,
    todayStatus,
    upcoming: [...startedToday, ...scheduled.filter(row => row.scheduledDate >= relationshipDate)].sort(byDate),
    canceled: rows.filter(row => row.state === 'canceled' && row.cancellationReason === 'explicit' && row.scheduledDate >= relationshipDate).sort(byDate),
    past: rows.filter(row => row.scheduledDate < relationshipDate || row.state === 'completed').sort((a, b) => byDate(b, a))
  }
}

export function occurrenceOnDate(workspace, date) {
  const priority = { started: 0, scheduled: 1, completed: 2, canceled: 3 }
  return (workspace?.workout?.occurrences || [])
    .filter(row => row.scheduledDate === date && (row.state !== 'canceled' || row.cancellationReason === 'explicit'))
    .sort((a, b) => (priority[a.state] ?? 9) - (priority[b.state] ?? 9))[0] || null
}

function byDate(a, b) {
  return a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id)
}
