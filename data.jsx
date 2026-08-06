// Buukkauskisa · data
// Ei keksittyjä pelaajia. Kaikki pelaajat tallentuvat localStorageen
// avaimella nick:city — sama yhdistelmä jatkaa tilastoja.

const COMPETITION = {
  startDate: new Date('2026-05-25T00:00:00'),
  endDate:   new Date('2026-06-05T23:59:59'),
  weekdays: [
    { date: '25.5', wd: 'MA', week: 1 },
    { date: '26.5', wd: 'TI', week: 1 },
    { date: '27.5', wd: 'KE', week: 1 },
    { date: '28.5', wd: 'TO', week: 1 },
    { date: '29.5', wd: 'PE', week: 1 },
    { date:  '1.6', wd: 'MA', week: 2 },
    { date:  '2.6', wd: 'TI', week: 2 },
    { date:  '3.6', wd: 'KE', week: 2 },
    { date:  '4.6', wd: 'TO', week: 2 },
    { date:  '5.6', wd: 'PE', week: 2 },
  ],
  playoffWeekdays: [
    { date:  '8.6', wd: 'MA', week: 3 },
    { date:  '9.6', wd: 'TI', week: 3 },
    { date: '10.6', wd: 'KE', week: 3 },
    { date: '11.6', wd: 'TO', week: 3 },
    { date: '12.6', wd: 'PE', week: 3 },
    { date: '15.6', wd: 'MA', week: 4 },
    { date: '16.6', wd: 'TI', week: 4 },
    { date: '17.6', wd: 'KE', week: 4 },
    { date: '18.6', wd: 'TO', week: 4 },
  ],
  totalDays: 10,
  currentDay: 1,
  playoffStartDate: new Date('2026-06-08T00:00:00'),
  playoffEndDate:   new Date('2026-06-18T23:59:59'),
  playoffStart: '8.6',
  playoffEnd:   '18.6',
  playoffRounds: {
    QF: { label: 'PUOLIVÄLIERÄT', range: '8.6 – 9.6' },
    SF: { label: 'VÄLIERÄT',      range: '10.6 – 12.6' },
    F:  { label: 'FINAALI',       range: '15.6 – 18.6' },
  },
  finalDate:    '18.6.2026',
  finalDateLong: 'Torstai 18.6.2026',
};

// ── Phase ────────────────────────────────────
//   pre       — ennen kauden alkua (< 25.5)
//   regular   — runkosarja käynnissä
//   lock      — runkosarja päättynyt, playoff ei vielä alkanut (vk-loppu 6.6–7.6)
//   playoffs  — playoff käynnissä (8.6–18.6)
//   finished  — kisa ohi (> 18.6)
function competitionPhase(now) {
  now = now || new Date();
  if (now < COMPETITION.startDate) return 'pre';
  if (now <= COMPETITION.endDate) return 'regular';
  if (now < COMPETITION.playoffStartDate) return 'lock';
  if (now <= COMPETITION.playoffEndDate) return 'playoffs';
  return 'finished';
}

// ── Playoff defaults ────────────────────────────────────
// Pudotuspeli: 1 voitto otteluun → seuraavalle kierrokselle.
const EMPTY_PLAYOFF = {
  started: false,
  startedAt: null,
  finishedAt: null,
  championKey: null,
  seeds: {}, // { 1: 'nick:city', ... 8: '...' }
  matches: {
    QF1: { round: 'QF', seedH: 1, seedA: 8, homeKey: null, awayKey: null, winnerKey: null },
    QF2: { round: 'QF', seedH: 4, seedA: 5, homeKey: null, awayKey: null, winnerKey: null },
    QF3: { round: 'QF', seedH: 2, seedA: 7, homeKey: null, awayKey: null, winnerKey: null },
    QF4: { round: 'QF', seedH: 3, seedA: 6, homeKey: null, awayKey: null, winnerKey: null },
    SF1: { round: 'SF', from: ['QF1', 'QF2'], homeKey: null, awayKey: null, winnerKey: null },
    SF2: { round: 'SF', from: ['QF3', 'QF4'], homeKey: null, awayKey: null, winnerKey: null },
    F:   { round: 'F',  from: ['SF1', 'SF2'], homeKey: null, awayKey: null, winnerKey: null },
    B:   { round: 'B',  from: ['SF1', 'SF2'], loser: true,   homeKey: null, awayKey: null, winnerKey: null },
  },
};

const MATCH_ORDER = ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F', 'B'];

function recomputeAdvancement(playoff) {
  // Etenee voittajat seuraavaan kierrokseen
  const m = { ...playoff.matches };
  const ensure = (id, homeKey, awayKey) => {
    // Jos ottelu puuttuu (vanha tallennettu data), luo se oletuksesta
    const cur = m[id] || { ...EMPTY_PLAYOFF.matches[id] };
    if (cur.homeKey !== homeKey || cur.awayKey !== awayKey) {
      // jos joku slotti tyhjeni (peruutus), nollaa voittaja
      m[id] = { ...cur, homeKey, awayKey, winnerKey: null };
    } else {
      m[id] = cur;
    }
  };
  ensure('SF1', m.QF1.winnerKey, m.QF2.winnerKey);
  ensure('SF2', m.QF3.winnerKey, m.QF4.winnerKey);
  ensure('F',   m.SF1.winnerKey, m.SF2.winnerKey);

  // Pronssiottelu: VE-häviäjät (loser = se joka EI ole winnerKey)
  const loser = (match) => !match.winnerKey ? null
    : match.winnerKey === match.homeKey ? match.awayKey : match.homeKey;
  ensure('B', loser(m.SF1), loser(m.SF2));

  // Mestari
  const championKey = m.F.winnerKey;
  const finishedAt = championKey && !playoff.finishedAt ? Date.now() : (championKey ? playoff.finishedAt : null);

  return { ...playoff, matches: m, championKey, finishedAt };
}

// Täydentää vanhaan tallennettuun playoff-dataan myöhemmin lisätyt ottelut
// (esim. pronssiottelu B) ja laskee etenemisen uudelleen.
function migratePlayoff(playoff) {
  if (!playoff) return playoff;
  const matches = { ...playoff.matches };
  let changed = false;
  for (const id of MATCH_ORDER) {
    if (!matches[id]) {
      matches[id] = { ...EMPTY_PLAYOFF.matches[id] };
      changed = true;
    }
  }
  if (!changed) return playoff;
  return recomputeAdvancement({ ...playoff, matches });
}

function setMatchWinner(playoff, matchId, side) {
  // side: 'home' | 'away'
  const match = playoff.matches[matchId];
  if (!match) return playoff;
  if (!match.homeKey || !match.awayKey) return playoff;
  const winnerKey = side === 'home' ? match.homeKey : match.awayKey;
  const m = { ...match, winnerKey };
  const next = { ...playoff, matches: { ...playoff.matches, [matchId]: m } };
  return recomputeAdvancement(next);
}

function clearMatchWinner(playoff, matchId) {
  const match = playoff.matches[matchId];
  if (!match) return playoff;
  const m = { ...match, winnerKey: null };
  const next = { ...playoff, matches: { ...playoff.matches, [matchId]: m } };
  return recomputeAdvancement(next);
}

function startPlayoffs(playoff, sortedPlayers) {
  const top8 = sortedPlayers.slice(0, 8);
  if (top8.length < 8) return playoff;
  const seeds = {};
  top8.forEach((p, i) => { seeds[i + 1] = p.key; });
  const m = { ...EMPTY_PLAYOFF.matches };
  m.QF1 = { ...m.QF1, homeKey: seeds[1], awayKey: seeds[8] };
  m.QF2 = { ...m.QF2, homeKey: seeds[4], awayKey: seeds[5] };
  m.QF3 = { ...m.QF3, homeKey: seeds[2], awayKey: seeds[7] };
  m.QF4 = { ...m.QF4, homeKey: seeds[3], awayKey: seeds[6] };
  return {
    ...EMPTY_PLAYOFF,
    started: true,
    startedAt: Date.now(),
    seeds,
    matches: m,
  };
}

function resetPlayoffs() {
  return { ...EMPTY_PLAYOFF, matches: { ...EMPTY_PLAYOFF.matches } };
}

// localStorage avain käyttäjäsessiolle (admin/current player key)
const LS_CURRENT = 'buukkauskisa.current.v2';

// Slugi avain — case insensitive
function playerKey(nick, city) {
  return `${(nick || '').toLowerCase().trim()}:${(city || '').toLowerCase().trim()}`;
}

function emptyStats() {
  return {
    luurit: 0,
    vastatut: 0,
    buukit: 0,
    streak: 0,
    trendN: 0,
    last5: [0, 0, 0, 0, 0],
  };
}

function loadCurrentKey() {
  try { return localStorage.getItem(LS_CURRENT) || null; } catch (e) { return null; }
}

function saveCurrentKey(k) {
  try {
    if (k) localStorage.setItem(LS_CURRENT, k);
    else localStorage.removeItem(LS_CURRENT);
  } catch (e) { /* noop */ }
}

// ── Päivä/viikko -laskenta — automaattinen ──────────────

// Paikallinen päiväavain YYYY-MM-DD (ei UTC, jotta päivä ei karkaa aikavyöhykkeen takia)
function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Palauttaa nykyisen kilpailupäivän indeksin koko WEEKDAY_DATE_KEYS-listaan
// (runkosarja 0..9, playoffit 10..18). -1 jos ennen kautta.
// Viikonloppuna / aukkopäivänä palautetaan viimeisin mennyt kilpailupäivä.
function currentWeekdayIndex() {
  const now = new Date();
  if (now < COMPETITION.startDate) return -1;
  const todayKey = localDateKey(now);
  // Tarkka osuma kilpailupäivään (myös playoff-päivät)
  const exact = WEEKDAY_DATE_KEYS.indexOf(todayKey);
  if (exact >= 0) return exact;
  // Ei tarkkaa osumaa (viikonloppu/aukko) → viimeisin jo mennyt kilpailupäivä
  let last = -1;
  for (let i = 0; i < WEEKDAY_DATE_KEYS.length; i++) {
    const dt = new Date(WEEKDAY_DATE_KEYS[i] + 'T00:00:00');
    if (dt <= now) last = i; else break;
  }
  return last >= 0 ? last : COMPETITION.totalDays;
}

// Kuluvan viikon päivät (5 päivää) — viikko 1 tai 2
function currentWeekDays() {
  const idx = currentWeekdayIndex();
  if (idx < 0) return COMPETITION.weekdays.slice(0, 5);
  if (idx >= 5) return COMPETITION.weekdays.slice(5, 10);
  return COMPETITION.weekdays.slice(0, 5);
}

// Päivänumero kausissa: 1..10
function currentDayNumber() {
  const idx = currentWeekdayIndex();
  if (idx < 0) return 0;
  if (idx >= COMPETITION.totalDays) return COMPETITION.totalDays;
  return idx + 1;
}

// ── Päivä–avain -konversiot ──────────────────────────────────
const WEEKDAY_DATE_KEYS = [
  // Runkosarja
  '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29',
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
  // Playoff-viikot
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
  '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18',
];
function weekdayIndexToDateKey(idx) { return WEEKDAY_DATE_KEYS[idx] ?? null; }
function dateKeyToWeekdayIndex(key) { return WEEKDAY_DATE_KEYS.indexOf(key); }

// Laskee pelaajan yhteistilastot päiväkohtaisista riveistä
function recalcPlayerFromDailyStats(player, myRows) {
  let luurit = 0, vastatut = 0, buukit = 0, tapaamiset = 0;
  myRows.forEach(r => { luurit += (r.luurit||0); vastatut += (r.vastatut||0); buukit += (r.buukit||0); tapaamiset += (r.tapaamiset||0); });

  const dayIdx = Math.max(0, Math.min(9, currentWeekdayIndex() >= 0 ? currentWeekdayIndex() : 0));
  const weekOffset = dayIdx >= 5 ? 5 : 0;
  const last5 = [0, 0, 0, 0, 0];
  myRows.forEach(r => {
    const idx = dateKeyToWeekdayIndex(r.date_key);
    if (idx >= weekOffset && idx < weekOffset + 5) last5[idx - weekOffset] = (r.buukit || 0);
  });

  const buuksByDay = {};
  myRows.forEach(r => { buuksByDay[dateKeyToWeekdayIndex(r.date_key)] = r.buukit || 0; });
  let streak = 0;
  for (let i = dayIdx; i >= 0; i--) {
    if ((buuksByDay[i] || 0) > 0) streak++; else break;
  }

  const todayB = buuksByDay[dayIdx] || 0;
  const yesterB = dayIdx > 0 ? (buuksByDay[dayIdx - 1] || 0) : 0;
  const trendN = todayB - yesterB;

  return { ...player, luurit, vastatut, buukit, tapaamiset, last5, streak, trendN };
}

// Kaupan kesto (lead time) päivinä: allekirjoitus − ensimmäinen tapaaminen.
// null jos jompikumpi pvm puuttuu tai tulos olisi negatiivinen.
function dealLeadTimeDays(deal) {
  if (!deal || !deal.first_meeting_date || !deal.signed_date) return null;
  const a = new Date(deal.first_meeting_date + 'T00:00:00');
  const b = new Date(deal.signed_date + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const days = Math.round((b - a) / 86400000);
  return days >= 0 ? days : null;
}

// Laskee pelaajan kauppa-aggregaatit kauppariveistä (deals = totuuden lähde)
function recalcPlayerFromDeals(player, myDeals) {
  let megisTotal = 0, eurTotal = 0;
  let leadSum = 0, leadN = 0, meetSum = 0, meetN = 0;
  const dealsCount = myDeals.length;
  myDeals.forEach(d => {
    megisTotal += Number(d.megis) || 0;
    eurTotal   += Number(d.eurot) || 0;
    const lt = dealLeadTimeDays(d);
    if (lt != null) { leadSum += lt; leadN++; }
    const mc = Number(d.meeting_count) || 0;
    if (mc > 0) { meetSum += mc; meetN++; }
  });
  const avgMegis = dealsCount > 0 ? megisTotal / dealsCount : 0;
  const avgEur   = dealsCount > 0 ? eurTotal / dealsCount : 0;
  const avgLeadDays = leadN > 0 ? leadSum / leadN : 0;
  const avgMeetings = meetN > 0 ? meetSum / meetN : 0;
  return { ...player, dealsCount, megisTotal, eurTotal, avgMegis, avgEur, avgLeadDays, avgMeetings };
}

// ── Playout (pelaajat jotka jäivät runkosarjasta) ────────────────────────────
const EMPTY_PLAYOUT = {
  started: false,
  startedAt: null,
  finishedAt: null,
  sakkoKey: null,    // pelaajan key joka saa sakon
};

function startPlayout(nonPlayoffPlayers) {
  if (nonPlayoffPlayers.length === 0) return EMPTY_PLAYOUT;
  return { ...EMPTY_PLAYOUT, started: true, startedAt: Date.now() };
}

function setSakko(playout, playerKey) {
  return {
    ...playout,
    sakkoKey: playerKey,
    finishedAt: Date.now(),
  };
}

function clearSakko(playout) {
  return { ...playout, sakkoKey: null, finishedAt: null };
}

function resetPlayout() {
  return { ...EMPTY_PLAYOUT };
}

// ── Auth (osaprojekti B) ────────────────────────────
// Palauttaa näkymän: 'auth' (ei sessiota), 'link' (sessio ilman pelaajaa), 'app' (valmis)
function resolveAuthGate(session, linkedPlayer) {
  if (!session) return 'auth';
  if (!linkedPlayer) return 'link';
  return 'app';
}
function validateEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v || '').trim()); }
function validateRegForm(f) {
  f = f || {};
  if (!validateEmail(f.email)) return { ok: false, error: 'Virheellinen sähköposti' };
  if (!f.password || f.password.length < 8) return { ok: false, error: 'Salasana väh. 8 merkkiä' };
  if (!f.code || !f.code.trim()) return { ok: false, error: 'Kutsukoodi puuttuu' };
  if (f.mode === 'link') {
    if (!f.playerId) return { ok: false, error: 'Valitse linkitettävä pelaaja' };
    return { ok: true };
  }
  if (!f.nick || f.nick.trim().length < 2) return { ok: false, error: 'Nimi väh. 2 merkkiä' };
  if (!f.city || f.city.trim().length < 2) return { ok: false, error: 'Paikkakunta väh. 2 merkkiä' };
  return { ok: true };
}

Object.assign(window, {
  COMPETITION,
  resolveAuthGate, validateEmail, validateRegForm,
  LS_CURRENT,
  playerKey, emptyStats,
  loadCurrentKey, saveCurrentKey,
  localDateKey,
  currentWeekdayIndex, currentWeekDays, currentDayNumber,
  competitionPhase,
  EMPTY_PLAYOFF, MATCH_ORDER,
  setMatchWinner, clearMatchWinner, startPlayoffs, resetPlayoffs, recomputeAdvancement, migratePlayoff,
  WEEKDAY_DATE_KEYS, weekdayIndexToDateKey, dateKeyToWeekdayIndex, recalcPlayerFromDailyStats, recalcPlayerFromDeals, dealLeadTimeDays,
  EMPTY_PLAYOUT, startPlayout, setSakko, clearSakko, resetPlayout,
});
