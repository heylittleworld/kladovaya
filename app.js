/* Кладовая — приложение. Данные хранятся на телефоне (IndexedDB) и, если войти, синхронизируются через Supabase. */
"use strict";
(function () {

/* ---------- утилиты ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));
function today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function diffDays(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); }
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS1 = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WDF = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
function fmtD(iso) { const d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MONTHS[d.getMonth()]; }
function wdIdx(iso) { return (new Date(iso + "T12:00:00").getDay() + 6) % 7; }
function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? b : c; }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function avgNums(s) { const m = String(s || "").match(/\d+/g); if (!m) return 0; const n = m.map(Number).filter((x) => x > 20); if (!n.length) return 0; return Math.round(n.reduce((a, b) => a + b, 0) / n.length); }
function nowHM() { const d = new Date(); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); }
function mealByTime() { const h = new Date().getHours(); return h < 11 ? "b" : h < 16 ? "l" : h < 22 ? "d" : "s"; }

const ICON = {
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  plusS: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6A5646" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A7A69" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  timer: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
  camera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A7A69" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  storage: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 5v2M9 13v3"/></svg>',
  builder: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3"/></svg>',
  recipes: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
  diary: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3M8 17h6"/></svg>',
  shop: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.6 12h11.2L21 7H6"/></svg>'
};

/* ---------- состояние ---------- */
let S = null;
let ready = false;
const ui = {
  view: "storage", place: "fridge", storageZones: {}, onlySoon: false, exp: {}, sheet: null, scrolls: {},
  b: { mode: "stock", items: [], oil: 5, open: null, allHints: false },
  r: { filter: "all", q: "", open: null },
  dy: { date: today(), open: null },
  sh: { hideOpt: false, draft: "" }
};
function freshState() { return { v: 1, zones: clone(DEFAULT_ZONES), prods: [], recs: clone(SEED_RECIPES), diary: [], shop: [], udict: [] }; }

/* ---------- хранилище на телефоне ---------- */
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open("kladovaya", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
function idbGet(k) { return db().then((d) => new Promise((res, rej) => { const q = d.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })).catch(() => { try { return JSON.parse(localStorage.getItem("kl:" + k)); } catch (e) { return null; } }); }
function idbPut(k, v) { return db().then((d) => new Promise((res, rej) => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); })).catch(() => { try { localStorage.setItem("kl:" + k, JSON.stringify(v)); } catch (e) {} }); }
function commit(noRender) { S.updated = Date.now(); idbPut("state", S); scheduleSync(1500); if (!noRender) render(); }

/* ---------- справочник и продукты ---------- */
const STL = { fresh: "Свежее", soon: "2–3 дня", urgent: "Сегодня-завтра", unknown: "Срок не указан", no: "Нет дома" };
const zonesOf = (place) => S.zones.filter((z) => z.place === place).sort((a, b) => a.o - b.o);
const zoneById = (id) => S.zones.find((z) => z.id === id) || S.zones[0];
function zoneLabel(z) { if (!z) return ""; if (z.place === "pantry") return z.title; const pl = PLACES.find((p) => p.id === z.place); return pl.name + " · " + z.title.toLowerCase(); }
const prodById = (id) => S.prods.find((p) => p.id === id);
function pStatus(p) { if (!p.exp) return "unknown"; const d = diffDays(today(), p.exp); return d <= 1 ? "urgent" : d <= 3 ? "soon" : "fresh"; }
function expLabel(p) {
  if (!p.exp) return "не указан";
  const d = diffDays(today(), p.exp);
  if (d < 0) return "просрочено на " + -d + " " + plural(-d, "день", "дня", "дней");
  if (d === 0) return "сегодня"; if (d === 1) return "завтра";
  return "до " + fmtD(p.exp) + " · " + d + " " + plural(d, "день", "дня", "дней");
}
function isEmptyP(p) { return p.t === "count" ? (p.have || 0) <= 0 : p.t !== "can" && (p.l || 0) <= 0.02; }
function fmtQ(v, u) { v = Math.max(0, v || 0); if (v >= 1000 && (u === "г" || u === "мл")) return String(Math.round(v / 100) / 10).replace(".", ",") + (u === "г" ? " кг" : " л"); return Math.round(v) + " " + (u || "г"); }
function leftText(p) {
  const n = p.packs || 1;
  if (p.t === "count") return (p.have || 0) + " из " + (p.max || 0);
  if (p.t === "can") return n > 1 ? n + " " + plural(n, "банка", "банки", "банок") : "есть";
  let s = p.pk ? "≈ " + fmtQ((p.l || 0) * p.pk, p.u) + " из " + fmtQ(p.pk, p.u) : "≈ " + Math.round((p.l || 0) * 100) + "%";
  if (n > 1) s += " · ещё " + (n - 1) + " уп.";
  return s;
}
function isLow(p) { return p.t === "count" ? p.max > 1 && p.have / p.max <= 0.34 : p.t !== "can" && p.l <= 0.35; }
function matchesDict(p, id) { return p.d === id || (DICT[p.d] && DICT[p.d].ref === id); }
const STOPW = { "консе": 1, "свежи": 1, "замор": 1, "варен": 1, "очище": 1, "порци": 1, "готов": 1, "домаш": 1, "плотн": 1, "больш": 1, "мелки": 1, "крупн": 1, "сушен": 1, "кусоч": 1, "упако": 1, "пачка": 1, "банка": 1 };
function stems(s) { return String(s || "").toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5)).filter((w) => !STOPW[w]); }
function nameMatch(a, b) { const A = stems(a), B = stems(b); return A.length > 0 && A.some((x) => B.indexOf(x) >= 0); }
function hasProd(p, id) { const d = DICT[id]; return matchesDict(p, id) || (!p.d && d && nameMatch(p.name, d.n + " " + (d.syn || ""))); }
function ingStatus(i) {
  if (i.d && DICT[i.d]) { if (STAPLES[i.d]) return null; const st = stockOf(i.d); if (st !== "no") return st; }
  const p = S.prods.find((x) => !isEmptyP(x) && nameMatch(x.name, i.n));
  if (p) return pStatus(p) === "unknown" ? "yes" : pStatus(p);
  return i.d && DICT[i.d] && !i.opt ? "no" : null;
}
function stockOf(id) {
  const d = DICT[id]; if (!d) return "no";
  if (d.virtual) return d.needs.every((n) => stockOf(n) !== "no") ? "yes" : "no";
  const ps = S.prods.filter((p) => hasProd(p, id) && !isEmptyP(p));
  if (!ps.length) return "no";
  if (ps.some((p) => pStatus(p) === "urgent")) return "urgent";
  if (ps.some((p) => pStatus(p) === "soon")) return "soon";
  return "yes";
}
function prodFor(id) { return S.prods.filter((p) => hasProd(p, id) && !isEmptyP(p)).sort((a, b) => (a.exp || "9999") < (b.exp || "9999") ? -1 : 1)[0]; }
function learned(key) { return S.udict.find((u) => u.id === key); }
function dictDefaults(d) {
  const u = learned("ud:" + d.id) || {};
  return { t: u.t || d.t, z: u.z || d.z || "f1", c: d.c, cell: d.cell, n0: d.n0 || 1, s: d.s };
}
function makeProd(o) {
  const p = { id: uid(), name: o.name, d: o.d || null, t: o.t, c: o.c || "#C9B79A", cell: o.cell || "round", zone: o.zone, l: o.l == null ? 1 : o.l, have: o.have, max: o.max, exp: o.exp || null, added: today(), packs: Math.max(1, Math.round(o.packs || 1)), pk: o.pk || null, u: o.u || "г" };
  if (p.t === "count") { p.have = o.have == null ? 1 : o.have; p.max = Math.max(p.have, o.max || p.have); }
  return p;
}

/* ---------- рисунки тары ---------- */
const LN = "#4A4038";
function viz(t, c, l, have, max, cell, px) {
  if (t === "count") return countViz(c, have, max, cell, px > 60);
  l = l == null ? 0.5 : Math.max(0, Math.min(1, l));
  const R = { jar: [14, 51], bottle: [15, 51], carton: [19, 51], pot: [21, 48], tub: [19, 49], bag: [24, 47] };
  const r = R[t] || [14, 51], fh = Math.round((r[1] - r[0]) * l), fy = r[1] - fh, bw = Math.max(4, Math.round(46 * l));
  const s = 'stroke="' + LN + '" stroke-width="1.6"';
  const o = '<svg width="' + px + '" height="' + px + '" viewBox="0 0 56 56" aria-hidden="true">';
  switch (t) {
    case "bottle": return o + '<rect x="14" y="14" width="28" height="38" rx="8" fill="#fff" fill-opacity=".85"/><rect x="15" y="' + fy + '" width="26" height="' + fh + '" rx="6" fill="' + c + '"/><rect x="14" y="14" width="28" height="38" rx="8" fill="none" ' + s + '/><rect x="22" y="6" width="12" height="9" fill="#fff" ' + s + '/><rect x="21" y="2" width="14" height="6" rx="2" fill="#E99A6A" ' + s + '/><path d="M19 20v12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/></svg>';
    case "carton": return o + '<path d="M14 18 L28 7 L42 18 Z" fill="#F3D58A" ' + s + ' stroke-linejoin="round"/><rect x="14" y="18" width="28" height="34" rx="2" fill="#fff"/><rect x="15" y="' + fy + '" width="26" height="' + fh + '" fill="' + c + '"/><rect x="14" y="18" width="28" height="34" rx="2" fill="none" ' + s + '/><rect x="30" y="8" width="7" height="5" rx="1" fill="#E99A6A" stroke="' + LN + '" stroke-width="1.3"/></svg>';
    case "pot": return o + '<rect x="2" y="25" width="8" height="6" rx="2" fill="#B9C3C8" ' + s + '/><rect x="46" y="25" width="8" height="6" rx="2" fill="#B9C3C8" ' + s + '/><rect x="8" y="20" width="40" height="29" rx="7" fill="#DDE5E8"/><rect x="9" y="' + fy + '" width="38" height="' + fh + '" rx="5" fill="' + c + '"/><rect x="8" y="20" width="40" height="29" rx="7" fill="none" ' + s + '/><path d="M6 17h44" stroke="' + LN + '" stroke-width="2" stroke-linecap="round"/><rect x="25" y="10" width="6" height="6" rx="2" fill="#B9C3C8" ' + s + '/></svg>';
    case "tub": return o + '<rect x="7" y="18" width="42" height="32" rx="10" fill="#fff" fill-opacity=".9"/><rect x="8" y="' + fy + '" width="40" height="' + fh + '" rx="8" fill="' + c + '"/><rect x="7" y="18" width="42" height="32" rx="10" fill="none" ' + s + '/><rect x="5" y="12" width="46" height="7" rx="3" fill="#A9D3E6" ' + s + '/></svg>';
    case "bag": return o + '<path d="M11 17 H45 L47 52 H9 Z" fill="#E9D2A8" ' + s + ' stroke-linejoin="round"/><rect x="12" y="9" width="32" height="9" rx="1.5" fill="#D6B67F" ' + s + '/><path d="M18 10v7M23 10v7M28 10v7M33 10v7M38 10v7" stroke="' + LN + '" stroke-width="1" opacity=".35"/><rect x="17" y="24" width="22" height="23" rx="4" fill="#fff"/><rect x="17" y="' + fy + '" width="22" height="' + fh + '" rx="3" fill="' + c + '"/><rect x="17" y="24" width="22" height="23" rx="4" fill="none" stroke="' + LN + '" stroke-width="1.3"/></svg>';
    case "block": return o + '<rect x="5" y="20" width="46" height="22" rx="4" fill="none" stroke="' + LN + '" stroke-width="1.3" stroke-dasharray="3 3" opacity=".45"/><rect x="5" y="20" width="' + bw + '" height="22" rx="4" fill="' + c + '" ' + s + '/><path d="M10 26h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></svg>';
    case "can": return o + '<rect x="13" y="11" width="30" height="40" rx="4" fill="' + c + '" ' + s + '/><rect x="14" y="23" width="28" height="15" fill="#fff" fill-opacity=".75"/><path d="M13 23h30M13 38h30" stroke="' + LN + '" stroke-width="1.3"/><path d="M13 16h30" stroke="' + LN + '" stroke-width="1.3" opacity=".6"/></svg>';
    default: return o + '<rect x="12" y="13" width="32" height="39" rx="6" fill="#fff" fill-opacity=".85"/><rect x="13" y="' + fy + '" width="30" height="' + fh + '" rx="4" fill="' + c + '"/><rect x="12" y="13" width="32" height="39" rx="6" fill="none" ' + s + '/><rect x="14" y="6" width="28" height="8" rx="2.5" fill="#C9A372" ' + s + '/><path d="M17 19v12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/></svg>';
  }
}
function countViz(c, have, max, cell, big) {
  const shapes = { egg: "width:11px;height:14px;border-radius:50% 50% 46% 46%/60% 60% 40% 40%", round: "width:14px;height:14px;border-radius:50%", stick: "width:9px;height:26px;border-radius:5px", tub: "width:15px;height:14px;border-radius:4px" };
  const sh = shapes[cell] || shapes.round;
  max = Math.max(1, Math.min(max || 1, 12)); have = Math.max(0, Math.min(have == null ? max : have, max));
  let h = '<span style="width:52px;height:52px;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:3px' + (big ? ";zoom:2" : "") + '">';
  for (let i = 0; i < max; i++) { const on = i < have; h += '<span style="' + sh + ";box-sizing:border-box;border:1.5px " + (on ? "solid" : "dashed") + " " + LN + ";background:" + (on ? c : "transparent") + ";opacity:" + (on ? 1 : 0.4) + '"></span>'; }
  return h + "</span>";
}
function pViz(p, px) { return viz(p.t, p.c, p.l, p.have, p.max, p.cell, px); }
function tileHTML(p, o) {
  o = o || {};
  const st = pStatus(p);
  return '<button class="tile' + (o.dim ? " dim" : "") + (o.sel ? " sel" : "") + '" data-a="' + (o.act || "prod") + '" data-id="' + esc(o.id || p.id) + '" aria-label="' + esc(p.name + ", " + (o.aria || STL[st])) + '">' +
    '<span style="width:52px;height:52px;display:flex;align-items:center;justify-content:center">' + pViz(p, 52) + "</span>" +
    '<span class="nm">' + esc(p.name) + "</span>" + ((p.packs || 1) > 1 && p.t !== "count" ? '<span class="pkb">×' + p.packs + "</span>" : "") + (o.noDot ? "" : '<span class="tdot st-' + st + '"></span>') + "</button>";
}
function plateBG(cols, size) {
  cols = cols.length ? cols : ["#F1E8DC"];
  const step = 360 / cols.length;
  const inner = Math.round(size * 0.22);
  return "width:" + size + "px;height:" + size + "px;background:radial-gradient(circle,#fff 0 " + inner + "px,transparent " + (inner + 1) + "px),conic-gradient(" + cols.map((c, k) => c + " " + Math.round(k * step) + "deg " + Math.round((k + 1) * step) + "deg").join(",") + ")";
}

/* ---------- общий вид ---------- */
const PILLS = ["#F6E3B0", "#D6EAF3", "#F5DCE3", "#DDEDD3", "#F6DFC8", "#E5DFF3", "#F4E8C4"];
const pill = (i, t) => '<span class="pill" style="background:' + PILLS[i % PILLS.length] + '">' + esc(t) + "</span>";
function cloudBtn() {
  if (!syncConfigured()) return "";
  const cls = syncState === "ok" ? " ok" : syncState === "error" ? " err" : "";
  const t = !SYN.uid ? "Вход" : syncState === "busy" ? "…" : syncState === "ok" ? "✓" : syncState === "offline" ? "офлайн" : syncState === "error" ? "!" : "";
  return '<button class="cloud' + cls + '" data-a="go" data-v="settings" aria-label="Синхронизация и настройки">☁︎ ' + t + "</button>";
}
function hdr(sub, title, right) { return '<div class="hdr"><div><p class="sub">' + sub + "</p><h1>" + title + '</h1></div><div class="hbtns">' + cloudBtn() + (right || "") + "</div></div>"; }
function navHTML() {
  const items = [["storage", "Хранение"], ["builder", "Собрать"], ["recipes", "Рецепты"], ["diary", "Дневник"], ["shop", "Закупки"]];
  const nShop = S.shop.filter((x) => !x.done).length;
  return '<nav class="nav" aria-label="Разделы">' + items.map((i) => '<button class="' + (ui.view === i[0] ? "on" : "") + '" data-a="go" data-v="' + i[0] + '"' + (ui.view === i[0] ? ' aria-current="page"' : "") + "><span>" + ICON[i[0]] + "</span>" + i[1] + (i[0] === "shop" && nShop ? " · " + nShop : "") + "</button>").join("") + "</nav>";
}
function toast(msg) { const t = $("#toast"); t.innerHTML = '<div class="toast" role="status">' + esc(msg) + "</div>"; clearTimeout(toast.t); toast.t = setTimeout(() => { t.innerHTML = ""; }, 3800); }

/* ==================== ХРАНЕНИЕ ==================== */
function vStorage() {
  const place = ui.place;
  let h = hdr(cap(WDF[wdIdx(today())]) + ", " + fmtD(today()), "Хранение", '<button class="ibtn acc" data-a="add" aria-label="Добавить продукт">' + ICON.plus + "</button>");
  h += '<nav class="seg" aria-label="Места хранения">' + PLACES.map((p) => '<button class="' + (p.id === place ? "on" : "") + '" data-a="place" data-v="' + p.id + '" aria-pressed="' + (p.id === place) + '">' + p.name + "</button>").join("") + "</nav>";
  if (!S.prods.length) {
    h += '<div class="empty"><h3>Кладовая пока пустая</h3><p class="p">Нажми оранжевый «+», чтобы положить первый продукт: начни печатать название, а тара, полка и срок подставятся сами.</p><button class="btn" data-a="sample">Загрузить пример, чтобы посмотреть</button></div>';
  }
  const fridgeDoor = S.prods.filter((p) => { const z = zoneById(p.zone); return z && (z.place === "fridge" || z.place === "door"); });
  const soon = fridgeDoor.filter((p) => pStatus(p) === "soon" || pStatus(p) === "urgent");
  let dimOn = false;
  if ((place === "fridge" || place === "door") && soon.length) {
    dimOn = ui.onlySoon;
    h += '<button class="alert' + (ui.onlySoon ? " on" : "") + '" data-a="onlySoon" aria-pressed="' + ui.onlySoon + '"><span class="badge">' + soon.length + '</span><span style="flex:1;min-width:0"><span style="display:block;font-size:14px;font-weight:800">Съесть в ближайшие дни</span><span class="ell small muted" style="display:block">' + esc(soon.map((p) => p.name).join(", ")) + '</span></span><span class="small" style="color:#B5562A;font-weight:800">' + (ui.onlySoon ? "Все" : "Показать") + "</span></button>";
  }
  if (place === "pantry") {
    const low = S.prods.filter((p) => zoneById(p.zone).place === "pantry" && isLow(p));
    if (low.length) h += '<div class="alert"><span class="badge" style="background:#E8A93A">' + low.length + '</span><span style="flex:1;min-width:0"><span style="display:block;font-size:14px;font-weight:800">Заканчивается</span><span class="ell small muted" style="display:block">' + esc(low.map((p) => p.name).join(", ")) + "</span></span></div>";
  }
  const sel = ui.sheet && ui.sheet.type === "prod" ? ui.sheet.id : null;
  const zones = zonesOf(place);
  const savedZone = ui.storageZones[place];
  const activeZone = savedZone === "all" || zones.some((z) => z.id === savedZone) ? savedZone : (zones[0] && zones[0].id);
  h += '<div class="storage-layout"><nav class="storage-rail" aria-label="Полки и ящики"><button data-a="storageZone" data-id="all" aria-pressed="' + (activeZone === "all") + '">Все</button>';
  zones.forEach((z) => {
    const short = /^Полка\s+\d+$/i.test(z.title) ? z.title.replace(/^Полка\s+/i, "") : /^Ящик\s+\d+$/i.test(z.title) ? z.title.replace(/^Ящик\s+/i, "") : z.title === "0 °C Fresh" ? "0 °C" : z.title;
    h += '<button data-a="storageZone" data-id="' + z.id + '" aria-label="' + esc(z.title) + '" aria-pressed="' + (activeZone === z.id) + '">' + esc(short) + '</button>';
  });
  h += '</nav><div class="storage-content">';
  zones.forEach((z, i) => {
    if (activeZone !== "all" && activeZone !== z.id) return;
    const items = S.prods.filter((p) => p.zone === z.id);
    const key = z.id, exp = activeZone !== "all" || !!ui.exp[key], over = items.length > 8;
    const shown = over && !exp ? items.slice(0, 7) : items;
    h += '<section class="card" aria-label="' + esc(z.title) + '"><div class="between">' + pill(i + (place === "door" ? 2 : place === "freezer" ? 1 : place === "pantry" ? 3 : 0), z.title) +
      '<span class="row"><span class="small soft">' + (items.length ? items.length + " " + plural(items.length, "продукт", "продукта", "продуктов") : "") + '</span><button class="addbtn" data-a="add" data-z="' + z.id + '" aria-label="Добавить: ' + esc(z.title) + '">' + ICON.plusS + "</button></span></div>";
    if (items.length) {
      h += '<div class="grid4">' + shown.map((p) => tileHTML(p, { dim: dimOn && !(pStatus(p) === "soon" || pStatus(p) === "urgent"), sel: sel === p.id })).join("");
      if (over && activeZone === "all") h += '<button class="more" data-a="expZone" data-id="' + key + '" aria-expanded="' + exp + '">' + (exp ? "Свернуть" : "Ещё " + (items.length - shown.length)) + "</button>";
      h += "</div>";
    } else h += '<p class="p soft" style="margin:0">Пусто — нажми «+», чтобы положить продукт</p>';
    h += "</section>";
  });
  h += '</div></div><div class="legend">' + [["fresh", "Свежее"], ["soon", "2–3 дня"], ["urgent", "Сегодня-завтра"], ["unknown", "Срок не указан"]].map((x) => '<span><span class="ldot st-' + x[0] + '" style="' + (x[0] === "unknown" ? "border:1.5px solid #A89B8C" : "") + '"></span>' + x[1] + "</span>").join("") + "</div>";
  return h;
}

/* --- карточка продукта --- */
function shProd(sh) {
  const p = prodById(sh.id); if (!p) return "";
  const z = zoneById(p.zone), st = pStatus(p), d = DICT[p.d];
  let h = '<div class="row" style="gap:12px"><div style="flex:none;border-radius:20px;background:var(--bg);padding:4px">' + pViz(p, 104) + '</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><p class="small muted" style="margin:0;text-transform:uppercase;letter-spacing:.05em">' + esc(zoneLabel(z)) + "</p><h2>" + esc(p.name) + '</h2><span class="tag" style="background:var(--bg);display:inline-flex;align-items:center;gap:6px"><span class="ldot st-' + st + '" style="' + (st === "unknown" ? "border:1.5px solid #A89B8C" : "") + '"></span>' + STL[st] + "</span></div></div>";
  h += '<div class="kv"><div><p class="k">Осталось</p><p class="v">' + leftText(p) + '</p></div><div><p class="k">Срок</p><p class="v" style="font-size:14px">' + expLabel(p) + "</p></div></div>";
  if (p.t === "count") h += '<div class="stepper"><button data-a="pCount" data-v="-1" aria-label="Минус один">−</button><span>' + p.have + " из " + p.max + '</span><button class="plus" data-a="pCount" data-v="1" aria-label="Плюс один">+</button></div>';
  else if (p.t !== "can") h += '<div class="lv">' + [[0.1, "Почти нет"], [0.35, "Мало"], [0.6, "Половина"], [1, "Полная"]].map((o) => '<button class="' + (Math.abs((p.l || 0) - o[0]) < 0.13 ? "on" : "") + '" data-a="pLevel" data-v="' + o[0] + '">' + o[1] + "</button>").join("") + "</div>";
  if (p.t !== "count") h += '<div class="row"><span style="flex:1;font-size:14px;font-weight:800">' + (p.t === "can" ? "Банок" : "Упаковок, считая открытую") + '</span><button class="chip" style="min-width:44px" data-a="pPacks" data-v="-1" aria-label="Меньше">−</button><span style="min-width:28px;text-align:center;font-size:16px;font-weight:800">' + (p.packs || 1) + '</span><button class="chip" style="min-width:44px;background:var(--yel);border-color:var(--yelb)" data-a="pPacks" data-v="1" aria-label="Больше">+</button></div>';
  h += '<label class="lbl">Годен до (нажми, чтобы выбрать дату в календаре)<input class="in" type="date" id="pExp" data-ch="pExp" value="' + (p.exp || "") + '"></label><div class="chips">' + [["3", "+3 дня"], ["7", "+неделя"], ["30", "+месяц"], ["", "Без срока"]].map((o) => '<button class="chip" data-a="pExpQuick" data-v="' + o[0] + '">' + o[1] + "</button>").join("") + "</div>";
  if (p.d) {
    const recs = S.recs.filter((r) => r.ings.some((i) => i.d && (i.d === p.d || (DICT[p.d] && DICT[p.d].ref === i.d))));
    if (recs.length || (d && d.slot)) {
      h += '<div style="display:flex;flex-direction:column;gap:6px"><h3>Что приготовить</h3>' + recs.slice(0, 3).map((r) => '<button class="idea" data-a="openRec" data-id="' + r.id + '">' + esc(r.name) + ICON.chev + "</button>").join("");
      if (d && (d.slot || (d.ref && DICT[d.ref].slot))) h += '<button class="idea" style="background:#FDF3DC;border-color:#EBD49A;color:#4F4237" data-a="buildWith" data-v="' + (d.ref || d.id) + '">Собрать блюдо с этим' + ICON.chev + "</button>";
      h += "</div>";
    }
    if (d && d.note) h += '<p class="p muted" style="margin:0">' + esc(d.note) + "</p>";
  }
  if (!p.d || (p.d && !DICT[p.d])) h += '<div style="display:flex;flex-direction:column;gap:6px">' + linkHTML(p.name, null, "pLink") + "</div>";
  else if (p.d && DICT[p.d] && p.name !== DICT[p.d].n && !DICT[p.d].ref) h += '<p class="small muted" style="margin:0">Учитывается как «' + esc(DICT[p.d].n) + '» · <button class="chip" style="min-height:30px;padding:0 8px;font-size:12px" data-a="pLink" data-v="' + p.d + '">отвязать</button></p>';
  h += '<details><summary>Изменить название, место или тару ›</summary><div style="display:flex;flex-direction:column;gap:10px;padding-top:6px">';
  h += '<label class="lbl">Название<input class="in" id="pName" data-in="pName" value="' + esc(p.name) + '"></label>';
  if (p.t !== "count") h += '<div class="lbl">В одной целой упаковке</div><div class="row"><input class="in" style="width:120px" type="number" inputmode="decimal" id="pPk" data-ch="pPk" value="' + (p.pk || "") + '" placeholder="например 300">' + ["г", "мл", "шт"].map((x) => '<button class="chip' + ((p.u || "г") === x ? " on" : "") + '" data-a="pU" data-v="' + x + '">' + x + "</button>").join("") + "</div>";
  h += '<div class="lbl">Где лежит</div><div class="hscroll">' + S.zones.slice().sort((a, b) => PLACES.findIndex((x) => x.id === a.place) - PLACES.findIndex((x) => x.id === b.place) || a.o - b.o).map((zz) => '<button class="chip' + (zz.id === p.zone ? " on" : "") + '" data-a="pZone" data-v="' + zz.id + '">' + esc(zoneLabel(zz)) + "</button>").join("") + "</div>";
  h += '<div class="lbl">Тара</div><div class="hscroll">' + TARA.map((t) => '<div style="flex:none">' + tileHTML({ name: t[1], t: t[0], c: p.c, l: 0.7, have: 3, max: 4, cell: p.cell }, { act: "pTara", id: t[0], noDot: true, sel: p.t === t[0], aria: "тара" }) + "</div>").join("") + "</div></div></details>";
  const inShop = S.shop.some((x) => !x.done && (x.pid === p.id || (p.d && x.d === p.d)));
  h += '<div class="btns"><button class="btn' + (inShop ? " green" : "") + '" data-a="pShop">' + (inShop ? "В закупках ✓" : "В закупки") + '</button><button class="btn acc" data-a="pGone">Закончилось</button></div>';
  return h;
}

/* --- добавление продукта --- */
const SROK = [[3, "3 дня"], [5, "5 дней"], [7, "Неделя"], [14, "2 недели"], [30, "Месяц"], [0, "Без срока"]];
function dictSearch(q) {
  q = q.trim().toLowerCase();
  const all = DICT_LIST.filter((d) => !d.virtual);
  const custom = S.udict.filter((u) => u.id.indexOf("uc:") === 0).map((u) => ({ id: u.id, n: u.name, t: u.t, c: u.c, z: u.z, cell: u.cell, custom: true }));
  const pool = custom.concat(all);
  if (!q) return ["milk", "eggs", "tofu", "cucumber", "spinach", "chickpea", "pumpkin", "lemon"].map((id) => DICT[id]);
  return pool.filter((d) => { const n = (d.n + " " + (d.syn || "")).toLowerCase(); return n.indexOf(q) === 0 || n.indexOf(" " + q) >= 0 || (q.length >= 3 && n.indexOf(q) >= 0); }).slice(0, 7);
}
function linkGuesses(name, excl) {
  const out = [];
  stems(name).forEach((st) => DICT_LIST.forEach((d) => { if (d.virtual || out.indexOf(d.id) >= 0 || d.id === excl) return; if (stems(d.n + " " + (d.syn || "")).indexOf(st) >= 0) out.push(d.id); }));
  return out.slice(0, 6);
}
function linkHTML(name, cur, act, excl) {
  const g = linkGuesses(name, excl);
  let h = '<div class="lbl">Это то же, что… — тогда учту в рецептах, конструкторе и калориях</div><div class="chips">';
  h += g.map((id) => '<button class="chip' + (cur === id ? " on" : "") + '" data-a="' + act + '" data-v="' + id + '">' + esc(DICT[id].n) + "</button>").join("");
  if (aiOn()) h += '<button class="chip" style="background:#EEEAF6;border-color:#D8D0EC" data-a="aiProduct">' + (ui.sheet && ui.sheet.aiBusy ? "Распознаю…" : "Распознать с ИИ") + "</button>";
  if (!g.length && !aiOn()) h += '<span class="small soft">Похожих в справочнике нет — продукт сохранится как свой.</span>';
  h += "</div>";
  if (ui.sheet && ui.sheet.aiErr) h += '<p class="small" style="color:#C2452F;margin:0">' + esc(ui.sheet.aiErr) + "</p>";
  return h;
}
function addSuggHTML(sh) {
  const list = dictSearch(sh.q || "");
  let h = list.map((d) => { const df = d.custom ? d : dictDefaults(d); return '<button class="rcard" style="min-height:52px;padding:8px 12px" data-a="addPick" data-v="' + esc(d.id) + '"><span style="flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center">' + viz(df.t, d.c, 0.7, 3, 4, d.cell, 38) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:15px;font-weight:800">' + esc(d.n) + '</span><span class="small muted">' + esc(TARA.find((t) => t[0] === df.t)[1] + " · " + zoneLabel(zoneById(df.z))) + "</span></span>" + ICON.chev + "</button>"; }).join("");
  const q = (sh.q || "").trim();
  if (q && !list.some((d) => d.n.toLowerCase() === q.toLowerCase())) h += '<button class="btn ghost" style="min-height:48px" data-a="addCustom">Добавить «' + esc(q) + "» — нет в справочнике, тару выберешь сама</button>";
  return h;
}
function shAdd(sh) {
  let h = '<div class="between"><h2>Новый продукт</h2><button class="ibtn" data-a="close" aria-label="Закрыть">' + ICON.x + "</button></div>";
  h += '<label class="lbl">Что добавить<input class="in" id="addQ" data-in="addQ" type="text" autocomplete="off" placeholder="Начни печатать: молоко, тофу…" value="' + esc(sh.q || "") + '"></label>';
  if (!sh.pick) return h + (aiOn() ? '<label class="btn" style="background:#EEEAF6;border-color:#D8D0EC;cursor:pointer;gap:8px">' + ICON.camera + 'По фото: упаковка или целая полка<input type="file" accept="image/*" data-ch="photo" style="display:none"></label>' : "") + '<div id="addSugg" style="display:flex;flex-direction:column;gap:6px">' + addSuggHTML(sh) + "</div>";
  const d = sh.pick;
  const L = sh.link && DICT[sh.link] ? DICT[sh.link] : null;
  const prev = { name: d.n, t: sh.tara, c: d.c, l: sh.level, have: sh.have, max: sh.have, cell: d.cell || "round" };
  h += '<div class="row" style="gap:12px;padding:8px;border-radius:18px;background:var(--bg)"><div style="flex:none">' + pViz(prev, 96) + '</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><p style="margin:0;font-size:18px;font-weight:800">' + esc(d.n) + "</p>" + ((L || d).k ? '<p class="small muted" style="margin:0">≈ ' + (L || d).k + " ккал · " + (L || d).p + " г белка на 100 г" + ((L || d).slot === "base" ? " (готового)" : "") + "</p>" : "") + ((L || d).note ? '<p class="small muted" style="margin:0;font-weight:600">' + esc((L || d).note) + "</p>" : "") + (L ? '<p class="small" style="margin:0;color:#3E7A52">Связан с «' + esc(L.n) + '»</p>' : "") + "</div></div>";
  if (d.custom) h += linkHTML(d.n, sh.link, "addLink");
  h += '<div class="lbl">Тара — ' + (sh.tara === sh.taraDef ? "подобрана по справочнику" : "выбрана вручную, запомню") + '</div><div class="hscroll">' + TARA.map((t) => '<div style="flex:none">' + tileHTML({ name: t[1], t: t[0], c: d.c, l: 0.7, have: 3, max: 4, cell: d.cell || "round" }, { act: "addTara", id: t[0], noDot: true, sel: sh.tara === t[0], aria: "тара" }) + "</div>").join("") + "</div>";
  h += '<div class="lbl">Куда положить</div><div class="hscroll">' + S.zones.slice().sort((a, b) => PLACES.findIndex((x) => x.id === a.place) - PLACES.findIndex((x) => x.id === b.place) || a.o - b.o).map((z) => '<button class="chip' + (z.id === sh.zone ? " on" : "") + '" data-a="addZone" data-v="' + z.id + '">' + esc(zoneLabel(z)) + "</button>").join("") + "</div>";
  h += '<div class="lbl">' + (sh.tara === "count" ? "Сколько штук" : sh.tara === "can" ? "" : "Сколько в открытой (или единственной) упаковке") + "</div>";
  if (sh.tara === "count") h += '<div class="stepper"><button data-a="addCount" data-v="-1">−</button><span>' + sh.have + ' шт.</span><button class="plus" data-a="addCount" data-v="1">+</button></div>';
  else if (sh.tara !== "can") h += '<div class="lv">' + [[0.1, "Почти нет"], [0.35, "Мало"], [0.6, "Половина"], [1, "Полная"]].map((o) => '<button class="' + (Math.abs(sh.level - o[0]) < 0.13 ? "on" : "") + '" data-a="addLevel" data-v="' + o[0] + '">' + o[1] + "</button>").join("") + "</div>";
  if (sh.tara !== "count") {
    h += '<div class="row"><span style="flex:1;font-size:14px;font-weight:800">' + (sh.tara === "can" ? "Сколько банок" : "Сколько упаковок") + '</span><button class="chip" style="min-width:44px" data-a="addPacks" data-v="-1" aria-label="Меньше">−</button><span style="min-width:28px;text-align:center;font-size:16px;font-weight:800">' + sh.packs + '</span><button class="chip" style="min-width:44px;background:var(--yel);border-color:var(--yelb)" data-a="addPacks" data-v="1" aria-label="Больше">+</button></div>';
    h += '<div class="lbl">В одной целой упаковке' + (sh.pkDef ? " — обычно " + fmtQ(sh.pkDef, sh.u) : "") + '</div><div class="row"><input class="in" style="width:120px" type="number" inputmode="decimal" id="addPk" data-in="addPk" value="' + (sh.pk || "") + '" placeholder="вес или объём">' + ["г", "мл", "шт"].map((x) => '<button class="chip' + (sh.u === x ? " on" : "") + '" data-a="addU" data-v="' + x + '">' + x + "</button>").join("") + "</div>";
  }
  h += '<div class="lbl">Годен до' + (sh.srokDef ? " — по справочнику хранится " + sh.srokDef + " " + plural(sh.srokDef, "день", "дня", "дней") : "") + '</div><input class="in" type="date" id="addExp" data-ch="addExp" value="' + (sh.exp || "") + '"><div class="chips">' + SROK.map((s) => '<button class="chip' + (sh.srok === s[0] ? " on" : "") + '" data-a="addSrok" data-v="' + s[0] + '">' + (s[0] ? "+" + s[1].toLowerCase() : s[1]) + "</button>").join("") + "</div>";
  h += '<button class="btn acc" data-a="addCommit">Положить · ' + esc(zoneLabel(zoneById(sh.zone)).toLowerCase()) + "</button>";
  return h;
}
function nearestSrok(s) { if (!s || s >= 999) return 0; let best = SROK[0][0]; SROK.forEach((x) => { if (x[0] && Math.abs(x[0] - s) < Math.abs(best - s)) best = x[0]; }); return s > 45 ? 30 : best; }

/* ==================== КОНСТРУКТОР ==================== */
const SLOTS = [["base", "Основа", "крупа или лапша"], ["greens", "Зелень", "свежая база"], ["protein", "Белок", "сытость"], ["veg", "Овощи", "тёплые и свежие"], ["crunch", "Хруст", "семечки и орехи"], ["sauce", "Соус", "связывает вкус"], ["accent", "Акцент", "кислинка и свежесть"]];
const STOCK_TAG = { yes: "есть", soon: "съесть за 2–3 дня", urgent: "пора доесть", no: "докупить" };
const STOCK_COL = { yes: "#6A5646", soon: "#B07A10", urgent: "#C2452F", no: "#B5562A" };
const IDEA_PRESETS = [
  { name: "Азиатский салат с собой и эдамаме", items: [["soba", 120], ["napa", 40], ["edamame", 80], ["cucumber", 80], ["carrot", 50], ["asianDr", 20], ["sesame", 5]] },
  { name: "Свёкла, чечевица, апельсин", items: [["lentilGreen", 120], ["rucola", 30], ["beet", 100], ["orange", 60], ["walnut", 15], ["mustardDr", 15]] },
  { name: "Боул с лососем и авокадо", items: [["rice", 120], ["napa", 30], ["salmon", 120], ["cucumber", 80], ["avocado", 50], ["soy", 10], ["lime", 10]] },
  { name: "Хрустящий баклажан с тофу и рисом", items: [["rice", 120], ["eggplant", 150], ["tofu", 120], ["greenonion", 5], ["soy", 10], ["sesame", 5]] }
];
function bAvail(id) { return ui.b.mode === "ideas" || stockOf(id) !== "no"; }
function bCalc() {
  const items = ui.b.items.filter((x) => DICT[x.d]);
  const has = {}; items.forEach((x) => { has[x.d] = true; });
  const tot = { k: 0, p: 0, f: 0, c: 0 }; const parts = [];
  items.forEach((x) => { const d = DICT[x.d], m = x.g / 100; const k = (d.k || 0) * m; tot.k += k; tot.p += (d.p || 0) * m; tot.f += (d.f || 0) * m; tot.c += (d.cb || 0) * m; parts.push({ d: x.d, k: k, g: x.g }); });
  tot.k += ui.b.oil * 9; tot.f += ui.b.oil;
  const T = { salt: 0, sour: 0, sweet: 0, umami: 0, fat: 0, crunch: 0 };
  items.forEach((x) => { const t = DICT[x.d].ts || {}; Object.keys(T).forEach((k) => { T[k] += t[k] || 0; }); });
  if (ui.b.oil) T.fat += 0.5;
  return { items: items, has: has, tot: tot, parts: parts, T: T };
}
function bSteps(C) {
  const nm = (id) => DICT[id].short || DICT[id].n.split(" ")[0].toLowerCase();
  const withG = (txt, x) => { const gq = x.d === "eggs" ? Math.max(1, Math.round(x.g / 50)) + " шт." : x.g + " г"; return txt.replace(/G3/g, Math.round(x.g / 3) + " г").replace(/G/g, gq); };
  const raw = [], groups = { greens: [], fresh: [], crunch: [] };
  C.items.forEach((x) => { const p = DICT[x.d].pr; if (!p) return; if (p[1]) { groups[p[1]].push(x); return; } if (p[2]) raw.push({ o: p[0], text: withG(p[2], x), device: p[3], tip: p[4], d: x.d }); });
  if (groups.greens.length) raw.push({ o: 4, text: "Промой и тщательно обсуши зелень: " + groups.greens.map((x) => nm(x.d) + " " + x.g + " г").join(", ") + ".", device: "", tip: "Мокрая зелень разбавит заправку и раскиснет — суши полотенцем." });
  if (groups.fresh.length) raw.push({ o: 4, text: "Нарежь свежие овощи: " + groups.fresh.map((x) => nm(x.d) + " " + x.g + " г").join(", ") + ".", device: "", tip: groups.fresh.some((x) => x.d === "cucumber" || x.d === "tomato") ? "Огурцы и томаты режь перед подачей — так не пустят сок." : "" });
  if (groups.crunch.length) raw.push({ o: 5, text: "Подсуши на сухой сковороде: " + groups.crunch.map((x) => nm(x.d) + " " + x.g + " г").join(", ") + ".", device: "Сковорода · 3–4 мин", tip: "Следи — семечки и орехи подгорают за секунды." });
  raw.sort((a, b) => a.o - b.o);
  const longest = raw.find((r) => r.o === 1);
  if (longest) raw.forEach((r) => { if ((r.o === 2 || r.o === 3) && !r.tip) r.tip = "Делай, пока в аэрогриле " + nm(longest.d) + "."; });
  if (C.items.length) raw.push({ o: 6, text: "Собери тарелку: зелень → основа → тёплые ингредиенты → свежие овощи → хруст" + (C.items.some((x) => DICT[x.d].slot === "sauce") ? " → соус." : "."), device: "", tip: "Тёплое клади на зелень прямо перед едой, а соус — в самом конце, чтобы ничего не размокло." });
  let mins = 10;
  raw.forEach((r) => { (r.device || "").replace(/(\d+)\s*мин/g, (m, v) => { if (+v + 8 > mins) mins = +v + 8; }); });
  if (longest) mins += 5;
  return { steps: raw, mins: Math.round(mins / 5) * 5 };
}
function bHints(C) {
  const hints = [];
  const H = (kind, title, text, opts) => hints.push({ kind: kind, title: title, text: text || "", opts: opts || [] });
  const has = C.has;
  const optOf = (ids) => ids.filter((id) => !has[id] && DICT[id] && bAvail(id)).slice(0, 3);
  FAVS.forEach((f) => { const n = f.set.filter((id) => has[id]).length; if (n >= 3) H("personal", "Похоже на твой фаворит — " + f.name, n >= 5 ? "Почти та же тарелка, что тебе очень понравилась." : "Совпадает " + n + " из " + f.set.length + " ингредиентов — такое сочетание уже работает."); });
  S.recs.filter((r) => r.rating === "love" && r.src === "конструктор").forEach((r) => { const ids = r.ings.map((i) => i.d).filter(Boolean); const n = ids.filter((id) => has[id]).length; if (ids.length && n >= Math.max(3, ids.length - 1)) H("personal", "Похоже на «" + r.name + "»", "Ты отметила его как «очень понравилось»."); });
  const urgentFree = Array.from(new Set(S.prods.filter((p) => pStatus(p) === "urgent" && !isEmptyP(p) && p.d).map((p) => (DICT[p.d] && DICT[p.d].ref) || p.d))).filter((id) => DICT[id] && DICT[id].slot && !has[id]);
  if (urgentFree.length) H("use", "Пора доесть: " + urgentFree.map((id) => DICT[id].n.toLowerCase()).join(", "), "Можно положить в эту тарелку.", urgentFree.slice(0, 3));
  if (C.items.length) {
    const pr = Math.round(C.tot.p);
    if (pr < 20) H("protein", "Белка ≈ " + pr + " г — маловато для сытного обеда", "Ориентир для основного приёма пищи — примерно 25–35 г.", optOf(["eggs", "tofu", "edamame", "lentilGreen", "chickpea", "trout", "cod", "feta"]));
    const n = (v) => Math.max(0, Math.min(1, v / 3));
    if (n(C.T.sour) < 0.34) H("balance", "Не хватает кислинки", "Кислота «будит» вкус и уравновешивает жирный соус и сладкие овощи.", optOf(["lemon", "lime", "pomegranate", "tomato", "orange"]));
    if (n(C.T.crunch) < 0.34) H("balance", "Всё мягкое — добавь хруст", "Контраст текстур делает салат «ресторанным»: мягкое + хрустящее.", optOf(["seeds", "sesame", "walnut", "cucumber", "napa"]));
    if (n(C.T.salt) < 0.2) H("balance", "Может быть пресно", "Посоли или добавь солёный соус.", optOf(["soy", "asianDr", "mustardDr", "feta"]));
    if (n(C.T.sweet) < 0.15) H("balance", "Капля сладости смягчит вкус", "Сладкие овощи балансируют горечь зелени и кислоту.", optOf(["pumpkin", "carrot", "corn", "beet"]));
    const sauceG = C.items.filter((x) => DICT[x.d].slot === "sauce").reduce((a, x) => a + x.g, 0);
    if (C.T.fat >= 4 && sauceG > 15) H("balance", "Много жирного: и соус, и семечки", "Можно оставить 10 г соуса и развести его водой с лимоном — вкус тот же, калорий меньше.");
  }
  const matched = PAIRS.filter((p) => has[p[0]] && has[p[1]]).slice(0, 3).map((p) => p[2]);
  if (matched.length) H("pair", "Удачные пары в тарелке", matched.join(". ") + ".");
  const fact = FACTS.find((f) => f[0].some((id) => has[id]) && f[1].some((id) => has[id]));
  if (fact) H("fact", "Любопытно", fact[2] + " Это интересный факт, а не строгое правило: «общие молекулы» объясняют не все удачные сочетания.");
  const prio = { personal: 0, use: 1, protein: 2, balance: 3, pair: 4, fact: 5 };
  return hints.sort((a, b) => prio[a.kind] - prio[b.kind]);
}
const HSTYLE = { personal: ["#F7E6EA", "#E9C6CF", "Твой опыт"], use: ["#FCEBDD", "#F0CDAF", "Остатки"], protein: ["#E6EFF5", "#C9DCE8", "Белок"], balance: ["#FDF3DC", "#EBD49A", "Баланс"], pair: ["#EEF5E8", "#D3E4C6", "Сочетание"], fact: ["#EEEAF6", "#D8D0EC", "Химия вкуса"] };
function stepsHTML(steps) {
  return steps.map((s, k) => '<div class="step"><span class="num">' + (k + 1) + '</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><p style="margin:0;font-size:14px;font-weight:600;line-height:1.45">' + esc(s.text) + "</p>" + (s.device ? '<span class="dev">' + ICON.timer + esc(s.device) + "</span>" : "") + (s.tip ? '<p class="tip">' + esc(s.tip) + "</p>" : "") + "</div></div>").join("");
}
function bPresets() {
  const fromRecs = S.recs.map((r) => ({ name: r.name, items: r.ings.filter((i) => i.d && i.g && DICT[i.d] && DICT[i.d].slot).map((i) => [i.d, i.g]) })).filter((p) => p.items.length >= 3);
  const all = fromRecs.concat(IDEA_PRESETS);
  return all.map((p) => ({ p: p, need: p.items.filter((x) => stockOf(x[0]) === "no").map((x) => x[0]) })).filter((x) => ui.b.mode === "stock" ? x.need.length === 0 : x.need.length > 0).slice(0, 6);
}
function vBuilder() {
  const C = bCalc();
  let h = hdr("Конструктор", "Собрать блюдо", "");
  h += '<nav class="seg" aria-label="Режим">' + [["stock", "Из того, что есть"], ["ideas", "Идеи + докупить"]].map((m) => '<button class="' + (ui.b.mode === m[0] ? "on" : "") + '" data-a="bMode" data-v="' + m[0] + '">' + m[1] + "</button>").join("") + "</nav>";
  const pres = bPresets();
  h += '<div style="display:flex;flex-direction:column;gap:6px"><h3 style="font-size:13px">' + (ui.b.mode === "stock" ? "Быстрый старт из того, что есть" : "Идеи, ради которых стоит докупить") + '</h3><div class="hscroll">' +
    (pres.length ? pres.map((x, i) => '<button data-a="bPreset" data-v="' + i + '" style="flex:none;width:200px;min-height:76px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;padding:10px 12px;border-radius:16px;text-align:left;background:#fff;border:1px solid var(--line);box-shadow:var(--shadow)"><span style="font-size:14px;font-weight:800;line-height:1.25">' + esc(x.p.name) + '</span><span class="small" style="color:' + (x.need.length ? "#B5562A" : "#3E7A52") + '">' + (x.need.length ? "докупить: " + esc(x.need.map((id) => DICT[id].n.split(" ")[0].toLowerCase()).join(", ")) : "всё есть дома") + "</span></button>").join("") : '<p class="p soft" style="margin:0">' + (ui.b.mode === "stock" ? "Пока ни один рецепт не собирается целиком из того, что есть. Начни с основы ниже или переключись на «Идеи»." : "Всё для идей уже есть дома.") + "</p>") + "</div></div>";
  if (aiOn()) h += '<button class="btn" style="background:#EEEAF6;border-color:#D8D0EC" data-a="aiRec">Придумать с ИИ из того, что есть</button>';
  // тарелка
  const gsum = C.parts.reduce((a, x) => a + Math.max(x.g, 12), 0); let acc = 0;
  const stops = C.parts.map((x) => { const a = acc / gsum * 360, b = (acc + Math.max(x.g, 12)) / gsum * 360; acc += Math.max(x.g, 12); return DICT[x.d].c + " " + a.toFixed(1) + "deg " + b.toFixed(1) + "deg"; });
  const top = C.parts.slice().sort((a, b) => b.k - a.k)[0];
  h += '<section class="card big" aria-label="Тарелка"><div class="row" style="gap:14px"><div class="plate" style="width:132px;height:132px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px #F6EFE4,0 4px 14px rgba(80,55,25,.18);background:' + (stops.length ? "conic-gradient(" + stops.join(",") + ")" : "#F1E8DC") + '"><div style="width:84px;height:84px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:22px;font-weight:800;line-height:1">' + Math.round(C.tot.k / 5) * 5 + '</span><span class="small muted">ккал ≈</span></div></div>' +
    '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px"><div><span style="font-size:26px;font-weight:800;color:#3E7A52">' + Math.round(C.tot.p) + '</span> <span style="font-size:13px;font-weight:800;color:#3E7A52">г белка</span></div><div class="small muted">Жиры ' + Math.round(C.tot.f) + " г · Углеводы " + Math.round(C.tot.c) + ' г</div><p class="small muted" style="margin:0;font-weight:600">' + (top ? "Больше всего калорий даёт " + esc(DICT[top.d].n.toLowerCase()) + ": ≈ " + Math.round(top.k) + " ккал" + (ui.b.oil ? ", масло — " + ui.b.oil * 9 : "") + "." : "Добавь продукты в слоты ниже.") + "</p></div></div>" +
    '<div class="row" style="flex-wrap:wrap"><span class="small">Масло для жарки</span>' + [0, 5, 10].map((v) => '<button class="chip' + (ui.b.oil === v ? " on" : "") + '" style="min-height:36px" data-a="bOil" data-v="' + v + '">' + v + " г</button>").join("") + '</div><p class="small soft" style="margin:0;font-weight:600">Цифры ориентировочные: по справочным значениям на 100 г.</p></section>';
  // подсказки
  const hints = bHints(C);
  if (hints.length) {
    const shown = ui.b.allHints ? hints : hints.slice(0, 2);
    h += '<section style="display:flex;flex-direction:column;gap:8px" aria-label="Подсказки"><h3 style="font-size:13px">Подсказки</h3>' + shown.map((x) => { const c = HSTYLE[x.kind]; return '<div class="hint" style="background:' + c[0] + ";border-color:" + c[1] + '"><span class="htag">' + c[2] + '</span><p style="margin:0;font-size:14px;font-weight:800;line-height:1.3">' + esc(x.title) + "</p>" + (x.text ? '<p class="p">' + esc(x.text) + "</p>" : "") + (x.opts.length ? '<div class="chips">' + x.opts.map((id) => '<button class="chip" style="min-height:36px;background:rgba(255,255,255,.85)" data-a="bAdd" data-v="' + id + '">+ ' + esc(DICT[id].n.split(" ")[0]) + "</button>").join("") + "</div>" : "") + "</div>"; }).join("");
    if (hints.length > 2) h += '<button class="btn ghost" style="align-self:flex-start" data-a="bHints">' + (ui.b.allHints ? "Свернуть подсказки" : "Ещё подсказки (" + (hints.length - 2) + ")") + "</button>";
    h += "</section>";
  }
  // слоты
  const order = { urgent: 0, soon: 1, yes: 2, no: 3 };
  SLOTS.forEach((s, si) => {
    const open = ui.b.open === s[0];
    const mine = C.items.filter((x) => DICT[x.d].slot === s[0]);
    h += '<section class="card" aria-label="' + s[1] + '"><div class="between"><div class="row" style="min-width:0">' + pill(si, s[1]) + '<span class="small muted ell" style="font-weight:600">' + s[2] + '</span></div><button class="chip' + (open ? " on" : "") + '" style="min-height:36px" data-a="bSlot" data-v="' + s[0] + '" aria-expanded="' + open + '">' + (open ? "Готово" : "+ Добавить") + "</button></div>";
    mine.forEach((x) => {
      const d = DICT[x.d], st = stockOf(x.d), stp = d.st || 10;
      h += '<div class="irow"><span class="sw" style="background:' + d.c + '"></span><span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="ell" style="font-size:14px;font-weight:800">' + esc(d.n) + '</span><span class="ell small" style="color:' + STOCK_COL[st] + '">' + STOCK_TAG[st] + " · ≈ " + Math.round((d.k || 0) * x.g / 100) + " ккал · " + Math.round((d.p || 0) * x.g / 10) / 10 + ' г белка</span></span><button class="pm" data-a="bG" data-v="' + x.d + '" data-d="' + -stp + '" aria-label="Минус ' + stp + ' г">−</button><input class="g" id="g-' + x.d + '" type="number" inputmode="numeric" min="0" data-ch="bG" data-v="' + x.d + '" value="' + x.g + '" aria-label="Граммы: ' + esc(d.n) + '"><span class="small muted">г</span><button class="pm plus" data-a="bG" data-v="' + x.d + '" data-d="' + stp + '" aria-label="Плюс ' + stp + ' г">+</button><button class="x" data-a="bDel" data-v="' + x.d + '" aria-label="Убрать ' + esc(d.n) + '">' + ICON.x + "</button></div>";
    });
    if (!mine.length && !open) h += '<p class="p soft" style="margin:0">Пока пусто</p>';
    if (open) {
      const opts = DICT_LIST.filter((d) => d.slot === s[0] && !C.has[d.id] && bAvail(d.id)).sort((a, b) => order[stockOf(a.id)] - order[stockOf(b.id)]);
      h += '<div class="chips" style="padding-top:6px;border-top:1px dashed var(--line)">' + (opts.length ? opts.map((d) => { const st = stockOf(d.id); return '<button class="chip' + (st === "no" ? " dash" : "") + '" style="display:inline-flex;align-items:center;gap:6px" data-a="bAdd" data-v="' + d.id + '"><span class="ldot" style="background:' + d.c + '"></span>' + esc(d.n) + '<span class="small" style="color:' + STOCK_COL[st] + '">' + STOCK_TAG[st] + "</span></button>"; }).join("") : '<p class="p soft" style="margin:0">' + (ui.b.mode === "stock" ? "Дома больше ничего подходящего нет. Переключись на «Идеи», чтобы выбрать из всего." : "Больше вариантов нет.") + "</p>") + "</div>";
    }
    h += "</section>";
  });
  // рецепт
  const ST = bSteps(C);
  if (ST.steps.length) h += '<section style="display:flex;flex-direction:column;gap:8px" aria-label="Как приготовить"><div class="between"><h2 style="font-size:20px">Как приготовить</h2><span class="small muted">≈ ' + ST.mins + " мин</span></div>" + stepsHTML(ST.steps) + "</section>";
  const buy = C.items.filter((x) => stockOf(x.d) === "no");
  if (buy.length) {
    const allIn = buy.every((x) => S.shop.some((s) => !s.done && s.d === x.d));
    h += '<section class="card" style="background:#FCEBDD;border-color:#F0CDAF"><h3>Докупить для этого блюда</h3><p class="p">' + esc(buy.map((x) => DICT[x.d].n.toLowerCase() + " — " + x.g + " г").join(", ")) + '</p><button class="btn' + (allIn ? " green" : "") + '" data-a="bBuy">' + (allIn ? "В закупках ✓" : "Добавить в закупки") + "</button></section>";
  }
  if (C.items.length) h += '<div class="btns"><button class="btn" data-a="bSave">Сохранить рецепт</button><button class="btn acc" style="flex:1.3" data-a="bCook">Приготовила — списать</button></div><button class="btn ghost" data-a="bClear">Очистить тарелку</button>';
  return h;
}

/* ==================== РЕЦЕПТЫ ==================== */
const BADGE = { love: ["Очень понравилось", "#F7E6EA", "#8E2E45"], like: ["Нравится", "#EEF5E8", "#2F4A22"], meh: ["Не моё", "#EFEAE4", "#5E5249"], plan: ["В планах", "#E6EFF5", "#2F4250"], new: ["Новый", "#FDF3DC", "#6B4E12"], none: ["Ещё не оценила", "#F3EEE7", "#5E5249"] };
const badgeHTML = (r) => { const b = BADGE[r.rating || "none"] || BADGE.none; return '<span class="tag" style="background:' + b[1] + ";color:" + b[2] + '">' + b[0] + "</span>"; };
const STAPLES = { oil: 1, oliveoil: 1, sesameoil: 1, starch: 1, sugar: 1, flour: 1 };
const recMissing = (r) => r.ings.filter((i) => i.d && DICT[i.d] && !DICT[i.d].virtual && !STAPLES[i.d] && !i.opt && ingStatus(i) === "no");
const recCols = (r) => r.ings.filter((i) => i.d && DICT[i.d] && i.g).map((i) => DICT[i.d].c).slice(0, 6);
const recAir = (r) => (r.tags || []).indexOf("airfryer") >= 0 || r.steps.some((s) => /Аэрогриль/.test(s[1] || ""));
const RF = [["all", "Все"], ["fav", "Любимые"], ["light", "Лёгкий ужин"], ["protein", "Много белка"], ["airfryer", "Аэрогриль"], ["now", "Можно сейчас"]];
const RTEST = { all: () => true, fav: (r) => r.rating === "love" || r.rating === "like", light: (r) => (r.kmax || 999) <= 450, protein: (r) => (r.p || 0) >= 20, airfryer: recAir, now: (r) => recMissing(r).length === 0 };
function recListHTML() {
  const q = ui.r.q.trim().toLowerCase();
  const list = S.recs.filter((r) => RTEST[ui.r.filter](r) && (!q || (r.name + " " + r.ings.map((i) => i.n).join(" ")).toLowerCase().indexOf(q) >= 0));
  if (!list.length) return '<p class="p soft">Ничего не нашлось. Попробуй другой фильтр.</p>';
  return list.map((r) => { const m = recMissing(r); return '<button class="rcard" data-a="openRec" data-id="' + r.id + '"><span class="plate" style="' + plateBG(recCols(r), 64) + '"></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">' + badgeHTML(r) + '<span style="font-size:15px;font-weight:800;line-height:1.25">' + esc(r.name) + '</span><span class="small muted">' + r.time + " мин · " + esc(r.kcal) + " ккал · белок " + r.p + ' г</span><span class="small" style="color:' + (m.length ? "#B5562A" : "#3E7A52") + '">' + (m.length ? "Не хватает: " + esc(m.map((i) => (DICT[i.d].short || DICT[i.d].n.split(" ")[0]).toLowerCase()).join(", ")) : "Всё есть дома") + "</span></span></button>"; }).join("");
}
function vRecipes() {
  const r = S.recs.find((x) => x.id === ui.r.open);
  if (r) return vRecipe(r);
  let h = hdr("Моя кулинарная книга", "Рецепты", "");
  h += '<label class="row" style="min-height:46px;padding:0 14px;border-radius:14px;background:#fff;border:1px solid var(--line);box-shadow:var(--shadow)">' + ICON.search + '<input id="recQ" data-in="recQ" type="search" placeholder="Найти: тыква, тофу, суп…" aria-label="Поиск рецепта" value="' + esc(ui.r.q) + '" style="flex:1;min-width:0;border:none;outline:none;background:transparent;font-size:16px;font-weight:700"></label>';
  h += '<div class="hscroll">' + RF.map((f) => '<button class="chip' + (ui.r.filter === f[0] ? " on" : "") + '" data-a="recF" data-v="' + f[0] + '">' + f[1] + "</button>").join("") + "</div>";
  if (aiOn()) h += '<button class="btn" style="background:#EEEAF6;border-color:#D8D0EC" data-a="aiRec">Придумать новый рецепт с ИИ</button>';
  h += '<div id="recList" style="display:flex;flex-direction:column;gap:10px">' + recListHTML() + "</div>";
  return h;
}
function vRecipe(r) {
  const m = recMissing(r);
  let h = '<button class="btn" style="align-self:flex-start;min-height:40px;font-size:14px;gap:6px;padding:0 12px 0 8px" data-a="recBack">' + ICON.back + "Рецепты</button>";
  h += '<div class="row" style="gap:14px"><span class="plate" style="' + plateBG(recCols(r), 104) + ';box-shadow:0 0 0 6px #F6EFE4,0 3px 10px rgba(80,55,25,.15)"></span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">' + badgeHTML(r) + "<h2>" + esc(r.name) + "</h2></div></div>";
  h += '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">' + [[r.time + " мин", "время"], [String(r.kcal).replace("≈ ", "").replace(" на порцию", ""), "ккал ≈"], [r.p + " г", "белок"], [String(r.serv).split(" ")[0], "порции"]].map((s) => '<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:8px 4px;text-align:center"><p style="margin:0;font-size:14px;font-weight:800">' + esc(s[0]) + '</p><p class="small muted" style="margin:2px 0 0">' + s[1] + "</p></div>").join("") + "</div>";
  if (r.note) h += '<p class="p" style="padding:10px 12px;border-radius:14px;background:#E6EFF5;border:1px solid #C9DCE8;color:#2F4250">' + esc(r.note) + "</p>";
  h += '<section class="card"><div class="between"><h3>Ингредиенты</h3><span class="small muted">' + esc(r.serv) + "</span></div>" + r.ings.map((i) => { const st = ingStatus(i); const dot = st === null ? "background:#D9CBB8" : st === "no" ? "border:1.5px solid #B5562A;background:#fff" : "background:#4E9A64"; return '<div class="row" style="min-height:36px;border-top:1px solid var(--line2);gap:10px"><span class="ldot" style="flex:none;box-sizing:border-box;' + dot + '"></span><span style="flex:1;font-size:14px;font-weight:700">' + esc(i.n) + '</span><span style="font-size:13px;font-weight:800;color:#4F4237">' + esc(i.q) + "</span></div>"; }).join("");
  if (m.length) { const allIn = m.every((i) => S.shop.some((s) => !s.done && s.d === i.d)); h += '<button class="btn ' + (allIn ? "green" : "peach") + '" data-a="recBuy">' + (allIn ? "Недостающее в закупках ✓" : "Недостающее — в закупки (" + m.length + ")") + "</button>"; }
  h += "</section>";
  h += '<section style="display:flex;flex-direction:column;gap:8px"><h3>Приготовление</h3>' + stepsHTML(r.steps.map((s) => ({ text: s[0], device: s[1], tip: s[2] }))) + "</section>";
  h += '<section class="card"><h3>Как тебе?</h3><div class="lv">' + [["love", "Очень понравилось"], ["like", "Нормально"], ["meh", "Не моё"]].map((x) => '<button class="' + (r.rating === x[0] ? "on" : "") + '" data-a="recRate" data-v="' + x[0] + '">' + x[1] + '</button>').join("") + '</div><p class="small muted" style="margin:0;font-weight:600">Понравившиеся сочетания конструктор будет предлагать чаще.</p></section>';
  h += '<div class="btns"><button class="btn" data-a="recToBuilder">В конструктор</button><button class="btn acc" style="flex:1.3" data-a="recCook">Приготовила — списать</button></div>';
  if (r.src === "конструктор" || r.src === "мой рецепт") h += '<button class="btn ghost" data-a="recDel">Удалить рецепт</button>';
  return h;
}

/* ==================== ДНЕВНИК ==================== */
const MEALS = [["b", "Завтрак", "#F6E3B0"], ["l", "Обед", "#DDEDD3"], ["d", "Ужин", "#E5DFF3"], ["s", "Перекус", "#F6DFC8"]];
const MEALN = { b: "завтрак", l: "обед", d: "ужин", s: "перекус" };
const daySum = (date) => S.diary.filter((e) => e.date === date).reduce((a, e) => ({ k: a.k + (e.kcal || 0), p: a.p + (e.p || 0) }), { k: 0, p: 0 });
function vDiary() {
  const sel = ui.dy.date, t = today();
  const mon = addDays(sel, -wdIdx(sel));
  const dm = new Date(sel + "T12:00:00");
  let h = hdr(MONTHS1[dm.getMonth()] + " " + dm.getFullYear(), "Дневник", "");
  h += '<div class="between"><button class="chip" data-a="dWeek" data-v="-7">‹ Неделя</button>' + (sel !== t ? '<button class="chip" data-a="dDay" data-v="' + t + '">Сегодня</button>' : "") + '<button class="chip" data-a="dWeek" data-v="7">Неделя ›</button></div>';
  h += '<div class="days">' + WD.map((w, i) => { const d = addDays(mon, i), s = daySum(d); return '<button class="' + (d === sel ? "on" : "") + (d === t ? " today" : "") + '" data-a="dDay" data-v="' + d + '" aria-label="' + WDF[i] + ", " + fmtD(d) + '"><span class="small muted">' + w + '</span><span style="font-size:16px;font-weight:800">' + new Date(d + "T12:00:00").getDate() + '</span><span style="width:6px;height:6px;border-radius:50%;background:' + (s.k ? (s.p >= 80 ? "#4E9A64" : "#E8A93A") : "transparent") + '"></span></button>'; }).join("") + "</div>";
  const s = daySum(sel), pct = Math.min(100, Math.round(s.p / 110 * 100)), future = sel > t;
  const note = !s.k ? (future ? "День ещё впереди." : "Пока ничего не записано.") : s.p >= 80 ? "В ориентире — отлично." : sel === t ? "До 80 г не хватает ≈ " + (80 - s.p) + " г. Блюдо с тофу, рыбой, яйцами или бобовыми закроет большую часть." : "Чуть ниже ориентира — это нормально, важнее картина за неделю.";
  h += '<section class="card big"><div class="between"><h3>' + (sel === t ? "Сегодня, " : cap(WDF[wdIdx(sel)]) + ", ") + fmtD(sel) + '</h3><span class="small muted">≈ ' + s.k + ' ккал</span></div><div class="between small"><span style="color:#3E7A52;font-weight:800">Белок ≈ ' + s.p + ' г</span><span class="muted">ориентир 80–100 г</span></div><div style="position:relative;height:12px;border-radius:6px;background:#EFE4D4;overflow:hidden"><div style="position:absolute;left:73%;width:18%;top:0;bottom:0;background:rgba(78,154,100,.18)"></div><div style="position:absolute;left:0;top:0;bottom:0;width:' + pct + "%;border-radius:6px;background:" + (s.p >= 80 ? "#4E9A64" : "#E8A93A") + '"></div></div><p class="small muted" style="margin:0;font-weight:600">' + note + "</p></section>";
  MEALS.forEach((m) => {
    const list = S.diary.filter((e) => e.date === sel && e.meal === m[0]);
    h += '<section class="card" aria-label="' + m[1] + '"><div class="between"><span class="pill" style="background:' + m[2] + '">' + m[1] + '</span><button class="chip" style="min-height:34px" data-a="dAdd" data-v="' + m[0] + '">+ Добавить</button></div>';
    list.forEach((e) => {
      const op = ui.dy.open === e.id;
      const rb = BADGE[e.rate];
      h += '<div style="border-top:1px solid var(--line2);padding-top:8px;display:flex;flex-direction:column;gap:6px"><button data-a="dOpen" data-id="' + e.id + '" aria-expanded="' + op + '" style="display:flex;align-items:center;gap:10px;border:none;background:transparent;padding:0;text-align:left;width:100%"><span class="plate" style="' + plateBG(e.cols || [], 40) + ';box-shadow:0 0 0 3px #F6EFE4"></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:800;line-height:1.3">' + esc(e.name) + '</span><span class="small muted">' + esc(e.time || "") + (e.kcal ? " · ≈ " + e.kcal + " ккал" : "") + (e.p ? " · белок " + e.p + " г" : "") + "</span></span>" + (rb && e.rate !== "none" ? '<span class="tag" style="background:' + rb[1] + ";color:" + rb[2] + ';font-size:10px">' + rb[0].split(" · ")[0].toLowerCase() + "</span>" : "") + "</button>";
      if (op) h += '<div style="padding:8px 10px;border-radius:12px;background:var(--bg);display:flex;flex-direction:column;gap:6px">' + (e.ings ? '<span class="small" style="color:#4F4237;line-height:1.45">' + esc(e.ings) + "</span>" : "") + '<span class="small muted">' + esc(e.src || "") + '</span><button class="btn ghost" style="min-height:36px;align-self:flex-start" data-a="dDel" data-id="' + e.id + '">Удалить запись</button></div>';
      h += "</div>";
    });
    if (!list.length) h += '<p class="p soft" style="margin:0">' + (future ? "Можно запланировать заранее." : "Ничего не записано.") + "</p>";
    h += "</section>";
  });
  // неделя
  const vals = WD.map((w, i) => daySum(addDays(mon, i)));
  const filled = vals.filter((v) => v.k > 0);
  const avg = filled.length ? Math.round(filled.reduce((a, v) => a + v.p, 0) / filled.length) : 0;
  h += '<section class="card big"><div class="between"><h3>Белок за неделю</h3><span class="small muted">в среднем ≈ ' + avg + ' г</span></div><div class="bars"><div style="position:absolute;left:0;right:0;bottom:64%;height:0;border-top:1.5px dashed #9FC4A8"></div>' + vals.map((v, i) => '<div><span style="font-size:10px;font-weight:800;color:#4F4237">' + (v.p || "") + '</span><span style="width:100%;max-width:26px;height:' + Math.round(Math.min(v.p, 125) / 125 * 100) + "%;min-height:" + (v.p ? 4 : 0) + "px;border-radius:6px 6px 3px 3px;background:" + (addDays(mon, i) === sel ? "#D9703F" : v.p >= 80 ? "#7FB08A" : "#E8C887") + '"></span></div>').join("") + '</div><div class="days" style="gap:8px">' + WD.map((w) => '<span class="small muted" style="text-align:center">' + w + "</span>").join("") + '</div><p class="small soft" style="margin:0;font-weight:600">Пунктир — 80 г, нижняя граница ориентира.</p></section>';
  // разнообразие за 7 дней до выбранного дня
  const cnt = {};
  S.diary.filter((e) => e.date <= sel && e.date > addDays(sel, -7)).forEach((e) => (e.ds || []).forEach((id) => { const n = DICT[id] ? (DICT[id].short || DICT[id].n.split(" ")[0]).toLowerCase() : id; cnt[n] = (cnt[n] || 0) + 1; }));
  const topK = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 8);
  if (topK.length) {
    const heavy = topK.filter((k) => cnt[k] >= 4);
    const raz = (n) => n + " " + plural(n, "раз", "раза", "раз");
    h += '<section class="card" style="background:#FDF3DC;border-color:#EBD49A"><h3>Разнообразие за 7 дней</h3><div class="chips">' + topK.map((k) => '<span class="tag" style="font-size:12px;padding:4px 10px;background:' + (cnt[k] >= 4 ? "#F6DFC8" : "#fff") + '">' + esc(k) + " · " + cnt[k] + "</span>").join("") + '</div><p class="p">' + (heavy.length ? "Чаще всего: " + heavy.slice(0, 2).map((k) => k + " (" + raz(cnt[k]) + ")").join(" и ") + ". Для разнообразия попробуй в конструкторе то, чего давно не было." : "Хорошее разнообразие — продолжай в том же духе.") + "</p></section>";
  }
  h += '<p class="small soft" style="margin:0;font-weight:600">Блюда попадают сюда сами, когда нажимаешь «Приготовила — списать» в конструкторе или рецепте.</p>';
  return h;
}
function shDiaryAdd(sh) {
  let h = '<div class="between"><h2>Добавить в ' + MEALN[sh.meal] + '</h2><button class="ibtn" data-a="close" aria-label="Закрыть">' + ICON.x + "</button></div>";
  h += '<nav class="seg">' + [["quick", "Из рецептов"], ["manual", "Вручную"]].map((x) => '<button class="' + (sh.tab === x[0] ? "on" : "") + '" data-a="daTab" data-v="' + x[0] + '">' + x[1] + "</button>").join("") + "</nav>";
  if (sh.tab === "manual") {
    h += '<label class="lbl">Что ела<input class="in" id="daName" data-in="daName" value="' + esc(sh.name || "") + '" placeholder="Например, сырники с вареньем"></label><div class="btns"><label class="lbl">Ккал (примерно)<input class="in" id="daK" data-in="daK" type="number" inputmode="numeric" value="' + esc(sh.k || "") + '"></label><label class="lbl">Белок, г<input class="in" id="daP" data-in="daP" type="number" inputmode="numeric" value="' + esc(sh.p || "") + '"></label></div><button class="btn acc" data-a="daManual">Записать</button>';
    return h;
  }
  const seen = {}, quick = [];
  S.diary.slice().sort((a, b) => (b.t || 0) - (a.t || 0)).forEach((e) => { if (!seen[e.name] && quick.length < 6) { seen[e.name] = 1; quick.push({ k: "d", e: e }); } });
  S.recs.forEach((r) => { if (!seen[r.name]) { seen[r.name] = 1; quick.push({ k: "r", r: r }); } });
  h += quick.map((q, i) => { const name = q.k === "d" ? q.e.name : q.r.name; const kc = q.k === "d" ? q.e.kcal : avgNums(q.r.kcal); const p = q.k === "d" ? q.e.p : q.r.p; const cols = q.k === "d" ? q.e.cols || [] : recCols(q.r); return '<button class="rcard" style="min-height:56px;padding:8px 12px" data-a="daQuick" data-v="' + i + '"><span class="plate" style="' + plateBG(cols, 36) + ';box-shadow:0 0 0 3px #F6EFE4"></span><span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;font-weight:800">' + esc(name) + '</span><span class="small muted">' + (kc ? "≈ " + kc + " ккал · " : "") + "белок " + (p || 0) + ' г</span></span><span style="font-size:20px;font-weight:800;color:var(--acc)">+</span></button>'; }).join("");
  sh._quick = quick;
  return h;
}

/* ==================== ЗАКУПКИ ==================== */
const WHY = { recipe: ["#F7E6EA", "#8E2E45"], low: ["#FDF3DC", "#6B4E12"], idea: ["#E6EFF5", "#2F4250"], manual: ["#F3EEE7", "#5E5249"], opt: ["#F3EEE7", "#5E5249"] };
function shopAdd(o) {
  if (o.d && S.shop.some((x) => !x.done && x.d === o.d)) { const ex = S.shop.find((x) => !x.done && x.d === o.d); if (o.why) o.why.forEach((w) => { if (!ex.why.some((y) => y[1] === w[1])) ex.why.push(w); }); return false; }
  const d = DICT[o.d];
  S.shop.push({ id: uid(), name: o.name || (d ? d.n : ""), qty: o.qty || "", cat: o.cat || (d && d.cat) || "other", d: o.d || null, pid: o.pid || null, why: o.why || [], opt: !!o.opt, done: false, t: Date.now() });
  return true;
}
function shopText(withNotes, withOpt) {
  const lines = ["Список покупок · " + fmtD(today()), ""];
  SHOP_CATS.forEach((c) => {
    const its = S.shop.filter((x) => x.cat === c[0] && !x.done && (withOpt || !x.opt));
    if (!its.length) return;
    lines.push(c[1] + ":");
    its.forEach((x) => { let l = "☐ " + x.name + (x.qty ? " — " + x.qty : ""); if (x.opt) l += " (по желанию)"; if (withNotes) { const w = x.why.filter((y) => y[0] === "recipe" || y[0] === "idea").map((y) => y[1]); if (w.length) l += " — для: " + w.join(", "); } lines.push(l); });
    lines.push("");
  });
  return lines.join("\n").trim();
}
function vShop() {
  const vis = S.shop.filter((x) => !(ui.sh.hideOpt && x.opt));
  const todo = vis.filter((x) => !x.done), done = S.shop.filter((x) => x.done);
  let h = hdr(todo.length ? "Осталось купить " + todo.length + " из " + vis.length : S.shop.length ? "Всё куплено" : "Список пуст", "Закупки", '<button class="ibtn" data-a="share" aria-label="Поделиться списком">' + ICON.share + "</button>");
  h += '<div style="height:8px;border-radius:4px;background:#EFE4D4;overflow:hidden"><div style="height:100%;width:' + (vis.length ? Math.round((vis.length - todo.length) / vis.length * 100) : 0) + '%;background:#4E9A64;border-radius:4px"></div></div>';
  h += '<div class="row"><input class="in" id="shDraft" data-in="shDraft" placeholder="Добавить: например, лимоны" value="' + esc(ui.sh.draft) + '" enterkeyhint="done"><button class="ibtn acc" data-a="shAdd" aria-label="Добавить в список">' + ICON.plus + '</button></div>';
  if (S.shop.some((x) => x.opt)) h += '<button class="chip' + (ui.sh.hideOpt ? " on" : "") + '" style="align-self:flex-start" data-a="shOpt">' + (ui.sh.hideOpt ? "Показать всё" : "Только нужное") + "</button>";
  if (!S.shop.length) h += '<div class="empty"><h3>Здесь пока пусто</h3><p class="p">Продукты попадают сюда кнопкой «В закупки» в карточке продукта, из рецепта («Недостающее — в закупки») и из конструктора. Или впиши вручную в поле выше.</p></div>';
  SHOP_CATS.forEach((c) => {
    const its = todo.filter((x) => x.cat === c[0]);
    if (!its.length) return;
    h += '<section class="card"><div class="between"><span class="pill" style="background:' + c[2] + '">' + c[1] + '</span><span class="small soft">' + its.length + " шт.</span></div>" + its.map((x) => {
      const tags = x.why.map((w) => '<span class="tag" style="font-size:11px;font-weight:700;background:' + (WHY[w[0]] || WHY.manual)[0] + ";color:" + (WHY[w[0]] || WHY.manual)[1] + '">' + esc((w[0] === "recipe" || w[0] === "idea" ? "для: " : "") + w[1]) + "</span>").join("") + (x.opt ? '<span class="tag" style="font-size:11px;font-weight:700;background:#F3EEE7;color:#5E5249">по желанию</span>' : "");
      return '<label class="check"><input type="checkbox" data-ch="shDone" data-id="' + x.id + '"><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font-size:15px;font-weight:800">' + esc(x.name) + "</span>" + (tags ? '<span class="chips" style="gap:4px">' + tags + "</span>" : "") + '</span><span style="font-size:13px;font-weight:800;color:#4F4237">' + esc(x.qty) + '</span><button class="x" style="border:none;background:transparent;width:30px;height:40px" data-a="shDel" data-id="' + x.id + '" aria-label="Удалить ' + esc(x.name) + '">' + ICON.x + "</button></label>";
    }).join("") + "</section>";
  });
  if (done.length) {
    h += '<section class="card" style="background:rgba(255,255,255,.6);border-style:dashed"><span class="pill" style="background:#DDEDD3;color:#2F4A22">В корзине · ' + done.length + "</span>" + done.map((x) => '<label class="row" style="min-height:40px"><input type="checkbox" checked data-ch="shDone" data-id="' + x.id + '" style="width:20px;height:20px;accent-color:#4E9A64"><span style="flex:1;font-size:14px;font-weight:600;color:var(--soft);text-decoration:line-through">' + esc(x.name) + '</span><span class="small soft">' + esc(x.qty) + "</span></label>").join("") + '<button class="btn acc" data-a="shUnpack">Купила — разложить по полкам</button></section>';
  }
  return h;
}
function shShare(sh) {
  const text = shopText(sh.notes, sh.opt);
  sh._text = text;
  return '<h2>Поделиться списком</h2><div class="chips"><button class="chip' + (sh.notes ? " on" : "") + '" data-a="shrNotes">Пометки «для чего»</button><button class="chip' + (sh.opt ? " on" : "") + '" data-a="shrOpt">Необязательное</button></div><pre class="share">' + esc(text) + '</pre><div class="btns"><button class="btn" data-a="shrCopy">' + (sh.copied ? "Скопировано ✓" : "Скопировать") + '</button><button class="btn acc" style="flex:1.3" data-a="shrSend">Отправить…</button></div><p class="small muted" style="margin:0;font-weight:600">«Отправить» откроет меню iPhone: Telegram, WhatsApp, Сообщения, Заметки.</p>';
}


/* ==================== ИИ (YandexGPT через функцию в Yandex Cloud) ==================== */
const DEFAULT_PREFS = "Не ем перец (включая болгарский), мясо и курицу. Не люблю креветки, консервированный тунец, обычный творог (только в сырниках и выпечке), греческий йогурт и кисломолочные заправки. Сыр — понемногу, не основа блюда. Люблю: большие тёплые салаты и боулы, хрустящие овощи в кукурузном крахмале, азиатские вкусы, кисло-сладкие и кунжутные заправки, запечённые овощи с румяными краями, нут, фасоль, чечевицу, эдамаме, киноа, рис, собу, яйца, рыбу (лосось, форель, треска), тыкву, крем-супы, ресторанную подачу. Хочу 80–100 г белка в день; ужин полегче — 300–450 ккал, но сытный. Техника: аэрогриль (корзина небольшая), мультиварка, индукционная плита, сковорода, блендер. Духовки нет. Готовить недолго — 15–40 минут.";
function getPrefs() { const u = S.udict.find((x) => x.id === "prefs"); return (u && u.text) || DEFAULT_PREFS; }
function aiOn() { return !!(window.KL_CONFIG && window.KL_CONFIG.ai); }
async function aiCall(payload) {
  if (!aiOn()) throw new Error("ИИ ещё не подключён — см. инструкцию.");
  if (!SB) throw new Error("Сначала подключи сервер: ☁︎ в правом верхнем углу.");
  let ses = null; try { ses = (await SB.auth.getSession()).data.session; } catch (e) {}
  if (!ses) throw new Error("Чтобы пользоваться ИИ, войди: ☁︎ в правом верхнем углу.");
  // Authorization зарезервирован платформой Yandex для её IAM-токена.
  let r; try { r = await fetch(window.KL_CONFIG.ai, { method: "POST", headers: { "Content-Type": "application/json", "X-Supabase-Authorization": "Bearer " + ses.access_token }, body: JSON.stringify(payload) }); } catch (e) { throw new Error("Не удалось связаться с ИИ. Возможна проблема с интернетом или доступом к сервису."); }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.status === 403) throw new Error("Доступ к ИИ запрещён (403). Нужно проверить настройки доступа облачной функции.");
  if (!r.ok || !j || !j.ok) throw new Error((j && typeof j.error === "string" && j.error) || "ИИ не ответил (ошибка " + r.status + ")");
  return j.data;
}
function registerAI() {
  (S.udict || []).filter((u) => u.kind === "ai" && u.dict).forEach((u) => {
    const d = Object.assign({}, u.dict, { id: u.id, ai: true });
    DICT[u.id] = d; const i = DICT_LIST.findIndex((x) => x.id === u.id); if (i >= 0) DICT_LIST[i] = d; else DICT_LIST.push(d);
  });
}
const TARA_IDS = TARA.map((t) => t[0]);
const SLOT_IDS = SLOTS.map((s) => s[0]);
const num = (v, def) => { const n = Number(v); return isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : def; };
function zoneForPlace(place, cat) {
  if (place === "fridge" && cat === "veg") return "fv";
  if (place === "fridge" && cat === "protein") return "ff";
  const z = zonesOf(PLACES.some((p) => p.id === place) ? place : "fridge")[0];
  return z ? z.id : "f1";
}
function aiSaveProduct(name, r) {
  if (r && r.same && DICT[r.same] && !DICT[r.same].virtual) return r.same;
  const t = TARA_IDS.indexOf(r.t) >= 0 ? r.t : "jar";
  const cat = SHOP_CATS.some((c) => c[0] === r.cat) ? r.cat : "other";
  const slot = SLOT_IDS.indexOf(r.slot) >= 0 ? r.slot : undefined;
  const ts = {}; ["salt", "sour", "sweet", "umami", "fat", "crunch"].forEach((k) => { const v = num(r.ts && r.ts[k], 0); if (v) ts[k] = Math.min(2, v); });
  const g = num(r.g, 50) || 50;
  const d = { n: cap(String(r.n || name).slice(0, 60)), t: t, c: /^#[0-9a-f]{6}$/i.test(r.c || "") ? r.c : "#C9B79A", cell: ["round", "stick", "egg", "tub"].indexOf(r.cell) >= 0 ? r.cell : "round", n0: Math.max(1, Math.min(12, Math.round(num(r.n0, 1)))), z: zoneForPlace(r.place, cat), s: Math.max(1, Math.round(num(r.s, 7))), cat: cat, k: num(r.k, 0), p: num(r.p, 0), f: num(r.f, 0), cb: num(r.cb, 0), note: String(r.note || "").slice(0, 200), syn: name.toLowerCase() };
  if (slot) {
    d.slot = slot; d.g = g; d.st = g <= 30 ? 5 : 10; d.ts = ts;
    const grp = { greens: "greens", crunch: "crunch" }[slot] || (slot === "veg" && !(r.prep && r.prep.text) ? "fresh" : "");
    d.pr = r.prep && r.prep.text ? [Math.max(1, Math.min(5, Math.round(num(r.prep.order, 3)))), "", String(r.prep.text).slice(0, 300), String(r.prep.device || "").slice(0, 80), String(r.prep.tip || "").slice(0, 200)] : [slot === "crunch" ? 5 : 4, grp, "", "", ""];
  }
  const id = "ai:" + name.toLowerCase().replace(/[^a-zа-яё0-9]+/g, "-").slice(0, 40);
  const ex = S.udict.find((u) => u.id === id);
  if (ex) ex.dict = d; else S.udict.push({ id: id, kind: "ai", dict: d });
  registerAI();
  return id;
}
function aiProduct() {
  const sh = ui.sheet; if (!sh || sh.aiBusy) return;
  const name = sh.type === "add" ? sh.pick.n : (prodById(sh.id) || {}).name; if (!name) return;
  sh.aiBusy = true; sh.aiErr = ""; render();
  aiCall({ task: "product", name: name, known: DICT_LIST.filter((x) => !x.virtual && !x.ai).map((x) => [x.id, x.n]) }).then((r) => {
    const id = aiSaveProduct(name, r); sh.aiBusy = false;
    if (ui.sheet !== sh) { commit(); return; }
    if (sh.type === "add") { A.addLink({ v: id }); commit(); }
    else { const p = prodById(sh.id); if (p) { p.d = id; learnLink(p.name, id); } commit(); }
    toast(DICT[id].ai ? "Распознала: " + DICT[id].n + (DICT[id].k ? " · ≈ " + DICT[id].k + " ккал на 100 г" : "") : "Похоже на «" + DICT[id].n + "» — связала");
  }, (e) => { sh.aiBusy = false; sh.aiErr = e.message; render(); });
}
function aiStock() {
  const seen = {}; const out = [];
  S.prods.filter((p) => !isEmptyP(p)).forEach((p) => { const k = p.name.toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push([p.d && DICT[p.d] ? (DICT[p.d].ref || p.d) : "", p.name, pStatus(p), leftText(p), zoneById(p.zone).place]); });
  return out.slice(0, 150);
}
function aiRecipe() {
  const sh = ui.sheet; if (!sh || sh.busy) return;
  sh.busy = true; sh.err = ""; sh.saved = false; render();
  const recent = S.diary.filter((e) => e.date > addDays(today(), -7)).map((e) => e.name).slice(-20);
  const loved = S.recs.filter((r) => r.rating === "love").map((r) => r.name).slice(0, 10);
  const disliked = S.recs.filter((r) => r.rating === "meh").map((r) => r.name).slice(0, 10);
  aiCall({ task: "recipe", mode: sh.mode, wish: (sh.wish || "").slice(0, 300), prefs: getPrefs().slice(0, 2000), stock: aiStock(), recent: recent, loved: loved, disliked: disliked, avoid: sh.res ? [sh.res.name] : [], codes: DICT_LIST.filter((d) => d.slot && !d.virtual).map((d) => [d.id, d.n]) }).then((r) => {
    sh.busy = false; sh.res = aiClean(r); render(); const el = $("#sheet .sheet"); if (el) el.scrollTop = 0;
  }, (e) => { sh.busy = false; sh.err = e.message; render(); });
}
function aiClean(r) {
  const ings = (Array.isArray(r.ings) ? r.ings : []).slice(0, 25).map((i) => ({ n: String(i.n || "").slice(0, 80), q: String(i.q || "").slice(0, 40), d: i.d && DICT[i.d] ? i.d : null, g: num(i.g, 0) || undefined })).filter((i) => i.n);
  const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 15).map((s) => typeof s === "string" ? [s, "", ""] : [String(s.text || "").slice(0, 500), String(s.device || "").slice(0, 100), String(s.tip || "").slice(0, 300)]).filter((s) => s[0]);
  const kcal = Math.round(num(r.kcal, 0));
  return { name: String(r.name || "Рецепт").slice(0, 90), time: Math.round(num(r.time, 30)) || 30, serv: String(r.serv || "1 порция").slice(0, 30), kcal: kcal, p: Math.round(num(r.p, 0)), note: String(r.note || "").slice(0, 400), ings: ings, steps: steps };
}
function aiToRecipe(r) {
  return { id: "r-" + uid(), name: r.name, rating: "new", time: r.time, serv: r.serv, kcal: r.kcal ? "≈ " + r.kcal : "?", kmax: r.kcal || 999, p: r.p, tags: r.steps.some((s) => /Аэрогриль/i.test(s[1] || "")) ? ["airfryer"] : [], src: "ИИ", note: r.note, ings: r.ings, steps: r.steps };
}
function shAiRec(sh) {
  let h = '<div class="between"><h2>Придумать с ИИ</h2><button class="ibtn" data-a="close" aria-label="Закрыть">' + ICON.x + "</button></div>";
  h += '<label class="lbl">Пожелание — необязательно<input class="in" id="aiWish" data-in="aiWish" value="' + esc(sh.wish || "") + '" placeholder="Например: лёгкий ужин, что-то с тыквой, на двоих"></label>';
  h += '<div class="chips">' + [["stock", "Только из того, что есть"], ["ideas", "Можно докупить 1–3 продукта"]].map((m) => '<button class="chip' + (sh.mode === m[0] ? " on" : "") + '" data-a="aiMode" data-v="' + m[0] + '">' + m[1] + "</button>").join("") + "</div>";
  h += '<button class="btn acc" data-a="aiGo"' + (sh.busy ? " disabled" : "") + ">" + (sh.busy ? "Думаю… обычно 10–30 секунд" : sh.res ? "Другой вариант" : "Придумать") + "</button>";
  if (sh.err) h += '<p class="small" style="color:#C2452F;margin:0">' + esc(sh.err) + "</p>";
  const r = sh.res;
  if (r) {
    const cols = r.ings.filter((i) => i.d).map((i) => DICT[i.d].c).slice(0, 6);
    h += '<div class="row" style="gap:12px;margin-top:6px"><span class="plate" style="' + plateBG(cols, 72) + '"></span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><h2 style="font-size:19px">' + esc(r.name) + '</h2><span class="small muted">' + r.time + " мин · " + esc(r.serv) + (r.kcal ? " · ≈ " + r.kcal + " ккал" : "") + (r.p ? " · белок " + r.p + " г" : "") + "</span></div></div>";
    if (r.note) h += '<p class="p" style="padding:10px 12px;border-radius:14px;background:#EEEAF6;border:1px solid #D8D0EC">' + esc(r.note) + "</p>";
    h += '<section class="card"><h3>Ингредиенты</h3>' + r.ings.map((i) => { const st = ingStatus(i); const dot = st === null ? "background:#D9CBB8" : st === "no" ? "border:1.5px solid #B5562A;background:#fff" : "background:#4E9A64"; return '<div class="row" style="min-height:34px;border-top:1px solid var(--line2);gap:10px"><span class="ldot" style="flex:none;box-sizing:border-box;' + dot + '"></span><span style="flex:1;font-size:14px;font-weight:700">' + esc(i.n) + '</span><span style="font-size:13px;font-weight:800;color:#4F4237">' + esc(i.q) + "</span></div>"; }).join("") + "</section>";
    h += '<section style="display:flex;flex-direction:column;gap:8px"><h3>Приготовление</h3>' + stepsHTML(r.steps.map((s) => ({ text: s[0], device: s[1], tip: s[2] }))) + "</section>";
    h += '<div class="btns"><button class="btn' + (sh.saved ? " green" : "") + '" data-a="aiSave"' + (sh.saved ? " disabled" : "") + ">" + (sh.saved ? "В рецептах ✓" : "Сохранить в рецепты") + "</button>" + (r.ings.some((i) => i.d && i.g && DICT[i.d].slot) ? '<button class="btn" data-a="aiBuild">В конструктор</button>' : "") + "</div>";
    h += '<p class="small soft" style="margin:0;font-weight:600">Калории и белок ИИ оценивает примерно — для точности открой рецепт в конструкторе.</p>';
  }
  return h;
}


/* ---------- добавление по фото ---------- */
function fileToJpeg(file, max) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); res(c.toDataURL("image/jpeg", 0.85).split(",")[1]); };
    img.onerror = () => rej(new Error("Не получилось открыть фото"));
    img.src = URL.createObjectURL(file);
  });
}
function photoStart(file) {
  const sh = { type: "photo", busy: true, items: [], err: "" }; ui.sheet = sh; render();
  fileToJpeg(file, 1600).then((b64) => aiCall({ task: "photo", image: b64, known: DICT_LIST.filter((x) => !x.virtual && !x.ai).map((x) => [x.id, x.n]) })).then((r) => {
    sh.busy = false;
    sh.items = (r && Array.isArray(r.items) ? r.items : []).slice(0, 30).map((it) => {
      const same = it.same && DICT[it.same] && !DICT[it.same].virtual ? it.same : null;
      const base = same ? DICT[same] : null;
      const t = base ? dictDefaults(base).t : (TARA_IDS.indexOf(it.t) >= 0 ? it.t : "jar");
      const zone = base ? dictDefaults(base).z : zoneForPlace(it.place, it.cat);
      const exp = /^\d{4}-\d{2}-\d{2}$/.test(it.exp || "") ? it.exp : null;
      const s = base ? base.s : num(it.s, 7);
      return { on: true, raw: it, name: cap(String(it.name || "Продукт").slice(0, 60)), same: same, t: t, zone: zone, count: Math.max(1, Math.min(30, Math.round(num(it.count, 1) || 1))), pk: num(it.pk, 0) || (base && base.pk) || null, u: ["г", "мл", "шт"].indexOf(it.u) >= 0 ? it.u : (base && base.u) || "г", exp: exp || (s && s < 999 ? addDays(today(), s) : null), expSeen: !!exp };
    });
    if (ui.sheet === sh) render();
  }, (e) => { sh.busy = false; sh.err = e.message; if (ui.sheet === sh) render(); });
}
function shPhoto(sh) {
  let h = '<div class="between"><h2>Продукты с фото</h2><button class="ibtn" data-a="close" aria-label="Закрыть">' + ICON.x + "</button></div>";
  if (sh.busy) return h + '<div class="empty"><h3>Читаю надписи на упаковках…</h3><p class="p">Обычно 10–30 секунд.</p></div>';
  if (sh.err) return h + '<p class="p" style="color:#C2452F">' + esc(sh.err) + '</p><label class="btn" style="cursor:pointer">Попробовать другое фото<input type="file" accept="image/*" data-ch="photo" style="display:none"></label>';
  if (!sh.items.length) return h + '<div class="empty"><h3>Не нашла продуктов</h3><p class="p">Я распознаю продукты по надписям на упаковках. Попробуй сфотографировать ближе и ровнее, чтобы название читалось.</p></div><label class="btn" style="cursor:pointer">Другое фото<input type="file" accept="image/*" data-ch="photo" style="display:none"></label>';
  h += '<p class="p">Проверь и поправь, если нужно. Сняла галочку — не добавлю.</p>';
  sh.items.forEach((it, i) => {
    const z = zoneById(it.zone);
    h += '<div class="card" style="padding:10px;gap:8px' + (it.on ? "" : ";opacity:.5") + '"><div class="row" style="gap:10px"><input type="checkbox" aria-label="Добавить этот продукт" data-ch="phOn" data-i="' + i + '"' + (it.on ? " checked" : "") + ' style="width:22px;height:22px;accent-color:#4E9A64;flex:none"><input class="in" style="min-height:40px;font-size:15px" id="phN' + i + '" data-in="phName" data-i="' + i + '" value="' + esc(it.name) + '"></div>';
    h += '<div class="small muted" style="font-weight:700">' + esc(zoneLabel(z)) + (it.pk ? " · " + fmtQ(it.pk, it.u) + " в упаковке" : "") + (it.same ? " · как «" + esc(DICT[it.same].n) + "»" : " · новый продукт") + "</div>";
    h += '<div class="row" style="flex-wrap:wrap"><span class="small">Упаковок</span><button class="chip" style="min-height:34px;padding:0 10px" data-a="phCount" data-i="' + i + '" data-v="-1">−</button><span style="font-weight:800">' + it.count + '</span><button class="chip" style="min-height:34px;padding:0 10px" data-a="phCount" data-i="' + i + '" data-v="1">+</button><span class="small" style="margin-left:8px">до</span><input type="date" class="in" style="width:auto;min-height:36px;font-size:14px;padding:0 8px" data-ch="phExp" data-i="' + i + '" value="' + (it.exp || "") + '"></div>' + (it.expSeen ? '<span class="small" style="color:#3E7A52">Дату взяла с упаковки</span>' : "") + "</div>";
  });
  const n = sh.items.filter((x) => x.on).length;
  h += '<button class="btn acc" data-a="phCommit"' + (n ? "" : " disabled") + ">Положить выбранные (" + n + ")</button>";
  h += '<p class="small soft" style="margin:0;font-weight:600">Овощи и продукты без надписей на фото не видны — их добавь вручную.</p>';
  return h;
}

/* ---------- «Приготовила» ---------- */
function openCook(o) {
  const upd = {};
  (o.uses || []).forEach((u) => { const p = prodFor(u.d); if (!p || upd[p.id]) return; if (p.t === "count") { const guess = u.d === "eggs" ? Math.max(1, Math.round((u.g || 50) / 50)) : 1; upd[p.id] = { have: Math.max(0, p.have - guess) }; } else if (p.pk && u.g && p.u !== "шт") upd[p.id] = { l: Math.max(0, Math.round(((p.l || 0) - u.g / p.pk) * 100) / 100), auto: true }; else upd[p.id] = { l: p.l }; });
  ui.sheet = Object.assign({ type: "cook", meal: mealByTime(), rate: null, upd: upd }, o);
  render();
}
function shCook(sh) {
  let h = '<h2>Приятного аппетита!</h2><p class="p">' + esc(sh.name) + (sh.kcal ? " · ≈ " + sh.kcal + " ккал" : "") + (sh.p ? " · белок " + sh.p + " г" : "") + "</p>";
  h += '<div class="lbl">Записать в дневник как</div><div class="chips">' + MEALS.map((m) => '<button class="chip' + (sh.meal === m[0] ? " on" : "") + '" data-a="ckMeal" data-v="' + m[0] + '">' + m[1] + "</button>").join("") + "</div>";
  h += '<div class="lbl">Как получилось?</div><div class="lv">' + [["love", "Очень понравилось"], ["like", "Нормально"], ["meh", "Не моё"]].map((x) => '<button class="' + (sh.rate === x[0] ? "on" : "") + '" data-a="ckRate" data-v="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>";
  const ids = Object.keys(sh.upd);
  if (ids.length) {
    h += '<div class="lbl">Сколько осталось — поправь, что изменилось</div>';
    ids.forEach((pid) => {
      const p = prodById(pid); if (!p) return; const u = sh.upd[pid];
      const pv = Object.assign({}, p, u.have != null ? { have: u.have } : {}, u.l != null ? { l: u.l } : {});
      h += '<div class="card" style="padding:8px 10px;flex-direction:row;align-items:center;gap:10px' + (u.gone ? ";opacity:.5" : "") + '"><span style="flex:none">' + pViz(pv, 44) + '</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span style="font-size:14px;font-weight:800">' + esc(p.name) + "</span>";
      if (u.gone) h += '<span class="small muted">закончилось</span>';
      else if (p.t === "count") h += '<span class="row"><button class="chip" style="min-height:34px;padding:0 10px" data-a="ckCount" data-id="' + pid + '" data-v="-1">−</button><span class="small">' + u.have + " из " + p.max + '</span><button class="chip" style="min-height:34px;padding:0 10px" data-a="ckCount" data-id="' + pid + '" data-v="1">+</button></span>';
      else if (p.t !== "can" && p.pk && u.l != null) h += '<span class="small muted">' + (u.auto ? "Списала по рецепту — " : "") + "осталось ≈ " + fmtQ(u.l * p.pk, p.u) + ((p.packs || 1) > 1 && u.l <= 0.02 ? ", открою новую упаковку" : "") + "</span>";
      if (!u.gone && p.t !== "can" && p.t !== "count") h += '<span style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px">' + [[0.1, "Нет"], [0.35, "Мало"], [0.6, "½"], [1, "Полная"]].map((o) => '<button class="chip' + (Math.abs((u.l || 0) - o[0]) < 0.13 ? " on" : "") + '" style="min-height:34px;padding:0 2px;font-size:12px" data-a="ckLevel" data-id="' + pid + '" data-v="' + o[0] + '">' + o[1] + "</button>").join("") + "</span>";
      h += '</span><button class="chip' + (u.gone ? " on" : "") + '" style="min-height:34px;padding:0 8px;font-size:12px" data-a="ckGone" data-id="' + pid + '">' + (u.gone ? "Вернуть" : "Всё") + "</button></div>";
    });
  }
  h += '<div class="btns"><button class="btn" data-a="close">Отмена</button><button class="btn acc" style="flex:1.3" data-a="ckSave">Записать</button></div>';
  return h;
}

/* ---------- настройки и синхронизация ---------- */
function vSettings() {
  let h = '<button class="btn" style="align-self:flex-start;min-height:40px;font-size:14px;gap:6px;padding:0 12px 0 8px" data-a="go" data-v="' + (ui.prevView || "storage") + '">' + ICON.back + "Назад</button><h1>Настройки</h1>";
  h += '<section class="card big"><h3>☁︎ Синхронизация</h3>';
  if (!syncConfigured()) h += '<p class="p">Сервер ещё не подключён: в файл index.html не вписан адрес Supabase. Всё работает и без него — данные хранятся на этом телефоне. Как подключить — в ИНСТРУКЦИИ.</p>';
  else if (!SYN.uid) h += '<p class="p">Войди, чтобы данные хранились на сервере и были одинаковыми на телефоне и компьютере. То, что уже есть на этом устройстве, никуда не денется.</p><label class="lbl">Почта<input class="in" id="syE" type="email" autocomplete="email" inputmode="email" placeholder="name@mail.ru"></label><label class="lbl">Пароль<input class="in" id="syP" type="password" autocomplete="current-password" placeholder="Не меньше 6 символов"></label><p class="small" id="syErr" style="color:#C2452F;margin:0"></p><div class="btns"><button class="btn" data-a="syLogin" data-v="new">Создать аккаунт</button><button class="btn acc" data-a="syLogin" data-v="">Войти</button></div>';
  else if (!SYN.hh) h += '<p class="p">Вошла как <b>' + esc(SYN.email) + '</b>. Осталось создать «дом» — общее хранилище. Если «Кладовую» уже завёл кто-то из семьи, введи его код.</p><button class="btn acc" data-a="syCreate">Создать мой дом и выгрузить данные</button><label class="lbl">Или код приглашения<input class="in" id="syCode" placeholder="Например, A1B2C3" autocapitalize="characters"></label><button class="btn" data-a="syJoin">Присоединиться по коду</button><p class="small" id="syErr" style="color:#C2452F;margin:0"></p><button class="btn ghost" data-a="syLogout">Выйти</button>';
  else h += '<p class="p">Вошла как <b>' + esc(SYN.email) + "</b>. Статус: " + ({ ok: "всё синхронизировано ✓", busy: "синхронизирую…", offline: "нет связи — синхронизирую позже", error: "ошибка: " + esc(syncErr), off: "выключено" }[syncState] || "") + "</p>" + (syncInfo ? '<p class="p">Код приглашения для семьи: <b style="font-size:18px;letter-spacing:.1em">' + esc(syncInfo.code) + "</b></p>" : "") + '<div class="btns"><button class="btn" data-a="syNow">Синхронизировать</button><button class="btn ghost" style="min-height:48px" data-a="syLogout">Выйти</button></div>';
  h += "</section>";
  h += '<section class="card big"><h3>ИИ-помощник</h3><p class="p">' + (aiOn() ? "Подключён (YandexGPT). Кнопки «Придумать с ИИ» — в конструкторе и рецептах, «Распознать с ИИ» — у продуктов не из справочника. Работает, когда ты вошла в ☁︎." : "Не подключён. Как подключить YandexGPT — в ИНСТРУКЦИИ, раздел про Yandex Cloud.") + '</p><label class="lbl">Мои вкусы — ИИ учитывает их в каждом рецепте<textarea class="in" id="prefsTA" data-in="prefs" rows="7" style="padding:10px 14px;font-size:14px;font-weight:600;line-height:1.45;min-height:150px">' + esc(getPrefs()) + "</textarea></label></section>";
  h += '<section class="card big"><h3>Резервная копия</h3><p class="p">Файл со всеми продуктами, рецептами, дневником и закупками. Удобно перед большими изменениями.</p><div class="btns"><button class="btn" data-a="exportJSON">Скачать копию</button><label class="btn" style="cursor:pointer">Загрузить<input type="file" accept="application/json,.json" data-ch="importJSON" style="display:none"></label></div></section>';
  h += '<section class="card big"><h3>Пример данных</h3><p class="p">Положит в холодильник, морозилку и кладовку продукты из макета — чтобы посмотреть, как всё работает. Потом лишнее можно отметить «Закончилось».</p><button class="btn" data-a="sample">Загрузить пример</button></section>';
  h += '<p class="small soft" style="margin:0">Кладовая · версия 1.0 · продуктов: ' + S.prods.length + ", рецептов: " + S.recs.length + ", записей в дневнике: " + S.diary.length + "</p>";
  return h;
}

/* ---------- отрисовка ---------- */
function viewHTML() { return ui.view === "builder" ? vBuilder() : ui.view === "recipes" ? vRecipes() : ui.view === "diary" ? vDiary() : ui.view === "shop" ? vShop() : ui.view === "settings" ? vSettings() : vStorage(); }
function sheetHTML() {
  const sh = ui.sheet; let body = "";
  if (sh.type === "prod") body = shProd(sh); else if (sh.type === "add") body = shAdd(sh); else if (sh.type === "cook") body = shCook(sh);
  else if (sh.type === "dAdd") body = shDiaryAdd(sh); else if (sh.type === "share") body = shShare(sh); else if (sh.type === "aiRec") body = shAiRec(sh); else if (sh.type === "photo") body = shPhoto(sh);
  else if (sh.type === "saveRec") body = '<h2>Сохранить рецепт</h2><label class="lbl">Название<input class="in" id="srName" data-in="srName" value="' + esc(sh.name) + '"></label><div class="btns"><button class="btn" data-a="close">Отмена</button><button class="btn acc" data-a="srSave">Сохранить</button></div>';
  else if (sh.type === "gone") body = "<h2>" + esc(sh.name) + ' закончилось</h2><p class="p">Добавить в список покупок?</p><div class="btns"><button class="btn" data-a="close">Нет</button><button class="btn acc" data-a="goneShop">Да, в закупки</button></div>';
  else if (sh.type === "confirm") body = "<h2>" + esc(sh.title) + '</h2><p class="p">' + esc(sh.text) + '</p><div class="btns"><button class="btn" data-a="close">Отмена</button><button class="btn acc" data-a="confirmYes">' + esc(sh.yes) + "</button></div>";
  if (!body) { ui.sheet = null; return ""; }
  return '<button class="backdrop" data-a="close" aria-label="Закрыть"></button><div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div>' + body + "</div>";
}
function render() {
  if (!ready) return;
  const ae = document.activeElement, fid = ae && ae.id && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA") ? ae.id : null;
  let selS = null; try { selS = fid ? ae.selectionStart : null; } catch (e) {}
  const sc = $("#scroller"), key = ui.view + (ui.view === "recipes" && ui.r.open ? ":" + ui.r.open : "");
  if (sc && ui._key) ui.scrolls[ui._key] = sc.scrollTop;
  const shEl = $("#sheet .sheet"), shTop = shEl ? shEl.scrollTop : 0, shKey = ui.sheet ? ui.sheet.type + (ui.sheet.id || "") : null;
  $("#app").innerHTML = '<main class="scroll" id="scroller">' + viewHTML() + "</main>" + navHTML();
  $("#sheet").innerHTML = ui.sheet ? sheetHTML() : "";
  const nsc = $("#scroller"); if (nsc) nsc.scrollTop = ui.scrolls[key] || 0; ui._key = key;
  const nsh = $("#sheet .sheet"); if (nsh && shKey === ui._shKey) nsh.scrollTop = shTop; ui._shKey = shKey;
  if (fid) { const n = document.getElementById(fid); if (n) { try { n.focus({ preventScroll: true }); if (selS != null && n.setSelectionRange) n.setSelectionRange(selS, selS); } catch (e) {} } }
}
function closeSheet() { ui.sheet = null; render(); }

// На iPhone клавиатура уменьшает visualViewport, но не область fixed-элементов.
function syncSheetViewport() {
  const vp = window.visualViewport;
  const height = vp ? vp.height : window.innerHeight;
  const bottom = vp ? Math.max(0, window.innerHeight - vp.height - vp.offsetTop) : 0;
  document.documentElement.style.setProperty("--sheet-bottom", bottom + "px");
  document.documentElement.style.setProperty("--sheet-max-height", Math.max(0, height * 0.92) + "px");
  const active = document.activeElement;
  const sheet = active && active.closest && active.closest(".sheet");
  if (sheet && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
    const field = active.getBoundingClientRect(), bounds = sheet.getBoundingClientRect();
    if (field.bottom > bounds.bottom - 16) sheet.scrollTop += field.bottom - bounds.bottom + 16;
    else if (field.top < bounds.top + 16) sheet.scrollTop -= bounds.top + 16 - field.top;
  }
}
function scheduleSheetViewport() { requestAnimationFrame(syncSheetViewport); }
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleSheetViewport);
  window.visualViewport.addEventListener("scroll", scheduleSheetViewport);
}
window.addEventListener("resize", scheduleSheetViewport);
document.addEventListener("focusin", scheduleSheetViewport);
syncSheetViewport();

/* ---------- действия ---------- */
const A = {
  go(d) { if (d.v === "settings" && ui.view !== "settings") ui.prevView = ui.view; ui.view = d.v; ui.sheet = null; if (d.v === "recipes") ui.r.open = ui.r.open; render(); if (d.v === "settings") loadSyncInfo(); },
  close() { closeSheet(); },
  place(d) { ui.place = d.v; ui.onlySoon = false; render(); },
  onlySoon() { ui.onlySoon = !ui.onlySoon; if (ui.onlySoon) ui.storageZones[ui.place] = "all"; render(); },
  storageZone(d) { ui.storageZones[ui.place] = d.id; ui.scrolls.storage = 0; const sc = $("#scroller"); if (sc) sc.scrollTop = 0; render(); },
  expZone(d) { ui.exp[d.id] = !ui.exp[d.id]; render(); },
  prod(d) { ui.sheet = { type: "prod", id: d.id }; render(); },
  pCount(d) { const p = prodById(ui.sheet.id); p.have = Math.max(0, Math.min(p.max + 20, p.have + Number(d.v))); if (p.have > p.max) p.max = p.have; commit(); },
  pLevel(d) { const p = prodById(ui.sheet.id); p.l = Number(d.v); commit(); },
  pExpQuick(d) { const p = prodById(ui.sheet.id); p.exp = d.v ? addDays(today(), Number(d.v)) : null; commit(); },
  pZone(d) { const p = prodById(ui.sheet.id); p.zone = d.v; if (p.d) learn(p.d, { z: d.v }); commit(); toast("Переложила: " + zoneLabel(zoneById(d.v))); },
  pTara(d) { const p = prodById(ui.sheet.id); const t = d.id; if (t === p.t) return; if (t === "count") { p.have = p.have || 1; p.max = p.max || p.have; } p.t = t; if (p.d) learn(p.d, { t: t }); commit(); },
  pShop() { const p = prodById(ui.sheet.id); const ex = S.shop.find((x) => !x.done && (x.pid === p.id || (p.d && x.d === p.d))); if (ex) S.shop.splice(S.shop.indexOf(ex), 1); else shopAdd({ name: p.name, d: p.d, pid: p.id, cat: p.d && DICT[p.d] ? DICT[p.d].cat : "other", why: [["low", "заканчивается"]] }); commit(); },
  pPacks(d) { const p = prodById(ui.sheet.id); p.packs = Math.max(1, Math.min(50, (p.packs || 1) + Number(d.v))); commit(); },
  pU(d) { const p = prodById(ui.sheet.id); p.u = d.v; commit(); },
  pGone() { const p = prodById(ui.sheet.id); if (p.t !== "count" && (p.packs || 1) > 1) { p.packs -= 1; p.l = 1; commit(); toast("Открыла новую упаковку · всего осталось " + p.packs); return; } S.prods.splice(S.prods.indexOf(p), 1); const inShop = S.shop.some((x) => !x.done && (x.pid === p.id || (p.d && x.d === p.d))); ui.sheet = inShop ? null : { type: "gone", name: p.name, d: p.d }; commit(); },
  goneShop() { const sh = ui.sheet; shopAdd({ name: sh.name, d: sh.d, why: [["low", "закончилось"]] }); ui.sheet = null; commit(); toast("Добавила в закупки: " + sh.name); },
  add(d) { ui.sheet = { type: "add", q: "", pick: null, preset: d.z || null }; render(); setTimeout(() => { const i = $("#addQ"); if (i) i.focus(); }, 60); },
  addPick(d) { const sh = ui.sheet; const u0 = d.v.indexOf("uc:") === 0 ? learned(d.v) : null; const dd = u0 ? { id: d.v, n: u0.name, t: u0.t, c: u0.c, z: u0.z, cell: u0.cell, custom: true } : DICT[d.v]; const L = u0 && u0.link && DICT[u0.link] ? DICT[u0.link] : null; const df = dd.custom ? { t: dd.t, z: dd.z, n0: L ? (L.n0 || 1) : 1, s: L ? L.s : 0 } : dictDefaults(dd);
    const PK = L || (dd.custom ? null : dd); const sr = nearestSrok(df.s);
    Object.assign(sh, { pick: dd, link: L ? L.id : null, q: dd.n, tara: df.t, taraDef: df.t, zone: sh.preset || df.z, level: 1, have: df.n0 || 1, srok: sr, exp: df.s && df.s < 999 ? addDays(today(), df.s) : (sr ? addDays(today(), sr) : null), srokDef: df.s && df.s < 999 ? df.s : 0, packs: 1, pk: (u0 && u0.pk) || (PK && PK.pk) || null, pkDef: PK && PK.pk || 0, u: (u0 && u0.u) || (PK && PK.u) || "г" }); render(); },
  addLink(d) { const sh = ui.sheet; if (sh.link === d.v) { sh.link = null; render(); return; } sh.link = d.v; const df = dictDefaults(DICT[d.v]); Object.assign(sh, { tara: df.t, taraDef: df.t, zone: sh.preset || df.z, have: df.n0 || 1, srok: nearestSrok(df.s), exp: df.s && df.s < 999 ? addDays(today(), df.s) : null, srokDef: df.s && df.s < 999 ? df.s : 0, pk: sh.pk || DICT[d.v].pk || null, pkDef: DICT[d.v].pk || 0, u: DICT[d.v].u || sh.u }); if (df.cell) sh.pick.cell = df.cell; if (!sh.pick.c || sh.pick.c === "#C9B79A") sh.pick.c = DICT[d.v].c; render(); },
  pLink(d) { const p = prodById(ui.sheet.id); p.d = p.d === d.v ? null : d.v; if (p.d) { learnLink(p.name, p.d); if (DICT[p.d].cell && p.t === "count") p.cell = DICT[p.d].cell; } commit(); },
  aiProduct() { aiProduct(); },
  phCount(d) { const it = ui.sheet.items[Number(d.i)]; it.count = Math.max(1, Math.min(30, it.count + Number(d.v))); render(); },
  phCommit() {
    const sh = ui.sheet; const added = [];
    sh.items.filter((x) => x.on).forEach((it) => {
      const id = it.same || aiSaveProduct(it.name, it.raw);
      const dd = DICT[id];
      const t = it.t === "count" || dd.t === "count" ? "count" : it.t;
      S.prods.push(makeProd({ name: it.name, d: id, t: t, c: dd.c, cell: dd.cell, zone: it.zone, l: 1, have: t === "count" ? (dd.n0 || 1) * it.count : undefined, max: t === "count" ? (dd.n0 || 1) * it.count : undefined, exp: it.exp, packs: t === "count" ? 1 : it.count, pk: t === "count" ? null : it.pk, u: it.u }));
      added.push(it.name + (it.count > 1 ? " ×" + it.count : ""));
    });
    ui.sheet = null; ui.view = "storage"; commit(); toast("Положила: " + added.join(", "));
  },
  aiRec() { ui.sheet = { type: "aiRec", wish: "", mode: ui.view === "builder" && ui.b.mode === "ideas" ? "ideas" : "stock" }; render(); },
  aiMode(d) { ui.sheet.mode = d.v; render(); },
  aiGo() { aiRecipe(); },
  aiSave() { const r = ui.sheet.res; if (!r) return; S.recs.unshift(aiToRecipe(r)); ui.sheet.saved = true; commit(); toast("Сохранила в рецепты: " + r.name); },
  aiBuild() { const r = ui.sheet.res; ui.b.name = r.name; ui.b.items = r.ings.filter((i) => i.d && i.g && DICT[i.d] && DICT[i.d].slot).map((i) => ({ d: i.d, g: i.g })); ui.b.mode = "ideas"; ui.view = "builder"; ui.sheet = null; render(); },
  addCustom() { const sh = ui.sheet, q = sh.q.trim(); const name = cap(q); Object.assign(sh, { pick: { id: "uc:" + q.toLowerCase(), n: name, t: "jar", c: "#C9B79A", custom: true }, q: name, tara: "jar", taraDef: "jar", zone: sh.preset || "f1", level: 1, have: 1, srok: 7, exp: addDays(today(), 7), srokDef: 0, packs: 1, pk: null, pkDef: 0, u: "г" }); render(); },
  addTara(d) { const sh = ui.sheet; sh.tara = d.id; if (d.id === "count" && !sh.have) sh.have = 1; render(); },
  addZone(d) { ui.sheet.zone = d.v; render(); },
  addLevel(d) { ui.sheet.level = Number(d.v); render(); },
  addCount(d) { ui.sheet.have = Math.max(1, Math.min(30, ui.sheet.have + Number(d.v))); render(); },
  addSrok(d) { const v = Number(d.v); ui.sheet.srok = v; ui.sheet.exp = v ? addDays(today(), v) : null; render(); },
  addPacks(d) { ui.sheet.packs = Math.max(1, Math.min(50, ui.sheet.packs + Number(d.v))); render(); },
  addU(d) { ui.sheet.u = d.v; render(); },
  addCommit() {
    const sh = ui.sheet, dd = sh.pick;
    const p = makeProd({ name: dd.n, d: dd.custom ? null : dd.id, t: sh.tara, c: dd.c, cell: dd.cell, zone: sh.zone, l: sh.level, have: sh.have, max: sh.have, exp: sh.exp || null, packs: sh.tara === "count" ? 1 : sh.packs, pk: sh.tara === "count" ? null : sh.pk, u: sh.u });
    S.prods.push(p);
    if (sh.link) { p.d = sh.link; }
    if (dd.custom) learnCustom(dd, sh); else { const df = dictDefaults(dd); if (sh.tara !== df.t || (!sh.preset && sh.zone !== df.z)) learn(dd.id, { t: sh.tara, z: sh.zone }); }
    if (dd.custom && sh.pk) { const u = learned("uc:" + dd.n.toLowerCase()); if (u) { u.pk = sh.pk; u.u = sh.u; } }
    const z = zoneById(sh.zone); ui.place = z.place; ui.view = "storage"; ui.sheet = null; commit(); toast("Положила: " + p.name + (p.packs > 1 ? " ×" + p.packs : "") + " → " + zoneLabel(z).toLowerCase());
  },
  sample() { loadSample(); },
  /* конструктор */
  bMode(d) { ui.b.mode = d.v; ui.b.open = null; render(); },
  bPreset(d) { const x = bPresets()[Number(d.v)]; if (!x) return; ui.b.name = x.p.name; ui.b.items = x.p.items.map((i) => ({ d: i[0], g: i[1] })); ui.b.open = null; render(); const sc = $("#scroller"); if (sc) sc.scrollTop = 0; },
  bOil(d) { ui.b.oil = Number(d.v); render(); },
  bHints() { ui.b.allHints = !ui.b.allHints; render(); },
  bSlot(d) { ui.b.open = ui.b.open === d.v ? null : d.v; render(); },
  bAdd(d) { if (!ui.b.items.some((x) => x.d === d.v)) ui.b.items.push({ d: d.v, g: DICT[d.v].g || 50 }); render(); },
  bDel(d) { ui.b.items = ui.b.items.filter((x) => x.d !== d.v); render(); },
  bG(d) { const x = ui.b.items.find((y) => y.d === d.v); if (x) { x.g = Math.max(0, x.g + Number(d.d)); render(); } },
  bClear() { ui.b.items = []; ui.b.name = null; render(); },
  bBuy() { const C = bCalc(); const buy = C.items.filter((x) => stockOf(x.d) === "no"); const name = autoName(C); buy.forEach((x) => shopAdd({ d: x.d, qty: x.g + " г", why: [["idea", name]] })); commit(); toast("Добавила в закупки: " + buy.length + " " + plural(buy.length, "продукт", "продукта", "продуктов")); },
  bSave() { ui.sheet = { type: "saveRec", name: autoName(bCalc()) }; render(); },
  srSave() {
    const C = bCalc(), ST = bSteps(C); let name = (ui.sheet.name || "").trim() || autoName(C); if (S.recs.some((r) => r.name === name)) name += " (мой вариант)";
    const k = Math.round(C.tot.k / 5) * 5;
    S.recs.unshift({ id: "r-" + uid(), name: name, rating: "new", time: ST.mins, serv: "1 порция", kcal: "≈ " + k, kmax: k, p: Math.round(C.tot.p), tags: ST.steps.some((s) => /Аэрогриль/.test(s.device || "")) ? ["airfryer"] : [], src: "конструктор", note: "Сохранён из конструктора.",
      ings: C.items.map((x) => ({ n: DICT[x.d].n, q: x.d === "eggs" ? Math.max(1, Math.round(x.g / 50)) + " шт." : x.g + " г", d: x.d, g: x.g })), steps: ST.steps.map((s) => [s.text, s.device || "", s.tip || ""]) });
    ui.sheet = null; commit(); toast("Сохранила в рецепты: " + name);
  },
  bCook() { const C = bCalc(); openCook({ name: autoName(C), kcal: Math.round(C.tot.k / 5) * 5, p: Math.round(C.tot.p), cols: C.items.map((x) => DICT[x.d].c), ings: C.items.map((x) => DICT[x.d].n + " " + x.g + " г").join(", "), uses: C.items.flatMap((x) => DICT[x.d].virtual ? DICT[x.d].needs.map((n) => ({ d: n, g: 0 })) : [{ d: x.d, g: x.g }]), ds: C.items.map((x) => x.d), src: "Из конструктора" }); },
  /* рецепты */
  recF(d) { ui.r.filter = d.v; render(); },
  openRec(d) { ui.r.open = d.id; ui.view = "recipes"; ui.sheet = null; render(); },
  recBack() { ui.r.open = null; render(); },
  recRate(d) { const r = S.recs.find((x) => x.id === ui.r.open); r.rating = r.rating === d.v ? null : d.v; commit(); },
  recBuy() { const r = S.recs.find((x) => x.id === ui.r.open); const m = recMissing(r); const allIn = m.every((i) => S.shop.some((s) => !s.done && s.d === i.d)); if (allIn) { S.shop = S.shop.filter((s) => s.done || !m.some((i) => i.d === s.d)); } else m.forEach((i) => shopAdd({ d: i.d, qty: i.q, why: [["recipe", r.name.length > 34 ? r.name.slice(0, 32) + "…" : r.name]] })); commit(); },
  recToBuilder() { const r = S.recs.find((x) => x.id === ui.r.open); ui.b.name = r.name; ui.b.items = r.ings.filter((i) => i.d && i.g && DICT[i.d] && DICT[i.d].slot).map((i) => ({ d: i.d, g: i.g })); ui.b.mode = recMissing(r).length ? "ideas" : "stock"; ui.view = "builder"; render(); },
  recCook() { const r = S.recs.find((x) => x.id === ui.r.open); openCook({ name: r.name, kcal: avgNums(r.kcal), p: r.p, cols: recCols(r), ings: r.ings.map((i) => i.n + " " + i.q).join(", "), uses: r.ings.filter((i) => i.d && !STAPLES[i.d]).map((i) => ({ d: i.d, g: i.g || 0 })), ds: r.ings.filter((i) => i.d && i.g).map((i) => i.d), recId: r.id, src: "Из рецептов" }); },
  recDel() { const r = S.recs.find((x) => x.id === ui.r.open); ui.sheet = { type: "confirm", title: "Удалить рецепт?", text: "«" + r.name + "» пропадёт из книги рецептов. Записи в дневнике останутся.", yes: "Удалить", act: "recDelYes" }; render(); },
  confirmYes() { const act = ui.sheet.act; ui.sheet = null; if (act === "recDelYes") { S.recs = S.recs.filter((x) => x.id !== ui.r.open); ui.r.open = null; commit(); } },
  buildWith(d) { ui.b.name = null; if (!ui.b.items.some((x) => x.d === d.v)) ui.b.items.push({ d: d.v, g: DICT[d.v].g || 50 }); ui.view = "builder"; ui.sheet = null; render(); },
  /* приготовила */
  ckMeal(d) { ui.sheet.meal = d.v; render(); },
  ckRate(d) { ui.sheet.rate = ui.sheet.rate === d.v ? null : d.v; render(); },
  ckCount(d) { const u = ui.sheet.upd[d.id], p = prodById(d.id); u.have = Math.max(0, Math.min(p.max, u.have + Number(d.v))); render(); },
  ckLevel(d) { const u = ui.sheet.upd[d.id]; u.l = Number(d.v); u.auto = false; render(); },
  ckGone(d) { const u = ui.sheet.upd[d.id]; u.gone = !u.gone; render(); },
  ckSave() {
    const sh = ui.sheet;
    S.diary.push({ id: uid(), date: today(), meal: sh.meal, time: nowHM(), name: sh.name, kcal: sh.kcal || 0, p: sh.p || 0, cols: sh.cols || [], ings: sh.ings || "", ds: sh.ds || [], rate: sh.rate || "none", src: sh.src || "", t: Date.now() });
    const gone = [];
    Object.keys(sh.upd).forEach((pid) => { const p = prodById(pid), u = sh.upd[pid]; if (!p) return; if (!u.gone && p.t !== "count" && (p.packs || 1) > 1 && u.l != null && u.l <= 0.02) { p.packs -= 1; p.l = 1; return; }
      if (u.gone || (p.t === "count" && u.have <= 0) || (p.t !== "count" && p.t !== "can" && u.l != null && u.l <= 0.02)) { S.prods.splice(S.prods.indexOf(p), 1); gone.push(p); } else { if (u.have != null) p.have = u.have; if (u.l != null) p.l = u.l; } });
    if (sh.recId && sh.rate) { const r = S.recs.find((x) => x.id === sh.recId); if (r) r.rating = sh.rate; }
    gone.forEach((p) => shopAdd({ name: p.name, d: p.d, why: [["low", "закончилось"]] }));
    ui.sheet = null; commit(); toast("Записала в дневник" + (gone.length ? ". Закончилось и ушло в закупки: " + gone.map((p) => p.name.toLowerCase()).join(", ") : ""));
  },
  /* дневник */
  dDay(d) { ui.dy.date = d.v; ui.dy.open = null; render(); },
  dWeek(d) { ui.dy.date = addDays(ui.dy.date, Number(d.v)); render(); },
  dOpen(d) { ui.dy.open = ui.dy.open === d.id ? null : d.id; render(); },
  dDel(d) { S.diary = S.diary.filter((e) => e.id !== d.id); commit(); },
  dAdd(d) { ui.sheet = { type: "dAdd", meal: d.v, tab: "quick" }; render(); },
  daTab(d) { ui.sheet.tab = d.v; render(); },
  daQuick(d) { const sh = ui.sheet, q = sh._quick[Number(d.v)]; if (!q) return; const e = q.k === "d" ? Object.assign(clone(q.e), { id: uid(), rate: "none" }) : { id: uid(), name: q.r.name, kcal: avgNums(q.r.kcal), p: q.r.p, cols: recCols(q.r), ings: q.r.ings.map((i) => i.n + " " + i.q).join(", "), ds: q.r.ings.filter((i) => i.d && i.g).map((i) => i.d), src: "Из рецептов", rate: "none" }; Object.assign(e, { date: ui.dy.date, meal: sh.meal, time: ui.dy.date === today() ? nowHM() : "", t: Date.now() }); S.diary.push(e); ui.sheet = null; commit(); },
  daManual() { const sh = ui.sheet; const name = (sh.name || "").trim(); if (!name) { toast("Впиши, что ела"); return; } S.diary.push({ id: uid(), date: ui.dy.date, meal: sh.meal, time: ui.dy.date === today() ? nowHM() : "", name: name, kcal: parseInt(sh.k, 10) || 0, p: parseInt(sh.p, 10) || 0, cols: ["#E8D9B5"], ings: "", ds: [], rate: "none", src: "Вручную", t: Date.now() }); ui.sheet = null; commit(); },
  /* закупки */
  shAdd() { const name = ui.sh.draft.trim(); if (!name) return; const q = name.toLowerCase(); const d = DICT_LIST.find((x) => !x.virtual && (x.n.toLowerCase() === q || (x.syn || "").split(" ").indexOf(q) >= 0 || x.n.toLowerCase().indexOf(q) === 0)); shopAdd({ name: cap(name), d: d ? d.id : null, cat: d ? d.cat : "other", why: [["manual", "добавлено вручную"]] }); ui.sh.draft = ""; commit(); },
  shDel(d) { S.shop = S.shop.filter((x) => x.id !== d.id); commit(); },
  shOpt() { ui.sh.hideOpt = !ui.sh.hideOpt; render(); },
  shUnpack() {
    const done = S.shop.filter((x) => x.done); const placed = [];
    done.forEach((x) => {
      const d = DICT[x.d];
      if (d) {
        const df = dictDefaults(d);
        const ex = S.prods.find((p) => p.d === d.id && (p.t === "jar" || p.t === "bag" || p.t === "bottle" || p.t === "count"));
        if (ex && ex.t !== "count" && zoneById(ex.zone).place === "pantry" && ex.t === "jar") { ex.l = 1; placed.push(ex.name + " (досыпала)"); }
        else if (ex && ex.t !== "count") { ex.packs = (ex.packs || 1) + 1; placed.push(ex.name + " (+1 уп.)"); }
        else if (ex && ex.t === "count") { ex.have += df.n0 || 1; ex.max = Math.max(ex.max, ex.have); ex.exp = df.s && df.s < 999 ? addDays(today(), df.s) : ex.exp; placed.push(ex.name); }
        else { S.prods.push(makeProd({ name: d.n, d: d.id, t: df.t, c: d.c, cell: d.cell, zone: df.z, l: 1, have: df.n0, max: df.n0, exp: df.s && df.s < 999 ? addDays(today(), df.s) : null, pk: d.pk, u: d.u })); placed.push(d.n); }
      } else { S.prods.push(makeProd({ name: x.name, t: "jar", zone: "f1", l: 1 })); placed.push(x.name + " (на полку 1 — переложи)"); }
    });
    S.shop = S.shop.filter((x) => !x.done); commit(); toast("Разложила: " + placed.join(", ") + ". Проверь сроки на упаковках.");
  },
  share() { ui.sheet = { type: "share", notes: false, opt: true, copied: false }; render(); },
  shrNotes() { ui.sheet.notes = !ui.sheet.notes; ui.sheet.copied = false; render(); },
  shrOpt() { ui.sheet.opt = !ui.sheet.opt; ui.sheet.copied = false; render(); },
  shrCopy() { const t = ui.sheet._text; const done = () => { ui.sheet.copied = true; render(); }; try { navigator.clipboard.writeText(t).then(done, () => { fallbackCopy(t); done(); }); } catch (e) { fallbackCopy(t); done(); } },
  shrSend() { const t = ui.sheet._text; if (navigator.share) navigator.share({ title: "Список покупок", text: t }).catch(() => {}); else { fallbackCopy(t); ui.sheet.copied = true; render(); toast("Меню «Поделиться» недоступно — скопировала текст"); } },
  /* настройки */
  exportJSON() { const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kladovaya-" + today() + ".json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); },
  syLogin(d) { const e = ($("#syE") || {}).value || "", p = ($("#syP") || {}).value || ""; const er = $("#syErr"); if (er) er.textContent = "…"; syncLogin(e.trim(), p, d.v === "new").then(() => render(), (x) => { const el = $("#syErr"); if (el) el.textContent = ruErr(x); }); },
  syCreate() { syncCreate().then(() => render(), (x) => { const el = $("#syErr"); if (el) el.textContent = ruErr(x); }); },
  syJoin() { const c = (($("#syCode") || {}).value || "").trim().toUpperCase(); if (!c) return; syncJoin(c).then(() => render(), (x) => { const el = $("#syErr"); if (el) el.textContent = ruErr(x); }); },
  syLogout() { syncLogout().then(() => render()); },
  syNow() { syncNow(); }
};
const IN = {
  addQ(v) { const sh = ui.sheet; sh.q = v; if (sh.pick) { sh.pick = null; render(); return; } const box = $("#addSugg"); if (box) box.innerHTML = addSuggHTML(sh); },
  pName(v) { const p = prodById(ui.sheet.id); if (p && v.trim()) { p.name = v.trim(); commit(true); } },
  recQ(v) { ui.r.q = v; const box = $("#recList"); if (box) box.innerHTML = recListHTML(); },
  srName(v) { ui.sheet.name = v; },
  daName(v) { ui.sheet.name = v; }, daK(v) { ui.sheet.k = v; }, daP(v) { ui.sheet.p = v; },
  shDraft(v) { ui.sh.draft = v; },
  aiWish(v) { if (ui.sheet) ui.sheet.wish = v; },
  phName(v, el) { const it = ui.sheet.items[Number(el.dataset.i)]; if (it) it.name = v; },
  prefs(v) { let u = S.udict.find((x) => x.id === "prefs"); if (!u) { u = { id: "prefs" }; S.udict.push(u); } u.text = v; clearTimeout(IN.t); IN.t = setTimeout(() => commit(true), 800); }
};
const CH = {
  pExp(v) { const p = prodById(ui.sheet.id); p.exp = v || null; commit(); },
  pPk(v) { const p = prodById(ui.sheet.id); const n = parseFloat(String(v).replace(",", ".")); p.pk = isFinite(n) && n > 0 ? n : null; commit(); },
  addExp(v) { const sh = ui.sheet; sh.exp = v || null; sh.srok = v ? -1 : 0; render(); },
  addPk(v) { const sh = ui.sheet; const n = parseFloat(String(v).replace(",", ".")); sh.pk = isFinite(n) && n > 0 ? n : null; },
  bG(v, el) { const x = ui.b.items.find((y) => y.d === el.dataset.v); if (x) { const n = parseInt(v, 10); x.g = isNaN(n) ? 0 : Math.max(0, Math.min(2000, n)); render(); } },
  shDone(v, el) { const x = S.shop.find((y) => y.id === el.dataset.id); if (x) { x.done = el.checked; commit(); } },
  photo(v, el) { const f = el.files && el.files[0]; if (f) photoStart(f); el.value = ""; },
  phOn(v, el) { const it = ui.sheet.items[Number(el.dataset.i)]; it.on = el.checked; render(); },
  phExp(v, el) { const it = ui.sheet.items[Number(el.dataset.i)]; it.exp = v || null; it.expSeen = false; },
  importJSON(v, el) { const f = el.files && el.files[0]; if (!f) return; f.text().then((t) => { const o = JSON.parse(t); if (!o || !Array.isArray(o.prods)) throw new Error("bad"); S = Object.assign(freshState(), o); registerAI(); commit(); toast("Копия загружена"); }).catch(() => toast("Не получилось прочитать файл")); }
};
function fallbackCopy(t) { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
function learn(dictId, patch) { const key = "ud:" + dictId; let u = learned(key); if (!u) { u = { id: key, d: dictId }; S.udict.push(u); } Object.assign(u, patch); }
function learnCustom(dd, sh) { const key = "uc:" + dd.n.toLowerCase(); let u = learned(key); if (!u) { u = { id: key }; S.udict.push(u); } Object.assign(u, { name: dd.n, t: sh.tara, z: sh.zone, c: dd.c || "#C9B79A", cell: dd.cell || "round", link: sh.link || null }); }
function learnLink(name, id) { const key = "uc:" + name.toLowerCase(); const u = learned(key); if (u) u.link = id; }
function autoName(C) { if (ui.b.name) return ui.b.name; const ids = C.items.map((x) => x.d); const base = ids.find((id) => DICT[id].slot === "base"), prot = ids.find((id) => DICT[id].slot === "protein"), veg = ids.find((id) => DICT[id].slot === "veg"); const parts = [prot, veg, base].filter(Boolean).map((id) => (DICT[id].short || DICT[id].n.split(" ")[0]).toLowerCase()); return parts.length ? (base ? "Боул: " : "Тёплый салат: ") + parts.join(", ") : "Моя тарелка"; }

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a; if (!A[a]) return;
  if (el.tagName === "BUTTON" && el.closest("label")) e.preventDefault();
  A[a](el.dataset, el, e);
});
document.addEventListener("input", (e) => { const el = e.target; if (el.dataset && el.dataset.in && IN[el.dataset.in]) IN[el.dataset.in](el.value, el); });
document.addEventListener("change", (e) => { const el = e.target; if (el.dataset && el.dataset.ch && CH[el.dataset.ch]) CH[el.dataset.ch](el.value, el); });
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "shDraft") { e.preventDefault(); A.shAdd(); } if (e.key === "Escape" && ui.sheet) closeSheet(); });

/* ---------- пример данных ---------- */
function loadSample() {
  const t = today();
  const P = (d, zone, o) => { const dd = DICT[d]; const df = dictDefaults(dd); o = o || {}; return makeProd({ pk: dd.pk, u: dd.u, packs: o.packs, name: o.name || dd.n, d: d, t: o.t || df.t, c: dd.c, cell: dd.cell, zone: zone, l: o.l == null ? 1 : o.l, have: o.have == null ? df.n0 : o.have, max: o.max || df.n0, exp: o.days == null ? (dd.s && dd.s < 999 ? addDays(t, Math.min(dd.s, 40)) : null) : (o.days === false ? null : addDays(t, o.days)) }); };
  const list = [
    P("tvorog", "f1", { t: "block", packs: 4, days: 6, name: "Творог 5%" }), P("curd", "f1", { have: 3, max: 3, days: 13 }), P("butter", "f1", { l: 0.7 }), P("cheese", "f1", { l: 0.45, days: 18 }),
    P("soup", "f2", { l: 0.6, days: 1, name: "Суп в кастрюле" }), P("corn", "f2", { days: false }),
    P("cream", "f3", { l: 0.4, days: 2 }),
    P("eggs", "f4", { have: 8, max: 10, days: 16 }), P("leftovers", "f4", { l: 0.4, days: 0 }),
    P("tofu", "ff", { days: 8 }), P("trout", "ff", { l: 0.8, days: 2 }),
    P("spinach", "fv", { l: 0.3, days: 1 }), P("cucumber", "fv", { have: 3, max: 4, days: 3 }), P("napa", "fv", { l: 0.9, days: 10 }), P("rucola", "fv", { l: 0.6, days: 4 }), P("zucchini", "fv", { days: 8 }),
    P("mustard", "d1", { l: 0.5 }), P("jam", "d1", { l: 0.6 }), P("soy", "d1", { l: 0.4 }), P("chim", "d1", { l: 0.7 }),
    P("lemon", "d2", { have: 2, max: 3 }), P("lime", "d2", { have: 1, max: 2 }), P("milk", "d3", { l: 0.5, days: 1 }),
    P("puree", "z1", { name: "Тыквенное пюре 400 г" }), P("puree", "z1", { name: "Тыквенное пюре 150 г" }), P("quinoaPortion", "z2", { have: 3, max: 3 }), P("ricePortion", "z2", { have: 2, max: 2 }), P("salmon", "z3", { t: "count", have: 2, max: 2, days: 60, name: "Лосось, 2 стейка" }), P("edamame", "z3", { l: 0.7, days: false }), P("berries", "z4", { l: 0.4, days: false }),
    P("rice", "p1", { l: 0.7, days: false }), P("buckwheat", "p1", { l: 0.8, days: false }), P("oats", "p2", { l: 0.3, days: false }), P("seeds", "p2", { l: 0.4, days: false }), P("bulgur", "p2", { l: 0.35, days: false }), P("lentilRed", "p2", { l: 0.85, days: false }),
    P("potato", "p3", { l: 0.7 }), P("carrot", "p3", { have: 5, max: 6 }), P("pumpkin", "p3", { have: 1, max: 2, days: 3 }), P("onion", "p3", { have: 4, max: 5 }), P("garlic", "p3", { have: 1, max: 2 }),
    P("pasta", "p4", { l: 0.8, days: false }), P("quinoa", "p4", { l: 0.5, days: false })
  ];
  S.prods = S.prods.concat(list); ui.view = "storage"; ui.place = "fridge"; commit(); toast("Положила пример: " + list.length + " продуктов");
}

/* ==================== СИНХРОНИЗАЦИЯ (как в «Кошачьем журнале») ==================== */
const CFG = window.KL_CONFIG || {};
let SB = null, SYN = { hh: null, uid: null, email: null, last: "1970-01-01T00:00:00Z" }, SHADOW = {}, syncing = false, syncAgain = false, syncState = "off", syncErr = "", syncInfo = null;
const KINDS = { zone: "zones", prod: "prods", rec: "recs", diary: "diary", shop: "shop", ud: "udict" };
function syncConfigured() { return !!(CFG.url && CFG.key && window.supabase && window.supabase.createClient); }
function itemsOf() { const m = {}; Object.keys(KINDS).forEach((k) => (S[KINDS[k]] || []).forEach((x) => { m[k + ":" + x.id] = x; })); return m; }
function applyItem(key, data, del) {
  const k = key.split(":")[0], id = key.slice(k.length + 1), arr = KINDS[k]; if (!arr) return;
  S[arr] = S[arr] || []; const i = S[arr].findIndex((x) => x.id === id);
  if (del) { if (i >= 0) S[arr].splice(i, 1); } else if (i >= 0) S[arr][i] = data; else S[arr].push(data);
}
function saveSyncMeta() { return Promise.all([idbPut("sync", SYN), idbPut("shadow", SHADOW)]); }
function setSync(st, err) { const changed = st !== syncState; syncState = st; syncErr = err || ""; if (changed && !ui.sheet && ready) render(); }
function scheduleSync(ms) { clearTimeout(scheduleSync.t); scheduleSync.t = setTimeout(syncNow, ms || 1500); }
function chunks(a, n) { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; }
function chk(res) { if (res && res.error) throw res.error; return res && res.data; }
async function syncPull() {
  let rows = [], page = 0, got;
  do { got = chk(await SB.from("items").select("key,data,deleted,updated_at").eq("household_id", SYN.hh).gt("updated_at", SYN.last).order("updated_at", { ascending: true }).range(page * 500, page * 500 + 499)) || []; rows = rows.concat(got); page++; } while (got.length === 500);
  if (!rows.length) return false;
  const cur = itemsOf(); let changed = false;
  rows.forEach((r) => {
    const local = cur[r.key] ? JSON.stringify(cur[r.key]) : undefined, sh = SHADOW[r.key];
    if (local === sh) { applyItem(r.key, r.data, r.deleted); if (r.deleted) delete SHADOW[r.key]; else SHADOW[r.key] = JSON.stringify(r.data); changed = true; }
    if (r.updated_at > SYN.last) SYN.last = r.updated_at;
  });
  if (changed) { registerAI(); await idbPut("state", S); }
  await saveSyncMeta();
  return changed;
}
async function syncPush() {
  const cur = itemsOf(), rows = [];
  Object.keys(cur).forEach((k) => { const s = JSON.stringify(cur[k]); if (SHADOW[k] !== s) rows.push({ household_id: SYN.hh, key: k, data: cur[k], deleted: false }); });
  Object.keys(SHADOW).forEach((k) => { if (!(k in cur)) rows.push({ household_id: SYN.hh, key: k, data: null, deleted: true }); });
  for (const c of chunks(rows, 200)) chk(await SB.from("items").upsert(c, { onConflict: "household_id,key" }));
  rows.forEach((r) => { if (r.deleted) delete SHADOW[r.key]; else SHADOW[r.key] = JSON.stringify(r.data); });
  if (rows.length) await saveSyncMeta();
  return rows.length > 0;
}
async function syncNow() {
  if (!SB || !SYN.hh || !ready) return;
  if (syncing) { syncAgain = true; return; }
  if (ui.sheet) { scheduleSync(2000); return; }
  syncing = true; setSync("busy");
  try { const a = await syncPull(); await syncPush(); setSync("ok"); if (a && !ui.sheet) render(); }
  catch (e) { const msg = String((e && (e.message || e.error_description)) || e); setSync(/fetch|network|Failed|Load failed|timeout/i.test(msg) ? "offline" : "error", msg); }
  finally { syncing = false; if (syncAgain) { syncAgain = false; scheduleSync(500); } }
}
async function loadHousehold() { const mem = chk(await SB.from("members").select("household_id").eq("user_id", SYN.uid)) || []; if (mem.length && !SYN.hh) { SYN.hh = mem[0].household_id; SYN.last = "1970-01-01T00:00:00Z"; await saveSyncMeta(); } }
async function loadSyncInfo() { if (!SB || !SYN.hh) return; try { const h = chk(await SB.from("households").select("invite_code,name").eq("id", SYN.hh).single()); syncInfo = { code: h.invite_code, name: h.name }; if (ui.view === "settings") render(); } catch (e) {} }
async function syncBoot() {
  if (!syncConfigured()) return;
  try { SB = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }); } catch (e) { SB = null; return; }
  try { const s = await idbGet("sync"); if (s) SYN = Object.assign(SYN, s); const sh = await idbGet("shadow"); if (sh) SHADOW = sh; } catch (e) {}
  let ses = null; try { ses = (await SB.auth.getSession()).data.session; } catch (e) {}
  if (!ses) { SYN.uid = null; SYN.email = null; setSync("off"); return; }
  SYN.uid = ses.user.id; SYN.email = ses.user.email;
  try { await loadHousehold(); } catch (e) {}
  if (SYN.hh) syncNow(); render();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleSync(300); });
setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 30000);
async function syncLogin(email, pass, isNew) {
  const r = isNew ? await SB.auth.signUp({ email: email, password: pass }) : await SB.auth.signInWithPassword({ email: email, password: pass });
  if (r.error) throw r.error;
  const ses = r.data.session; if (!ses) throw new Error("Аккаунт создан, но нужно подтвердить почту. Открой письмо от Supabase и затем войди.");
  SYN.uid = ses.user.id; SYN.email = ses.user.email; SYN.hh = null; SHADOW = {};
  await loadHousehold(); await saveSyncMeta(); if (SYN.hh) { await syncNow(); loadSyncInfo(); }
}
async function syncCreate() { const id = chk(await SB.rpc("create_household", { p_name: "Кладовая" })); SYN.hh = id; SYN.last = "1970-01-01T00:00:00Z"; SHADOW = {}; await saveSyncMeta(); await syncNow(); await loadSyncInfo(); }
async function syncJoin(code) { const id = chk(await SB.rpc("join_household", { p_code: code })); SYN.hh = id; SYN.last = "1970-01-01T00:00:00Z"; SHADOW = {}; await saveSyncMeta(); await syncNow(); await loadSyncInfo(); }
async function syncLogout() { try { await SB.auth.signOut(); } catch (e) {} SYN = { hh: null, uid: null, email: null, last: "1970-01-01T00:00:00Z" }; SHADOW = {}; syncInfo = null; await saveSyncMeta(); setSync("off"); }
function ruErr(e) {
  const m = String((e && e.message) || e);
  if (/Invalid login credentials/i.test(m)) return "Неверная почта или пароль.";
  if (/already registered|already exists/i.test(m)) return "Такая почта уже зарегистрирована. Нажми «Войти».";
  if (/Password should be at least/i.test(m)) return "Пароль слишком короткий: нужно хотя бы 6 символов.";
  if (/valid email|invalid format/i.test(m)) return "Проверь адрес почты.";
  if (/Email not confirmed/i.test(m)) return "Почта не подтверждена. Открой письмо от Supabase или отключи подтверждение (см. инструкцию).";
  if (/Код не найден/.test(m)) return "Код не найден. Проверь, что он введён без ошибок.";
  if (/fetch|network|Load failed/i.test(m)) return "Нет связи с сервером. Проверь интернет и попробуй ещё раз.";
  return m;
}

/* ---------- запуск ---------- */
(async function boot() {
  let st = null; try { st = await idbGet("state"); } catch (e) {}
  S = st && st.v ? Object.assign(freshState(), st) : freshState();
  registerAI();
  if (!st) idbPut("state", S);
  ready = true; render();
  syncBoot();
})();
window.__kl = { get S() { return S; }, ui: ui, A: A, render: render };
})();
