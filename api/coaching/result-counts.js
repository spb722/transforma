export function completedSetCount(session) {
  const parse = value => { try { return JSON.parse(value || '{}') } catch { return {} } };
  const summary = parse(session.summary_json);
  if (Number.isInteger(summary.completedSets) && summary.completedSets >= 0) return summary.completedSets;
  // Older results have no summary count; retain their logged completed sets.
  const actual = parse(session.actual_json);
  return (actual.entries || []).reduce((count, entry) => count + (entry.sets || []).filter(set => set.done).length, 0);
}

export const completedOccurrenceCount = sessions => new Set(sessions.filter(session => completedSetCount(session) > 0).map(session => session.occurrence_id)).size;
