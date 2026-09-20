CREATE TABLE weekly_check_ins (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES client_relationships(id),
  week_start TEXT NOT NULL,
  adherence TEXT NOT NULL CHECK (adherence IN ('all','mostly','some','none')),
  weight_value REAL,
  weight_unit TEXT CHECK (weight_unit IS NULL OR weight_unit IN ('kg','lb')),
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (relationship_id, week_start),
  CHECK ((weight_value IS NULL AND weight_unit IS NULL) OR (weight_value > 0 AND weight_unit IS NOT NULL))
);
CREATE INDEX weekly_check_ins_relationship_week ON weekly_check_ins(relationship_id, week_start DESC);

CREATE TABLE check_in_responses (
  id TEXT PRIMARY KEY,
  check_in_id TEXT NOT NULL UNIQUE REFERENCES weekly_check_ins(id),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  reviewed_check_in_version INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
