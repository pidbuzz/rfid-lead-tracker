// Builds the email digests. Pure functions (no network), so they can be tested without Firebase or SMTP.
import { flagLead, flagAction, followText, staleText, urgency, plural } from '../alerts-core.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lc = (s) => String(s || '').trim().toLowerCase();

export function flaggedLeads(leads, cfg, todayIso, tz) {
  return leads
    .map((l) => { const f = flagLead(l, cfg, todayIso, tz); return f ? { id: l.id, company: l.company || '(no name)', stage: l.stage || '', manager: l.manager || '', ...f } : null; })
    .filter(Boolean)
    .sort((a, b) => urgency(a) - urgency(b));
}

export function flaggedActions(actions, cfg, todayIso, tz) {
  return actions
    .map((a) => { const f = flagAction(a, cfg, todayIso, tz); return f ? { id: a.id, no: a.no ?? '', title: a.title || '(no description)', owner: a.owner || '', status: a.status || '', ...f } : null; })
    .filter(Boolean)
    .sort((a, b) => urgency(a) - urgency(b));
}

const dueText = (fd) => (fd < 0 ? `Due ${plural(-fd, 'day')} ago (overdue)` : fd === 0 ? 'Due today' : `Due in ${plural(fd, 'day')}`);
const actReasons = (r) => [r.follow != null ? dueText(r.follow) : '', r.stale != null ? staleText(r.stale) : ''].filter(Boolean);
const reasons = (r) => [r.follow != null ? followText(r.follow) : '', r.stale != null ? staleText(r.stale) : ''].filter(Boolean);

// One digest per recipient. A manager gets their own leads (and the action items they own); people in extraRecipients get everything, grouped by manager / owner.
// Action items are included unless notify.includeActions is false. Owners are matched to managerEmails by name, like managers.
export function buildDigests(leads, cfg, notify, todayIso, { tz, appUrl = '', dateLabel = todayIso, actions = [] } = {}) {
  const rows = flaggedLeads(leads, cfg, todayIso, tz);
  const arows = notify.includeActions === false ? [] : flaggedActions(actions, cfg, todayIso, tz);
  const out = [];
  if (!rows.length && !arows.length) return { rows, arows, digests: out };
  const full = new Set((notify.extraRecipients || []).map(lc).filter(Boolean));
  const byEmail = new Map();
  const bucket = (to) => { if (!byEmail.has(to)) byEmail.set(to, { leads: [], acts: [] }); return byEmail.get(to); };
  for (const r of rows) {
    const to = lc((notify.managerEmails || {})[r.manager]);
    if (!to || full.has(to)) continue;
    bucket(to).leads.push(r);
  }
  for (const r of arows) {
    const to = lc((notify.managerEmails || {})[r.owner]);
    if (!to || full.has(to)) continue;
    bucket(to).acts.push(r);
  }
  for (const [to, b] of byEmail) out.push(compose(to, b.leads, b.acts, { scope: 'mine', appUrl, dateLabel }));
  for (const to of full) out.push(compose(to, rows, arows, { scope: 'all', appUrl, dateLabel }));
  return { rows, arows, digests: out };
}

function compose(to, rows, arows, { scope, appUrl, dateLabel }) {
  const counts = [rows.length ? plural(rows.length, 'lead') : '', arows.length ? plural(arows.length, 'action item') : ''].filter(Boolean).join(' and ');
  const total = rows.length + arows.length;
  const subject = `RFID Lead Tracker: ${counts} need${total === 1 ? 's' : ''} attention (${dateLabel})`;
  const TD = 'padding:8px 10px;border-top:1px solid #e3e7ec';
  const red = (bad) => (bad ? ' style="color:#c0392b;font-weight:600"' : '');
  const leadHtml = (r) => `<tr><td style="${TD}"><strong>${esc(r.company)}</strong><br><span style="color:#667">${esc(r.stage)}</span></td><td style="${TD}">${reasons(r).map((w) => `<div${red(r.follow != null && r.follow < 0 && w.startsWith('Follow-up'))}>${esc(w)}</div>`).join('')}</td></tr>`;
  const actHtml = (r) => `<tr><td style="${TD}"><strong>#${esc(r.no)} ${esc(r.title)}</strong><br><span style="color:#667">${esc(r.status)}${r.owner ? ` · ${esc(r.owner)}` : ''}</span></td><td style="${TD}">${actReasons(r).map((w) => `<div${red(w.includes('overdue'))}>${esc(w)}</div>`).join('')}</td></tr>`;
  const table = (list, row) => `<table style="border-collapse:collapse;width:100%;font-size:14px">${list.map(row).join('')}</table>`;
  const section = (heading, list, row, keyOf, none) => {
    if (!list.length) return { html: '', text: [] };
    const groups = scope === 'all' ? [...new Set(list.map((r) => keyOf(r) || none))].sort() : [null];
    const part = (g) => (g == null ? list : list.filter((r) => (keyOf(r) || none) === g));
    const html = `${heading ? `<h2 style="margin:22px 0 4px;font-size:16px">${esc(heading)}</h2>` : ''}${groups.map((g) => `${g == null ? '' : `<h3 style="margin:18px 0 4px;font-size:15px">${esc(g)} <span style="color:#667;font-weight:400">(${part(g).length})</span></h3>`}${table(part(g), row)}`).join('')}`;
    return { html, groups, part };
  };
  const L = section(arows.length ? 'Leads needing attention' : '', rows, leadHtml, (r) => r.manager, 'Unassigned');
  const A = section(rows.length ? 'Action items needing attention' : '', arows, actHtml, (r) => r.owner, 'No owner');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2733;max-width:640px">${arows.length && rows.length ? '' : `<h2 style="margin:0 0 4px;font-size:18px">${rows.length ? 'Leads' : 'Action items'} needing attention</h2>`}<p style="margin:0 0 8px;color:#667">${esc(dateLabel)} · ${counts}</p>${L.html}${A.html}
    ${appUrl ? `<p style="margin-top:18px">${rows.length ? `<a href="${esc(appUrl)}#/alerts">Open the Alerts page</a>` : ''}${rows.length && arows.length ? ' · ' : ''}${arows.length ? `<a href="${esc(appUrl)}#/actions">Open Action items</a>` : ''}</p>` : ''}
    <p style="color:#889;font-size:12px;margin-top:18px">You get this because you are listed in the RFID Lead Tracker alert settings. An administrator can change who receives it.</p></div>`;
  const textOf = (sec, list, line, head) => (!list.length ? [] : [head ? `${head}` : '', ...sec.groups.flatMap((g) => [...(g == null ? [] : [`${g} (${sec.part(g).length})`]), ...sec.part(g).map(line), ''])]);
  const text = [`${rows.length && arows.length ? 'Items' : rows.length ? 'Leads' : 'Action items'} needing attention (${dateLabel})`, '',
    ...textOf(L, rows, (r) => `- ${r.company} [${r.stage}]: ${reasons(r).join('; ')}`, arows.length ? 'LEADS' : ''),
    ...textOf(A, arows, (r) => `- #${r.no} ${r.title} [${r.status}${r.owner ? `, ${r.owner}` : ''}]: ${actReasons(r).join('; ')}`, rows.length ? 'ACTION ITEMS' : ''),
    ...(appUrl ? [rows.length ? `${appUrl}#/alerts` : '', arows.length ? `${appUrl}#/actions` : ''].filter(Boolean) : [])].join('\n');
  return { to, subject, html, text, count: total };
}
