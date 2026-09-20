ALTER TABLE workout_occurrences
ADD COLUMN prescription_override_json TEXT;

ALTER TABLE workout_occurrences
ADD COLUMN override_updated_at TEXT;

CREATE TABLE occurrence_events_v3 (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES workout_occurrences(id),
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('moved','reset','canceled','restored','plan_removed','plan_restored','customized','customization_reset','relationship_ended')),
  from_date TEXT,
  to_date TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO occurrence_events_v3 (id, occurrence_id, actor_id, type, from_date, to_date, created_at)
SELECT id, occurrence_id, actor_id, type, from_date, to_date, created_at FROM occurrence_events;

DROP TABLE occurrence_events;
ALTER TABLE occurrence_events_v3 RENAME TO occurrence_events;
