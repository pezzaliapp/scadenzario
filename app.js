/* Scadenziario Professionale – PWA gratuita, dati solo in locale */
'use strict';

const VERSIONE = '1.0.1';
const KEY = 'scadenzario.v1';
const KEY_NOTIF = 'scadenzario.notificate';
const KEY_TEMA = 'scadenzario.tema';

const CATEGORIE_DEFAULT = [
  { id: 'fiscale', nome: 'Fiscale', colore: '#c0392b' },
  { id: 'previdenza', nome: 'Previdenza', colore: '#8e44ad' },
  { id: 'contratti', nome: 'Contratti', colore: '#2f6fb3' },
  { id: 'assicurazioni', nome: 'Assicurazioni', colore: '#16a085' },
  { id: 'clienti', nome: 'Clienti', colore: '#e67e22' },
  { id: 'fornitori', nome: 'Fornitori', colore: '#7f8c8d' },
  { id: 'personale', nome: 'Personale', colore: '#d35400' },
  { id: 'altro', nome: 'Altro', colore: '#34495e' }
];

const RICORRENZE = {
  settimanale: { giorni: 7, label: 'Settimanale', rrule: 'FREQ=WEEKLY' },
  mensile: { mesi: 1, label: 'Mensile', rrule: 'FREQ=MONTHLY' },
  bimestrale: { mesi: 2, label: 'Bimestrale', rrule: 'FREQ=MONTHLY;INTERVAL=2' },
  trimestrale: { mesi: 3, label: 'Trimestrale', rrule: 'FREQ=MONTHLY;INTERVAL=3' },
  semestrale: { mesi: 6, label: 'Semestrale', rrule: 'FREQ=MONTHLY;INTERVAL=6' },
  annuale: { mesi: 12, label: 'Annuale', rrule: 'FREQ=YEARLY' }
};

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI_SETT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/* ---------- Utility ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const oggiISO = () => toISO(new Date());
const fmtData = (s) => parseISO(s).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDataLunga = (s) => parseISO(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const diffGiorni = (iso) => Math.round((parseISO(iso) - parseISO(oggiISO())) / 86400000);

function addGiorni(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function addMesi(iso, n, giornoBase) {
  const d = parseISO(iso);
  const giorno = giornoBase || d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimo = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(giorno, ultimo));
  return toISO(t);
}
function prossimaData(s) {
  const r = RICORRENZE[s.ricorrenza];
  if (!r) return null;
  return r.giorni ? addGiorni(s.data, r.giorni) : addMesi(s.data, r.mesi, s.giornoBase);
}

/* Festività nazionali italiane */
function pasqua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mese - 1, giorno);
}
const cacheFestivi = {};
function festiviAnno(y) {
  if (cacheFestivi[y]) return cacheFestivi[y];
  const p = pasqua(y); const pm = new Date(p); pm.setDate(p.getDate() + 1);
  const set = new Set(['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26']
    .map((md) => `${y}-${md}`));
  set.add(toISO(p)); set.add(toISO(pm));
  return (cacheFestivi[y] = set);
}
function isFestivo(iso) {
  const d = parseISO(iso); const w = d.getDay();
  return w === 0 || w === 6 || festiviAnno(d.getFullYear()).has(iso);
}
function primoLavorativo(iso) { let x = iso; while (isFestivo(x)) x = addGiorni(x, 1); return x; }

/* ---------- Stato ---------- */
let stato = carica();
function carica() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Array.isArray(raw.scadenze)) {
      raw.categorie = raw.categorie?.length ? raw.categorie : CATEGORIE_DEFAULT.slice();
      return raw;
    }
  } catch (e) { /* dati non validi */ }
  return { scadenze: [], categorie: CATEGORIE_DEFAULT.slice() };
}
function salva() {
  try { localStorage.setItem(KEY, JSON.stringify(stato)); } catch (e) { toast('Spazio di archiviazione esaurito'); }
  specchioIDB();
  render();
}
/* Copia in IndexedDB, leggibile dal service worker per i promemoria in background */
function specchioIDB() {
  if (!('indexedDB' in window)) return;
  try {
    const req = indexedDB.open('scadenzario', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(stato.scadenze.filter((s) => !s.fatto), 'aperte');
      tx.oncomplete = () => db.close();
    };
  } catch (e) { /* ignora */ }
}
const categoria = (id) => stato.categorie.find((c) => c.id === id) || { id: 'altro', nome: 'Altro', colore: '#7f8c8d' };

/* ---------- Classificazione ---------- */
function infoStato(s) {
  if (s.fatto) return { cls: 'green', txt: 'Completata' };
  const g = diffGiorni(s.data);
  if (g < 0) return { cls: 'red', txt: g === -1 ? 'Scaduta ieri' : `Scaduta da ${-g} gg` };
  if (g === 0) return { cls: 'red', txt: 'Oggi' };
  if (g === 1) return { cls: 'orange', txt: 'Domani' };
  if (g <= (Number(s.preavviso) || 7)) return { cls: 'orange', txt: `Tra ${g} gg` };
  return { cls: 'blue', txt: `Tra ${g} gg` };
}
const ordina = (a, b) => a.data.localeCompare(b.data) || (b.priorita === 'alta') - (a.priorita === 'alta') || a.titolo.localeCompare(b.titolo);

/* ---------- Render ---------- */
function itemHTML(s) {
  const c = categoria(s.categoria);
  const d = parseISO(s.data);
  const st = infoStato(s);
  const meta = [
    `<span>${esc(c.nome)}</span>`,
    s.cliente ? `<span>👤 ${esc(s.cliente)}</span>` : '',
    s.ricorrenza ? `<span>🔁 ${RICORRENZE[s.ricorrenza]?.label || ''}</span>` : '',
    s.priorita === 'alta' ? '<span>⚑ Alta priorità</span>' : '',
    !s.fatto && isFestivo(s.data) ? `<span title="Cade in giorno festivo">⚠ slitta al ${fmtData(primoLavorativo(s.data))}</span>` : ''
  ].join('');
  return `<div class="item ${s.fatto ? 'done' : ''}" style="--cat:${esc(c.colore)}" data-id="${s.id}">
    <div class="date"><div class="d">${d.getDate()}</div><div class="m">${MESI[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}</div></div>
    <div><div class="t">${esc(s.titolo)}</div><div class="meta">${meta}</div></div>
    <div class="right">
      ${s.importo ? `<span class="amt">${euro(s.importo)}</span>` : ''}
      <span class="badge ${st.cls}">${st.txt}</span>
    </div>
  </div>`;
}
function lista(el, arr, vuoto) {
  el.innerHTML = arr.length ? arr.map(itemHTML).join('') : `<div class="empty">${vuoto}</div>`;
}
function itemConCheck(el) {
  // aggiunge il pulsante "completa" all'inizio di ogni riga
  $$('.item', el).forEach((row) => {
    const s = stato.scadenze.find((x) => x.id === row.dataset.id);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chk' + (s.fatto ? ' on' : ''); b.textContent = s.fatto ? '✓' : '';
    b.title = s.fatto ? 'Segna da fare' : 'Segna come completata';
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', (e) => { e.stopPropagation(); toggleFatto(s.id); });
    row.querySelector('.right').appendChild(b);
  });
}

function renderDashboard() {
  const aperte = stato.scadenze.filter((s) => !s.fatto);
  const scadute = aperte.filter((s) => diffGiorni(s.data) < 0).sort(ordina);
  const oggi = aperte.filter((s) => diffGiorni(s.data) === 0);
  const sett = aperte.filter((s) => { const g = diffGiorni(s.data); return g >= 0 && g <= 7; });
  const mese = aperte.filter((s) => { const g = diffGiorni(s.data); return g >= 0 && g <= 30; }).sort(ordina);
  const somma = (a) => a.reduce((t, s) => t + (Number(s.importo) || 0), 0);
  const stat = (cls, n, l, imp, filtro) => `<div class="stat ${cls}" data-filtro="${filtro}"><div class="n">${n}</div><div class="l">${l}</div>${imp ? `<div class="e">${euro(imp)}</div>` : ''}</div>`;
  $('#stats').innerHTML =
    stat('red', scadute.length, 'Scadute', somma(scadute), 'scadute') +
    stat('orange', oggi.length, 'In scadenza oggi', somma(oggi), '7') +
    stat('blue', sett.length, 'Prossimi 7 giorni', somma(sett), '7') +
    stat('green', mese.length, 'Prossimi 30 giorni', somma(mese), '30');
  lista($('#listScadute'), scadute, 'Nessuna scadenza arretrata 👍');
  lista($('#listProssime'), mese, stato.scadenze.length ? 'Niente in scadenza nei prossimi 30 giorni.' : 'Nessuna scadenza. Premi <b>+ Nuova</b> oppure carica gli esempi da Impostazioni.');
  itemConCheck($('#listScadute')); itemConCheck($('#listProssime'));
}

function renderElenco() {
  const q = $('#fCerca').value.trim().toLowerCase();
  const fs = $('#fStato').value, fc = $('#fCategoria').value, fp = $('#fPeriodo').value;
  const oggi = new Date();
  let arr = stato.scadenze.filter((s) => {
    if (fs === 'aperte' && s.fatto) return false;
    if (fs === 'fatte' && !s.fatto) return false;
    if (fs === 'scadute' && (s.fatto || diffGiorni(s.data) >= 0)) return false;
    if (fc && s.categoria !== fc) return false;
    if (fp !== 'tutto') {
      const d = parseISO(s.data), g = diffGiorni(s.data);
      if (fp === 'mese' && (d.getMonth() !== oggi.getMonth() || d.getFullYear() !== oggi.getFullYear())) return false;
      if (fp === 'anno' && d.getFullYear() !== oggi.getFullYear()) return false;
      if (/^\d+$/.test(fp) && (g < 0 || g > Number(fp))) return false;
    }
    if (q && !`${s.titolo} ${s.cliente || ''} ${s.note || ''} ${categoria(s.categoria).nome}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort(ordina);
  if (fs === 'fatte') arr.reverse();
  const tot = arr.reduce((t, s) => t + (Number(s.importo) || 0), 0);
  $('#totaliElenco').textContent = `${arr.length} scadenz${arr.length === 1 ? 'a' : 'e'}${tot ? ' · totale ' + euro(tot) : ''}`;
  lista($('#listElenco'), arr, 'Nessuna scadenza corrisponde ai filtri.');
  itemConCheck($('#listElenco'));
}

let calMese = new Date(); calMese.setDate(1);
let calSel = oggiISO();
function renderCalendario() {
  const y = calMese.getFullYear(), m = calMese.getMonth();
  $('#calTitolo').textContent = `${MESI[m]} ${y}`;
  const primo = new Date(y, m, 1);
  const offset = (primo.getDay() + 6) % 7;
  const inizio = new Date(y, m, 1 - offset);
  const perGiorno = {};
  stato.scadenze.forEach((s) => (perGiorno[s.data] ||= []).push(s));
  let html = GIORNI_SETT.map((g) => `<div class="cal-dow">${g}</div>`).join('');
  const oggi = oggiISO();
  for (let i = 0; i < 42; i++) {
    const d = new Date(inizio); d.setDate(inizio.getDate() + i);
    const iso = toISO(d);
    const items = (perGiorno[iso] || []).sort(ordina);
    const cls = ['cal-day', d.getMonth() !== m ? 'out' : '', iso === oggi ? 'today' : '', iso === calSel ? 'sel' : '', isFestivo(iso) ? 'festivo' : ''].join(' ');
    html += `<button type="button" class="${cls}" data-iso="${iso}" aria-label="${fmtDataLunga(iso)}${items.length ? ', ' + items.length + ' scadenze' : ''}">
      <span class="num">${d.getDate()}</span>
      <span class="dots">${items.slice(0, 6).map((s) => `<i class="dot" style="background:${esc(categoria(s.categoria).colore)};${s.fatto ? 'opacity:.35' : ''}"></i>`).join('')}</span>
      ${items.slice(0, 3).map((s) => `<span class="lbl" style="background:${esc(categoria(s.categoria).colore)};${s.fatto ? 'opacity:.4;text-decoration:line-through' : ''}">${esc(s.titolo)}</span>`).join('')}
      ${items.length > 3 ? `<span class="small muted">+${items.length - 3}</span>` : ''}
    </button>`;
    if (i === 34 && new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + 35).getMonth() !== m) break;
  }
  $('#calGrid').innerHTML = html;
  $('#calGiornoTitolo').textContent = fmtDataLunga(calSel) + (isFestivo(calSel) ? ' · festivo' : '');
  const delGiorno = (perGiorno[calSel] || []).sort(ordina);
  lista($('#calGiornoLista'), delGiorno, 'Nessuna scadenza in questo giorno.');
  itemConCheck($('#calGiornoLista'));
}

function renderCategorie() {
  const opts = stato.categorie.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
  const fc = $('#fCategoria'); const v = fc.value;
  fc.innerHTML = '<option value="">Tutte le categorie</option>' + opts; fc.value = v;
  const sc = $('#sCategoria'); const v2 = sc.value;
  sc.innerHTML = opts; if (v2) sc.value = v2;
  $('#catList').innerHTML = stato.categorie.map((c) => {
    const n = stato.scadenze.filter((s) => s.categoria === c.id).length;
    return `<span class="chip"><i style="background:${esc(c.colore)}"></i>${esc(c.nome)} <span class="muted">(${n})</span><button type="button" data-cat="${esc(c.id)}" title="Elimina categoria" aria-label="Elimina ${esc(c.nome)}">×</button></span>`;
  }).join('');
}

function render() {
  $('#oggi').textContent = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  renderCategorie();
  renderDashboard();
  renderElenco();
  renderCalendario();
  aggiornaBadge();
}

function aggiornaBadge() {
  const n = stato.scadenze.filter((s) => !s.fatto && diffGiorni(s.data) <= 0).length;
  if ('setAppBadge' in navigator) { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); }
  document.title = n ? `(${n}) Scadenziario Professionale` : 'Scadenziario Professionale';
}

/* ---------- Azioni ---------- */
function toggleFatto(id) {
  const s = stato.scadenze.find((x) => x.id === id);
  if (!s) return;
  s.fatto = !s.fatto;
  s.completataIl = s.fatto ? new Date().toISOString() : null;
  let msg = s.fatto ? 'Scadenza completata ✓' : 'Scadenza riaperta';
  if (s.fatto && s.ricorrenza && !s.successivaId) {
    const nuova = { ...s, id: uid(), data: prossimaData(s), fatto: false, completataIl: null, successivaId: null, creata: new Date().toISOString() };
    s.successivaId = nuova.id;
    stato.scadenze.push(nuova);
    msg += ` · prossima il ${fmtData(nuova.data)}`;
  }
  salva();
  toast(msg);
}

const dlg = $('#dlg');
function apriForm(s, preset = {}) {
  const nuovo = !s;
  $('#dlgTitolo').textContent = nuovo ? 'Nuova scadenza' : 'Modifica scadenza';
  $('#sId').value = s?.id || '';
  $('#sTitolo').value = s?.titolo || '';
  $('#sData').value = s?.data || preset.data || oggiISO();
  $('#sCategoria').value = s?.categoria || stato.categorie[0]?.id || '';
  $('#sImporto').value = s?.importo || '';
  $('#sCliente').value = s?.cliente || '';
  $('#sRicorrenza').value = s?.ricorrenza || '';
  $('#sPreavviso').value = s?.preavviso ?? 7;
  $('#sPriorita').value = s?.priorita || 'normale';
  $('#sFatto').checked = !!s?.fatto;
  $('#sNote').value = s?.note || '';
  $('#btnElimina').classList.toggle('hidden', nuovo);
  $('#btnDuplica').classList.toggle('hidden', nuovo);
  avvisoFestivo();
  dlg.showModal();
  if (nuovo) setTimeout(() => $('#sTitolo').focus(), 50);
}
function avvisoFestivo() {
  const v = $('#sData').value;
  $('#avvisoFestivo').textContent = v && isFestivo(v)
    ? `⚠ ${fmtDataLunga(v)} è festivo: gli adempimenti fiscali slittano di norma a ${fmtDataLunga(primoLavorativo(v))}.`
    : '';
}
function leggiForm() {
  const data = $('#sData').value;
  return {
    titolo: $('#sTitolo').value.trim(),
    data,
    giornoBase: parseISO(data).getDate(),
    categoria: $('#sCategoria').value,
    importo: $('#sImporto').value ? Math.round(parseFloat($('#sImporto').value) * 100) / 100 : '',
    cliente: $('#sCliente').value.trim(),
    ricorrenza: $('#sRicorrenza').value,
    preavviso: Math.max(0, parseInt($('#sPreavviso').value, 10) || 0),
    priorita: $('#sPriorita').value,
    note: $('#sNote').value.trim()
  };
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const dati = leggiForm();
  if (!dati.titolo || !dati.data) return;
  const id = $('#sId').value;
  const fatto = $('#sFatto').checked;
  if (id) {
    const s = stato.scadenze.find((x) => x.id === id);
    const eraFatto = s.fatto;
    Object.assign(s, dati, { modificata: new Date().toISOString() });
    dlg.close();
    if (fatto !== eraFatto) toggleFatto(id); else { salva(); toast('Scadenza aggiornata'); }
  } else {
    const s = { id: uid(), ...dati, fatto: false, creata: new Date().toISOString() };
    stato.scadenze.push(s);
    dlg.close();
    if (fatto) toggleFatto(s.id); else { salva(); toast('Scadenza aggiunta'); }
  }
});
$('#btnAnnulla').addEventListener('click', () => dlg.close());
$('#sData').addEventListener('change', avvisoFestivo);
$('#btnElimina').addEventListener('click', () => {
  const id = $('#sId').value;
  if (!confirm('Eliminare questa scadenza?')) return;
  stato.scadenze = stato.scadenze.filter((s) => s.id !== id);
  dlg.close(); salva(); toast('Scadenza eliminata');
});
$('#btnDuplica').addEventListener('click', () => {
  const dati = leggiForm();
  $('#sId').value = '';
  $('#dlgTitolo').textContent = 'Nuova scadenza (copia)';
  $('#sTitolo').value = dati.titolo + ' (copia)';
  $('#sFatto').checked = false;
  $('#btnElimina').classList.add('hidden');
  $('#btnDuplica').classList.add('hidden');
});
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

$('#btnNuova').addEventListener('click', () => apriForm(null, { data: $('#view-calendario').classList.contains('active') ? calSel : undefined }));
document.addEventListener('click', (e) => {
  const row = e.target.closest('.item');
  if (row) { const s = stato.scadenze.find((x) => x.id === row.dataset.id); if (s) apriForm(s); }
});

/* Tabs */
function vaiA(view) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  window.scrollTo(0, 0);
}
$$('.tab').forEach((t) => t.addEventListener('click', () => vaiA(t.dataset.view)));
$('#stats').addEventListener('click', (e) => {
  const st = e.target.closest('.stat'); if (!st) return;
  const f = st.dataset.filtro;
  $('#fStato').value = f === 'scadute' ? 'scadute' : 'aperte';
  $('#fPeriodo').value = f === 'scadute' ? 'tutto' : f;
  $('#fCategoria').value = ''; $('#fCerca').value = '';
  renderElenco(); vaiA('elenco');
});

/* Filtri */
['#fCerca', '#fStato', '#fCategoria', '#fPeriodo'].forEach((s) => $(s).addEventListener('input', renderElenco));

/* Calendario */
$('#calPrev').addEventListener('click', () => { calMese.setMonth(calMese.getMonth() - 1); renderCalendario(); });
$('#calNext').addEventListener('click', () => { calMese.setMonth(calMese.getMonth() + 1); renderCalendario(); });
$('#calOggi').addEventListener('click', () => { calMese = new Date(); calMese.setDate(1); calSel = oggiISO(); renderCalendario(); });
$('#calGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.cal-day'); if (!b) return;
  if (calSel === b.dataset.iso && !(stato.scadenze.some((s) => s.data === calSel))) { apriForm(null, { data: calSel }); return; }
  calSel = b.dataset.iso;
  const d = parseISO(calSel);
  if (d.getMonth() !== calMese.getMonth()) { calMese = new Date(d.getFullYear(), d.getMonth(), 1); }
  renderCalendario();
});

/* Categorie */
$('#catForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = $('#catNome').value.trim(); if (!nome) return;
  if (stato.categorie.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) { toast('Categoria già esistente'); return; }
  stato.categorie.push({ id: uid(), nome, colore: $('#catColore').value });
  $('#catNome').value = ''; salva(); toast('Categoria aggiunta');
});
$('#catList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-cat]'); if (!b) return;
  const id = b.dataset.cat;
  if (stato.categorie.length <= 1) { toast('Serve almeno una categoria'); return; }
  const n = stato.scadenze.filter((s) => s.categoria === id).length;
  if (!confirm(n ? `Eliminare la categoria? Le ${n} scadenze collegate passeranno alla prima categoria disponibile.` : 'Eliminare la categoria?')) return;
  stato.categorie = stato.categorie.filter((c) => c.id !== id);
  stato.scadenze.forEach((s) => { if (s.categoria === id) s.categoria = stato.categorie[0].id; });
  salva();
});

/* ---------- Esportazioni ---------- */
function scarica(nome, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const stamp = () => oggiISO().replace(/-/g, '');

function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFold(line) {
  const out = []; let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur); return out.join('\r\n');
}
function generaICS() {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const righe = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Scadenziario Professionale//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Scadenziario'];
  stato.scadenze.filter((s) => !s.fatto).forEach((s) => {
    const inizio = s.data.replace(/-/g, '');
    const fine = addGiorni(s.data, 1).replace(/-/g, '');
    const desc = [
      `Categoria: ${categoria(s.categoria).nome}`,
      s.cliente ? `Cliente/Rif.: ${s.cliente}` : '',
      s.importo ? `Importo: ${euro(s.importo)}` : '',
      s.note || ''
    ].filter(Boolean).join('\n');
    const pre = Number(s.preavviso) || 0;
    righe.push('BEGIN:VEVENT', `UID:${s.id}@scadenzario`, `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${inizio}`, `DTEND;VALUE=DATE:${fine}`,
      `SUMMARY:${icsEsc((s.importo ? '€ ' : '') + s.titolo)}`, `DESCRIPTION:${icsEsc(desc)}`,
      `CATEGORIES:${icsEsc(categoria(s.categoria).nome)}`, 'TRANSP:TRANSPARENT');
    if (s.ricorrenza && RICORRENZE[s.ricorrenza]) righe.push('RRULE:' + RICORRENZE[s.ricorrenza].rrule);
    // allarme alle 9:00 del giorno di preavviso e alle 9:00 del giorno stesso
    if (pre > 0) righe.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc('Tra ' + pre + ' giorni: ' + s.titolo)}`, `TRIGGER:-P${pre - 1}DT15H`, 'END:VALARM');
    righe.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc('Oggi: ' + s.titolo)}`, 'TRIGGER:PT9H', 'END:VALARM');
    righe.push('END:VEVENT');
  });
  righe.push('END:VCALENDAR');
  return righe.map(icsFold).join('\r\n') + '\r\n';
}
$('#btnIcs').addEventListener('click', () => {
  if (!stato.scadenze.some((s) => !s.fatto)) { toast('Nessuna scadenza da esportare'); return; }
  scarica(`scadenziario-${stamp()}.ics`, generaICS(), 'text/calendar;charset=utf-8');
  toast('Calendario esportato');
});
$('#btnCsv').addEventListener('click', () => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Data', 'Titolo', 'Categoria', 'Cliente/Riferimento', 'Importo', 'Ricorrenza', 'Priorità', 'Stato', 'Note'];
  const rows = stato.scadenze.slice().sort(ordina).map((s) => [
    fmtData(s.data), s.titolo, categoria(s.categoria).nome, s.cliente,
    s.importo ? Number(s.importo).toFixed(2).replace('.', ',') : '',
    s.ricorrenza ? RICORRENZE[s.ricorrenza].label : '', s.priorita, s.fatto ? 'Completata' : infoStato(s).txt, s.note
  ].map(cell).join(';'));
  scarica(`scadenziario-${stamp()}.csv`, '\uFEFF' + [head.map(cell).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
  toast('File CSV esportato');
});
$('#btnBackup').addEventListener('click', () => {
  scarica(`scadenziario-backup-${stamp()}.json`, JSON.stringify({ app: 'scadenzario', versione: VERSIONE, esportato: new Date().toISOString(), ...stato }, null, 2), 'application/json');
  toast('Backup salvato');
});
$('#fileImport').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.scadenze)) throw new Error('formato');
    const valide = d.scadenze.filter((s) => s && s.id && s.titolo && /^\d{4}-\d{2}-\d{2}$/.test(s.data));
    const unisci = stato.scadenze.length && confirm(`Trovate ${valide.length} scadenze.\n\nOK = unisci a quelle esistenti\nAnnulla = sostituisci tutto`);
    if (unisci) {
      const ids = new Set(stato.scadenze.map((s) => s.id));
      valide.forEach((s) => { if (!ids.has(s.id)) stato.scadenze.push(s); });
      (d.categorie || []).forEach((c) => { if (!stato.categorie.some((x) => x.id === c.id)) stato.categorie.push(c); });
    } else {
      stato = { scadenze: valide, categorie: d.categorie?.length ? d.categorie : CATEGORIE_DEFAULT.slice() };
    }
    salva(); toast(`Importate ${valide.length} scadenze`);
  } catch (err) { toast('File non valido'); }
});

/* Demo / reset */
$('#btnDemo').addEventListener('click', () => {
  const o = oggiISO();
  const meseProx = (g) => { const d = parseISO(o); return toISO(new Date(d.getFullYear(), d.getMonth() + (d.getDate() >= g ? 1 : 0), g)); };
  const es = [
    { titolo: 'F24 – Versamento IVA mensile', data: meseProx(16), categoria: 'fiscale', importo: 1250, ricorrenza: 'mensile', preavviso: 5, priorita: 'alta', note: 'Codice tributo 6001-6012 in base al mese' },
    { titolo: 'F24 – Ritenute dipendenti e collaboratori', data: meseProx(16), categoria: 'fiscale', importo: 840, ricorrenza: 'mensile', preavviso: 5, note: 'Codici 1001 / 1040' },
    { titolo: 'Contributi INPS gestione separata', data: addGiorni(o, 12), categoria: 'previdenza', importo: 620, ricorrenza: 'trimestrale', preavviso: 7 },
    { titolo: 'Rata polizza RC professionale', data: addGiorni(o, 3), categoria: 'assicurazioni', importo: 480, ricorrenza: 'annuale', preavviso: 15, cliente: 'Compagnia assicurativa' },
    { titolo: 'Rinnovo casella PEC', data: addGiorni(o, 40), categoria: 'contratti', importo: 6.5, ricorrenza: 'annuale', preavviso: 30 },
    { titolo: 'Canone affitto ufficio', data: meseProx(5), categoria: 'fornitori', importo: 900, ricorrenza: 'mensile', preavviso: 3 },
    { titolo: 'Incasso fattura n. 42', data: addGiorni(o, -4), categoria: 'clienti', importo: 2300, preavviso: 2, cliente: 'Rossi Srl', priorita: 'alta', note: 'Sollecitare il pagamento' },
    { titolo: 'Scadenza contratto assistenza software', data: addGiorni(o, 75), categoria: 'contratti', importo: 360, ricorrenza: 'annuale', preavviso: 30, note: 'Disdetta entro 60 giorni' },
    { titolo: 'Visita medica dipendente', data: addGiorni(o, 21), categoria: 'personale', preavviso: 7 },
    { titolo: 'Diritto camerale annuale', data: addGiorni(o, 0), categoria: 'fiscale', importo: 120, ricorrenza: 'annuale', preavviso: 10 }
  ];
  es.forEach((s) => stato.scadenze.push({ id: uid(), cliente: '', note: '', priorita: 'normale', ricorrenza: '', importo: '', ...s, giornoBase: parseISO(s.data).getDate(), fatto: false, creata: new Date().toISOString() }));
  salva(); toast('Esempi caricati'); vaiA('dashboard');
});
$('#btnReset').addEventListener('click', () => {
  if (!confirm('Cancellare TUTTE le scadenze e le categorie personalizzate? Operazione irreversibile.')) return;
  stato = { scadenze: [], categorie: CATEGORIE_DEFAULT.slice() };
  localStorage.removeItem(KEY_NOTIF);
  salva(); toast('Dati cancellati');
});

/* Tema */
function applicaTema(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-tema'); else document.documentElement.dataset.tema = t;
  $('#tema').value = t;
}
$('#tema').addEventListener('change', (e) => { localStorage.setItem(KEY_TEMA, e.target.value); applicaTema(e.target.value); });
applicaTema(localStorage.getItem(KEY_TEMA) || 'auto');

/* ---------- Notifiche ---------- */
function statoNotifiche() {
  if (!('Notification' in window)) { $('#statoNotifiche').textContent = 'Non supportate da questo browser (su iPhone installa prima l\'app nella Home).'; $('#btnNotifiche').disabled = true; return; }
  const p = Notification.permission;
  $('#statoNotifiche').textContent = p === 'granted' ? ' ✓ Attive' : p === 'denied' ? ' Bloccate nelle impostazioni del browser' : '';
  $('#btnNotifiche').textContent = p === 'granted' ? 'Invia notifica di prova' : 'Attiva notifiche';
}
$('#btnNotifiche').addEventListener('click', async () => {
  if (Notification.permission === 'granted') { notifica('Scadenziario', 'Le notifiche funzionano ✓', 'test'); return; }
  const p = await Notification.requestPermission();
  statoNotifiche();
  if (p === 'granted') { registraPeriodico(); controllaScadenze(true); toast('Notifiche attivate'); }
});
async function notifica(titolo, corpo, tag) {
  const opt = { body: corpo, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#dashboard' } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titolo, opt); else new Notification(titolo, opt);
  } catch (e) { /* ignora */ }
}
function controllaScadenze(forza = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  let inviate = {};
  try { inviate = JSON.parse(localStorage.getItem(KEY_NOTIF)) || {}; } catch (e) { /* */ }
  const oggi = oggiISO();
  const daAvvisare = stato.scadenze.filter((s) => {
    if (s.fatto) return false;
    const g = diffGiorni(s.data);
    return g <= (Number(s.preavviso) || 0) && (forza || inviate[s.id] !== oggi);
  }).sort(ordina);
  if (!daAvvisare.length) return;
  if (daAvvisare.length > 3) {
    const scad = daAvvisare.filter((s) => diffGiorni(s.data) < 0).length;
    notifica(`${daAvvisare.length} scadenze da gestire`, `${scad ? scad + ' scadute · ' : ''}${daAvvisare.slice(0, 3).map((s) => s.titolo).join(', ')}…`, 'riepilogo');
  } else {
    daAvvisare.forEach((s) => notifica(infoStato(s).txt + ' · ' + s.titolo, `${fmtDataLunga(s.data)}${s.importo ? ' · ' + euro(s.importo) : ''}${s.cliente ? ' · ' + s.cliente : ''}`, s.id));
  }
  daAvvisare.forEach((s) => (inviate[s.id] = oggi));
  localStorage.setItem(KEY_NOTIF, JSON.stringify(inviate));
}
async function registraPeriodico() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && 'periodicSync' in reg) {
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') await reg.periodicSync.register('controllo-scadenze', { minInterval: 12 * 60 * 60 * 1000 });
    }
  } catch (e) { /* non supportato */ }
}

/* ---------- Installazione PWA ---------- */
let promptInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstall = e; $('#installBox').classList.remove('hidden'); });
$('#btnInstalla').addEventListener('click', async () => {
  if (!promptInstall) return;
  promptInstall.prompt(); await promptInstall.userChoice; promptInstall = null;
  $('#installBox').classList.add('hidden');
});
window.addEventListener('appinstalled', () => $('#installBox').classList.add('hidden'));
(function suggerimentoIOS() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone) {
    $('#installBox').classList.remove('hidden');
    $('#installBox').innerHTML = '<div><strong>Installa su iPhone/iPad</strong><br><span class="muted">Tocca Condividi ⬆︎ e poi “Aggiungi alla schermata Home”.</span></div>';
  }
})();

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Avvio ---------- */
$('#versione').textContent = VERSIONE;
const viewIniziale = location.hash.slice(1);
if (['dashboard', 'elenco', 'calendario', 'impostazioni'].includes(viewIniziale)) vaiA(viewIniziale);
render();
specchioIDB();
statoNotifiche();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => { registraPeriodico(); controllaScadenze(); }).catch(() => {});
  });
}
// ricontrolla al ritorno sull'app e ogni 30 minuti; aggiorna anche al cambio di giorno
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); controllaScadenze(); } });
setInterval(() => { render(); controllaScadenze(); }, 30 * 60 * 1000);
