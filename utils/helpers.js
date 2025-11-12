import EventSetting from '../models/EventSetting.js';

export async function getSetting(key) {
  const setting = await EventSetting.findOne({ key });
  return setting ? setting.value || '' : '';
}

export async function setSettings(obj = {}) {
  for (const [k, v] of Object.entries(obj)) {
    await EventSetting.findOneAndUpdate(
      { key: k },
      { key: k, value: v ?? '' },
      { upsert: true }
    );
  }
}

export function parseISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function nowISO() {
  return new Date().toISOString();
}

export async function getRound1Window() {
  const s = await getSetting('round1_start_iso');
  const e = await getSetting('round1_end_iso');
  return { startISO: s, endISO: e, start: parseISO(s), end: parseISO(e) };
}

export async function getRound2Window() {
  const s = await getSetting('round2_start_iso');
  const e = await getSetting('round2_end_iso');
  return { startISO: s, endISO: e, start: parseISO(s), end: parseISO(e) };
}

export function ensureWithinWindow(start, end) {
  const now = new Date();
  if (!start || !end) return { ok: false, code: 'WINDOW_NOT_SET', now, start, end };
  if (now < start) return { ok: false, code: 'NOT_STARTED', now, start, end };
  if (now >= end) return { ok: false, code: 'ENDED', now, start, end };
  return { ok: true, now, start, end };
}

export function ensureAfterStart(start) {
  const now = new Date();
  if (!start) return { ok: false, code: 'WINDOW_NOT_SET', now, start };
  if (now < start) return { ok: false, code: 'NOT_STARTED', now, start };
  return { ok: true, now, start };
}

