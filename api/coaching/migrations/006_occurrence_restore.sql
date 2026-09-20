ALTER TABLE workout_occurrences
ADD COLUMN cancellation_reason TEXT
CHECK (cancellation_reason IS NULL OR cancellation_reason IN ('explicit','plan_removed','relationship_ended'));

UPDATE workout_occurrences
SET cancellation_reason = CASE
  WHEN EXISTS (
    SELECT 1 FROM occurrence_events e
    WHERE e.occurrence_id = workout_occurrences.id AND e.type = 'relationship_ended'
  ) THEN 'relationship_ended'
  ELSE 'explicit'
END
WHERE state = 'canceled';

CREATE TABLE occurrence_events_v2 (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES workout_occurrences(id),
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('moved','reset','canceled','restored','plan_removed','plan_restored','relationship_ended')),
  from_date TEXT,
  to_date TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO occurrence_events_v2 (id, occurrence_id, actor_id, type, from_date, to_date, created_at)
SELECT id, occurrence_id, actor_id, type, from_date, to_date, created_at FROM occurrence_events;

DROP TABLE occurrence_events;
ALTER TABLE occurrence_events_v2 RENAME TO occurrence_events;
