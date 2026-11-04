// Run with: npm test   (no network or Firebase needed)
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { mergeAlerts, dayGapBetween, dateInTz, lastActivityDate, flagLead } from '../alerts-core.js';
import { buildDigests } from './digest.mjs';

const TODAY = '2026-11-05', TZ = 'Australia/Sydney';
const cfg = mergeAlerts({ staleDays: 14, followDays: 3 });
const L = (o) => ({ id: o.company, stage: 'Discussion', manager: 'Ann', date: '2026-10-01', timeline: [], ...o });
const upd = (at) => ({ at, type: 'update', text: 'x' });

// calendar maths
assert.equal(dayGapBetween('2026-11-01', '2026-11-05'), 4);
assert.equal(dayGapBetween('2026-11-05', '2026-11-01'), -4);
assert.equal(dayGapBetween('2026-02-28', '2026-03-01'), 1);
// 23:30 UTC on 4 Nov is already 5 Nov (10:30am) in Sydney
assert.equal(dateInTz(Date.parse('2026-11-04T23:30:00Z'), TZ), '2026-11-05');
assert.equal(lastActivityDate({ timeline: [upd('2026-10-20T23:30:00Z')] }, TZ), '2026-10-21');
assert.equal(lastActivityDate({ timeline: [{ at: '2026-10-25T00:00:00Z', migrated: true }], date: '2026-10-02' }, TZ), '2026-10-02'); // migrated entries ignored

const f = (l, c = cfg) => flagLead(l, c, TODAY, TZ);
// stale: exactly 14 days flags, 13 does not
assert.equal(f(L({ company: 'a', timeline: [upd('2026-10-22T02:00:00Z')] }))?.stale, 14);
assert.equal(f(L({ company: 'b', timeline: [upd('2026-10-23T02:00:00Z')] })), null);
// follow-up: overdue, today, in 3 days flag; in 4 days does not
assert.equal(f(L({ company: 'c', timeline: [upd('2026-11-04T02:00:00Z')], nextFollowUp: '2026-11-03' })).follow, -2);
assert.equal(f(L({ company: 'd', timeline: [upd('2026-11-04T02:00:00Z')], nextFollowUp: '2026-11-05' })).follow, 0);
assert.equal(f(L({ company: 'e', timeline: [upd('2026-11-04T02:00:00Z')], nextFollowUp: '2026-11-08' })).follow, 3);
assert.equal(f(L({ company: 'g', timeline: [upd('2026-11-04T02:00:00Z')], nextFollowUp: '2026-11-09' })), null);
// stage rules: Won skipped by default, Lost/Completed always, On Hold alerts unless ticked
const old = { timeline: [upd('2026-09-01T00:00:00Z')] };
assert.equal(f(L({ company: 'h', stage: 'Won', ...old })), null);
assert.equal(f(L({ company: 'i', stage: 'Lost', ...old })), null);
assert.equal(f(L({ company: 'j', stage: 'Completed', ...old }), mergeAlerts({ skipStages: [] })), null);
assert.ok(f(L({ company: 'k', stage: 'On Hold', ...old })));
assert.equal(f(L({ company: 'l', stage: 'On Hold', ...old }), mergeAlerts({ skipStages: ['On Hold'] })), null);
// switches
assert.equal(f(L({ company: 'm', ...old }), mergeAlerts({ enabled: false })), null);
assert.equal(f(L({ company: 'n', ...old }), mergeAlerts({ staleDays: 0 })), null);
assert.equal(f(L({ company: 'o', timeline: [upd('2026-11-04T02:00:00Z')], nextFollowUp: '2026-11-01' }), mergeAlerts({ followDays: -1 })), null);
assert.equal(mergeAlerts({ staleDays: '', followDays: undefined }).staleDays, 14);

// digests
const leads = [
  L({ company: 'Alpha <Hospital>', manager: 'Ann', nextFollowUp: '2026-11-02', timeline: [upd('2026-11-04T02:00:00Z')] }),
  L({ company: 'Beta', manager: 'Bob', ...old }),
  L({ company: 'Gamma', manager: 'Cat', ...old }),          // Cat has no email
  L({ company: 'Delta', manager: 'Ann', ...old }),
  L({ company: 'Quiet', manager: 'Ann', timeline: [upd('2026-11-04T02:00:00Z')] }), // fine
];
const notify = { managerEmails: { Ann: 'ann@x.com', Bob: 'Boss@X.com' }, extraRecipients: ['boss@x.com', 'lead@x.com'] };
const { rows, digests } = buildDigests(leads, cfg, notify, TODAY, { tz: TZ, appUrl: 'https://a.b/app/', dateLabel: 'Thu 5 Nov' });
assert.equal(rows.length, 4);
const to = digests.map((d) => d.to).sort();
assert.deepEqual(to, ['ann@x.com', 'boss@x.com', 'lead@x.com']);   // Bob's email is also in the everyone list: one email only
const ann = digests.find((d) => d.to === 'ann@x.com'), boss = digests.find((d) => d.to === 'boss@x.com');
assert.equal(ann.count, 2); assert.ok(!ann.html.includes('Beta') && !ann.html.includes('Gamma'));
assert.equal(boss.count, 4); assert.ok(boss.html.includes('Gamma') && boss.html.includes('Unassigned') === false);
assert.ok(ann.html.includes('Alpha &lt;Hospital&gt;') && !ann.html.includes('<Hospital>'));   // escaped
assert.ok(ann.html.includes('overdue by 3 days'));
assert.ok(boss.text.includes('https://a.b/app/#/alerts'));
assert.equal(buildDigests([L({ company: 'ok', timeline: [upd('2026-11-04T02:00:00Z')] })], cfg, notify, TODAY, { tz: TZ }).digests.length, 0);
// managers only (no everyone list)
const only = buildDigests(leads, cfg, { managerEmails: { Ann: 'ann@x.com' } }, TODAY, { tz: TZ });
assert.deepEqual(only.digests.map((d) => d.to), ['ann@x.com']);

// real message build through nodemailer (no sending)
const tx = nodemailer.createTransport({ jsonTransport: true });
const info = await tx.sendMail({ from: 'me@x.com', to: ann.to, subject: ann.subject, text: ann.text, html: ann.html });
assert.ok(JSON.parse(info.message).subject.includes('2 leads need attention'));
console.log('All tests passed.');
