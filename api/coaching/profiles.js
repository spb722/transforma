import { HttpError, expectedVersion, text, validTimeZone } from './validation.js';
import { requireTrainer } from './access.js';

function profile(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    businessTimeZone: row.business_time_zone,
    whatsAppNumber: row.whatsapp_number,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
export function normalizeWhatsApp(value) {
  if (value == null || String(value).trim() === '') return null;
  const compact = String(value).replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) throw new HttpError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields', { whatsAppNumber: 'use international format, for example +919876543210' });
  return compact;
}

export function profileService(store, { config, now = () => new Date() } = {}) {
  return {
    get(userId) {
      return profile(store.db.prepare('SELECT * FROM trainer_profiles WHERE user_id = ?').get(userId));
    },
    save(userId, input) {
      requireTrainer(store.assertAccount(userId), config.trainerIds);
      const version = expectedVersion(input.expectedVersion);
      const current = store.db.prepare('SELECT * FROM trainer_profiles WHERE user_id = ?').get(userId);
      if ((!current && version !== 0) || (current && current.version !== version)) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload trainer settings before saving');
      const displayName = text(input.displayName, 'displayName', { max: 100 });
      const businessTimeZone = validTimeZone(input.businessTimeZone);
      const whatsAppNumber = normalizeWhatsApp(input.whatsAppNumber);
      const at = now().toISOString();
      if (current) {
        store.db.prepare(`UPDATE trainer_profiles SET display_name = ?, business_time_zone = ?, whatsapp_number = ?,
          version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?`)
          .run(displayName, businessTimeZone, whatsAppNumber, at, userId, version);
      } else {
        store.db.prepare(`INSERT INTO trainer_profiles
          (user_id, display_name, business_time_zone, whatsapp_number, version, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)`)
          .run(userId, displayName, businessTimeZone, whatsAppNumber, at, at);
      }
      return this.get(userId);
    }
  };
}
