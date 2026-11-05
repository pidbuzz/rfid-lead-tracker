// Daily email job. Run by GitHub Actions (.github/workflows/lead-alerts.yml); can also be run by hand:
//   node notify.mjs --dry                       show what would be sent (needs the Firebase key)
//   node notify.mjs --dry --fixture file.json   same, from a local test file, no Firebase at all
// Logs only counts, never lead names, because the logs of a public repository are public.
import fs from 'node:fs';
import { mergeAlerts, todayIn } from '../alerts-core.js';
import { buildDigests } from './digest.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const COUNTS_ONLY = args.includes('--counts-only'); // never print lead names (use this on GitHub, where logs of a public repo are public)
const FORCE = args.includes('--force') || process.env.FORCE === '1';
const fixtureAt = args.indexOf('--fixture');
const TZ = process.env.TZ_NAME || 'Australia/Sydney';
const APP_URL = process.env.APP_URL || '';
const log = (...a) => console.log(...a);

async function load() {
  if (fixtureAt >= 0) {
    const f = JSON.parse(fs.readFileSync(args[fixtureAt + 1], 'utf8'));
    return { alerts: f.alerts || {}, notify: f.notify || {}, leads: f.leads || [], actions: f.actions || [], save: async () => {} };
  }
  const key = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set (see the README, "Email alerts").');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(initializeApp({ credential: cert(JSON.parse(key)) }));
  const [a, n, ls, as] = await Promise.all([db.doc('settings/alerts').get(), db.doc('adminconfig/notify').get(), db.collection('leads').get(), db.collection('actions').get()]);
  return {
    alerts: a.exists ? a.data() : {}, notify: n.exists ? n.data() : {},
    leads: ls.docs.map((d) => ({ id: d.id, ...d.data() })),
    // updatedAt is a Firestore Timestamp; hand the alert rules a plain ISO string
    actions: as.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, updatedAtIso: x.updatedAt?.toDate ? x.updatedAt.toDate().toISOString() : '' }; }),
    save: (lastRun) => (DRY ? null : db.doc('adminconfig/notify').set({ lastRun }, { merge: true })),
  };
}

async function transport() {
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set (see the README, "Email alerts").');
  const nodemailer = (await import('nodemailer')).default;
  return nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
}

async function main() {
  const { alerts, notify, leads, actions = [], save } = await load();
  const cfg = mergeAlerts(alerts), today = todayIn(TZ);
  const stamp = (status, extra = {}) => save({ at: new Date().toISOString(), status, ...extra });
  const weekday = new Intl.DateTimeFormat('en-AU', { weekday: 'short', timeZone: TZ }).format(new Date());
  if (!cfg.enabled) { log('Alerts are switched off.'); return stamp('Skipped: alerts are off'); }
  if (!notify.emailEnabled) { log('Daily email is switched off.'); return stamp('Skipped: email is off'); }
  if (notify.weekdaysOnly !== false && ['Sat', 'Sun'].includes(weekday) && !FORCE) { log(`Weekend (${weekday}): skipped.`); return stamp('Skipped: weekend'); }

  const dateLabel = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date());
  const { rows, arows, digests } = buildDigests(leads, cfg, notify, today, { tz: TZ, appUrl: APP_URL, dateLabel, actions });
  const flagged = rows.length + arows.length;
  log(`${leads.length} leads and ${actions.length} action items checked, ${rows.length} leads and ${arows.length} action items flagged, ${digests.length} email(s) to send.`);
  if (!digests.length) return stamp(flagged ? 'No recipients set for the flagged items' : 'Nothing to report', { emails: 0, flagged });

  if (DRY) { if (!COUNTS_ONLY) for (const d of digests) log(`\n--- to ${d.to}\n${d.subject}\n${d.text}`); return; }
  const tx = await transport(), from = process.env.MAIL_FROM || process.env.SMTP_USER;
  let sent = 0, failed = 0;
  for (const d of digests) {
    try { await tx.sendMail({ from, to: d.to, subject: d.subject, text: d.text, html: d.html }); sent++; }
    catch (e) { failed++; log(`Send failed (${e.code || 'error'}): ${String(e.message).replace(/[\w.+-]+@[\w.-]+/g, '<email>')}`); }
  }
  log(`Sent ${sent}, failed ${failed}.`);
  await stamp(failed ? `Finished with ${failed} failed` : 'OK', { emails: sent, flagged });
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error('Email job failed:', e.message); process.exit(1); });
