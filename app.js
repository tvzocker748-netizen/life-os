/* =========================================================
   LIFE OS – Anwendungscode
   Alles läuft lokal im Browser. Keine Server, keine Tracker,
   keine externen Bibliotheken. Daten liegen in IndexedDB.
   ========================================================= */
'use strict';

const APP_VERSION = '1.1.0';

/* ---------------- Hilfsfunktionen ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const avg = arr => arr.length ? sum(arr) / arr.length : null;
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); return x < y ? -dir : x > y ? dir : 0; };

const NF = {
  eur: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
  eur0: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 }),
  n0: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }),
  n1: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }),
  in: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, useGrouping: false })
};
const eur = v => NF.eur.format(v || 0).replace('-', '−');
const eur0 = v => NF.eur0.format(Math.round(v || 0)).replace('-', '−');
const eurK = v => {
  const a = Math.abs(v || 0), s = v < 0 ? '−' : '';
  if (a >= 1e6) return s + NF.n1.format(a / 1e6) + ' Mio. €';
  if (a >= 1e5) return s + NF.n0.format(a / 1e3) + ' Tsd. €';
  return eur0(v);
};
const sEur = v => (v > 0 ? '+' : v < 0 ? '−' : '') + NF.eur.format(Math.abs(v || 0));
const n1 = v => NF.n1.format(v || 0);
const n0 = v => NF.n0.format(v || 0);
const pct = v => (v == null || !isFinite(v)) ? '–' : NF.n1.format(v).replace('-', '−') + ' %';
const fmtIn = v => (v == null || v === '' || isNaN(v)) ? '' : NF.in.format(v);
const fmtMoneyIn = v => (v == null || v === '' || isNaN(v)) ? '' : Number.isInteger(+v) ? NF.in.format(v) : (+v).toFixed(2).replace('.', ',');

/** Wandelt deutsche Zahlenangaben ("1.234,56", "12,5", "1500") in Zahlen um. */
function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').trim().replace(/[\s€%]/g, '').replace('−', '-');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

/* ---------------- Datum ---------------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
function addMonths(s, n, anchorDay) {
  const d = pd(s);
  const day = anchorDay || d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, daysInMonth(t.getFullYear(), t.getMonth())));
  return iso(t);
}
const curMonth = () => today().slice(0, 7);
const addMonthKey = (k, n) => addMonths(k + '-01', n).slice(0, 7);
const diffDays = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const weekStart = s => { const d = pd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const monthEnd = k => `${k}-${pad(daysInMonth(+k.slice(0, 4), +k.slice(5, 7) - 1))}`;
function isoWeek(s) {
  const d = pd(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
const DF = {
  med: new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }),
  short: new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }),
  wd: new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
  wdShort: new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
  month: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }),
  mon: new Intl.DateTimeFormat('de-DE', { month: 'short' }),
  wd1: new Intl.DateTimeFormat('de-DE', { weekday: 'narrow' })
};
const fDate = s => s ? DF.med.format(pd(s)) : '';
const fDay = s => s ? DF.short.format(pd(s)) : '';
const fMonth = k => DF.month.format(pd(k + '-01'));
const fMon = k => DF.mon.format(pd(k + '-01')).replace('.', '');
function relDay(s) {
  if (!s) return '';
  const d = diffDays(today(), s);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  if (d > 1 && d < 7) return `in ${d} Tagen`;
  if (d < -1 && d > -7) return `vor ${-d} Tagen`;
  return fDate(s);
}

/** Relative Angabe ohne doppeltes Datum, z. B. „in 3 Wochen“. */
function relIn(s) {
  if (!s) return '';
  const d = diffDays(today(), s), a = Math.abs(d);
  if (a < 7) return relDay(s);
  let txt;
  if (a < 60) { const w = Math.round(a / 7); txt = `${w} ${w === 1 ? 'Woche' : 'Wochen'}`; }
  else { const m = Math.round(a / 30.44); txt = `${m} ${m === 1 ? 'Monat' : 'Monaten'}`; }
  return d > 0 ? `in ${txt}` : `vor ${txt}`;
}

/* ---------------- Icons (eigene SVG-Pfade) ---------------- */
const ICONS = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  flame: '<path d="M12 21.5c3.9 0 6.8-2.6 6.8-6.5 0-3.2-2-5.4-3.8-7.3-.4 1.7-1.2 2.9-2.5 3.5C12.9 8 11.4 5.2 9 3c0 3.4-3.8 6.3-3.8 12 0 4 2.9 6.5 6.8 6.5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.8v.4h5.4v-.4c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3z"/>',
  repeat: '<path d="M17 3l3.5 3.5L17 10M3.5 11V9.5a3 3 0 0 1 3-3h14M7 21l-3.5-3.5L7 14M20.5 13v1.5a3 3 0 0 1-3 3h-14"/>',
  scale: '<path d="M12 3.5v17M6 20.5h12M5 7h14M5 7l-2.5 6.5a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6.5a2.5 2.5 0 0 0 5 0z"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.8 3.2 7.9 7.5 9.5 4.3-1.6 7.5-4.7 7.5-9.5V6z"/>',
  minus: '<path d="M5 12h14"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------------- Datenbank (IndexedDB) ---------------- */
const COLL = ['transactions', 'recurring', 'accounts', 'snapshots', 'subscriptions', 'goals', 'habits', 'tasks', 'focus', 'journal', 'decisions', 'checkins'];
const STORES = [...COLL, 'meta'];

const DB = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB wird von diesem Browser nicht unterstützt.')); return; }
      const req = indexedDB.open('lifeos', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = () => { this.db = req.result; this.db.onversionchange = () => { this.db.close(); location.reload(); }; resolve(); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Die Datenbank ist blockiert. Bitte schließe andere Tabs von LIFE OS.'));
    });
  },
  tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(store, mode);
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Speichern abgebrochen'));
      result = fn(t);
    });
  },
  all(store) {
    return new Promise((resolve, reject) => {
      const r = this.db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  },
  put(store, obj) { return this.tx(store, 'readwrite', t => { t.objectStore(store).put(obj); }); },
  del(store, id) { return this.tx(store, 'readwrite', t => { t.objectStore(store).delete(id); }); },
  /** Ersetzt den kompletten Inhalt mehrerer Speicher in EINER Transaktion (für Wiederherstellung). */
  replaceAll(data) {
    return this.tx(STORES, 'readwrite', t => {
      STORES.forEach(s => {
        const os = t.objectStore(s);
        os.clear();
        (data[s] || []).forEach(o => { if (o && o.id != null) os.put(o); });
      });
    });
  }
};

/* ---------------- Zustand ---------------- */
const EXP_CATS = ['Wohnen', 'Lebensmittel', 'Restaurant & Café', 'Mobilität', 'Versicherungen', 'Abonnements', 'Gesundheit', 'Kleidung', 'Freizeit', 'Reisen', 'Bildung', 'Technik', 'Haushalt', 'Geschenke & Spenden', 'Kredite & Raten', 'Sonstiges'];
const INC_CATS = ['Gehalt', 'Nebeneinkommen', 'Selbstständigkeit', 'Kapitalerträge', 'Sozialleistungen', 'Geschenke', 'Erstattungen', 'Sonstiges'];
const CAT_ICON = {
  'Wohnen': '🏠', 'Lebensmittel': '🛒', 'Restaurant & Café': '🍽️', 'Mobilität': '🚗', 'Versicherungen': '🛡️', 'Abonnements': '🔁',
  'Gesundheit': '🩺', 'Kleidung': '👕', 'Freizeit': '🎟️', 'Reisen': '✈️', 'Bildung': '📚', 'Technik': '💻', 'Haushalt': '🧺',
  'Geschenke & Spenden': '🎁', 'Kredite & Raten': '🏦', 'Sonstiges': '📦', 'Gehalt': '💼', 'Nebeneinkommen': '🧩',
  'Selbstständigkeit': '🚀', 'Kapitalerträge': '📈', 'Sozialleistungen': '🏛️', 'Geschenke': '🎁', 'Erstattungen': '↩️'
};
const catIcon = c => CAT_ICON[c] || '•';

const AREAS = [
  { id: 'finanzen', name: 'Finanzen', icon: '💶' },
  { id: 'gesundheit', name: 'Gesundheit & Fitness', icon: '💪' },
  { id: 'karriere', name: 'Karriere & Bildung', icon: '🎓' },
  { id: 'beziehungen', name: 'Beziehungen', icon: '❤️' },
  { id: 'geist', name: 'Mentale Stärke', icon: '🧠' },
  { id: 'wachstum', name: 'Persönliches Wachstum', icon: '🌱' },
  { id: 'freizeit', name: 'Freizeit & Erholung', icon: '🌴' },
  { id: 'umfeld', name: 'Wohnen & Umfeld', icon: '🏡' }
];
const areaById = id => AREAS.find(a => a.id === id) || { id: '', name: 'Allgemein', icon: '⭐️' };
const AREA_OPTS = AREAS.map(a => ({ v: a.id, l: `${a.icon} ${a.name}` }));

const DEFAULT_SETTINGS = {
  id: 'settings', name: '', theme: 'system', returnRate: 5, inflation: 2,
  expenseCats: EXP_CATS.slice(), incomeCats: INC_CATS.slice(), budgets: {},
  lastBackup: null, onboarded: false, sim: null, dismissed: {}, backupDays: 14, createdAt: null
};

const S = { settings: { ...DEFAULT_SETTINGS } };
COLL.forEach(c => { S[c] = []; });

let dataVer = 0;
const memoStore = new Map();
function memo(key, fn) {
  const k = key + '|' + dataVer;
  if (memoStore.has(k)) return memoStore.get(k);
  if (memoStore.size > 400) memoStore.clear();
  const v = fn();
  memoStore.set(k, v);
  return v;
}

async function loadAll() {
  for (const c of COLL) S[c] = await DB.all(c);
  const meta = await DB.all('meta');
  const st = meta.find(m => m.id === 'settings');
  S.settings = { ...DEFAULT_SETTINGS, ...(st || {}) };
  if (!Array.isArray(S.settings.expenseCats) || !S.settings.expenseCats.length) S.settings.expenseCats = EXP_CATS.slice();
  if (!Array.isArray(S.settings.incomeCats) || !S.settings.incomeCats.length) S.settings.incomeCats = INC_CATS.slice();
  S.settings.budgets = S.settings.budgets || {};
  S.settings.dismissed = S.settings.dismissed || {};
  const timer = meta.find(m => m.id === 'timer');
  TIMER.state = timer || null;
  dataVer++;
}

async function put(coll, obj) {
  const arr = S[coll];
  const i = arr.findIndex(x => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  dataVer++;
  await DB.put(coll, obj);
}
async function del(coll, id) {
  S[coll] = S[coll].filter(x => x.id !== id);
  dataVer++;
  await DB.del(coll, id);
}
async function saveSettings() { dataVer++; await DB.put('meta', S.settings); }

/* ---------------- Oberflächen-Zustand ---------------- */
const UI = {
  tab: 'heute',
  sub: { finanzen: 'overview', ziele: 'goals', journal: 'diary', berichte: 'month' },
  month: curMonth(),
  txMonth: curMonth(),
  txFilter: 'all',
  txSearch: '',
  jSearch: '',
  reportAnchor: today(),
  showDoneGoals: false
};
try {
  const saved = JSON.parse(localStorage.getItem('lifeos-ui') || '{}');
  if (saved.tab) UI.tab = saved.tab;
  if (saved.sub) Object.assign(UI.sub, saved.sub);
} catch (e) { /* ignorieren */ }
const saveUI = () => { try { localStorage.setItem('lifeos-ui', JSON.stringify({ tab: UI.tab, sub: UI.sub })); } catch (e) { /* ignorieren */ } };

/* ---------------- Rendering & Aktionen ---------------- */
const VIEWS = {};
const A = {}; // Aktionen, aufgerufen über data-act

function render(resetScroll = false) {
  const v = $('#view');
  const fn = VIEWS[UI.tab] || VIEWS.heute;
  const y = window.scrollY;
  try {
    v.innerHTML = fn();
  } catch (e) {
    console.error(e);
    v.innerHTML = `<div class="page"><div class="card mt"><b>Unerwarteter Fehler</b><p class="muted small mt">${esc(e.message)}</p><button class="btn block mt" data-act="tab" data-tab="heute">Zur Startseite</button></div></div>`;
  }
  $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === UI.tab));
  if (resetScroll) {
    window.scrollTo(0, 0);
    v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  } else window.scrollTo(0, y);
  onScroll();
  hideTip();
  if (typeof afterRender === 'function') afterRender();
}

function page(title, body, { action = '', sub = '' } = {}) {
  return `<header class="nav"><div class="nav-inner"><span class="nav-title">${esc(title)}</span>
    <div class="nav-actions">${action}<button class="icon-btn" data-act="settings" aria-label="Einstellungen">${ic('gear')}</button></div></div></header>
    <div class="page"><div class="lt-wrap">${sub ? `<div class="lt-sub">${sub}</div>` : ''}<h1 class="large-title">${esc(title)}</h1></div>${body}</div>`;
}

function seg(name, opts, current) {
  return `<div class="seg ${opts.length >= 5 ? 'five' : ''}" role="tablist">${opts.map(([v, l]) =>
    `<button role="tab" aria-selected="${v === current}" class="${v === current ? 'on' : ''}" data-act="seg" data-name="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
}

function periodNav(act, label, sub, disableNext) {
  return `<div class="period"><button data-act="${act}" data-d="-1" aria-label="Zurück">${ic('chevL')}</button>
    <div><div class="p-label">${esc(label)}</div>${sub ? `<div class="p-sub">${esc(sub)}</div>` : ''}</div>
    <button data-act="${act}" data-d="1" aria-label="Weiter" ${disableNext ? 'disabled' : ''}>${ic('chevR')}</button></div>`;
}

const bar = (ratio, cls = '') => `<div class="bar ${cls.includes('thin') ? 'thin' : ''}"><span class="${cls.replace('thin', '')}" style="width:${clamp((ratio || 0) * 100, 0, 100).toFixed(1)}%"></span></div>`;
const empty = (icon, text, btn = '') => `<div class="empty"><div class="em-ico">${icon}</div><div>${text}</div>${btn}</div>`;
const deltaHtml = (cur, prev, goodWhenUp = true, fmt = null) => {
  if (prev == null || cur == null || !isFinite(prev) || prev === 0) return '';
  const d = (cur - prev) / Math.abs(prev) * 100;
  if (Math.abs(d) < 0.5) return '<span class="delta muted">±0 %</span>';
  const good = goodWhenUp ? d > 0 : d < 0;
  return `<span class="delta ${good ? 'pos' : 'neg'}">${ic(d > 0 ? 'up' : 'down', 'sm')}${fmt ? fmt(cur - prev) : pct(Math.abs(d))}</span>`;
};

/* Zoomen per Zwei-Finger-Geste verhindern (Safari ignoriert user-scalable=no) */
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
/* Kein Kontextmenü (langes Drücken) außerhalb von Eingabefeldern */
document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, .selectable')) e.preventDefault(); });

/* Scroll-Verhalten der Navigationsleiste */
function onScroll() { document.body.classList.toggle('scrolled', window.scrollY > 34); }
window.addEventListener('scroll', onScroll, { passive: true });

/* Zentrale Klickverarbeitung */
document.addEventListener('click', e => {
  const tipEl = e.target.closest('[data-tip]');
  if (tipEl) { showTip(tipEl); return; }
  if (!e.target.closest('#tip')) hideTip();
  const tabBtn = e.target.closest('#tabbar button');
  if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset, el, e)).catch(err => { console.error(err); toast('Fehler: ' + err.message); });
});

function switchTab(tab) {
  if (!VIEWS[tab]) return;
  if (UI.tab === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  UI.tab = tab; saveUI(); render(true);
}

A.tab = d => switchTab(d.tab);
A.go = d => { if (d.sub && UI.sub[d.tab] !== undefined) UI.sub[d.tab] = d.sub; closeAllSheets(); UI.tab = d.tab; saveUI(); render(true); };
A.seg = d => {
  if (d.name in UI.sub) { UI.sub[d.name] = d.v; saveUI(); render(); }
  else { UI[d.name] = d.v; render(); }
};

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) $('button', t).onclick = () => { t.classList.remove('show'); action.fn(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 8000 : 2600);
}

/* ---------------- Tooltip für Diagramme ---------------- */
let tipActive = null;
function showTip(el) {
  const tip = $('#tip');
  if (tipActive === el && !tip.hidden) { hideTip(); return; }
  hideTip();
  tipActive = el;
  tipY = window.scrollY;
  el.classList.add('act');
  tip.innerHTML = el.dataset.tip;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  x = clamp(x, 8, window.innerWidth - tw - 8);
  let y = r.top - th - 8;
  if (y < 50) y = r.top + 30;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function hideTip() {
  const tip = $('#tip');
  if (tip) tip.hidden = true;
  if (tipActive) tipActive.classList.remove('act');
  tipActive = null;
}
let tipY = 0;
window.addEventListener('scroll', () => { if (tipActive && Math.abs(window.scrollY - tipY) > 12) hideTip(); }, { passive: true });

/* ---------------- Bestätigungsdialog ---------------- */
function confirmDlg(msg, { title = 'Bist du sicher?', ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  return new Promise(resolve => {
    const w = document.createElement('div');
    w.className = 'alert-wrap';
    w.innerHTML = `<div class="alert" role="alertdialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(msg)}</p>
      <div class="alert-btns">${cancel ? `<button data-r="0">${esc(cancel)}</button>` : ''}<button data-r="1" class="${danger ? 'danger' : 'bold'}">${esc(ok)}</button></div></div>`;
    document.body.appendChild(w);
    requestAnimationFrame(() => w.classList.add('open'));
    w.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      e.stopPropagation();
      w.remove();
      resolve(b.dataset.r === '1');
    });
  });
}

/* ---------------- Sheets (Fenster von unten) ---------------- */
const sheetStack = [];
let ignorePop = 0;

function openSheet(o) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <section class="sheet ${o.tall ? 'tall' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <div class="grabber"></div>
      <header class="sheet-head"><div class="sh-l">${o.left ?? '<button class="txt-btn" data-sheet-close>Schließen</button>'}</div>
      <h2>${esc(o.title)}</h2><div class="sh-r">${o.right || ''}</div></header>
      <div class="sheet-body">${o.body}</div>
    </section>`;
  $('#sheets').appendChild(wrap);
  document.body.classList.add('noscroll');
  hideTip();
  let closed = false;
  const sh = {
    el: wrap,
    body: $('.sheet-body', wrap),
    opts: o,
    setBody(html) { this.body.innerHTML = html; },
    close(fromPop) {
      if (closed) return;
      closed = true;
      const i = sheetStack.indexOf(sh);
      if (i >= 0) sheetStack.splice(i, 1);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 380);
      if (!sheetStack.length) document.body.classList.remove('noscroll');
      if (!fromPop) { ignorePop++; history.back(); }
      if (o.onClose) o.onClose();
    }
  };
  wrap.addEventListener('click', e => {
    if (e.target.classList.contains('sheet-backdrop') && !o.locked) { sh.close(); return; }
    if (e.target.closest('[data-sheet-close]')) { e.preventDefault(); sh.close(); }
  });
  // Nach unten wischen zum Schließen
  const head = $('.sheet-head', wrap), sheet = $('.sheet', wrap), grab = $('.grabber', wrap);
  let startY = null, dy = 0;
  const start = e => { if (o.locked || e.target.closest('button')) return; startY = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; };
  const move = e => { if (startY == null) return; dy = Math.max(0, e.touches[0].clientY - startY); sheet.style.transform = `translateY(${dy}px)`; };
  const end = () => { if (startY == null) return; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 110) sh.close(); startY = null; };
  [head, grab].forEach(h => { h.addEventListener('touchstart', start, { passive: true }); h.addEventListener('touchmove', move, { passive: true }); h.addEventListener('touchend', end); });

  history.pushState({ sheet: true }, '');
  sheetStack.push(sh);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  if (o.onMount) o.onMount(sh);
  return sh;
}
window.addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  const top = sheetStack[sheetStack.length - 1];
  if (top) {
    if (top.opts.locked) { history.pushState({ sheet: true }, ''); return; }
    top.close(true);
  }
});
function closeAllSheets() { [...sheetStack].reverse().forEach(s => s.close()); }
const topSheet = () => sheetStack[sheetStack.length - 1];

/* ---------------- Formular-Baukasten ---------------- */
const optList = opts => opts.map(o => typeof o === 'string' ? { v: o, l: o } : o);

function renderField(f, values) {
  const v = values[f.key] !== undefined ? values[f.key] : (f.value !== undefined ? f.value : '');
  const name = `name="${f.key}"`;
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  let ctl = '', inline = false;
  switch (f.type) {
    case 'money':
      ctl = `<input class="in num ${f.big ? 'big' : ''}" ${name} type="text" inputmode="decimal" autocomplete="off" ${ph || 'placeholder="0,00"'} value="${esc(fmtMoneyIn(v))}"><span class="unit">€</span>`; break;
    case 'number':
      ctl = `<input class="in num" ${name} type="text" inputmode="decimal" autocomplete="off" ${ph} value="${esc(fmtIn(v))}">${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}`; break;
    case 'textarea':
      ctl = `<textarea ${name} rows="${f.rows || 4}" ${ph}>${esc(v)}</textarea>`; break;
    case 'date':
      ctl = `<input class="in" ${name} type="date" value="${esc(v)}">`; break;
    case 'select':
      ctl = `<select ${name}>${optList(f.options).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
    case 'seg': case 'rating':
      ctl = `<div class="seg seg-sm ${f.type === 'rating' ? 'rating' : ''}" data-segfield="${f.key}">${optList(f.options).map(o =>
        `<label class="${String(o.v) === String(v) ? 'on' : ''}"><input type="radio" ${name} value="${esc(o.v)}" ${String(o.v) === String(v) ? 'checked' : ''}>${esc(o.l)}</label>`).join('')}</div>`; break;
    case 'toggle':
      inline = true;
      ctl = `<label class="switch"><input type="checkbox" ${name} ${v ? 'checked' : ''}><span></span></label>`; break;
    case 'slider':
      ctl = `<div class="slider-row" style="width:100%"><input type="range" ${name} min="${f.min ?? 1}" max="${f.max ?? 10}" step="${f.step ?? 1}" value="${esc(v === '' ? (f.min ?? 1) : v)}"><output>${esc(v === '' ? (f.min ?? 1) : v)}</output></div>`; break;
    case 'info':
      return `<div class="field" data-key="${f.key}">${f.html}</div>`;
    default:
      ctl = `<input class="in" ${name} type="text" autocomplete="off" ${f.cap === false ? 'autocapitalize="off"' : ''} ${ph} value="${esc(v)}" ${f.max ? `maxlength="${f.max}"` : ''}>`;
  }
  return `<div class="field ${inline ? 'inline' : ''}" data-key="${f.key}">
    <label class="flabel">${esc(f.label)}${f.required ? '' : ''}</label>
    <div class="fctl">${ctl}</div>${f.hint ? `<div class="fhint">${f.hint}</div>` : ''}</div>`;
}

function renderFields(fields, values) {
  // Felder werden in Gruppen aufgeteilt; {group:true} startet eine neue Gruppe
  const groups = [[]];
  fields.forEach(f => { if (f.group && groups[groups.length - 1].length) groups.push([]); groups[groups.length - 1].push(f); });
  return groups.map(g => `<div class="fgroup">${g.map(f => renderField(f, values)).join('')}</div>`).join('');
}

function collect(form, fields) {
  const o = {};
  for (const f of fields) {
    if (f.type === 'info') continue;
    const el = form.querySelector(`[name="${f.key}"]`);
    if (!el) continue;
    switch (f.type) {
      case 'money': case 'number': { const s = el.value.trim(); o[f.key] = s === '' ? null : parseNum(s); break; }
      case 'toggle': o[f.key] = el.checked; break;
      case 'seg': case 'rating': {
        const c = form.querySelector(`input[name="${f.key}"]:checked`);
        o[f.key] = c ? (f.numeric ? Number(c.value) : c.value) : null; break;
      }
      case 'slider': o[f.key] = Number(el.value); break;
      default: o[f.key] = el.value.trim();
    }
  }
  return o;
}

function formSheet({ title, fields, values = {}, saveLabel = 'Sichern', onSave, onDelete, deleteLabel = 'Löschen', deleteMsg, extra = '', focus, onMount }) {
  const body = `<form class="form" novalidate>${renderFields(fields, values)}${extra}
    ${onDelete ? `<div class="fgroup"><button type="button" class="row danger-txt" data-fdel style="justify-content:center">${esc(deleteLabel)}</button></div>` : ''}
    <button type="submit" style="display:none" aria-hidden="true"></button></form>`;
  const sh = openSheet({
    title, body,
    left: '<button class="txt-btn" data-sheet-close>Abbrechen</button>',
    right: `<button class="txt-btn bold" data-fsave>${esc(saveLabel)}</button>`
  });
  const form = $('form', sh.el);
  const refresh = () => {
    const vals = collect(form, fields);
    fields.forEach(f => {
      if (!f.show) return;
      const row = form.querySelector(`.field[data-key="${f.key}"]`);
      if (row) row.classList.toggle('hidden', !f.show(vals));
    });
    $$('[data-segfield] label', form).forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    $$('input[type="range"]', form).forEach(r => { const out = r.parentElement.querySelector('output'); if (out) out.textContent = r.value; });
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();
  let saving = false;
  const doSave = async () => {
    if (saving) return;
    const vals = collect(form, fields);
    $$('.field.err', form).forEach(x => x.classList.remove('err'));
    for (const f of fields) {
      if (f.show && !f.show(vals)) continue;
      const v = vals[f.key];
      let bad = null;
      if (f.required && (v == null || v === '' || (typeof v === 'number' && isNaN(v)))) bad = `Bitte „${f.label}“ ausfüllen.`;
      else if ((f.type === 'money' || f.type === 'number') && v != null && isNaN(v)) bad = `„${f.label}“ ist keine gültige Zahl.`;
      else if (f.min != null && (f.type === 'money' || f.type === 'number') && v != null && v < f.min) bad = `„${f.label}“ muss mindestens ${fmtIn(f.min)} sein.`;
      if (bad) {
        const row = form.querySelector(`.field[data-key="${f.key}"]`);
        if (row) { row.classList.add('err', 'shake'); setTimeout(() => row.classList.remove('shake'), 400); }
        toast(bad);
        return;
      }
    }
    saving = true;
    try {
      const r = await onSave(vals, sh);
      if (r === false) { saving = false; return; }
      sh.close();
      render();
    } catch (e) {
      console.error(e);
      toast('Speichern fehlgeschlagen: ' + e.message);
    }
    saving = false;
  };
  $('[data-fsave]', sh.el).addEventListener('click', doSave);
  form.addEventListener('submit', e => { e.preventDefault(); doSave(); });
  if (onDelete) {
    $('[data-fdel]', sh.el).addEventListener('click', async () => {
      if (await confirmDlg(deleteMsg || 'Dieser Eintrag wird dauerhaft gelöscht.', { title: `${deleteLabel}?`, ok: deleteLabel, danger: true })) {
        await onDelete();
        sh.close();
        render();
        toast('Gelöscht');
      }
    });
  }
  if (focus) { const el = form.querySelector(`[name="${focus}"]`); if (el) el.focus({ preventScroll: true }); }
  if (onMount) onMount(sh, form);
  return sh;
}

/* ---------------- Diagramme (reines SVG) ---------------- */
function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
const tickFmt = v => {
  const a = Math.abs(v);
  if (a >= 1e6) return n1(v / 1e6) + ' Mio';
  if (a >= 1e3) return n1(v / 1e3) + ' Tsd';
  return n0(v);
};

/** Liniendiagramm. series: [{name, values, color}] */
function lineChart({ labels, series, h = 190, fmt = eur0, zero = false, area = true, yfmt = tickFmt, xEvery, yMin, yMax, connect = false }) {
  const W = 340, H = h, L = 36, R = 8, T = 10, B = 22;
  const all = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
  if (!all.length) return '';
  let mn = Math.min(...all), mx = Math.max(...all);
  if (zero) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
  if (mn === mx) { mn -= Math.abs(mn) * 0.1 || 1; mx += Math.abs(mx) * 0.1 || 1; }
  let ticks = niceTicks(mn, mx, 4);
  if (yMin != null && yMax != null) { ticks = []; for (let v = yMin; v <= yMax; v++) ticks.push(v); }
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const n = labels.length;
  const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  let g = '';
  ticks.forEach(t => { g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text x="${L - 6}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${esc(yfmt(t))}</text>`; });
  const every = xEvery || Math.max(1, Math.ceil(n / 5));
  labels.forEach((l, i) => {
    if (i % every === 0 || i === n - 1) {
      if (i !== n - 1 && n - 1 - i < every) return;
      g += `<text x="${x(i).toFixed(1)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(l)}</text>`;
    }
  });
  let paths = '', defs = '';
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]);
    let d = '', started = false;
    pts.forEach(p => { if (!p) { if (!connect) started = false; return; } d += (started ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); started = true; });
    if (area && series.length === 1) {
      const valid = pts.filter(Boolean);
      if (valid.length > 1) {
        const id = 'g' + Math.random().toString(36).slice(2, 7);
        defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".22"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
        const base = y(Math.max(lo, Math.min(hi, 0 > lo ? 0 : lo)));
        paths += `<path d="M${valid[0][0].toFixed(1)} ${base.toFixed(1)}L${valid.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}L${valid[valid.length - 1][0].toFixed(1)} ${base.toFixed(1)}Z" fill="url(#${id})"/>`;
      }
    }
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
    const last = pts.map((p, i) => [p, i]).filter(p => p[0]).pop();
    if (last && !s.noDot) paths += `<circle cx="${last[0][0].toFixed(1)}" cy="${last[0][1].toFixed(1)}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`;
    if (connect) pts.forEach(p => { if (p) paths += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${s.color}"/>`; });
    if (si === 0 && n === 1 && pts[0]) paths += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="4" fill="${s.color}"/>`;
  });
  let hits = '';
  const colW = n > 1 ? (W - L - R) / (n - 1) : W - L - R;
  labels.forEach((l, i) => {
    const tip = `<b>${esc(l)}</b>` + series.map(s => s.values[i] == null ? '' : `<br>${series.length > 1 ? `<i style="background:${s.color}"></i>${esc(s.name)}: ` : ''}${esc(fmt(s.values[i]))}`).join('');
    hits += `<rect class="hit" x="${(x(i) - colW / 2).toFixed(1)}" y="${T}" width="${colW.toFixed(1)}" height="${H - T - B}" data-tip="${esc(tip)}"/>`;
  });
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="line" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Liniendiagramm">${defs ? `<defs>${defs}</defs>` : ''}${g}${paths}${hits}</svg></div>`;
}

/** Gruppiertes Balkendiagramm. */
function barChart({ labels, series, h = 180, fmt = eur0, tips }) {
  const W = 340, H = h, L = 36, R = 4, T = 10, B = 22;
  const all = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
  const mx = Math.max(1, ...all), mn = Math.min(0, ...all);
  const ticks = niceTicks(mn, mx, 4);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const n = labels.length;
  const gw = (W - L - R) / n;
  const k = series.length;
  const bw = Math.max(3, Math.min(14, (gw - 6) / k - 2));
  let g = '';
  ticks.forEach(t => { g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text x="${L - 6}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${esc(tickFmt(t))}</text>`; });
  let bars = '', hits = '';
  const every = Math.max(1, Math.ceil(n / 12));
  labels.forEach((l, i) => {
    const cx = L + gw * i + gw / 2;
    const totalW = k * bw + (k - 1) * 2;
    series.forEach((s, si) => {
      const v = s.values[i] || 0;
      const x0 = cx - totalW / 2 + si * (bw + 2);
      const y0 = y(0), y1 = y(v);
      const top = Math.min(y0, y1), hgt = Math.abs(y0 - y1);
      if (hgt < 0.5) return;
      const r = Math.min(3, bw / 2, hgt);
      if (v >= 0) bars += `<path d="M${x0} ${y0}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + bw - r}Q${x0 + bw} ${top} ${x0 + bw} ${top + r}V${y0}Z" fill="${s.color}"/>`;
      else bars += `<path d="M${x0} ${y0}V${y1 - r}Q${x0} ${y1} ${x0 + r} ${y1}H${x0 + bw - r}Q${x0 + bw} ${y1} ${x0 + bw} ${y1 - r}V${y0}Z" fill="${s.color}"/>`;
    });
    if (i % every === 0) g += `<text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle">${esc(l)}</text>`;
    const tip = tips ? tips[i] : `<b>${esc(l)}</b>` + series.map(s => `<br>${k > 1 ? `<i style="background:${s.color}"></i>${esc(s.name)}: ` : ''}${esc(fmt(s.values[i] || 0))}`).join('');
    hits += `<rect class="hit" x="${(L + gw * i).toFixed(1)}" y="${T}" width="${gw.toFixed(1)}" height="${H - T - B}" rx="6" data-tip="${esc(tip)}"/>`;
  });
  const zeroLine = lo < 0 ? `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--text3)"/>` : '';
  const legend = k > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Balkendiagramm">${g}${hits}${bars}${zeroLine}</svg></div>`;
}

/** Netzdiagramm für Lebensbereiche (Werte 0–10). */
function radarChart(items, prevItems) {
  const S2 = 320, c = S2 / 2, R = 108, n = items.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v / 10, c + Math.sin(a) * R * v / 10]; };
  let g = '';
  [2.5, 5, 7.5, 10].forEach(r => { g += `<polygon points="${items.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--grid)"/>`; });
  items.forEach((_, i) => { const [x, y] = pt(i, 10); g += `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--grid)"/>`; });
  const poly = (arr, color, fillOp, dash) => `<polygon points="${arr.map((it, i) => pt(i, it.value ?? 0).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${color}" fill-opacity="${fillOp}" stroke="${color}" stroke-width="2" stroke-linejoin="round" ${dash ? 'stroke-dasharray="4 4"' : ''}/>`;
  if (prevItems) g += poly(prevItems, 'var(--text3)', 0, true);
  g += poly(items, 'var(--series-1)', 0.18);
  items.forEach((it, i) => {
    if (it.value == null) return;
    const [x, y] = pt(i, it.value);
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--series-1)"/>`;
  });
  items.forEach((it, i) => {
    const [x, y] = pt(i, 12.3);
    g += `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle">${it.icon}</text>`;
    const [hx, hy] = pt(i, 12.3);
    g += `<circle class="hit" cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="16" data-tip="${esc(`<b>${esc(it.name)}</b><br>${it.value == null ? 'Noch keine Daten' : n1(it.value) + ' / 10'}`)}"/>`;
  });
  return `<div class="chart radar-wrap"><svg viewBox="0 0 ${S2} ${S2}" role="img" aria-label="Lebensbereiche">${g}</svg></div>`;
}
/* =========================================================
   FINANZEN: Analyse, Vermögen, Abos, Simulation
   ========================================================= */

const ACC_TYPES = [
  { v: 'giro', l: 'Girokonto', icon: '🏦', liquid: true },
  { v: 'cash', l: 'Bargeld', icon: '💵', liquid: true },
  { v: 'savings', l: 'Tagesgeld / Sparkonto', icon: '🐷', liquid: true },
  { v: 'invest', l: 'Depot / ETF / Aktien', icon: '📈' },
  { v: 'pension', l: 'Altersvorsorge', icon: '🧓' },
  { v: 'crypto', l: 'Krypto', icon: '🪙' },
  { v: 'property', l: 'Immobilie / Sachwert', icon: '🏡' },
  { v: 'other', l: 'Sonstiges Vermögen', icon: '💎' },
  { v: 'debt', l: 'Kredit / Schulden', icon: '💳', debt: true }
];
const accType = v => ACC_TYPES.find(t => t.v === v) || ACC_TYPES[ACC_TYPES.length - 2];

const CYCLES = [
  { v: 'weekly', l: 'Wöchentlich', perMonth: 52 / 12, short: 'Woche' },
  { v: 'monthly', l: 'Monatlich', perMonth: 1, short: 'Monat' },
  { v: 'quarterly', l: 'Vierteljährlich', perMonth: 1 / 3, short: 'Quartal' },
  { v: 'halfyearly', l: 'Halbjährlich', perMonth: 1 / 6, short: 'Halbjahr' },
  { v: 'yearly', l: 'Jährlich', perMonth: 1 / 12, short: 'Jahr' }
];
const cycleOf = v => CYCLES.find(c => c.v === v) || CYCLES[1];
const monthlyCost = s => (s.amount || 0) * cycleOf(s.cycle).perMonth;
function advance(date, cycle, anchor) {
  switch (cycle) {
    case 'weekly': return addDays(date, 7);
    case 'quarterly': return addMonths(date, 3, anchor);
    case 'halfyearly': return addMonths(date, 6, anchor);
    case 'yearly': return addMonths(date, 12, anchor);
    default: return addMonths(date, 1, anchor);
  }
}
const SUB_CATS = ['Streaming (Video)', 'Musik & Audio', 'Software & Apps', 'Cloud-Speicher', 'Nachrichten & Magazine', 'Fitness & Sport', 'Mobilfunk & Internet', 'Gaming', 'Mitgliedschaft', 'Lieferdienste & Shopping', 'Versicherung', 'Sonstiges'];
const DUP_SUB_CATS = ['Streaming (Video)', 'Musik & Audio', 'Cloud-Speicher', 'Nachrichten & Magazine', 'Gaming', 'Lieferdienste & Shopping', 'Software & Apps'];

/* ---------------- Auswertungen ---------------- */
function statsOf(tx) {
  let income = 0, expense = 0;
  const byCat = {}, byInc = {};
  tx.forEach(t => {
    if (t.type === 'income') { income += t.amount; byInc[t.category] = (byInc[t.category] || 0) + t.amount; }
    else { expense += t.amount; byCat[t.category] = (byCat[t.category] || 0) + t.amount; }
  });
  return { income, expense, balance: income - expense, rate: income > 0 ? (income - expense) / income * 100 : null, byCat, byInc, count: tx.length, tx };
}
const txRange = (from, to) => S.transactions.filter(t => t.date >= from && t.date <= to);
const monthStats = k => memo('ms' + k, () => statsOf(S.transactions.filter(t => t.date.slice(0, 7) === k)));
const rangeStats = (from, to) => memo(`rs${from}${to}`, () => statsOf(txRange(from, to)));

/** Durchschnitt der letzten n abgeschlossenen Monate mit Daten (sonst laufender Monat). */
function avgStats(n = 3) {
  return memo('avg' + n, () => {
    const cm = curMonth();
    const months = [];
    for (let i = 1; i <= 12 && months.length < n; i++) {
      const s = monthStats(addMonthKey(cm, -i));
      if (s.count > 0) months.push(s);
    }
    let basis = `Ø der letzten ${months.length} Monate`;
    if (!months.length) {
      const c = monthStats(cm);
      if (c.count) months.push(c);
      basis = 'laufender Monat';
    }
    if (months.length === 1 && basis !== 'laufender Monat') basis = 'letzter Monat';
    const k = months.length || 1;
    const byCat = {};
    months.forEach(m => Object.entries(m.byCat).forEach(([c, v]) => { byCat[c] = (byCat[c] || 0) + v / k; }));
    const income = sum(months, m => m.income) / k, expense = sum(months, m => m.expense) / k;
    return { income, expense, balance: income - expense, rate: income > 0 ? (income - expense) / income * 100 : null, byCat, months: months.length, basis };
  });
}

function accountsSummary() {
  return memo('acc', () => {
    let assets = 0, debts = 0, liquid = 0;
    S.accounts.forEach(a => {
      const b = Number(a.balance) || 0;
      if (accType(a.type).debt) debts += Math.abs(b);
      else { assets += b; if (accType(a.type).liquid) liquid += b; }
    });
    return { assets, debts, net: assets - debts, liquid };
  });
}
async function updateSnapshot() {
  if (!S.accounts.length) return;
  const s = accountsSummary();
  await put('snapshots', { id: curMonth(), date: today(), assets: round2(s.assets), debts: round2(s.debts), net: round2(s.net) });
}
const sortedSnapshots = () => S.snapshots.slice().sort(by(s => s.id));

/** Bucht fällige wiederkehrende Zahlungen & Abos automatisch. */
async function processDue() {
  const t = today();
  let n = 0;
  for (const r of S.recurring.slice()) {
    if (!r.active || !r.nextDate) continue;
    let guard = 0, changed = false;
    while (r.nextDate <= t && guard++ < 400) {
      await put('transactions', { id: uid(), type: r.type, amount: r.amount, category: r.category, note: r.note || '', date: r.nextDate, recurringId: r.id, createdAt: Date.now() });
      r.nextDate = advance(r.nextDate, r.cycle, r.anchor);
      n++; changed = true;
    }
    if (changed) await put('recurring', r);
  }
  for (const s of S.subscriptions.slice()) {
    if (!s.active || !s.nextDate) continue;
    let guard = 0, changed = false;
    while (s.nextDate <= t && guard++ < 400) {
      if (s.autoBook) {
        await put('transactions', { id: uid(), type: 'expense', amount: s.amount, category: 'Abonnements', note: s.name, date: s.nextDate, subId: s.id, createdAt: Date.now() });
        n++;
      }
      s.nextDate = advance(s.nextDate, s.cycle, s.anchor);
      changed = true;
    }
    if (changed) await put('subscriptions', s);
  }
  return n;
}

/* Richtwerte (Anteil am Nettoeinkommen) – gängige Faustregeln */
const BENCH = {
  'Wohnen': [0.35, 'Faustregel: Warmmiete höchstens rund ein Drittel des Nettoeinkommens.'],
  'Lebensmittel': [0.15, 'Wochenplan und Einkaufsliste senken Spontankäufe.'],
  'Restaurant & Café': [0.06, 'Öfter selbst kochen oder Mahlzeiten vorbereiten.'],
  'Mobilität': [0.12, 'Prüfe Deutschlandticket, Fahrgemeinschaften oder Tarifwechsel.'],
  'Freizeit': [0.08, 'Setze dir ein festes Freizeitbudget pro Monat.'],
  'Kleidung': [0.05, 'Nutze die 30-Tage-Regel für nicht notwendige Käufe.'],
  'Technik': [0.04, 'Geräte länger nutzen oder generalüberholt kaufen.'],
  'Reisen': [0.08, 'Frühbucher- und Nebensaison-Angebote nutzen.'],
  'Haushalt': [0.04, 'Preise vergleichen und Eigenmarken nutzen.'],
  'Versicherungen': [0.07, 'Verträge einmal jährlich vergleichen und Doppelversicherungen kündigen.']
};
const VARIABLE_CATS = ['Lebensmittel', 'Restaurant & Café', 'Freizeit', 'Kleidung', 'Technik', 'Reisen', 'Haushalt', 'Sonstiges', 'Geschenke & Spenden'];

function savingsPotential() {
  return memo('sp', () => {
    const a = avgStats(3);
    const items = [];
    const covered = new Set();
    const subs = S.subscriptions.filter(s => s.active);
    const lowIds = new Set();
    subs.filter(s => (s.rating || 3) <= 2).forEach(s => {
      lowIds.add(s.id);
      items.push({ key: 'sub-' + s.id, icon: '🔁', title: `Abo prüfen: ${s.name}`, text: `Nutzen nur ${s.rating}/5. Eine Kündigung spart ${eur0(monthlyCost(s) * 12)} pro Jahr.`, monthly: monthlyCost(s), act: 'editSub', id: s.id });
    });
    const groups = {};
    subs.filter(s => !lowIds.has(s.id) && DUP_SUB_CATS.includes(s.category)).forEach(s => { (groups[s.category] = groups[s.category] || []).push(s); });
    Object.entries(groups).forEach(([cat, list]) => {
      if (list.length < 2) return;
      const cand = list.slice().sort((x, y) => (x.rating || 3) - (y.rating || 3) || monthlyCost(y) - monthlyCost(x))[0];
      items.push({ key: 'dup-' + cat, icon: '🔁', title: `${list.length} Abos in „${cat}“`, text: `Abwechselnd statt gleichzeitig nutzen. Pausiere z. B. „${cand.name}“ (${eur(monthlyCost(cand))}/Monat).`, monthly: monthlyCost(cand), act: 'editSub', id: cand.id });
    });
    const inc = a.income;
    const budgets = S.settings.budgets || {};
    Object.entries(BENCH).forEach(([cat, [share, why]]) => {
      const spend = a.byCat[cat] || 0;
      if (!spend) return;
      const budget = budgets[cat];
      const overBench = inc > 0 ? spend - share * inc : 0;
      const overBudget = budget ? spend - budget : 0;
      const excess = Math.max(overBench, overBudget, 0);
      if (excess < 10) return;
      covered.add(cat);
      const text = overBudget >= overBench
        ? `Ø ${eur0(spend)} pro Monat – ${eur0(overBudget)} über deinem Budget von ${eur0(budget)}.`
        : `Ø ${eur0(spend)} pro Monat = ${pct(spend / inc * 100)} deines Einkommens (Richtwert ≤ ${pct(share * 100)}). ${why}`;
      items.push({ key: 'cat-' + cat, icon: catIcon(cat), title: `${cat} senken`, text, monthly: excess, act: 'catTx', cat });
    });
    Object.entries(budgets).forEach(([cat, budget]) => {
      if (covered.has(cat) || !budget) return;
      const spend = a.byCat[cat] || 0;
      if (spend - budget >= 10) {
        covered.add(cat);
        items.push({ key: 'bud-' + cat, icon: catIcon(cat), title: `${cat}: Budget einhalten`, text: `Ø ${eur0(spend)} pro Monat bei einem Budget von ${eur0(budget)}.`, monthly: spend - budget, act: 'catTx', cat });
      }
    });
    const varSpend = sum(VARIABLE_CATS.filter(c => !covered.has(c)), c => a.byCat[c] || 0);
    if (varSpend >= 100) {
      items.push({ key: 'var', icon: '🎯', title: 'Bewusster konsumieren', text: `10 % weniger variable Ausgaben (Ø ${eur0(varSpend)}/Monat). Tipp: 24 Stunden warten vor jedem ungeplanten Kauf über 50 €.`, monthly: varSpend * 0.1 });
    }
    items.sort(by(i => i.monthly, -1));
    const monthly = sum(items, i => i.monthly);
    return { items, monthly, yearly: monthly * 12, basis: a };
  });
}

/** Endwert einer monatlichen Sparrate. */
function futureValue(monthly, years, ratePct) {
  const r = ratePct / 100 / 12, n = years * 12;
  return r ? monthly * ((1 + r) ** n - 1) / r : monthly * n;
}

/** Vermögenssimulation mit monatlicher Verzinsung. */
function simulate({ start, monthly, rate, years = 30, dyn = 0 }) {
  const r = rate / 100 / 12;
  let v = start, paid = start, s = monthly;
  const out = [{ y: 0, v, paid }];
  for (let m = 1; m <= years * 12; m++) {
    v = (v > 0 ? v * (1 + r) : v) + s;
    paid += s;
    if (m % 12 === 0) { out.push({ y: m / 12, v, paid }); s *= 1 + dyn / 100; }
  }
  return out;
}

/* ---------------- Ansicht: Finanzen ---------------- */
VIEWS.finanzen = () => {
  const sub = UI.sub.finanzen;
  const body = seg('finanzen', [['overview', 'Überblick'], ['tx', 'Buchungen'], ['wealth', 'Vermögen'], ['subs', 'Abos'], ['future', 'Zukunft']], sub)
    + ({ overview: finOverview, tx: finTx, wealth: finWealth, subs: finSubs, future: finFuture }[sub] || finOverview)();
  const act = { overview: 'addTx', tx: 'addTx', wealth: 'addAccount', subs: 'addSub' }[sub];
  return page('Finanzen', body, { action: act ? `<button class="icon-btn" data-act="${act}" aria-label="Hinzufügen">${ic('plus')}</button>` : '' });
};

function finOverview() {
  const k = UI.month, cm = curMonth();
  const m = monthStats(k), prev = monthStats(addMonthKey(k, -1));
  let h = periodNav('month', fMonth(k), k === cm ? 'Laufender Monat' : '', k >= cm);
  const rateCls = m.rate == null ? '' : m.rate >= 20 ? 'pos' : m.rate >= 10 ? '' : m.rate >= 0 ? 'warn' : 'neg';
  h += `<div class="stats">
    <div class="stat"><div class="stat-l">Einnahmen</div><div class="stat-v pos">${eur0(m.income)}</div><div class="stat-d">${deltaHtml(m.income, prev.income, true) || 'Vormonat: ' + eur0(prev.income)}</div></div>
    <div class="stat"><div class="stat-l">Ausgaben</div><div class="stat-v">${eur0(m.expense)}</div><div class="stat-d">${deltaHtml(m.expense, prev.expense, false) || 'Vormonat: ' + eur0(prev.expense)}</div></div>
    <div class="stat"><div class="stat-l">Überschuss</div><div class="stat-v ${m.balance < 0 ? 'neg' : ''}">${sEur(Math.round(m.balance))}</div><div class="stat-d">${m.count} Buchungen</div></div>
    <div class="stat"><div class="stat-l">Sparquote</div><div class="stat-v ${rateCls}">${pct(m.rate)}</div><div class="stat-d">Ziel: mind. 10–20 %</div></div>
  </div>`;
  if (!m.count) {
    h += `<div class="card">${empty('🧾', 'Für diesen Monat gibt es noch keine Buchungen.', '<button class="btn" data-act="addTx">Erste Buchung erfassen</button>')}</div>`;
  }
  // Budgets
  const budgets = Object.entries(S.settings.budgets || {}).filter(([, v]) => v > 0);
  if (budgets.length) {
    const elapsed = k === cm ? new Date().getDate() / daysInMonth(+k.slice(0, 4), +k.slice(5) - 1) : 1;
    h += `<div class="card"><div class="card-h"><span class="card-t">Budgets</span><button class="link" data-act="editBudgets">Bearbeiten</button></div><div class="cat-bars">`;
    budgets.sort(by(([c, b]) => (m.byCat[c] || 0) / b, -1)).forEach(([c, b]) => {
      const spent = m.byCat[c] || 0, r = spent / b;
      const cls = r >= 1 ? 'red' : r > elapsed + 0.1 ? 'orange' : 'green';
      h += `<div class="cb"><div class="cb-top"><span>${catIcon(c)} ${esc(c)}</span><span class="num">${eur0(spent)} <span class="muted">/ ${eur0(b)}</span></span></div>${bar(r, cls)}
        <div class="small muted" style="margin-top:3px">${r >= 1 ? `<span class="neg">${eur0(spent - b)} überschritten</span>` : `Noch ${eur0(b - spent)} verfügbar`}</div></div>`;
    });
    h += `</div></div>`;
  }
  // Kategorien
  const cats = Object.entries(m.byCat).sort(by(([, v]) => v, -1));
  if (cats.length) {
    const a3 = avgStats(3);
    const mx = cats[0][1];
    h += `<div class="card"><div class="card-h"><span class="card-t">Ausgaben nach Kategorie</span></div><div class="cat-bars">`;
    cats.forEach(([c, v]) => {
      const av = a3.byCat[c];
      const d = av && k === cm ? '' : (av ? deltaHtml(v, av, false) : '');
      h += `<div class="cb tap" data-act="catTx" data-cat="${esc(c)}" style="cursor:pointer"><div class="cb-top"><span>${catIcon(c)} ${esc(c)}</span><span class="num">${eur(v)} <span class="muted">${pct(v / m.expense * 100)}</span> ${d}</span></div>${bar(v / mx, 'thin')}</div>`;
    });
    h += `</div></div>`;
  }
  const incs = Object.entries(m.byInc).sort(by(([, v]) => v, -1));
  if (incs.length) {
    h += `<div class="list-h"><span>Einnahmequellen</span></div><div class="list">${incs.map(([c, v]) =>
      `<div class="row has-ico"><div class="cat-ico">${catIcon(c)}</div><div class="row-main"><div class="row-t">${esc(c)}</div></div><div class="row-r"><span class="amount pos">${eur(v)}</span></div></div>`).join('')}</div>`;
  }
  // 12-Monats-Verlauf
  const keys = Array.from({ length: 12 }, (_, i) => addMonthKey(k, i - 11));
  const ms = keys.map(monthStats);
  if (ms.some(x => x.count)) {
    h += `<div class="card"><div class="card-h"><span class="card-t">12-Monats-Verlauf</span></div>${barChart({
      labels: keys.map(fMon),
      series: [{ name: 'Einnahmen', values: ms.map(x => x.income), color: 'var(--series-1)' }, { name: 'Ausgaben', values: ms.map(x => x.expense), color: 'var(--series-2)' }],
      tips: ms.map((x, i) => `<b>${esc(fMonth(keys[i]))}</b><br><i style="background:var(--series-1)"></i>Einnahmen: ${eur0(x.income)}<br><i style="background:var(--series-2)"></i>Ausgaben: ${eur0(x.expense)}<br>Überschuss: ${sEur(Math.round(x.balance))}`)
    })}</div>`;
  }
  h += savingsCard();
  return h;
}

function savingsCard(compact = false) {
  const sp = savingsPotential();
  if (!sp.items.length) {
    if (compact) return '';
    return `<div class="card"><div class="card-h"><span class="card-t">Sparpotenzial</span></div><p class="muted small">Sobald du Buchungen und Abos erfasst hast, berechnet LIFE OS hier automatisch, wo du am meisten sparen kannst.</p></div>`;
  }
  const r = S.settings.returnRate;
  let h = `<div class="card"><div class="card-h"><span class="card-t">Sparpotenzial</span><span class="badge blue">${esc(sp.basis.basis)}</span></div>
    <div class="big-num md pos">${eur0(sp.monthly)} <span class="muted" style="font-size:16px;font-weight:500">/ Monat</span></div>
    <div class="muted small" style="margin-top:4px">${eur0(sp.yearly)} pro Jahr · angelegt mit ${n1(r)} % Rendite nach 10 Jahren ≈ <b class="pos">${eurK(futureValue(sp.monthly, 10, r))}</b></div>`;
  const list = compact ? sp.items.slice(0, 3) : sp.items;
  h += `<div class="mt">` + list.map(i => `<div class="rec ${i.act ? 'tap' : ''}" ${i.act ? `data-act="${i.act}" data-id="${esc(i.id || '')}" data-cat="${esc(i.cat || '')}" style="cursor:pointer"` : ''}>
      <div class="rec-ico p3">${i.icon}</div><div class="grow"><div class="between"><span class="rec-t">${esc(i.title)}</span><span class="num pos" style="font-weight:600;white-space:nowrap">${eur0(i.monthly)}</span></div><div class="rec-x">${esc(i.text)}</div></div></div>`).join('') + `</div>`;
  if (compact && sp.items.length > 3) h += `<button class="link mt" data-act="go" data-tab="finanzen" data-sub="overview">Alle ${sp.items.length} Ansatzpunkte anzeigen</button>`;
  return h + `</div>`;
}

A.month = d => { const n = addMonthKey(UI.month, +d.d); if (n > curMonth()) return; UI.month = n; render(); };
A.txMonth = d => { const n = addMonthKey(UI.txMonth, +d.d); if (n > curMonth()) return; UI.txMonth = n; render(); };
A.catTx = d => { if (!d.cat) return; UI.txSearch = d.cat; UI.txFilter = 'all'; UI.sub.finanzen = 'tx'; UI.txMonth = UI.month; closeAllSheets(); UI.tab = 'finanzen'; render(true); };

/* ---------------- Buchungen ---------------- */
function finTx() {
  const k = UI.txMonth, cm = curMonth();
  let h = '';
  h += `<div class="search">${ic('search', 'sm')}<input type="search" placeholder="Suchen (Notiz, Kategorie, Betrag)" value="${esc(UI.txSearch)}" data-live="txsearch" enterkeyhint="search">${UI.txSearch ? `<button class="x-btn" data-act="clearTxSearch" aria-label="Suche löschen">${ic('x', 'sm')}</button>` : ''}</div>`;
  h += `<div id="txMonthNav" ${UI.txSearch ? 'hidden' : ''}>${periodNav('txMonth', fMonth(k), '', k >= cm)}</div>`;
  h += seg('txFilter', [['all', 'Alle'], ['expense', 'Ausgaben'], ['income', 'Einnahmen']], UI.txFilter);
  const rc = S.recurring.filter(r => r.active).length;
  h += `<div class="list"><button class="row has-ico" data-act="recurringList"><div class="cat-ico">${ic('repeat')}</div><div class="row-main"><div class="row-t">Daueraufträge & feste Zahlungen</div><div class="row-s">${rc ? `${rc} aktiv · werden automatisch gebucht` : 'z. B. Gehalt, Miete – automatisch buchen'}</div></div><span class="chev">${ic('chevR')}</span></button></div>`;
  h += `<div id="txList">${txListHtml()}</div>`;
  return h;
}

function txListHtml() {
  const q = UI.txSearch.toLowerCase();
  let list = S.transactions;
  if (q) {
    list = list.filter(t => (t.note || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q) || fmtIn(t.amount).includes(q) || eur(t.amount).toLowerCase().includes(q));
  } else {
    list = list.filter(t => t.date.slice(0, 7) === UI.txMonth);
  }
  if (UI.txFilter !== 'all') list = list.filter(t => t.type === UI.txFilter);
  list = list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  if (!list.length) return empty(q ? '🔍' : '🧾', q ? `Keine Treffer für „${esc(UI.txSearch)}“.` : 'Keine Buchungen in diesem Zeitraum.', q ? '' : '<button class="btn" data-act="addTx">Buchung hinzufügen</button>');
  const st = statsOf(list);
  let h = `<div class="list-f" style="padding-top:0">${list.length} Buchungen${q ? ' (alle Monate)' : ''} · <span class="pos">+${eur0(st.income)}</span> · −${eur0(st.expense)}</div>`;
  const shown = list.slice(0, 300);
  let day = null;
  shown.forEach(t => {
    if (t.date !== day) {
      if (day !== null) h += `</div>`;
      day = t.date;
      const ds = sum(list.filter(x => x.date === day), x => x.type === 'income' ? x.amount : -x.amount);
      h += `<div class="list-h"><span>${esc(relDayLong(day))}</span><span class="num">${sEur(ds)}</span></div><div class="list">`;
    }
    h += `<button class="row has-ico" data-act="editTx" data-id="${t.id}"><div class="cat-ico">${catIcon(t.category)}</div>
      <div class="row-main"><div class="row-t">${esc(t.note || t.category)}</div><div class="row-s">${esc(t.note ? t.category : (t.type === 'income' ? 'Einnahme' : 'Ausgabe'))}${t.recurringId || t.subId ? ' · automatisch' : ''}</div></div>
      <div class="row-r"><span class="amount ${t.type === 'income' ? 'pos' : ''}">${t.type === 'income' ? '+' : '−'}${eur(t.amount).replace('−', '')}</span></div></button>`;
  });
  if (day !== null) h += `</div>`;
  if (list.length > shown.length) h += `<div class="list-f center">Es werden die neuesten 300 Treffer angezeigt.</div>`;
  return h;
}
function relDayLong(s) {
  const d = diffDays(today(), s);
  if (d === 0) return 'Heute';
  if (d === -1) return 'Gestern';
  return DF.wdShort.format(pd(s));
}

document.addEventListener('input', e => {
  const el = e.target.closest('[data-live]');
  if (!el) return;
  const kind = el.dataset.live;
  if (kind === 'txsearch') {
    UI.txSearch = el.value;
    const nav = $('#txMonthNav'); if (nav) nav.hidden = !!el.value;
    const l = $('#txList'); if (l) l.innerHTML = txListHtml();
  } else if (kind === 'jsearch') {
    UI.jSearch = el.value;
    const l = $('#jList'); if (l) l.innerHTML = journalListHtml();
  } else if (kind === 'sim') {
    simChanged();
  }
});
A.clearTxSearch = () => { UI.txSearch = ''; render(); };

function txForm(tx, preset = {}) {
  const isNew = !tx;
  const t = tx || { type: preset.type || 'expense', date: today(), amount: null, category: '', note: '' };
  const ec = S.settings.expenseCats, icats = S.settings.incomeCats;
  const withCur = (arr, c) => c && !arr.includes(c) ? [...arr, c] : arr;
  const fields = [
    { key: 'type', label: 'Art', type: 'seg', options: [{ v: 'expense', l: 'Ausgabe' }, { v: 'income', l: 'Einnahme' }] },
    { key: 'amount', label: 'Betrag', type: 'money', required: true, big: true, min: 0.01 },
    { key: 'catE', label: 'Kategorie', type: 'select', options: withCur(ec, t.type === 'expense' ? t.category : ''), show: v => v.type === 'expense' },
    { key: 'catI', label: 'Kategorie', type: 'select', options: withCur(icats, t.type === 'income' ? t.category : ''), show: v => v.type === 'income' },
    { key: 'note', label: 'Notiz', type: 'text', placeholder: 'z. B. Supermarkt, Tankstelle …', max: 120 },
    { key: 'date', label: 'Datum', type: 'date', required: true }
  ];
  if (isNew) fields.push({ key: 'repeat', label: 'Jeden Monat automatisch buchen', type: 'toggle', group: true, hint: 'Ideal für Gehalt, Miete oder Sparraten. Du findest sie unter „Daueraufträge“.' });
  // Neue Buchung: zuletzt genutzte Kategorie vorschlagen
  const lastCat = type => { const l = S.transactions.filter(x => x.type === type && !x.recurringId && !x.subId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]; return l ? l.category : null; };
  const defE = lastCat('expense') || (ec.includes('Lebensmittel') ? 'Lebensmittel' : ec[0]);
  const defI = lastCat('income') || icats[0];
  const values = { type: t.type, amount: t.amount, catE: t.type === 'expense' && t.category ? t.category : (ec.includes(defE) ? defE : ec[0]), catI: t.type === 'income' && t.category ? t.category : (icats.includes(defI) ? defI : icats[0]), note: t.note, date: t.date, repeat: false };
  formSheet({
    title: isNew ? 'Neue Buchung' : 'Buchung bearbeiten', fields, values, focus: isNew ? 'amount' : null,
    onSave: async v => {
      const cat = v.type === 'expense' ? v.catE : v.catI;
      const obj = { ...(tx || {}), id: t.id || uid(), type: v.type, amount: round2(Math.abs(v.amount)), category: cat, note: v.note, date: v.date || today(), createdAt: t.createdAt || Date.now() };
      if (isNew && v.repeat) {
        const r = { id: uid(), type: v.type, amount: obj.amount, category: cat, note: v.note, cycle: 'monthly', anchor: pd(obj.date).getDate(), nextDate: addMonths(obj.date, 1), active: true };
        obj.recurringId = r.id;
        await put('recurring', r);
      }
      await put('transactions', obj);
      if (obj.date > today()) toast('Gespeichert (Datum liegt in der Zukunft)'); else toast(isNew ? 'Buchung gespeichert' : 'Änderung gespeichert');
    },
    onDelete: isNew ? null : async () => { await del('transactions', t.id); }
  });
}
A.addTx = d => txForm(null, { type: d.type });
A.editTx = d => { const t = S.transactions.find(x => x.id === d.id); if (t) txForm(t); };

/* ---------------- Daueraufträge ---------------- */
function recurringListHtml() {
  const list = S.recurring.slice().sort(by(r => r.nextDate || '9'));
  let h = `<p class="muted small" style="margin:0 4px 12px">Diese Zahlungen bucht LIFE OS automatisch am Fälligkeitstag – beim nächsten Öffnen der App.</p>`;
  if (!list.length) h += `<div class="card">${empty('🔁', 'Noch keine Daueraufträge angelegt.')}</div>`;
  else {
    const inc = sum(list.filter(r => r.active && r.type === 'income'), r => r.amount * cycleOf(r.cycle).perMonth);
    const exp = sum(list.filter(r => r.active && r.type === 'expense'), r => r.amount * cycleOf(r.cycle).perMonth);
    h += `<div class="stats"><div class="stat"><div class="stat-l">Feste Einnahmen</div><div class="stat-v pos">${eur0(inc)}</div><div class="stat-d">pro Monat</div></div><div class="stat"><div class="stat-l">Feste Ausgaben</div><div class="stat-v">${eur0(exp)}</div><div class="stat-d">pro Monat</div></div></div>`;
    h += `<div class="list">` + list.map(r => `<button class="row has-ico" data-act="editRecurring" data-id="${r.id}"><div class="cat-ico">${catIcon(r.category)}</div>
      <div class="row-main"><div class="row-t">${esc(r.note || r.category)}</div><div class="row-s">${esc(cycleOf(r.cycle).l)} · ${r.active ? 'nächste: ' + esc(fDate(r.nextDate)) : 'pausiert'}</div></div>
      <div class="row-r"><span class="amount ${r.type === 'income' ? 'pos' : ''}">${r.type === 'income' ? '+' : '−'}${eur(r.amount).replace('−', '')}</span></div></button>`).join('') + `</div>`;
  }
  h += `<button class="btn block" data-act="editRecurring">${ic('plus')} Dauerauftrag hinzufügen</button>`;
  return h;
}
A.recurringList = () => {
  openSheet({ title: 'Daueraufträge', body: recurringListHtml(), onMount: sh => { sh.el.dataset.kind = 'recurring'; } });
};
function refreshSheets() {
  sheetStack.forEach(sh => {
    if (sh.el.dataset.kind === 'recurring') sh.setBody(recurringListHtml());
    if (sh.refresh) sh.refresh();
  });
}
A.editRecurring = d => {
  const r = S.recurring.find(x => x.id === d.id);
  const isNew = !r;
  const t = r || { type: 'expense', amount: null, category: S.settings.expenseCats[0], note: '', cycle: 'monthly', nextDate: today(), active: true };
  const ec = S.settings.expenseCats, icats = S.settings.incomeCats;
  formSheet({
    title: isNew ? 'Neuer Dauerauftrag' : 'Dauerauftrag',
    fields: [
      { key: 'type', label: 'Art', type: 'seg', options: [{ v: 'expense', l: 'Ausgabe' }, { v: 'income', l: 'Einnahme' }] },
      { key: 'note', label: 'Bezeichnung', type: 'text', placeholder: 'z. B. Miete, Gehalt', required: true },
      { key: 'amount', label: 'Betrag', type: 'money', required: true, min: 0.01 },
      { key: 'catE', label: 'Kategorie', type: 'select', options: ec.includes(t.category) || t.type !== 'expense' ? ec : [...ec, t.category], show: v => v.type === 'expense' },
      { key: 'catI', label: 'Kategorie', type: 'select', options: icats.includes(t.category) || t.type !== 'income' ? icats : [...icats, t.category], show: v => v.type === 'income' },
      { key: 'cycle', label: 'Rhythmus', type: 'select', options: CYCLES.map(c => ({ v: c.v, l: c.l })), group: true },
      { key: 'nextDate', label: 'Nächste Fälligkeit', type: 'date', required: true, hint: 'Liegt das Datum in der Vergangenheit, werden alle seitdem fälligen Zahlungen nachgebucht.' },
      { key: 'active', label: 'Aktiv', type: 'toggle' }
    ],
    values: { ...t, catE: t.type === 'expense' ? t.category : ec[0], catI: t.type === 'income' ? t.category : icats[0] },
    onSave: async v => {
      const obj = { ...(r || {}), id: t.id || uid(), type: v.type, note: v.note, amount: round2(v.amount), category: v.type === 'expense' ? v.catE : v.catI, cycle: v.cycle, nextDate: v.nextDate, anchor: pd(v.nextDate).getDate(), active: v.active };
      await put('recurring', obj);
      const n = await processDue();
      if (n) toast(`${n} fällige Buchung${n > 1 ? 'en' : ''} erstellt`); else toast('Gespeichert');
      setTimeout(refreshSheets, 50);
    },
    onDelete: isNew ? null : async () => { await del('recurring', t.id); setTimeout(refreshSheets, 50); },
    deleteMsg: 'Bereits gebuchte Zahlungen bleiben erhalten.'
  });
};

/* ---------------- Budgets ---------------- */
A.editBudgets = () => {
  const cats = S.settings.expenseCats;
  const fields = [{ key: 'info', type: 'info', html: '<p class="small muted">Lege für einzelne Kategorien ein monatliches Limit fest. Leere Felder = kein Budget.</p>' }];
  const a = avgStats(3);
  cats.forEach(c => fields.push({ key: 'b_' + c, label: `${catIcon(c)} ${c}`, type: 'money', placeholder: a.byCat[c] ? `Ø ${fmtIn(Math.round(a.byCat[c]))}` : 'kein Budget', min: 0 }));
  const values = {};
  cats.forEach(c => { values['b_' + c] = S.settings.budgets[c] ?? null; });
  formSheet({
    title: 'Monatsbudgets', fields, values,
    onSave: async v => {
      const b = {};
      cats.forEach(c => { const x = v['b_' + c]; if (x != null && !isNaN(x) && x > 0) b[c] = round2(x); });
      S.settings.budgets = b;
      await saveSettings();
      toast('Budgets gespeichert');
    }
  });
};

/* ---------------- Vermögen ---------------- */
function finWealth() {
  const s = accountsSummary();
  const snaps = sortedSnapshots();
  const prevSnap = snaps.filter(x => x.id < curMonth()).pop();
  const a3 = avgStats(3);
  let h = `<div class="card"><div class="card-t">Nettovermögen</div><div class="big-num ${s.net < 0 ? 'neg' : ''}" style="margin-top:4px">${eur0(s.net)}</div>
    ${prevSnap ? `<div class="small muted" style="margin-top:4px">${deltaHtml(s.net, prevSnap.net, true, v => sEur(Math.round(v)))} seit ${esc(fMonth(prevSnap.id))}</div>` : ''}
    <div class="inline-stats"><div><div class="stat-l">Vermögen</div><div class="num" style="font-weight:600">${eur0(s.assets)}</div></div><div><div class="stat-l">Schulden</div><div class="num ${s.debts ? 'neg' : ''}" style="font-weight:600">${s.debts ? '−' : ''}${eur0(s.debts)}</div></div><div><div class="stat-l">Liquide</div><div class="num" style="font-weight:600">${eur0(s.liquid)}</div></div></div>`;
  if (snaps.length >= 2) {
    const last = snaps.slice(-24);
    h += `<div class="mt">${lineChart({ labels: last.map(x => fMon(x.id) + ' ' + x.id.slice(2, 4)), series: [{ name: 'Nettovermögen', values: last.map(x => x.net), color: 'var(--series-1)' }], fmt: eur0 })}</div>`;
  } else if (S.accounts.length) {
    h += `<p class="small muted mt">Der Verlauf entsteht automatisch: Aktualisiere deine Kontostände einmal im Monat.</p>`;
  }
  h += `</div>`;
  if (a3.expense > 0 && S.accounts.length) {
    const months = s.liquid / a3.expense;
    const cls = months >= 6 ? 'green' : months >= 3 ? '' : months >= 1 ? 'orange' : 'red';
    h += `<div class="card"><div class="card-h"><span class="card-t">Notgroschen</span><span class="badge ${cls === 'green' ? 'green' : cls === 'red' ? 'red' : cls === 'orange' ? 'orange' : 'blue'}">${n1(months)} Monate</span></div>
      ${bar(months / 6, cls || 'green')}<p class="small muted" style="margin-top:8px">Liquide Mittel ${eur0(s.liquid)} decken ${n1(months)} Monate deiner Ausgaben (Ø ${eur0(a3.expense)}). Empfohlen werden 3–6 Monate${months < 3 ? ` – es fehlen ${eur0(a3.expense * 3 - s.liquid)} bis 3 Monate.` : '.'}</p></div>`;
  }
  if (!S.accounts.length) {
    h += `<div class="card">${empty('🏦', 'Lege deine Konten, Depots und Kredite an, um dein Nettovermögen zu verfolgen.', '<button class="btn" data-act="addAccount">Konto hinzufügen</button>')}</div>`;
    return h;
  }
  const assets = S.accounts.filter(a => !accType(a.type).debt).sort(by(a => +a.balance || 0, -1));
  const debts = S.accounts.filter(a => accType(a.type).debt).sort(by(a => +a.balance || 0, -1));
  const row = a => {
    const t = accType(a.type);
    const age = a.updatedAt ? diffDays(a.updatedAt, today()) : null;
    return `<button class="row has-ico" data-act="editAccount" data-id="${a.id}"><div class="cat-ico">${t.icon}</div>
      <div class="row-main"><div class="row-t">${esc(a.name)}</div><div class="row-s">${esc(t.l)}${a.interest ? ` · ${n1(a.interest)} % Zins` : ''} · ${age == null ? '' : age === 0 ? 'heute aktualisiert' : `<span class="${age > 35 ? 'warn' : ''}">vor ${age} Tagen aktualisiert</span>`}</div></div>
      <div class="row-r"><span class="amount ${t.debt ? 'neg' : ''}">${t.debt ? '−' : ''}${eur0(Math.abs(a.balance))}</span><span class="chev">${ic('chevR', 'sm')}</span></div></button>`;
  };
  if (assets.length) h += `<div class="list-h"><span>Vermögenswerte</span><span class="num">${eur0(s.assets)}</span></div><div class="list">${assets.map(row).join('')}</div>`;
  if (debts.length) h += `<div class="list-h"><span>Verbindlichkeiten</span><span class="num">−${eur0(s.debts)}</span></div><div class="list">${debts.map(row).join('')}</div>`;
  h += `<div class="hint-box">💡 Überweisungen auf dein Spar- oder Depotkonto sind keine Ausgaben. Erfasse sie nicht als Buchung – aktualisiere einfach den Kontostand.</div>`;
  return h;
}

function accountForm(acc) {
  const isNew = !acc;
  const a = acc || { name: '', type: 'giro', balance: null, interest: null, note: '' };
  formSheet({
    title: isNew ? 'Neues Konto' : a.name,
    fields: [
      { key: 'balance', label: 'Aktueller Stand', type: 'money', required: true, big: true, hint: 'Bei Krediten den offenen Betrag als positive Zahl eingeben.' },
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'z. B. Sparkasse Giro', group: true },
      { key: 'type', label: 'Art', type: 'select', options: ACC_TYPES.map(t => ({ v: t.v, l: `${t.icon} ${t.l}` })) },
      { key: 'interest', label: 'Zinssatz (optional)', type: 'number', unit: '% p. a.', placeholder: 'z. B. 3,5' },
      { key: 'note', label: 'Notiz', type: 'text' }
    ],
    values: a, focus: isNew ? null : 'balance',
    onSave: async v => {
      const obj = { ...(acc || {}), id: a.id || uid(), name: v.name, type: v.type, balance: round2(accType(v.type).debt ? Math.abs(v.balance) : v.balance), interest: v.interest, note: v.note, updatedAt: today() };
      await put('accounts', obj);
      await updateSnapshot();
      toast('Kontostand gespeichert');
    },
    onDelete: isNew ? null : async () => { await del('accounts', a.id); await updateSnapshot(); },
    deleteMsg: 'Das Konto wird entfernt. Der bisherige Vermögensverlauf bleibt erhalten.'
  });
}
A.addAccount = () => accountForm(null);
A.editAccount = d => { const a = S.accounts.find(x => x.id === d.id); if (a) accountForm(a); };

/* ---------------- Abonnements ---------------- */
function finSubs() {
  const subs = S.subscriptions;
  const active = subs.filter(s => s.active);
  const monthly = sum(active, monthlyCost);
  const a3 = avgStats(3);
  let h = `<div class="stats three">
    <div class="stat"><div class="stat-l">pro Monat</div><div class="stat-v">${eur0(monthly)}</div></div>
    <div class="stat"><div class="stat-l">pro Jahr</div><div class="stat-v">${eur0(monthly * 12)}</div></div>
    <div class="stat"><div class="stat-l">Anzahl</div><div class="stat-v">${active.length}</div></div></div>`;
  if (a3.income > 0 && monthly > 0) h += `<p class="small muted" style="margin:-4px 4px 14px">Abos binden ${pct(monthly / a3.income * 100)} deines Einkommens. In 10 Jahren zahlst du dafür ${eurK(monthly * 120)}.</p>`;
  if (!subs.length) return h + `<div class="card">${empty('🔁', 'Erfasse Streaming, Fitnessstudio, Handyvertrag & Co. – LIFE OS erinnert dich an Kündigungsfristen und findet Sparpotenzial.', '<button class="btn" data-act="addSub">Abo hinzufügen</button>')}</div>`;
  const t = today(), in30 = addDays(t, 30);
  const soon = active.filter(s => s.nextDate && s.nextDate <= in30).sort(by(s => s.nextDate));
  const cancel = active.filter(s => s.cancelBy && s.cancelBy >= t && s.cancelBy <= addDays(t, 45)).sort(by(s => s.cancelBy));
  const low = active.filter(s => (s.rating || 3) <= 2);
  if (cancel.length) h += `<div class="list-h"><span>⚠️ Kündigungsfristen</span></div><div class="list">${cancel.map(s => subRow(s, `Kündigen bis ${fDate(s.cancelBy)} (${relIn(s.cancelBy)})`)).join('')}</div>`;
  if (low.length) h += `<div class="list-h"><span>Kündigungskandidaten</span><span class="pos">${eur0(sum(low, monthlyCost) * 12)}/Jahr</span></div><div class="list">${low.map(s => subRow(s, `Nutzen ${s.rating}/5`)).join('')}</div>`;
  if (soon.length) h += `<div class="list-h"><span>Nächste 30 Tage</span><span class="num">${eur0(sum(soon, s => s.amount))}</span></div><div class="list">${soon.map(s => subRow(s, `${relDay(s.nextDate)} fällig`)).join('')}</div>`;
  h += `<div class="list-h"><span>Alle aktiven Abos</span></div><div class="list">${active.slice().sort(by(monthlyCost, -1)).map(s => subRow(s)).join('') || '<div class="row muted">Keine aktiven Abos</div>'}</div>`;
  const inactive = subs.filter(s => !s.active);
  if (inactive.length) h += `<div class="list-h"><span>Gekündigt / pausiert</span><span class="pos">${eur0(sum(inactive, monthlyCost) * 12)}/Jahr gespart</span></div><div class="list">${inactive.map(s => subRow(s, 'Inaktiv')).join('')}</div>`;
  return h;
}
function subRow(s, info) {
  const stars = '★'.repeat(s.rating || 0) + '☆'.repeat(5 - (s.rating || 0));
  return `<button class="row" data-act="editSub" data-id="${s.id}"><div class="row-main"><div class="row-t">${esc(s.name)}</div>
    <div class="row-s">${esc(info || `${s.category || ''} · ${cycleOf(s.cycle).l}`)} · <span style="color:var(--orange-ui)">${stars}</span></div></div>
    <div class="row-r"><div><div class="amount">${eur(s.amount)}</div>${s.cycle !== 'monthly' ? `<div class="small muted">${eur(monthlyCost(s))}/Mon.</div>` : `<div class="small muted">/ Monat</div>`}</div></div></button>`;
}
function subForm(sub) {
  const isNew = !sub;
  const s = sub || { name: '', amount: null, cycle: 'monthly', category: SUB_CATS[0], nextDate: addMonths(today(), 1), cancelBy: '', rating: 3, autoBook: true, active: true, note: '' };
  formSheet({
    title: isNew ? 'Neues Abo' : s.name,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'z. B. Netflix, Fitnessstudio' },
      { key: 'amount', label: 'Preis', type: 'money', required: true, min: 0 },
      { key: 'cycle', label: 'Abrechnung', type: 'select', options: CYCLES.map(c => ({ v: c.v, l: c.l })) },
      { key: 'category', label: 'Kategorie', type: 'select', options: SUB_CATS.includes(s.category) ? SUB_CATS : [...SUB_CATS, s.category] },
      { key: 'rating', label: 'Wie viel Nutzen bringt es dir?', type: 'rating', numeric: true, options: [1, 2, 3, 4, 5].map(n => ({ v: n, l: n + ' ★' })), group: true, hint: '1 = kaum genutzt · 5 = unverzichtbar. Abos mit 1–2 Sternen werden als Sparpotenzial markiert.' },
      { key: 'nextDate', label: 'Nächste Abbuchung', type: 'date', required: true, group: true },
      { key: 'cancelBy', label: 'Kündigen spätestens bis (optional)', type: 'date', hint: 'LIFE OS erinnert dich rechtzeitig.' },
      { key: 'autoBook', label: 'Automatisch als Ausgabe buchen', type: 'toggle' },
      { key: 'active', label: 'Abo aktiv', type: 'toggle' },
      { key: 'note', label: 'Notiz', type: 'text', placeholder: 'z. B. Kundennummer, Kündigungsweg', group: true }
    ],
    values: s,
    onSave: async v => {
      const obj = { ...(sub || {}), id: s.id || uid(), ...v, amount: round2(v.amount), anchor: pd(v.nextDate).getDate() };
      await put('subscriptions', obj);
      const n = await processDue();
      toast(n ? `Gespeichert · ${n} Abbuchung${n > 1 ? 'en' : ''} gebucht` : 'Abo gespeichert');
    },
    onDelete: isNew ? null : async () => { await del('subscriptions', s.id); },
    deleteMsg: 'Tipp: Stattdessen „Abo aktiv“ ausschalten – dann siehst du weiterhin, wie viel du durch die Kündigung sparst.'
  });
}
A.addSub = () => subForm(null);
A.editSub = d => { const s = S.subscriptions.find(x => x.id === d.id); if (s) subForm(s); };

/* ---------------- Zukunftssimulation ---------------- */
function simDefaults() {
  const s = accountsSummary(), a = avgStats(3);
  // Erst wenn ein ganzer Monat vorliegt, ist der Überschuss aussagekräftig
  const monthly = a.basis === 'laufender Monat' ? 0 : Math.max(0, Math.round(a.balance));
  return { start: Math.round(s.net), monthly, rate: S.settings.returnRate, infl: S.settings.inflation, dyn: 0 };
}
function finFuture() {
  const p = S.settings.sim || simDefaults();
  const fld = (key, label, unit, val) => `<div class="field inline"><label class="flabel" for="sim_${key}">${label}</label><div class="fctl" style="max-width:48%"><input id="sim_${key}" class="in num" style="text-align:right" inputmode="decimal" data-live="sim" data-k="${key}" value="${esc(fmtIn(val))}"><span class="unit">${unit}</span></div></div>`;
  let h = `<div class="form"><div class="fgroup">
    ${fld('start', 'Startvermögen', '€', p.start)}
    ${fld('monthly', 'Sparrate pro Monat', '€', p.monthly)}
    ${fld('rate', 'Rendite pro Jahr', '%', p.rate)}
    ${fld('infl', 'Inflation pro Jahr', '%', p.infl)}
    ${fld('dyn', 'Sparrate steigt jährlich um', '%', p.dyn)}
  </div></div>
  <div class="between" style="margin:-4px 4px 14px"><button class="link" data-act="simReset">Werte aus meinen Daten übernehmen</button></div>
  <div id="simOut">${simResults(p)}</div>`;
  return h;
}
function readSim() {
  const p = {};
  $$('[data-live="sim"]').forEach(el => { const v = parseNum(el.value); p[el.dataset.k] = isNaN(v) ? 0 : v; });
  return p;
}
let simSaveTimer;
function simChanged() {
  const p = readSim();
  const out = $('#simOut');
  if (out) out.innerHTML = simResults(p);
  clearTimeout(simSaveTimer);
  simSaveTimer = setTimeout(() => { S.settings.sim = p; saveSettings(); }, 600);
}
A.simReset = async () => { S.settings.sim = null; await saveSettings(); render(); toast('Werte übernommen'); };

function simResults(p) {
  const rate = clamp(p.rate || 0, -20, 30), infl = clamp(p.infl || 0, -5, 20), dyn = clamp(p.dyn || 0, -20, 30);
  const base = simulate({ start: p.start || 0, monthly: p.monthly || 0, rate, dyn });
  const pess = simulate({ start: p.start || 0, monthly: p.monthly || 0, rate: Math.max(0, rate - 2), dyn });
  const opt = simulate({ start: p.start || 0, monthly: p.monthly || 0, rate: rate + 2, dyn });
  const real = (v, y) => v / Math.pow(1 + infl / 100, y);
  let h = `<div class="card"><div class="card-h"><span class="card-t">Ergebnis</span></div><table class="tbl"><thead><tr><th>Jahre</th><th>Vermögen</th><th>Kaufkraft heute</th><th>davon Erträge</th></tr></thead><tbody>`;
  [1, 5, 10, 30].forEach(y => {
    const r = base[y];
    h += `<tr class="${y === 10 ? 'hl' : ''}"><td>${y}</td><td>${eurK(r.v)}</td><td>${eurK(real(r.v, y))}</td><td class="${r.v - r.paid >= 0 ? 'pos' : 'neg'}">${eurK(r.v - r.paid)}</td></tr>`;
  });
  h += `</tbody></table><p class="small muted mt">„Kaufkraft heute“ berücksichtigt ${n1(infl)} % Inflation. „Erträge“ = Zinsen und Kursgewinne über deine Einzahlungen hinaus.</p></div>`;
  h += `<div class="card"><div class="card-h"><span class="card-t">Szenarien über 30 Jahre</span></div>${lineChart({
    labels: base.map(x => x.y === 0 ? 'Heute' : 'J. ' + x.y), xEvery: 5,
    series: [
      { name: `Vorsichtig (${n1(Math.max(0, rate - 2))} %)`, values: pess.map(x => x.v), color: 'var(--series-2)' },
      { name: `Basis (${n1(rate)} %)`, values: base.map(x => x.v), color: 'var(--series-1)' },
      { name: `Optimistisch (${n1(rate + 2)} %)`, values: opt.map(x => x.v), color: 'var(--series-3)' }
    ], fmt: eurK, zero: true
  })}</div>`;
  // Sparpotenzial-Effekt
  const sp = savingsPotential();
  if (sp.monthly > 0) {
    const better = simulate({ start: p.start || 0, monthly: (p.monthly || 0) + sp.monthly, rate, dyn });
    h += `<div class="card"><div class="card-h"><span class="card-t">Wenn du dein Sparpotenzial nutzt</span></div>
      <p class="small muted">Zusätzlich ${eur0(sp.monthly)} pro Monat anlegen:</p>
      <div class="kv"><span>nach 10 Jahren</span><span class="num pos">+${eurK(better[10].v - base[10].v)}</span></div>
      <div class="kv"><span>nach 30 Jahren</span><span class="num pos">+${eurK(better[30].v - base[30].v)}</span></div></div>`;
  }
  // Finanzielle Unabhängigkeit
  const a3 = avgStats(3);
  if (a3.expense > 0) {
    const target = a3.expense * 12 / 0.04;
    const long = simulate({ start: p.start || 0, monthly: p.monthly || 0, rate, dyn, years: 60 });
    const hit = long.find(x => real(x.v, x.y) >= target);
    h += `<div class="card"><div class="card-h"><span class="card-t">Finanzielle Unabhängigkeit</span></div>
      <p class="small">Bei Ausgaben von Ø ${eur0(a3.expense)} im Monat brauchst du nach der 4 %-Regel rund <b>${eurK(target)}</b> (in heutiger Kaufkraft).</p>
      <div class="big-num md mt">${hit ? (hit.y === 0 ? 'Bereits erreicht 🎉' : `in ${hit.y} Jahren`) : 'über 60 Jahre'}</div>
      ${bar(clamp(real(base[0].v, 0) / target, 0, 1))}
      <p class="small muted" style="margin-top:6px">Aktuell: ${pct(clamp((p.start || 0) / target * 100, -999, 999))} des Zielvermögens.</p></div>`;
  }
  h += `<p class="small muted" style="margin:0 4px">Modellrechnung mit konstanter Rendite – reale Märkte schwanken. Keine Anlageberatung.</p>`;
  return h;
}
/* =========================================================
   ZIELE, GEWOHNHEITEN, AUFGABEN, FOKUS
   ========================================================= */

/* ---------------- Ziele ---------------- */
function goalCurrent(g) {
  if (g.kind !== 'milestones' && g.linkedAccount) {
    const a = S.accounts.find(x => x.id === g.linkedAccount);
    if (a) return Math.abs(+a.balance || 0);
  }
  return g.current ?? g.start ?? 0;
}
function goalProgress(g) {
  if (g.kind === 'milestones') {
    const t = (g.milestones || []).length;
    if (!t) return g.status === 'done' ? 1 : 0;
    return g.milestones.filter(m => m.done).length / t;
  }
  const cur = goalCurrent(g), start = g.start ?? 0, target = g.target;
  if (target == null) return 0;
  if (target === start) return cur === target ? 1 : 0;
  return clamp((cur - start) / (target - start), 0, 1);
}
function goalStatus(g) {
  const p = goalProgress(g);
  if (g.status === 'done' || p >= 1) return { key: 'done', label: 'Erreicht', cls: 'green' };
  if (!g.deadline) return { key: 'open', label: 'Ohne Frist', cls: '' };
  const t = today();
  if (g.deadline < t) return { key: 'late', label: 'Überfällig', cls: 'red' };
  const total = diffDays(g.createdAt || t, g.deadline), el = diffDays(g.createdAt || t, t);
  const exp = total > 0 ? clamp(el / total, 0, 1) : 1;
  if (p + 0.08 >= exp) return { key: 'ok', label: 'Im Plan', cls: 'blue', exp };
  return { key: 'behind', label: 'Rückstand', cls: 'orange', exp };
}
const fmtGoalVal = (g, v) => (g.unit || '').trim() === '€' ? eur0(v) : `${n1(v)} ${g.unit || ''}`.trim();
function goalPace(g) {
  if (g.kind === 'milestones' || g.target == null || !g.deadline) return null;
  const t = today();
  if (g.deadline <= t) return null;
  const remaining = g.target - goalCurrent(g);
  if ((g.target >= (g.start ?? 0) && remaining <= 0) || (g.target < (g.start ?? 0) && remaining >= 0)) return null;
  const months = Math.max(diffDays(t, g.deadline) / 30.44, 0.25);
  const perMonth = remaining / months;
  const perWeek = remaining / Math.max(diffDays(t, g.deadline) / 7, 1);
  return { perMonth, perWeek, months };
}
const activeGoals = () => S.goals.filter(g => g.status !== 'done');

VIEWS.ziele = () => {
  const sub = UI.sub.ziele;
  const body = seg('ziele', [['goals', 'Ziele'], ['habits', 'Gewohnheiten'], ['tasks', 'Aufgaben']], sub)
    + ({ goals: goalsView, habits: habitsView, tasks: tasksView }[sub] || goalsView)();
  const act = { goals: 'addGoal', habits: 'addHabit', tasks: 'addTask' }[sub];
  return page('Ziele', body, { action: `<button class="icon-btn" data-act="${act}" aria-label="Hinzufügen">${ic('plus')}</button>` });
};

function goalCard(g) {
  const p = goalProgress(g), st = goalStatus(g), area = areaById(g.area);
  const next = g.kind === 'milestones' ? (g.milestones || []).find(m => !m.done) : null;
  const pace = goalPace(g);
  let sub = '';
  if (g.kind === 'milestones') sub = `${(g.milestones || []).filter(m => m.done).length} von ${(g.milestones || []).length} Meilensteinen${next ? ` · Nächster: ${esc(next.title)}` : ''}`;
  else sub = `${esc(fmtGoalVal(g, goalCurrent(g)))} von ${esc(fmtGoalVal(g, g.target))}${pace ? ` · nötig: ${esc(fmtGoalVal(g, Math.abs(pace.perMonth)))}/Monat` : ''}`;
  return `<div class="card tap" data-act="goalDetail" data-id="${g.id}">
    <div class="between"><span class="small muted">${area.icon} ${esc(area.name)}</span><span class="badge ${st.cls}">${st.label}</span></div>
    <div style="font-weight:600;font-size:18px;margin:6px 0 10px">${esc(g.title)}</div>
    ${bar(p, st.key === 'done' ? 'green' : st.key === 'behind' || st.key === 'late' ? 'orange' : '')}
    <div class="between small" style="margin-top:7px"><span class="muted" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</span><b class="num">${Math.round(p * 100)} %</b></div>
    ${g.deadline ? `<div class="small muted" style="margin-top:3px">Frist: ${esc(fDate(g.deadline))} (${esc(relIn(g.deadline))})</div>` : ''}
  </div>`;
}

function goalsView() {
  const act = activeGoals().sort(by(g => g.deadline || '9999'));
  const done = S.goals.filter(g => g.status === 'done').sort(by(g => g.doneAt || '', -1));
  let h = '';
  if (!S.goals.length) {
    return `<div class="card">${empty('🎯', 'Ziele geben deinen Gewohnheiten und Finanzen eine Richtung. Starte mit einem Ziel, das dir in den nächsten 3–12 Monaten wirklich wichtig ist.', '<button class="btn" data-act="addGoal">Erstes Ziel setzen</button>')}</div>
      <div class="hint-box">💡 Gute Ziele sind konkret und messbar: statt „mehr sparen“ lieber „10.000 € Notgroschen bis Dezember“.</div>`;
  }
  if (act.length) {
    const behind = act.filter(g => ['behind', 'late'].includes(goalStatus(g).key)).length;
    h += `<div class="stats three"><div class="stat"><div class="stat-l">Aktiv</div><div class="stat-v">${act.length}</div></div><div class="stat"><div class="stat-l">Im Rückstand</div><div class="stat-v ${behind ? 'warn' : ''}">${behind}</div></div><div class="stat"><div class="stat-l">Erreicht</div><div class="stat-v pos">${done.length}</div></div></div>`;
    h += act.map(goalCard).join('');
  } else h += `<div class="card">${empty('🏁', 'Alle Ziele erreicht! Zeit für ein neues?', '<button class="btn" data-act="addGoal">Neues Ziel</button>')}</div>`;
  if (done.length) {
    h += `<button class="link" style="margin:6px 4px 12px" data-act="toggleDoneGoals">${UI.showDoneGoals ? 'Erreichte Ziele ausblenden' : `Erreichte Ziele anzeigen (${done.length})`}</button>`;
    if (UI.showDoneGoals) h += done.map(goalCard).join('');
  }
  return h;
}
A.toggleDoneGoals = () => { UI.showDoneGoals = !UI.showDoneGoals; render(); };

function goalForm(goal, after) {
  const isNew = !goal;
  const g = goal || { title: '', area: 'finanzen', kind: 'number', unit: '€', start: 0, target: null, current: null, deadline: addMonths(today(), 6), why: '', linkedAccount: '' };
  const accOpts = [{ v: '', l: 'Keins – Wert selbst eintragen' }, ...S.accounts.map(a => ({ v: a.id, l: `${accType(a.type).icon} ${a.name}` }))];
  formSheet({
    title: isNew ? 'Neues Ziel' : 'Ziel bearbeiten',
    fields: [
      { key: 'title', label: 'Was willst du erreichen?', type: 'text', required: true, placeholder: 'z. B. 10.000 € Notgroschen aufbauen' },
      { key: 'area', label: 'Lebensbereich', type: 'select', options: AREA_OPTS },
      { key: 'kind', label: 'Fortschritt messen über', type: 'seg', options: [{ v: 'number', l: 'Zahlenwert' }, { v: 'milestones', l: 'Meilensteine' }], group: true },
      { key: 'unit', label: 'Einheit', type: 'text', placeholder: '€, kg, Bücher, km …', show: v => v.kind === 'number' },
      { key: 'start', label: 'Startwert', type: 'number', show: v => v.kind === 'number', hint: 'Bei Zielen wie „Abnehmen“ oder „Schulden tilgen“ ist der Zielwert kleiner als der Startwert – das funktioniert auch.' },
      { key: 'target', label: 'Zielwert', type: 'number', required: true, show: v => v.kind === 'number' },
      { key: 'linkedAccount', label: 'Automatisch aus Konto übernehmen', type: 'select', options: accOpts, show: v => v.kind === 'number' && S.accounts.length > 0 },
      { key: 'current', label: 'Aktueller Wert', type: 'number', show: v => v.kind === 'number' && !v.linkedAccount },
      { key: 'deadline', label: 'Bis wann? (optional)', type: 'date', group: true },
      { key: 'why', label: 'Warum ist dir das wichtig?', type: 'textarea', rows: 3, placeholder: 'Dein „Warum“ hilft dir, dranzubleiben.' }
    ],
    values: { ...g, linkedAccount: g.linkedAccount || '' },
    onSave: async v => {
      const obj = {
        ...(goal || { milestones: [], status: 'active', createdAt: today(), history: [] }), id: g.id || uid(),
        title: v.title, area: v.area, kind: v.kind, unit: v.unit || '', start: v.start ?? 0, target: v.target,
        current: v.current ?? (goal ? goal.current : v.start ?? 0), deadline: v.deadline, why: v.why, linkedAccount: v.linkedAccount || ''
      };
      await put('goals', obj);
      toast(isNew ? 'Ziel angelegt' : 'Ziel gespeichert');
      if (isNew && obj.kind === 'milestones') setTimeout(() => A.goalDetail({ id: obj.id }), 420);
      if (after) setTimeout(after, 60);
    },
    onDelete: isNew ? null : async () => { await del('goals', g.id); closeAllSheets(); }
  });
}
A.addGoal = () => goalForm(null);

function goalDetailHtml(g) {
  const p = goalProgress(g), st = goalStatus(g), area = areaById(g.area), pace = goalPace(g);
  let h = `<div class="card"><div class="between"><span class="small muted">${area.icon} ${esc(area.name)}</span><span class="badge ${st.cls}">${st.label}</span></div>
    <div style="font-weight:700;font-size:22px;margin:8px 0 12px" class="wrap-anywhere">${esc(g.title)}</div>
    ${bar(p, st.key === 'done' ? 'green' : '')}
    <div class="between" style="margin-top:8px"><span class="big-num md">${Math.round(p * 100)} %</span>
    ${g.kind !== 'milestones' ? `<span class="muted num">${esc(fmtGoalVal(g, goalCurrent(g)))} / ${esc(fmtGoalVal(g, g.target))}</span>` : ''}</div>`;
  if (st.exp != null && st.key !== 'done') h += `<p class="small muted" style="margin-top:6px">Zeitlich wären ${Math.round(st.exp * 100)} % zu erwarten.</p>`;
  if (pace) h += `<p class="small" style="margin-top:6px">Nötiges Tempo: <b>${esc(fmtGoalVal(g, Math.abs(pace.perMonth)))}</b> pro Monat (${esc(fmtGoalVal(g, Math.abs(pace.perWeek)))} pro Woche).</p>`;
  if (g.deadline) h += `<p class="small muted" style="margin-top:4px">Frist: ${esc(fDate(g.deadline))} · ${esc(relIn(g.deadline))}</p>`;
  if (g.linkedAccount) { const a = S.accounts.find(x => x.id === g.linkedAccount); if (a) h += `<p class="small muted" style="margin-top:4px">Wert wird automatisch aus „${esc(a.name)}“ übernommen.</p>`; }
  h += `</div>`;
  if (g.kind !== 'milestones' && !g.linkedAccount && g.status !== 'done') h += `<button class="btn block" data-act="goalUpdate" data-id="${g.id}" style="margin-bottom:14px">Fortschritt aktualisieren</button>`;
  // Meilensteine
  const ms = g.milestones || [];
  h += `<div class="list-h"><span>Meilensteine</span><span>${ms.filter(m => m.done).length}/${ms.length}</span></div><div class="list">`;
  h += ms.map(m => `<div class="row"><button class="check ${m.done ? 'on' : ''}" data-act="msToggle" data-gid="${g.id}" data-mid="${m.id}" aria-label="Erledigt">${ic('check')}</button>
    <div class="row-main"><div class="row-t ${m.done ? 'done-t' : ''}" style="white-space:normal">${esc(m.title)}</div>${m.doneAt ? `<div class="row-s">erledigt am ${esc(fDate(m.doneAt))}</div>` : ''}</div>
    <button class="x-btn" data-act="msDelete" data-gid="${g.id}" data-mid="${m.id}" aria-label="Löschen">${ic('x', 'sm')}</button></div>`).join('');
  h += `<form class="row" data-submit="addMs" data-gid="${g.id}"><input class="in" name="ms" placeholder="Meilenstein hinzufügen …" autocomplete="off" enterkeyhint="done"><button class="icon-btn" type="submit" aria-label="Hinzufügen">${ic('plus')}</button></form></div>`;
  if (ms.length === 0) h += `<p class="small muted" style="margin:-6px 4px 14px">Teile dein Ziel in kleine, konkrete Schritte – das macht Fortschritt sichtbar.</p>`;
  if (g.why) h += `<div class="card"><div class="card-t">Dein Warum</div><p class="prose mt">${esc(g.why)}</p></div>`;
  if ((g.history || []).length > 1 && g.kind !== 'milestones') {
    const hist = g.history.slice(-24);
    h += `<div class="card"><div class="card-t">Verlauf</div>${lineChart({ labels: hist.map(x => fDay(x.date)), series: [{ name: g.title, values: hist.map(x => x.value), color: 'var(--series-1)' }], fmt: v => fmtGoalVal(g, v), yfmt: v => tickFmt(v) })}</div>`;
  }
  h += `<div class="btn-row"><button class="btn gray" data-act="goalEdit" data-id="${g.id}">${ic('edit', 'sm')} Bearbeiten</button>
    <button class="btn ${g.status === 'done' ? 'gray' : 'tinted'}" data-act="goalDone" data-id="${g.id}">${g.status === 'done' ? 'Wieder öffnen' : `${ic('check', 'sm')} Erreicht`}</button></div>`;
  return h;
}
A.goalDetail = d => {
  const g = S.goals.find(x => x.id === d.id);
  if (!g) return;
  const sh = openSheet({ title: 'Ziel', body: goalDetailHtml(g), tall: true });
  sh.refresh = () => { const gg = S.goals.find(x => x.id === d.id); if (gg) sh.setBody(goalDetailHtml(gg)); else sh.close(); };
};
A.goalEdit = d => { const g = S.goals.find(x => x.id === d.id); if (g) goalForm(g, refreshSheets); };
A.goalUpdate = d => {
  const g = S.goals.find(x => x.id === d.id);
  if (!g) return;
  formSheet({
    title: 'Fortschritt', saveLabel: 'Sichern',
    fields: [{ key: 'current', label: `Aktueller Wert${g.unit ? ` (${g.unit})` : ''}`, type: 'number', required: true, hint: `Ziel: ${fmtGoalVal(g, g.target)}` }],
    values: { current: goalCurrent(g) }, focus: 'current',
    onSave: async v => {
      g.current = v.current;
      g.history = [...(g.history || []).filter(x => x.date !== today()), { date: today(), value: v.current }];
      if (goalProgress(g) >= 1 && g.status !== 'done') { g.status = 'done'; g.doneAt = today(); toast('🎉 Ziel erreicht – großartig!'); }
      else toast('Fortschritt gespeichert');
      await put('goals', g);
      setTimeout(refreshSheets, 60);
    }
  });
};
A.goalDone = async d => {
  const g = S.goals.find(x => x.id === d.id);
  if (!g) return;
  if (g.status === 'done') { g.status = 'active'; g.doneAt = null; }
  else { g.status = 'done'; g.doneAt = today(); toast('🎉 Glückwunsch zum erreichten Ziel!'); }
  await put('goals', g);
  refreshSheets(); render();
};
A.msToggle = async d => {
  const g = S.goals.find(x => x.id === d.gid);
  const m = g && (g.milestones || []).find(x => x.id === d.mid);
  if (!m) return;
  m.done = !m.done; m.doneAt = m.done ? today() : null;
  if (g.kind === 'milestones' && goalProgress(g) >= 1 && g.status !== 'done') { g.status = 'done'; g.doneAt = today(); toast('🎉 Alle Meilensteine geschafft – Ziel erreicht!'); }
  await put('goals', g);
  refreshSheets(); render();
};
A.msDelete = async d => {
  const g = S.goals.find(x => x.id === d.gid);
  if (!g) return;
  g.milestones = (g.milestones || []).filter(x => x.id !== d.mid);
  await put('goals', g);
  refreshSheets(); render();
};

/* Formular-Absendungen (Schnelleingaben) */
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  const kind = f.dataset.submit;
  try {
    if (kind === 'addMs') {
      const inp = f.querySelector('input'); const title = inp.value.trim();
      if (!title) return;
      const g = S.goals.find(x => x.id === f.dataset.gid);
      if (!g) return;
      g.milestones = [...(g.milestones || []), { id: uid(), title, done: false }];
      if (g.status === 'done' && g.kind === 'milestones') { g.status = 'active'; g.doneAt = null; }
      await put('goals', g);
      refreshSheets(); render();
      const ni = $('form[data-submit="addMs"] input', topSheet()?.el || document); if (ni) ni.focus();
    } else if (kind === 'quickTask') {
      const inp = f.querySelector('input'); const title = inp.value.trim();
      if (!title) return;
      await put('tasks', { id: uid(), title, due: '', prio: 'normal', important: false, area: '', note: '', done: false, createdAt: today() });
      inp.value = '';
      render();
      const ni = $('form[data-submit="quickTask"] input'); if (ni) ni.focus({ preventScroll: true });
      toast('Aufgabe hinzugefügt');
    }
  } catch (err) { console.error(err); toast('Fehler: ' + err.message); }
});

/* ---------------- Gewohnheiten ---------------- */
const activeHabits = () => S.habits.filter(h => !h.archived).sort(by(h => h.order ?? h.createdAt ?? ''));
const hDone = (h, d) => !!(h.log && h.log[d]);
function habitWeekCount(h, d = today()) {
  const ws = weekStart(d);
  let c = 0;
  for (let i = 0; i < 7; i++) if (hDone(h, addDays(ws, i))) c++;
  return c;
}
function habitStreak(h) {
  const t = today();
  if ((h.target || 7) >= 7) {
    let d = hDone(h, t) ? t : addDays(t, -1), n = 0;
    while (hDone(h, d) && n < 5000) { n++; d = addDays(d, -1); }
    return { n, unit: n === 1 ? 'Tag' : 'Tage' };
  }
  let ws = weekStart(t), n = 0;
  if (habitWeekCount(h, ws) >= h.target) n++;
  ws = addDays(ws, -7);
  let guard = 0;
  while (habitWeekCount(h, ws) >= h.target && guard++ < 520) { n++; ws = addDays(ws, -7); }
  return { n, unit: n === 1 ? 'Woche' : 'Wochen' };
}
function habitRate(h, from, to) {
  const created = h.createdAt || from;
  const start = created > from ? created : from;
  if (start > to) return null;
  const days = diffDays(start, to) + 1;
  const expected = (h.target || 7) / 7 * days;
  let done = 0;
  Object.keys(h.log || {}).forEach(k => { if (k >= start && k <= to) done++; });
  return expected > 0 ? clamp(done / expected, 0, 1) : null;
}
function habitsRate(from, to) {
  const rates = activeHabits().map(h => habitRate(h, from, to)).filter(r => r != null);
  return rates.length ? avg(rates) : null;
}
async function toggleHabit(id, d) {
  const h = S.habits.find(x => x.id === id);
  if (!h || d > today()) return;
  h.log = { ...(h.log || {}) };
  if (h.log[d]) delete h.log[d]; else h.log[d] = 1;
  await put('habits', h);
  if (h.log[d] && d === today()) {
    const s = habitStreak(h);
    if ([7, 14, 21, 30, 50, 100, 200, 365].includes(s.n) && s.unit.startsWith('Tag')) toast(`🔥 ${s.n} Tage in Folge – stark!`);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* */ }
  }
}
A.habitToggle = async d => { await toggleHabit(d.id, d.d || today()); render(); refreshSheets(); };

function habitRow(h, withWeek = true) {
  const t = today(), s = habitStreak(h);
  const wc = habitWeekCount(h);
  const info = (h.target || 7) >= 7 ? 'täglich' : `${wc}/${h.target} diese Woche`;
  let week = '';
  if (withWeek) {
    week = `<div class="week">` + Array.from({ length: 7 }, (_, i) => {
      const d = addDays(t, i - 6);
      return `<button class="day ${hDone(h, d) ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="habitToggle" data-id="${h.id}" data-d="${d}" aria-label="${esc(fDate(d))}"><span>${esc(DF.wd1.format(pd(d)))}</span><span class="dot">${hDone(h, d) ? ic('check') : ''}</span></button>`;
    }).join('') + `</div>`;
  }
  return `<div class="row" style="align-items:flex-start;flex-wrap:wrap"><div class="habit-emoji">${esc(h.emoji || '✅')}</div>
    <div class="row-main tap" data-act="habitDetail" data-id="${h.id}"><div class="row-t">${esc(h.name)}</div>
    <div class="row-s">${s.n ? `<span class="warn">🔥 ${s.n} ${s.unit}</span> · ` : ''}${esc(info)}</div></div>
    <button class="check ${hDone(h, t) ? 'on' : ''}" data-act="habitToggle" data-id="${h.id}" data-d="${t}" aria-label="Heute erledigt">${ic('check')}</button>
    ${week ? `<div style="flex-basis:100%;padding-left:42px">${week}</div>` : ''}</div>`;
}

function habitsView() {
  const hs = activeHabits();
  if (!hs.length) {
    return `<div class="card">${empty('🌱', 'Kleine tägliche Gewohnheiten verändern langfristig am meisten. Lege 1–3 Gewohnheiten an, die dich deinen Zielen näher bringen.', '<button class="btn" data-act="addHabit">Gewohnheit anlegen</button>')}</div>
    <div class="hint-box">💡 Mach es lächerlich klein: „1 Liegestütz“ oder „1 Seite lesen“ – Hauptsache, du bleibst dran.</div>`;
  }
  const t = today();
  const doneToday = hs.filter(h => hDone(h, t)).length;
  const r7 = habitsRate(addDays(t, -6), t), r30 = habitsRate(addDays(t, -29), t);
  let h = `<div class="stats three"><div class="stat"><div class="stat-l">Heute</div><div class="stat-v">${doneToday}/${hs.length}</div></div>
    <div class="stat"><div class="stat-l">7 Tage</div><div class="stat-v">${pct(r7 == null ? null : r7 * 100)}</div></div>
    <div class="stat"><div class="stat-l">30 Tage</div><div class="stat-v">${pct(r30 == null ? null : r30 * 100)}</div></div></div>`;
  h += `<div class="list">${hs.map(x => habitRow(x)).join('')}</div>`;
  h += `<p class="small muted" style="margin:0 4px 14px">Tippe auf einen Tag, um ihn nachträglich ab- oder anzuhaken. Tippe auf den Namen für Statistiken.</p>`;
  const arch = S.habits.filter(x => x.archived);
  if (arch.length) h += `<div class="list-h"><span>Archiviert</span></div><div class="list">${arch.map(x => `<button class="row" data-act="habitDetail" data-id="${x.id}"><div class="habit-emoji">${esc(x.emoji || '✅')}</div><div class="row-main"><div class="row-t muted">${esc(x.name)}</div></div><span class="chev">${ic('chevR', 'sm')}</span></button>`).join('')}</div>`;
  return h;
}

function habitForm(habit) {
  const isNew = !habit;
  const h = habit || { name: '', emoji: '', area: 'gesundheit', target: 7, cue: '' };
  formSheet({
    title: isNew ? 'Neue Gewohnheit' : 'Gewohnheit bearbeiten',
    fields: [
      { key: 'name', label: 'Gewohnheit', type: 'text', required: true, placeholder: 'z. B. 20 Minuten lesen' },
      { key: 'emoji', label: 'Symbol (Emoji)', type: 'text', placeholder: '📚', max: 4 },
      { key: 'area', label: 'Lebensbereich', type: 'select', options: AREA_OPTS },
      { key: 'target', label: 'Wie oft pro Woche?', type: 'seg', numeric: true, options: [1, 2, 3, 4, 5, 6, 7].map(n => ({ v: n, l: n === 7 ? 'tägl.' : String(n) })), group: true },
      { key: 'cue', label: 'Wann und wo? (optional)', type: 'text', placeholder: 'z. B. Nach dem Frühstück am Küchentisch', hint: 'Ein fester Auslöser verdoppelt die Chance, dass du es wirklich tust.' }
    ],
    values: h,
    onSave: async v => {
      const obj = { ...(habit || { log: {}, createdAt: today(), archived: false }), id: h.id || uid(), name: v.name, emoji: v.emoji || '✅', area: v.area, target: v.target || 7, cue: v.cue };
      await put('habits', obj);
      toast(isNew ? 'Gewohnheit angelegt' : 'Gespeichert');
      setTimeout(refreshSheets, 60);
    },
    onDelete: isNew ? null : async () => { await del('habits', h.id); closeAllSheets(); },
    deleteMsg: 'Die Gewohnheit und ihr kompletter Verlauf werden gelöscht. Tipp: Archivieren behält den Verlauf.'
  });
}
A.addHabit = () => habitForm(null);

/** Vergleicht die Stimmung an Tagen mit/ohne Gewohnheit. */
function habitMoodEffect(h) {
  const moods = {};
  S.journal.forEach(j => { if (j.mood) moods[j.date] = j.mood; });
  const withH = [], without = [];
  Object.entries(moods).forEach(([d, m]) => {
    if (h.createdAt && d < h.createdAt) return;
    (hDone(h, d) ? withH : without).push(m);
  });
  if (withH.length < 3 || without.length < 3) return null;
  return { diff: avg(withH) - avg(without), withAvg: avg(withH), withoutAvg: avg(without) };
}

function habitDetailHtml(h) {
  const t = today(), s = habitStreak(h);
  const total = Object.keys(h.log || {}).length;
  const r30 = habitRate(h, addDays(t, -29), t), r90 = habitRate(h, addDays(t, -89), t);
  let html = `<div class="card center"><div style="font-size:44px">${esc(h.emoji || '✅')}</div><div style="font-weight:700;font-size:22px;margin-top:4px" class="wrap-anywhere">${esc(h.name)}</div>
    <div class="small muted" style="margin-top:4px">${esc(areaById(h.area).name)} · ${(h.target || 7) >= 7 ? 'täglich' : `${h.target}× pro Woche`}</div>
    ${h.cue ? `<div class="small" style="margin-top:6px">📍 ${esc(h.cue)}</div>` : ''}</div>
    <div class="stats"><div class="stat"><div class="stat-l">Aktuelle Serie</div><div class="stat-v warn">🔥 ${s.n} ${s.unit}</div></div>
    <div class="stat"><div class="stat-l">Insgesamt</div><div class="stat-v">${total}×</div></div>
    <div class="stat"><div class="stat-l">Quote 30 Tage</div><div class="stat-v">${pct(r30 == null ? null : r30 * 100)}</div></div>
    <div class="stat"><div class="stat-l">Quote 90 Tage</div><div class="stat-v">${pct(r90 == null ? null : r90 * 100)}</div></div></div>`;
  // Heatmap 12 Wochen
  const ws = weekStart(t), start = addDays(ws, -77);
  html += `<div class="card"><div class="card-t" style="margin-bottom:10px">Letzte 12 Wochen</div><div class="heat-l">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => `<span>${x}</span>`).join('')}</div><div class="heat">`;
  for (let i = 0; i < 84; i++) {
    const d = addDays(start, i);
    html += `<span class="${d > t ? 'fut' : hDone(h, d) ? 'on' : ''}" title="${esc(fDate(d))}"></span>`;
  }
  html += `</div></div>`;
  const eff = habitMoodEffect(h);
  if (eff && Math.abs(eff.diff) >= 0.3) {
    html += `<div class="hint-box">${eff.diff > 0 ? '😊' : '🤔'} An Tagen mit „${esc(h.name)}“ ist deine Stimmung im Schnitt ${eff.diff > 0 ? 'um' : 'um'} <b>${n1(Math.abs(eff.diff))} Punkte ${eff.diff > 0 ? 'höher' : 'niedriger'}</b> (${n1(eff.withAvg)} vs. ${n1(eff.withoutAvg)} von 5).</div>`;
  }
  html += `<div class="btn-row"><button class="btn gray" data-act="habitEdit" data-id="${h.id}">${ic('edit', 'sm')} Bearbeiten</button><button class="btn gray" data-act="habitArchive" data-id="${h.id}">${h.archived ? 'Reaktivieren' : 'Archivieren'}</button></div>`;
  return html;
}
A.habitDetail = d => {
  const h = S.habits.find(x => x.id === d.id);
  if (!h) return;
  const sh = openSheet({ title: 'Gewohnheit', body: habitDetailHtml(h) });
  sh.refresh = () => { const x = S.habits.find(y => y.id === d.id); if (x) sh.setBody(habitDetailHtml(x)); else sh.close(); };
};
A.habitEdit = d => { const h = S.habits.find(x => x.id === d.id); if (h) habitForm(h); };
A.habitArchive = async d => {
  const h = S.habits.find(x => x.id === d.id);
  if (!h) return;
  h.archived = !h.archived;
  await put('habits', h);
  toast(h.archived ? 'Archiviert' : 'Reaktiviert');
  closeAllSheets(); render();
};

/* ---------------- Aufgaben ---------------- */
const PRIO = { high: { l: 'Hoch', cls: 'red', n: 0 }, normal: { l: 'Normal', cls: '', n: 1 }, low: { l: 'Niedrig', cls: '', n: 2 } };
function taskRow(t) {
  const td = today();
  const overdue = !t.done && t.due && t.due < td;
  const meta = [];
  if (t.due) meta.push(`<span class="${overdue ? 'neg' : ''}">${esc(relDay(t.due))}</span>`);
  if (t.prio === 'high') meta.push('<span class="neg">Hohe Priorität</span>');
  if (t.area) meta.push(esc(areaById(t.area).icon + ' ' + areaById(t.area).name));
  return `<div class="row"><button class="check ${t.done ? 'on' : ''}" data-act="taskToggle" data-id="${t.id}" aria-label="Erledigt">${ic('check')}</button>
    <div class="row-main tap" data-act="editTask" data-id="${t.id}"><div class="row-t ${t.done ? 'done-t' : ''}" style="white-space:normal">${esc(t.title)}</div>${meta.length ? `<div class="row-s">${meta.join(' · ')}</div>` : ''}</div>
    <button class="x-btn" data-act="taskStar" data-id="${t.id}" aria-label="Fokus heute" style="color:${t.important ? 'var(--orange-ui)' : 'var(--text3)'}"><svg class="ic" viewBox="0 0 24 24" ${t.important ? 'style="fill:currentColor"' : ''}>${ICONS.star}</svg></button></div>`;
}
const openTasks = () => S.tasks.filter(t => !t.done);
function sortTasks(list) { return list.slice().sort((a, b) => (b.important - a.important) || (PRIO[a.prio]?.n ?? 1) - (PRIO[b.prio]?.n ?? 1) || (a.due || '9').localeCompare(b.due || '9') || String(a.createdAt).localeCompare(String(b.createdAt))); }

function tasksView() {
  const td = today();
  const open = openTasks();
  let h = `<form class="search" data-submit="quickTask" style="background:var(--card);box-shadow:var(--shadow);height:46px">${ic('plus', 'sm')}<input name="t" placeholder="Neue Aufgabe – Enter zum Speichern" autocomplete="off" enterkeyhint="done"></form>`;
  h += timerCard();
  const groups = [
    ['⭐️ Fokus heute', open.filter(t => t.important)],
    ['Überfällig', open.filter(t => !t.important && t.due && t.due < td)],
    ['Heute', open.filter(t => !t.important && t.due === td)],
    ['Demnächst', open.filter(t => !t.important && t.due && t.due > td)],
    ['Ohne Datum', open.filter(t => !t.important && !t.due)]
  ];
  let any = false;
  groups.forEach(([title, list]) => {
    if (!list.length) return;
    any = true;
    const sorted = title === 'Demnächst' ? list.slice().sort(by(t => t.due)) : sortTasks(list);
    h += `<div class="list-h"><span>${title}</span><span>${list.length}</span></div><div class="list">${sorted.map(taskRow).join('')}</div>`;
  });
  if (!any) h += `<div class="card">${empty('✅', 'Keine offenen Aufgaben. Markiere maximal 3 Aufgaben mit ⭐️ als „Fokus heute“ – das Wichtigste zuerst.')}</div>`;
  const done = S.tasks.filter(t => t.done).sort(by(t => t.doneAt || '', -1));
  if (done.length) {
    h += `<div class="list-h"><span>Erledigt</span><button class="link" style="font-size:13px" data-act="clearDone">Erledigte löschen</button></div><div class="list">${done.slice(0, 10).map(taskRow).join('')}</div>`;
    if (done.length > 10) h += `<div class="list-f">+ ${done.length - 10} weitere erledigte Aufgaben</div>`;
  }
  return h;
}
function taskForm(task) {
  const isNew = !task;
  const t = task || { title: '', due: '', prio: 'normal', important: false, area: '', note: '' };
  formSheet({
    title: isNew ? 'Neue Aufgabe' : 'Aufgabe',
    fields: [
      { key: 'title', label: 'Aufgabe', type: 'text', required: true, placeholder: 'Was ist zu tun?' },
      { key: 'due', label: 'Fällig am (optional)', type: 'date', group: true },
      { key: 'prio', label: 'Priorität', type: 'seg', options: [{ v: 'high', l: 'Hoch' }, { v: 'normal', l: 'Normal' }, { v: 'low', l: 'Niedrig' }] },
      { key: 'important', label: '⭐️ Fokus heute', type: 'toggle' },
      { key: 'area', label: 'Lebensbereich', type: 'select', options: [{ v: '', l: 'Keiner' }, ...AREA_OPTS] },
      { key: 'note', label: 'Notiz', type: 'textarea', rows: 3, group: true }
    ],
    values: t, focus: isNew ? 'title' : null,
    onSave: async v => {
      const obj = { ...(task || { done: false, createdAt: today() }), id: t.id || uid(), ...v };
      await put('tasks', obj);
      toast(isNew ? 'Aufgabe angelegt' : 'Gespeichert');
    },
    onDelete: isNew ? null : async () => { await del('tasks', t.id); }
  });
}
A.addTask = () => taskForm(null);
A.editTask = d => { const t = S.tasks.find(x => x.id === d.id); if (t) taskForm(t); };
A.taskToggle = async d => {
  const t = S.tasks.find(x => x.id === d.id);
  if (!t) return;
  t.done = !t.done; t.doneAt = t.done ? today() : null;
  if (t.done) t.important = false;
  await put('tasks', t);
  render();
  if (t.done) toast('Erledigt ✓', { label: 'Rückgängig', fn: async () => { t.done = false; t.doneAt = null; await put('tasks', t); render(); } });
};
A.taskStar = async d => {
  const t = S.tasks.find(x => x.id === d.id);
  if (!t) return;
  if (!t.important && openTasks().filter(x => x.important).length >= 3) toast('Tipp: Mehr als 3 Fokus-Aufgaben pro Tag verwässern den Fokus.');
  t.important = !t.important;
  await put('tasks', t);
  render();
};
A.clearDone = async () => {
  const done = S.tasks.filter(t => t.done);
  if (!await confirmDlg(`${done.length} erledigte Aufgaben endgültig löschen? Die Statistik in vergangenen Berichten geht dabei verloren.`, { title: 'Erledigte löschen?', ok: 'Löschen', danger: true })) return;
  for (const t of done) await del('tasks', t.id);
  render();
};

/* ---------------- Fokus-Timer ---------------- */
const TIMER = { state: null, interval: null };
const fmtClock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
async function saveTimer() {
  if (TIMER.state) await DB.put('meta', { id: 'timer', ...TIMER.state });
  else await DB.del('meta', 'timer');
}
function timerRemaining() {
  const s = TIMER.state;
  if (!s) return 0;
  return s.running ? s.end - Date.now() : s.remaining;
}
function focusMinutes(from, to) { return sum(S.focus.filter(f => f.date >= from && f.date <= to), f => f.minutes); }
function timerCard() {
  const s = TIMER.state, td = today();
  const todayMin = focusMinutes(td, td), weekMin = focusMinutes(weekStart(td), td);
  let ctrl;
  if (!s) {
    ctrl = `<div class="timer"><div class="timer-v">${pad(25)}:00</div></div>
      <div class="btn-row mt">${[15, 25, 50].map(m => `<button class="btn ${m === 25 ? '' : 'tinted'} small" data-act="timerStart" data-min="${m}">${ic('play', 'sm')} ${m} Min.</button>`).join('')}</div>`;
  } else {
    ctrl = `<div class="timer"><div class="timer-v" id="timerV">${fmtClock(timerRemaining())}</div>
      ${s.running ? `<button class="round-btn pause" data-act="timerPause" aria-label="Pause">${ic('pause')}</button>` : `<button class="round-btn" data-act="timerResume" aria-label="Fortsetzen">${ic('play')}</button>`}
      <button class="round-btn stop" data-act="timerStop" aria-label="Beenden">${ic('stop')}</button></div>
      <div class="small muted">${s.running ? `Fokus-Sitzung (${s.duration} Min.) läuft – Handy weglegen 📵` : 'Pausiert'}</div>`;
  }
  return `<div class="card"><div class="card-h"><span class="card-t">Fokus-Timer</span><span class="small muted">Heute ${todayMin} Min. · Woche ${weekMin} Min.</span></div>${ctrl}</div>`;
}
A.timerStart = async d => {
  const min = +d.min || 25;
  TIMER.state = { running: true, duration: min, end: Date.now() + min * 60000, remaining: min * 60000, startedAt: Date.now() };
  await saveTimer();
  render();
};
A.timerPause = async () => { const s = TIMER.state; if (!s) return; s.remaining = s.end - Date.now(); s.running = false; await saveTimer(); render(); };
A.timerResume = async () => { const s = TIMER.state; if (!s) return; s.end = Date.now() + s.remaining; s.running = true; await saveTimer(); render(); };
A.timerStop = async () => {
  const s = TIMER.state;
  if (!s) return;
  const doneMin = Math.floor((s.duration * 60000 - timerRemaining()) / 60000);
  TIMER.state = null;
  await saveTimer();
  if (doneMin >= 5) { await put('focus', { id: uid(), date: today(), minutes: doneMin }); toast(`${doneMin} Fokus-Minuten gespeichert`); }
  else toast('Sitzung beendet (unter 5 Minuten werden nicht gezählt)');
  render();
};
async function timerTick() {
  const s = TIMER.state;
  if (!s || !s.running) return;
  const rem = s.end - Date.now();
  const el = $('#timerV');
  if (el) el.textContent = fmtClock(rem);
  if (rem <= 0) {
    TIMER.state = null;
    await saveTimer();
    await put('focus', { id: uid(), date: today(), minutes: s.duration });
    if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (e) { /* */ }
    toast(`🎉 ${s.duration} Minuten Fokus geschafft! Gönn dir eine kurze Pause.`);
    render();
  }
}
setInterval(timerTick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) timerTick(); });
/* =========================================================
   JOURNAL: Tagebuch, Entscheidungen, Lebensbereiche
   ========================================================= */

const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
const MOOD_L = ['Sehr schlecht', 'Schlecht', 'Neutral', 'Gut', 'Sehr gut'];
const PROMPTS = [
  'Wofür bist du heute dankbar?',
  'Was hat dir heute Energie gegeben – und was hat sie dir geraubt?',
  'Worauf bist du heute stolz?',
  'Was würdest du heute anders machen?',
  'Welcher Moment heute war der schönste?',
  'Was hast du heute gelernt?',
  'Was ist das Wichtigste, das du morgen erledigen willst?',
  'Wem könntest du morgen eine Freude machen?',
  'Was beschäftigt dich gerade am meisten?',
  'Was hat dich heute überrascht?',
  'Welche Entscheidung hat dich heute weitergebracht?',
  'Wofür hast du heute zu viel Zeit verwendet?',
  'Was würde dein zukünftiges Ich dir heute raten?',
  'Welche kleine Sache hat heute einen Unterschied gemacht?'
];
const promptOfDay = (d = today()) => PROMPTS[Math.floor(pd(d).getTime() / 864e5) % PROMPTS.length];

function moodByDate() {
  return memo('moods', () => {
    const m = {};
    S.journal.forEach(j => { if (j.mood) (m[j.date] = m[j.date] || []).push(j.mood); });
    const out = {};
    Object.entries(m).forEach(([d, arr]) => { out[d] = avg(arr); });
    return out;
  });
}
function moodAvg(from, to) {
  const vals = Object.entries(moodByDate()).filter(([d]) => d >= from && d <= to).map(([, v]) => v);
  return vals.length ? avg(vals) : null;
}
function journalStreak() {
  const dates = new Set(S.journal.map(j => j.date));
  let d = dates.has(today()) ? today() : addDays(today(), -1), n = 0;
  while (dates.has(d) && n < 5000) { n++; d = addDays(d, -1); }
  return n;
}

VIEWS.journal = () => {
  const sub = UI.sub.journal;
  const body = seg('journal', [['diary', 'Tagebuch'], ['decisions', 'Entscheidungen'], ['areas', 'Lebensbereiche']], sub)
    + ({ diary: diaryView, decisions: decisionsView, areas: areasView }[sub] || diaryView)();
  const act = { diary: 'addJournal', decisions: 'addDecision', areas: 'checkin' }[sub];
  return page('Journal', body, { action: `<button class="icon-btn" data-act="${act}" aria-label="Hinzufügen">${ic('plus')}</button>` });
};

/* ---------------- Tagebuch ---------------- */
function diaryView() {
  const t = today();
  const todays = S.journal.filter(j => j.date === t);
  let h = '';
  if (todays.length) {
    const j = todays[todays.length - 1];
    h += `<div class="card tap" data-act="editJournal" data-id="${j.id}"><div class="between"><span class="card-t">Heute</span><span class="badge green">${ic('check', 'sm')} Geschrieben</span></div>
      <div class="flex mt"><span class="mood">${MOODS[(j.mood || 3) - 1]}</span><div class="grow"><div style="font-weight:600">${esc(MOOD_L[(j.mood || 3) - 1])}${j.energy ? ` · Energie ${'⚡'.repeat(j.energy)}` : ''}</div><div class="j-text">${esc(j.text || j.gratitude || '')}</div></div></div></div>`;
  } else {
    h += `<div class="card"><div class="card-t">Frage des Tages</div><div style="font-size:20px;font-weight:600;margin:8px 0 14px">${esc(promptOfDay())}</div>
      <button class="btn block" data-act="addJournal">${ic('edit', 'sm')} Heutigen Eintrag schreiben</button></div>`;
  }
  const from30 = addDays(t, -29);
  const n30 = new Set(S.journal.filter(j => j.date >= from30).map(j => j.date)).size;
  const m30 = moodAvg(from30, t), m7 = moodAvg(addDays(t, -6), t);
  if (S.journal.length) {
    h += `<div class="stats three"><div class="stat"><div class="stat-l">Serie</div><div class="stat-v">${journalStreak()} T.</div></div>
      <div class="stat"><div class="stat-l">Tage (30)</div><div class="stat-v">${n30}</div></div>
      <div class="stat"><div class="stat-l">Stimmung Ø</div><div class="stat-v">${m30 == null ? '–' : n1(m30)}<span class="muted" style="font-size:13px"> /5</span></div></div></div>`;
    const moods = moodByDate();
    const days = Array.from({ length: 30 }, (_, i) => addDays(from30, i));
    if (days.filter(d => moods[d] != null).length >= 2) {
      h += `<div class="card"><div class="card-h"><span class="card-t">Stimmung – 30 Tage</span>${m7 != null && m30 != null ? deltaHtml(m7, m30, true) : ''}</div>${lineChart({
        labels: days.map(fDay), series: [{ name: 'Stimmung', values: days.map(d => moods[d] ?? null), color: 'var(--series-1)' }],
        fmt: v => `${MOODS[Math.round(v) - 1] || ''} ${n1(v)} – ${MOOD_L[Math.round(v) - 1] || ''}`, yfmt: v => n0(v), h: 150, area: false, yMin: 1, yMax: 5, connect: true
      })}</div>`;
    }
    const ins = moodInsights();
    if (ins.length) h += `<div class="card"><div class="card-t">Was dir guttut</div>${ins.map(i => `<p class="small" style="margin-top:8px">${i}</p>`).join('')}</div>`;
  }
  h += `<div class="search">${ic('search', 'sm')}<input type="search" placeholder="Einträge durchsuchen" value="${esc(UI.jSearch)}" data-live="jsearch"></div>`;
  h += `<div id="jList">${journalListHtml()}</div>`;
  return h;
}
function moodInsights() {
  return memo('mi', () => {
    const out = [];
    activeHabits().forEach(hb => {
      const e = habitMoodEffect(hb);
      if (e && e.diff >= 0.4) out.push({ d: e.diff, t: `${esc(hb.emoji || '')} An Tagen mit <b>${esc(hb.name)}</b> ist deine Stimmung im Schnitt <b class="pos">+${n1(e.diff)}</b> besser.` });
      if (e && e.diff <= -0.4) out.push({ d: -e.diff, t: `${esc(hb.emoji || '')} An Tagen mit <b>${esc(hb.name)}</b> ist deine Stimmung im Schnitt ${n1(e.diff)} schlechter.` });
    });
    // Wochentage
    const byWd = {};
    Object.entries(moodByDate()).forEach(([d, m]) => { const w = (pd(d).getDay() + 6) % 7; (byWd[w] = byWd[w] || []).push(m); });
    const wds = Object.entries(byWd).filter(([, a]) => a.length >= 3).map(([w, a]) => [+w, avg(a)]);
    if (wds.length >= 4) {
      wds.sort((a, b) => b[1] - a[1]);
      const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      if (wds[0][1] - wds[wds.length - 1][1] >= 0.5) out.push({ d: 0.1, t: `📅 Bester Tag: <b>${names[wds[0][0]]}</b> (Ø ${n1(wds[0][1])}), schwierigster: <b>${names[wds[wds.length - 1][0]]}</b> (Ø ${n1(wds[wds.length - 1][1])}).` });
    }
    return out.sort((a, b) => b.d - a.d).slice(0, 4).map(x => x.t);
  });
}
function journalListHtml() {
  const q = UI.jSearch.trim().toLowerCase();
  let list = S.journal.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  if (q) list = list.filter(j => [j.text, j.gratitude, j.learning, j.tags].join(' ').toLowerCase().includes(q));
  if (!list.length) return q ? empty('🔍', 'Keine passenden Einträge.') : '';
  let h = `<div class="list">`;
  list.slice(0, 200).forEach(j => {
    h += `<button class="row" data-act="editJournal" data-id="${j.id}" style="align-items:flex-start"><span class="mood">${MOODS[(j.mood || 3) - 1]}</span>
      <div class="row-main"><div class="between"><span class="row-t" style="font-weight:600">${esc(relDayLong(j.date))}</span><span class="small muted">${esc(fDate(j.date))}</span></div>
      <div class="j-text">${esc(j.text || j.gratitude || j.learning || 'Ohne Text')}</div>${j.tags ? `<div class="small" style="color:var(--accent);margin-top:2px">${esc(j.tags.split(',').map(x => '#' + x.trim()).filter(x => x.length > 1).join(' '))}</div>` : ''}</div></button>`;
  });
  return h + `</div>`;
}
function journalForm(entry) {
  const isNew = !entry;
  const j = entry || { date: today(), mood: 4, energy: 3, text: '', gratitude: '', learning: '', tags: '' };
  formSheet({
    title: isNew ? 'Neuer Eintrag' : fDate(j.date),
    fields: [
      { key: 'mood', label: 'Wie geht es dir?', type: 'rating', numeric: true, options: MOODS.map((m, i) => ({ v: i + 1, l: m })) },
      { key: 'energy', label: 'Energielevel', type: 'seg', numeric: true, options: [1, 2, 3, 4, 5].map(n => ({ v: n, l: String(n) })), hint: '1 = erschöpft · 5 = voller Energie' },
      { key: 'text', label: isNew ? promptOfDay(j.date) : 'Gedanken', type: 'textarea', rows: 6, placeholder: 'Schreib einfach drauflos …', group: true },
      { key: 'gratitude', label: 'Dankbar bin ich für …', type: 'textarea', rows: 2 },
      { key: 'learning', label: 'Erkenntnis / Gelernt', type: 'textarea', rows: 2 },
      { key: 'tags', label: 'Schlagwörter (mit Komma getrennt)', type: 'text', placeholder: 'arbeit, familie, sport', cap: false, group: true },
      { key: 'date', label: 'Datum', type: 'date', required: true }
    ],
    values: j,
    onSave: async v => {
      const obj = { ...(entry || { createdAt: Date.now() }), id: j.id || uid(), ...v };
      await put('journal', obj);
      toast(isNew ? 'Eintrag gespeichert ✍️' : 'Gespeichert');
    },
    onDelete: isNew ? null : async () => { await del('journal', j.id); }
  });
}
A.addJournal = () => {
  const ex = S.journal.find(j => j.date === today());
  if (ex) { journalForm(ex); return; }
  journalForm(null);
};
A.editJournal = d => { const j = S.journal.find(x => x.id === d.id); if (j) journalForm(j); };

/* ---------------- Entscheidungen ---------------- */
const optScore = o => sum(o.pros || [], p => p.w) - sum(o.cons || [], c => c.w) + ((o.gut || 3) - 3) * 1.5;
function analyzeDecision(d) {
  const opts = (d.options || []).filter(o => (o.name || '').trim());
  const res = { ranked: [], headline: '', notes: [], winner: null };
  if (opts.length < 2) { res.headline = 'Füge mindestens zwei Optionen hinzu.'; return res; }
  const ranked = opts.map(o => ({ o, score: optScore(o), pro: sum(o.pros || [], p => p.w), con: sum(o.cons || [], c => c.w) })).sort((a, b) => b.score - a.score);
  res.ranked = ranked;
  const args = sum(opts, o => (o.pros || []).length + (o.cons || []).length);
  if (!args) { res.headline = 'Ergänze Vor- und Nachteile, um eine Auswertung zu erhalten.'; return res; }
  const w = ranked[0], margin = w.score - ranked[1].score;
  res.winner = w.o;
  res.headline = margin >= 4 ? `Klare Tendenz: ${w.o.name}` : margin >= 1.5 ? `Leichte Tendenz: ${w.o.name}` : 'Sehr knappe Entscheidung';
  const deal = (w.o.cons || []).filter(c => c.w >= 5 && c.t);
  if (deal.length) res.notes.push(`⚠️ „${w.o.name}“ hat einen schwerwiegenden Nachteil („${deal[0].t}“). Prüfe, ob er ein Ausschlusskriterium ist.`);
  const gutMax = Math.max(...opts.map(o => o.gut || 3));
  const gutBest = opts.filter(o => (o.gut || 3) === gutMax);
  if (gutMax >= 4 && gutBest.length === 1 && gutBest[0].id !== w.o.id) res.notes.push(`🧠 Kopf und Bauch sind uneinig: Rational führt „${w.o.name}“, dein Gefühl bevorzugt „${gutBest[0].name}“. Frage dich, welches Argument du noch nicht aufgeschrieben hast.`);
  if (!d.reversible && margin < 4) res.notes.push('🔒 Schwer umkehrbar und nicht eindeutig: Sammle gezielt fehlende Informationen oder teste die Option im Kleinen, bevor du dich festlegst.');
  if (d.reversible) res.notes.push('🔄 Die Entscheidung ist umkehrbar – entscheide lieber zügig und lerne aus dem Ergebnis.');
  if ((d.importance || 3) >= 4 && args < 6) res.notes.push('📋 Für eine so wichtige Entscheidung sind das noch wenige Argumente. Hol eine zweite Meinung ein oder schreibe weitere Punkte auf.');
  if (!d.tenten) res.notes.push('⏳ 10-10-10-Test: Wie wirst du in 10 Minuten, 10 Monaten und 10 Jahren über diese Entscheidung denken?');
  return res;
}
const DEC_STATUS = { open: ['Offen', 'orange'], decided: ['Entschieden', 'blue'], reviewed: ['Rückblick erledigt', 'green'] };

function decisionsView() {
  if (!S.decisions.length) {
    return `<div class="card">${empty('⚖️', 'Strukturiere wichtige Entscheidungen: Optionen, gewichtete Vor- und Nachteile, Bauchgefühl – und später ein Rückblick, ob es die richtige Wahl war.', '<button class="btn" data-act="addDecision">Entscheidung analysieren</button>')}</div>`;
  }
  const t = today();
  const order = { open: 0, decided: 1, reviewed: 2 };
  const list = S.decisions.slice().sort((a, b) => order[a.status] - order[b.status] || String(b.createdAt).localeCompare(String(a.createdAt)));
  const dueReview = S.decisions.filter(d => d.status === 'decided' && d.reviewDate && d.reviewDate <= t);
  let h = '';
  if (dueReview.length) h += `<div class="hint-box orange">🔁 ${dueReview.length} Entscheidung${dueReview.length > 1 ? 'en warten' : ' wartet'} auf deinen Rückblick. So lernst du aus deinen Entscheidungen.</div>`;
  const reviewed = S.decisions.filter(d => d.outcome && d.outcome.rating);
  if (reviewed.length >= 2) h += `<p class="small muted" style="margin:0 4px 12px">Zufriedenheit mit vergangenen Entscheidungen: Ø <b>${n1(avg(reviewed.map(d => d.outcome.rating)))}</b> / 5</p>`;
  h += list.map(d => {
    const an = analyzeDecision(d), [sl, sc] = DEC_STATUS[d.status] || DEC_STATUS.open;
    const chosen = d.chosen && (d.options || []).find(o => o.id === d.chosen);
    return `<div class="card tap" data-act="decisionDetail" data-id="${d.id}"><div class="between"><span class="small muted">${esc(fDate(d.createdAt))}</span><span class="badge ${sc}">${sl}</span></div>
      <div style="font-weight:600;font-size:17px;margin-top:6px" class="wrap-anywhere">${esc(d.title)}</div>
      <div class="small muted" style="margin-top:4px">${chosen ? `Gewählt: <b>${esc(chosen.name)}</b>` : esc(an.headline)}${d.outcome?.rating ? ` · Rückblick ${'★'.repeat(d.outcome.rating)}` : ''}</div></div>`;
  }).join('');
  return h;
}

function decisionDetailHtml(d) {
  const an = analyzeDecision(d);
  const [sl, sc] = DEC_STATUS[d.status] || DEC_STATUS.open;
  let h = `<div class="between" style="margin-bottom:8px"><span class="small muted">Wichtigkeit ${'●'.repeat(d.importance || 3)}${'○'.repeat(5 - (d.importance || 3))} · ${d.reversible ? 'umkehrbar' : 'schwer umkehrbar'}</span><span class="badge ${sc}">${sl}</span></div>
    <h3 style="font-size:22px;margin-bottom:12px" class="wrap-anywhere">${esc(d.title)}</h3>`;
  if (d.context) h += `<p class="prose muted" style="margin-bottom:14px">${esc(d.context)}</p>`;
  h += `<div class="verdict"><div class="v-t">${esc(an.headline)}</div>${an.notes.map(n => `<p class="small" style="margin-top:6px">${esc(n)}</p>`).join('')}</div>`;
  if (an.ranked.length) {
    const scores = an.ranked.map(r => r.score);
    const lo = Math.min(0, ...scores), hi = Math.max(...scores, lo + 1);
    h += `<div class="card"><div class="card-t" style="margin-bottom:10px">Bewertung</div>`;
    an.ranked.forEach((r, i) => {
      h += `<div class="score-row"><div class="cb-top"><span>${i === 0 ? '🏆 ' : ''}<b>${esc(r.o.name)}</b>${d.chosen === r.o.id ? ' <span class="badge blue">gewählt</span>' : ''}</span><span class="num">${r.score > 0 ? '+' : ''}${n1(r.score)}</span></div>
        ${bar((r.score - lo) / (hi - lo), i === 0 ? 'green' : '')}
        <div class="small muted" style="margin-top:3px">Pro +${r.pro} · Contra −${r.con} · Bauchgefühl ${MOODS[(r.o.gut || 3) - 1]}</div></div>`;
    });
    h += `</div>`;
  }
  (d.options || []).forEach(o => {
    const pros = (o.pros || []).filter(p => p.t), cons = (o.cons || []).filter(c => c.t);
    if (!pros.length && !cons.length) return;
    h += `<div class="card"><div style="font-weight:600;margin-bottom:6px">${esc(o.name)}</div>
      ${pros.length ? `<div class="pc-h pos">Vorteile</div><ul class="pc-list">${pros.sort(by(p => p.w, -1)).map(p => `<li><span>${esc(p.t)}</span><span class="muted num">+${p.w}</span></li>`).join('')}</ul>` : ''}
      ${cons.length ? `<div class="pc-h neg">Nachteile</div><ul class="pc-list">${cons.sort(by(c => c.w, -1)).map(c => `<li><span>${esc(c.t)}</span><span class="muted num">−${c.w}</span></li>`).join('')}</ul>` : ''}</div>`;
  });
  if (d.tenten) h += `<div class="card"><div class="card-t">10-10-10</div><p class="prose mt">${esc(d.tenten)}</p></div>`;
  if (d.status !== 'open') {
    const ch = (d.options || []).find(o => o.id === d.chosen);
    h += `<div class="card"><div class="card-t">Entscheidung</div><p class="mt">Gewählt: <b>${esc(ch ? ch.name : '–')}</b> am ${esc(fDate(d.decidedAt))}</p>${d.reviewDate ? `<p class="small muted">Rückblick geplant: ${esc(fDate(d.reviewDate))}</p>` : ''}
      ${d.outcome?.rating ? `<div class="prose-h">Rückblick</div><p>${'★'.repeat(d.outcome.rating)}${'☆'.repeat(5 - d.outcome.rating)}</p>${d.outcome.note ? `<p class="prose small mt">${esc(d.outcome.note)}</p>` : ''}` : ''}</div>`;
  }
  h += `<div class="btn-row" style="margin-bottom:10px"><button class="btn gray" data-act="decisionEdit" data-id="${d.id}">${ic('edit', 'sm')} Bearbeiten</button>
    ${d.status === 'open' ? `<button class="btn" data-act="decisionDecide" data-id="${d.id}">Entscheiden</button>` : `<button class="btn tinted" data-act="decisionReview" data-id="${d.id}">Rückblick</button>`}</div>
    <button class="btn danger block" data-act="decisionDelete" data-id="${d.id}">${ic('trash', 'sm')} Löschen</button>`;
  return h;
}
A.decisionDetail = d => {
  const dec = S.decisions.find(x => x.id === d.id);
  if (!dec) return;
  const sh = openSheet({ title: 'Entscheidung', body: decisionDetailHtml(dec), tall: true });
  sh.refresh = () => { const x = S.decisions.find(y => y.id === d.id); if (x) sh.setBody(decisionDetailHtml(x)); else sh.close(); };
};
A.decisionDelete = async d => {
  if (!await confirmDlg('Die Entscheidung wird dauerhaft gelöscht.', { title: 'Löschen?', ok: 'Löschen', danger: true })) return;
  await del('decisions', d.id);
  closeAllSheets(); render(); toast('Gelöscht');
};
A.decisionDecide = d => {
  const dec = S.decisions.find(x => x.id === d.id);
  if (!dec) return;
  const an = analyzeDecision(dec);
  const opts = (dec.options || []).filter(o => o.name).map(o => ({ v: o.id, l: o.name }));
  formSheet({
    title: 'Entscheiden', saveLabel: 'Festlegen',
    fields: [
      { key: 'chosen', label: 'Ich entscheide mich für', type: 'select', options: opts },
      { key: 'reviewDate', label: 'Rückblick am', type: 'date', hint: 'Plane einen Termin, an dem du prüfst, ob die Entscheidung richtig war. LIFE OS erinnert dich.' }
    ],
    values: { chosen: an.winner ? an.winner.id : opts[0]?.v, reviewDate: addMonths(today(), 3) },
    onSave: async v => {
      Object.assign(dec, { chosen: v.chosen, reviewDate: v.reviewDate, status: 'decided', decidedAt: today() });
      await put('decisions', dec);
      toast('Entscheidung festgehalten');
      setTimeout(refreshSheets, 60);
    }
  });
};
A.decisionReview = d => {
  const dec = S.decisions.find(x => x.id === d.id);
  if (!dec) return;
  formSheet({
    title: 'Rückblick',
    fields: [
      { key: 'rating', label: 'War es rückblickend die richtige Entscheidung?', type: 'rating', numeric: true, options: [1, 2, 3, 4, 5].map(n => ({ v: n, l: n + ' ★' })) },
      { key: 'note', label: 'Was hast du daraus gelernt?', type: 'textarea', rows: 4 }
    ],
    values: dec.outcome || { rating: 4, note: '' },
    onSave: async v => {
      dec.outcome = { ...v, date: today() };
      dec.status = 'reviewed';
      await put('decisions', dec);
      toast('Rückblick gespeichert');
      setTimeout(refreshSheets, 60);
    }
  });
};

/* Editor mit dynamischen Optionen */
function decisionEditor(dec) {
  const isNew = !dec;
  const draft = dec ? JSON.parse(JSON.stringify(dec)) : {
    id: uid(), title: '', context: '', importance: 3, reversible: true, tenten: '', status: 'open', createdAt: today(),
    options: [{ id: uid(), name: 'Ja, machen', pros: [], cons: [], gut: 3 }, { id: uid(), name: 'Nein, lassen', pros: [], cons: [], gut: 3 }]
  };
  const wSel = w => `<select data-w aria-label="Gewichtung">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === w ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const pcRows = (o, kind) => (o[kind] || []).map((p, i) => `<div class="pc-row" data-pc="${kind}" data-i="${i}"><input class="in" data-t value="${esc(p.t)}" placeholder="${kind === 'pros' ? 'Vorteil' : 'Nachteil'} …">${wSel(p.w)}<button type="button" class="x-btn" data-ed="delPc" data-o="${o.id}" data-kind="${kind}" data-i="${i}" aria-label="Entfernen">${ic('x', 'sm')}</button></div>`).join('');
  const html = () => `<div class="form">
      <div class="fgroup"><div class="field"><label class="flabel">Worum geht es?</label><input class="in" name="dtitle" value="${esc(draft.title)}" placeholder="z. B. Jobangebot annehmen?"></div>
      <div class="field"><label class="flabel">Hintergrund (optional)</label><textarea name="dcontext" rows="3" placeholder="Was ist die Situation? Was ist dir dabei wichtig?">${esc(draft.context)}</textarea></div></div>
      <div class="fgroup"><div class="field"><label class="flabel">Wie wichtig ist die Entscheidung?</label><div class="seg seg-sm" data-segfield="dimp">${[1, 2, 3, 4, 5].map(n => `<label class="${n === draft.importance ? 'on' : ''}"><input type="radio" name="dimp" value="${n}" ${n === draft.importance ? 'checked' : ''}>${n}</label>`).join('')}</div></div>
      <div class="field inline"><label class="flabel">Leicht umkehrbar?</label><label class="switch"><input type="checkbox" name="drev" ${draft.reversible ? 'checked' : ''}><span></span></label></div></div>
    </div>
    <div class="list-h" style="padding-left:4px"><span>Optionen · Gewichtung 1 (gering) bis 5 (sehr hoch)</span></div>
    ${draft.options.map((o, oi) => `<div class="opt" data-opt="${o.id}">
      <div class="opt-h"><span class="badge blue">${String.fromCharCode(65 + oi)}</span><input class="in" data-name value="${esc(o.name)}" placeholder="Name der Option">${draft.options.length > 2 ? `<button type="button" class="x-btn" data-ed="delOpt" data-o="${o.id}" aria-label="Option entfernen">${ic('trash', 'sm')}</button>` : ''}</div>
      <div class="pc-h pos">${ic('plus', 'sm')} Vorteile</div>${pcRows(o, 'pros')}
      <button type="button" class="add-line" data-ed="addPc" data-o="${o.id}" data-kind="pros">+ Vorteil hinzufügen</button>
      <div class="pc-h neg">${ic('minus', 'sm')} Nachteile</div>${pcRows(o, 'cons')}
      <button type="button" class="add-line" data-ed="addPc" data-o="${o.id}" data-kind="cons">+ Nachteil hinzufügen</button>
      <div class="pc-h">Bauchgefühl</div><div class="seg seg-sm rating" data-segfield="gut_${o.id}">${MOODS.map((m, i) => `<label class="${i + 1 === (o.gut || 3) ? 'on' : ''}"><input type="radio" name="gut_${o.id}" value="${i + 1}" ${i + 1 === (o.gut || 3) ? 'checked' : ''}>${m}</label>`).join('')}</div>
    </div>`).join('')}
    ${draft.options.length < 6 ? `<button type="button" class="btn tinted block" data-ed="addOpt" style="margin-bottom:14px">${ic('plus', 'sm')} Weitere Option</button>` : ''}
    <div class="form"><div class="fgroup"><div class="field"><label class="flabel">10-10-10: Wie denkst du in 10 Minuten, 10 Monaten, 10 Jahren darüber? (optional)</label><textarea name="dtenten" rows="3">${esc(draft.tenten)}</textarea></div></div></div>`;
  const sync = root => {
    draft.title = $('[name="dtitle"]', root).value.trim();
    draft.context = $('[name="dcontext"]', root).value.trim();
    const imp = $('[name="dimp"]:checked', root); draft.importance = imp ? +imp.value : 3;
    draft.reversible = $('[name="drev"]', root).checked;
    draft.tenten = $('[name="dtenten"]', root).value.trim();
    draft.options.forEach(o => {
      const el = $(`[data-opt="${o.id}"]`, root);
      if (!el) return;
      o.name = $('[data-name]', el).value.trim();
      const g = $(`[name="gut_${o.id}"]:checked`, el); o.gut = g ? +g.value : 3;
      ['pros', 'cons'].forEach(kind => {
        o[kind] = $$(`[data-pc="${kind}"]`, el).map(r => ({ t: $('[data-t]', r).value.trim(), w: +$('[data-w]', r).value }));
      });
    });
  };
  const sh = openSheet({
    title: isNew ? 'Neue Entscheidung' : 'Bearbeiten', tall: true, body: html(),
    left: '<button class="txt-btn" data-sheet-close>Abbrechen</button>',
    right: '<button class="txt-btn bold" data-dsave>Sichern</button>'
  });
  const rerender = focusSel => {
    const st = sh.body.scrollTop;
    sh.setBody(html());
    sh.body.scrollTop = st;
    if (focusSel) { const f = $(focusSel, sh.body); if (f) f.focus(); }
  };
  sh.el.addEventListener('change', e => {
    if (e.target.type === 'radio') $$('[data-segfield] label', sh.body).forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
  });
  sh.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-ed],[data-dsave]');
    if (!b) return;
    e.preventDefault();
    sync(sh.body);
    if (b.hasAttribute('data-dsave')) {
      if (!draft.title) { toast('Bitte gib der Entscheidung einen Titel.'); $('[name="dtitle"]', sh.body).focus(); return; }
      draft.options = draft.options.filter(o => o.name || (o.pros || []).some(p => p.t) || (o.cons || []).some(c => c.t));
      draft.options.forEach((o, i) => { if (!o.name) o.name = 'Option ' + String.fromCharCode(65 + i); o.pros = o.pros.filter(p => p.t); o.cons = o.cons.filter(c => c.t); });
      if (draft.options.length < 2) { toast('Mindestens zwei Optionen benötigt.'); rerender(); return; }
      await put('decisions', draft);
      sh.close();
      render();
      toast('Entscheidung gespeichert');
      setTimeout(() => { if (isNew) A.decisionDetail({ id: draft.id }); else refreshSheets(); }, 420);
      return;
    }
    const ed = b.dataset.ed, o = draft.options.find(x => x.id === b.dataset.o);
    if (ed === 'addOpt') { draft.options.push({ id: uid(), name: '', pros: [], cons: [], gut: 3 }); rerender(`[data-opt="${draft.options[draft.options.length - 1].id}"] [data-name]`); }
    else if (ed === 'delOpt') { draft.options = draft.options.filter(x => x.id !== b.dataset.o); rerender(); }
    else if (ed === 'addPc' && o) { o[b.dataset.kind].push({ t: '', w: 3 }); rerender(`[data-opt="${o.id}"] [data-pc="${b.dataset.kind}"][data-i="${o[b.dataset.kind].length - 1}"] [data-t]`); }
    else if (ed === 'delPc' && o) { o[b.dataset.kind].splice(+b.dataset.i, 1); rerender(); }
  });
  if (isNew) { const t = $('[name="dtitle"]', sh.body); if (t) t.focus({ preventScroll: true }); }
}
A.addDecision = () => decisionEditor(null);
A.decisionEdit = d => { const x = S.decisions.find(y => y.id === d.id); if (x) decisionEditor(x); };

/* ---------------- Lebensbereiche ---------------- */
function checkinFor(k) {
  const exact = S.checkins.find(c => c.id === k);
  if (exact) return exact;
  return S.checkins.filter(c => c.id < k && c.id >= addMonthKey(k, -2)).sort(by(c => c.id)).pop() || null;
}
function areaScores() {
  return memo('areas', () => {
    const t = today(), from30 = addDays(t, -29);
    const ci = checkinFor(curMonth());
    return AREAS.map(a => {
      const parts = [];
      if (a.id === 'finanzen') {
        const av = avgStats(3);
        if (av.rate != null) parts.push(clamp(av.rate / 25 * 10, 0, 10));
        const acc = accountsSummary();
        if (S.accounts.length && av.expense > 0) parts.push(clamp(acc.liquid / av.expense / 6 * 10, 0, 10));
      }
      if (a.id === 'geist') { const m = moodAvg(from30, t); if (m != null) parts.push((m - 1) / 4 * 10); }
      activeHabits().filter(h => h.area === a.id).forEach(h => { const r = habitRate(h, from30, t); if (r != null) parts.push(r * 10); });
      activeGoals().filter(g => g.area === a.id).forEach(g => {
        const st = goalStatus(g), p = goalProgress(g);
        parts.push(st.key === 'ok' ? 8 : st.key === 'open' ? 5 + p * 4 : st.key === 'behind' ? 4 : st.key === 'late' ? 2 : 10);
      });
      const data = parts.length ? avg(parts) : null;
      const self = ci && ci.scores && ci.scores[a.id] != null ? ci.scores[a.id] : null;
      const value = self != null && data != null ? (self + data) / 2 : (self ?? data);
      return { ...a, self, data, value };
    });
  });
}
/** Gesamtwert erst ab 4 bewerteten Bereichen – sonst wäre er irreführend. */
function lifeScore() {
  const vals = areaScores().map(a => a.value).filter(v => v != null);
  return vals.length >= 4 ? avg(vals) : null;
}
function areasView() {
  const cm = curMonth();
  const items = areaScores();
  const done = S.checkins.some(c => c.id === cm);
  const prevCi = S.checkins.filter(c => c.id < cm).sort(by(c => c.id)).pop();
  const ls = lifeScore();
  let h = '';
  if (!done) h += `<div class="card"><div class="card-t">Monats-Check-in</div><p style="margin:8px 0 14px">Bewerte in 1 Minute, wie zufrieden du gerade mit jedem Lebensbereich bist. So erkennst du Entwicklungen und blinde Flecken.</p><button class="btn block" data-act="checkin">Check-in für ${esc(fMonth(cm))} starten</button></div>`;
  h += `<div class="card"><div class="between"><span class="card-t">Lebensbalance</span>${ls != null ? `<span class="big-num md">${n1(ls)}<span class="muted" style="font-size:15px"> / 10</span></span>` : '<span class="small muted">Gesamtwert nach dem Check-in</span>'}</div>
    ${radarChart(items, prevCi ? AREAS.map(a => ({ ...a, value: prevCi.scores[a.id] ?? null })) : null)}
    <p class="small muted center">Wert = Mittel aus deiner Selbsteinschätzung und deinen Daten (Sparquote, Gewohnheiten, Ziele, Stimmung).${prevCi ? ' Gestrichelt: Check-in ' + esc(fMonth(prevCi.id)) + '.' : ''}</p></div>`;
  const sorted = items.slice().sort((a, b) => (a.value ?? 99) - (b.value ?? 99));
  const weakest = sorted.find(a => a.value != null);
  if (weakest && weakest.value < 6) {
    const hasGoal = activeGoals().some(g => g.area === weakest.id);
    h += `<div class="hint-box">🎯 Größter Hebel gerade: <b>${weakest.icon} ${esc(weakest.name)}</b> (${n1(weakest.value)}/10). ${hasGoal ? 'Du hast hier bereits ein Ziel – bleib dran!' : 'Setze dir hier ein kleines, konkretes Ziel oder eine Gewohnheit.'}
      ${hasGoal ? '' : `<div class="btn-row mt"><button class="btn small" data-act="goalForArea" data-area="${weakest.id}">Ziel setzen</button><button class="btn small tinted" data-act="habitForArea" data-area="${weakest.id}">Gewohnheit anlegen</button></div>`}</div>`;
  }
  h += `<div class="list">${items.map(a => {
    const prev = prevCi && prevCi.scores ? prevCi.scores[a.id] : null;
    const trend = a.self != null && prev != null && a.self !== prev ? `<span class="${a.self > prev ? 'pos' : 'neg'}">${a.self > prev ? '▲' : '▼'} ${Math.abs(a.self - prev)}</span>` : '';
    return `<div class="row has-ico"><div class="cat-ico">${a.icon}</div><div class="row-main"><div class="between"><span class="row-t">${esc(a.name)}</span><b class="num">${a.value == null ? '–' : n1(a.value)}</b></div>
      ${bar((a.value || 0) / 10, 'thin ' + (a.value == null ? '' : a.value >= 7 ? 'green' : a.value >= 5 ? '' : 'orange'))}
      <div class="row-s" style="margin-top:4px">Selbst: ${a.self == null ? '–' : a.self} · Daten: ${a.data == null ? '–' : n1(a.data)} ${trend}</div></div></div>`;
  }).join('')}</div>`;
  const hist = S.checkins.slice().sort(by(c => c.id, -1));
  if (hist.length) {
    h += `<div class="list-h"><span>Check-in-Verlauf</span></div><div class="list">${hist.map(c => {
      const vals = Object.values(c.scores || {}).filter(v => v != null);
      return `<button class="row" data-act="checkin" data-id="${c.id}"><div class="row-main"><div class="row-t">${esc(fMonth(c.id))}</div>${c.note ? `<div class="row-s">${esc(c.note)}</div>` : ''}</div><div class="row-r"><b class="num">${vals.length ? n1(avg(vals)) : '–'}</b><span class="chev">${ic('chevR', 'sm')}</span></div></button>`;
    }).join('')}</div>`;
  }
  return h;
}
A.checkin = d => {
  const k = d.id || curMonth();
  const ex = S.checkins.find(c => c.id === k);
  const prev = ex || S.checkins.filter(c => c.id < k).sort(by(c => c.id)).pop();
  const fields = [{ key: 'info', type: 'info', html: `<p class="small muted">Wie zufrieden bist du aktuell? 1 = sehr unzufrieden · 10 = rundum zufrieden.</p>` }];
  AREAS.forEach(a => fields.push({ key: a.id, label: `${a.icon} ${a.name}`, type: 'slider', min: 1, max: 10 }));
  fields.push({ key: 'note', label: 'Worauf willst du dich nächsten Monat konzentrieren?', type: 'textarea', rows: 3, group: true });
  const values = { note: ex ? ex.note : '' };
  AREAS.forEach(a => { values[a.id] = prev && prev.scores && prev.scores[a.id] != null ? prev.scores[a.id] : 5; });
  formSheet({
    title: `Check-in ${fMonth(k)}`, fields, values,
    onSave: async v => {
      const scores = {};
      AREAS.forEach(a => { scores[a.id] = v[a.id]; });
      await put('checkins', { id: k, date: today(), scores, note: v.note });
      toast('Check-in gespeichert');
    },
    onDelete: ex ? async () => { await del('checkins', k); } : null
  });
};
A.goalForArea = d => {
  goalForm(null);
  setTimeout(() => { const s = $('select[name="area"]', topSheet()?.el); if (s) { s.value = d.area; s.dispatchEvent(new Event('change', { bubbles: true })); } }, 30);
};
A.habitForArea = d => {
  habitForm(null);
  setTimeout(() => { const s = $('select[name="area"]', topSheet()?.el); if (s) { s.value = d.area; s.dispatchEvent(new Event('change', { bubbles: true })); } }, 30);
};
/* =========================================================
   START, EMPFEHLUNGEN, BERICHTE, EINSTELLUNGEN, BACKUP
   ========================================================= */

/* ---------------- Regelbasierte Empfehlungen ---------------- */
function recommendations() {
  return memo('recs' + today(), () => {
    const R = [], t = today(), st = S.settings;
    const add = r => R.push(r);
    const hasData = S.transactions.length + S.goals.length + S.journal.length + S.habits.length + S.accounts.length + S.tasks.length > 0;

    // Datensicherung
    if (hasData && !st.demo) {
      const lb = st.lastBackup ? st.lastBackup.slice(0, 10) : null;
      const days = lb ? diffDays(lb, t) : null;
      if (!lb || days >= (st.backupDays || 14)) add({ key: 'backup', prio: !lb || days > 30 ? 1 : 2, icon: '🛡️', title: lb ? `Letzte Sicherung vor ${days} Tagen` : 'Noch keine Datensicherung', text: 'Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig, z. B. in iCloud Drive, Google Drive oder per E-Mail an dich selbst.', act: 'backup', actLabel: 'Jetzt sichern' });
    }
    // Einstieg
    if (!S.accounts.length) add({ key: 'ob-acc', prio: 3, icon: '🏦', title: 'Konten erfassen', text: 'Trage Konten, Depots und Kredite ein – dann siehst du Nettovermögen und Notgroschen.', act: 'addAccount', actLabel: 'Konto hinzufügen' });
    if (!S.transactions.length) add({ key: 'ob-tx', prio: 3, icon: '🧾', title: 'Einnahmen & Ausgaben erfassen', text: 'Am schnellsten: Gehalt und Miete als Dauerauftrag anlegen – sie werden dann jeden Monat automatisch gebucht.', act: 'recurringList', actLabel: 'Dauerauftrag anlegen' });
    if (!S.goals.length) add({ key: 'ob-goal', prio: 3, icon: '🎯', title: 'Setze dir ein Ziel', text: 'Ein konkretes Ziel mit Frist gibt deinen Finanzen und Gewohnheiten eine Richtung.', act: 'addGoal', actLabel: 'Ziel setzen' });
    if (!S.habits.length) add({ key: 'ob-habit', prio: 3, icon: '🌱', title: 'Eine Gewohnheit starten', text: 'Beginne mit einer einzigen, sehr kleinen Gewohnheit, die zu deinem wichtigsten Ziel passt.', act: 'addHabit', actLabel: 'Gewohnheit anlegen' });

    // Finanzen
    const a = avgStats(3);
    if (a.months && a.income > 0 && a.basis !== 'laufender Monat') {
      if (a.rate < 0) add({ key: 'neg-rate', prio: 1, icon: '🚨', title: 'Ausgaben übersteigen Einnahmen', text: `${a.basis}: Dir fehlen ${eur0(-a.balance)} pro Monat. Prüfe zuerst Abos und die größten variablen Kategorien.`, act: 'go', tab: 'finanzen', sub: 'overview', actLabel: 'Analyse ansehen' });
      else if (a.rate < 10) add({ key: 'low-rate', prio: 2, icon: '📉', title: `Sparquote nur ${pct(a.rate)}`, text: 'Ziel: mindestens 10–20 %. Richte einen Dauerauftrag aufs Sparkonto direkt nach dem Gehaltseingang ein („Zahl dich zuerst selbst“).', act: 'go', tab: 'finanzen', sub: 'overview', actLabel: 'Analyse ansehen' });
      else if (a.rate >= 20) add({ key: 'good-rate', prio: 3, icon: '💪', title: `Starke Sparquote: ${pct(a.rate)}`, text: 'Du sparst überdurchschnittlich. Sieh dir an, was daraus über die Jahre werden kann.', act: 'go', tab: 'finanzen', sub: 'future', actLabel: 'Zukunft simulieren' });
    }
    const acc = accountsSummary();
    if (S.accounts.length && a.expense > 0) {
      const m = acc.liquid / a.expense;
      if (m < 3) add({ key: 'emerg', prio: m < 1 ? 1 : 2, icon: '🛟', title: 'Notgroschen aufbauen', text: `Deine liquiden Mittel reichen für ${n1(m)} Monate. Empfohlen: 3–6 Monatsausgaben (${eur0(a.expense * 3)} – ${eur0(a.expense * 6)}).`, act: 'go', tab: 'finanzen', sub: 'wealth', actLabel: 'Vermögen ansehen' });
      else if (m > 12) add({ key: 'idle-cash', prio: 3, icon: '💤', title: 'Viel Geld liegt ungenutzt', text: `Deine liquiden Mittel decken ${n1(m)} Monate. Geld über den Notgroschen hinaus verliert durch Inflation an Wert – informiere dich unabhängig (z. B. bei der Verbraucherzentrale) über Anlagemöglichkeiten.`, act: 'go', tab: 'finanzen', sub: 'future', actLabel: 'Simulation' });
    }
    S.accounts.filter(x => accType(x.type).debt && (x.interest || 0) >= 6 && x.balance > 0).forEach(x => add({ key: 'debt-' + x.id, prio: 1, icon: '💳', title: `Teuren Kredit tilgen: ${x.name}`, text: `${n1(x.interest)} % Zinsen auf ${eur0(x.balance)} kosten rund ${eur0(x.balance * x.interest / 100)} pro Jahr. Jede Sondertilgung „verzinst“ sich garantiert mit ${n1(x.interest)} %.`, act: 'editAccount', id: x.id, actLabel: 'Ansehen' }));
    // Budgets im laufenden Monat
    const cm = monthStats(curMonth());
    const frac = new Date().getDate() / daysInMonth(new Date().getFullYear(), new Date().getMonth());
    Object.entries(st.budgets || {}).forEach(([c, b]) => {
      if (!b) return;
      const s = cm.byCat[c] || 0;
      if (s > b) add({ key: `bud-${c}-${curMonth()}`, prio: 2, icon: catIcon(c), title: `Budget überschritten: ${c}`, text: `${eur0(s)} von ${eur0(b)} ausgegeben – ${eur0(s - b)} zu viel.`, act: 'go', tab: 'finanzen', sub: 'overview', actLabel: 'Ansehen' });
      else if (s > b * 0.85 && frac < 0.7) add({ key: `budw-${c}-${curMonth()}`, prio: 3, icon: catIcon(c), title: `${c}: Budget fast aufgebraucht`, text: `Schon ${pct(s / b * 100)} des Budgets genutzt, obwohl der Monat erst zu ${pct(frac * 100)} vorbei ist.`, act: 'go', tab: 'finanzen', sub: 'overview', actLabel: 'Ansehen' });
    });
    // Ausreißer im laufenden Monat
    if (frac > 0.3 && a.months >= 2) {
      Object.entries(cm.byCat).forEach(([c, v]) => {
        const av = a.byCat[c] || 0;
        if (av > 30 && v > av * 1.4 && v - av > 60 && !(st.budgets || {})[c]) add({ key: `spike-${c}-${curMonth()}`, prio: 2, icon: catIcon(c), title: `Ungewöhnlich hohe Ausgaben: ${c}`, text: `Diesen Monat bereits ${eur0(v)} – sonst Ø ${eur0(av)}. Bewusst so geplant?`, act: 'catTx', cat: c, actLabel: 'Buchungen ansehen' });
      });
    }
    // Abos
    S.subscriptions.filter(s => s.active && s.cancelBy && s.cancelBy >= t && diffDays(t, s.cancelBy) <= 14).forEach(s => add({ key: `cancel-${s.id}-${s.cancelBy}`, prio: 1, icon: '⏰', title: `Kündigungsfrist: ${s.name}`, text: `Noch ${diffDays(t, s.cancelBy)} Tage (bis ${fDate(s.cancelBy)}). Dein Nutzen-Rating: ${s.rating || 3}/5.`, act: 'editSub', id: s.id, actLabel: 'Abo ansehen' }));
    S.subscriptions.filter(s => s.active && ['yearly', 'halfyearly'].includes(s.cycle) && s.nextDate && diffDays(t, s.nextDate) >= 0 && diffDays(t, s.nextDate) <= 14).forEach(s => add({ key: `renew-${s.id}-${s.nextDate}`, prio: 2, icon: '🔁', title: `${s.name} verlängert sich bald`, text: `Am ${fDate(s.nextDate)} werden ${eur(s.amount)} fällig. Willst du es weiter nutzen?`, act: 'editSub', id: s.id, actLabel: 'Prüfen' }));
    const sp = savingsPotential();
    if (sp.monthly >= 20 && sp.items.length) add({ key: 'sp', prio: 2, icon: '💡', title: `Sparpotenzial: ${eur0(sp.monthly)} pro Monat`, text: `Größter Hebel: ${sp.items[0].title}. Über 10 Jahre angelegt ≈ ${eurK(futureValue(sp.monthly, 10, st.returnRate))}.`, act: 'go', tab: 'finanzen', sub: 'overview', actLabel: 'Details' });
    const stale = S.accounts.filter(x => x.updatedAt && diffDays(x.updatedAt, t) > 35);
    if (stale.length) add({ key: 'stale-' + curMonth(), prio: 3, icon: '🔄', title: 'Kontostände aktualisieren', text: `${stale.length === 1 ? '1 Konto wurde' : stale.length + ' Konten wurden'} seit über einem Monat nicht aktualisiert. So bleibt dein Vermögensverlauf aussagekräftig.`, act: 'go', tab: 'finanzen', sub: 'wealth', actLabel: 'Aktualisieren' });

    // Ziele
    activeGoals().forEach(g => {
      const s = goalStatus(g), pace = goalPace(g);
      if (s.key === 'late') add({ key: 'glate-' + g.id, prio: 1, icon: '⏰', title: `Frist verpasst: ${g.title}`, text: 'Passe die Frist realistisch an oder teile das Ziel in kleinere Etappen.', act: 'goalDetail', id: g.id, actLabel: 'Ziel öffnen' });
      else if (s.key === 'behind') add({ key: `gbehind-${g.id}-${weekStart(t)}`, prio: 2, icon: '🎯', title: `Im Rückstand: ${g.title}`, text: pace ? `Um die Frist zu halten, brauchst du jetzt ${fmtGoalVal(g, Math.abs(pace.perMonth))} pro Monat. Plane den nächsten konkreten Schritt.` : 'Plane diese Woche einen konkreten nächsten Schritt.', act: 'goalDetail', id: g.id, actLabel: 'Ziel öffnen' });
      else if (g.deadline && diffDays(t, g.deadline) <= 14 && diffDays(t, g.deadline) >= 0) add({ key: 'gsoon-' + g.id, prio: 2, icon: '⏳', title: `Frist in ${diffDays(t, g.deadline)} Tagen: ${g.title}`, text: `Aktueller Stand: ${Math.round(goalProgress(g) * 100)} %.`, act: 'goalDetail', id: g.id, actLabel: 'Ziel öffnen' });
      if (g.kind !== 'milestones' && !g.linkedAccount) {
        const last = (g.history || []).map(x => x.date).sort().pop() || g.createdAt;
        if (last && diffDays(last, t) > 30) add({ key: `gupd-${g.id}-${curMonth()}`, prio: 3, icon: '📝', title: `Fortschritt eintragen: ${g.title}`, text: 'Seit über 30 Tagen kein Update. Messen motiviert!', act: 'goalUpdate', id: g.id, actLabel: 'Aktualisieren' });
      }
    });
    // Gewohnheiten
    activeHabits().forEach(h => {
      if (h.createdAt && diffDays(h.createdAt, t) >= 14) {
        const r = habitRate(h, addDays(t, -13), t);
        if (r != null && r < 0.4) add({ key: `hweak-${h.id}-${weekStart(t)}`, prio: 2, icon: h.emoji || '🌱', title: `„${h.name}“ fällt dir gerade schwer`, text: `Nur ${pct(r * 100)} in den letzten 14 Tagen. Mach sie kleiner (2-Minuten-Version) oder senke das Wochenziel – Kontinuität schlägt Intensität.`, act: 'habitDetail', id: h.id, actLabel: 'Anpassen' });
      }
    });
    // Aufgaben
    const ot = openTasks();
    const od = ot.filter(x => x.due && x.due < t);
    if (od.length >= 3) add({ key: 'overdue-' + t, prio: 2, icon: '📋', title: `${od.length} überfällige Aufgaben`, text: 'Entscheide für jede: heute erledigen, neu terminieren oder bewusst streichen.', act: 'go', tab: 'ziele', sub: 'tasks', actLabel: 'Aufgaben' });
    if (ot.length >= 3 && !ot.some(x => x.important)) add({ key: 'focus-' + t, prio: 3, icon: '⭐️', title: 'Was ist heute wirklich wichtig?', text: 'Markiere 1–3 Aufgaben als „Fokus heute“ und erledige sie zuerst.', act: 'go', tab: 'ziele', sub: 'tasks', actLabel: 'Aufgaben' });
    // Tagebuch & Stimmung
    if (S.journal.length) {
      const last = S.journal.map(j => j.date).sort().pop();
      const gap = diffDays(last, t);
      if (gap >= 4) add({ key: 'jgap-' + t, prio: 3, icon: '✍️', title: `Seit ${gap} Tagen kein Tagebucheintrag`, text: '2 Minuten Reflexion am Abend schärfen den Blick für das, was dir guttut.', act: 'addJournal', actLabel: 'Eintrag schreiben' });
      const m7 = moodAvg(addDays(t, -6), t), mPrev = moodAvg(addDays(t, -29), addDays(t, -7));
      if (m7 != null && mPrev != null && mPrev - m7 >= 0.7) add({ key: 'mood-' + weekStart(t), prio: 1, icon: '🫶', title: 'Deine Stimmung ist gesunken', text: `Ø ${n1(m7)} in den letzten 7 Tagen nach ${n1(mPrev)} davor. Plane bewusst etwas, das dir guttut, und sprich mit einem vertrauten Menschen.`, act: 'go', tab: 'journal', sub: 'diary', actLabel: 'Tagebuch' });
    }
    // Entscheidungen
    S.decisions.filter(d => d.status === 'decided' && d.reviewDate && d.reviewDate <= t).forEach(d => add({ key: 'drev-' + d.id, prio: 2, icon: '⚖️', title: `Rückblick: ${d.title}`, text: 'War es die richtige Entscheidung? Dein Rückblick macht künftige Entscheidungen besser.', act: 'decisionReview', id: d.id, actLabel: 'Rückblick' }));
    // Lebensbereiche
    const dom = new Date().getDate();
    if (hasData && !S.checkins.some(c => c.id === curMonth()) && (dom >= 24 || !S.checkins.length)) add({ key: 'checkin-' + curMonth(), prio: 3, icon: '🧭', title: 'Monats-Check-in', text: 'Bewerte deine 8 Lebensbereiche in einer Minute und erkenne, wo der größte Hebel liegt.', act: 'checkin', actLabel: 'Starten' });
    const weakest = areaScores().filter(x => x.value != null).sort((x, y) => x.value - y.value)[0];
    if (weakest && weakest.value < 5 && !activeGoals().some(g => g.area === weakest.id)) add({ key: `area-${weakest.id}-${curMonth()}`, prio: 2, icon: weakest.icon, title: `Lebensbereich mit Potenzial: ${weakest.name}`, text: `Aktuell ${n1(weakest.value)}/10. Ein kleines Ziel oder eine Gewohnheit in diesem Bereich bringt oft am meisten Lebensqualität.`, act: 'goalForArea', area: weakest.id, actLabel: 'Ziel setzen' });

    const dis = st.dismissed || {};
    return R.filter(r => !(dis[r.key] && dis[r.key] >= t)).sort(by(r => r.prio));
  });
}
function recHtml(r) {
  const attrs = ['id', 'tab', 'sub', 'cat', 'area'].filter(k => r[k]).map(k => `data-${k}="${esc(r[k])}"`).join(' ');
  return `<div class="rec"><div class="rec-ico p${r.prio}">${r.icon}</div><div class="grow"><div class="rec-t">${esc(r.title)}</div><div class="rec-x">${esc(r.text)}</div>
    <div class="rec-a">${r.act ? `<button class="btn small tinted" data-act="${r.act}" ${attrs}>${esc(r.actLabel || 'Öffnen')}</button>` : ''}<button class="link small" style="font-size:13px;color:var(--text2)" data-act="dismissRec" data-rid="${esc(r.key)}">Ausblenden</button></div></div></div>`;
}
A.dismissRec = async d => {
  const dis = { ...(S.settings.dismissed || {}) };
  const t = today();
  Object.keys(dis).forEach(k => { if (dis[k] < t) delete dis[k]; });
  dis[d.rid] = addDays(t, 7);
  S.settings.dismissed = dis;
  await saveSettings();
  toast('Für 7 Tage ausgeblendet');
  render(); refreshSheets();
};
A.allRecs = () => {
  const html = () => { const r = recommendations(); return r.length ? `<div class="card">${r.map(recHtml).join('')}</div>` : `<div class="card">${empty('✨', 'Alles im grünen Bereich – keine offenen Empfehlungen.')}</div>`; };
  const sh = openSheet({ title: 'Empfehlungen', body: html(), tall: true });
  sh.refresh = () => sh.setBody(html());
};

/* ---------------- Startseite ---------------- */
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
}
VIEWS.heute = () => {
  const t = today(), name = (S.settings.name || '').trim();
  let h = '';
  if (S.settings.demo) h += `<div class="hint-box orange">🧪 Du siehst <b>Beispieldaten</b>. Wenn du startklar bist: <button class="link" data-act="resetAll">Alles löschen & neu beginnen</button></div>`;
  h += `<div class="quick">
    <button data-act="addTx" data-type="expense"><span class="q-ico" style="background:var(--red-ui)">${ic('minus')}</span>Ausgabe</button>
    <button data-act="addTx" data-type="income"><span class="q-ico" style="background:var(--green-ui)">${ic('plus')}</span>Einnahme</button>
    <button data-act="addJournal"><span class="q-ico" style="background:var(--indigo)">${ic('edit')}</span>Tagebuch</button>
    <button data-act="addTask"><span class="q-ico" style="background:var(--orange-ui)">${ic('check')}</span>Aufgabe</button></div>`;
  // Finanz-Überblick
  const cm = monthStats(curMonth());
  if (S.accounts.length || S.transactions.length) {
    const s = accountsSummary();
    const prev = sortedSnapshots().filter(x => x.id < curMonth()).pop();
    h += `<div class="card tap" data-act="go" data-tab="finanzen" data-sub="${S.accounts.length ? 'wealth' : 'overview'}">`;
    if (S.accounts.length) h += `<div class="between"><span class="card-t">Nettovermögen</span><span class="chev">${ic('chevR', 'sm')}</span></div><div class="big-num" style="margin:4px 0 2px">${eur0(s.net)}</div>${prev ? `<div class="small muted">${deltaHtml(s.net, prev.net, true, v => sEur(Math.round(v)))} seit ${esc(fMonth(prev.id))}</div>` : ''}`;
    else h += `<div class="between"><span class="card-t">Finanzen</span><span class="chev">${ic('chevR', 'sm')}</span></div>`;
    h += `<div class="inline-stats"><div><div class="stat-l">Einnahmen ${esc(fMon(curMonth()))}</div><div class="num pos" style="font-weight:600">${eur0(cm.income)}</div></div>
      <div><div class="stat-l">Ausgaben</div><div class="num" style="font-weight:600">${eur0(cm.expense)}</div></div>
      <div><div class="stat-l">Sparquote</div><div class="num" style="font-weight:600">${pct(cm.rate)}</div></div></div></div>`;
  }
  // Empfehlungen
  const recs = recommendations();
  if (recs.length) {
    h += `<div class="section-h"><h2>Empfehlungen</h2>${recs.length > 3 ? `<button class="link" data-act="allRecs">Alle (${recs.length})</button>` : ''}</div>`;
    h += `<div class="card">${recs.slice(0, 3).map(recHtml).join('')}</div>`;
  }
  // Gewohnheiten
  const hs = activeHabits();
  if (hs.length) {
    const done = hs.filter(x => hDone(x, t)).length;
    h += `<div class="section-h"><h2>Gewohnheiten</h2><span class="muted small">${done} von ${hs.length} erledigt</span></div>`;
    h += `<div class="list">${hs.map(x => habitRow(x, false)).join('')}</div>`;
  }
  // Aufgaben
  const ot = openTasks();
  const focus = sortTasks(ot.filter(x => x.important || (x.due && x.due <= t))).slice(0, 5);
  if (ot.length) {
    h += `<div class="section-h"><h2>Heute wichtig</h2><button class="link" data-act="go" data-tab="ziele" data-sub="tasks">Alle (${ot.length})</button></div>`;
    h += focus.length ? `<div class="list">${focus.map(taskRow).join('')}</div>` : `<div class="card small muted">Keine fälligen Aufgaben. Markiere Aufgaben mit ⭐️, um sie hier zu sehen.</div>`;
  }
  // Demnächst
  const up = upcoming(10);
  if (up.length) {
    h += `<div class="section-h"><h2>Demnächst</h2></div><div class="list">${up.map(u => `<button class="row has-ico" data-act="${u.act}" data-id="${esc(u.id)}"><div class="cat-ico">${u.icon}</div><div class="row-main"><div class="row-t">${esc(u.title)}</div><div class="row-s">${esc(u.sub)}</div></div><div class="row-r small">${esc(relDay(u.date))}</div></button>`).join('')}</div>`;
  }
  // Ziele & Lebensbalance
  const ag = activeGoals();
  if (ag.length) {
    h += `<div class="section-h"><h2>Ziele</h2><button class="link" data-act="go" data-tab="ziele" data-sub="goals">Alle</button></div>`;
    h += `<div class="list">${ag.slice().sort(by(g => goalStatus(g).key === 'behind' ? 0 : 1)).slice(0, 3).map(g => {
      const p = goalProgress(g), st = goalStatus(g);
      return `<button class="row" data-act="goalDetail" data-id="${g.id}" style="flex-wrap:wrap"><div class="row-main"><div class="between"><span class="row-t">${esc(g.title)}</span><span class="badge ${st.cls}">${st.label}</span></div><div style="margin-top:6px">${bar(p, 'thin ' + (st.key === 'behind' ? 'orange' : ''))}</div></div></button>`;
    }).join('')}</div>`;
  }
  const ls = lifeScore();
  if (ls != null) {
    const w = areaScores().filter(x => x.value != null).sort((a, b) => a.value - b.value)[0];
    h += `<div class="card tap" data-act="go" data-tab="journal" data-sub="areas"><div class="between"><span class="card-t">Lebensbalance</span><span class="chev">${ic('chevR', 'sm')}</span></div>
      <div class="between" style="margin-top:6px"><span class="big-num md">${n1(ls)}<span class="muted" style="font-size:15px"> / 10</span></span>${w ? `<span class="small muted" style="text-align:right">Größter Hebel:<br><b style="color:var(--text)">${w.icon} ${esc(w.name)}</b></span>` : ''}</div></div>`;
  }
  return page(greeting() + (name ? ', ' + name : ''), h, { sub: DF.wd.format(new Date()) });
};
function upcoming(days) {
  const t = today(), end = addDays(t, days);
  const out = [];
  S.subscriptions.filter(s => s.active && s.nextDate >= t && s.nextDate <= end).forEach(s => out.push({ date: s.nextDate, icon: '🔁', title: s.name, sub: `Abo · ${eur(s.amount)}`, act: 'editSub', id: s.id }));
  S.recurring.filter(r => r.active && r.nextDate >= t && r.nextDate <= end).forEach(r => out.push({ date: r.nextDate, icon: catIcon(r.category), title: r.note || r.category, sub: `${r.type === 'income' ? 'Eingang' : 'Dauerauftrag'} · ${eur(r.amount)}`, act: 'editRecurring', id: r.id }));
  activeGoals().filter(g => g.deadline && g.deadline >= t && g.deadline <= end).forEach(g => out.push({ date: g.deadline, icon: '🎯', title: g.title, sub: 'Zielfrist', act: 'goalDetail', id: g.id }));
  openTasks().filter(x => x.due && x.due > t && x.due <= end).forEach(x => out.push({ date: x.due, icon: '📋', title: x.title, sub: 'Aufgabe', act: 'editTask', id: x.id }));
  S.decisions.filter(d => d.status === 'decided' && d.reviewDate && d.reviewDate >= t && d.reviewDate <= end).forEach(d => out.push({ date: d.reviewDate, icon: '⚖️', title: d.title, sub: 'Entscheidungs-Rückblick', act: 'decisionDetail', id: d.id }));
  return out.sort(by(x => x.date)).slice(0, 6);
}

/* ---------------- Berichte ---------------- */
function reportRange(type, anchor) {
  if (type === 'week') {
    const from = weekStart(anchor), to = addDays(from, 6);
    return { from, to, label: `KW ${isoWeek(from)} · ${pd(from).getFullYear()}`, sub: `${fDay(from)} – ${fDate(to)}` };
  }
  if (type === 'year') {
    const y = anchor.slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Jahr ${y}`, sub: '' };
  }
  const k = anchor.slice(0, 7);
  return { from: k + '-01', to: monthEnd(k), label: fMonth(k), sub: '' };
}
function shiftAnchor(type, a, n) { return type === 'week' ? addDays(a, 7 * n) : type === 'year' ? addMonths(a, 12 * n) : addMonths(a, n); }
A.report = d => {
  const type = UI.sub.berichte;
  const next = shiftAnchor(type, UI.reportAnchor, +d.d);
  if (reportRange(type, next).from > today()) return;
  UI.reportAnchor = next; render();
};

function reportData(from, to) {
  const t = today();
  const effTo = to > t ? t : to;
  const fin = rangeStats(from, to);
  const habits = activeHabits().map(h => ({ h, r: habitRate(h, from, effTo) })).filter(x => x.r != null).sort((a, b) => b.r - a.r);
  const tasksDone = S.tasks.filter(x => x.done && x.doneAt >= from && x.doneAt <= to).length;
  const focusMin = focusMinutes(from, to);
  const msDone = sum(S.goals, g => (g.milestones || []).filter(m => m.done && m.doneAt >= from && m.doneAt <= to).length);
  const goalsDone = S.goals.filter(g => g.status === 'done' && g.doneAt >= from && g.doneAt <= to);
  const jEntries = S.journal.filter(j => j.date >= from && j.date <= to);
  const mood = moodAvg(from, to);
  const energyVals = jEntries.filter(j => j.energy).map(j => j.energy);
  const decisions = S.decisions.filter(d => d.decidedAt && d.decidedAt >= from && d.decidedAt <= to);
  const snaps = sortedSnapshots();
  const startSnap = snaps.filter(s => s.id < from.slice(0, 7)).pop();
  const endSnap = snaps.filter(s => s.id <= to.slice(0, 7)).pop();
  return {
    fin, habits, habitRate: habits.length ? avg(habits.map(x => x.r)) : null, tasksDone, focusMin, msDone, goalsDone,
    jDays: new Set(jEntries.map(j => j.date)).size, mood, energy: energyVals.length ? avg(energyVals) : null, decisions,
    nwStart: startSnap ? startSnap.net : null, nwEnd: endSnap ? endSnap.net : null, nwStartLabel: startSnap ? fMonth(startSnap.id) : ''
  };
}
function reportInsights(cur, prev, ongoing = false) {
  const out = [];
  const f = cur.fin, pf = prev.fin;
  if (f.income > 0 && f.rate >= 20) out.push(`💪 Starke Sparquote von ${pct(f.rate)} – ${eur0(f.balance)} Überschuss.`);
  else if (f.income > 0 && f.rate < 0) out.push(`🚨 Du hast ${eur0(-f.balance)} mehr ausgegeben als eingenommen.`);
  if (!ongoing && pf.expense > 0 && f.expense > 0) {
    const d = (f.expense - pf.expense) / pf.expense * 100;
    if (d <= -5) out.push(`📉 Ausgaben um ${pct(-d)} gesunken (${eur0(pf.expense - f.expense)} weniger als im Vorzeitraum).`);
    if (d >= 10) {
      const drivers = Object.entries(f.byCat).map(([c, v]) => [c, v - (pf.byCat[c] || 0)]).sort((a, b) => b[1] - a[1]);
      out.push(`📈 Ausgaben um ${pct(d)} gestiegen${drivers[0] && drivers[0][1] > 0 ? ` – größter Treiber: ${drivers[0][0]} (+${eur0(drivers[0][1])})` : ''}.`);
    }
  }
  if (cur.habits.length) {
    const best = cur.habits[0], worst = cur.habits[cur.habits.length - 1];
    out.push(`🔥 Stärkste Gewohnheit: ${best.h.emoji || ''} ${best.h.name} (${pct(best.r * 100)}).`);
    if (cur.habits.length > 1 && worst.r < 0.6) out.push(`🌱 Ausbaufähig: ${worst.h.emoji || ''} ${worst.h.name} (${pct(worst.r * 100)}).`);
  }
  if (cur.goalsDone.length) out.push(`🏆 Ziel${cur.goalsDone.length > 1 ? 'e' : ''} erreicht: ${cur.goalsDone.map(g => g.title).join(', ')}.`);
  if (cur.mood != null && prev.mood != null && Math.abs(cur.mood - prev.mood) >= 0.3) out.push(`${cur.mood > prev.mood ? '😊' : '🫶'} Stimmung ${cur.mood > prev.mood ? 'besser' : 'schlechter'} als im Vorzeitraum (${n1(cur.mood)} statt ${n1(prev.mood)}).`);
  if (cur.focusMin >= 60) out.push(`🎯 ${n0(cur.focusMin)} Minuten konzentrierte Fokuszeit.`);
  return out;
}
VIEWS.berichte = () => {
  const type = UI.sub.berichte;
  const r = reportRange(type, UI.reportAnchor);
  const pr = reportRange(type, shiftAnchor(type, UI.reportAnchor, -1));
  const cur = reportData(r.from, r.to), prev = reportData(pr.from, pr.to);
  const nextDisabled = reportRange(type, shiftAnchor(type, UI.reportAnchor, 1)).from > today();
  let h = seg('berichte', [['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr']], type) + periodNav('report', r.label, [r.sub, r.to >= today() ? 'läuft noch – Vergleich mit dem ganzen Vorzeitraum' : ''].filter(Boolean).join(' · '), nextDisabled);
  const ongoing = r.to >= today();
  const ins = reportInsights(cur, prev, ongoing);
  h += `<div class="card"><div class="card-h"><span class="card-t">Auf einen Blick</span><button class="link small" data-act="shareReport">${ic('share', 'sm')}</button></div>
    ${ins.length ? ins.map(i => `<p style="margin-top:8px;font-size:15px">${esc(i)}</p>`).join('') : '<p class="muted small">Für diesen Zeitraum liegen noch wenige Daten vor.</p>'}</div>`;
  // Finanzen
  const f = cur.fin, pf = prev.fin;
  h += `<div class="section-h"><h2>Finanzen</h2></div><div class="stats">
    <div class="stat"><div class="stat-l">Einnahmen</div><div class="stat-v pos">${eur0(f.income)}</div><div class="stat-d">${deltaHtml(f.income, pf.income, true)}</div></div>
    <div class="stat"><div class="stat-l">Ausgaben</div><div class="stat-v">${eur0(f.expense)}</div><div class="stat-d">${deltaHtml(f.expense, pf.expense, false)}</div></div>
    <div class="stat"><div class="stat-l">Überschuss</div><div class="stat-v ${f.balance < 0 ? 'neg' : ''}">${sEur(Math.round(f.balance))}</div></div>
    <div class="stat"><div class="stat-l">Sparquote</div><div class="stat-v">${pct(f.rate)}</div><div class="stat-d">${pf.rate != null ? 'vorher ' + pct(pf.rate) : ''}</div></div></div>`;
  if (cur.nwEnd != null && cur.nwStart != null && type !== 'week') h += `<div class="card"><div class="between"><span>Nettovermögen</span><b class="num">${eur0(cur.nwEnd)}</b></div><div class="small muted" style="margin-top:4px">${sEur(Math.round(cur.nwEnd - cur.nwStart))} seit ${esc(cur.nwStartLabel)}</div></div>`;
  if (type === 'year') {
    const y = r.from.slice(0, 4);
    const keys = Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`);
    const ms = keys.map(monthStats);
    if (ms.some(m => m.count)) h += `<div class="card"><div class="card-t" style="margin-bottom:6px">Monate im Vergleich</div>${barChart({ labels: keys.map(fMon), series: [{ name: 'Einnahmen', values: ms.map(m => m.income), color: 'var(--series-1)' }, { name: 'Ausgaben', values: ms.map(m => m.expense), color: 'var(--series-2)' }] })}</div>`;
  }
  const cats = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (cats.length) {
    h += `<div class="card"><div class="card-t" style="margin-bottom:10px">Größte Ausgaben</div><div class="cat-bars">${cats.map(([c, v]) => `<div class="cb"><div class="cb-top"><span>${catIcon(c)} ${esc(c)}</span><span class="num">${eur0(v)} ${deltaHtml(v, pf.byCat[c], false)}</span></div>${bar(v / cats[0][1], 'thin')}</div>`).join('')}</div></div>`;
  }
  // Gewohnheiten
  h += `<div class="section-h"><h2>Gewohnheiten</h2>${cur.habitRate != null ? `<span class="small muted">Ø ${pct(cur.habitRate * 100)}</span>` : ''}</div>`;
  h += cur.habits.length ? `<div class="card"><div class="cat-bars">${cur.habits.map(x => `<div class="cb"><div class="cb-top"><span>${esc(x.h.emoji || '')} ${esc(x.h.name)}</span><span class="num">${pct(x.r * 100)}</span></div>${bar(x.r, 'thin ' + (x.r >= 0.8 ? 'green' : x.r >= 0.5 ? '' : 'orange'))}</div>`).join('')}</div></div>` : `<div class="card small muted">Keine Gewohnheiten in diesem Zeitraum.</div>`;
  // Produktivität & Ziele
  h += `<div class="section-h"><h2>Produktivität & Ziele</h2></div><div class="stats">
    <div class="stat"><div class="stat-l">Aufgaben erledigt</div><div class="stat-v">${cur.tasksDone}</div><div class="stat-d">vorher ${prev.tasksDone}</div></div>
    <div class="stat"><div class="stat-l">Fokuszeit</div><div class="stat-v">${n0(cur.focusMin)} Min.</div><div class="stat-d">vorher ${n0(prev.focusMin)} Min.</div></div>
    <div class="stat"><div class="stat-l">Meilensteine</div><div class="stat-v">${cur.msDone}</div></div>
    <div class="stat"><div class="stat-l">Ziele erreicht</div><div class="stat-v ${cur.goalsDone.length ? 'pos' : ''}">${cur.goalsDone.length}</div></div></div>`;
  // Wohlbefinden
  h += `<div class="section-h"><h2>Wohlbefinden</h2></div><div class="stats three">
    <div class="stat"><div class="stat-l">Stimmung</div><div class="stat-v">${cur.mood == null ? '–' : MOODS[Math.round(cur.mood) - 1] + ' ' + n1(cur.mood)}</div></div>
    <div class="stat"><div class="stat-l">Energie</div><div class="stat-v">${cur.energy == null ? '–' : n1(cur.energy)}</div></div>
    <div class="stat"><div class="stat-l">Tagebuch</div><div class="stat-v">${cur.jDays} T.</div></div></div>`;
  if (cur.decisions.length) h += `<div class="card"><div class="card-t">Getroffene Entscheidungen</div>${cur.decisions.map(d => { const o = (d.options || []).find(x => x.id === d.chosen); return `<p class="small" style="margin-top:8px">⚖️ ${esc(d.title)} → <b>${esc(o ? o.name : '–')}</b></p>`; }).join('')}</div>`;
  // Fokus nächste Periode
  const recs = recommendations().filter(x => x.prio <= 2).slice(0, 3);
  if (recs.length && r.to >= addDays(today(), -7)) h += `<div class="card"><div class="card-t">Fokus für den nächsten Zeitraum</div>${recs.map(x => `<p class="small" style="margin-top:8px">${x.icon} ${esc(x.title)}</p>`).join('')}</div>`;
  return page('Berichte', h);
};
function reportText() {
  const type = UI.sub.berichte;
  const r = reportRange(type, UI.reportAnchor);
  const pr = reportRange(type, shiftAnchor(type, UI.reportAnchor, -1));
  const c = reportData(r.from, r.to), p = reportData(pr.from, pr.to);
  const L = [`LIFE OS – Bericht ${r.label}${r.sub ? ' (' + r.sub + ')' : ''}`, ''];
  reportInsights(c, p, r.to >= today()).forEach(i => L.push('• ' + i));
  L.push('', 'FINANZEN', `Einnahmen: ${eur(c.fin.income)}`, `Ausgaben: ${eur(c.fin.expense)}`, `Überschuss: ${sEur(c.fin.balance)}`, `Sparquote: ${pct(c.fin.rate)}`);
  Object.entries(c.fin.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([k, v]) => L.push(`  – ${k}: ${eur(v)}`));
  if (c.habits.length) { L.push('', 'GEWOHNHEITEN'); c.habits.forEach(x => L.push(`  – ${x.h.name}: ${pct(x.r * 100)}`)); }
  L.push('', 'PRODUKTIVITÄT', `Aufgaben erledigt: ${c.tasksDone}`, `Fokuszeit: ${c.focusMin} Min.`, `Meilensteine: ${c.msDone}`, `Ziele erreicht: ${c.goalsDone.length}`);
  L.push('', 'WOHLBEFINDEN', `Stimmung: ${c.mood == null ? '–' : n1(c.mood) + '/5'}`, `Tagebuch-Tage: ${c.jDays}`);
  return L.join('\n');
}
A.shareReport = async () => {
  const text = reportText();
  if (navigator.share) { try { await navigator.share({ title: 'LIFE OS Bericht', text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Bericht in die Zwischenablage kopiert'); }
  catch (e) { downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `lifeos-bericht-${today()}.txt`); }
};

/* ---------------- Datensicherung ---------------- */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function buildBackup() {
  const data = {};
  for (const s of STORES) data[s] = await DB.all(s);
  return { app: 'LIFE OS', format: 1, version: APP_VERSION, exportedAt: new Date().toISOString(), data };
}
async function markBackup() { S.settings.lastBackup = new Date().toISOString(); await saveSettings(); render(); refreshSheets(); }
A.backup = async () => {
  const payload = await buildBackup();
  const name = `lifeos-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  let file = null;
  try { file = new File([blob], name, { type: 'application/json' }); } catch (e) { /* ältere Browser */ }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'LIFE OS Backup' });
      await markBackup();
      toast('Backup erstellt ✓');
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  downloadBlob(blob, name);
  await markBackup();
  toast('Backup-Datei heruntergeladen ✓');
};
A.backupDownload = async () => {
  const payload = await buildBackup();
  downloadBlob(new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }), `lifeos-backup-${today()}.json`);
  await markBackup();
  toast('Backup-Datei heruntergeladen ✓');
};
A.restore = () => {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if (!f) return;
    try {
      const text = await f.text();
      let payload;
      try { payload = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist keine gültige LIFE-OS-Sicherung.'); }
      if (!payload || payload.app !== 'LIFE OS' || typeof payload.data !== 'object') throw new Error('Die Datei ist keine LIFE-OS-Sicherung.');
      const d = payload.data;
      for (const s of STORES) if (d[s] != null && !Array.isArray(d[s])) throw new Error('Die Sicherung ist beschädigt.');
      const count = sum(COLL, c => (d[c] || []).length);
      const when = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString('de-DE') : 'unbekannt';
      if (!await confirmDlg(`Sicherung vom ${when} mit ${count} Einträgen wiederherstellen? Alle aktuellen Daten auf diesem Gerät werden dabei ersetzt.`, { title: 'Wiederherstellen?', ok: 'Wiederherstellen', danger: true })) return;
      const meta = (d.meta || []).map(m => m.id === 'settings' ? { ...m, onboarded: true } : m);
      if (!meta.some(m => m.id === 'settings')) meta.push({ ...DEFAULT_SETTINGS, onboarded: true });
      await DB.replaceAll({ ...d, meta });
      await loadAll();
      applyTheme();
      closeAllSheets();
      await processDue();
      render(true);
      toast(`Wiederhergestellt: ${count} Einträge ✓`);
    } catch (e) {
      console.error(e);
      await confirmDlg(e.message, { title: 'Wiederherstellung fehlgeschlagen', ok: 'OK', cancel: '' });
    }
  });
  inp.click();
};
A.exportCsv = async () => {
  const rows = [['Datum', 'Art', 'Kategorie', 'Betrag', 'Notiz']];
  S.transactions.slice().sort(by(t => t.date)).forEach(t => rows.push([t.date, t.type === 'income' ? 'Einnahme' : 'Ausgabe', t.category, (t.type === 'income' ? '' : '-') + fmtIn(t.amount), t.note || '']));
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const name = `lifeos-buchungen-${today()}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  let file = null;
  try { file = new File([blob], name, { type: 'text/csv' }); } catch (e) { /* */ }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'LIFE OS Buchungen' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  downloadBlob(blob, name);
};
A.resetAll = async () => {
  if (!await confirmDlg('Alle Buchungen, Konten, Ziele, Gewohnheiten, Tagebucheinträge und Einstellungen werden von diesem Gerät gelöscht.', { title: 'Alle Daten löschen?', ok: 'Weiter', danger: true })) return;
  if (!S.settings.demo && !await confirmDlg('Das kann nicht rückgängig gemacht werden. Hast du ein aktuelles Backup?', { title: 'Wirklich alles löschen?', ok: 'Endgültig löschen', danger: true })) return;
  await DB.replaceAll({});
  try { localStorage.removeItem('lifeos-ui'); } catch (e) { /* */ }
  location.reload();
};

/* ---------------- Einstellungen ---------------- */
function applyTheme() {
  const th = S.settings.theme || 'system';
  const root = document.documentElement;
  if (th === 'system') delete root.dataset.theme; else root.dataset.theme = th;
  const metas = $$('meta[name="theme-color"]');
  metas.forEach(m => {
    if (th === 'system') m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? '#000000' : '#f2f2f7');
    else m.setAttribute('content', th === 'dark' ? '#000000' : '#f2f2f7');
  });
}
function settingsHtml() {
  const st = S.settings;
  const lb = st.lastBackup ? new Date(st.lastBackup) : null;
  const counts = COLL.reduce((a, c) => a + S[c].length, 0);
  const row = (act, icon, title, sub = '', cls = '') => `<button class="row has-ico" data-act="${act}"><div class="cat-ico ${cls}">${icon}</div><div class="row-main"><div class="row-t">${title}</div>${sub ? `<div class="row-s wrap">${sub}</div>` : ''}</div><span class="chev">${ic('chevR', 'sm')}</span></button>`;
  return `
    <div class="list-h"><span>Profil</span></div><div class="list">${row('editProfile', '👤', esc(st.name || 'Name festlegen'), 'Für die persönliche Begrüßung')}</div>
    <div class="list-h"><span>Darstellung</span></div>
    <div class="seg">${[['system', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) => `<button class="${st.theme === v ? 'on' : ''}" data-act="setTheme" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="list-h"><span>Finanzen</span></div><div class="list">
      ${row('editAssumptions', '📈', 'Annahmen für Prognosen', `Rendite ${n1(st.returnRate)} % · Inflation ${n1(st.inflation)} %`)}
      ${row('editBudgets', '🎯', 'Monatsbudgets', `${Object.keys(st.budgets || {}).length} Kategorien mit Budget`)}
      ${row('editCategories', '🏷️', 'Kategorien anpassen', `${st.expenseCats.length} Ausgaben- und ${st.incomeCats.length} Einnahmekategorien`)}
      ${row('recurringList', '🔁', 'Daueraufträge', `${S.recurring.filter(r => r.active).length} aktiv`)}</div>
    <div class="list-h"><span>Datensicherung</span></div>
    <div class="hint-box ${lb && diffDays(iso(lb), today()) < (st.backupDays || 14) ? '' : 'orange'}">${lb ? `Letzte Sicherung: <b>${esc(lb.toLocaleDateString('de-DE'))}</b> (${esc(relIn(iso(lb)))})` : '<b>Noch keine Sicherung erstellt.</b>'}<br><span class="small">Deine Daten liegen ausschließlich auf diesem Gerät. Wird die App gelöscht oder das Handy getauscht, brauchst du ein Backup.</span></div>
    <div class="list">
      ${row('backup', ic('share'), '<b>Backup erstellen</b>', 'Als Datei in iCloud Drive, Google Drive, per Mail o. Ä. speichern', '')}
      ${row('backupDownload', ic('download'), 'Backup als Datei herunterladen', 'Alternative, falls „Teilen“ nicht funktioniert')}
      ${row('restore', ic('upload'), 'Backup wiederherstellen', 'Ersetzt die Daten auf diesem Gerät')}
      ${row('exportCsv', ic('doc'), 'Buchungen als CSV exportieren', 'Für Excel, Numbers oder Google Tabellen')}
      ${row('editBackupDays', '⏰', 'Sicherungs-Erinnerung', `alle ${st.backupDays || 14} Tage`)}</div>
    <div class="list-h"><span>Speicher</span></div>
    <div class="card"><div class="kv"><span>Einträge gesamt</span><span class="num">${n0(counts)}</span></div><div class="kv"><span>Belegter Speicher</span><span class="num" id="stUsage">…</span></div><div class="kv"><span>Dauerhafter Speicher</span><span id="stPersist">…</span></div></div>
    <div class="list-h"><span>Daten</span></div><div class="list">
      ${counts === 0 ? row('loadDemo', '🧪', 'Beispieldaten laden', 'Zum Ausprobieren aller Funktionen') : ''}
      <button class="row danger-txt" data-act="resetAll" style="justify-content:center">Alle Daten löschen</button></div>
    <div class="card small muted" style="line-height:1.5"><b style="color:var(--text)">LIFE OS ${APP_VERSION}</b><br>
      100 % offline und privat: Keine Konten, keine Server, keine Werbung, keine Tracker, keine KI-Dienste. Alle Berechnungen und Empfehlungen laufen regelbasiert direkt auf deinem Gerät.<br><br>
      Die Finanzfunktionen dienen der persönlichen Orientierung und sind keine Anlage-, Steuer- oder Rechtsberatung.</div>`;
}
A.settings = () => {
  const sh = openSheet({ title: 'Einstellungen', body: settingsHtml(), tall: true, left: '', right: '<button class="txt-btn bold" data-sheet-close>Fertig</button>', onMount: fillStorageInfo });
  sh.refresh = () => { sh.setBody(settingsHtml()); fillStorageInfo(); };
};
async function fillStorageInfo() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      const el = $('#stUsage'); if (el) el.textContent = e.usage != null ? `${n1(e.usage / 1024 / 1024)} MB` : 'unbekannt';
    } else { const el = $('#stUsage'); if (el) el.textContent = 'unbekannt'; }
    const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
    const el2 = $('#stPersist');
    if (el2) el2.innerHTML = p ? '<span class="pos">aktiv ✓</span>' : p === false ? '<button class="link" data-act="persist">aktivieren</button>' : 'unbekannt';
  } catch (e) { /* */ }
}
A.persist = async () => {
  let ok = false;
  try { ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { /* */ }
  toast(ok ? 'Dauerhafter Speicher aktiviert ✓' : 'Der Browser hat abgelehnt. Installiere die App auf dem Startbildschirm und erstelle regelmäßig Backups.');
  fillStorageInfo();
};
A.setTheme = async d => { S.settings.theme = d.v; await saveSettings(); applyTheme(); refreshSheets(); };
A.editProfile = () => formSheet({
  title: 'Profil', fields: [{ key: 'name', label: 'Vorname', type: 'text', placeholder: 'Wie dürfen wir dich nennen?', max: 30 }], values: S.settings, focus: 'name',
  onSave: async v => { S.settings.name = v.name; await saveSettings(); setTimeout(refreshSheets, 60); }
});
A.editAssumptions = () => formSheet({
  title: 'Annahmen',
  fields: [
    { key: 'returnRate', label: 'Erwartete Rendite pro Jahr', type: 'number', unit: '%', required: true, hint: 'Langfristig breit gestreute Aktien-ETFs: historisch oft 5–7 % p. a., aber ohne Garantie. Tagesgeld: deutlich weniger.' },
    { key: 'inflation', label: 'Inflation pro Jahr', type: 'number', unit: '%', required: true, hint: 'Das Inflationsziel der EZB liegt bei 2 %.' }
  ],
  values: S.settings,
  onSave: async v => { S.settings.returnRate = clamp(v.returnRate, -20, 30); S.settings.inflation = clamp(v.inflation, -5, 20); S.settings.sim = null; await saveSettings(); setTimeout(refreshSheets, 60); }
});
A.editBackupDays = () => formSheet({
  title: 'Sicherungs-Erinnerung',
  fields: [{ key: 'backupDays', label: 'Erinnere mich an ein Backup alle', type: 'select', options: [7, 14, 30, 60].map(n => ({ v: n, l: `${n} Tage` })) }],
  values: S.settings,
  onSave: async v => { S.settings.backupDays = +v.backupDays; await saveSettings(); setTimeout(refreshSheets, 60); }
});
A.editCategories = () => formSheet({
  title: 'Kategorien',
  fields: [
    { key: 'info', type: 'info', html: '<p class="small muted">Eine Kategorie pro Zeile. Bestehende Buchungen behalten ihre Kategorie.</p>' },
    { key: 'exp', label: 'Ausgaben', type: 'textarea', rows: 10, group: true },
    { key: 'inc', label: 'Einnahmen', type: 'textarea', rows: 6, group: true }
  ],
  values: { exp: S.settings.expenseCats.join('\n'), inc: S.settings.incomeCats.join('\n') },
  onSave: async v => {
    const clean = s => [...new Set(s.split('\n').map(x => x.trim()).filter(Boolean))].slice(0, 60);
    const e = clean(v.exp), i = clean(v.inc);
    if (!e.length || !i.length) { toast('Mindestens eine Kategorie je Art wird benötigt.'); return false; }
    S.settings.expenseCats = e; S.settings.incomeCats = i;
    await saveSettings();
    setTimeout(refreshSheets, 60);
  }
});

/* ---------------- Beispieldaten ---------------- */
function demoData() {
  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const r = (a, b) => round2(a + rnd() * (b - a));
  const t = today(), cm = curMonth();
  const tx = [];
  const addTx = (type, amount, category, note, date) => { if (date <= t) tx.push({ id: uid(), type, amount: round2(amount), category, note, date, createdAt: Date.now() }); };
  for (let i = 5; i >= 0; i--) {
    const k = addMonthKey(cm, -i), d = n => `${k}-${pad(Math.min(n, daysInMonth(+k.slice(0, 4), +k.slice(5) - 1)))}`;
    addTx('income', 3250, 'Gehalt', 'Gehalt', d(1));
    if (i % 2 === 0) addTx('income', r(180, 420), 'Nebeneinkommen', 'Freelance-Projekt', d(15));
    addTx('expense', 980, 'Wohnen', 'Warmmiete', d(1));
    addTx('expense', 58, 'Mobilität', 'Deutschlandticket', d(2));
    addTx('expense', 89, 'Versicherungen', 'Haftpflicht & Hausrat', d(3));
    addTx('expense', 52.88, 'Abonnements', 'Streaming & Apps', d(5));
    addTx('expense', 29.9, 'Freizeit', 'Fitnessstudio', d(4));
    addTx('expense', 249, 'Kredite & Raten', 'Autokredit', d(10));
    for (let w = 0; w < 4; w++) {
      addTx('expense', r(55, 115), 'Lebensmittel', ['Rewe', 'Edeka', 'Aldi', 'Lidl'][w], d(3 + w * 7));
      addTx('expense', r(18, 70), 'Restaurant & Café', ['Pizzeria', 'Café', 'Sushi', 'Lieferdienst'][w], d(5 + w * 7));
    }
    addTx('expense', r(40, 160), 'Kleidung', 'Online-Shop', d(12));
    addTx('expense', r(30, 120), 'Freizeit', 'Kino & Ausflüge', d(18));
    addTx('expense', r(15, 60), 'Haushalt', 'Drogerie', d(9));
    addTx('expense', r(20, 70), 'Mobilität', 'Tanken', d(20));
    if (i === 2) addTx('expense', 640, 'Reisen', 'Wochenendtrip Hamburg', d(22));
    if (i === 1) addTx('expense', 329, 'Technik', 'Kopfhörer', d(17));
  }
  const acc = [
    { id: uid(), name: 'Girokonto', type: 'giro', balance: 2340, updatedAt: t },
    { id: uid(), name: 'Tagesgeld', type: 'savings', balance: 6500, interest: 2.5, updatedAt: t },
    { id: uid(), name: 'ETF-Depot', type: 'invest', balance: 14820, updatedAt: t },
    { id: uid(), name: 'Autokredit', type: 'debt', balance: 7600, interest: 6.9, updatedAt: t }
  ];
  const snaps = [];
  for (let i = 6; i >= 1; i--) {
    const net = 13200 + (6 - i) * 520 + r(-300, 300);
    snaps.push({ id: addMonthKey(cm, -i), date: addMonthKey(cm, -i) + '-28', assets: net + 7600 + i * 250, debts: 7600 + i * 250, net: round2(net) });
  }
  const s = acc.reduce((a, x) => a + (x.type === 'debt' ? -x.balance : x.balance), 0);
  snaps.push({ id: cm, date: t, assets: 23660, debts: 7600, net: s });
  const nd = n => addMonths(t, 0).slice(0, 8) + pad(n);
  const future = n => { const d = nd(n); return d > t ? d : addMonths(d, 1); };
  const subs = [
    { name: 'Netflix', amount: 13.99, cycle: 'monthly', category: 'Streaming (Video)', rating: 3 },
    { name: 'Disney+', amount: 9.99, cycle: 'monthly', category: 'Streaming (Video)', rating: 2 },
    { name: 'Spotify', amount: 10.99, cycle: 'monthly', category: 'Musik & Audio', rating: 5 },
    { name: 'iCloud+', amount: 2.99, cycle: 'monthly', category: 'Cloud-Speicher', rating: 4 },
    { name: 'Fitnessstudio', amount: 29.9, cycle: 'monthly', category: 'Fitness & Sport', rating: 2, cancelBy: addDays(t, 9) },
    { name: 'Amazon Prime', amount: 89.9, cycle: 'yearly', category: 'Lieferdienste & Shopping', rating: 3 },
    { name: 'Zeitungs-Abo', amount: 14.99, cycle: 'monthly', category: 'Nachrichten & Magazine', rating: 1 }
  ].map((x, i) => ({ id: uid(), autoBook: false, active: true, note: '', cancelBy: '', ...x, nextDate: x.cycle === 'yearly' ? addDays(t, 11) : future(3 + i * 3), anchor: 3 + i * 3 }));
  const created = addMonths(t, -2);
  const goals = [
    { id: uid(), title: 'Notgroschen 10.000 €', area: 'finanzen', kind: 'number', unit: '€', start: 3000, target: 10000, current: 6500, deadline: addMonths(t, 5), why: 'Sicherheit und ruhiger Schlaf, falls etwas Unerwartetes passiert.', linkedAccount: acc[1].id, milestones: [], status: 'active', createdAt: addMonths(t, -4), history: [] },
    { id: uid(), title: '12 Bücher in diesem Jahr lesen', area: 'wachstum', kind: 'number', unit: 'Bücher', start: 0, target: 12, current: 7, deadline: `${t.slice(0, 4)}-12-31`, why: 'Ich will jeden Monat etwas Neues lernen.', linkedAccount: '', milestones: [], status: 'active', createdAt: `${t.slice(0, 4)}-01-01`, history: [{ date: addDays(t, -40), value: 5 }, { date: addDays(t, -10), value: 7 }] },
    { id: uid(), title: 'Halbmarathon laufen', area: 'gesundheit', kind: 'milestones', unit: '', start: 0, target: null, current: null, deadline: addMonths(t, 4), why: '', linkedAccount: '', status: 'active', createdAt: created, history: [], milestones: [
      { id: uid(), title: '5 km am Stück laufen', done: true, doneAt: addDays(t, -40) },
      { id: uid(), title: '10 km unter 60 Minuten', done: true, doneAt: addDays(t, -12) },
      { id: uid(), title: '15 km Trainingslauf', done: false },
      { id: uid(), title: 'Anmeldung zum Wettkampf', done: false },
      { id: uid(), title: 'Halbmarathon finishen 🏅', done: false }] }
  ];
  const mkLog = (p, days, skipWd) => { const log = {}; for (let i = 0; i < days; i++) { const d = addDays(t, -i - 1); if (skipWd != null && pd(d).getDay() === skipWd) continue; if (rnd() < p) log[d] = 1; } return log; };
  const habits = [
    { id: uid(), name: 'Sport (30 Min.)', emoji: '🏃', area: 'gesundheit', target: 3, log: mkLog(0.5, 70), createdAt: addDays(t, -70), archived: false, cue: 'Montag, Mittwoch, Freitag nach der Arbeit' },
    { id: uid(), name: '20 Minuten lesen', emoji: '📚', area: 'wachstum', target: 7, log: mkLog(0.8, 70), createdAt: addDays(t, -70), archived: false, cue: 'Abends im Bett statt Handy' },
    { id: uid(), name: 'Meditation', emoji: '🧘', area: 'geist', target: 5, log: mkLog(0.35, 40), createdAt: addDays(t, -40), archived: false, cue: '' },
    { id: uid(), name: 'Ausgaben eintragen', emoji: '🧾', area: 'finanzen', target: 7, log: mkLog(0.7, 30), createdAt: addDays(t, -30), archived: false, cue: '' }
  ];
  const journal = [];
  for (let i = 0; i < 40; i++) {
    if (rnd() < 0.3) continue;
    const d = addDays(t, -i - 1);
    const sport = habits[0].log[d];
    const mood = clamp(Math.round(2.6 + rnd() * 2 + (sport ? 0.8 : 0)), 1, 5);
    journal.push({ id: uid(), date: d, mood, energy: clamp(Math.round(2 + rnd() * 3), 1, 5), text: ['Produktiver Tag im Büro, abends noch eine Runde gelaufen.', 'Viel Stress mit dem Projekt, aber gutes Gespräch mit Lisa.', 'Ruhiger Tag. Endlich das Buch weitergelesen.', 'Müde, zu wenig geschlafen. Morgen früher ins Bett.', 'Toller Abend mit Freunden beim Italiener.'][i % 5], gratitude: ['Gesundheit', 'Meine Familie', 'Sonnenschein', 'Ein guter Kaffee', 'Freunde'][i % 5], learning: '', tags: ['arbeit', 'freunde', 'sport', 'familie', 'erholung'][i % 5], createdAt: Date.now() - i * 864e5 });
  }
  const tasks = [
    { id: uid(), title: 'Steuererklärung abschicken', due: addDays(t, 3), prio: 'high', important: true, area: 'finanzen', note: '', done: false, createdAt: addDays(t, -5) },
    { id: uid(), title: 'Kfz-Versicherung vergleichen', due: addDays(t, -2), prio: 'normal', important: false, area: 'finanzen', note: '', done: false, createdAt: addDays(t, -9) },
    { id: uid(), title: 'Mama anrufen', due: t, prio: 'normal', important: true, area: 'beziehungen', note: '', done: false, createdAt: addDays(t, -1) },
    { id: uid(), title: 'Laufschuhe kaufen', due: '', prio: 'low', important: false, area: 'gesundheit', note: '', done: false, createdAt: addDays(t, -3) },
    { id: uid(), title: 'Arzttermin vereinbaren', due: '', prio: 'normal', important: false, area: 'gesundheit', note: '', done: true, doneAt: addDays(t, -1), createdAt: addDays(t, -6) }
  ];
  const focus = Array.from({ length: 9 }, (_, i) => ({ id: uid(), date: addDays(t, -i * 2), minutes: [25, 50, 25][i % 3] }));
  const decisions = [{
    id: uid(), title: 'Neues Auto kaufen oder das alte behalten?', context: 'Mein Auto ist 11 Jahre alt, die nächste Inspektion wird teuer.', importance: 4, reversible: false, tenten: '', status: 'open', createdAt: addDays(t, -3),
    options: [
      { id: uid(), name: 'Neues Auto kaufen', gut: 4, pros: [{ t: 'Zuverlässiger', w: 4 }, { t: 'Weniger Verbrauch', w: 2 }, { t: 'Mehr Sicherheit', w: 3 }], cons: [{ t: 'Hohe Kosten / neuer Kredit', w: 5 }, { t: 'Wertverlust', w: 3 }] },
      { id: uid(), name: 'Altes Auto behalten', gut: 3, pros: [{ t: 'Keine neuen Schulden', w: 5 }, { t: 'Notgroschen wächst schneller', w: 4 }], cons: [{ t: 'Reparaturrisiko', w: 3 }, { t: 'Höherer Verbrauch', w: 2 }] }
    ]
  }];
  const checkins = [{ id: addMonthKey(cm, -1), date: addDays(t, -30), scores: { finanzen: 6, gesundheit: 5, karriere: 7, beziehungen: 8, geist: 5, wachstum: 6, freizeit: 4, umfeld: 7 }, note: 'Mehr Sport und weniger Bildschirmzeit.' }];
  const recurring = [
    { id: uid(), type: 'income', amount: 3250, category: 'Gehalt', note: 'Gehalt', cycle: 'monthly', anchor: 1, nextDate: addMonthKey(cm, 1) + '-01', active: true },
    { id: uid(), type: 'expense', amount: 980, category: 'Wohnen', note: 'Warmmiete', cycle: 'monthly', anchor: 1, nextDate: addMonthKey(cm, 1) + '-01', active: true }
  ];
  return { transactions: tx, accounts: acc, snapshots: snaps, subscriptions: subs, goals, habits, journal, tasks, focus, decisions, checkins, recurring };
}
A.loadDemo = async () => {
  const d = demoData();
  await DB.replaceAll({ ...d, meta: [{ ...S.settings, onboarded: true, demo: true, budgets: { 'Restaurant & Café': 150, 'Kleidung': 80 } }] });
  await loadAll();
  closeAllSheets();
  UI.tab = 'heute';
  render(true);
  toast('Beispieldaten geladen 🧪');
};

/* ---------------- Willkommen ---------------- */
function showOnboarding() {
  const body = `<div class="onb"><img class="onb-logo" src="icon-192.png" alt=""><h1>LIFE OS</h1>
    <p class="lead">Dein persönliches Betriebssystem für Geld, Ziele und ein bewussteres Leben.</p>
    <div class="feat"><span class="f-ico">💶</span><div><b>Finanzen im Griff</b><span>Ausgaben, Vermögen, Abos, Sparpotenzial und Zukunftsprognose.</span></div></div>
    <div class="feat"><span class="f-ico">🎯</span><div><b>Ziele & Gewohnheiten</b><span>Messbarer Fortschritt statt guter Vorsätze.</span></div></div>
    <div class="feat"><span class="f-ico">🧭</span><div><b>Bessere Entscheidungen</b><span>Tagebuch, Entscheidungsanalyse, Berichte und Empfehlungen.</span></div></div>
    <div class="feat"><span class="f-ico">🔒</span><div><b>100 % privat & offline</b><span>Alles bleibt auf deinem Gerät. Keine Konten, keine Tracker.</span></div></div>
    <div class="form" style="margin-top:8px"><div class="fgroup"><div class="field"><label class="flabel" for="obName">Wie heißt du? (optional)</label><input id="obName" class="in" placeholder="Vorname" maxlength="30" autocomplete="given-name"></div></div></div>
    <button class="btn block" data-act="obStart">Los geht's</button>
    <button class="btn gray block" style="margin-top:10px" data-act="obDemo">Erst mit Beispieldaten ausprobieren</button></div>`;
  openSheet({ title: 'Willkommen', body, tall: true, left: '', locked: true });
}
async function finishOnboarding() {
  const n = $('#obName');
  S.settings.name = n ? n.value.trim() : '';
  S.settings.onboarded = true;
  S.settings.createdAt = S.settings.createdAt || today();
  await saveSettings();
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* */ }
}
A.obStart = async () => {
  await finishOnboarding();
  const sh = topSheet(); if (sh) { sh.opts.locked = false; sh.close(); }
  render(true);
  toast('Willkommen bei LIFE OS 👋');
};
A.obDemo = async () => {
  await finishOnboarding();
  const sh = topSheet(); if (sh) { sh.opts.locked = false; sh.close(); }
  await A.loadDemo();
};

/* ---------------- Start ---------------- */
function afterRender() { /* Platzhalter für Erweiterungen */ }
let lastDay = today();
async function onResume() {
  if (today() !== lastDay) {
    lastDay = today();
    if (UI.month > curMonth() || UI.month === addMonthKey(curMonth(), -1)) UI.month = curMonth();
    UI.txMonth = curMonth();
    await processDue();
    if (sheetStack.length === 0) render();
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) onResume().catch(console.error); });

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const notify = w => toast('Neue Version verfügbar', { label: 'Aktualisieren', fn: () => w.postMessage('skipWaiting') });
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(e => console.warn('Service Worker:', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}

async function init() {
  try {
    await DB.open();
    await loadAll();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="page" style="padding-top:20vh"><div class="card"><b>Speicher nicht verfügbar</b><p class="small muted mt">${esc(e.message)}</p><p class="small mt">Tipp: Im privaten Modus deines Browsers kann LIFE OS keine Daten speichern. Öffne die App im normalen Modus.</p></div></div>`;
    return;
  }
  applyTheme();
  try {
    const n = await processDue();
    if (S.accounts.length && !S.snapshots.some(s => s.id === curMonth())) await updateSnapshot();
    render(true);
    if (n) toast(`${n} automatische Buchung${n > 1 ? 'en' : ''} erstellt`);
  } catch (e) { console.error(e); render(true); }
  if (!S.settings.onboarded) showOnboarding();
  registerSW();
}
init();
