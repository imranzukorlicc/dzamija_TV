/* Namaska vremena - glavna skripta
   Podaci: data/config.json, data/namaz.json, data/hadisi.json */
(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const KEYS = ['sabah', 'izlazak', 'podne', 'ikindija', 'aksam', 'jacija'];
const DAYS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
const HMONTHS = ["muharrem", "safer", "rebi'u-l-evvel", "rebi'u-l-ahir", "džumade-l-ula", "džumade-l-uhra", "redžeb", "ša'ban", "ramazan", "ševval", "zu-l-ka'de", "zu-l-hidždže"];

const state = {
  cfg: null, times: null, hadisi: [],
  offsetMs: 0, hIdx: -1, hTimer: null, hSig: '',
  lastDay: '', lastHijriKey: ''
};

/* ---------- Orijentacija / rotacija ---------- */
// Kad je širina veća od visine, cijeli dizajn se automatski okreće za 90°
// i prikazuje se isti raspored kao na telefonu.
const rotParam = new URLSearchParams(location.search).get('rotate');
const FORCE = rotParam === '90' ? 90 : (rotParam === '-90' || rotParam === '270') ? 270 : null;
const root = document.documentElement;

function applyLayout() {
  const land = innerWidth > innerHeight;
  const cfgRot = state.cfg && state.cfg.pejzazRotacija;      // 90, -90 ili 0
  const auto = cfgRot === 0 ? 0 : (cfgRot === -90 || cfgRot === 270) ? 270 : 90;
  const rot = FORCE !== null ? FORCE : (land ? auto : 0);

  root.classList.toggle('rot', !!rot);
  root.classList.toggle('rot90', rot === 90);
  root.classList.toggle('rot270', rot === 270);
  root.classList.remove('landscape');
  root.classList.add('portrait');
  fitHadith();
}
addEventListener('resize', applyLayout);

/* ---------- Učitavanje podataka ---------- */
async function getJSON(path) {
  const r = await fetch(path + '?v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
  return r.json();
}

async function loadNamaz(year) {
  // prvo data/namaz-GODINA.json, a ako ga nema - data/namaz.json
  try { return await getJSON('data/namaz-' + year + '.json'); }
  catch (_) { return getJSON('data/namaz.json'); }
}

async function loadAll(first) {
  try {
    const [cfg, had] = await Promise.all([getJSON('data/config.json'), getJSON('data/hadisi.json')]);
    state.cfg = cfg;
    applyLayout();
    const year = getNow().y;
    const namaz = await loadNamaz(year);
    state.dataYear = year;
    state.times = namaz.vremena || namaz;
    state.hadisi = (had.hadisi || had || []).filter(h => h && h.tekst);
    $('notice').hidden = true;
    $('mosqueName').textContent = cfg.naziv || '';
    buildRows();
    buildDots();
    if (first) startHadisi();
    tick();
  } catch (e) {
    console.error(e);
    if (first) {
      const n = $('notice');
      n.hidden = false;
      n.innerHTML = '<div><b>Podaci se ne mogu učitati.</b></div>' +
        '<div>Stranicu otvorite preko web servera, a ne dvoklikom na fajl.<br>' +
        'Windows: pokrenite <code>start-server.bat</code> pa otvorite <code>http://localhost:8080</code></div>' +
        '<div style="opacity:.7;font-size:.8em">' + String(e.message) + '</div>';
    }
  }
}

/* ---------- Tačno vrijeme (sinhronizacija sa interneta) ---------- */
function parseIso(s) { return Date.parse(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(/(\.\d{3})\d+/, '$1') + 'Z'); }

const TIME_SOURCES = [
  async () => { const j = await (await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', { cache: 'no-store' })).json(); return Date.parse(j.utc_datetime); },
  async () => { const j = await (await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC', { cache: 'no-store' })).json(); return parseIso(j.dateTime); },
  async () => { const r = await fetch(location.href.split('#')[0], { method: 'HEAD', cache: 'no-store' }); const d = r.headers.get('date'); if (!d) throw 0; return Date.parse(d) + 500; }
];

async function syncTime() {
  for (const src of TIME_SOURCES) {
    try {
      const t0 = Date.now();
      const server = await Promise.race([src(), new Promise((_, rej) => setTimeout(rej, 6000))]);
      const t1 = Date.now();
      if (!isFinite(server)) continue;
      state.offsetMs = server - (t0 + t1) / 2;
      console.log('Vrijeme usklađeno, razlika (ms):', Math.round(state.offsetMs));
      return;
    } catch (_) { /* sljedeći izvor */ }
  }
  console.warn('Sinhronizacija nije uspjela, koristi se sat uređaja.');
}

/* ---------- Datum i vrijeme u zadatoj zoni ---------- */
let fmt = null;
function getNow() {
  const tz = (state.cfg && state.cfg.vremenskaZona) || 'Europe/Belgrade';
  if (!fmt || fmt.tz !== tz) {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmt.tz = tz;
  }
  const p = {};
  fmt.formatToParts(new Date(Date.now() + state.offsetMs)).forEach(x => { p[x.type] = x.value; });
  const o = { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
  o.sec = o.h * 3600 + o.mi * 60 + o.s;
  o.wd = new Date(Date.UTC(o.y, o.mo - 1, o.d)).getUTCDay();
  return o;
}

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (mo, d) => pad(mo) + '-' + pad(d);

/* ---------- Hidžretski datum ---------- */
function hijriFallback(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const jd = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hm = Math.floor((24 * l) / 709);
  return { d: l - Math.floor((709 * hm) / 24), m: hm, y: 30 * n + j - 30 };
}

function hijri(y, mo, d, shift) {
  const dt = new Date(Date.UTC(y, mo - 1, d + shift, 12));
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(dt);
    const g = (t) => +(parts.find(x => x.type === t) || {}).value;
    const r = { d: g('day'), m: g('month'), y: g('year') };
    if (r.y > 1300 && r.y < 1700 && r.m >= 1 && r.m <= 12 && r.d >= 1) return r;
  } catch (_) { /* fallback */ }
  return hijriFallback(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const arDigits = (s) => String(s).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[+c]);

/* ---------- Redovi sa vremenima ---------- */
function buildRows() {
  const box = $('times');
  box.innerHTML = '';
  KEYS.forEach(k => {
    const r = document.createElement('div');
    r.className = 'row'; r.dataset.key = k;
    r.innerHTML = '<span class="name"></span><span class="time">--:--</span>';
    r.querySelector('.name').textContent = (state.cfg.oznake && state.cfg.oznake[k]) || k.toUpperCase();
    box.appendChild(r);
  });
  state.lastDay = '';
}

function timesFor(mo, d) {
  const t = state.times[keyOf(mo, d)] || (mo === 2 && d === 29 ? state.times['02-28'] : null);
  return t || null;
}
const toSec = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 3600 + m * 60; };

/* ---------- Glavni otkucaj (svake sekunde) ---------- */
function tick() {
  if (!state.cfg || !state.times) return;
  const n = getNow();
  if (state.dataYear && n.y !== state.dataYear) { state.dataYear = n.y; loadAll(false); }
  $('clock').textContent = pad(n.h) + ':' + pad(n.mi) + ':' + pad(n.s);

  const dayKey = n.y + '-' + keyOf(n.mo, n.d);
  if (dayKey !== state.lastDay) {
    state.lastDay = dayKey;
    const hj = hijri(n.y, n.mo, n.d, state.cfg.hidzretPomak || 0);
    $('dateBar').textContent = DAYS[n.wd] + ': ' + n.d + '. ' + MONTHS[n.mo - 1] + ' ' + n.y + ' / ' + hj.d + '. ' + HMONTHS[hj.m - 1] + ' ' + hj.y + '.';
    $('yearLine').textContent = n.y + ' / ' + arDigits(hj.y);
    const t = timesFor(n.mo, n.d);
    document.querySelectorAll('.row').forEach(r => { r.querySelector('.time').textContent = t ? t[r.dataset.key] : '--:--'; });
  }

  // sljedeći namaz
  const today = timesFor(n.mo, n.d);
  let nextKey = null, remain = 0;
  if (today) {
    for (const k of KEYS) {
      const s = toSec(today[k]);
      if (s > n.sec) { nextKey = k; remain = s - n.sec; break; }
    }
    if (!nextKey) {
      const tm = new Date(Date.UTC(n.y, n.mo - 1, n.d + 1));
      const tt = timesFor(tm.getUTCMonth() + 1, tm.getUTCDate());
      if (tt) { nextKey = 'sabah'; remain = 86400 - n.sec + toSec(tt.sabah); }
    }
  }
  document.querySelectorAll('.row').forEach(r => r.classList.toggle('is-next', r.dataset.key === nextKey));
  if (nextKey) {
    const nm = (state.cfg.sljedeciNamaz && state.cfg.sljedeciNamaz[nextKey]) || nextKey;
    const h = Math.floor(remain / 3600), m = Math.floor(remain % 3600 / 60), s = remain % 60;
    $('next').innerHTML = 'Sljedeći namaz: ' + nm + ': <b>' + pad(h) + ':' + pad(m) + ':' + pad(s) + '</b>';
  } else {
    $('next').textContent = 'Vremena za današnji dan nisu unesena';
  }
}



// /* ---------- Hadisi ---------- */
function buildDots() {
  const d = $('hDots');
  d.innerHTML = '';
  state.hadisi.forEach(() => d.appendChild(document.createElement('span')));
}

function fitHadith() {
  const body = $('hBody');
  if (!body) return;
  body.style.fontSize = '';
  let size = parseFloat(getComputedStyle(body).fontSize);
  const min = size * 0.4;
  let guard = 60;
  while (body.scrollHeight > body.clientHeight + 1 && size > min && guard--) {
    size *= 0.96;
    body.style.fontSize = size + 'px';
  }
}

function showHadis(i) {
  const h = state.hadisi[i];
  if (!h) return;
  $('hAr').textContent = h.arapski || '';
  $('hText').textContent = h.tekst || '';
  const bits = [];
  if (h.prenosilac) bits.push('Prenosi: ' + h.prenosilac);
  const src = h.izvor ? '<small>Bilježi: ' + esc(h.izvor) + '</small>' : '';
  $('hSrc').innerHTML = (bits.length ? esc(bits[0]) : '') + src;
  const img = $('hImg'), tag = $('hImgTag');
  if (h.slika) {
    tag.onerror = () => { img.hidden = true; fitHadith(); };
    tag.onload = () => { fitHadith(); };
    tag.src = h.slika;
    img.hidden = false;
  } else { tag.removeAttribute('src'); img.hidden = true; }
  document.querySelectorAll('#hDots span').forEach((s, k) => s.classList.toggle('on', k === i));
  requestAnimationFrame(fitHadith);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function nextHadis() {
  if (!state.hadisi.length) return;
  const slide = $('hSlide');
  slide.classList.add('out');
  setTimeout(() => {
    state.hIdx = (state.hIdx + 1) % state.hadisi.length;
    showHadis(state.hIdx);
    slide.classList.remove('out');
  }, 800);
}

// function startHadisi() {
//   clearInterval(state.hTimer);
//   if (!state.hadisi.length) return;
//   state.hIdx = 0;
//   showHadis(0);
//   const sec = Math.max(5, (state.cfg.hadisSekundi || 20));
//   state.hTimer = setInterval(nextHadis, sec * 1000);
// }


/* ---------- ZA SLIKU ---------- */
function startHadisi() {
  // Statična slika umjesto smjene hadisa: data/slika.jpg
  clearInterval(state.hTimer);
  const frame = document.querySelector('.h-frame');
  if (!frame) return;

  // sakrij naslov, hadis i tačkice (ne brišemo ih, samo skrivamo)
  Array.from(frame.children).forEach(el => {
    if (el.id !== 'staticSlika') el.style.display = 'none';
  });

  let img = document.getElementById('staticSlika');
  if (!img) {
    img = document.createElement('img');
    img.id = 'staticSlika';
    img.alt = '';
    img.style.cssText = 'flex:1 1 0;min-height:0;width:100%;height:100%;object-fit:cover;display:block;';
    frame.appendChild(img);
  }
  // ?v=... da se nova slika pokupi čim je zamijenite
  img.src = 'data/slika.jpg?v=' + Date.now();
}


/* ---------- Pokretanje ---------- */
const logo = $('logo');
logo.onerror = () => { logo.style.display = 'none'; };

applyLayout();
loadAll(true).then(() => {
  syncTime().then(tick);
  setInterval(tick, 1000);
  setInterval(syncTime, Math.max(5, (state.cfg && state.cfg.sinhronizacijaMinuta) || 30) * 60 * 1000);
  // ponovno učitavanje JSON fajlova svakih sat vremena (izmjene se same pokupe)
  setInterval(() => loadAll(false).then(() => { if (state.hIdx < 0 || state.hIdx >= state.hadisi.length) startHadisi(); }), 3600 * 1000);
});
})();
