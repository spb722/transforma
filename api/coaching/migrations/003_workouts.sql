CREATE TABLE workout_occurrences (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES plan_assignments(id),
  relationship_id TEXT NOT NULL REFERENCES client_relationships(id),
  revision_id TEXT NOT NULL REFERENCES plan_revisions(id),
  recurrence_key TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  original_date TEXT NOT NULL,
  override_date TEXT,
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','canceled','started','completed')),
  prescription_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (assignment_id, recurrence_key)
);
CREATE INDEX workout_occurrences_relationship_date ON workout_occurrences(relationship_id, scheduled_date, state);
CREATE UNIQUE INDEX workout_occurrences_assignment_date_active ON workout_occurrences(assignment_id, scheduled_date) WHERE state <> 'canceled';

CREATE TABLE occurrence_events (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES workout_occurrences(id),
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('moved','reset','canceled','relationship_ended')),
  from_date TEXT,
  to_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE assigned_sessions (
  id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES workout_occurrences(id),
  relationship_id TEXT NOT NULL REFERENCES client_relationships(id),
  client_id TEXT NOT NULL,
  revision_id TEXT NOT NULL REFERENCES plan_revisions(id),
  state TEXT NOT NULL CHECK (state IN ('started','finished','abandoned')),
  started_at TEXT NOT NULL,
  client_finished_at TEXT,
  received_at TEXT,
  scheduled_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  unit TEXT NOT NULL,
  prescription_json TEXT NOT NULL,
  actual_json TEXT,
  summary_json TEXT,
  result_hash TEXT,
  UNIQUE (id, client_id)
);
CREATE INDEX assigned_sessions_relationship_started ON assigned_sessions(relationship_id, started_at DESC);
CREATE INDEX assigned_sessions_occurrence_state ON assigned_sessions(occurrence_id, state);
