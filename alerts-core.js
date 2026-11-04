// Shared alert rules. Imported by the app (app.js) and by the daily email job (notify/notify.mjs),
// so the in-app Alerts page and the emails always agree. Plain ES module: no browser or Node specific code.

// Leads in these stages never raise alerts, whatever the settings say.
export const ALWAYS_SKIP = ['Lost', 'Lost / Disqualified', 'Completed'];

export const DEFAULT_ALERTS = {
  enabled: true,      // master switch for in-app alerts and emails
  staleDays: 14,      // alert when a lead has had no update for this many days (0 = off)
  followDays: 3,      // alert when the next follow-up is overdue or due within this many days (-1 = off)
  skipStages: ['Won', 'Completed', 'Lost'], // stages that never alert
};

export const mergeAlerts = (d = {}) => {
  const num = (v, dflt, min) => (v === '' || v == null || isNaN(Number(v)) ? dflt : Math.max(min, Math.round(Number(v))));
  return {
    enabled: d.enabled !== false,
    staleDays: num(d.staleDays, DEFAULT_ALERTS.staleDays, 0),
    followDays: num(d.followDays, DEFAULT_ALERTS.followDays, -1),
    skipStages: Array.isArray(d.skipStages) ? d.skipStages : [...DEFAULT_ALERTS.skipStages],
  };
};

// 'YYYY-MM-DD' for a moment in time, in the given IANA time zone (default: the device's own zone).
export function dateInTz(ms, tz) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (tz) opts.timeZone = tz;
  return new Intl.DateTimeFormat('en-CA', opts).format(new Date(ms));
}
export const todayIn = (tz) => dateInTz(Date.now(), tz);

// Whole calendar days from date a to date b (both 'YYYY-MM-DD'); positive when b is later.
export function dayGapBetween(a, b) {
  const p = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 864e5);
}

// The calendar date of a lead's latest update (history entries that were migrated don't count), or its logged date.
export function lastActivityDate(l, tz) {
  const t = (l.timeline || []).filter((e) => !e.migrated && e.at);
  const raw = t.length ? t[t.length - 1].at : l.date || '';
  if (!raw) return '';
  if (raw.length === 10) return raw;                       // already a plain date
  const ms = Date.parse(raw);
  return isNaN(ms) ? '' : dateInTz(ms, tz);
}

// Returns null when a lead needs no alert, otherwise { stale, follow, lastUpdate, nextFollowUp }:
//   stale  = days since the last update (or null)       follow = days until the follow-up (negative = overdue) (or null)
export function flagLead(l, cfg, todayIso, tz) {
  if (!cfg.enabled) return null;
  if (!l.stage || ALWAYS_SKIP.includes(l.stage) || cfg.skipStages.includes(l.stage)) return null;
  const last = lastActivityDate(l, tz);
  const idle = last ? dayGapBetween(last, todayIso) : null;
  const stale = cfg.staleDays > 0 && idle != null && idle >= cfg.staleDays ? idle : null;
  const fd = l.nextFollowUp ? dayGapBetween(todayIso, l.nextFollowUp) : null;
  const follow = cfg.followDays >= 0 && fd != null && fd <= cfg.followDays ? fd : null;
  if (stale == null && follow == null) return null;
  return { stale, follow, lastUpdate: last, nextFollowUp: l.nextFollowUp || '' };
}

export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const followText = (fd) => (fd < 0 ? `Follow-up overdue by ${plural(-fd, 'day')}` : fd === 0 ? 'Follow-up due today' : `Follow-up due in ${plural(fd, 'day')}`);
export const staleText = (n) => (n === 0 ? 'Updated today' : `No update for ${plural(n, 'day')}`);
// Most urgent first: overdue follow-ups, then due soon, then the longest without an update.
export const urgency = (f) => (f.follow != null ? f.follow : 1000) - (f.stale != null ? f.stale / 1000 : 0);
