import { firebaseConfig, ADMIN_EMAIL } from './firebase-config.js';

/* =====================================================================
   Constants
   ===================================================================== */
const FB = '10.14.1';
const ROLES = ['admin', 'editor', 'viewer'];
const CURRENCIES = ['AUD', 'USD', 'NZD', 'SGD', 'MYR', 'EUR', 'GBP'];
const CUR_SYM = { AUD: 'A$', USD: 'US$', NZD: 'NZ$', SGD: 'S$', MYR: 'RM', EUR: '€', GBP: '£' };
const CLOSED_STAGES = ['Lost', 'Completed'];
const STALE_DAYS = 30;
// Idle timeout: sign out after this many minutes with no mouse, keyboard, touch or scroll activity (in any open tab of this app).
// A warning with a "Stay signed in" button appears IDLE_WARN_SECONDS before. Applies even if "Remember me" is ticked, including
// when the browser was closed and reopened later. Change IDLE_MINUTES to suit (30 = strict, 480 = a working day).
const IDLE_MINUTES = 60, IDLE_WARN_SECONDS = 60, IDLE_KEY = 'rfid-last-active';

// Permission matrix: what each role may do. Admin always can do everything (locked).
const PERM_GROUPS = [
  ['Leads', [['leads_view', 'View leads'], ['leads_create', 'Add leads'], ['leads_edit', 'Edit leads, post updates, change stage'], ['leads_delete', 'Delete leads']]],
  ['Action items', [['actions_view', 'View action items'], ['actions_create', 'Add action items'], ['actions_edit', 'Edit action items and status'], ['actions_delete', 'Delete action items']]],
  ['Audit trail', [['audit_view', 'View the audit trail']]],
];
const ADMIN_ONLY_PERMS = ['Manage users, roles and sector access', 'Edit dropdown lists', 'Import data and download backups'];
const PERM_ROLES = ['viewer', 'editor'];
const DEFAULT_PERMS = {
  viewer: { leads_view: true, leads_create: false, leads_edit: false, leads_delete: false, actions_view: true, actions_create: false, actions_edit: false, actions_delete: false, audit_view: false },
  editor: { leads_view: true, leads_create: true, leads_edit: true, leads_delete: true, actions_view: true, actions_create: true, actions_edit: true, actions_delete: true, audit_view: true },
};
const mergePerms = (d = {}) => Object.fromEntries(PERM_ROLES.map((r) => [r, { ...DEFAULT_PERMS[r], ...(d[r] || {}) }]));

const DEFAULT_LISTS = {
  stages: ['Qualifying', 'Discussion', 'POC', 'Proposal / Tender Prep', 'Submitted', 'Won', 'Implementation', 'Completed', 'On Hold', 'Lost'],
  platforms: ['Apitrak', 'Classic', 'TrackSphere', 'Centrak', 'TBC'],
  sectors: ['Healthcare', 'Industrial'],
  statuses: ['Open', 'In Progress', 'Closed', 'Info Only'],
  countries: ['Australia', 'New Zealand', 'Fiji', 'Indonesia', 'Malaysia', 'Philippines', 'Singapore', 'Thailand', 'Vietnam'],
  managers: [],
  currencies: [...CURRENCIES],
};
const STAGE_COLORS = {
  'Qualifying': '#7b8da0', 'Discussion': '#3e7cb1', 'POC': '#7a5bb5', 'Proposal / Tender Prep': '#c98a1b',
  'Submitted': '#d4691e', 'Won': '#2e8b57', 'Implementation': '#137a6e',
  'Completed': '#4c6b5a', 'On Hold': '#8c8c8c', 'Lost': '#b3534b',
};
const DEFAULT_PROBS = { 'Qualifying': 10, 'Discussion': 20, 'POC': 40, 'Proposal / Tender Prep': 40, 'Submitted': 60, 'Won': 95, 'Implementation': 100, 'Completed': 100, 'On Hold': 5, 'Lost': 0 };
const WON_STAGES = ['Won', 'Implementation', 'Completed'], LOST_STAGES = ['Lost'];
const FC_COMMIT = ['Won', 'Implementation'], EFFORT_STAGES = ['POC', 'Proposal / Tender Prep', 'Implementation'];
// Old (12-stage) names -> current stages. Used by Admin > Dropdown lists > "Move to the simplified stages", and to read old history entries.
const STAGE_MIGRATION = {
  'Qualify Lead': 'Qualifying', 'Initial Discussion': 'Discussion', 'In Discussion': 'Discussion', 'POC': 'POC',
  'Tender Preparation': 'Proposal / Tender Prep', 'Tender Submitted': 'Submitted', 'Contracted': 'Won', 'Tender Successful': 'Won',
  'Implementation': 'Implementation', 'Completed': 'Completed', 'On-Hold': 'On Hold', 'Cancelled': 'Lost', 'Tender Unsuccessful': 'Lost',
};
const OLD_TENDER_STAGES = ['Tender Preparation', 'Tender Submitted', 'Tender Successful', 'Tender Unsuccessful'];
const OLD_LOSS_REASON = { 'Cancelled': 'Cancelled', 'Tender Unsuccessful': 'Tender unsuccessful' };
const normStage = (s) => STAGE_MIGRATION[s] || s;
const EFFORT_PTS = { S: 1, M: 2, L: 3 }, LOAD_LIMIT = 6, DEAL_TYPES = ['Direct', 'Tender'], EFFORTS = ['S', 'M', 'L'];
const TENDER_STEPS = [
  ['RFI (Request for Information)', 'Customer gathers general information about available solutions, vendors, capabilities, and indicative approaches.'],
  ['RFP (Request for Proposal)', 'Customer requests a proposed solution, methodology, implementation approach, scope, timeline, and commercial proposal.'],
  ['RFQ (Request for Quotation)', 'Customer requests detailed pricing for a clearly defined scope, product, or service.'],
  ['BAFO (Best and Final Offer) (optional)', 'Final pricing and commercial negotiation stage before award.'],
  ['Contract Award / Purchase Order', 'Customer selects the preferred vendor and proceeds with contracting.'],
  ['Project Kick-off', 'Implementation commences.'],
];

/* =====================================================================
   Audit trail: what is recorded
   ===================================================================== */
const LEAD_FIELDS = [['company', 'Company'], ['stage', 'Stage'], ['date', 'Date logged'], ['sector', 'Sector'], ['platform', 'Platform'], ['country', 'Country'], ['manager', 'Account manager'],
  ['valueAmount', 'Est. value'], ['currency', 'Currency'], ['valueNotes', 'Value notes'], ['website', 'Website'], ['hubspotId', 'HubSpot Record ID'], ['nextFollowUp', 'Next follow-up'], ['expectedClose', 'Expected close'], ['probability', 'Probability %'], ['dealType', 'Deal type'], ['effort', 'Effort size'], ['lossReason', 'Loss reason'], ['contacts', 'Customer contacts'],
  ['overview', 'Project overview'], ['update', 'Latest update']];
const ACTION_FIELDS = [['title', 'Action item'], ['owner', 'Owner'], ['status', 'Status'], ['created', 'Created'], ['dueDate', 'Due'], ['comments', 'Comments']];
const FL = Object.fromEntries([...LEAD_FIELDS, ...ACTION_FIELDS, ['role', 'Role'], ['name', 'Name'], ['sectors', 'Sector access'], ['email', 'Email']]);
const LEAD_KEY = ['company', 'stage', 'sector', 'country', 'manager', 'valueAmount'];
const AUDIT_ACTIONS = { create: 'Created', update: 'Edited', stage: 'Stage change', delete: 'Deleted', role: 'Access change', settings: 'Settings', import: 'Import', export: 'Export', purge: 'Purge', login: 'Signed in' };
const AUDIT_ENTITIES = { lead: 'Lead', action: 'Action item', user: 'User', invite: 'Invite', list: 'Dropdown list', permissions: 'Permissions', data: 'Data' };
const ACT_CLS = { create: 'ok', delete: 'bad', stage: 'acc', update: 'acc', role: 'warn', settings: 'warn', import: 'warn', export: 'mute', purge: 'bad', login: 'mute' };
const clip = (v, n = 300) => { v = Array.isArray(v) ? (v.length ? v.join(', ') : 'All sectors') : v == null ? '' : String(v); return v.length > n ? v.slice(0, n) + '…' : v; };
const diffFields = (before, after, fields) => fields.filter(([k]) => clip(before?.[k], 1e9) !== clip(after?.[k], 1e9)).map(([k]) => ({ f: k, from: clip(before?.[k]), to: clip(after?.[k]) }));
const setFields = (obj, fields) => fields.filter(([k]) => clip(obj?.[k], 1e9)).map(([k]) => ({ f: k, from: '', to: clip(obj[k]) }));
const goneFields = (obj, fields) => fields.filter(([k]) => clip(obj?.[k], 1e9)).map(([k]) => ({ f: k, from: clip(obj[k]), to: '' }));
const fmtDT = (ms) => { const d = new Date(ms); return !ms || isNaN(d) ? '' : d.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

/* =====================================================================
   Tiny helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)) / 864e5) : null);
const safeUrl = (u) => {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = /^[\w-]+(\.[\w-]+)+/.test(u) ? 'https://' + u : '';
  try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : ''; } catch { return ''; }
};
const money = (n, cur = 'AUD') => {
  if (n == null || n === '' || isNaN(n)) return '';
  const sym = CUR_SYM[cur] || cur + ' ';
  const a = Math.abs(n);
  const s = a >= 1e6 ? parseFloat((n / 1e6).toFixed(2)) + 'M' : a >= 1e3 ? Math.round(n / 1e3 * 10) / 10 + 'K' : String(n);
  return sym + s;
};
// Exact amount ("A$85,000"), and the block shown on every lead: the amount, "No value" when empty, and the reporting-currency equivalent when the lead is in another currency.
const moneyFull = (n, cur = 'AUD') => (n == null || n === '' || isNaN(n) ? '' : (CUR_SYM[cur] || cur + ' ') + Number(n).toLocaleString('en-AU', { maximumFractionDigits: 2 }));
function leadValue(l) {
  const cur = l.currency || 'AUD', full = moneyFull(l.valueAmount, cur);
  if (!full) return '<span class="val-none">No value</span>';
  const b = fin().base, conv = cur !== b ? valBase(l) : null;
  return `<span class="val-main">${esc(full)}</span>${conv ? `<span class="val-sub">≈ ${esc(moneyFull(Math.round(conv), b))}</span>` : ''}${cur !== b && conv == null ? `<span class="val-sub">no ${esc(cur)} rate set</span>` : ''}`;
}
const isOpenLead = (l) => !CLOSED_STAGES.includes(l.stage);
const stageColor = (s) => STAGE_COLORS[s] || '#6b7a89';
const chip = (s) => (s ? `<span class="chip" style="--c:${stageColor(s)}">${esc(s)}</span>` : '<span class="muted">—</span>');
const uniq = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
const lastActivity = (l) => { const t = (l.timeline || []).filter((e) => !e.migrated); return t.length ? t[t.length - 1].at : l.date || ''; };
const fmtShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
};
const dayDiff = (iso) => Math.round((new Date(iso.slice(0, 10) + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The three dates shown on a lead: created (date logged), last update (latest history entry) and next follow-up.
function leadDates(l) {
  const updated = lastActivity(l), follow = l.nextFollowUp || '';
  const ago = updated ? daysSince(updated) : null;
  const fd = follow ? dayDiff(follow) : null;
  const live = isOpenLead(l);
  return {
    created: l.date || '', updated, follow, idle: ago,
    idleCls: live && ago != null ? (ago >= STALE_DAYS ? 'late' : ago >= 14 ? 'soon' : '') : '',
    updRel: ago == null ? '' : ago <= 0 ? 'today' : `${plural(ago, 'day')} ago`,
    followRel: fd == null ? '' : fd < 0 ? `${plural(-fd, 'day')} overdue` : fd === 0 ? 'due today' : `in ${plural(fd, 'day')}`,
    cls: live && fd != null ? (fd <= 0 ? 'late' : fd <= 7 ? 'soon' : '') : '',
  };
}
/* =====================================================================
   Colour by: one colour scheme shared by the Pipeline cards and the Leads rows
   ===================================================================== */
const COLOR_MODES = [['stage', 'Stage'], ['health', 'Lead health'], ['sector', 'Sector'], ['platform', 'Platform'], ['manager', 'Account manager'], ['dealType', 'Deal type']];
const COLOR_PAL = ['#4a63d8', '#e43242', '#2e8b9a', '#c98a1b', '#7a5bb5', '#2e8b57', '#d4691e', '#3e7cb1', '#b8458f', '#6b8e23', '#8a5a44', '#0f9d8a'];
const COLOR_NONE = '#9aa5b1';
const HEALTH = { red: ['#d64545', 'Needs action'], amber: ['#e0a020', 'Watch'], green: ['#2e8b57', 'On track'], grey: ['#8c8c8c', 'Closed / on hold'] };
const HEALTH_HELP = 'Needs action: follow-up due or overdue, or no update for 30+ days. Watch: follow-up within 7 days, no update for 14 to 29 days, or no expected close date. On track: none of those. Closed and On Hold leads are grey.';
const colorKey = () => `rfid-colorby:${S.user?.uid}`;
const colorBy = () => {
  if (!S.colorBy) { let v = ''; try { v = localStorage.getItem(colorKey()) || ''; } catch {} S.colorBy = COLOR_MODES.some(([k]) => k === v) ? v : 'stage'; }
  return S.colorBy;
};
function setColorBy(v) {
  if (!COLOR_MODES.some(([k]) => k === v)) return;
  S.colorBy = v; try { localStorage.setItem(colorKey(), v); } catch {}
  render();
}
function leadHealth(l) {
  if (!isOpenLead(l) || l.stage === 'On Hold') return 'grey';
  const d = leadDates(l);
  if (d.cls === 'late' || d.idleCls === 'late') return 'red';
  if (d.cls === 'soon' || d.idleCls === 'soon' || !l.expectedClose) return 'amber';
  return 'green';
}
// Every value of a field in the admin's list order, so a value keeps the same colour on both pages.
const colorValues = (mode) => {
  const src = { sector: S.lists.sectors, platform: S.lists.platforms, manager: S.lists.managers, dealType: DEAL_TYPES }[mode] || [];
  return [...new Set([...src, ...uniq(S.leads.map((l) => l[mode]))])];
};
// Returns a function: lead -> [colour, label]. Built once per render.
function colorFn(mode = colorBy()) {
  const vals = ['sector', 'platform', 'manager', 'dealType'].includes(mode) ? colorValues(mode) : [];
  return (l) => {
    if (mode === 'stage') return [stageColor(l.stage), l.stage || 'No stage'];
    if (mode === 'health') return HEALTH[leadHealth(l)];
    const v = l[mode] || '', i = v ? vals.indexOf(v) : -1;
    return [i < 0 ? COLOR_NONE : COLOR_PAL[i % COLOR_PAL.length], v || (mode === 'manager' ? 'Unassigned' : 'Not set')];
  };
}
// The "Colour by" selector plus a legend of what is on screen (with counts).
function colourBar(leads, cf) {
  const mode = colorBy(), seen = new Map();
  leads.forEach((l) => { const [c, lab] = cf(l); const e = seen.get(lab) || { c, n: 0 }; e.n++; seen.set(lab, e); });
  const ord = mode === 'stage' ? stages() : mode === 'health' ? Object.values(HEALTH).map((h) => h[1]) : colorValues(mode);
  const keys = [...seen.entries()].sort((a, b) => { const x = ord.indexOf(a[0]), y = ord.indexOf(b[0]); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); });
  return `<div class="cbar"><label>Colour by <select id="colorby" aria-label="Colour leads by">${COLOR_MODES.map(([k, t]) => `<option value="${k}" ${k === mode ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    ${keys.map(([lab, e]) => `<span class="cb-key" style="--c:${e.c}"><i></i>${esc(lab)} <span class="muted">(${e.n})</span></span>`).join('')}</div>
    ${mode === 'health' ? `<p class="muted small cb-help">${esc(HEALTH_HELP)}</p>` : ''}`;
}
const cardDates = (l) => {
  const d = leadDates(l);
  return `<div class="lc-dates">
    <div title="Date logged"><span>Created</span><b>${esc(fmtShort(d.created) || '—')}</b></div>
    <div class="${d.idleCls}" title="${esc(d.updRel ? 'Last updated ' + d.updRel : 'No updates yet')}"><span>Last updated</span><b>${esc(fmtShort(d.updated) || '—')}</b><em>${d.idle == null ? '' : d.idle <= 0 ? 'Today' : esc(plural(d.idle, 'day')) + ' ago'}</em></div>
    <div class="${d.cls}" title="${esc(d.followRel || 'No follow-up set')}"><span>Follow-up</span><b>${esc(fmtShort(d.follow) || '—')}</b></div>
  </div>`;
};
const dateTiles = (l) => {
  const d = leadDates(l);
  const tile = (k, label, iso, rel, cls = '') => `<div class="date-tile ${cls}" style="--k:${k}"><span class="dt-l">${label}</span><span class="dt-v">${esc(fmtDate(iso) || '—')}</span><span class="dt-r">${esc(rel)}</span></div>`;
  return `<div class="date-tiles">${tile('#3e7cb1', 'Created', d.created, d.created ? `${plural(Math.max(0, daysSince(d.created)), 'day')} ago` : '')}
    ${tile('#1f8a5b', 'Last update', d.updated, d.updRel ? `${d.updRel === 'today' ? 'Today' : d.updRel}` : 'No updates yet')}
    ${tile('var(--accent)', 'Next follow-up', d.follow, d.followRel || 'Not set', d.cls)}</div>`;
};

function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), err ? 6000 : 2800);
}

function toastAction(html, label, onClick, ms = 10000) {
  const t = document.createElement('div');
  t.className = 'toast rich';
  t.innerHTML = `<div class="tmsg">${html}</div><button type="button" class="tact">${esc(label)}</button><button type="button" class="tx" aria-label="Dismiss">×</button>`;
  const kill = () => t.remove();
  $('.tact', t).onclick = () => { kill(); onClick(); };
  $('.tx', t).onclick = kill;
  $('#toasts').append(t);
  setTimeout(kill, ms);
}

const FRIENDLY = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/unauthorized-domain': 'This site’s domain isn’t authorised in Firebase. Add it under Authentication > Settings > Authorized domains.',
  'auth/network-request-failed': 'Can’t reach Firebase. Check your connection.',
  'permission-denied': 'You don’t have permission to do that.',
};
const friendly = (e) => FRIENDLY[e?.code] || FRIENDLY[(e?.code || '').replace('firestore/', '')] || e?.message || 'Something went wrong.';

/* =====================================================================
   Boot: load Firebase only when configured
   ===================================================================== */
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');
const BRAND = `<div class="brand"><img class="brand-logo" src="paragon-id-logo.png" alt="Paragon ID" width="274" height="46"><span class="brand-app">RFID Lead Tracker</span></div>`;

function showGate(html) {
  $('#boot').hidden = true; $('#app').hidden = true; $('#drawer').hidden = true; $('#scrim').hidden = true;
  const g = $('#gate'); g.hidden = false; g.innerHTML = html;
}

if (!configured) {
  showGate(`<div class="card wide">${BRAND}
    <h1>Connect your Firebase project</h1>
    <p class="muted">Open <code>firebase-config.js</code>, paste your Firebase web app settings and your admin email, then reload this page. The README walks through each step.</p>
    <pre class="code">export const firebaseConfig = {
  apiKey: "…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  …
};</pre></div>`);
  throw new Error('Firebase not configured');
}

const [appMod, authMod, fsMod] = await Promise.all([
  import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
  import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
  import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`),
]);
const { initializeApp } = appMod;
const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence } = authMod;
const { getFirestore, collection, query, where, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, writeBatch, arrayUnion, deleteField, orderBy, limit, getDocs, Timestamp } = fsMod;

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* =====================================================================
   State
   ===================================================================== */
const S = {
  user: null, profile: null, leads: [], actions: [], users: [], invites: [], invitesUnsub: null, perms: mergePerms(), permDraft: null, secDraft: null, sig: '', rowUnsubs: [], leadParts: {}, lists: structuredClone(DEFAULT_LISTS),
  route: 'dashboard', openLead: null, unsubs: [], dataUnsubs: [], usersUnsub: null, listening: false, pendingName: '',
  filters: { q: '', stage: '', sector: '', country: '', manager: '', platform: '' },
  sort: { key: 'date', dir: 'desc' }, actFilter: 'active', actQ: '', hideEmpty: false, editList: null, draft: [],
  audit: [], auditUnsubs: [], auditParts: {}, auditLimit: 200, auditLoading: true, auditMore: false, auf: { q: '', entity: '', by: '', action: '', from: '', to: '' }, apg: { size: 25, page: 1, sig: '' }, auExp: new Set(), flash: null,
  pg: { rows: [], loaded: false, loading: false, busy: false, limit: 200, more: false, sel: new Set(), from: '', to: '' },
  colf: { leads: {}, actions: {}, audit: {} }, fin: null, dash: { tab: 'overview', mode: 'w', cur: 'base', sel: null, who: null, ov: { f: {}, by: 'sector', focus: 'attention', metric: 'n' }, mv: { stage: '', focus: 'attention', metric: 'n', act: 'open', q: '', all: '' } }, colOpen: null, cpAll: [], cpList: [],
};
const role = () => S.profile?.role;
const isAdmin = () => role() === 'admin';
const can = (p) => isAdmin() || !!S.perms?.[role()]?.[p];
// null = every sector; otherwise the list of sectors this user may see. Admins always see all.
const mySectors = () => (isAdmin() || !S.profile?.sectors?.length ? null : S.profile.sectors);
// The audit trail is for people whose role allows it. People limited to certain sectors only see lead entries from their own sectors.
const canAudit = () => can('audit_view');
const sectorLabel = (arr) => (!arr?.length ? 'All sectors' : arr.join(', '));

/* =====================================================================
   Auth screens
   ===================================================================== */
const GOOGLE_G = '<svg class="g-logo" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';
function passwordStrength(pw) {
  if (!pw) return { n: 0, label: '' };
  if (pw.length < 8) return { n: 1, label: 'Too short: use at least 8 characters' };
  const n = 1 + [/[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw), pw.length >= 12].filter(Boolean).length;
  return { n: Math.min(n, 4), label: ['', '', 'Okay', 'Good', 'Strong'][Math.min(n, 4)] };
}
// "Remember me": keeps the person signed in on this device and remembers their email (never the password: the browser's own
// password manager can save that securely). Unticked = signed out when the browser closes, and no email is kept.
const REM_EMAIL = 'rfid-remember-email', REM_OFF = 'rfid-remember-off';
const rememberedEmail = () => { try { return localStorage.getItem(REM_EMAIL) || ''; } catch { return ''; } };
const rememberOff = () => { try { return localStorage.getItem(REM_OFF) === '1'; } catch { return false; } };
const setKeepSignedIn = (keep) => setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
function saveRemember(keep, email) {
  try {
    if (keep) { localStorage.removeItem(REM_OFF); if (email) localStorage.setItem(REM_EMAIL, email); }
    else { localStorage.setItem(REM_OFF, '1'); localStorage.removeItem(REM_EMAIL); }
  } catch {}
}
function authHtml(mode, msg = '') {
  const reg = mode === 'register';
  const keepEmail = S.authEmail || (reg ? '' : rememberedEmail());
  return `<div class="card auth-card">${BRAND}
    <div class="auth-welcome"><h2>${reg ? 'Create your account' : 'Welcome back'}</h2><p class="muted small">${reg ? 'Sign up with your work email. An administrator will approve your access.' : 'Sign in to see your leads, pipeline and action items.'}</p></div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="${!reg}" data-mode="signin">Sign in</button>
      <button role="tab" aria-selected="${reg}" data-mode="register">Create account</button>
    </div>
    <form id="authForm" class="auth-form" novalidate>
      ${reg ? '<label class="field"><span>Full name</span><input type="text" name="name" autocomplete="name" placeholder="Your name" required></label>' : ''}
      <label class="field"><span>Email</span><input type="email" name="email" autocomplete="${reg ? 'email' : 'username'}" placeholder="you@company.com" value="${esc(keepEmail)}" required></label>
      <label class="field"><span>Password</span>
        <div class="pw"><input type="password" name="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 8 characters' : 'Your password'}" minlength="8" required>
          <button type="button" class="pw-toggle" aria-label="Show password" aria-pressed="false" title="Show password">${EYE}</button></div>
        <div class="caps-hint" id="capsHint" hidden>Caps Lock is on</div>
        ${reg ? '<div class="strength" id="strength" aria-live="polite"><div class="str-bars"><i></i><i></i><i></i><i></i></div><span class="small muted" id="strengthTxt"></span></div>' : ''}
      </label>
      ${reg ? '' : `<label class="check remember"><input type="checkbox" name="remember" ${rememberOff() ? '' : 'checked'}> <span>Remember me on this device</span></label>`}
      <div id="authMsg" aria-live="polite">${msg ? `<p class="form-note">${esc(msg)}</p>` : ''}</div>
      <button class="btn primary auth-submit" type="submit"><span class="spin" aria-hidden="true"></span><span class="lbl">${reg ? 'Create account' : 'Sign in'}</span></button>
      ${reg ? '<p class="muted small">New accounts can’t see any data until an administrator approves them.</p>' : '<button class="link-btn" type="button" id="forgot">Forgot password?</button>'}
    </form>
    <div class="divider">or</div>
    <button class="btn google-btn" id="google" type="button">${GOOGLE_G}<span class="lbl">Continue with Google</span></button>
    <p class="auth-foot muted small">Access is limited to approved Paragon ID team members.</p>
  </div>`;
}
function showAuth(mode = 'signin', msg = '') {
  const reg = mode === 'register';
  showGate(authHtml(mode, msg));
  const form = $('#authForm'), card = $('.auth-card');
  if (S.authSwitch) { card.classList.add('no-anim'); S.authSwitch = false; } // switching tabs: no re-run of the entrance animation
  // Keep the card the same height on both tabs, so nothing jumps when switching: measure the other tab off-screen and use the taller one.
  const fitCard = () => {
    if (!card.isConnected) return;
    card.style.minHeight = '';
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none;padding:0 16px;display:grid;justify-items:center';
    probe.innerHTML = authHtml(reg ? 'signin' : 'register');
    $('#gate').append(probe);
    const other = probe.firstElementChild.offsetHeight;
    probe.remove();
    card.style.minHeight = Math.max(card.offsetHeight, other) + 'px';
  };
  requestAnimationFrame(fitCard);
  document.fonts?.ready.then(fitCard);
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => { S.authEmail = form.elements.email.value; S.authSwitch = true; showAuth(b.dataset.mode); }));
  const setErr = (e) => { $('#authMsg').innerHTML = `<p class="form-error">${esc(friendly(e))}</p>`; card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); };
  const pwEl = form.elements.password;
  if (form.elements.remember) { setKeepSignedIn(form.elements.remember.checked); form.elements.remember.addEventListener('change', (e) => setKeepSignedIn(e.target.checked)); }
  // Show / hide password
  $('.pw-toggle').addEventListener('click', (ev) => {
    const show = pwEl.type === 'password';
    pwEl.type = show ? 'text' : 'password';
    ev.currentTarget.innerHTML = show ? EYE_OFF : EYE;
    ev.currentTarget.setAttribute('aria-pressed', String(show));
    ev.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    ev.currentTarget.title = show ? 'Hide password' : 'Show password';
    pwEl.focus();
  });
  // Caps Lock hint
  const caps = (e) => { if (e.getModifierState) $('#capsHint').hidden = !e.getModifierState('CapsLock'); };
  pwEl.addEventListener('keydown', caps); pwEl.addEventListener('keyup', caps); pwEl.addEventListener('blur', () => { $('#capsHint').hidden = true; });
  // Password strength (create account only)
  if (reg) pwEl.addEventListener('input', () => {
    const st = passwordStrength(pwEl.value);
    $('#strength').dataset.level = st.n; $('#strengthTxt').textContent = st.label;
  });
  // Clear the error as soon as they start fixing it
  form.addEventListener('input', () => { const m = $('#authMsg'); if (m.querySelector('.form-error')) m.innerHTML = ''; });
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('loading', on); };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const email = f.get('email').trim(), pw = f.get('password');
    S.authEmail = email;
    if (!email || !pw) return setErr({ message: 'Enter your email and password.' });
    if (reg && !f.get('name').trim()) return setErr({ message: 'Enter your name.' });
    if (reg && pw.length < 8) return setErr({ message: 'Choose a password with at least 8 characters.' });
    const btn = $('#authForm button[type=submit]'); busy(btn, true);
    try {
      if (reg) {
        S.pendingName = f.get('name').trim();
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await updateProfile(cred.user, { displayName: S.pendingName });
        await sendEmailVerification(cred.user);
      } else {
        const keep = form.elements.remember ? form.elements.remember.checked : true;
        await setKeepSignedIn(keep);
        await signInWithEmailAndPassword(auth, email, pw);
        saveRemember(keep, email);
      }
    } catch (e) { setErr(e); busy(btn, false); }
  });
  $('#forgot')?.addEventListener('click', async () => {
    const email = form.elements.email.value.trim();
    if (!email) { form.elements.email.focus(); return setErr({ message: 'Type your email above, then select “Forgot password?” again.' }); }
    try { await sendPasswordResetEmail(auth, email); $('#authMsg').innerHTML = '<p class="form-note">Password reset email sent. Check your inbox.</p>'; }
    catch (e) { setErr(e); }
  });
  $('#google').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; busy(btn, true);
    const keep = form.elements.remember ? form.elements.remember.checked : !rememberOff();
    try { const cred = await signInWithPopup(auth, new GoogleAuthProvider()); saveRemember(keep, cred.user?.email); } catch (e) { setErr(e); busy(btn, false); }
  });
  (reg ? form.elements.name : form.elements.email.value ? pwEl : form.elements.email).focus();
}

function showVerify(user) {
  showGate(`<div class="card">${BRAND}<h2>Verify your email</h2>
    <p>We sent a verification link to <strong>${esc(user.email)}</strong>. Open it, then come back and continue.</p>
    <div id="vmsg" aria-live="polite"></div>
    <button class="btn primary" id="vdone">I’ve verified my email</button>
    <div class="row"><button class="btn" id="vresend">Resend email</button><button class="btn ghost" id="vout">Sign out</button></div></div>`);
  $('#vdone').onclick = async () => {
    await user.reload(); await user.getIdToken(true);
    if (auth.currentUser.emailVerified) onAuth(auth.currentUser);
    else $('#vmsg').innerHTML = '<p class="form-error">Your email isn’t verified yet. Open the link in the email first.</p>';
  };
  $('#vresend').onclick = async () => {
    try { await sendEmailVerification(user); $('#vmsg').innerHTML = '<p class="form-note">Verification email sent again.</p>'; }
    catch (e) { $('#vmsg').innerHTML = `<p class="form-error">${esc(friendly(e))}</p>`; }
  };
  $('#vout').onclick = () => signOut(auth);
}

function showWaiting(disabled) {
  showGate(`<div class="card">${BRAND}
    <h2>${disabled ? 'Access removed' : 'Waiting for approval'}</h2>
    <p>${disabled ? 'An administrator has removed your access to this tracker.' : `You’re signed in as <strong>${esc(S.user.email)}</strong>. An administrator needs to approve your account before you can see any leads. This page updates automatically when that happens.`}</p>
    <button class="btn" id="out">Sign out</button></div>`);
  $('#out').onclick = () => signOut(auth);
}

/* =====================================================================
   Auth state + data listeners
   ===================================================================== */
function cleanup() {
  stopData();
  stopAudit();
  S.unsubs.forEach((u) => u()); S.unsubs = [];
  S.usersUnsub?.(); S.usersUnsub = null;
  S.invitesUnsub?.(); S.invitesUnsub = null; S.invites = [];
  S.listening = false; S.profile = null; S.leads = []; S.actions = []; S.users = []; S.openLead = null; S.colorBy = null;
}

/* ---- Idle timeout ---- */
const idleMs = () => IDLE_MINUTES * 60000;
const lastActive = () => { try { return Number(localStorage.getItem(IDLE_KEY)) || 0; } catch { return 0; } };
const markActive = () => { try { localStorage.setItem(IDLE_KEY, String(Date.now())); } catch {} };
const idleExpired = () => { const t = lastActive(); return t > 0 && Date.now() - t >= idleMs(); };
const idleNote = () => `You were signed out after ${IDLE_MINUTES >= 60 && IDLE_MINUTES % 60 === 0 ? plural(IDLE_MINUTES / 60, 'hour') : plural(IDLE_MINUTES, 'minute')} of inactivity. Sign in to continue.`;
const IDLE_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];
function startIdleWatch() {
  if (S.idle) return;
  if (!lastActive()) markActive();
  let lastMark = Date.now();
  const onAct = () => { const n = Date.now(); if (n - lastMark > 5000) { lastMark = n; markActive(); S.idle.warned = false; } }; // throttled: at most one write per 5 seconds
  S.idle = { warned: false, onAct, timer: setInterval(idleTick, 15000) };
  IDLE_EVENTS.forEach((e) => document.addEventListener(e, onAct, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', idleTick);
}
function stopIdleWatch() {
  if (!S.idle) return;
  clearInterval(S.idle.timer);
  IDLE_EVENTS.forEach((e) => document.removeEventListener(e, S.idle.onAct, { capture: true }));
  document.removeEventListener('visibilitychange', idleTick);
  S.idle = null;
}
function idleTick() {
  if (!S.idle || !auth.currentUser) return;
  const idle = Date.now() - (lastActive() || Date.now());
  if (idle >= idleMs()) return idleSignOut();
  if (idle >= idleMs() - IDLE_WARN_SECONDS * 1000 && !S.idle.warned) {
    S.idle.warned = true;
    toastAction(`<b>Still there?</b><span class=\"mvs\">You’ll be signed out in about ${IDLE_WARN_SECONDS} seconds because of inactivity.</span>`, 'Stay signed in', () => { markActive(); if (S.idle) S.idle.warned = false; toast('Okay, you’re still signed in.'); }, IDLE_WARN_SECONDS * 1000);
  }
}
function idleSignOut() {
  S.idleMsg = idleNote();
  ['#dlg', '#confirm'].forEach((id) => { const d = $(id); if (d?.open) d.close(); });
  closeDrawer();
  signOut(auth);
}

async function onAuth(user) {
  cleanup();
  if (!user) {
    try { sessionStorage.removeItem(`rfid-signin:${S.user?.uid}`); } catch {}
    try { localStorage.removeItem(IDLE_KEY); } catch {}
    stopIdleWatch(); S.signedIn = null; S.user = null;
    const note = S.idleMsg || ''; S.idleMsg = '';
    showAuth('signin', note); return;
  }
  if (idleExpired()) { S.idleMsg = idleNote(); signOut(auth); return; } // the browser was closed or left for longer than the idle limit
  if (user.providerData.some((p) => p.providerId === 'password') && !user.emailVerified) { S.user = user; showVerify(user); return; }
  S.user = user;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const boot = ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      // An admin may have pre-approved this email (Admin > Users > Add user).
      const inviteRef = doc(db, 'invites', user.email.toLowerCase());
      let inv = null;
      try { const is = await getDoc(inviteRef); if (is.exists() && ROLES.concat('pending').includes(is.data().role)) inv = is.data(); } catch {}
      await setDoc(ref, { email: user.email, name: inv?.name || S.pendingName || user.displayName || user.email, role: boot ? 'admin' : (inv?.role || 'pending'), ...(!boot && inv?.sectors?.length ? { sectors: inv.sectors } : {}), createdAt: serverTimestamp() });
      if (inv) { try { await deleteDoc(inviteRef); } catch {} }
    }
    S.unsubs.push(onSnapshot(ref, (s) => {
      if (!s.exists()) { setTimeout(() => auth.currentUser && onAuth(auth.currentUser), 0); return; } // profile removed by an admin: re-register as pending
      S.profile = { id: s.id, ...s.data() }; gate();
    }, (e) => toast(friendly(e), true)));
  } catch (e) {
    showGate(`<div class="card">${BRAND}<h2>Can’t load your account</h2><p class="form-error">${esc(friendly(e))}</p>
      <p class="muted small">Check that firestore.rules has been published and that this site’s domain is in Firebase Authentication > Authorized domains.</p>
      <button class="btn" id="out">Sign out</button></div>`);
    $('#out').onclick = () => signOut(auth);
  }
}
onAuthStateChanged(auth, onAuth);

// Once per browser tab session, for approved users: stamp "last seen" on the person's profile and add a "Signed in" audit entry.
function recordSignIn() {
  const uid = S.user?.uid;
  if (!uid || S.signedIn === uid) return;
  S.signedIn = uid;
  const key = `rfid-signin:${uid}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
  updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }).catch(() => {});
  commit([], [auditOp('user', uid, S.profile.name || S.user.email, 'login')]).catch(() => {});
}

function gate() {
  if (!S.profile) return;
  if (!ROLES.includes(role())) { stopData(); stopIdleWatch(); showWaiting(role() === 'disabled'); return; }
  if (!S.listening) startData(); else syncData();
  recordSignIn();
  if (isAdmin() && !S.usersUnsub) {
    S.usersUnsub = onSnapshot(collection(db, 'users'), (s) => { S.users = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (S.route === 'admin') render(); }, () => {});
  }
  if (isAdmin() && !S.invitesUnsub) {
    S.invitesUnsub = onSnapshot(collection(db, 'invites'), (s) => { S.invites = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (S.route === 'admin') render(); }, () => {});
  }
  if (!isAdmin() && S.usersUnsub) { S.usersUnsub(); S.usersUnsub = null; }
  if (!isAdmin() && S.invitesUnsub) { S.invitesUnsub(); S.invitesUnsub = null; S.invites = []; }
  $('#boot').hidden = true; $('#gate').hidden = true; $('#app').hidden = false;
  startIdleWatch();
  render();
}

function stopData() {
  stopAudit();
  S.dataUnsubs.forEach((u) => u()); S.dataUnsubs = [];
  S.rowUnsubs.forEach((u) => u()); S.rowUnsubs = []; S.leadParts = {}; S.sig = '';
  S.listening = false; S.leads = []; S.actions = [];
}

function startData() {
  stopData();
  S.listening = true;
  // A permission error here usually means access was just changed; the profile listener will re-run gate().
  S.warned = false;
  const err = (e) => { S.sig = ''; if (!S.warned) { S.warned = true; toast(friendly(e), true); } };
  S.err = err;
  S.dataUnsubs.push(onSnapshot(doc(db, 'settings', 'lists'), (s) => { S.lists = { ...structuredClone(DEFAULT_LISTS), ...(s.exists() ? s.data() : {}) }; render(); }, err));
  S.dataUnsubs.push(onSnapshot(doc(db, 'settings', 'permissions'), (s) => { S.perms = mergePerms(s.exists() ? s.data() : {}); syncData(); render(); }, err));
  S.dataUnsubs.push(onSnapshot(doc(db, 'settings', 'finance'), (s) => { S.fin = s.exists() ? s.data() : null; render(); }, err));
  syncData();
}

// Leads and action items are only subscribed to when this user's role allows it, and
// restricted users get one query per allowed sector (Firestore rules can't filter, only allow or deny a query).
function syncData() {
  if (!S.profile || !ROLES.includes(role())) return;
  const sig = JSON.stringify([role(), mySectors(), can('leads_view'), can('actions_view')]);
  if (sig === S.sig) return;
  S.sig = sig;
  stopAudit();
  S.rowUnsubs.forEach((u) => u()); S.rowUnsubs = []; S.leadParts = {}; S.leads = []; S.actions = [];
  const err = S.err || (() => {});
  const sec = mySectors();
  if (can('leads_view')) {
    const merge = () => { S.leads = Object.values(S.leadParts).flat(); render(); };
    const parts = sec ? sec.map((x) => [x, query(collection(db, 'leads'), where('sector', '==', x))]) : [['*', collection(db, 'leads')]];
    parts.forEach(([k, q]) => S.rowUnsubs.push(onSnapshot(q, (s) => { S.leadParts[k] = s.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); }, err)));
  }
  if (can('actions_view')) S.rowUnsubs.push(onSnapshot(collection(db, 'actions'), (s) => { S.actions = s.docs.map((d) => ({ id: d.id, ...d.data() })); render(); }, err));
  render();
}

/* =====================================================================
   Routing + shell
   ===================================================================== */
const ROUTES = { dashboard: 'Dashboard', pipeline: 'Pipeline', leads: 'Leads', actions: 'Action Items', reference: 'Reference', audit: 'Audit Trail', admin: 'Admin' };
function parseRoute() {
  const [r, sub = ''] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  S.route = ROUTES[r] ? r : 'dashboard';
  S.sub = S.route === 'admin' ? sub : '';
  if (S.route === 'admin' && !isAdmin()) S.route = 'dashboard';
  if (S.route === 'audit' && S.profile && S.perms && !canAudit()) S.route = 'dashboard';
}
window.addEventListener('hashchange', () => { S.colOpen = null; S.permDraft = null; S.secDraft = null; S.editList = null; S.draft = []; parseRoute(); closeDrawer(); render(); window.scrollTo(0, 0); });

const ic = (d) => `<svg class="ni" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const NAV_ICONS = {
  dashboard: ic('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  pipeline: ic('<rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/>'),
  leads: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  actions: ic('<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  reference: ic('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  admin: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  audit: ic('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>'),
  search: ic('<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>'),
  out: ic('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
};
const NAV_GROUPS = [[null, ['dashboard']], ['Sales', ['pipeline', 'leads', 'actions']], ['Resources', ['reference']], ['Configuration', ['audit', 'admin']]];

function renderNav() {
  const open = S.leads.filter(isOpenLead).length;
  const openActs = S.actions.filter((a) => !['Closed', 'Info Only'].includes(a.status)).length;
  const counts = { leads: S.leads.length, actions: openActs };
  const name = S.profile.name || S.user.email;
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';
  const link = (k) => `<a class="nav-item" href="#/${k}" ${S.route === k ? 'aria-current="page"' : ''}>${NAV_ICONS[k]}<span class="nl">${ROUTES[k]}</span>${counts[k] != null ? `<span class="count">${counts[k]}</span>` : ''}</a>`;
  const groups = NAV_GROUPS.map(([label, keys]) => [label, keys.filter((k) => (k === 'admin' ? isAdmin() : k === 'audit' ? canAudit() : true))]).filter(([, keys]) => keys.length);
  $('#nav').innerHTML = `<div class="nav-top"><div class="brand-tile"><img class="brand-logo" src="paragon-id-logo-white.png" alt="Paragon ID" width="532" height="94"></div><span class="brand-app">RFID Lead Tracker</span></div>
    <form class="nav-search" id="navSearchForm" role="search">${NAV_ICONS.search}<input type="search" id="navSearch" placeholder="Search leads…" aria-label="Search leads" autocomplete="off" value="${esc(S.navQ || '')}"></form>
    <nav class="nav-groups" aria-label="Main">${groups.map(([label, keys]) => `<div class="nav-group">${label ? `<div class="nav-label">${label}</div>` : ''}${keys.map(link).join('')}</div>`).join('')}</nav>
    <div class="spacer"></div>
    <div class="nav-live" title="Changes from your team appear instantly"><i></i>Live, synced</div>
    <div class="who"><span class="avatar" aria-hidden="true">${esc(initials)}</span><div class="who-t"><strong title="${esc(name)}">${esc(name)}</strong><span class="role-badge">${esc(role())}</span></div>
    <button class="icon-btn" id="signout" aria-label="Sign out" title="Sign out">${NAV_ICONS.out}</button></div>`;
  $('#signout').onclick = () => signOut(auth);
  $('#navSearch').oninput = (e) => { S.navQ = e.target.value; };
  $('#navSearchForm').onsubmit = (e) => {
    e.preventDefault();
    S.filters = { q: (S.navQ || '').trim(), stage: '', sector: '', country: '', manager: '', platform: '' };
    S.navQ = '';
    if (location.hash === '#/leads') render(); else location.hash = '#/leads';
  };
}

function render() {
  if (!S.profile || !ROLES.includes(role())) return;
  parseRoute();
  syncAudit();
  renderNav();
  const view = $('#view');
  const scroll = window.scrollY;
  const focusId = document.activeElement?.id;
  const pos = document.activeElement?.selectionStart;
  ({ dashboard: viewDashboard, pipeline: viewPipeline, leads: viewLeads, actions: viewActions, reference: viewReference, audit: viewAudit, admin: viewAdmin }[S.route])(view);
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } }
  window.scrollTo(0, scroll);
  renderColPop();
  if (S.openLead) { const l = S.leads.find((x) => x.id === S.openLead); l ? renderDrawer(l) : closeDrawer(); }
}

/* =====================================================================
   Derived data
   ===================================================================== */
function stages() {
  const known = S.lists.stages;
  const extra = uniq(S.leads.map((l) => l.stage)).filter((s) => !known.includes(s));
  return [...known, ...extra];
}
function needsAttention(l) {
  if (!isOpenLead(l) || l.stage === 'On Hold') return null;
  if (l.nextFollowUp && l.nextFollowUp <= today()) return `Follow-up due ${fmtDate(l.nextFollowUp)}`;
  const d = daysSince(lastActivity(l));
  if (d != null && d >= STALE_DAYS) return `No update for ${d} days`;
  return null;
}
function sumByCurrency(leads) {
  const m = {};
  leads.forEach((l) => { if (l.valueAmount) m[l.currency || 'AUD'] = (m[l.currency || 'AUD'] || 0) + Number(l.valueAmount); });
  const parts = Object.entries(m).map(([c, v]) => money(v, c));
  return parts.length ? parts.join(' + ') : '—';
}

/* =====================================================================
   Views
   ===================================================================== */
const noAccess = (what) => `<div class="page-head"><div><h1>No access</h1><p class="sub">Your role doesn’t include viewing ${what}. Ask an administrator if you need it.</p></div></div>`;
function head(title, sub, actionsHtml = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div><div class="row">${actionsHtml}</div></div>`;
}
const addLeadBtn = () => (can('leads_create') ? '<button class="btn primary" data-act="new-lead">Add lead</button>' : '');

/* ---- Overview: interactive, cross-filtering dashboard ----
   Every chart, person and card is clickable and filters the whole page (state lives in S.dash.ov.f).
   Each panel is computed from the leads matching every filter EXCEPT its own, so you can always switch selection. */
const OV_PAL = ['#4a63d8', '#e43242', '#2e8b9a', '#c98a1b', '#7a5bb5', '#2e8b57', '#d4691e', '#7b8da0'];
const OV_DIMS = [['sector', 'Sector'], ['platform', 'Platform'], ['country', 'Country'], ['dealType', 'Deal type']];
const OV_LBL = { sector: 'Sector', platform: 'Platform', country: 'Country', dealType: 'Deal type', manager: 'Manager', stage: 'Stage' };
const OV_ICO = {
  leads: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  value: ic('<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  added: ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  alert: ic('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  lost: ic('<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>'),
  tasks: ic('<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  spark: ic('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
};
const ovInit = (n) => String(n).split(/[\s@.\-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';
const ovVal = (l) => (l.valueAmount == null || l.valueAmount === '' ? 0 : valBase(l) || 0);
const ago = (iso) => { const d = -dayDiff(iso); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d}d ago` : fmtDate(iso); };
const inDays = (iso) => { const d = dayDiff(iso); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 0 ? `In ${d} days` : `${-d}d overdue`; };
const monthKeys = (n) => { const [y, m] = today().split('-').map(Number); return Array.from({ length: n }, (_, i) => { const d = new Date(y, m - 1 - (n - 1 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }); };
const monthName = (k) => new Date(k + '-01T00:00:00').toLocaleString('en-AU', { month: 'short', year: 'numeric' });

function dashOverview(el) {
  const O = S.dash.ov, F = O.f, t0 = today(), fmt = (n) => money(Math.round(n), fin().base);
  const fv = (l, k) => l[k] || (k === 'manager' ? 'Unassigned' : 'Not set');
  const scope = (except) => S.leads.filter((l) => Object.entries(F).every(([k, v]) => k === except || fv(l, k) === v));
  const L = scope(), open = L.filter(isOpenLead);
  const on = (k, v) => (F[k] === v ? ' on' : F[k] !== undefined ? ' dim' : '');
  const ovf = (k, v) => `data-ovf="${esc(k + '|' + v)}"`;

  /* ---- KPIs ---- */
  const mk = monthKeys(6), perMonth = mk.map((k) => L.filter((l) => (l.date || '').startsWith(k)).length);
  const newMonth = perMonth[5], prevMonth = perMonth[4], diff = newMonth - prevMonth;
  const attention = open.map((l) => [l, needsAttention(l)]).filter(([, r]) => r);
  const due = attention.filter(([l]) => l.nextFollowUp && l.nextFollowUp <= t0).length, stale = attention.length - due;
  const oldest = Math.max(0, ...attention.map(([l]) => (l.nextFollowUp && l.nextFollowUp <= t0 ? 0 : daysSince(lastActivity(l)) || 0)));
  const lostLeads = L.filter(isLost).sort((a, b) => ovVal(b) - ovVal(a));
  const lostVal = sumBy(lostLeads, ovVal), lostAll = sumBy(L, ovVal), lostNoRate = lostLeads.filter((l) => l.valueAmount && valBase(l) == null).length;
  const lostBy = LOST_STAGES.map((st) => [st, lostLeads.filter((l) => l.stage === st).length]).filter(([, n]) => n);
  const openActs = S.actions.filter((a) => !['Closed', 'Info Only'].includes(a.status));
  const overdue = openActs.filter((a) => a.dueDate && a.dueDate < t0).length;
  const week = openActs.filter((a) => a.dueDate && a.dueDate >= t0 && dayDiff(a.dueDate) <= 7).length;
  const doneShare = S.actions.length ? Math.round((S.actions.length - openActs.length) / S.actions.length * 100) : 0;
  const wtd = sumBy(open, (l) => ovVal(l) * probOf(l) / 100);
  const noRate = open.filter((l) => l.valueAmount && valBase(l) == null).length;
  const stg = stages(), valTotal = sumBy(open, ovVal);
  const mixOpen = stg.map((s) => [s, sumBy(open.filter((l) => l.stage === s), ovVal)]).filter(([, v]) => v > 0);
  const valStr = sumByCurrency(open);
  const spark = `<div class="spark" role="img" aria-label="Leads logged per month, last 6 months">${perMonth.map((v, i) => `<i class="${i === 5 ? 'cur' : ''}" style="height:${Math.max(10, v / Math.max(1, ...perMonth) * 100)}%" title="${esc(monthName(mk[i]))}: ${v}"></i>`).join('')}</div>`;
  const prog = (pct) => `<div class="prog" title="${pct}%"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
  const kpi = (tag, attrs, icon, v, label, sub, vis, cls = '', vstyle = '') => `<${tag} class="kpi ov-kpi ${cls}" ${attrs}><span class="ov-ico">${icon}</span><div class="v num" style="${vstyle}">${v}</div><div class="l">${label}</div><div class="ov-sub">${sub}</div><div class="ov-vis">${vis}</div></${tag}>`;
  const kpis = `<div class="kpis ov-kpis">
    ${kpi('button', 'type="button" data-kgo="ov:open" title="Click to see these leads"', OV_ICO.leads, open.length, 'Open leads', `${L.length} total${F && Object.keys(F).length ? ' in this view' : ''} · ${newMonth} new this month`, spark)}
    ${kpi('button', 'type="button" data-kgo="ov:value" title="Click to see these leads"', OV_ICO.value, esc(valStr), 'Estimated value, open leads', noRate ? `${plural(noRate, 'lead')} missing an exchange rate` : `Weighted forecast <b class="num">${esc(fmt(wtd))}</b>`,
      valTotal ? `<div class="mixbar" title="Open value by stage">${mixOpen.map(([s, v]) => `<i style="--c:${stageColor(s)};--w:${v}" title="${esc(s)}: ${esc(fmt(v))}"></i>`).join('')}</div>` : '', '', `font-size:${valStr.length > 14 ? 'var(--fs-xl)' : 'var(--fs-2xl)'}`)}
    ${kpi('button', 'type="button" data-kgo="ov:month" title="Click to see these leads"', OV_ICO.added, newMonth, 'Logged this month', diff > 0 ? `<span class="up">▲ ${diff} more</span> than last month` : diff < 0 ? `<span class="down">▼ ${-diff} fewer</span> than last month` : `Same as last month (${prevMonth})`, spark)}
    ${kpi('button', 'type="button" data-kgo="ov:attention" title="Click to see these leads"', OV_ICO.alert, attention.length, 'Need attention', attention.length ? `${due ? `${due} follow-up${due === 1 ? '' : 's'} due` : ''}${due && stale ? ' · ' : ''}${stale ? `${stale} quiet ${STALE_DAYS}+ days` : ''}${oldest > STALE_DAYS ? ` · oldest ${oldest}d` : ''}` : 'All caught up', prog(open.length ? attention.length / open.length * 100 : 0), attention.length ? 'warn' : 'ok')}
    ${kpi('button', 'type="button" data-kgo="ov:lost" title="Click to see these leads"', OV_ICO.lost, lostLeads.length, 'Lost leads', lostLeads.length ? `<b class="num">${esc(fmt(lostVal))}</b> lost · ${lostBy.map(([st, n]) => `${n} ${esc(st)}`).join(' · ')}${lostNoRate ? ` · ${plural(lostNoRate, 'lead')} missing a rate` : ''}` : 'No lost leads', prog(lostAll ? lostVal / lostAll * 100 : (L.length ? lostLeads.length / L.length * 100 : 0)))}
    ${kpi('button', 'type="button" data-kgo="ov:actions" title="Click to see these action items"', OV_ICO.tasks, openActs.length, 'Open action items', `${overdue ? `<span class="down">${overdue} overdue</span> · ` : ''}${week} due in 7 days`, prog(doneShare))}
  </div>`;

  /* ---- Filter bar + insights ---- */
  const fk = Object.entries(F);
  const insights = [];
  const stN = stg.map((s) => [s, L.filter((l) => l.stage === s).length]).sort((a, b) => b[1] - a[1])[0];
  if (stN && stN[1] && F.stage === undefined) insights.push(`<button type="button" class="ov-insight" ${ovf('stage', stN[0])}>${OV_ICO.spark}<span><b>${stN[1]}</b> of ${L.length} leads are in <b>${esc(stN[0])}</b></span></button>`);
  const mgrCount = Object.entries(open.reduce((m, l) => { const k = fv(l, 'manager'); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1])[0];
  if (mgrCount && F.manager === undefined) insights.push(`<button type="button" class="ov-insight" ${ovf('manager', mgrCount[0])}>${OV_ICO.spark}<span><b>${esc(mgrCount[0])}</b> owns the most open leads (${mgrCount[1]})</span></button>`);
  const big = [...open].sort((a, b) => ovVal(b) - ovVal(a))[0];
  if (big && ovVal(big) > 0) insights.push(`<button type="button" class="ov-insight" data-open="${esc(big.id)}">${OV_ICO.spark}<span>Biggest open deal: <b>${esc(big.company)}</b> (${esc(money(big.valueAmount, big.currency || 'AUD'))})</span></button>`);
  const bar = `<div class="ov-bar">${fk.length
    ? `<span class="ov-bar-l">Filtered by</span>${fk.map(([k, v]) => `<button type="button" class="ov-fchip" ${ovf(k, v)} title="Remove this filter">${esc(OV_LBL[k] || k)}: <b>${esc(v)}</b> ✕</button>`).join('')}<button type="button" class="ov-clear" data-ovclear>Clear all</button>`
    : `<span class="ov-bar-l">Interactive</span><span class="muted small">Click any bar, segment, person or card to filter the whole dashboard.</span>`}
    <span class="ov-bar-r"><span class="muted small">${plural(open.length, 'open lead')} · ${L.length} in view</span> <button type="button" class="btn sm" data-ovgo="leads">View in Leads</button></span></div>
    ${insights.length ? `<div class="ov-insights">${insights.join('')}</div>` : ''}`;

  /* ---- Pipeline by stage (column chart) ---- */
  const inStage = scope('stage'), mv = O.metric === 'v';
  const sc = stg.map((s) => { const a = inStage.filter((l) => l.stage === s); return [s, a.length, sumBy(a, ovVal)]; });
  const noStage = inStage.filter((l) => !l.stage);
  if (noStage.length) sc.push(['Not set', noStage.length, sumBy(noStage, ovVal)]);
  const cols = sc.filter(([s, n]) => n || F.stage === s), cmax = Math.max(1, ...cols.map(([, n, v]) => (mv ? v : n)));
  const won = L.filter(isWon).length, lost = L.filter(isLost).length;
  const winRate = won + lost ? Math.round(won / (won + lost) * 100) + '%' : '—';
  const pipeline = `<section class="panel ov-pipeline"><div class="panel-head"><div><h2>Pipeline by stage</h2><p class="muted small">${mv ? 'Value in ' + esc(fin().base) : 'Number of leads'} · click a stage to filter</p></div>
    <div class="ov-seg" role="group" aria-label="Chart measure"><button type="button" data-ovset="metric:n" aria-pressed="${!mv}">Leads</button><button type="button" data-ovset="metric:v" aria-pressed="${mv}">Value</button></div></div>
    ${cols.length ? `<div class="ov-cols">${cols.map(([s, n, v]) => `<button type="button" class="ov-col${on('stage', s)}" style="--c:${stageColor(s)}" ${ovf('stage', s)} title="${esc(s)}: ${plural(n, 'lead')} · ${esc(fmt(v))}">
      <span class="ov-colv num">${mv ? esc(fmt(v)) : n}</span><span class="ov-colbar"><i style="height:${Math.max(4, (mv ? v : n) / cmax * 100)}%"></i></span><span class="ov-coln">${esc(s)}</span><span class="ov-cols2 num">${mv ? plural(n, 'lead') : v ? esc(fmt(v)) : '—'}</span></button>`).join('')}</div>`
      : '<p class="empty">No leads match these filters.</p>'}
    <div class="ov-stats"><div><b class="num">${esc(fmt(wtd))}</b><span>Weighted pipeline</span></div><div><b class="num">${won}</b><span>Won</span></div><div><b class="num">${lost}</b><span>Lost</span></div><div><b class="num">${winRate}</b><span>Win rate</span></div></div></section>`;

  /* ---- Breakdown donut ---- */
  const dim = OV_DIMS.some(([k]) => k === O.by) ? O.by : 'sector', dimBase = scope(dim).filter(isOpenLead);
  const cnt = dimBase.reduce((m, l) => { const k = fv(l, dim); m[k] = (m[k] || 0) + 1; return m; }, {});
  const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  if (F[dim] !== undefined && !cnt[F[dim]]) rows.push([F[dim], 0]);
  const restN = rows.slice(7).reduce((a, [, n]) => a + n, 0);
  const segs = [...rows.slice(0, 7).map(([k, n], i) => ({ k, n, c: OV_PAL[i] })), ...(restN ? [{ k: 'Other', n: restN, c: OV_PAL[7], other: true }] : [])];
  const tot = dimBase.length, selSeg = segs.find((s) => s.k === F[dim]);
  const vrows = segs.filter((s) => !s.other).map((s) => [s.k, sumBy(dimBase.filter((l) => fv(l, dim) === s.k), ovVal), s.c]).filter(([, v]) => v > 0), vmax = Math.max(1, ...vrows.map((r) => r[1]));
  let off = 0;
  const arcs = segs.map((s) => {
    const p = tot ? s.n / tot * 100 : 0, len = Math.max(0, p - (segs.length > 1 ? .8 : 0)), sel = F[dim] === s.k;
    const out = `<circle class="dn-seg${F[dim] === undefined ? '' : sel ? ' on' : ' dim'}" cx="21" cy="21" r="15.9155" fill="none" stroke="${s.c}" stroke-width="${sel ? 6.5 : 5}" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${-off}" ${s.other ? '' : `${ovf(dim, s.k)} tabindex="0" role="button" aria-label="${esc(s.k)}: ${s.n} open leads"`}><title>${esc(s.k)}: ${s.n} (${Math.round(p)}%)</title></circle>`;
    off += p; return out;
  }).join('');
  const donut = `<section class="panel ov-donutp"><div class="panel-head"><div><h2>Breakdown</h2><p class="muted small">Open leads by ${esc(OV_DIMS.find(([k]) => k === dim)[1].toLowerCase())}</p></div>
    <div class="ov-seg" role="group" aria-label="Group by">${OV_DIMS.map(([k, n]) => `<button type="button" data-ovset="by:${k}" aria-pressed="${dim === k}">${n}</button>`).join('')}</div></div>
    ${tot || F[dim] !== undefined ? `<div class="ov-donut"><div class="dn-box"><svg viewBox="0 0 42 42" aria-hidden="false"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--bg)" stroke-width="5"/><g transform="rotate(-90 21 21)">${arcs}</g></svg>
      <div class="dn-c"><b class="num">${selSeg ? selSeg.n : tot}</b><span>${selSeg ? esc(selSeg.k.length > 14 ? selSeg.k.slice(0, 13) + '…' : selSeg.k) : 'open leads'}</span></div></div>
      <div class="dn-lg">${segs.map((s) => { const p = tot ? Math.round(s.n / tot * 100) : 0; const inner = `<i style="background:${s.c}"></i><span class="dn-n" title="${esc(s.k)}">${esc(s.k)}</span><b class="num">${s.n}</b><span class="muted num">${p}%</span>`; return s.other ? `<div class="dn-row">${inner}</div>` : `<button type="button" class="dn-row${on(dim, s.k)}" ${ovf(dim, s.k)}>${inner}</button>`; }).join('')}</div></div>
      <div class="ov-vbars"><h3>Pipeline value by ${esc(OV_DIMS.find(([k]) => k === dim)[1].toLowerCase())}</h3>${vrows.length ? vrows.map(([k, v, c]) => `<div class="ov-vb"><span class="dn-n" title="${esc(k)}">${esc(k)}</span><span class="track"><i style="width:${Math.max(2, v / vmax * 100)}%;background:${c}"></i></span><b class="num">${esc(fmt(v))}</b></div>`).join('') : '<p class="muted small">No values recorded for these leads yet.</p>'}</div>`
      : '<p class="empty">No open leads in this view.</p>'}</section>`;

  /* ---- Focus list (tabs) ---- */
  const byDate = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]));
  const fu = open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) >= 0 && dayDiff(l.nextFollowUp) <= 14).sort(byDate('nextFollowUp'));
  const cl = open.filter((l) => l.expectedClose && dayDiff(l.expectedClose) >= 0 && dayDiff(l.expectedClose) <= 90).sort(byDate('expectedClose'));
  const tabs = { attention: ['Attention', attention.map(([l, r]) => [l, r, '']), 'Nothing overdue. Every open lead has recent activity.'],
    lost: ['Lost', lostLeads.map((l) => [l, `${l.stage} · ${l.lossReason || 'No reason recorded'}${ovVal(l) ? ' · ' + fmt(ovVal(l)) : ''}`, '']), 'No lost leads.'],
    followups: ['Follow-ups', fu.map((l) => [l, 'Follow-up ' + fmtDate(l.nextFollowUp), inDays(l.nextFollowUp)]), 'No follow-ups scheduled in the next two weeks.'],
    closing: ['Closing', cl.map((l) => [l, `${money(l.valueAmount, l.currency || 'AUD') || 'No value'} · ${probOf(l)}%`, inDays(l.expectedClose)]), 'No expected closes in the next 90 days.'] };
  const ft = tabs[O.focus] ? O.focus : 'attention', fl = tabs[ft][1];
  const focus = `<section class="panel ov-focus" id="ov-focus"><div class="panel-head"><div><h2>Focus list</h2><p class="muted small">Attention: due or quiet ${STALE_DAYS}d+ · Lost: cancelled or tender unsuccessful · Follow-ups: next 14 days · Closing: next 90 days</p></div>
    <div class="ov-seg" role="group" aria-label="Focus list">${Object.entries(tabs).map(([k, [n, a]]) => `<button type="button" data-ovset="focus:${k}" aria-pressed="${ft === k}">${n} <span class="ov-badge${k === 'attention' && a.length ? ' warn' : ''}">${a.length}</span></button>`).join('')}</div></div>
    ${fl.length ? `<div class="list">${fl.slice(0, 6).map(([l, r, when]) => `<button type="button" class="list-item" data-open="${esc(l.id)}"><span><span class="t">${esc(l.company)}</span><br><span class="meta">${esc(l.manager || 'Unassigned')} · ${esc(r)}</span></span><span class="ov-right">${chip(l.stage)}${when ? `<span class="muted small">${esc(when)}</span>` : ''}</span></button>`).join('')}</div>
      ${fl.length > 6 ? `<p class="muted small ov-more">+ ${fl.length - 6} more · <button type="button" class="linklike" data-ovgo="leads">open the Leads table</button></p>` : ''}`
      : `<p class="empty ov-ok">${esc(tabs[ft][2])}</p>`}</section>`;

  /* ---- Team ---- */
  const mgrBase = scope('manager').filter(isOpenLead), people = {};
  mgrBase.forEach((l) => { const k = fv(l, 'manager'); (people[k] ||= []).push(l); });
  if (F.manager !== undefined && !people[F.manager]) people[F.manager] = [];
  const plist = Object.entries(people).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  const team = `<section class="panel ov-team"><div class="panel-head"><div><h2>Account managers</h2><p class="muted small">Open leads, value and stage mix · click to filter</p></div></div>
    ${plist.length ? `<div class="ov-people">${plist.map(([name, a]) => { const att = a.filter((l) => needsAttention(l)).length;
      return `<button type="button" class="ov-person${on('manager', name)}" ${ovf('manager', name)}><span class="av-sm" aria-hidden="true">${esc(ovInit(name))}</span>
        <span class="ov-pname"><b title="${esc(name)}">${esc(name)}</b><span class="meta">${esc(fmt(sumBy(a, ovVal)))}${att ? ` · <span class="warnt">${att} need attention</span>` : ''}</span></span>
        <span class="ov-mix" title="Stage mix">${stg.map((s) => [s, a.filter((l) => l.stage === s).length]).filter(([, n]) => n).map(([s, n]) => `<i style="--c:${stageColor(s)};--w:${n}" title="${esc(s)}: ${n}"></i>`).join('')}</span>
        <b class="num ov-pn">${a.length}</b></button>`; }).join('')}</div>` : '<p class="empty">No account managers in this view.</p>'}
    ${plist.length ? `<div class="ov-key">${stg.filter((s) => mgrBase.some((l) => l.stage === s)).map((s) => `<span><i style="background:${stageColor(s)}"></i>${esc(s)}</span>`).join('')}</div>` : ''}</section>`;

  /* ---- Top opportunities ---- */
  const top = [...open].filter((l) => ovVal(l) > 0).sort((a, b) => ovVal(b) * probOf(b) - ovVal(a) * probOf(a)).slice(0, 6);
  const tops = `<section class="panel"><div class="panel-head"><div><h2>Top opportunities</h2><p class="muted small">Open leads ranked by weighted value</p></div></div>
    ${top.length ? `<div class="list">${top.map((l, i) => { const p = probOf(l); return `<button type="button" class="list-item" data-open="${esc(l.id)}"><span class="ov-rank">${i + 1}</span><span class="ov-grow"><span class="t">${esc(l.company)}</span><br><span class="meta">${esc(l.manager || 'Unassigned')} · ${esc(l.stage || 'No stage')}${l.expectedClose ? ' · closes ' + esc(fmtShort(l.expectedClose)) : ''}</span></span>
      <span class="ov-right"><b class="num">${esc(money(l.valueAmount, l.currency || 'AUD'))}</b><span class="ov-probrow"><span class="ov-prob" title="Probability ${p}%"><i style="width:${p}%"></i></span><span class="muted small num">${p}%</span></span></span></button>`; }).join('')}</div>`
      : '<p class="empty">No open leads with a value yet. Add an estimated value to a lead to see it ranked here.</p>'}</section>`;

  /* ---- Recent activity ---- */
  const recent = L.flatMap((l) => (l.timeline || []).filter((t) => t.type !== 'created' && !t.migrated).map((t) => ({ l, t }))).sort((a, b) => String(b.t.at).localeCompare(String(a.t.at))).slice(0, 6);
  const feed = `<section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p class="muted small">Latest updates and stage changes</p></div></div>
    ${recent.length ? `<div class="ov-feed">${recent.map(({ l, t }) => `<button type="button" class="ov-ev" data-open="${esc(l.id)}"><i class="ov-dot ${t.type === 'stage' ? 'stage' : ''}"></i><span class="ov-grow"><span class="t">${esc(l.company)}</span><span class="meta">${esc(String(t.text || '').slice(0, 120))}${String(t.text || '').length > 120 ? '…' : ''}</span></span><span class="ov-when"><span class="small">${esc(ago(t.at))}</span><span class="muted small">${esc(t.by || '')}</span></span></button>`).join('')}</div>`
      : '<p class="empty">Updates and stage changes will appear here.</p>'}</section>`;

  const first = !S.dash.ovSeen; S.dash.ovSeen = true;
  el.innerHTML = `<div class="ov${first ? ' anim' : ''}">${S.leads.length ? `${kpis}${bar}<div class="ov-grid">${pipeline}${donut}${focus}${team}${tops}${feed}</div>` : `${kpis}<section class="panel"><p class="empty">No leads yet. Add your first lead to light up this dashboard.</p></section>`}</div>`;
}

/* =====================================================================
   Dashboard tabs: forecast, resources, performance (+ reporting currency)
   ===================================================================== */
const sumBy = (a, fn) => a.reduce((x, y) => x + fn(y), 0);
const fin = () => { const f = S.fin || {}; return { base: f.base || 'AUD', rates: f.rates || {}, probs: { ...DEFAULT_PROBS, ...(f.probs || {}) }, updated: f.updated || '' }; };
const rateOf = (c) => { const f = fin(); c = c || 'AUD'; return c === f.base ? 1 : Number(f.rates[c]) || null; };
const valBase = (l) => { if (l.valueAmount == null || l.valueAmount === '') return 0; const r = rateOf(l.currency); return r == null ? null : Number(l.valueAmount) * r; };
const probOf = (l) => (l.probability != null && l.probability !== '' ? Number(l.probability) : (fin().probs[l.stage] ?? 0));
const isWon = (l) => WON_STAGES.includes(l.stage), isLost = (l) => LOST_STAGES.includes(l.stage);
const quarterOf = (iso) => (iso && iso.length >= 7 ? `${iso.slice(0, 4)}-Q${Math.ceil(+iso.slice(5, 7) / 3)}` : 'No date');
const qLabel = (k) => (k === 'No date' ? k : `${k.slice(5)} ${k.slice(0, 4)}`);
const dayGap = (a, b) => Math.round((new Date(b.slice(0, 10)) - new Date(a.slice(0, 10))) / 864e5);
const wonAt = (l) => (l.timeline || []).find((e) => e.type === 'stage' && !e.migrated && WON_STAGES.includes(normStage(((e.text || '').split('→')[1] || '').replace('(undone)', '').trim())))?.at || null;
const pbar = (name, pct, right, attr = '') => { const t = attr ? 'button' : 'div'; return `<${t} class="bar-row" ${attr}><span class="name" title="${esc(name)}">${esc(name)}</span><span class="track"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span><span class="num">${right}</span></${t}>`; };

const DTAB_ICO = {
  overview: ic('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  mine: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  forecast: ic('<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  resources: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  performance: ic('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
};
function viewDashboard(el) {
  const D = S.dash, tabs = [['overview', 'Overview'], ['mine', 'My view'], ['forecast', 'Forecast'], ['resources', 'Resources'], ['performance', 'Performance']];
  el.innerHTML = `${head('Dashboard', `${S.leads.length} leads tracked${mySectors() ? ' · ' + mySectors().join(', ') : ''} · updated live`, addLeadBtn())}
  <div class="dtabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${D.tab === k}" data-dtab="${k}">${DTAB_ICO[k]}<span>${n}</span></button>`).join('')}</div><div id="dashBody"></div>`;
  ({ overview: dashOverview, mine: dashMine, forecast: dashForecast, resources: dashResources, performance: dashPerformance }[D.tab] || dashOverview)($('#dashBody', el));
}

const myName = () => { const p = S.profile || {}, c = [p.name, (p.email || '').split('@')[0]].filter(Boolean).map((x) => x.toLowerCase()); return (S.lists.managers || []).find((m) => c.includes(String(m).toLowerCase())) || ''; };
/* ---- My view: personal command centre (same look and cross-filtering as Overview) ---- */
const mvKpi = (tag, attrs, icon, v, label, sub, vis, cls = '') => `<${tag} class="kpi ov-kpi ${cls}" ${attrs}><span class="ov-ico">${icon}</span><div class="v num">${v}</div><div class="l">${label}</div><div class="ov-sub">${sub}</div><div class="ov-vis">${vis}</div></${tag}>`;
const mvProg = (pct) => `<div class="prog" title="${Math.round(pct)}%"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

function dashMine(el) {
  const D = S.dash, f = fin(), fmt = (n) => money(Math.round(n), f.base), t0 = today();
  const M = D.mv;
  if (D.who == null) { let w = ''; try { w = localStorage.getItem('rfid-who:' + S.user.uid) || ''; } catch {} D.who = w || myName() || '__all'; }
  const who = D.who || '__all', all = who === '__all';
  const mgrs = uniq([...(S.lists.managers || []), ...S.leads.map((l) => l.manager)]);
  const mgrOpen = (m) => S.leads.filter((l) => l.manager === m && isOpenLead(l)).length;
  const mine = S.leads.filter((l) => (all ? true : who === '__none' ? !l.manager : l.manager === who));
  const openM = mine.filter(isOpenLead); // same definition as Overview and the nav: everything except Lost and Completed
  const V = openM.filter((l) => !M.stage || l.stage === M.stage);
  const stg = stages();
  const rate = (a) => { const w = a.filter(isWon).length, n = a.filter((l) => isWon(l) || isLost(l)).length; return n ? Math.round(w / n * 100) : null; };
  const rm = rate(mine), rt = rate(S.leads), pct = (r) => (r == null ? '—' : r + '%');
  const wonL = mine.filter(isWon), lostL = mine.filter(isLost);
  const wonVals = wonL.map(valBase).filter((v) => v), avgWon = wonVals.length ? wonVals.reduce((a, b) => a + b, 0) / wonVals.length : 0;
  const att = V.map((l) => [l, needsAttention(l)]).filter(([, r]) => r);
  const due = att.filter(([l]) => l.nextFollowUp && l.nextFollowUp <= t0).length;
  const total = sumBy(V, (l) => valBase(l) || 0), wtd = sumBy(V, (l) => (valBase(l) || 0) * probOf(l) / 100);
  const commitL = V.filter((l) => FC_COMMIT.includes(l.stage)), com = sumBy(commitL, (l) => valBase(l) || 0);
  const mk = monthKeys(6), perMonth = mk.map((k) => mine.filter((l) => (l.date || '').startsWith(k)).length);
  const mix = stg.map((s) => [s, sumBy(V.filter((l) => l.stage === s), (l) => valBase(l) || 0)]).filter(([, v]) => v > 0);
  const spark = `<div class="spark" role="img" aria-label="Leads logged per month">${perMonth.map((v, i) => `<i class="${i === 5 ? 'cur' : ''}" style="height:${Math.max(10, v / Math.max(1, ...perMonth) * 100)}%" title="${esc(monthName(mk[i]))}: ${v}"></i>`).join('')}</div>`;
  const nm = all ? 'Everyone' : who === '__none' ? 'Unassigned' : who;
  const diff = rm != null && rt != null ? rm - rt : null;

  /* hero: who am I looking at (click a person to switch) */
  const pill = (val, label, n, active) => `<button type="button" class="mv-pill${active ? ' on' : ''}" data-mvwho="${esc(val)}" aria-pressed="${active}"><span class="av-sm" aria-hidden="true">${val === '__all' ? OV_ICO.leads : esc(ovInit(label))}</span><span class="mv-pn"><b>${esc(label)}</b><span>${n} open</span></span></button>`;
  const hero = `<section class="panel mv-hero"><div class="mv-who"><span class="av-lg" aria-hidden="true">${all ? OV_ICO.leads : esc(ovInit(nm))}</span><div><p class="muted small">Showing</p><h2>${esc(nm)}${!all && who === myName() ? ' <span class="ov-badge">you</span>' : ''}</h2>
    <p class="muted small">${plural(openM.length, 'open lead')} · ${esc(fmt(sumBy(openM, (l) => valBase(l) || 0)))} pipeline${M.stage ? '' : ''}</p></div></div>
    <div class="mv-pills" role="group" aria-label="Choose a person">${pill('__all', 'Everyone', S.leads.filter(isOpenLead).length, all)}${mgrs.map((m) => pill(m, m, mgrOpen(m), who === m)).join('')}</div></section>`;

  const kpis = `<div class="kpis ov-kpis">
    ${mvKpi('button', 'type="button" data-kgo="my:open" title="Click to see these leads"', OV_ICO.leads, V.length, 'Open leads', `${mine.length} total · ${perMonth[5]} logged this month`, spark)}
    ${mvKpi('button', 'type="button" data-kgo="my:value" title="Click to see these leads"', OV_ICO.value, esc(fmt(wtd)), 'Weighted pipeline', `of ${esc(fmt(total))} unweighted`, mix.length ? `<div class="mixbar">${mix.map(([s, v]) => `<i style="--c:${stageColor(s)};--w:${v}" title="${esc(s)}: ${esc(fmt(v))}"></i>`).join('')}</div>` : '')}
    ${mvKpi('button', 'type="button" data-kgo="my:committed" title="Click to see these leads"', OV_ICO.added, esc(fmt(com)), 'Committed', `${plural(commitL.length, 'lead')} contracted or in delivery`, mvProg(total ? com / total * 100 : 0))}
    ${mvKpi('button', 'type="button" data-kgo="my:attention" title="Click to see these leads"', OV_ICO.alert, att.length, 'Need follow-up', att.length ? `${due} due · ${att.length - due} quiet ${STALE_DAYS}+ days` : 'All caught up', mvProg(V.length ? att.length / V.length * 100 : 0), att.length ? 'warn' : '')}
    ${mvKpi('button', 'type="button" data-kgo="my:closed" title="Click to see these leads"', OV_ICO.tasks, pct(rm), 'Win rate', diff == null ? `Team ${pct(rt)}` : diff > 0 ? `<span class="up">▲ ${diff} pts</span> above team (${pct(rt)})` : diff < 0 ? `<span class="down">▼ ${-diff} pts</span> below team (${pct(rt)})` : `Level with team (${pct(rt)})`, mvProg(rm || 0))}
  </div>`;

  const bar = M.stage ? `<div class="ov-bar"><span class="ov-bar-l">Filtered by</span><button type="button" class="ov-fchip" data-mvset="stage:${esc(M.stage)}" title="Remove this filter">Stage: <b>${esc(M.stage)}</b> ✕</button><button type="button" class="ov-clear" data-mvset="stage:">Clear</button></div>`
    : `<div class="ov-bar"><span class="ov-bar-l">Interactive</span><span class="muted small">Click a stage to filter everything below. Click any row to open the lead. Change an action’s status right in the list.</span></div>`;

  /* pipeline chart */
  const mv = M.metric === 'v';
  const sc = stg.map((s) => { const a = openM.filter((l) => l.stage === s); return [s, a.length, sumBy(a, (l) => valBase(l) || 0)]; }).filter(([, n]) => n);
  const cmax = Math.max(1, ...sc.map(([, n, v]) => (mv ? v : n)));
  const pipeline = `<section class="panel ov-pipeline"><div class="panel-head"><div><h2>${all ? 'Pipeline by stage' : 'Pipeline by stage'}</h2><p class="muted small">${mv ? 'Value in ' + esc(f.base) : 'Number of open leads'} · click a stage to filter</p></div>
    <div class="ov-seg" role="group" aria-label="Chart measure"><button type="button" data-mvset="metric:n" aria-pressed="${!mv}">Leads</button><button type="button" data-mvset="metric:v" aria-pressed="${mv}">Value</button></div></div>
    ${sc.length ? `<div class="ov-cols">${sc.map(([s, n, v]) => `<button type="button" class="ov-col${M.stage === s ? ' on' : M.stage ? ' dim' : ''}" style="--c:${stageColor(s)}" data-mvset="stage:${esc(s)}" title="${esc(s)}: ${plural(n, 'lead')} · ${esc(fmt(v))}"><span class="ov-colv num">${mv ? esc(fmt(v)) : n}</span><span class="ov-colbar"><i style="height:${Math.max(4, (mv ? v : n) / cmax * 100)}%"></i></span><span class="ov-coln">${esc(s)}</span><span class="ov-cols2 num">${mv ? plural(n, 'lead') : v ? esc(fmt(v)) : '—'}</span></button>`).join('')}</div>` : '<p class="empty">No open leads.</p>'}</section>`;

  /* scorecard */
  const ring = rm == null ? 0 : rm;
  const score = `<section class="panel ov-donutp"><div class="panel-head"><div><h2>Scorecard</h2><p class="muted small">Closed deals, ${esc(nm)}</p></div></div>
    <div class="ov-donut"><div class="dn-box"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--bg)" stroke-width="5"/><g transform="rotate(-90 21 21)"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--ok)" stroke-width="5" ${ring ? 'stroke-linecap="round"' : ''} stroke-dasharray="${ring} ${100 - ring}"/></g></svg><div class="dn-c"><b class="num">${pct(rm)}</b><span>win rate</span></div></div>
    <div class="dn-lg"><div class="dn-row"><i style="background:var(--ok)"></i><span>Won</span><b class="num">${wonL.length}</b><span></span></div><div class="dn-row"><i style="background:var(--danger)"></i><span>Lost</span><b class="num">${lostL.length}</b><span></span></div><div class="dn-row"><i style="background:var(--muted)"></i><span>Team win rate</span><b class="num">${pct(rt)}</b><span></span></div></div></div>
    <div class="ov-stats mv-stats"><div><b class="num">${avgWon ? esc(fmt(avgWon)) : '—'}</b><span>Avg won deal</span></div><div><b class="num">${esc(fmt(com))}</b><span>Committed</span></div></div></section>`;

  /* focus list */
  const missing = V.filter((l) => !l.expectedClose || (EFFORT_STAGES.includes(l.stage) && !l.effort));
  const closing = [...V].sort((a, b) => (a.expectedClose ? 0 : 1) - (b.expectedClose ? 0 : 1) || String(a.expectedClose).localeCompare(String(b.expectedClose)));
  const why = (l) => [!l.expectedClose ? 'no close date' : '', EFFORT_STAGES.includes(l.stage) && !l.effort ? 'no effort size' : ''].filter(Boolean).join(' · ');
  const tabs = {
    attention: ['Follow up', att.map(([l, r]) => [l, r, l.nextFollowUp && l.nextFollowUp <= t0 ? inDays(l.nextFollowUp) : '']), 'Nothing overdue. Every open lead has recent activity.'],
    closing: ['Closing', closing.slice(0, 40).map((l) => [l, `${esc(l.stage || 'No stage')} · ${esc(money(l.valueAmount, l.currency || 'AUD') || 'No value')} · ${probOf(l)}%`, l.expectedClose ? inDays(l.expectedClose) : 'No close date']), 'No open leads.'],
    missing: ['Fill in', missing.map((l) => [l, `Missing: ${why(l)}`, 'Open to edit']), 'Every open lead has a close date and effort size. Forecast is in good shape.'],
  };
  const ft = tabs[M.focus] ? M.focus : 'attention', fl = tabs[ft][1], FOC_MAX = 6;
  const focus = `<section class="panel ov-focus mv-half" id="ov-focus"><div class="panel-head"><div><h2>Focus list</h2><p class="muted small">Follow up: due or quiet · Closing: by expected close · Fill in: gaps that hurt the forecast</p></div>
    <div class="ov-seg" role="group" aria-label="Focus list">${Object.entries(tabs).map(([k, [n, a]]) => `<button type="button" data-mvset="focus:${k}" aria-pressed="${ft === k}">${n} <span class="ov-badge${k === 'attention' && a.length ? ' warn' : ''}">${a.length}</span></button>`).join('')}</div></div>
    ${fl.length ? `<div class="list">${fl.slice(0, FOC_MAX).map(([l, r, when]) => `<button type="button" class="list-item" data-open="${esc(l.id)}"><span><span class="t">${esc(l.company)}</span><br><span class="meta">${all ? esc(l.manager || 'Unassigned') + ' · ' : ''}${ft === 'closing' ? r : esc(r)}</span></span><span class="ov-right">${ft === 'closing' ? '' : chip(l.stage)}${when ? `<span class="muted small">${esc(when)}</span>` : ''}</span></button>`).join('')}</div>${fl.length > FOC_MAX ? `<p class="muted small ov-more">+ ${fl.length - FOC_MAX} more · <button type="button" class="linklike" data-ovgo="leads">open the Leads table</button></p>` : ''}`
      : `<p class="empty ov-ok">${esc(tabs[ft][2])}</p>`}</section>`;

  /* action items */
  const ownerOf = (a) => (all ? true : a.owner === (who === '__none' ? '' : who));
  const acts = S.actions.filter((a) => ownerOf(a) && !['Closed', 'Info Only'].includes(a.status)).sort((a, b) => (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) || String(a.dueDate).localeCompare(String(b.dueDate)));
  const late = acts.filter((a) => a.dueDate && a.dueDate < t0), actShown = M.act === 'overdue' ? late : acts, canSet = can('actions_edit');
  const dueTag = (a) => (!a.dueDate ? '<span class="muted small">No due date</span>' : a.dueDate < t0 ? `<span class="ov-due late">${esc(inDays(a.dueDate))}</span>` : `<span class="ov-due${dayDiff(a.dueDate) <= 7 ? ' soon' : ''}">${esc(inDays(a.dueDate))}</span>`);
  const actions = `<section class="panel mv-half"><div class="panel-head"><div><h2>${all ? 'Action items' : 'My action items'}</h2><p class="muted small">${acts.length} open${late.length ? ` · <b class="warnt">${late.length} overdue</b>` : ''}</p></div>
    <div class="ov-seg" role="group" aria-label="Action filter"><button type="button" data-mvset="act:open" aria-pressed="${M.act !== 'overdue'}">Open</button><button type="button" data-mvset="act:overdue" aria-pressed="${M.act === 'overdue'}">Overdue</button></div></div>
    ${actShown.length ? `<div class="list">${actShown.slice(0, 5).map((a) => `<div class="list-item mv-act"><span class="ov-grow"><span class="t mv-clamp">${esc(a.title)}</span><span class="meta">${all && a.owner ? esc(a.owner) + ' · ' : ''}${dueTag(a)}</span></span>${canSet ? `<select class="mv-status" data-status="${esc(a.id)}" aria-label="Status">${opts(S.lists.statuses || [], a.status, false)}</select>` : `<span class="chip" style="--c:#6b7a89">${esc(a.status || '')}</span>`}</div>`).join('')}</div>
      <p class="muted small ov-more">${actShown.length > 5 ? `+ ${actShown.length - 5} more · ` : ''}<a href="#/actions">Open Action items</a></p>`
      : `<p class="empty ov-ok">${M.act === 'overdue' ? 'Nothing overdue.' : 'No open action items.'}</p>`}</section>`;

  /* all leads, searchable */
  const q = (M.q || '').trim().toLowerCase();
  const rows = V.filter((l) => !q || [l.company, l.stage, l.country, l.sector, l.platform, l.manager].some((x) => String(x || '').toLowerCase().includes(q))).sort((a, b) => (valBase(b) || 0) * probOf(b) - (valBase(a) || 0) * probOf(a));
  const shown = M.all ? rows : rows.slice(0, 8);
  const leads = `<section class="panel mv-wide"><div class="panel-head"><div><h2>${all ? 'All open leads' : 'My open leads'}</h2><p class="muted small">Ranked by weighted value · ${rows.length} shown${M.stage ? ' in ' + esc(M.stage) : ''}</p></div>
    <input type="search" id="mv-q" class="mv-search" placeholder="Search these leads…" aria-label="Search leads" value="${esc(M.q || '')}" autocomplete="off"></div>
    ${shown.length ? `<div class="mv-rows"><div class="mv-row mv-h"><span>Lead</span><span>Stage</span><span>Value</span><span>Probability</span><span>Next follow-up</span><span>Last activity</span></div>${shown.map((l) => { const p = probOf(l); return `<button type="button" class="mv-row" data-open="${esc(l.id)}"><span class="ov-grow"><span class="t">${esc(l.company)}</span><span class="meta">${esc(all ? l.manager || 'Unassigned' : l.country || '')}${l.sector ? ' · ' + esc(l.sector) : ''}</span></span><span>${chip(l.stage)}</span><b class="num">${esc(money(l.valueAmount, l.currency || 'AUD') || '—')}</b><span class="ov-probrow"><span class="ov-prob"><i style="width:${p}%"></i></span><span class="muted small num">${p}%</span></span><span class="small ${l.nextFollowUp && l.nextFollowUp <= t0 ? 'warnt' : 'muted'}">${l.nextFollowUp ? esc(inDays(l.nextFollowUp)) : '—'}</span><span class="muted small">${esc(ago(lastActivity(l)))}</span></button>`; }).join('')}</div>
      ${rows.length > 8 ? `<p class="ov-more"><button type="button" class="btn sm" data-mvset="all:${M.all ? '' : '1'}">${M.all ? 'Show fewer' : `Show all ${rows.length}`}</button></p>` : ''}` : '<p class="empty">No leads match.</p>'}</section>`;

  el.innerHTML = `<div class="ov">${hero}${kpis}${bar}<div class="ov-grid">${pipeline}${score}${focus}${actions}${leads}</div></div>`;
}

function dashForecast(el) {
  const D = S.dash, f = fin(), conv = D.cur === 'base', fmt = (n) => money(n, f.base), missing = new Set();
  const rows = S.leads.filter((l) => !isLost(l) && l.stage !== 'Completed').map((l) => {
    const v = valBase(l); if (v == null) missing.add(l.currency || 'AUD');
    const com = FC_COMMIT.includes(l.stage);
    return { l, v: v || 0, p: com ? 100 : probOf(l), q: quarterOf(l.expectedClose), com };
  });
  const com = rows.filter((r) => r.com), opn = rows.filter((r) => !r.com);
  const wv = (r, w) => r.v * (w ? r.p / 100 : 1);
  const amt = (arr, w) => (conv ? fmt(sumBy(arr, (r) => wv(r, w))) : (Object.entries(arr.reduce((m, r) => { const c = r.l.currency || 'AUD'; m[c] = (m[c] || 0) + Number(r.l.valueAmount || 0) * (w ? r.p / 100 : 1); return m; }, {})).map(([c, v]) => money(v, c)).join(' + ') || '—'));
  const qs = [...new Set(rows.map((r) => r.q))].sort((a, b) => (a === 'No date') - (b === 'No date') || a.localeCompare(b));
  const tot = (q) => ({ c: sumBy(com.filter((r) => r.q === q), (r) => r.v), o: sumBy(opn.filter((r) => r.q === q), (r) => wv(r, D.mode === 'w')) });
  const mx = Math.max(1, ...qs.map((q) => { const t = tot(q); return t.c + t.o; }));
  const stg = stages().filter((s) => !LOST_STAGES.includes(s) && s !== 'Completed').map((s) => [s, rows.filter((r) => r.l.stage === s)]).filter(([, x]) => x.length);
  const smx = Math.max(1, ...stg.map(([, x]) => sumBy(x, (r) => r.v)));
  const sel = D.sel, list = !sel ? [] : rows.filter((r) => (sel.startsWith('q:') ? r.q === sel.slice(2) : r.l.stage === sel.slice(2)));
  const noDate = opn.filter((r) => r.q === 'No date').length;
  const btn = (attr, on, label) => `<button class="btn sm ${on ? 'primary' : ''}" ${attr}>${label}</button>`;
  el.innerHTML = `${missing.size ? `<div class="admin-banner" style="margin-bottom:14px"><b>No exchange rate for ${esc([...missing].join(', '))}.</b> Those leads count as zero in reporting-currency totals.${isAdmin() ? ' <a href="#/admin/finance">Set rates ›</a>' : ' Ask an administrator to set them.'}</div>` : ''}
  <div class="row" style="margin-bottom:14px;gap:8px;flex-wrap:wrap"><span class="muted small">Currency</span>${btn('data-dcur="base"', conv, esc(f.base) + ' (converted)')}${btn('data-dcur="orig"', !conv, 'Original currencies')}
    <span class="muted small" style="margin-left:12px">Open pipeline</span>${btn('data-dmode="w"', D.mode === 'w', 'Weighted')}${btn('data-dmode="u"', D.mode === 'u', 'Unweighted')}</div>
  <div class="kpis"><div class="kpi"><div class="v num">${esc(amt(com, true))}</div><div class="l">Committed (contracted or won)</div></div>
    <div class="kpi"><div class="v num">${esc(amt(opn, true))}</div><div class="l">Weighted open pipeline</div></div>
    <div class="kpi"><div class="v num">${esc(amt(opn, false))}</div><div class="l">Unweighted open pipeline</div></div>
    <div class="kpi"><div class="v num">${esc(amt(rows, true))}</div><div class="l">Forecast (committed + weighted)</div></div></div>
  <section class="panel"><div class="panel-head"><h2>Forecast by expected close</h2><span class="muted small">${conv ? 'Select a quarter to list its leads' : 'Bars use the reporting currency. Switch Currency to see them.'}</span></div>
    ${conv && qs.length ? `<div class="legend"><span><i style="--c:var(--accent)"></i>Committed</span><span><i style="--c:var(--accent);opacity:.4"></i>${D.mode === 'w' ? 'Weighted' : 'Unweighted'} open</span></div><div class="bars wide">${qs.map((q) => { const t = tot(q); return `<button class="bar-row fc-row ${sel === 'q:' + q ? 'sel' : ''}" data-dsel="q:${esc(q)}"><span class="name">${esc(qLabel(q))}</span><span class="track"><i class="c" style="width:${t.c / mx * 100}%"></i><i class="o" style="width:${t.o / mx * 100}%"></i></span><span class="num">${esc(fmt(t.c + t.o))}</span></button>`; }).join('')}</div>` : conv ? '<p class="empty">No open leads with a value yet.</p>' : ''}
    ${noDate ? `<p class="muted small" style="margin-top:10px">${plural(noDate, 'open lead')} ha${noDate === 1 ? 's' : 've'} no expected close date and show under “No date”. Add one on the lead.</p>` : ''}</section>
  <section class="panel"><div class="panel-head"><h2>Open pipeline by stage</h2><span class="muted small">Select a stage to list its leads</span></div>
    <div class="bars wide">${stg.map(([s, x]) => pbar(s, sumBy(x, (r) => r.v) / smx * 100, `${x.length}${conv ? ' · ' + esc(fmt(sumBy(x, (r) => r.v))) : ''}`, `data-dsel="s:${esc(s)}"`)).join('') || '<p class="empty">No data yet.</p>'}</div></section>
  ${sel ? `<section class="panel"><div class="panel-head"><h2>${esc(sel.startsWith('q:') ? qLabel(sel.slice(2)) : sel.slice(2))}</h2><button class="btn ghost sm" data-dsel="">Clear</button></div><div class="table-wrap"><table><thead><tr><th>Company</th><th>Stage</th><th>Owner</th><th>Expected close</th><th class="ta-r">Value</th><th class="ta-r">Prob.</th></tr></thead><tbody>
    ${list.map((r) => `<tr data-open="${r.l.id}"><td class="co">${esc(r.l.company)}</td><td>${chip(r.l.stage)}</td><td>${esc(r.l.manager || 'Unassigned')}</td><td>${esc(fmtShort(r.l.expectedClose) || '—')}</td><td class="ta-r num">${esc(money(r.l.valueAmount, r.l.currency || 'AUD') || '—')}${(r.l.currency || 'AUD') !== f.base && r.v ? `<div class="muted small">≈ ${esc(fmt(r.v))}</div>` : ''}</td><td class="ta-r num">${r.p}%${r.l.probability != null && r.l.probability !== '' ? ' <span class="muted small">set</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No leads.</td></tr>'}</tbody></table></div></section>` : ''}
  ${f.updated ? `<p class="muted small" style="margin-top:12px">Rates last updated ${esc(fmtDate(f.updated))}.</p>` : ''}`;
}

function dashResources(el) {
  const f = fin(), fmt = (n) => money(n, f.base), t0 = today();
  const live = S.leads.filter((l) => !isLost(l) && l.stage !== 'Completed' && l.stage !== 'On Hold');
  const names = [...new Set([...live.map((l) => l.manager || 'Unassigned'), ...S.actions.map((a) => a.owner).filter(Boolean)])].sort();
  const rows = names.map((m) => {
    const mine = live.filter((l) => (l.manager || 'Unassigned') === m), heavy = mine.filter((l) => EFFORT_STAGES.includes(l.stage));
    const acts = S.actions.filter((a) => a.owner === m && !['Closed', 'Info Only'].includes(a.status));
    return { m, n: mine.length, w: sumBy(mine, (l) => (valBase(l) || 0) * (FC_COMMIT.includes(l.stage) ? 100 : probOf(l)) / 100), heavy: heavy.length, pts: sumBy(heavy, (l) => EFFORT_PTS[l.effort] || 2), acts: acts.length, late: acts.filter((a) => a.dueDate && a.dueDate < t0).length };
  });
  const mx = Math.max(1, ...rows.map((r) => r.w)), unsized = live.filter((l) => EFFORT_STAGES.includes(l.stage) && !l.effort).length;
  el.innerHTML = `<div class="kpis"><div class="kpi"><div class="v num">${sumBy(rows, (r) => r.n)}</div><div class="l">Live leads (excl. on-hold)</div></div>
    <div class="kpi"><div class="v num">${sumBy(rows, (r) => r.heavy)}</div><div class="l">In POC, tender prep or implementation</div></div>
    <div class="kpi"><div class="v num" style="${rows.some((r) => r.late) ? 'color:var(--warn)' : ''}">${sumBy(rows, (r) => r.late)}</div><div class="l">Overdue action items</div></div></div>
  <section class="panel"><div class="panel-head"><h2>Load by person</h2><span class="muted small">Weighted pipeline in ${esc(f.base)}. Select a person to see their leads.</span></div>
    ${rows.length ? `<div class="bars wide">${rows.map((r) => `<div>${pbar(r.m, r.w / mx * 100, esc(fmt(r.w)), `data-dmgr="${esc(r.m)}"`)}<div class="muted small" style="margin:2px 0 8px 140px">${plural(r.n, 'live lead')} · ${r.heavy} effort-heavy (${r.pts} pts) · ${plural(r.acts, 'open action')}${r.late ? ` · <b style="color:var(--warn)">${r.late} overdue</b>` : ''}${r.pts >= LOAD_LIMIT ? ' <span class="tag-warn">High load</span>' : ''}</div></div>`).join('')}</div>` : '<p class="empty">No data yet.</p>'}
    <p class="muted small" style="margin-top:8px">Effort points: S = 1, M = 2, L = 3 (blank counts as M), flagged at ${LOAD_LIMIT} or more.${unsized ? ` ${plural(unsized, 'effort-heavy lead')} ha${unsized === 1 ? 's' : 've'} no effort size set.` : ''}</p></section>`;
}

function dashPerformance(el) {
  const closed = S.leads.filter((l) => isWon(l) || isLost(l)), won = closed.filter(isWon), lost = closed.filter(isLost), f = fin();
  const rate = (a) => { const w = a.filter(isWon).length, n = a.filter((l) => isWon(l) || isLost(l)).length; return n ? Math.round(w / n * 100) : null; };
  const grp = (key, title) => { const vals = uniq(S.leads.map((l) => l[key] || 'Unassigned').concat(S.leads.some((l) => !l[key]) ? [] : [])); const r = vals.map((v) => { const a = S.leads.filter((l) => (l[key] || 'Unassigned') === v); return [v, rate(a), a.filter((l) => isWon(l) || isLost(l)).length]; }).filter(([, p]) => p != null);
    return `<section class="panel"><div class="panel-head"><h2>${title}</h2></div>${r.length ? `<div class="bars wide">${r.map(([v, p, n]) => pbar(v, p, `${p}% <span class="muted small">of ${n}</span>`)).join('')}</div>` : '<p class="empty">No closed leads yet.</p>'}</section>`; };
  const days = won.map((l) => { const at = wonAt(l); return at && l.date ? dayGap(l.date, at) : null; }).filter((x) => x != null && x >= 0);
  const wonBase = won.map(valBase).filter((v) => v), reasons = Object.entries(lost.reduce((m, l) => { const k = l.lossReason || 'Not recorded'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `<div class="kpis"><div class="kpi"><div class="v num">${rate(S.leads) == null ? '—' : rate(S.leads) + '%'}</div><div class="l">Win rate</div></div>
    <div class="kpi"><div class="v num">${won.length} / ${lost.length}</div><div class="l">Won / lost</div></div>
    <div class="kpi"><div class="v num">${wonBase.length ? esc(money(sumBy(wonBase, (v) => v) / wonBase.length, f.base)) : '—'}</div><div class="l">Average won deal</div></div>
    <div class="kpi"><div class="v num">${days.length ? Math.round(sumBy(days, (d) => d) / days.length) + ' d' : '—'}</div><div class="l">Average days to win${days.length ? ` (${days.length} deals)` : ''}</div></div></div>
  <p class="muted small" style="margin:-8px 0 14px">Won = Won, Implementation, Completed. Lost = Lost. Days to win uses the stage history, so leads imported without history are left out.</p>
  <div class="dash-grid">${grp('dealType', 'Win rate by deal type')}${grp('sector', 'Win rate by sector')}</div>
  <div class="dash-grid" style="margin-top:16px">${grp('manager', 'Win rate by account manager')}${grp('country', 'Win rate by country')}</div>
  <section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Why leads were lost</h2></div>${reasons.length ? `<div class="bars wide">${reasons.map(([k, n]) => pbar(k, n / lost.length * 100, String(n))).join('')}</div>` : '<p class="empty">No lost leads yet.</p>'}</section>`;
}

const financePanel = () => { const f = fin(), cur = S.lists.currencies || CURRENCIES;
  return `<section class="panel"><div class="panel-head"><div><h2>Reporting currency</h2><p class="muted small">Dashboard totals and forecasts are converted to this currency. Changing it clears the exchange rates below, so set them again after saving.</p></div></div>
  <label class="field" style="max-width:220px"><span>Reporting currency</span><select id="fin-base">${cur.map((c) => `<option ${c === f.base ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
  <h3 style="margin:20px 0 4px">Exchange rates</h3><p class="muted small">How much one unit of each currency is worth in ${esc(f.base)}. ${f.updated ? 'Last updated ' + esc(fmtDate(f.updated)) + '.' : 'Not set yet.'} Leads in a currency with no rate count as zero until you add it.</p>
  <div class="fin-grid">${cur.filter((c) => c !== f.base).map((c) => `<label class="field"><span>1 ${esc(c)} =</span><input type="number" min="0" step="any" data-fr="${esc(c)}" value="${f.rates[c] ?? ''}" placeholder="${esc(f.base)}"></label>`).join('') || '<p class="muted">No other currencies.</p>'}</div>
  <h3 style="margin:20px 0 4px">Stage probabilities</h3><p class="muted small">Default chance of winning for a lead at each stage (0 to 100). A lead can override this on its own form.</p>
  <div class="fin-grid">${stages().map((s) => `<label class="field"><span>${esc(s)}</span><input type="number" min="0" max="100" step="1" data-fp="${esc(s)}" value="${f.probs[s] ?? 0}"></label>`).join('')}</div>
  <div class="row" style="margin-top:16px"><button class="btn primary" data-act="save-fin">Save forecast settings</button></div></section>`; };
async function saveFin() {
  const f = fin(), base = $('#fin-base').value, rates = {}, probs = {};
  $$('[data-fr]').forEach((i) => { const v = Number(i.value); if (i.value !== '' && v > 0) rates[i.dataset.fr] = v; });
  $$('[data-fp]').forEach((i) => { const v = Math.round(Number(i.value)); probs[i.dataset.fp] = Math.min(100, Math.max(0, isNaN(v) ? 0 : v)); });
  const same = base === f.base, nr = same ? rates : {}, lc = [];
  if (!same) lc.push({ f: 'Reporting currency', from: f.base, to: base, });
  if (same) Object.keys({ ...f.rates, ...nr }).forEach((c) => { if (String(f.rates[c] ?? '') !== String(nr[c] ?? '')) lc.push({ f: `Rate ${c}`, from: clip(f.rates[c]), to: clip(nr[c]) }); });
  Object.keys(probs).forEach((s) => { if (probs[s] !== f.probs[s]) lc.push({ f: `Probability: ${s}`, from: String(f.probs[s] ?? ''), to: String(probs[s]) }); });
  if (!lc.length) return toast('No changes to save.');
  if (!await confirmBox('Save forecast settings', `Save these changes to the forecast settings?\n\n${chText(lc)}${same ? '' : '\n\nChanging the reporting currency clears the exchange rates.'}`, 'Save')) return;
  const ok = await run(async () => { await setDoc(doc(db, 'settings', 'finance'), { base, rates: nr, probs, updated: today() }); await commit([], [auditOp('list', 'finance', 'Forecast settings', 'settings', lc)]); }, same ? 'Forecast settings saved' : `Reporting currency is now ${base}. Set its exchange rates next.`);
  if (ok) render();
}

function viewPipeline(el) {
  if (!can('leads_view')) return void (el.innerHTML = noAccess('leads'));
  const prevLeft = $('.board', el)?.scrollLeft || 0;
  const stg = stages().filter((s) => !S.hideEmpty || S.leads.some((l) => l.stage === s));
  const cf = colorFn(), cmode = colorBy();
  el.innerHTML = `${head('Pipeline', can('leads_edit') ? 'Drag a card to another column to change its stage. Scroll sideways to see all stages.' : 'Leads grouped by stage. Scroll sideways to see all stages.',
    `<label class="row small" style="gap:6px;cursor:pointer"><input type="checkbox" id="hideEmpty" ${S.hideEmpty ? 'checked' : ''}> Hide empty stages</label>${addLeadBtn()}`)}
  ${colourBar(S.leads, cf)}
  <div class="board-wrap"><button class="board-nav prev" data-scroll="-1" aria-label="Scroll to earlier stages">&#8249;</button><button class="board-nav next" data-scroll="1" aria-label="Scroll to later stages">&#8250;</button>
  <div class="board">${stg.map((s) => {
    const ls = S.leads.filter((l) => l.stage === s).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `<section class="col${S.flash?.to === s ? ' flash' : ''}" data-stage="${esc(s)}" style="--c:${stageColor(s)}" aria-label="${esc(s)}">
      <div class="col-head"><h3>${esc(s)} <span class="col-count num" title="${plural(ls.length, 'lead')}" aria-label="${plural(ls.length, 'lead')}">(${ls.length})</span></h3><span class="sum num">${ls.some((l) => l.valueAmount) ? esc(sumByCurrency(ls)) : ''}</span></div>
      <div class="col-body">${ls.map((l) => `<div class="lead-card${S.flash?.id === l.id ? ' just-moved' : ''}" style="--c:${cf(l)[0]}" title="${esc(cf(l)[1])}" role="button" tabindex="0" data-open="${l.id}" ${can('leads_edit') ? 'draggable="true"' : ''} data-id="${l.id}">
        ${S.flash?.id === l.id ? `<div class="moved-note">${S.flash.undone ? 'Moved back' : 'Moved'} from <b>${esc(S.flash.from)}</b> · just now</div>` : ''}
        <div class="lc-top"><div class="t">${esc(l.company)}</div></div>
        ${cmode !== 'stage' ? `<div class="cb-tag" style="--c:${cf(l)[0]}"><i></i>${esc(cf(l)[1])}</div>` : ''}
        <div class="lc-value num">${leadValue(l)}</div>
        <div class="meta"><span>${esc(l.country || '')}</span><span>${esc(l.manager || 'Unassigned')}</span></div>
        ${l.hubspotId ? `<div class="lc-hs">HubSpot ${esc(l.hubspotId)}</div>` : ''}
        ${cardDates(l)}
        ${(needsAttention(l) || '').startsWith('Follow-up') ? `<div style="margin-top:8px"><span class="tag-warn">${esc(needsAttention(l))}</span></div>` : ''}
      </div>`).join('') || '<p class="muted small" style="padding:6px 4px">No leads</p>'}</div></section>`;
  }).join('')}</div></div>`;
  const board = $('.board', el), wrap = $('.board-wrap', el);
  const sync = () => { const max = board.scrollWidth - board.clientWidth; wrap.classList.toggle('can-left', board.scrollLeft > 4); wrap.classList.toggle('can-right', board.scrollLeft < max - 4); };
  board.scrollLeft = prevLeft; sync();
  board.addEventListener('scroll', sync, { passive: true });
  new ResizeObserver(sync).observe(board);
  if (!can('leads_edit')) return;
  let dragId = null;
  $$('.lead-card', el).forEach((c) => {
    c.addEventListener('dragstart', (e) => { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
  });
  $$('.col', el).forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain') || dragId; const lead = S.leads.find((l) => l.id === id);
      if (lead && lead.stage !== col.dataset.stage) {
        const from = lead.stage || '', to = col.dataset.stage;
        if (!await confirmBox('Move lead', `Move “${lead.company}” from ${from || 'No stage'} to ${to}?`, 'Move')) return;
        if (await changeStage(lead, to, { quiet: true })) announceMove(lead, from, to);
      }
    });
  });
}

/* =====================================================================
   Column header filters (search + pick values, per column)
   ===================================================================== */
const COLV = {
  leads: { company: (l) => l.company || '', stage: (l) => l.stage || '', sector: (l) => l.sector || '', platform: (l) => l.platform || '', country: (l) => l.country || '', manager: (l) => l.manager || '', hubspotId: (l) => l.hubspotId || '',
    valueAmount: (l) => (l.valueAmount ? moneyFull(l.valueAmount, l.currency || 'AUD') : ''), update: (l) => l.update || '', date: (l) => fmtDate(l.date) },
  audit: { when: (a) => (a.at ? new Date(a.at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : ''), who: (a) => a.byName || a.by || '',
    what: (a) => `${AUDIT_ACTIONS[a.action] || a.action} · ${AUDIT_ENTITIES[a.entity] || a.entity}`, item: (a) => a.label || '',
    changes: (a) => [...(a.changes || []).map((c) => `${FL[c.f] || c.f}: ${c.from || '(empty)'} → ${c.to || '(empty)'}`), a.note || ''].filter(Boolean).join('; ') },
  actions: { no: (a) => String(a.no ?? ''), title: (a) => a.title || '', owner: (a) => a.owner || '', status: (a) => a.status || 'Open', created: (a) => fmtDate(a.created), dueDate: (a) => fmtDate(a.dueDate), comments: (a) => a.comments || '' },
};
const COLSORT = { audit: { when: (a) => -a.at }, leads: { valueAmount: (l) => Number(l.valueAmount) || 0, date: (l) => l.date || '' }, actions: { created: (a) => a.created || '', dueDate: (a) => a.dueDate || '', no: (a) => parseFloat(a.no) || 0 } };
const COLLABEL = { audit: { when: 'When', who: 'Who', what: 'What', item: 'Item', changes: 'Changes' }, leads: { company: 'Company', hubspotId: 'HubSpot ID', stage: 'Stage', sector: 'Sector', platform: 'Platform', country: 'Country', manager: 'Account manager', valueAmount: 'Est. value', update: 'Latest update', date: 'Date logged' },
  actions: { no: 'No.', title: 'Action item', owner: 'Owner', status: 'Status', created: 'Created', dueDate: 'Due', comments: 'Comments' } };
const FUNNEL = '<svg class="cf-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/></svg>';
const colFilter = (tbl, key) => (S.colf[tbl][key] ||= { q: '', vals: null });
const colOn = (tbl, key) => { const f = S.colf[tbl][key]; return !!(f && ((f.q || '').trim() || f.vals)); };
const colActive = (tbl) => Object.keys(S.colf[tbl]).some((k) => colOn(tbl, k));
const cfBtn = (tbl, key) => (COLV[tbl][key] ? `<button type="button" class="cf-btn${colOn(tbl, key) ? ' on' : ''}" data-colf="${tbl}:${key}" aria-label="Filter ${esc(COLLABEL[tbl][key])}" title="Filter ${esc(COLLABEL[tbl][key])}" aria-haspopup="dialog" aria-expanded="${S.colOpen?.tbl === tbl && S.colOpen?.key === key}">${FUNNEL}</button>` : '');
function applyCol(rows, tbl, except) {
  Object.entries(S.colf[tbl]).forEach(([k, f]) => {
    const q = (f.q || '').trim().toLowerCase();
    if (k === except || !(q || f.vals) || !COLV[tbl][k]) return;
    const g = COLV[tbl][k];
    rows = rows.filter((r) => { const v = g(r); return (!q || v.toLowerCase().includes(q)) && (!f.vals || f.vals.includes(v)); });
  });
  return rows;
}
function closeColPop(refocus = false) {
  const o = S.colOpen; S.colOpen = null; $('#colpop').hidden = true;
  if (refocus && o) $(`button[data-colf="${o.tbl}:${o.key}"]`)?.focus();
}
function placeColPop() {
  const o = S.colOpen, pop = $('#colpop'), btn = o && $(`button[data-colf="${o.tbl}:${o.key}"]`);
  if (!btn) return;
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth || 280;
  pop.style.left = Math.max(8, Math.min(r.left - 8, innerWidth - w - 8)) + 'px';
  pop.style.top = Math.min(r.bottom + 6, innerHeight - 160) + 'px';
}
function renderColPop() {
  const o = S.colOpen, pop = $('#colpop');
  const btn = o && $(`button[data-colf="${o.tbl}:${o.key}"]`);
  if (!o || !btn || S.route !== o.tbl) { pop.hidden = true; if (o && !btn) S.colOpen = null; return; }
  const label = COLLABEL[o.tbl][o.key], f = colFilter(o.tbl, o.key);
  const rows = o.tbl === 'leads' ? filteredLeads(o.key) : o.tbl === 'audit' ? auditRows(o.key) : actionRows(o.key);
  const g = COLV[o.tbl][o.key], sk = COLSORT[o.tbl]?.[o.key];
  const m = new Map();
  rows.forEach((r) => { const v = g(r), e = m.get(v) || { n: 0, k: sk ? sk(r) : v }; e.n++; m.set(v, e); });
  const all = [...m.entries()].sort(([av, a], [bv, b]) => (!av) - (!bv) || (typeof a.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k), undefined, { numeric: true })));
  S.cpAll = all.map(([v]) => v);
  const q = (f.q || '').trim().toLowerCase();
  const shown = all.filter(([v]) => !q || v.toLowerCase().includes(q));
  S.cpList = shown.slice(0, 300);
  if (!o.built) {
    pop.innerHTML = `<div class="cp-head"><b>${esc(label)}</b><button type="button" class="cp-x" data-cp-close="1" aria-label="Close">×</button></div>
      <input type="search" id="cp-q" placeholder="Search ${esc(label.toLowerCase())}…" aria-label="Search ${esc(label)}" autocomplete="off" value="${esc(f.q)}">
      <div class="cp-tools"><button type="button" class="btn ghost sm" data-cp-all="1">Select all</button><button type="button" class="btn ghost sm" data-cp-none="1">Clear</button><span class="cp-count muted small"></span></div>
      <div class="cp-list" role="group" aria-label="${esc(label)} values"></div>
      <div class="cp-foot"><button type="button" class="btn ghost sm" data-cp-reset="1">Reset column</button><button type="button" class="btn primary sm" data-cp-close="1">Done</button></div>`;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Filter ' + label);
    o.built = true;
  }
  $('.cp-list', pop).innerHTML = S.cpList.map(([v, e], i) => `<label class="cp-item"><input type="checkbox" data-cpi="${i}" ${!f.vals || f.vals.includes(v) ? 'checked' : ''}><span class="cp-v">${v ? esc(v) : '<i>(Blank)</i>'}</span><span class="cp-n num">${e.n}</span></label>`).join('')
    + (shown.length > 300 ? `<p class="muted small" style="padding:6px 8px">Showing the first 300 of ${shown.length}. Type in the search box to narrow it down.</p>` : '') || '<p class="muted small" style="padding:8px">No matching values.</p>';
  $('.cp-count', pop).textContent = `${f.vals ? f.vals.filter((v) => S.cpAll.includes(v)).length : all.length} of ${all.length} selected`;
  pop.hidden = false; placeColPop();
}
window.addEventListener('resize', () => S.colOpen && placeColPop());
document.addEventListener('scroll', (e) => { if (S.colOpen && !(e.target.closest && e.target.closest('#colpop'))) placeColPop(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.colOpen) { e.stopPropagation(); closeColPop(true); } }, true);

const COLS = [
  ['no', 'No.'], ['company', 'Company'], ['hubspotId', 'HubSpot ID'], ['stage', 'Stage'], ['sector', 'Sector'], ['platform', 'Platform'], ['country', 'Country'],
  ['manager', 'Account manager'], ['valueAmount', 'Est. value'], ['update', 'Latest update'], ['date', 'Date logged'],
];
// Ready-made lead filters that the dashboard cards open the Leads page with.
const PRESETS = {
  open: ['Open leads', (l) => isOpenLead(l)],
  attention: ['Need attention', (l) => isOpenLead(l) && !!needsAttention(l)],
  lost: ['Lost leads', (l) => LOST_STAGES.includes(l.stage)],
  committed: ['Committed', (l) => FC_COMMIT.includes(l.stage)],
  closed: ['Closed deals (won and lost)', (l) => WON_STAGES.includes(l.stage) || LOST_STAGES.includes(l.stage)],
  month: ['Logged this month', (l) => (l.date || '').startsWith(today().slice(0, 7))],
};
// Open the Leads page already filtered. `filters` uses the dashboard's own filter keys (sector, platform, country, manager, stage, dealType).
function goLeads({ preset = '', filters = {}, sort } = {}) {
  S.filters = { q: '', stage: '', sector: '', country: '', manager: '', platform: '', preset };
  S.colf.leads = {}; S.colOpen = null;
  Object.entries(filters).forEach(([k, v]) => {
    if (!v) return;
    const blank = v === 'Unassigned' || v === 'Not set';
    if (k === 'dealType') S.filters.dealType = blank ? '__none' : v;
    else if (['stage', 'sector', 'country', 'manager', 'platform'].includes(k)) { if (blank) S.colf.leads[k] = { q: '', vals: [''] }; else S.filters[k] = v; }
  });
  if (sort) S.sort = sort;
  location.hash = '#/leads';
}
function filteredLeads(except) {
  const f = S.filters, q = f.q.trim().toLowerCase();
  let ls = S.leads.filter((l) => (!f.stage || l.stage === f.stage) && (!f.sector || l.sector === f.sector) && (!f.country || l.country === f.country)
    && (!f.manager || l.manager === f.manager) && (!f.platform || l.platform === f.platform)
    && (!f.preset || PRESETS[f.preset]?.[1](l) !== false) && (!f.dealType || (f.dealType === '__none' ? !l.dealType : l.dealType === f.dealType))
    && (!q || [l.company, l.overview, l.update, l.contacts, l.country, l.manager, l.website, l.hubspotId].join(' ').toLowerCase().includes(q)));
  ls = applyCol(ls, 'leads', except);
  const { key, dir } = S.sort, m = dir === 'asc' ? 1 : -1;
  ls.sort((a, b) => { const x = a[key] ?? '', y = b[key] ?? ''; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * m; });
  return ls;
}
function viewLeads(el) {
  if (!can('leads_view')) return void (el.innerHTML = noAccess('leads'));
  const ls = filteredLeads(), f = S.filters, cf = colorFn();
  const sel = (id, label, opts) => `<select id="f-${id}" aria-label="${label}"><option value="">${label}</option>${opts.map((o) => `<option ${f[id] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  el.innerHTML = `${head('Leads', `${ls.length} of ${S.leads.length} shown · ${S.leads.filter(isOpenLead).length} open`, `<button class="btn" data-act="export-csv">Export CSV</button>${addLeadBtn()}`)}
  <div class="toolbar">
    <input type="search" id="f-q" placeholder="Search company, HubSpot ID, contact, notes…" aria-label="Search leads" value="${esc(f.q)}">
    ${sel('stage', 'All stages', stages())}${sel('sector', 'All sectors', uniq([...S.lists.sectors, ...S.leads.map((l) => l.sector)]))}
    ${sel('platform', 'All platforms', uniq([...S.lists.platforms, ...S.leads.map((l) => l.platform)]))}
    ${sel('country', 'All countries', uniq([...S.lists.countries, ...S.leads.map((l) => l.country)]))}${sel('manager', 'All managers', uniq([...S.lists.managers, ...S.leads.map((l) => l.manager)]))}
    ${f.preset && PRESETS[f.preset] ? `<button type="button" class="ov-fchip" data-act="clear-preset" title="Remove this filter">${esc(PRESETS[f.preset][0])} ✕</button>` : ''}${f.dealType ? `<button type="button" class="ov-fchip" data-act="clear-deal" title="Remove this filter">Deal type: ${esc(f.dealType === '__none' ? 'Not set' : f.dealType)} ✕</button>` : ''}
    ${Object.values(f).some(Boolean) || colActive('leads') ? '<button class="btn ghost sm" data-act="clear-filters">Clear filters</button>' : ''}
  </div>
  ${colourBar(ls, cf)}
  <div class="table-wrap"><table><thead><tr>${COLS.map(([k, l]) => `<th aria-sort="${S.sort.key === k ? (S.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><span class="th-in"><button data-sort="${k}">${l}${S.sort.key === k ? (S.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</button>${cfBtn('leads', k)}</span></th>`).join('')}</tr></thead>
  <tbody>${ls.map((l, i) => `<tr class="cb" style="--c:${cf(l)[0]}" title="${esc(cf(l)[1])}" data-open="${l.id}" tabindex="0">
    <td class="num">${i + 1}</td>
    <td><div class="co">${esc(l.company)}</div>${l.contacts ? `<div class="sub">${esc(l.contacts.split('\n')[0])}</div>` : ''}</td>
    <td class="num">${esc(l.hubspotId || '')}</td>
    <td>${chip(l.stage)}</td><td>${esc(l.sector || '')}</td><td>${esc(l.platform || '')}</td><td>${esc(l.country || '')}</td><td>${esc(l.manager || '')}</td>
    <td class="num val-cell">${leadValue(l)}</td>
    <td><div class="clip">${esc(l.update || '')}</div>${needsAttention(l) ? `<span class="tag-warn">${esc(needsAttention(l))}</span>` : ''}</td>
    <td class="num">${fmtDate(l.date)}</td></tr>`).join('') || `<tr><td colspan="${COLS.length}" class="empty">${S.leads.length ? 'No leads match these filters.' : 'No leads yet. Add one, or ask an admin to import the spreadsheet data.'}</td></tr>`}</tbody></table></div>`;
}

function actionRows(except) {
  const rows = S.actions.filter((a) => {
    const st = a.status || 'Open';
    const ok = S.actFilter === 'all' || (S.actFilter === 'active' ? !['Closed', 'Info Only'].includes(st) : st === S.actFilter);
    return ok && (!S.actQ || [a.title, a.owner, a.comments].join(' ').toLowerCase().includes(S.actQ.toLowerCase()));
  });
  return applyCol(rows, 'actions', except);
}
function viewActions(el) {
  if (!can('actions_view')) return void (el.innerHTML = noAccess('action items'));
  const filters = [['active', 'Open & in progress'], ['all', 'All'], ...S.lists.statuses.map((s) => [s, s])];
  const rows = actionRows().sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
  el.innerHTML = `${head('Action items', `${rows.length} shown`, can('actions_create') ? '<button class="btn primary" data-act="new-action">Add action item</button>' : '')}
  <div class="toolbar"><input type="search" id="a-q" placeholder="Search action items…" aria-label="Search action items" value="${esc(S.actQ)}">
    <select id="a-filter" aria-label="Status filter">${filters.map(([v, l]) => `<option value="${esc(v)}" ${S.actFilter === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${colActive('actions') ? '<button class="btn ghost sm" data-act="clear-colf-actions">Clear filters</button>' : ''}</div>
  <div class="table-wrap"><table><thead><tr>${Object.entries(COLLABEL.actions).map(([k, l]) => `<th><span class="th-in"><span>${l}</span>${cfBtn('actions', k)}</span></th>`).join('')}${can('actions_edit') || can('actions_delete') ? '<th></th>' : ''}</tr></thead>
  <tbody>${rows.map((a) => `<tr style="cursor:default"><td class="num">${esc(a.no ?? '')}</td><td><div class="prose" style="max-width:420px">${esc(a.title)}</div></td><td>${esc(a.owner || '')}</td>
    <td>${can('actions_edit') ? `<select data-status="${a.id}" aria-label="Status for action ${esc(a.no)}">${S.lists.statuses.map((s) => `<option ${a.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : esc(a.status || '')}</td>
    <td class="num">${fmtDate(a.created)}</td><td class="num">${a.dueDate && a.dueDate < today() && !['Closed', 'Info Only'].includes(a.status) ? `<span class="tag-warn">${fmtDate(a.dueDate)}</span>` : fmtDate(a.dueDate)}</td>
    <td><div class="prose" style="max-width:360px">${esc(a.comments || '')}</div></td>
    ${can('actions_edit') || can('actions_delete') ? `<td><div class="row" style="flex-wrap:nowrap">${can('actions_edit') ? `<button class="btn sm" data-edit-action="${a.id}">Edit</button>` : ''}${can('actions_delete') ? `<button class="btn sm danger" data-del-action="${a.id}">Delete</button>` : ''}</div></td>` : ''}</tr>`).join('') || `<tr><td colspan="8" class="empty">No action items match.</td></tr>`}</tbody></table></div>`;
}

function viewReference(el) {
  el.innerHTML = `${head('Reference', 'Stage definitions and the typical tender process.')}
  <section class="panel"><div class="panel-head"><h2>Tender process</h2><span class="muted small">Typical sequence for government and enterprise tenders</span></div>
    <ol class="steps">${TENDER_STEPS.map(([n, p]) => `<li><div><strong>${esc(n)}</strong><p class="muted">${esc(p)}</p></div></li>`).join('')}</ol></section>
  <section class="panel"><div class="panel-head"><h2>Lead stages</h2><span class="muted small">Closed stages (Lost, Completed) are excluded from open-lead totals.</span></div>
    <div class="row">${stages().map((s) => chip(s)).join('')}</div></section>`;
}

/* =====================================================================
   Audit trail view
   ===================================================================== */
function syncAudit() {
  if (S.route !== 'audit' || !S.profile || !S.perms || !canAudit()) { if (S.auditUnsubs.length) stopAudit(); return; }
  if (S.auditUnsubs.length) return;
  S.auditLoading = true; S.auditParts = {};
  const sec = mySectors(), fail = (e) => { S.auditLoading = false; toast(friendly(e), true); if (S.route === 'audit') render(); };
  // Everyone else: newest first, loaded in pages. Sector-limited people: one query per sector (the same way leads load), merged and sorted here.
  const parts = sec ? sec.map((x) => [x, query(collection(db, 'audit'), where('sector', '==', x))]) : [['*', query(collection(db, 'audit'), orderBy('at', 'desc'), limit(S.auditLimit))]];
  parts.forEach(([k, q]) => S.auditUnsubs.push(onSnapshot(q, (snap) => {
    S.auditParts[k] = snap.docs.map((d) => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at?.toMillis?.() ?? 0 }; });
    S.audit = Object.values(S.auditParts).flat().sort((a, b) => b.at - a.at);
    S.auditLoading = false; S.auditMore = !sec && snap.size >= S.auditLimit;
    if (S.route === 'audit') render();
  }, fail)));
}
function stopAudit() { S.auditUnsubs.forEach((u) => u()); S.auditUnsubs = []; S.auditParts = {}; S.audit = []; S.auditLoading = true; S.auditMore = false; }

const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function auditRows(except) {
  const f = S.auf, q = f.q.trim().toLowerCase();
  const text = (a) => [a.label, a.byName, a.by, a.note, AUDIT_ENTITIES[a.entity], AUDIT_ACTIONS[a.action], ...(a.changes || []).flatMap((c) => [FL[c.f] || c.f, c.from, c.to])].join(' ').toLowerCase();
  const base = S.audit.filter((a) => (!f.entity || a.entity === f.entity) && (!f.by || a.by === f.by) && (!f.action || a.action === f.action)
    && (!f.from || ymd(a.at) >= f.from) && (!f.to || ymd(a.at) <= f.to) && (!q || text(a).includes(q)));
  return applyCol(base, 'audit', except);
}
const dtParts = (ms) => { const t = fmtDT(ms), i = t.indexOf(', '); return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 2)]; };
function viewAudit(el) {
  if (!canAudit()) return void (el.innerHTML = noAccess('the audit trail'));
  const f = S.auf, all = auditRows(), G = S.apg, sig = JSON.stringify([S.auf, S.colf.audit]);
  if (G.sig !== sig) { G.sig = sig; G.page = 1; }
  const per = G.size || all.length || 1, pages = Math.max(1, Math.ceil(all.length / per));
  G.page = Math.min(Math.max(1, G.page), pages);
  const rows = G.size ? all.slice((G.page - 1) * per, G.page * per) : all;
  const pager = () => {
    if (!all.length) return '';
    const from = (G.page - 1) * per + 1, to = G.size ? Math.min(all.length, G.page * per) : all.length, nums = [];
    for (let i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - G.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…'); }
    return `<div class="pager"><span class="muted small">Showing ${from}–${to} of ${all.length}</span>
      <div class="pager-nav">${G.size && pages > 1 ? `<button class="btn sm" data-apg="prev" ${G.page === 1 ? 'disabled' : ''}>Previous</button>${nums.map((n) => (n === '…' ? '<span class="muted">…</span>' : `<button class="btn sm ${n === G.page ? 'primary' : ''}" data-apg="${n}" aria-label="Page ${n}" ${n === G.page ? 'aria-current="page"' : ''}>${n}</button>`)).join('')}<button class="btn sm" data-apg="next" ${G.page === pages ? 'disabled' : ''}>Next</button>` : ''}</div>
      <div class="pp"><span class="muted small">Per page</span><select id="apg-size" aria-label="Entries per page">${[['25', '25'], ['50', '50'], ['all', 'All']].map(([v, l]) => `<option value="${v}" ${(G.size === 0 ? 'all' : String(G.size)) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
  };
  const people = [...new Map(S.audit.map((a) => [a.by, a.byName || a.by])).entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1])));
  const sel = (id, label, opts) => `<select id="au-${id}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${f[id] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const chg = (c, plain) => {
    const lab = `<b>${esc(FL[c.f] || c.f)}</b>`;
    if (plain) return `<div class="chg">${lab} ${c.from && c.to ? `<span class="from">${esc(c.from)}</span> → <span class="to">${esc(c.to)}</span>` : `<span class="to">${esc(c.to || c.from)}</span>`}</div>`;
    if (!c.from) return `<div class="chg">${lab} set to <span class="to">${esc(c.to)}</span></div>`;
    if (!c.to) return `<div class="chg">${lab} cleared <span class="from">${esc(c.from)}</span></div>`;
    return `<div class="chg">${lab} <span class="from">${esc(c.from)}</span> → <span class="to">${esc(c.to)}</span></div>`;
  };
  const filtered = Object.values(f).some(Boolean) || colActive('audit');
  el.innerHTML = `${head('Audit trail', 'Who changed what, and when. Entries are added automatically and can’t be edited. Admins can purge old entries under Admin.', `<button class="btn" data-act="audit-csv" ${all.length ? '' : 'disabled'}>Export CSV</button>`)}
  <div class="toolbar">
    <input type="search" id="au-q" placeholder="Search item, person or change…" aria-label="Search the audit trail" value="${esc(f.q)}">
    ${sel('entity', 'All record types', Object.entries(AUDIT_ENTITIES))}${sel('action', 'All actions', Object.entries(AUDIT_ACTIONS))}${sel('by', 'All people', people)}
    <label class="row small" style="gap:6px">From <input type="date" id="au-from" value="${esc(f.from)}" aria-label="From date"></label>
    <label class="row small" style="gap:6px">To <input type="date" id="au-to" value="${esc(f.to)}" aria-label="To date"></label>
    ${filtered ? '<button class="btn ghost sm" data-act="audit-clear">Clear filters</button>' : ''}
  </div>
  <p class="muted small" style="margin:-6px 0 12px">${all.length} of ${S.audit.length} loaded${S.auditMore ? ' (older entries are available)' : ''}. ${mySectors() ? `You can see changes to leads in your sectors (${esc(mySectors().join(', '))}) only. ` : ''}Changes made before the audit trail was switched on are not listed here; a lead’s own History still shows its earlier updates.</p>
  ${pager()}
  <div class="table-wrap"><table class="audit-table audit-fixed"><thead><tr>${Object.entries(COLLABEL.audit).map(([k, l]) => `<th><span class="th-in"><span>${l}</span>${cfBtn('audit', k)}</span></th>`).join('')}<th class="ax" aria-label="Expand"></th></tr></thead><tbody>
  ${rows.map((a) => {
    const open = a.entity === 'lead' && S.leads.some((l) => l.id === a.entityId), plain = ['create', 'delete'].includes(a.action) || a.entity === 'list';
    return `<tr class="${S.auExp.has(a.id) ? 'x-open' : ''}" ${open ? `data-open="${esc(a.entityId)}" tabindex="0" title="Open this lead"` : 'style="cursor:default"'}>
      <td><div class="clamp"><div class="co">${esc(dtParts(a.at)[0])}</div><div class="sub">${esc(dtParts(a.at)[1])}</div></div></td>
      <td><div class="clamp"><div class="co">${esc(a.byName || a.by)}</div><div class="sub">${esc(a.by)}</div></div></td>
      <td><div class="clamp"><span class="abadge ${ACT_CLS[a.action] || 'mute'}">${esc(AUDIT_ACTIONS[a.action] || a.action)}</span><div class="sub">${esc(AUDIT_ENTITIES[a.entity] || a.entity)}</div></div></td>
      <td><div class="clamp"><div class="co">${esc(a.label || '—')}</div>${a.entity === 'lead' ? `<div class="sub">${a.sector ? `Sector: ${esc(a.sector)}` : 'No sector recorded'}</div>` : ''}</div></td>
      <td><div class="clamp clamp-chg">${(a.changes || []).map((c) => chg(c, plain)).join('')}${a.note ? `<div class="sub">${esc(a.note)}</div>` : ''}${!(a.changes || []).length && !a.note ? '<span class="muted">—</span>' : ''}</div></td>
      <td class="ax"><button class="btn ghost sm" data-aexp="${esc(a.id)}" aria-expanded="${S.auExp.has(a.id)}">${S.auExp.has(a.id) ? 'Show less' : 'Show more'}</button></td></tr>`;
  }).join('') || `<tr style="cursor:default"><td colspan="6" class="empty">${S.auditLoading ? 'Loading…' : S.audit.length ? 'No entries match these filters.' : 'Nothing recorded yet. From now on, changes to leads, action items, users, lists and permissions are logged here.'}</td></tr>`}
  </tbody></table></div>
  ${pager()}
  ${S.auditMore ? '<div class="row" style="margin-top:12px"><button class="btn" data-act="audit-more">Load older entries</button></div>' : ''}`;
  requestAnimationFrame(markAuditOverflow);
}
// Show the "Show more" button only on rows whose text is actually cut off.
function markAuditOverflow() {
  $$('.audit-fixed tbody tr').forEach((tr) => {
    const b = tr.querySelector('[data-aexp]'); if (!b) return;
    const over = [...tr.querySelectorAll('.clamp')].some((c) => c.scrollHeight > c.clientHeight + 1 || [...c.querySelectorAll('.co,.sub,.chg')].some((x) => x.scrollWidth > x.clientWidth + 1));
    b.classList.toggle('on', over || tr.classList.contains('x-open'));
  });
}
window.addEventListener('resize', () => { if (S.route === 'audit') markAuditOverflow(); });
function exportAuditCsv() {
  const q = (v) => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
  const cols = ['When', 'Who', 'Email', 'Record type', 'Action', 'Item', 'Changes', 'Note'];
  const rows = auditRows().map((a) => [fmtDT(a.at), a.byName || '', a.by, AUDIT_ENTITIES[a.entity] || a.entity, AUDIT_ACTIONS[a.action] || a.action, a.label || '',
    (a.changes || []).map((c) => `${FL[c.f] || c.f}: ${c.from || '(empty)'} -> ${c.to || '(empty)'}`).join('; '), a.note || '']);
  download(`rfid-audit-trail-${today()}.csv`, '﻿' + [cols, ...rows].map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  logOnly('data', '', 'Audit trail CSV', 'export', [], { note: `${rows.length} audit entries exported` });
}

// [key, title, field the list feeds]
const LIST_DEFS = [['stages', 'Stages', 'stage'], ['sectors', 'Sectors', 'sector'], ['platforms', 'Platforms', 'platform'], ['countries', 'Countries', 'country'],
  ['managers', 'Account managers', 'manager'], ['currencies', 'Currencies', 'currency'], ['statuses', 'Action statuses', 'status']];
const LIST_REQUIRED = ['stages', 'currencies', 'statuses'];
const ICON_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const ICON_UNLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>';

function listCard([k, title]) {
  const items = S.lists[k] || [];
  if (S.editList !== k) {
    return `<div class="list-card"><div class="list-card-head"><h3><span class="lock">${ICON_LOCK}</span>${esc(title)}</h3><span class="badge num">${items.length}</span></div>
      <div class="pill-wrap">${items.length ? items.map((i) => `<span class="pill">${esc(i)}</span>`).join('') : '<span class="muted small">Nothing yet</span>'}</div>
      <div class="list-card-foot"><button class="btn sm" data-list-add="${k}">+ Add new</button><button class="btn sm" data-list-edit="${k}">Edit</button></div></div>`;
  }
  return `<div class="list-card editing"><div class="list-card-head"><h3><span class="lock open">${ICON_UNLOCK}</span>${esc(title)}</h3><span class="badge">Editing</span></div>
    <div class="list-rows">${S.draft.map((r, i) => `<div class="list-row"><span class="n">${i + 1}</span>
      <input type="text" id="dr-${i}" data-draft="${i}" value="${esc(r.v)}" aria-label="${esc(title)} item ${i + 1}">
      <button class="btn sm ghost" data-draft-up="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>&#8593;</button>
      <button class="btn sm ghost" data-draft-down="${i}" aria-label="Move down" ${i === S.draft.length - 1 ? 'disabled' : ''}>&#8595;</button>
      <button class="btn sm danger" data-draft-del="${i}">Remove</button></div>`).join('') || '<p class="muted small">No items. Add one below.</p>'}</div>
    <div class="list-card-foot"><button class="btn sm" data-draft-add="1">+ Add new</button><button class="btn primary sm" data-list-save="1">Save</button><button class="btn sm" data-list-cancel="1">Cancel</button></div></div>`;
}

const CHECK = '<svg class="tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="Yes"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const DASH = '<span class="dash" aria-label="No">–</span>';

function accessPanels() {
  const ep = !!S.permDraft, P = ep ? S.permDraft : S.perms;
  const row = ([k, label]) => `<tr><td>${esc(label)}</td>${PERM_ROLES.map((r) => `<td class="mx">${ep
      ? `<input type="checkbox" data-perm="${r}:${k}" ${P[r][k] ? 'checked' : ''} aria-label="${esc(label)} for ${r}">`
      : (P[r][k] ? CHECK : DASH)}</td>`).join('')}<td class="mx locked">${CHECK}</td></tr>`;
  const perms = `<section class="panel"><div class="panel-head"><div><h2>Permissions by role</h2><p class="muted small">Choose what each role can do. Admins always have full access. Rules are enforced by Firestore, so a role without a permission is blocked even if someone tampers with the page.</p></div>
    ${ep ? '<div class="row"><button class="btn primary sm" data-perm-save="1">Save</button><button class="btn sm" data-perm-cancel="1">Cancel</button></div>' : '<button class="btn sm" data-perm-edit="1">Edit</button>'}</div>
    <div class="table-wrap"><table class="matrix"><thead><tr><th>Permission</th>${PERM_ROLES.map((r) => `<th class="mx"><span class="role-pill r-${r}">${r}</span></th>`).join('')}<th class="mx"><span class="role-pill r-admin">admin</span></th></tr></thead><tbody>
    ${PERM_GROUPS.map(([g, items]) => `<tr class="grp"><td colspan="4">${esc(g)}</td></tr>${items.map(row).join('')}`).join('')}
    <tr class="grp"><td colspan="4">Administration</td></tr>
    ${ADMIN_ONLY_PERMS.map((l) => `<tr><td>${esc(l)}</td>${PERM_ROLES.map(() => `<td class="mx">${DASH}</td>`).join('')}<td class="mx locked">${CHECK}</td></tr>`).join('')}
    </tbody></table></div></section>`;

  // ---- users x sectors
  const sectors = S.lists.sectors || [];
  const es = !!S.secDraft;
  const rows = [
    ...S.users.map((u) => ({ key: 'u:' + u.id, name: u.name || u.email, email: u.email, role: u.role, sectors: u.sectors, invited: false })),
    ...S.invites.map((i) => ({ key: 'i:' + i.id, name: i.name || i.email || i.id, email: i.email || i.id, role: i.role, sectors: i.sectors, invited: true })),
  ].sort((a, b) => String(a.email).localeCompare(b.email));
  const has = (r) => (es && S.secDraft[r.key] ? S.secDraft[r.key] : new Set(r.sectors?.length ? r.sectors : sectors));
  const matrix2 = `<section class="panel"><div class="panel-head"><div><h2>Access by sector</h2><p class="muted small">Which sectors each person can see leads for. Everyone starts with all sectors. Admins always see all. A lead with no sector is visible to unrestricted users only.</p></div>
    ${es ? '<div class="row"><button class="btn primary sm" data-sec-save="1">Save</button><button class="btn sm" data-sec-cancel="1">Cancel</button></div>' : '<button class="btn sm" data-sec-edit="1">Edit</button>'}</div>
    <div class="table-wrap"><table class="matrix"><thead><tr><th>User</th><th>Role</th>${sectors.map((x) => `<th class="mx">${esc(x)}</th>`).join('')}<th class="mx">Leads visible</th></tr></thead><tbody>
    ${rows.map((r) => {
      const locked = r.role === 'admin', set = has(r);
      return `<tr class="${['pending', 'disabled'].includes(r.role) ? 'is-off' : ''}"><td><div class="co">${esc(r.name)}${r.invited ? ' <span class="tag-warn">Invited</span>' : ''}</div><div class="sub">${esc(r.email)}</div></td>
      <td><span class="role-pill r-${esc(r.role)}">${esc(r.role)}</span></td>
      ${sectors.map((x) => `<td class="mx ${locked ? 'locked' : ''}">${es && !locked ? `<input type="checkbox" data-sec-cell="${esc(r.key)}|${esc(x)}" ${set.has(x) ? 'checked' : ''} aria-label="${esc(r.email)} can see ${esc(x)}">` : (locked || set.has(x) ? CHECK : DASH)}</td>`).join('')}
      <td class="mx">${locked || set.size >= sectors.length ? 'All' : set.size ? set.size + ' of ' + sectors.length : 'None'}</td></tr>`;
    }).join('') || `<tr><td colspan="${sectors.length + 3}" class="empty">No users yet.</td></tr>`}
    </tbody></table></div></section>`;
  return { perms, matrix2 };
}

const ADMIN_PAGES = {
  users: { title: 'Users', blurb: 'Add people, change roles, disable or remove access.', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|c9,7,4|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75' },
  permissions: { title: 'Permissions by role', blurb: 'Choose what viewers and editors can do with leads and action items.', icon: 'r3,11,18,10|M7 11V7a5 5 0 0 1 10 0v4' },
  sectors: { title: 'Access by sector', blurb: 'Limit which sectors (such as Healthcare or Industrial) each person can see.', icon: 'M12 2 22 7 12 12 2 7z|M2 17l10 5 10-5|M2 12l10 5 10-5' },
  lists: { title: 'Dropdown lists', blurb: 'Stages, sectors, platforms, countries, account managers, currencies and action statuses.', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  audit: { title: 'Purge audit trail', blurb: 'Permanently delete audit entries: tick specific lines, or clear a whole date range.', icon: 'M3 6h18|M8 6V4h8v2|M19 6l-1 14H6L5 6|M10 11v6|M14 11v6' },
  finance: { title: 'Forecast settings', blurb: 'Reporting currency, exchange rates and stage probabilities for the dashboard forecast.', icon: 'M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  data: { title: 'Data and backup', blurb: 'Import leads from a file or download a full backup.', icon: 'e12,5,9,3|M3 5v14a9 3 0 0 0 18 0V5|M3 12a9 3 0 0 0 18 0' },
};
// tiny icon spec: path strings, 'cx,cy,r' circles (c...), rects (r x,y,w,h), ellipses (e cx,cy,rx,ry)
const adminIcon = (spec) => ic(spec.split('|').map((p) => {
  if (/^c[\d.]/.test(p)) { const [x, y, r] = p.slice(1).split(','); return `<circle cx="${x}" cy="${y}" r="${r}"/>`; }
  if (/^r[\d.]/.test(p)) { const [x, y, w, h] = p.slice(1).split(','); return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`; }
  if (/^e[\d.]/.test(p)) { const [x, y, rx, ry] = p.slice(1).split(','); return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`; }
  return `<path d="${p}"/>`;
}).join(''));

const usersPanel = () => `<section class="panel"><div class="panel-head"><div><h2>Users</h2><p class="muted small">Viewers read only. Editors add, edit and delete leads. Admins also manage users and lists.</p></div><button class="btn primary sm" data-act="add-user">Add user</button></div>
  <div class="table-wrap"><table class="users-table"><thead><tr><th>User</th><th>Role</th><th>Sectors</th><th>Last seen</th><th class="ta-r">Actions</th></tr></thead><tbody>
  ${[...S.users].sort((a, b) => (a.role === 'pending' ? -1 : 0) - (b.role === 'pending' ? -1 : 0) || String(a.email).localeCompare(b.email)).map((u) => {
    const me = u.id === S.user.uid;
    return `<tr style="cursor:default" class="${u.role === 'disabled' ? 'is-off' : ''}"><td><div class="co">${esc(u.name || u.email)}${me ? ' <span class="muted small">(you)</span>' : ''}</div><div class="sub">${esc(u.email)}</div></td>
    <td><span class="role-pill r-${esc(u.role)}">${esc(u.role)}</span>${u.role === 'pending' ? ' <span class="tag-warn">Needs approval</span>' : ''}</td>
    <td>${esc(u.role === 'admin' ? 'All sectors' : sectorLabel(u.sectors))}</td>
    <td class="num nowrap">${u.lastSeen?.toMillis ? esc(fmtDT(u.lastSeen.toMillis())) : '<span class="muted">Not yet</span>'}</td>
    <td class="ta-r"><div class="row-actions"><button class="btn sm" data-edit-user="${u.id}">Edit</button>${me ? '' : `<button class="btn sm" data-toggle-user="${u.id}">${u.role === 'disabled' ? 'Enable' : 'Disable'}</button><button class="btn sm danger" data-del-user="${u.id}">Remove</button>`}</div></td></tr>`;
  }).join('')}
  </tbody></table></div>
  ${S.invites.length ? `<h3 style="margin:22px 0 10px">Invited, not signed up yet</h3><div class="table-wrap"><table class="users-table"><thead><tr><th>User</th><th>Role on sign-up</th><th>Sectors</th><th class="ta-r">Actions</th></tr></thead><tbody>
  ${S.invites.map((i) => `<tr style="cursor:default"><td><div class="co">${esc(i.name || i.email || i.id)}</div><div class="sub">${esc(i.email || i.id)}</div></td><td><span class="role-pill r-${esc(i.role)}">${esc(i.role)}</span></td><td>${esc(i.role === 'admin' ? 'All sectors' : sectorLabel(i.sectors))}</td>
    <td class="ta-r"><div class="row-actions"><button class="btn sm" data-edit-invite="${esc(i.id)}">Edit</button><button class="btn sm danger" data-del-invite="${esc(i.id)}">Cancel invite</button></div></td></tr>`).join('')}
  </tbody></table></div>` : ''}</section>`;
// Leads (and the stage list) still using the old 12-stage names.
function migrationPending() {
  const leads = S.leads.filter((l) => STAGE_MIGRATION[l.stage] && STAGE_MIGRATION[l.stage] !== l.stage);
  const list = (S.lists.stages || []).some((s) => STAGE_MIGRATION[s] && STAGE_MIGRATION[s] !== s);
  return { leads, list, any: leads.length > 0 || list };
}
const migrationCard = () => {
  const m = migrationPending();
  if (!m.any) return '';
  return `<section class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h2>Move to the simplified stages</h2>
    <p class="muted small">${plural(m.leads.length, 'lead')} still use the old stage names${m.list ? ', and the stage list does too' : ''}. This switches them to the 10-stage list: Won replaces Contracted and Tender Successful, Lost replaces Cancelled and Tender Unsuccessful. Each lead keeps its history, tender leads get Deal type = Tender, and lost leads get their old stage as the loss reason if none is set. Every change is audit-logged. Download a backup first (Admin &gt; Data and backup).</p></div>
    <button class="btn primary" data-act="migrate-stages">Migrate stages</button></div></section>`;
};
async function migrateStages() {
  const m = migrationPending();
  if (!m.any) return toast('Stages are already up to date.');
  const counts = {};
  m.leads.forEach((l) => { const k = `${l.stage} → ${STAGE_MIGRATION[l.stage]}`; counts[k] = (counts[k] || 0) + 1; });
  const lines = Object.entries(counts).map(([k, n]) => `• ${k}: ${plural(n, 'lead')}`).join('\n');
  if (!await confirmBox('Move to the simplified stages', `${m.leads.length ? lines + '\n\n' : ''}The stage list becomes: ${DEFAULT_LISTS.stages.join(', ')}.${S.fin ? '\nStage probabilities in Forecast settings are carried over.' : ''}`, 'Migrate')) return;
  const custom = (S.lists.stages || []).filter((s) => !STAGE_MIGRATION[s]); // stages an admin added themselves are kept
  const newStages = [...DEFAULT_LISTS.stages, ...custom];
  const ok = await run(async () => {
    for (let i = 0; i < m.leads.length; i += 200) {
      const writes = [], audits = [];
      m.leads.slice(i, i + 200).forEach((l) => {
        const to = STAGE_MIGRATION[l.stage], patch = { stage: to, timeline: arrayUnion({ ...entry('stage', `Stage: ${l.stage} → ${to}`), migrated: true }), ...stamp() };
        const ch = [{ f: 'stage', from: clip(l.stage), to }];
        if (OLD_TENDER_STAGES.includes(l.stage) && !l.dealType) { patch.dealType = 'Tender'; ch.push({ f: 'dealType', from: '', to: 'Tender' }); }
        if (to === 'Lost' && !(l.lossReason || '').trim() && OLD_LOSS_REASON[l.stage]) { patch.lossReason = OLD_LOSS_REASON[l.stage]; ch.push({ f: 'lossReason', from: '', to: patch.lossReason }); }
        writes.push(['update', doc(db, 'leads', l.id), patch]);
        audits.push(auditOp('lead', l.id, l.company, 'stage', ch, { sector: l.sector || '', note: 'Stage list simplified' }));
      });
      await commit(writes, audits);
    }
    await setDoc(doc(db, 'settings', 'lists'), { stages: newStages }, { merge: true });
    if (S.fin) {
      const old = S.fin.probs || {}, probs = {};
      newStages.forEach((st) => {
        const from = [st, ...Object.keys(STAGE_MIGRATION).filter((o) => STAGE_MIGRATION[o] === st)].find((k) => old[k] != null);
        probs[st] = from != null ? Number(old[from]) : (DEFAULT_PROBS[st] ?? 0);
      });
      await updateDoc(doc(db, 'settings', 'finance'), { probs, updated: today() });
    }
    await commit([], [auditOp('list', 'stages', 'Stages', 'settings', [{ f: 'Migrated', from: 'Qualify Lead, Contracted, Tender Successful, Cancelled, Tender Unsuccessful…', to: clip(newStages.join(', ')) }], { note: `${plural(m.leads.length, 'lead')} moved to the simplified stages` })]);
  }, `Stages updated (${plural(m.leads.length, 'lead')} moved)`);
  if (ok) render();
}
const listsPanel = () => `${migrationCard()}<section class="panel"><div class="panel-head"><div><h2>Dropdown lists</h2><p class="muted small">Locked by default. Select Edit to rename, reorder or remove items, or Add new to add one. The first stage and first currency are the defaults for new leads, and stage order sets the pipeline columns.</p></div>
    <button class="btn sm" data-act="sync-lists">Add values already used in leads</button></div>
    <div class="lists-grid">${LIST_DEFS.map(listCard).join('')}</div></section>`;
const dataPanel = () => `<section class="panel"><div class="panel-head"><h2>Data</h2></div>
    <div class="row"><button class="btn" data-act="import">Import from JSON file</button><input type="file" id="importFile" accept=".json,application/json" hidden><button class="btn" data-act="backup">Download full backup (JSON)</button></div>
    <p class="muted small" style="margin-top:8px">Import accepts the initial-data file supplied with this app, or a backup you downloaded here. Records keep a stable ID, so importing the same file again updates them instead of creating duplicates. Your customer data is never stored in the website files.</p></section>`;

function adminStat(k) {
  const pend = S.users.filter((u) => u.role === 'pending').length;
  if (k === 'users') return `${plural(S.users.length, 'user')}${S.invites.length ? ` · ${S.invites.length} invited` : ''}${pend ? ` <span class="tag-warn">${pend} to approve</span>` : ''}`;
  if (k === 'permissions') return 'Viewer · Editor · Admin';
  if (k === 'sectors') { const n = S.users.filter((u) => u.role !== 'admin' && u.sectors?.length).length; return `${plural((S.lists.sectors || []).length, 'sector')} · ${n} restricted`; }
  if (k === 'lists') return `${LIST_DEFS.length} lists`;
  if (k === 'finance') return `${fin().base} · ${plural(Object.keys(fin().rates).length, 'rate')} set`;
  if (k === 'audit') return 'Admins only · purges are logged';
  return `${plural(S.leads.length, 'lead')} · ${plural(S.actions.length, 'action item')}`;
}

/* =====================================================================
   Admin: purge the audit trail (tick lines, or clear a date range)
   ===================================================================== */
const nEntries = (n) => `${n} audit ${n === 1 ? 'entry' : 'entries'}`;
function pgConstraints() {
  const c = [], p = S.pg;
  if (p.from) c.push(where('at', '>=', Timestamp.fromDate(new Date(`${p.from}T00:00:00`))));
  if (p.to) { const d = new Date(`${p.to}T00:00:00`); d.setDate(d.getDate() + 1); c.push(where('at', '<', Timestamp.fromDate(d))); }
  return c;
}
const pgRangeText = () => { const p = S.pg, f = (v) => fmtDate(`${v}T00:00:00`); return p.from && p.to ? `${f(p.from)} to ${f(p.to)}` : p.from ? `on or after ${f(p.from)}` : p.to ? `on or before ${f(p.to)}` : 'all dates'; };
async function loadPurge(more = false) {
  const p = S.pg;
  if (p.loading) return;
  p.loading = true; if (more) p.limit += 200;
  try {
    const snap = await getDocs(query(collection(db, 'audit'), ...pgConstraints(), orderBy('at', 'desc'), limit(p.limit)));
    p.rows = snap.docs.map((d) => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at?.toMillis?.() ?? 0 }; });
    p.more = snap.size >= p.limit;
    p.sel = new Set([...p.sel].filter((id) => p.rows.some((r) => r.id === id)));
  } catch (e) { toast(friendly(e), true); }
  p.loading = false; p.loaded = true;
  if (S.route === 'admin' && S.sub === 'audit') render();
}
async function purgeIds(ids, how) {
  const p = S.pg;
  p.busy = true; render();
  await run(async () => {
    for (let i = 0; i < ids.length; i += 400) {
      const b = writeBatch(db);
      ids.slice(i, i + 400).forEach((id) => b.delete(doc(db, 'audit', id)));
      await b.commit();
    }
    // The purge itself is recorded, so there is always a trace that entries were removed.
    await commit([], [auditOp('data', '', 'Audit trail purge', 'purge', [], { note: `${nEntries(ids.length)} deleted (${how})` })]);
  }, `${nEntries(ids.length)} deleted`);
  p.busy = false; p.loaded = false; p.sel.clear(); render();
}
async function purgeSelected() {
  const ids = [...S.pg.sel];
  if (!ids.length) return;
  const n = nEntries(ids.length);
  if (await confirmBox('Delete audit entries', `Permanently delete the ${n} you ticked? This can’t be undone.`, 'Delete')) await purgeIds(ids, 'ticked lines');
}
async function purgeRange() {
  const p = S.pg;
  p.busy = true; render();
  let snap;
  try { snap = await getDocs(query(collection(db, 'audit'), ...pgConstraints())); } catch (e) { toast(friendly(e), true); }
  p.busy = false; render();
  if (!snap) return;
  if (!snap.size) return toast('No audit entries in that date range.');
  const n = nEntries(snap.size);
  const what = p.from || p.to ? `dated ${pgRangeText()}` : 'ever recorded (no dates are set)';
  if (await confirmBox('Delete audit entries', `Permanently delete all ${n} ${what}? This can’t be undone.`, 'Delete all')) await purgeIds(snap.docs.map((d) => d.id), pgRangeText());
}
// Older lead entries were recorded before sectors were kept. This works out each one's sector from the lead's own recorded sector
// changes (or, failing that, the lead's current sector) so people limited to certain sectors can see that history too.
function planSectorTagging(docs) {
  const leadSec = Object.fromEntries(S.leads.map((l) => [l.id, l.sector || '']));
  const groups = {};
  docs.forEach((d) => {
    const x = d.data({ serverTimestamps: 'estimate' });
    if (x.entity !== 'lead' || 'sector' in x) return;
    (groups[x.entityId] ||= []).push({ id: d.id, at: x.at?.toMillis?.() ?? 0, changes: x.changes || [] });
  });
  const tag = [];
  let skipped = 0;
  const sc = (e) => e.changes.find((c) => c.f === 'sector');
  Object.entries(groups).forEach(([lid, list]) => {
    list.sort((a, b) => a.at - b.at);
    const first = list.map(sc).find(Boolean);
    let cur = first ? first.from || '' : leadSec[lid] ?? '';
    list.forEach((e) => { const c = sc(e); if (c) cur = c.to || c.from || ''; if (cur) tag.push([e.id, cur]); else skipped++; });
  });
  return { tag, skipped };
}
async function tagOldAudit() {
  const p = S.pg;
  p.busy = true; render();
  let snap;
  try { snap = await getDocs(collection(db, 'audit')); } catch (e) { toast(friendly(e), true); }
  p.busy = false; render();
  if (!snap) return;
  const { tag, skipped } = planSectorTagging(snap.docs);
  if (!tag.length) return toast(skipped ? `Nothing can be tagged: ${skipped} older lead ${skipped === 1 ? 'entry has' : 'entries have'} no recorded sector.` : 'Every lead entry already has a sector.');
  if (!await confirmBox('Tag older entries', `Add a sector to ${tag.length} older lead audit ${tag.length === 1 ? 'entry' : 'entries'}?${skipped ? ` ${skipped} more can’t be worked out and will stay hidden from sector-limited people.` : ''} Nothing else about them changes.`, 'Tag entries')) return;
  p.busy = true; render();
  await run(async () => {
    for (let i = 0; i < tag.length; i += 400) {
      const b = writeBatch(db);
      tag.slice(i, i + 400).forEach(([id, sector]) => b.update(doc(db, 'audit', id), { sector }));
      await b.commit();
    }
    await commit([], [auditOp('data', '', 'Audit trail sector tagging', 'settings', [], { note: `${tag.length} older lead entries tagged with their sector${skipped ? `, ${skipped} could not be tagged` : ''}` })]);
  }, `${tag.length} entries tagged`);
  p.busy = false; p.loaded = false; render();
}
function purgePanel() {
  const p = S.pg, n = p.sel.size, allOn = p.rows.length > 0 && p.rows.every((r) => p.sel.has(r.id));
  return `<section class="panel"><div class="panel-head"><div><h2>Purge audit trail</h2><p class="muted small">Deleting is permanent and only admins can do it. Set a date range to list entries from those days, then either tick specific lines or clear the whole range. Each purge leaves one entry in the audit trail saying how many were removed. Consider exporting a CSV from the Audit Trail page first.</p></div></div>
    <div class="toolbar">
      <label class="row small" style="gap:6px">From <input type="date" id="pg-from" value="${esc(p.from)}" aria-label="From date"></label>
      <label class="row small" style="gap:6px">To <input type="date" id="pg-to" value="${esc(p.to)}" aria-label="To date"></label>
      ${p.from || p.to ? '<button class="btn ghost sm" data-act="pg-clear">Clear dates</button>' : ''}
      <button class="btn danger" data-act="pg-range" ${p.busy || p.loading ? 'disabled' : ''}>Delete all entries in range (${esc(pgRangeText())})</button>
    </div>
    <div class="row" style="margin:4px 0 10px"><button class="btn danger solid" data-act="pg-selected" ${n && !p.busy ? '' : 'disabled'}>Delete ${n} selected</button>
      <span class="muted small">${p.loading ? 'Loading…' : `${nEntries(p.rows.length)} listed${p.more ? ' (more available)' : ''}`}</span></div>
    <div class="table-wrap"><table class="audit-table"><thead><tr><th style="width:36px"><input type="checkbox" data-pg-all ${allOn ? 'checked' : ''} ${p.rows.length ? '' : 'disabled'} aria-label="Select all listed entries"></th><th>When</th><th>Who</th><th>What</th><th>Item</th></tr></thead><tbody>
    ${p.rows.map((a) => `<tr style="cursor:default"><td><input type="checkbox" data-pg-sel="${esc(a.id)}" ${p.sel.has(a.id) ? 'checked' : ''} aria-label="Select this entry"></td>
      <td class="num nowrap">${esc(fmtDT(a.at))}</td><td><div class="co">${esc(a.byName || a.by)}</div><div class="sub">${esc(a.by)}</div></td>
      <td><span class="abadge ${ACT_CLS[a.action] || 'mute'}">${esc(AUDIT_ACTIONS[a.action] || a.action)}</span><div class="sub">${esc(AUDIT_ENTITIES[a.entity] || a.entity)}</div></td>
      <td><div class="co">${esc(a.label || '—')}</div>${a.entity === 'lead' ? `<div class="sub">${a.sector ? `Sector: ${esc(a.sector)}` : 'No sector recorded'}</div>` : ''}${a.note ? `<div class="sub">${esc(a.note)}</div>` : ''}</td></tr>`).join('') || `<tr style="cursor:default"><td colspan="5" class="empty">${p.loading ? 'Loading…' : 'No audit entries in this range.'}</td></tr>`}
    </tbody></table></div>
    ${p.more ? '<div class="row" style="margin-top:12px"><button class="btn" data-act="pg-more">Load older entries</button></div>' : ''}</section>
  <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>Tag older entries with their sector</h3><p class="muted small">Lead entries recorded before sectors were kept are hidden from people limited to certain sectors. This works out each one’s sector from the lead’s own history and adds it, so those people can see that history too. Safe to run more than once.</p></div>
    <button class="btn" data-act="pg-tag" ${p.busy ? 'disabled' : ''}>Tag older entries</button></div></section>`;
}

function viewAdmin(el) {
  const sub = ADMIN_PAGES[S.sub] ? S.sub : '';
  if (sub === 'audit' && !S.pg.loaded && !S.pg.loading) loadPurge();
  if (!sub) {
    const pend = S.users.filter((u) => u.role === 'pending').length;
    el.innerHTML = `${head('Admin', 'Manage who can access the tracker, what they can do, and the data behind it.')}
    ${migrationPending().any ? '<a class="admin-banner" href="#/admin/lists"><b>Stages need updating</b> to the simplified 10-stage list <span>Review &rsaquo;</span></a>' : ''}
    ${pend ? `<a class="admin-banner" href="#/admin/users"><b>${pend} ${pend === 1 ? 'person is' : 'people are'}</b> waiting for approval <span>Review &rsaquo;</span></a>` : ''}
    <div class="admin-grid">${Object.entries(ADMIN_PAGES).map(([k, p]) => `<a class="admin-card" href="#/admin/${k}"><span class="ac-ico">${adminIcon(p.icon)}</span>
      <span class="ac-body"><strong>${esc(p.title)}</strong><span class="ac-blurb">${esc(p.blurb)}</span><span class="ac-stat">${adminStat(k)}</span></span><span class="ac-go" aria-hidden="true">&rsaquo;</span></a>`).join('')}</div>`;
    return;
  }
  const p = ADMIN_PAGES[sub];
  const body = { users: usersPanel, permissions: () => accessPanels().perms, sectors: () => accessPanels().matrix2, lists: listsPanel, finance: financePanel, audit: purgePanel, data: dataPanel }[sub]();
  el.innerHTML = `<a class="back-link" href="#/admin">&lsaquo; Back to Admin</a>${head(p.title, p.blurb)}<div class="admin-sub">${body}</div>`;
}

/* =====================================================================
   Drawer
   ===================================================================== */
function closeDrawer() { S.openLead = null; $('#drawer').hidden = true; $('#scrim').hidden = true; }
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden && !$('#dlg').open && !$('#confirm').open) closeDrawer(); });

function renderDrawer(l) {
  const dr = $('#drawer'), wasHidden = dr.hidden;
  const prevScroll = dr.scrollTop;
  const draft = $('#noteText')?.value || '';
  dr.hidden = false; $('#scrim').hidden = false;
  if (!wasHidden) dr.style.animation = 'none';
  const url = safeUrl(l.website);
  const tl = [...(l.timeline || [])].reverse();
  dr.innerHTML = `<div class="drawer-head"><div class="top"><div><h2 style="font-size:var(--fs-xl)">${esc(l.company)}</h2><div class="row" style="margin-top:6px">${chip(l.stage)}${mySectors() ? '' : `<span class="muted small">Lead #${esc(l.no ?? '')}</span>`}${needsAttention(l) ? `<span class="tag-warn">${esc(needsAttention(l))}</span>` : ''}</div></div>
    <button class="btn ghost sm" data-close aria-label="Close details">Close</button></div>
    ${can('leads_edit') || can('leads_delete') ? `<div class="row" style="margin-top:12px">${can('leads_edit') ? `<button class="btn sm" data-edit="${l.id}">Edit lead</button>` : ''}${can('leads_delete') ? `<button class="btn sm danger" data-del="${l.id}">Delete</button>` : ''}</div>` : ''}</div>
  <div class="drawer-body">
    ${dateTiles(l)}
    <dl class="kv" style="margin:0">
      <div><dt>Country</dt><dd>${esc(l.country || '—')}</dd></div><div><dt>Sector</dt><dd>${esc(l.sector || '—')}</dd></div>
      <div><dt>Platform</dt><dd>${esc(l.platform || '—')}</dd></div><div><dt>Account manager</dt><dd>${esc(l.manager || '—')}</dd></div>
      <div><dt>Estimated value</dt><dd>${esc(moneyFull(l.valueAmount, l.currency || 'AUD') || '—')}${l.valueNotes ? `<div class="muted small prose">${esc(l.valueNotes)}</div>` : ''}</dd></div>
      <div><dt>Website</dt><dd>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '—'}</dd></div>
      <div><dt>HubSpot Record ID</dt><dd class="num">${esc(l.hubspotId || '—')}</dd></div>
      <div class="full"><dt>Customer contacts</dt><dd class="prose">${esc(l.contacts || '—')}</dd></div>
      <div class="full"><dt>Project overview</dt><dd class="prose" style="font-weight:400">${esc(l.overview || '—')}</dd></div>
    </dl>
    ${can('leads_edit') ? `<div><h3 style="margin-bottom:8px">Post an update</h3>
      <div class="row" style="margin-bottom:8px"><label class="field" style="flex:1"><span>Stage</span><select id="quickStage">${stages().map((s) => `<option ${l.stage === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field"><span>Next follow-up</span><input type="date" id="quickFollow" value="${esc(l.nextFollowUp || '')}"></label></div>
      <textarea id="noteText" placeholder="What happened? Who said what? What’s next?" aria-label="Update text">${esc(draft)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" data-post="${l.id}">Post update</button></div></div>` : ''}
    <div><h3 style="margin-bottom:12px">History</h3>${tl.length ? `<ul class="timeline">${tl.map((t) => `<li class="${esc(t.type)}"><div class="when">${esc(fmtDate(t.at))} · ${esc(t.by || '')}</div><div class="prose">${esc(t.text)}</div></li>`).join('')}</ul>` : '<p class="muted">No history yet.</p>'}</div>
  </div>`;
  dr.scrollTop = prevScroll;
  if (wasHidden) { dr.style.animation = ''; dr.querySelector('[data-close]')?.focus(); }
}

/* =====================================================================
   Writes
   ===================================================================== */
const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: S.profile.email });
const entry = (type, text) => ({ at: new Date().toISOString(), by: S.profile.name || S.profile.email, type, text });

// Every change is written together with its audit entry in one batch, so a change can't be saved without being logged.
// Lead entries also record the lead's sector, so people limited to certain sectors can be shown only their own sectors' entries.
function auditOp(entity, id, label, action, changes = [], extra = {}) {
  const sector = entity === 'lead' ? { sector: String(extra.sector ?? S.leads.find((l) => l.id === id)?.sector ?? '') } : {};
  return [doc(collection(db, 'audit')), { at: serverTimestamp(), by: S.user.email, byName: S.profile.name || S.user.email, entity, entityId: id || '', label: clip(label, 200), action, changes: changes.slice(0, 40), ...extra, ...sector }];
}
async function commit(writes, audits = []) {
  const b = writeBatch(db);
  writes.forEach(([kind, ref, data, opts]) => (kind === 'delete' ? b.delete(ref) : kind === 'update' ? b.update(ref, data) : opts ? b.set(ref, data, opts) : b.set(ref, data)));
  audits.forEach(([ref, data]) => b.set(ref, data));
  await b.commit();
}
const logOnly = (...a) => { try { commit([], [auditOp(...a)]).catch(() => {}); } catch {} };

async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) { toast(friendly(e), true); return false; }
}
async function confirmRevert(sel, prev, title, msg, ok) {
  if (await confirmBox(title, msg, ok)) return true;
  sel.value = prev ?? ''; return false;
}
async function changeStage(l, stage, { undo = false, quiet = false } = {}) {
  const text = `Stage: ${l.stage || 'none'} → ${stage || 'none'}${undo ? ' (undone)' : ''}`;
  return run(() => commit([['update', doc(db, 'leads', l.id), { stage, timeline: arrayUnion(entry('stage', text)), ...stamp() }]],
    [auditOp('lead', l.id, l.company, 'stage', [{ f: 'stage', from: clip(l.stage), to: clip(stage) }], undo ? { note: 'Move undone' } : {})]), quiet ? null : `Moved to ${stage}`);
}
// After a drag on the pipeline: highlight the card and column, say exactly what changed, and offer Undo.
function announceMove(l, from, to) {
  S.flash = { id: l.id, from: from || 'No stage', to };
  clearTimeout(S.flashT); S.flashT = setTimeout(() => { S.flash = null; if (S.route === 'pipeline') render(); }, 12000);
  render();
  requestAnimationFrame(() => $(`.lead-card[data-id="${l.id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
  toastAction(`<b>${esc(l.company)}</b> was moved<span class="mv"><span class="from">${esc(from || 'No stage')}</span> → <span class="to">${esc(to)}</span></span><span class="mvs">Moved by accident? Undo it.</span>`, 'Undo', async () => {
    const cur = S.leads.find((x) => x.id === l.id);
    if (!cur) return;
    if (cur.stage !== to) return toast(`Can’t undo: “${l.company}” has since moved to ${cur.stage || 'no stage'}.`, true);
    if (!await confirmBox('Undo move', `Move “${l.company}” back from ${to} to ${from || 'No stage'}?`, 'Undo move')) return;
    if (await changeStage(cur, from, { undo: true, quiet: true })) {
      S.flash = { id: l.id, from: to, to: from, undone: true };
      clearTimeout(S.flashT); S.flashT = setTimeout(() => { S.flash = null; if (S.route === 'pipeline') render(); }, 8000);
      render(); toast(`Moved “${l.company}” back to ${from || 'no stage'}`);
    }
  }, 12000);
}
async function saveLead(data, existing) {
  if (!existing) {
    const no = Math.max(0, ...S.leads.map((l) => Number(l.no) || 0)) + 1;
    const timeline = [entry('created', 'Lead created')];
    if (data.update) timeline.push(entry('update', data.update));
    const ref = doc(collection(db, 'leads'));
    return run(() => commit([['set', ref, { ...data, no, timeline, createdAt: serverTimestamp(), ...stamp() }]], [auditOp('lead', ref.id, data.company, 'create', setFields(data, LEAD_FIELDS), { sector: data.sector || '' })]), 'Lead added');
  }
  const add = [];
  if (data.stage !== existing.stage) add.push(entry('stage', `Stage: ${existing.stage || 'none'} → ${data.stage || 'none'}`));
  if (data.update && data.update !== existing.update) add.push(entry('update', data.update));
  const changes = diffFields(existing, data, LEAD_FIELDS);
  const action = changes.length === 1 && changes[0].f === 'stage' ? 'stage' : 'update';
  return run(() => commit([['update', doc(db, 'leads', existing.id), { ...data, ...(add.length ? { timeline: arrayUnion(...add) } : {}), ...stamp() }]],
    changes.length ? [auditOp('lead', existing.id, data.company, action, changes, { sector: data.sector || '' })] : []), 'Lead saved');
}
async function postUpdate(l) {
  const text = $('#noteText').value.trim(), stage = $('#quickStage').value, follow = $('#quickFollow').value;
  const add = [], changes = [];
  if (stage !== l.stage) { add.push(entry('stage', `Stage: ${l.stage || 'none'} → ${stage}`)); changes.push({ f: 'stage', from: clip(l.stage), to: clip(stage) }); }
  if (follow !== (l.nextFollowUp || '')) changes.push({ f: 'nextFollowUp', from: clip(l.nextFollowUp), to: clip(follow) });
  if (text) { add.push(entry('update', text)); changes.push({ f: 'update', from: clip(l.update), to: clip(text) }); }
  if (!changes.length) return toast('Nothing to post yet. Write an update or change the stage.', true);
  if (!await confirmBox('Post update', `Post this update to “${l.company}”?\n\n${chText(changes)}`, 'Post update')) return;
  const patch = { stage, nextFollowUp: follow, ...stamp() };
  if (text) patch.update = text;
  if (add.length) patch.timeline = arrayUnion(...add);
  const ok = await run(() => commit([['update', doc(db, 'leads', l.id), patch]], [auditOp('lead', l.id, l.company, changes.length === 1 && changes[0].f === 'stage' ? 'stage' : 'update', changes)]), 'Update posted');
  if (ok) $('#noteText').value = '';
}
async function deleteLead(l) {
  closeDrawer();
  await run(() => commit([['delete', doc(db, 'leads', l.id)]], [auditOp('lead', l.id, l.company, 'delete', goneFields(l, LEAD_FIELDS.filter(([k]) => LEAD_KEY.includes(k))), { note: 'Lead and its history permanently deleted' })]), 'Lead deleted');
}

/* =====================================================================
   Dialogs
   ===================================================================== */
const dlg = $('#dlg'), cdlg = $('#confirm');
// Lists what is about to change, one line each: "• Stage: Qualify Lead → POC".
const chText = (ch, max = 12) => ch.slice(0, max).map((c) => `• ${FL[c.f] || c.f}: ${c.from ? clip(c.from, 60) : '(empty)'} → ${c.to ? clip(c.to, 60) : '(empty)'}`).join('\n') + (ch.length > max ? `\n…and ${ch.length - max} more` : '');
// Every change asks first. Delete / remove / disable use the red button, everything else the normal one.
function confirmBox(title, msg, okLabel = 'Delete', danger = /delet|remov|disabl|cancel invite|purge/i.test(okLabel)) {
  return new Promise((res) => {
    cdlg.innerHTML = `<form method="dialog"><div class="dlg-head"><h2>${esc(title)}</h2></div><div class="dlg-body"><p style="white-space:pre-line">${esc(msg)}</p></div>
      <div class="dlg-foot"><button class="btn" value="no" autofocus>Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}" value="yes">${esc(okLabel)}</button></div></form>`;
    cdlg.onclose = () => res(cdlg.returnValue === 'yes');
    cdlg.returnValue = ''; cdlg.showModal();
  });
}
const opts = (list, cur, blank = true, addNew = false) => `${blank ? '<option value="">—</option>' : ''}${[...new Set([...list, ...(cur && !list.includes(cur) ? [cur] : [])])].map((o) => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}${addNew && isAdmin() ? '<option value="__new__">+ Add new…</option>' : ''}`;

function leadForm(l = null) {
  const v = l || { date: today(), currency: S.lists.currencies[0] || 'AUD', stage: stages()[0] };
  dlg.innerHTML = `<form id="leadForm" method="dialog"><div class="dlg-head"><h2>${l ? 'Edit lead' : 'Add lead'}</h2></div>
  <div class="dlg-body">
    <label class="field full"><span>Customer company name *</span><input type="text" name="company" required value="${esc(v.company)}"></label>
    <label class="field"><span>Stage</span><select name="stage" data-addnew="stages">${opts(stages(), v.stage, false, true)}</select></label>
    <label class="field"><span>Date logged</span><input type="date" name="date" value="${esc(v.date || '')}"></label>
    <label class="field"><span>Sector</span><select name="sector" data-addnew="sectors">${mySectors() ? opts(mySectors(), v.sector, false, false) : opts(S.lists.sectors, v.sector, true, true)}</select></label>
    <label class="field"><span>Platform</span><select name="platform" data-addnew="platforms">${opts(S.lists.platforms, v.platform, true, true)}</select></label>
    <label class="field"><span>Country</span><select name="country" data-addnew="countries">${opts(S.lists.countries, v.country, true, true)}</select></label>
    <label class="field"><span>Account manager</span><select name="manager" data-addnew="managers">${opts(S.lists.managers, v.manager, true, true)}</select></label>
    <label class="field"><span>Estimated value</span><input type="number" name="valueAmount" min="0" step="any" value="${v.valueAmount ?? ''}"></label>
    <label class="field"><span>Currency</span><select name="currency" data-addnew="currencies">${opts(S.lists.currencies, v.currency || S.lists.currencies[0], false, true)}</select></label>
    <label class="field full"><span>Value notes (year 1, recurring, phases…)</span><input type="text" name="valueNotes" value="${esc(v.valueNotes)}"></label>
    <label class="field"><span>Website</span><input type="text" name="website" placeholder="example.com" value="${esc(v.website)}"></label>
    <label class="field"><span>HubSpot Record ID</span><input type="text" name="hubspotId" inputmode="numeric" autocomplete="off" placeholder="e.g. 12345678901" value="${esc(v.hubspotId)}"></label>
    <label class="field"><span>Next follow-up</span><input type="date" name="nextFollowUp" value="${esc(v.nextFollowUp || '')}"></label>
    <label class="field"><span>Expected close date</span><input type="date" name="expectedClose" value="${esc(v.expectedClose || '')}"></label>
    <label class="field"><span>Probability % (blank = stage default)</span><input type="number" name="probability" min="0" max="100" step="1" value="${v.probability ?? ''}"></label>
    <label class="field"><span>Deal type</span><select name="dealType">${opts(DEAL_TYPES, v.dealType, true, false)}</select></label>
    <label class="field"><span>Effort size (S, M, L)</span><select name="effort">${opts(EFFORTS, v.effort, true, false)}</select></label>
    <label class="field full"><span>Loss reason (required when the stage is Lost)</span><input type="text" name="lossReason" value="${esc(v.lossReason)}"></label>
    <label class="field full"><span>Customer contacts (one per line)</span><textarea name="contacts" style="min-height:56px">${esc(v.contacts)}</textarea></label>
    <label class="field full"><span>Project overview</span><textarea name="overview">${esc(v.overview)}</textarea></label>
    <label class="field full"><span>Latest update / action</span><textarea name="update">${esc(v.update)}</textarea></label>
  </div>
  <div class="dlg-foot"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">${l ? 'Save changes' : 'Add lead'}</button></div></form>`;
  dlg.showModal();
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  $('#leadForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const data = {
      company: f.company.trim(), stage: f.stage, date: f.date, sector: f.sector, platform: f.platform, country: f.country.trim(), manager: f.manager.trim(),
      valueAmount: f.valueAmount === '' ? null : Number(f.valueAmount), currency: f.currency, valueNotes: f.valueNotes.trim(), website: f.website.trim(), hubspotId: (f.hubspotId || '').trim(),
      nextFollowUp: f.nextFollowUp, expectedClose: f.expectedClose || '', probability: f.probability === '' ? null : Math.min(100, Math.max(0, Math.round(Number(f.probability)))), dealType: f.dealType || '', effort: f.effort || '', lossReason: (f.lossReason || '').trim(), contacts: f.contacts.trim(), overview: f.overview.trim(), update: f.update.trim(),
    };
    if (!data.company) return toast('Enter the company name.', true);
    if (data.stage === 'Lost' && !data.lossReason) return toast('Add a loss reason for a Lost lead.', true);
    if (data.hubspotId && S.leads.some((x) => x.id !== l?.id && (x.hubspotId || '') === data.hubspotId)
      && !await confirmBox('Duplicate HubSpot ID', `Another lead already uses HubSpot Record ID ${data.hubspotId}. Save anyway?`, 'Save anyway')) return;
    const ch = l ? diffFields(l, data, LEAD_FIELDS) : [];
    if (!await confirmBox(l ? 'Save changes' : 'Add lead', l ? `Save changes to “${data.company}”?${ch.length ? '\n\n' + chText(ch) : ''}` : `Add “${data.company}” as a new lead${data.stage ? ' at ' + data.stage : ''}?`, l ? 'Save changes' : 'Add lead')) return;
    if (await saveLead(data, l)) dlg.close();
  };
}

function actionForm(a = null) {
  const v = a || { created: today(), status: 'Open' };
  dlg.innerHTML = `<form id="actForm" method="dialog"><div class="dlg-head"><h2>${a ? 'Edit action item' : 'Add action item'}</h2></div>
  <div class="dlg-body">
    <label class="field full"><span>Action item *</span><textarea name="title" required>${esc(v.title)}</textarea></label>
    <label class="field"><span>Owner</span><input type="text" name="owner" value="${esc(v.owner)}"></label>
    <label class="field"><span>Status</span><select name="status">${opts(S.lists.statuses, v.status, false)}</select></label>
    <label class="field"><span>Created</span><input type="date" name="created" value="${esc(v.created || '')}"></label>
    <label class="field"><span>Due</span><input type="date" name="dueDate" value="${esc(v.dueDate || '')}"></label>
    <label class="field full"><span>Comments</span><textarea name="comments">${esc(v.comments)}</textarea></label>
  </div>
  <div class="dlg-foot"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">${a ? 'Save changes' : 'Add action item'}</button></div></form>`;
  dlg.showModal();
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  $('#actForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const data = { title: f.title.trim(), owner: f.owner.trim(), status: f.status, created: f.created, dueDate: f.dueDate, comments: f.comments.trim() };
    if (!data.title) return toast('Describe the action item.', true);
    const ach = a ? diffFields(a, data, ACTION_FIELDS) : [];
    if (!await confirmBox(a ? 'Save action item' : 'Add action item', a ? `Save changes to action item #${a.no}?${ach.length ? '\n\n' + chText(ach) : ''}` : `Add this action item${data.owner ? ' for ' + data.owner : ''}?`, a ? 'Save changes' : 'Add')) return;
    const ok = await run(async () => {
      if (a) {
        const ch = diffFields(a, data, ACTION_FIELDS);
        await commit([['update', doc(db, 'actions', a.id), { ...data, ...stamp() }]], ch.length ? [auditOp('action', a.id, `#${a.no} ${data.title}`, 'update', ch)] : []);
      } else {
        const nums = S.actions.map((x) => parseInt(x.no, 10)).filter((n) => !isNaN(n)), no = String(Math.max(0, ...nums) + 1), ref = doc(collection(db, 'actions'));
        await commit([['set', ref, { ...data, no, createdAt: serverTimestamp(), ...stamp() }]], [auditOp('action', ref.id, `#${no} ${data.title}`, 'create', setFields(data, ACTION_FIELDS))]);
      }
    }, a ? 'Action item saved' : 'Action item added');
    if (ok) dlg.close();
  };
}

const USER_ROLES = ['viewer', 'editor', 'admin'];
function userForm({ user = null, invite = null } = {}) {
  const v = user || invite || { role: 'viewer' };
  const editing = !!(user || invite);
  const roles = user ? ['pending', ...USER_ROLES, 'disabled'] : USER_ROLES;
  dlg.innerHTML = `<form id="userForm" method="dialog"><div class="dlg-head"><h2>${user ? 'Edit user' : invite ? 'Edit invite' : 'Add user'}</h2></div>
  <div class="dlg-body">
    <label class="field full"><span>Full name</span><input type="text" name="name" value="${esc(v.name)}"></label>
    <label class="field full"><span>Email *</span><input type="email" name="email" required value="${esc(v.email)}" ${editing ? 'readonly' : ''}></label>
    <label class="field full"><span>Role</span><select name="role" ${user && user.id === S.user.uid ? 'disabled' : ''}>${roles.map((r) => `<option ${v.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <fieldset class="field full sectors-field"><span>Sector access</span><div class="row">${(S.lists.sectors || []).map((x) => `<label class="check"><input type="checkbox" name="sector" value="${esc(x)}" ${(v.sectors?.length ? v.sectors.includes(x) : true) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</div><span class="muted small">Untick a sector to hide its leads from this person. Admins always see everything.</span></fieldset>
    ${user && user.id === S.user.uid ? '<p class="muted small full">You can’t change your own role.</p>' : ''}${editing ? '<p class="muted small full">The email can’t be changed because it is the person’s sign-in. To use a different email, remove this and add a new one.</p>'
      : '<p class="muted small full">This doesn’t create a login. Tell the person to open the site and <b>Create account</b> (or use Google) with this exact email. They’ll get this role as soon as they verify it, with no approval step.</p>'}
  </div>
  <div class="dlg-foot"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">${editing ? 'Save changes' : 'Add user'}</button></div></form>`;
  dlg.showModal();
  $('[data-cancel]', dlg).onclick = () => dlg.close();
  $('#userForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target), f = Object.fromEntries(fd);
    const name = f.name.trim(), email = f.email.trim().toLowerCase(), role = f.role ?? user?.role;
    const picked = fd.getAll('sector'), all = S.lists.sectors || [];
    if (!picked.length && all.length) return toast('Tick at least one sector.', true);
    const sectors = role === 'admin' || picked.length >= all.length ? [] : picked; // empty = every sector
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email address.', true);
    if (user) {
      if (user.id === S.user.uid && role !== user.role) return toast('You can’t change your own role.', true);
      const patch = { name: name || user.email, role, sectors };
      if (role === 'disabled' && user.role !== 'disabled') patch.prevRole = user.role;
      if (role !== 'disabled') patch.prevRole = deleteField();
      const ch = diffFields({ name: user.name, role: user.role, sectors: user.sectors || [] }, { name: patch.name, role, sectors }, [['name'], ['role'], ['sectors']]);
      if (!await confirmBox('Save user', `Save changes to ${user.email}?${ch.length ? '\n\n' + chText(ch) : ''}`, 'Save changes')) return;
      if (await run(() => commit([['update', doc(db, 'users', user.id), patch]], ch.length ? [auditOp('user', user.id, user.email, ch.some((c) => c.f === 'role') ? 'role' : 'update', ch)] : []), 'User saved')) dlg.close();
      return;
    }
    if (!invite && S.users.some((u) => (u.email || '').toLowerCase() === email)) return toast('That person already has an account. Change their role in the table.', true);
    if (!invite && S.invites.some((i) => i.id === email)) return toast('That email is already invited. Edit the invite instead.', true);
    const ich = invite ? diffFields({ name: invite.name, role: invite.role, sectors: invite.sectors || [] }, { name, role, sectors }, [['name'], ['role'], ['sectors']]) : setFields({ name, role, sectors }, [['name'], ['role'], ['sectors']]);
    if (!await confirmBox(invite ? 'Save invite' : 'Add user', invite ? `Save changes to the invite for ${email}?${ich.length ? '\n\n' + chText(ich) : ''}` : `Add ${email} as ${role}${sectors.length ? ' (' + sectors.join(', ') + ' only)' : ''}? They get this access when they create an account with this email.`, invite ? 'Save changes' : 'Add user')) return;
    if (await run(() => commit([['set', doc(db, 'invites', email), { email, name, role, sectors, invitedBy: S.profile.email, createdAt: invite?.createdAt || serverTimestamp() }]],
      ich.length || !invite ? [auditOp('invite', email, email, invite ? 'update' : 'create', ich)] : []), invite ? 'Invite saved' : 'User added. Ask them to create their account with this email.')) dlg.close();
  };
}

function askText(title, label, okLabel = 'Add') {
  return new Promise((res) => {
    cdlg.innerHTML = `<form method="dialog"><div class="dlg-head"><h2>${esc(title)}</h2></div><div class="dlg-body"><label class="field full"><span>${esc(label)}</span><input type="text" name="v" required autofocus autocomplete="off"></label></div>
      <div class="dlg-foot"><button class="btn" type="button" data-askcancel>Cancel</button><button class="btn primary" value="ok">${esc(okLabel)}</button></div></form>`;
    cdlg.onclose = () => res(cdlg.returnValue === 'ok' ? cdlg.querySelector('[name=v]').value.trim() : null);
    cdlg.returnValue = ''; cdlg.showModal();
    $('[data-askcancel]', cdlg).onclick = () => cdlg.close();
  });
}
async function addListItem(key, val) {
  val = (val || '').trim();
  if (!val) return null;
  const cur = S.lists[key] || [], dup = cur.find((x) => x.toLowerCase() === val.toLowerCase());
  if (dup) { toast(`“${dup}” is already in the list.`, true); return dup; }
  const title = LIST_DEFS.find((d) => d[0] === key)?.[1] || key;
  if (!await confirmBox('Add to list', `Add “${val}” to ${title}?`, 'Add')) return null;
  const ok = await run(() => commit([['set', doc(db, 'settings', 'lists'), { [key]: [...cur, val] }, { merge: true }]], [auditOp('list', key, title, 'settings', [{ f: 'Added', from: '', to: val }])]), `Added “${val}”`);
  return ok ? val : null;
}
async function saveDraft() {
  const k = S.editList, def = LIST_DEFS.find((d) => d[0] === k);
  const rows = S.draft.map((r) => ({ o: r.o, v: r.v.trim() })).filter((r) => r.v);
  const seen = new Set();
  const dup = rows.find((r) => { const key = r.v.toLowerCase(); if (seen.has(key)) return true; seen.add(key); return false; });
  if (dup) return toast(`“${dup.v}” appears twice.`, true);
  if (LIST_REQUIRED.includes(k) && !rows.length) return toast(`${def[1]} needs at least one item.`, true);
  const coll = k === 'statuses' ? 'actions' : 'leads', field = def[2], records = S[coll];
  const renames = rows.filter((r) => r.o && r.o !== r.v);
  const targets = renames.flatMap((r) => records.filter((x) => x[field] === r.o).map((x) => [x.id, r.v]));
  const kept = new Set(rows.map((r) => r.o).filter(Boolean));
  const removed = (S.lists[k] || []).filter((o) => !kept.has(o));
  const orphaned = records.filter((x) => removed.includes(x[field])).length;
  const lc = [];
  rows.filter((r) => !r.o).forEach((r) => lc.push({ f: 'Added', from: '', to: r.v }));
  renames.forEach((r) => lc.push({ f: 'Renamed', from: r.o, to: r.v }));
  removed.forEach((o) => lc.push({ f: 'Removed', from: o, to: '' }));
  if (!lc.length && JSON.stringify(rows.map((r) => r.v)) !== JSON.stringify(S.lists[k] || [])) lc.push({ f: 'Reordered', from: '', to: clip(rows.map((r) => r.v).join(', ')) });
  if (!lc.length) { S.editList = null; S.draft = []; render(); return toast('No changes to save.'); }
  const parts = [];
    if (targets.length) parts.push(`${plural(targets.length, 'record')} will be renamed to match.`);
    if (orphaned) parts.push(`${plural(orphaned, 'record')} still use a removed item. They keep the value, but it won’t appear in the dropdown.`);
  if (!await confirmBox('Save changes to ' + def[1], chText(lc) + (parts.length ? '\n\n' + parts.join(' ') : ''), 'Save')) return;
  const ok = await run(async () => {
    await setDoc(doc(db, 'settings', 'lists'), { [k]: rows.map((r) => r.v) }, { merge: true });
    for (let i = 0; i < targets.length; i += 400) {
      const b = writeBatch(db);
      targets.slice(i, i + 400).forEach(([id, val]) => b.update(doc(db, coll, id), { [field]: val, ...stamp() }));
      await b.commit();
    }
    if (k === 'sectors' && renames.length) { // keep people's sector access pointing at the renamed sector
      const map = Object.fromEntries(renames.map((r) => [r.o, r.v])), b = writeBatch(db); let n = 0;
      [['users', S.users], ['invites', S.invites]].forEach(([c, arr]) => arr.filter((x) => x.sectors?.some((y) => map[y])).forEach((x) => { b.update(doc(db, c, x.id), { sectors: x.sectors.map((y) => map[y] || y) }); n++; }));
      if (n) await b.commit();
    }
    if (lc.length) await commit([], [auditOp('list', k, def[1], 'settings', lc, targets.length ? { note: `${plural(targets.length, 'record')} renamed to match` } : {})]);
  }, `${def[1]} saved`);
  if (ok) { S.editList = null; S.draft = []; render(); }
}
async function saveSectors() {
  const all = S.lists.sectors || [];
  const changes = [];
  for (const [key, set] of Object.entries(S.secDraft)) {
    const [kind, id] = [key[0], key.slice(2)];
    const rec = kind === 'u' ? S.users.find((x) => x.id === id) : S.invites.find((x) => x.id === id);
    if (!rec || rec.role === 'admin') continue;
    if (!set.size && all.length) return toast(`Tick at least one sector for ${rec.email}.`, true);
    const next = all.every((x) => set.has(x)) ? [] : all.filter((x) => set.has(x));
    const cur = rec.sectors?.length ? rec.sectors : [];
    if (JSON.stringify(next) !== JSON.stringify(cur)) changes.push([doc(db, kind === 'u' ? 'users' : 'invites', id), { sectors: next }, auditOp(kind === 'u' ? 'user' : 'invite', id, rec.email || id, 'role', [{ f: 'sectors', from: clip(cur), to: clip(next) }])]);
  }
  if (!changes.length) { S.secDraft = null; return render(); }
  const sl = changes.slice(0, 12).map((c) => { const x = c[2][1], k = x.changes[0]; return `• ${x.label}: ${k.from || '(none)'} → ${k.to || '(none)'}`; }).join('\n') + (changes.length > 12 ? `\n…and ${changes.length - 12} more` : '');
  if (!await confirmBox('Save sector access', `Change sector access for ${plural(changes.length, 'user')}?\n\n${sl}`, 'Save')) return;
  const ok = await run(async () => {
    for (let i = 0; i < changes.length; i += 200) { const part = changes.slice(i, i + 200); await commit(part.map(([ref, d]) => ['update', ref, d]), part.map((c) => c[2])); }
  }, `Sector access saved (${changes.length} changed)`);
  if (ok) { S.secDraft = null; render(); }
}
async function syncFromLeads() {
  const patch = {}, notes = [], lch = [];
  [['sectors', 'sector'], ['platforms', 'platform'], ['countries', 'country'], ['managers', 'manager']].forEach(([k, f]) => {
    const cur = S.lists[k] || [], have = new Set(cur.map((x) => x.toLowerCase()));
    const add = uniq(S.leads.map((l) => l[f])).filter((x) => !have.has(x.toLowerCase()));
    if (add.length) { patch[k] = [...cur, ...add]; notes.push(`${add.length} to ${k}`); lch.push({ f: 'Added', from: '', to: clip(`${k}: ${add.join(', ')}`) }); }
  });
  if (!notes.length) return toast('Every value the leads use is already in the lists.');
  if (!await confirmBox('Add values from leads', `This adds ${notes.join(', ')}. Continue?`, 'Add')) return;
  await run(() => commit([['set', doc(db, 'settings', 'lists'), patch, { merge: true }]], [auditOp('list', '', 'Values taken from leads', 'settings', lch)]), 'Lists updated');
}

/* =====================================================================
   Export / import
   ===================================================================== */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv() {
  const cols = [['no', 'No.'], ['date', 'Date'], ['company', 'Customer Company Name'], ['hubspotId', 'HubSpot Record ID'], ['update', 'Latest update'], ['website', 'Website'], ['valueAmount', 'Est. value'], ['currency', 'Currency'], ['valueNotes', 'Value notes'],
    ['overview', 'Project overview'], ['sector', 'RFID sector'], ['platform', 'Platform'], ['stage', 'Stage'], ['country', 'Country'], ['manager', 'Account manager'], ['contacts', 'Customer details'], ['nextFollowUp', 'Next follow-up'],
    ['expectedClose', 'Expected close'], ['dealType', 'Deal type'], ['probabilityOverride', 'Probability % (override)', (l) => l.probability ?? ''], ['probabilityUsed', 'Probability % (used)', (l) => probOf(l)],
    ['valueBase', `Est. value (${fin().base})`, (l) => { const v = valBase(l); return v == null ? 'No rate' : Math.round(v); }], ['effort', 'Effort size'], ['lossReason', 'Loss reason']];
  const q = (v) => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
  const csv = [cols.map((c) => q(c[1])).join(','), ...filteredLeads().map((l, i) => cols.map(([k, , fn]) => q(fn ? fn(l) : k === 'no' && mySectors() ? i + 1 : l[k])).join(','))].join('\r\n');
  download(`rfid-leads-${today()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  logOnly('data', '', 'Leads CSV', 'export', [], { note: `${filteredLeads().length} leads exported to CSV` });
}
function pickImport() { const f = $('#importFile'); f.value = ''; f.click(); }
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('That file isn’t valid JSON.', true); }
  const leads = Array.isArray(data.leads) ? data.leads : [], actions = Array.isArray(data.actions) ? data.actions : [];
  if (!leads.length && !actions.length) return toast('No leads or action items found in that file.', true);
  const ok = await confirmBox('Import data', `This adds ${leads.length} leads and ${actions.length} action items${S.leads.length || S.actions.length ? '. Records imported before are overwritten with the file’s values, so edits made to them in the app will be lost' : ''}. Continue?`, 'Import');
  if (!ok) return;
  const by = S.profile.name || S.profile.email, at = '2026-11-02T00:00:00.000Z';
  const strip = ({ id, createdAt, updatedAt, updatedBy, ...rest }) => rest;
  const ops = [];
  leads.forEach((l, i) => {
    if (!l.company) return;
    const timeline = Array.isArray(l.timeline) && l.timeline.length ? l.timeline : [{ at: l.date ? l.date + 'T00:00:00.000Z' : at, by: 'Imported', type: 'created', text: 'Lead logged (imported)' }, ...(l.update ? [{ at, by: 'Imported', type: 'update', text: l.update }] : [])];
    ops.push([doc(db, 'leads', `import-lead-${l.no ?? i + 1}`), { ...strip(l), timeline, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: by }]);
  });
  actions.forEach((a, i) => { if (a.title) ops.push([doc(db, 'actions', `import-action-${a.no ?? i + 1}`), { ...strip(a), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: by }]); });
  if (data.lists && typeof data.lists === 'object') ops.push([doc(db, 'settings', 'lists'), { ...S.lists, ...data.lists }]);
  else ops.push([doc(db, 'settings', 'lists'), S.lists]);
  if (data.finance && typeof data.finance === 'object') ops.push([doc(db, 'settings', 'finance'), data.finance]);
  await run(async () => {
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db); ops.slice(i, i + 400).forEach(([ref, d]) => b.set(ref, d)); await b.commit();
    }
    await commit([], [auditOp('data', '', 'Import from file', 'import', [], { note: `${leads.length} leads and ${actions.length} action items imported` })]);
  }, `Imported ${leads.length} leads and ${actions.length} action items`);
}
function backup() {
  logOnly('data', '', 'Full backup', 'export', [], { note: `${S.leads.length} leads and ${S.actions.length} action items downloaded as JSON` });
  const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && 'seconds' in v && 'nanoseconds' in v ? new Date(v.seconds * 1000).toISOString() : v)));
  download(`rfid-tracker-backup-${today()}.json`, JSON.stringify(clean({ exportedAt: new Date().toISOString(), lists: S.lists, finance: S.fin || null, leads: S.leads, actions: S.actions }), null, 2), 'application/json');
}

/* =====================================================================
   Event delegation
   ===================================================================== */
document.addEventListener('click', async (e) => {
  if (S.colOpen && !e.target.closest('#colpop') && !e.target.closest('[data-colf]')) closeColPop();
  const t = e.target.closest('button, [data-open], [data-ovf]');
  if (!t) return;
  const d = t.dataset;
  if (d.colf) {
    const [tbl, key] = d.colf.split(':');
    if (S.colOpen?.tbl === tbl && S.colOpen?.key === key) closeColPop(); else { S.colOpen = { tbl, key, built: false }; render(); $('#cp-q')?.focus(); }
    return;
  }
  if (d.cpAll || d.cpNone || d.cpReset || d.cpClose) {
    const o = S.colOpen; if (!o) return;
    const f = colFilter(o.tbl, o.key);
    if (d.cpClose) return closeColPop(true);
    if (d.cpAll) f.vals = null;
    if (d.cpNone) f.vals = [];
    if (d.cpReset) { f.q = ''; f.vals = null; const i = $('#cp-q'); if (i) i.value = ''; }
    return render();
  }
  if (d.act === 'clear-colf-actions') { S.colf.actions = {}; closeColPop(); return render(); }
  if (d.scroll) { const b = $('.board'); b?.scrollBy({ left: Number(d.scroll) * Math.max(300, b.clientWidth * .8), behavior: 'smooth' }); return; }
  if (d.stage !== undefined && !t.closest('.col')) { S.filters = { q: '', stage: d.stage, sector: '', country: '', manager: '', platform: '' }; location.hash = '#/leads'; return; }
  if (d.mvwho !== undefined) { S.dash.who = d.mvwho; S.dash.mv.stage = ''; S.dash.mv.q = ''; S.dash.mv.all = ''; try { localStorage.setItem('rfid-who:' + S.user.uid, d.mvwho); } catch {} return render(); }
  if (d.mvset !== undefined) { const i = d.mvset.indexOf(':'), k = d.mvset.slice(0, i), v = d.mvset.slice(i + 1), Mv = S.dash.mv; Mv[k] = k === 'stage' && Mv[k] === v ? '' : v; return render(); }
  if (d.ovf !== undefined) { const i = d.ovf.indexOf('|'), k = d.ovf.slice(0, i), v = d.ovf.slice(i + 1), F = S.dash.ov.f; if (F[k] === v) delete F[k]; else F[k] = v; return render(); }
  if (d.ovclear !== undefined) { S.dash.ov.f = {}; return render(); }
  if (d.ovset) { const i = d.ovset.indexOf(':'); S.dash.ov[d.ovset.slice(0, i)] = d.ovset.slice(i + 1); return render(); }
  if (d.kgo) {
    const [scope, kind] = d.kgo.split(':'), F = {};
    if (kind === 'actions') { S.actFilter = 'active'; S.actQ = ''; S.colf.actions = {}; location.hash = '#/actions'; return; }
    if (scope === 'my') { // the person and stage picked on My view
      const w = S.dash.who || '__all', st = S.dash.mv.stage;
      if (w === '__none') F.manager = 'Unassigned'; else if (w !== '__all') F.manager = w;
      if (st && kind !== 'closed') F.stage = st;
    } else Object.assign(F, S.dash.ov.f); // the filters picked on Overview
    const preset = { open: 'open', value: 'open', attention: 'attention', lost: 'lost', committed: 'committed', closed: 'closed', month: 'month' }[kind];
    return goLeads({ filters: F, preset, sort: kind === 'value' ? { key: 'valueAmount', dir: 'desc' } : { key: 'date', dir: 'desc' } });
  }
  if (d.ovgo) {
    const F = S.dash.ov.f, m = (k) => (F[k] === undefined || F[k] === 'Unassigned' || F[k] === 'Not set' ? '' : F[k]);
    if (d.ovgo === 'attention' || d.ovgo === 'lost') { S.dash.ov.focus = d.ovgo; render(); requestAnimationFrame(() => $('#ov-focus')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return; }
    return goLeads({ filters: F, preset: d.ovgo === 'new' ? 'month' : '', sort: d.ovgo === 'new' ? { key: 'date', dir: 'desc' } : undefined });
  }
  if (d.dtab) { S.dash.tab = d.dtab; S.dash.sel = null; return render(); }
  if (d.dmode) { S.dash.mode = d.dmode; return render(); }
  if (d.dcur) { S.dash.cur = d.dcur; return render(); }
  if (d.dsel !== undefined) { S.dash.sel = d.dsel === '' || S.dash.sel === d.dsel ? null : d.dsel; return render(); }
  if (d.dmgr !== undefined) { S.filters = { q: '', stage: '', sector: '', country: '', manager: d.dmgr === 'Unassigned' ? '' : d.dmgr, platform: '' }; location.hash = '#/leads'; return; }
  if (d.aexp !== undefined) { S.auExp.has(d.aexp) ? S.auExp.delete(d.aexp) : S.auExp.add(d.aexp); return render(); }
  if (d.apg) { const G = S.apg; G.page = d.apg === 'prev' ? G.page - 1 : d.apg === 'next' ? G.page + 1 : Number(d.apg); render(); window.scrollTo(0, 0); return; }
  if (d.sort) { S.sort = { key: d.sort, dir: S.sort.key === d.sort && S.sort.dir === 'asc' ? 'desc' : 'asc' }; render(); return; }
  if (d.open) { S.openLead = d.open; const l = S.leads.find((x) => x.id === d.open); if (l) renderDrawer(l); return; }
  if (t.hasAttribute('data-close')) return closeDrawer();
  if (d.act === 'new-lead') return leadForm();
  if (d.act === 'new-action') return actionForm();
  if (d.permEdit) { S.permDraft = structuredClone(S.perms); return render(); }
  if (d.permCancel) { S.permDraft = null; return render(); }
  if (d.permSave) {
    const labels = Object.fromEntries(PERM_GROUPS.flatMap(([, items]) => items));
    const ch = PERM_ROLES.flatMap((r) => Object.keys(S.permDraft[r]).filter((k) => !!S.permDraft[r][k] !== !!S.perms[r]?.[k]).map((k) => ({ f: `${r}: ${labels[k] || k}`, from: S.perms[r]?.[k] ? 'Allowed' : 'Not allowed', to: S.permDraft[r][k] ? 'Allowed' : 'Not allowed' })));
    if (!ch.length) { S.permDraft = null; render(); return toast('No changes to save.'); }
    if (!await confirmBox('Save permissions', `Save these permission changes?\n\n${chText(ch)}`, 'Save')) return;
    if (await run(() => commit([['set', doc(db, 'settings', 'permissions'), S.permDraft]], ch.length ? [auditOp('permissions', '', 'Permissions by role', 'settings', ch)] : []), 'Permissions saved')) { S.permDraft = null; render(); }
    return;
  }
  if (d.secEdit !== undefined) {
    const all = S.lists.sectors || [];
    S.secDraft = {};
    [...S.users.map((u) => ['u:' + u.id, u.sectors]), ...S.invites.map((i) => ['i:' + i.id, i.sectors])].forEach(([k, sec]) => { S.secDraft[k] = new Set(sec?.length ? sec : all); });
    return render();
  }
  if (d.secCancel) { S.secDraft = null; return render(); }
  if (d.secSave) return saveSectors();
  if (d.act === 'add-user') return userForm();
  if (d.editUser) return userForm({ user: S.users.find((x) => x.id === d.editUser) });
  if (d.editInvite) return userForm({ invite: S.invites.find((x) => x.id === d.editInvite) });
  if (d.delInvite) { if (await confirmBox('Cancel invite', `Cancel the invite for ${d.delInvite}?`, 'Cancel invite')) await run(() => commit([['delete', doc(db, 'invites', d.delInvite)]], [auditOp('invite', d.delInvite, d.delInvite, 'delete', [], { note: 'Invite cancelled' })]), 'Invite cancelled'); return; }
  if (d.toggleUser) {
    const u = S.users.find((x) => x.id === d.toggleUser), dis = u.role !== 'disabled';
    if (await confirmBox(dis ? 'Disable user' : 'Enable user', dis ? `Disable ${u.email}? They’ll lose access immediately but keep their account.` : `Restore access for ${u.email} as ${u.prevRole || 'viewer'}?`, dis ? 'Disable' : 'Enable'))
      await run(() => commit([['update', doc(db, 'users', u.id), dis ? { role: 'disabled', prevRole: u.role } : { role: u.prevRole || 'viewer', prevRole: deleteField() }]],
        [auditOp('user', u.id, u.email, 'role', [{ f: 'role', from: clip(u.role), to: dis ? 'disabled' : u.prevRole || 'viewer' }])]), dis ? 'User disabled' : 'User enabled');
    return;
  }
  if (d.act === 'export-csv') return exportCsv();
  if (d.act === 'pg-range') return purgeRange();
  if (d.act === 'pg-tag') return tagOldAudit();
  if (d.act === 'pg-selected') return purgeSelected();
  if (d.act === 'pg-more') return loadPurge(true);
  if (d.act === 'pg-clear') { S.pg.from = ''; S.pg.to = ''; S.pg.loaded = false; S.pg.sel.clear(); return render(); }
  if (d.act === 'audit-csv') return exportAuditCsv();
  if (d.act === 'audit-more') { S.auditLimit += 200; stopAudit(); return render(); }
  if (d.act === 'audit-clear') { S.colf.audit = {}; closeColPop(); S.auf = { q: '', entity: '', by: '', action: '', from: '', to: '' }; return render(); }
  if (d.act === 'clear-preset') { S.filters.preset = ''; return render(); }
  if (d.act === 'clear-deal') { S.filters.dealType = ''; return render(); }
  if (d.act === 'clear-filters') { S.colf.leads = {}; closeColPop(); S.filters = { q: '', stage: '', sector: '', country: '', manager: '', platform: '' }; return render(); }
  if (d.act === 'import') return pickImport();
  if (d.act === 'save-fin') return saveFin();
  if (d.act === 'sync-lists') return syncFromLeads();
  if (d.act === 'migrate-stages') return migrateStages();
  if (d.listEdit) { S.editList = d.listEdit; S.draft = (S.lists[d.listEdit] || []).map((v) => ({ o: v, v })); return render(); }
  if (d.listCancel) { S.editList = null; S.draft = []; return render(); }
  if (d.listSave) return saveDraft();
  if (d.listAdd) { const def = LIST_DEFS.find((x) => x[0] === d.listAdd); const v = await askText('Add to ' + def[1], 'Name'); if (v) await addListItem(d.listAdd, v); return; }
  if (d.draftAdd) { S.draft.push({ o: null, v: '' }); render(); $('#dr-' + (S.draft.length - 1))?.focus(); return; }
  if (d.draftDel !== undefined) { S.draft.splice(Number(d.draftDel), 1); return render(); }
  if (d.draftUp !== undefined || d.draftDown !== undefined) {
    const i = Number(d.draftUp ?? d.draftDown), j = d.draftUp !== undefined ? i - 1 : i + 1;
    if (S.draft[j]) { [S.draft[i], S.draft[j]] = [S.draft[j], S.draft[i]]; render(); }
    return;
  }
  if (d.act === 'backup') return backup();
  if (d.edit) return leadForm(S.leads.find((l) => l.id === d.edit));
  if (d.del) {
    const l = S.leads.find((x) => x.id === d.del);
    if (await confirmBox('Delete lead', `Delete “${l.company}” and its history? This can’t be undone.`)) return deleteLead(l);
    return;
  }
  if (d.post) return postUpdate(S.leads.find((l) => l.id === d.post));
  if (d.editAction) return actionForm(S.actions.find((a) => a.id === d.editAction));
  if (d.delAction) {
    const a = S.actions.find((x) => x.id === d.delAction);
    if (await confirmBox('Delete action item', `Delete action item ${a.no}? This can’t be undone.`)) await run(() => commit([['delete', doc(db, 'actions', a.id)]], [auditOp('action', a.id, `#${a.no} ${a.title}`, 'delete', goneFields(a, ACTION_FIELDS.slice(0, 4)))]), 'Action item deleted');
    return;
  }
  if (d.delUser) {
    const u = S.users.find((x) => x.id === d.delUser);
    if (await confirmBox('Remove user', `Remove ${u.email}? They’ll have no access, and can request approval again by signing in.`, 'Remove')) await run(() => commit([['delete', doc(db, 'users', u.id)]], [auditOp('user', u.id, u.email, 'delete', goneFields({ name: u.name, role: u.role, sectors: u.sectors }, [['name'], ['role'], ['sectors']]), { note: 'User removed' })]), 'User removed');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('tr[data-open], .lead-card')) e.target.click();
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.draft !== undefined) { const r = S.draft[Number(e.target.dataset.draft)]; if (r) r.v = e.target.value; return; }
  const id = e.target.id;
  if (id === 'mv-q') { S.dash.mv.q = e.target.value; render(); return; }
  if (id === 'f-q') { S.filters.q = e.target.value; render(); }
  if (id === 'a-q') { S.actQ = e.target.value; render(); }
  if (id === 'au-q') { S.auf.q = e.target.value; render(); }
  if (id === 'cp-q' && S.colOpen) { colFilter(S.colOpen.tbl, S.colOpen.key).q = e.target.value; render(); }
});
document.addEventListener('change', async (e) => {
  const t = e.target, id = t.id;
  if (t.dataset?.cpi !== undefined && S.colOpen) {
    const f = colFilter(S.colOpen.tbl, S.colOpen.key), v = S.cpList[Number(t.dataset.cpi)]?.[0];
    if (v === undefined) return;
    let cur = f.vals ? [...f.vals] : [...S.cpAll];
    cur = t.checked ? [...new Set([...cur, v])] : cur.filter((x) => x !== v);
    f.vals = cur.length >= S.cpAll.length && S.cpAll.every((x) => cur.includes(x)) ? null : cur;
    return render();
  }
  if (t.dataset?.perm && S.permDraft) {
    const [r, k] = t.dataset.perm.split(':'), grp = k.split('_')[0], view = grp + '_view';
    S.permDraft[r][k] = t.checked;
    if (k === view && !t.checked) Object.keys(S.permDraft[r]).filter((x) => x.startsWith(grp + '_')).forEach((x) => { S.permDraft[r][x] = false; });
    if (k !== view && t.checked) S.permDraft[r][view] = true;
    return render();
  }
  if (t.dataset?.secCell && S.secDraft) {
    const [key, sector] = t.dataset.secCell.split('|');
    const set = S.secDraft[key]; if (set) t.checked ? set.add(sector) : set.delete(sector);
    return;
  }
  if (t.dataset?.addnew) {
    if (t.value === '__new__') {
      const key = t.dataset.addnew, def = LIST_DEFS.find((x) => x[0] === key);
      const val = await askText('Add to ' + def[1], 'Name');
      const added = val ? await addListItem(key, val) : null;
      if (added) {
        if (![...t.options].some((o) => o.value === added)) t.insertBefore(new Option(added, added), t.querySelector('option[value="__new__"]'));
        t.value = added;
      } else t.value = t.dataset.prev ?? ([...t.options].find((o) => o.defaultSelected)?.value ?? '');
    }
    t.dataset.prev = t.value;
    return;
  }
  if (id === 'importFile' && t.files[0]) return importFile(t.files[0]);
  if (id === 'pg-from' || id === 'pg-to') { S.pg[id.slice(3)] = t.value; S.pg.limit = 200; S.pg.loaded = false; S.pg.sel.clear(); return render(); }
  if (t.dataset.pgSel) { t.checked ? S.pg.sel.add(t.dataset.pgSel) : S.pg.sel.delete(t.dataset.pgSel); return render(); }
  if (t.dataset.pgAll !== undefined) { S.pg.rows.forEach((r) => (t.checked ? S.pg.sel.add(r.id) : S.pg.sel.delete(r.id))); return render(); }
  if (id === 'colorby') return setColorBy(t.value);
  if (id?.startsWith('f-') && id !== 'f-q') { S.filters[id.slice(2)] = t.value; render(); }
  if (id === 'a-filter') { S.actFilter = t.value; render(); }
  if (id === 'mv-who') { S.dash.who = t.value; try { localStorage.setItem('rfid-who:' + S.user.uid, t.value); } catch {} render(); return; }
  if (id === 'apg-size') { S.apg.size = t.value === 'all' ? 0 : Number(t.value); S.apg.page = 1; render(); return; }
  if (id?.startsWith('au-') && id !== 'au-q') { S.auf[id.slice(3)] = t.value; render(); }
  if (id === 'hideEmpty') { S.hideEmpty = t.checked; render(); }
  if (t.dataset.status) { const a = S.actions.find((x) => x.id === t.dataset.status); if (a && await confirmRevert(t, a.status, 'Change status', `Change the status of action item #${a.no} from ${a.status || 'none'} to ${t.value}?`, 'Change status')) await run(() => commit([['update', doc(db, 'actions', a.id), { status: t.value, ...stamp() }]], [auditOp('action', a.id, `#${a.no} ${a.title}`, 'update', [{ f: 'status', from: clip(a.status), to: t.value }])]), 'Status updated'); }
  if (t.dataset.role) { const u = S.users.find((x) => x.id === t.dataset.role); if (u && await confirmRevert(t, u.role, 'Change role', `Change the role of ${u.email} from ${u.role} to ${t.value}?`, 'Change role')) await run(() => commit([['update', doc(db, 'users', u.id), { role: t.value }]], [auditOp('user', u.id, u.email, 'role', [{ f: 'role', from: clip(u.role), to: t.value }])]), 'Role updated'); }
});
const uniq0 = (a) => [...new Set(a)];

parseRoute();
