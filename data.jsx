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
  totalDays: 10,
  currentDay: 1,
  playoffStartDate: new Date('2026-06-08T00:00:00'),
  playoffEndDate:   new Date('2026-06-15T23:59:59'),
  playoffStart: '8.6',
  playoffEnd:   '15.6',
  playoffRounds: {
    QF: { label: 'PUOLIVÄLIERÄT', range: '8.6 – 11.6' },
    SF: { label: 'VÄLIERÄT',      range: '12.6 – 13.6' },
    F:  { label: 'FINAALI',       range: '14.6 – 15.6' },
  },
  finalDate:    '15.6.2026',
  finalDateLong: 'Maanantai 15.6.2026',
};

// ── Phase ────────────────────────────────────
//   pre       — ennen kauden alkua (< 25.5)
//   regular   — runkosarja käynnissä
//   lock      — runkosarja päättynyt, playoff ei vielä alkanut (vk-loppu 6.6–7.6)
//   playoffs  — playoff käynnissä (8.6–15.6)
//   finished  — kisa ohi (> 15.6)
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
  },
};

const MATCH_ORDER = ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'];

function recomputeAdvancement(playoff) {
  // Etenee voittajat seuraavaan kierrokseen
  const m = { ...playoff.matches };
  const ensure = (id, homeKey, awayKey) => {
    const cur = m[id];
    if (cur.homeKey !== homeKey || cur.awayKey !== awayKey) {
      // jos joku slotti tyhjeni (peruutus), nollaa voittaja
      m[id] = { ...cur, homeKey, awayKey, winnerKey: null };
    }
  };
  ensure('SF1', m.QF1.winnerKey, m.QF2.winnerKey);
  ensure('SF2', m.QF3.winnerKey, m.QF4.winnerKey);
  ensure('F',   m.SF1.winnerKey, m.SF2.winnerKey);

  // Mestari
  const championKey = m.F.winnerKey;
  const finishedAt = championKey && !playoff.finishedAt ? Date.now() : (championKey ? playoff.finishedAt : null);

  return { ...playoff, matches: m, championKey, finishedAt };
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

// Palauttaa nykyisen arkipäivän indeksin 0..9 tai -1 jos ennen kautta, totalDays+1 jos jälkeen
function currentWeekdayIndex() {
  const now = new Date();
  if (now < COMPETITION.startDate) return -1;
  if (now > COMPETITION.endDate) return COMPETITION.totalDays;
  const today = now.toDateString();
  for (let i = 0; i < COMPETITION.weekdays.length; i++) {
    const wd = COMPETITION.weekdays[i];
    const [d, m] = wd.date.split('.');
    const dt = new Date(2026, parseInt(m, 10) - 1, parseInt(d, 10));
    if (dt.toDateString() === today) return i;
  }
  // Päivä on viikonloppu tai muu — palauta seuraavan / edellisen arkipäivän indeksi
  for (let i = 0; i < COMPETITION.weekdays.length; i++) {
    const wd = COMPETITION.weekdays[i];
    const [d, m] = wd.date.split('.');
    const dt = new Date(2026, parseInt(m, 10) - 1, parseInt(d, 10));
    if (dt > now) return Math.max(0, i - 1); // edellinen arkipäivä
  }
  return COMPETITION.totalDays - 1;
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
  '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29',
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
];
function weekdayIndexToDateKey(idx) { return WEEKDAY_DATE_KEYS[idx] ?? null; }
function dateKeyToWeekdayIndex(key) { return WEEKDAY_DATE_KEYS.indexOf(key); }

// Laskee pelaajan yhteistilastot päiväkohtaisista riveistä
function recalcPlayerFromDailyStats(player, myRows) {
  let luurit = 0, vastatut = 0, buukit = 0;
  myRows.forEach(r => { luurit += (r.luurit||0); vastatut += (r.vastatut||0); buukit += (r.buukit||0); });

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

  return { ...player, luurit, vastatut, buukit, last5, streak, trendN };
}

Object.assign(window, {
  COMPETITION,
  LS_CURRENT,
  playerKey, emptyStats,
  loadCurrentKey, saveCurrentKey,
  currentWeekdayIndex, currentWeekDays, currentDayNumber,
  competitionPhase,
  EMPTY_PLAYOFF, MATCH_ORDER,
  setMatchWinner, clearMatchWinner, startPlayoffs, resetPlayoffs, recomputeAdvancement,
  WEEKDAY_DATE_KEYS, weekdayIndexToDateKey, dateKeyToWeekdayIndex, recalcPlayerFromDailyStats,
});
