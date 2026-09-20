import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const defaultMigrations = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

function migrationFiles(directory) {
  return fs.readdirSync(directory)
    .filter(file => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort((a, b) => Number(a.split('_')[0]) - Number(b.split('_')[0]));
}

export function openCoachingDb({ dataDir = process.env.DATA_DIR || '/data', migrationsDir = defaultMigrations, identities } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'coaching.sqlite');
  const db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.function('account_exists', { deterministic: false }, id => identities?.isEnabled?.(String(id)) ? 1 : 0);
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');

  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row => row.version));
  for (const file of migrationFiles(migrationsDir)) {
    const version = Number(file.split('_')[0]);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(version, file, new Date().toISOString());
      }).immediate();
      applied.add(version);
    } catch (error) {
      db.close();
      throw new Error(`Coaching migration ${version} failed: ${error.message}`, { cause: error });
    }
  }

  const assertAccount = id => {
    if (!identities?.isEnabled?.(id)) throw new Error('account unavailable');
    return identities.findUser?.(id) || { id };
  };

  return {
    db,
    path: dbPath,
    identities,
    close: () => db.close(),
    appliedVersions: () => db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version),
    assertAccount,
    transaction: fn => db.transaction(fn).immediate,
    insertRelationship({ id, trainerId, clientId, timeZone, consentText, now, consentVersion = 1 }) {
      assertAccount(trainerId);
      assertAccount(clientId);
      try {
        return db.prepare(`INSERT INTO client_relationships
          (id, trainer_id, client_id, status, time_zone, consent_version, consent_text_snapshot, consented_at, started_at, version)
          VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, 1)`)
          .run(id, trainerId, clientId, timeZone, consentVersion, consentText, now, now);
      } catch (error) {
        if (/one_active_trainer_per_client|UNIQUE constraint failed: client_relationships.client_id/.test(error.message)) {
          throw new Error('client already has an active trainer', { cause: error });
        }
        throw error;
      }
    }
  };
}
