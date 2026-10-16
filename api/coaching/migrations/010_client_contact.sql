CREATE TABLE client_contact_preferences (
  relationship_id TEXT PRIMARY KEY REFERENCES client_relationships(id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  whatsapp_number TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE client_contact_confirmations (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES client_relationships(id),
  trainer_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  occurrence_id TEXT REFERENCES workout_occurrences(id),
  workout_name TEXT,
  confirmed_at TEXT NOT NULL
);
CREATE INDEX client_contact_recent ON client_contact_confirmations(relationship_id, confirmed_at);
