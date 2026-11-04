// Builds the email digests. Pure functions (no network), so they can be tested without Firebase or SMTP.
import { flagLead, followText, staleText, urgency, plural } from '../alerts-core.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lc = (s) => String(s || '').trim().toLowerCase();

export function flaggedLeads(leads, cfg, todayIso, tz) {
  return leads
    .map((l) => { const f = flagLead(l, cfg, todayIso, tz); return f ? { id: l.id, company: l.company || '(no name)', stage: l.stage || '', manager: l.manager || '', ...f } : null; })
    .filter(Boolean)
    .sort((a, b) => urgency(a) - urgency(b));
}

const reasons = (r) => [r.follow != null ? followText(r.follow) : '', r.stale != null ? staleText(r.stale) : ''].filter(Boolean);

// One digest per recipient. A manager gets their own leads; people in extraRecipients get everything, grouped by manager.
export function buildDigests(leads, cfg, notify, todayIso, { tz, appUrl = '', dateLabel = todayIso } = {}) {
  const rows = flaggedLeads(leads, cfg, todayIso, tz);
  const out = [];
  if (!rows.length) return { rows, digests: out };
  const full = new Set((notify.extraRecipients || []).map(lc).filter(Boolean));
  const byEmail = new Map();
  for (const r of rows) {
    const to = lc((notify.managerEmails || {})[r.manager]);
    if (!to || full.has(to)) continue;
    if (!byEmail.has(to)) byEmail.set(to, []);
    byEmail.get(to).push(r);
  }
  for (const [to, list] of byEmail) out.push(compose(to, list, { scope: 'mine', appUrl, dateLabel }));
  for (const to of full) out.push(compose(to, rows, { scope: 'all', appUrl, dateLabel }));
  return { rows, digests: out };
}

function compose(to, rows, { scope, appUrl, dateLabel }) {
  const subject = `RFID Lead Tracker: ${plural(rows.length, 'lead')} need${rows.length === 1 ? 's' : ''} attention (${dateLabel})`;
  const groups = scope === 'all' ? [...new Set(rows.map((r) => r.manager || 'Unassigned'))].sort() : [null];
  const rowHtml = (r) => `<tr><td style="padding:8px 10px;border-top:1px solid #e3e7ec"><strong>${esc(r.company)}</strong><br><span style="color:#667">${esc(r.stage)}</span></td><td style="padding:8px 10px;border-top:1px solid #e3e7ec">${reasons(r).map((w) => `<div${r.follow != null && r.follow < 0 && w.startsWith('Follow-up') ? ' style="color:#c0392b;font-weight:600"' : ''}>${esc(w)}</div>`).join('')}</td></tr>`;
  const table = (list) => `<table style="border-collapse:collapse;width:100%;font-size:14px">${list.map(rowHtml).join('')}</table>`;
  const body = groups.map((g) => {
    const list = g == null ? rows : rows.filter((r) => (r.manager || 'Unassigned') === g);
    return `${g == null ? '' : `<h3 style="margin:18px 0 4px;font-size:15px">${esc(g)} <span style="color:#667;font-weight:400">(${list.length})</span></h3>`}${table(list)}`;
  }).join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2733;max-width:640px"><h2 style="margin:0 0 4px;font-size:18px">Leads needing attention</h2><p style="margin:0 0 8px;color:#667">${esc(dateLabel)} · ${plural(rows.length, 'lead')}</p>${body}
    ${appUrl ? `<p style="margin-top:18px"><a href="${esc(appUrl)}#/alerts">Open the Alerts page</a></p>` : ''}
    <p style="color:#889;font-size:12px;margin-top:18px">You get this because you are listed in the RFID Lead Tracker alert settings. An administrator can change who receives it.</p></div>`;
  const text = [`Leads needing attention (${dateLabel})`, '', ...groups.flatMap((g) => {
    const list = g == null ? rows : rows.filter((r) => (r.manager || 'Unassigned') === g);
    return [...(g == null ? [] : [`${g} (${list.length})`]), ...list.map((r) => `- ${r.company} [${r.stage}]: ${reasons(r).join('; ')}`), ''];
  }), appUrl ? `${appUrl}#/alerts` : ''].join('\n');
  return { to, subject, html, text, count: rows.length };
}
