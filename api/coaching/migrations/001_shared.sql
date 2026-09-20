CREATE TABLE trainer_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  business_time_zone TEXT NOT NULL,
  whatsapp_number TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE client_relationships (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
  time_zone TEXT NOT NULL,
  consent_version INTEGER NOT NULL CHECK (consent_version > 0),
  consent_text_snapshot TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  ended_by TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (trainer_id <> client_id),
  CHECK ((status = 'active' AND ended_at IS NULL AND ended_by IS NULL) OR status = 'ended')
);

CREATE UNIQUE INDEX one_active_trainer_per_client
ON client_relationships(client_id) WHERE status = 'active';
CREATE INDEX client_relationships_trainer ON client_relationships(trainer_id, status);

CREATE TRIGGER relationship_accounts_exist_before_insert
BEFORE INSERT ON client_relationships
WHEN account_exists(NEW.trainer_id) = 0 OR account_exists(NEW.client_id) = 0
BEGIN
  SELECT RAISE(ABORT, 'account unavailable');
END;

CREATE TABLE plan_templates (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('workout', 'diet')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  content_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX plan_templates_owner_kind ON plan_templates(trainer_id, kind, archived_at);

CREATE TABLE plan_assignments (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES client_relationships(id),
  kind TEXT NOT NULL CHECK (kind IN ('workout', 'diet')),
  source_template_id TEXT REFERENCES plan_templates(id),
  current_revision_id TEXT,
  materialized_through TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (relationship_id, kind)
);

CREATE TABLE plan_revisions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES plan_assignments(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  content_json TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (assignment_id, revision_number)
);

CREATE TABLE sync_receipts (
  client_id TEXT PRIMARY KEY,
  personal_state_received_at TEXT,
  assigned_result_received_at TEXT
);

CREATE TABLE mutation_receipts (
  actor_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  resource_id TEXT,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (actor_id, mutation_id)
);
