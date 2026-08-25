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

// ── Kalenteripohjainen putki + trendi ────────────────────────────────────────
// HUOM: nämä laskettiin aiemmin kisakalenterista (WEEKDAY_DATE_KEYS, 25.5–18.6.2026).
// Kisan päätyttyä uudet kirjaukset eivät osuneet siihen lainkaan, joten putki ja
// trendipalkit nollautuivat aina kun tilat laskettiin uudelleen — käyttäjälle tämä
// näkyi niin että kirjatut tulokset "katosivat yön aikana".
const isWeekend = (d) => { const g = d.getDay(); return g === 0 || g === 6; };

// N viimeisintä päivää vanhimmasta uusimpaan: tämä päivä on AINA viimeinen slotti,
// ja siitä taaksepäin otetaan vain arkipäiviä (viikonloput eivät syö slotteja).
function recentDayKeys(n, refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  d.setHours(12, 0, 0, 0); // keskipäivä → ei kesäaika-reunatapauksia
  const out = [localDateKey(d)];
  while (out.length < n) {
    d.setDate(d.getDate() - 1);
    if (!isWeekend(d)) out.push(localDateKey(d));
  }
  return out.reverse();
}

// Kaavion otsikot SAMASTA lähteestä kuin data (recentDayKeys). Aiemmin otsikot
// tulivat kisakalenterista (currentWeekDays → COMPETITION.weekdays), joten
// pelaajakortissa luki elokuussakin "MA 1.6 … PE 5.6" vaikka palkkien luvut
// olivat oikeat. Luvut oikein, päivämäärät täysin väärin.
const WD_LYHENTEET = ['SU', 'MA', 'TI', 'KE', 'TO', 'PE', 'LA'];
function recentDayLabels(n, refDate) {
  return recentDayKeys(n, refDate).map(function (key) {
    const osat = key.split('-');
    const d = new Date(Number(osat[0]), Number(osat[1]) - 1, Number(osat[2]), 12, 0, 0);
    return { wd: WD_LYHENTEET[d.getDay()], date: d.getDate() + '.' + (d.getMonth() + 1), key: key };
  });
}

// Käynnissä oleva buukkiputki: peräkkäisiä arkipäiviä joina on vähintään 1 buukki.
// Viikonloppu ei katkaise putkea. Jos tälle päivälle ei ole vielä buukkeja, putki
// lasketaan edellisestä arkipäivästä (muuten putki näyttäisi nollaa joka aamu).
function currentBuukitStreak(buukitByDate, refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  d.setHours(12, 0, 0, 0);
  const stepBack = () => { do { d.setDate(d.getDate() - 1); } while (isWeekend(d)); };
  if (!((buukitByDate[localDateKey(d)] || 0) > 0)) stepBack();
  let streak = 0;
  for (let guard = 0; guard < 500; guard++) {
    if ((buukitByDate[localDateKey(d)] || 0) > 0) streak++; else break;
    stepBack();
  }
  return streak;
}

// Laskee pelaajan yhteistilastot päiväkohtaisista riveistä
function recalcPlayerFromDailyStats(player, myRows, refDate) {
  let luurit = 0, vastatut = 0, buukit = 0, tapaamiset = 0;
  const buukitByDate = {};
  myRows.forEach(r => {
    luurit += (r.luurit||0); vastatut += (r.vastatut||0);
    buukit += (r.buukit||0); tapaamiset += (r.tapaamiset||0);
    buukitByDate[r.date_key] = (buukitByDate[r.date_key] || 0) + (r.buukit || 0);
  });

  const last5 = recentDayKeys(5, refDate).map(k => buukitByDate[k] || 0);
  const streak = currentBuukitStreak(buukitByDate, refDate);
  const trendN = last5[4] - last5[3];

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

// Uniikki kauppa-id. EI kierrätä sekvenssiä (aiempi `seq = sameDay.length+1`
// ylikirjoitti kaupan, jos saman päivän kauppa poistettiin ja lisättiin uusi).
// Muoto: "<pelaaja>_<päivä>_<aikaleima><satunnainen>".
function newDealId(playerKey, dateKey) {
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${playerKey}_${dateKey}_${Date.now().toString(36)}${rnd}`;
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

// ── Hall of Fame (osaprojekti D4) ────────────────────────────
// Laskee all-time-ennätykset + kuukausi-MVP:t jaetusta datasta. Admin pois.
function hallOfFame(dailyStats, deals, playersMap) {
  const isReal = (k) => k !== '__admin__' && !(playersMap && playersMap[k] && playersMap[k].is_admin);
  const nickOf = (k) => (playersMap && playersMap[k] && playersMap[k].nick) || k;
  const per = {};
  const ens = (k) => per[k] || (per[k] = { key: k, buukit: 0, dealsCount: 0, megis: 0 });
  (dailyStats || []).forEach(r => { if (isReal(r.player_id)) ens(r.player_id).buukit += r.buukit || 0; });
  (deals || []).forEach(d => { if (isReal(d.player_id)) { const p = ens(d.player_id); p.dealsCount++; p.megis += Number(d.megis) || 0; } });
  const arr = Object.values(per);
  const topBy = (f) => arr.reduce((best, p) => (!best || p[f] > best[f]) ? p : best, null);

  let bestDay = null;
  (dailyStats || []).forEach(r => {
    if (isReal(r.player_id) && (r.buukit || 0) > 0 && (!bestDay || r.buukit > bestDay.buukit)) bestDay = { key: r.player_id, buukit: r.buukit, date: r.date_key };
  });
  let bigDeal = null;
  (deals || []).forEach(d => {
    if (!isReal(d.player_id)) return;
    const m = Number(d.megis) || 0;
    if (!bigDeal || m > bigDeal.megis) bigDeal = { key: d.player_id, megis: m, toimiala: d.toimiala };
  });
  const byPlayerDaily = {};
  (dailyStats || []).forEach(r => { if (isReal(r.player_id)) (byPlayerDaily[r.player_id] = byPlayerDaily[r.player_id] || []).push(r); });
  let bestStreak = null;
  Object.keys(byPlayerDaily).forEach(k => { const s = longestBuukitStreak(byPlayerDaily[k]); if (!bestStreak || s > bestStreak.streak) bestStreak = { key: k, streak: s }; });

  const rec = (id, label, icon, holderKey, value, sub) =>
    (holderKey && value > 0) ? { id, label, icon, nick: nickOf(holderKey), value, sub } : { id, label, icon, nick: '—', value: 0, sub: '' };
  const mostB = topBy('buukit'), mostD = topBy('dealsCount'), mostM = topBy('megis');
  const records = [
    rec('most_buukit', 'Eniten buukkeja', '🎯', mostB && mostB.buukit > 0 ? mostB.key : null, mostB ? mostB.buukit : 0, 'buukkia'),
    rec('most_deals', 'Eniten kauppoja', '🤝', mostD && mostD.dealsCount > 0 ? mostD.key : null, mostD ? mostD.dealsCount : 0, 'kauppaa'),
    rec('most_megis', 'Eniten Megisejä', '⚡', mostM && mostM.megis > 0 ? mostM.key : null, mostM ? Math.round(mostM.megis) : 0, 'Megis'),
    rec('best_day', 'Paras päivä', '🔥', bestDay ? bestDay.key : null, bestDay ? bestDay.buukit : 0, bestDay ? ('buukkia · ' + bestDay.date) : 'buukkia'),
    rec('longest_streak', 'Pisin putki', '🔄', bestStreak && bestStreak.streak > 0 ? bestStreak.key : null, bestStreak ? bestStreak.streak : 0, 'pv peräkkäin'),
    rec('biggest_deal', 'Isoin kauppa', '🐘', bigDeal && bigDeal.megis > 0 ? bigDeal.key : null, bigDeal ? Math.round(bigDeal.megis) : 0, (bigDeal && bigDeal.toimiala) ? ('Megis · ' + bigDeal.toimiala) : 'Megis'),
  ];

  const byMonth = {};
  (dailyStats || []).forEach(r => {
    if (!isReal(r.player_id) || (r.buukit || 0) <= 0) return;
    const m = r.date_key.slice(0, 7);
    byMonth[m] = byMonth[m] || {};
    byMonth[m][r.player_id] = (byMonth[m][r.player_id] || 0) + r.buukit;
  });
  const monthlyMvps = Object.keys(byMonth).sort().reverse().map(m => {
    const [k, b] = Object.entries(byMonth[m]).sort((a, b) => b[1] - a[1])[0];
    return { month: m, key: k, nick: nickOf(k), buukit: b };
  });

  return { records, monthlyMvps };
}

// ── H2H-haaste (osaprojekti D3) ────────────────────────────
// Viikon kahden pelaajan buukki-duelli. Palauttaa tilanteen tai null.
function h2hStanding(h2h, dailyStats, playersMap, refDate) {
  if (!h2h || !h2h.a || !h2h.b) return null;
  const r = periodRange('thisWeek', refDate);
  const sumWeek = (key) => (dailyStats || [])
    .filter(d => d.player_id === key && d.date_key >= r.startKey && d.date_key <= r.endKey)
    .reduce((s, d) => s + (d.buukit || 0), 0);
  const nickOf = (key) => (playersMap && playersMap[key] && playersMap[key].nick) || key;
  const aB = sumWeek(h2h.a), bB = sumWeek(h2h.b);
  const tie = aB === bB;
  return {
    a: { key: h2h.a, nick: nickOf(h2h.a), buukit: aB },
    b: { key: h2h.b, nick: nickOf(h2h.b), buukit: bB },
    leaderKey: tie ? null : (aB > bB ? h2h.a : h2h.b),
    diff: Math.abs(aB - bB), tie, weekLabel: r.label,
  };
}

// ── Badget & tier (osaprojekti D2) ────────────────────────────
// Tier kaikkien aikojen buukkien mukaan (kalibroitu: ~20 buukkia/kk/pelaaja).
const BADGE_TIERS = [
  { key: 'bronze',   name: 'Bronze',   icon: '🥉', min: 0 },
  { key: 'silver',   name: 'Silver',   icon: '🥈', min: 40 },
  { key: 'gold',     name: 'Gold',     icon: '🥇', min: 120 },
  { key: 'platinum', name: 'Platinum', icon: '💠', min: 240 },
  { key: 'legend',   name: 'Legend',   icon: '💎', min: 480 },
];
function playerTier(totalBuukit) {
  const b = Number(totalBuukit) || 0;
  let idx = 0;
  for (let i = 0; i < BADGE_TIERS.length; i++) { if (b >= BADGE_TIERS[i].min) idx = i; }
  const tier = BADGE_TIERS[idx];
  const next = BADGE_TIERS[idx + 1] || null;
  const progressPct = next ? Math.min(100, Math.round((b - tier.min) / (next.min - tier.min) * 100)) : 100;
  const toNext = next ? Math.max(0, next.min - b) : 0;
  return { tier, next, progressPct, toNext, total: b };
}

function longestBuukitStreak(myDaily) {
  const days = myDaily.filter(r => (r.buukit || 0) > 0).map(r => r.date_key).sort();
  let best = 0, cur = 0, prev = null;
  for (const d of days) {
    if (prev && Math.round((new Date(d + 'T00:00:00') - new Date(prev + 'T00:00:00')) / 86400000) === 1) cur++;
    else cur = 1;
    if (cur > best) best = cur;
    prev = d;
  }
  return best;
}

// Laskee pelaajan badget jaetusta datasta. opts.isMonthChampion = eniten buukkeja kuluvassa kuussa.
function computeBadges(playerKey, dailyStats, deals, opts) {
  opts = opts || {};
  const myDaily = (dailyStats || []).filter(r => r.player_id === playerKey);
  const myDeals = (deals || []).filter(d => d.player_id === playerKey);
  const sum = (arr, f) => arr.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  const totalBuukit = sum(myDaily, 'buukit');
  const totalVastatut = sum(myDaily, 'vastatut');
  const maxDay = myDaily.reduce((m, r) => Math.max(m, r.buukit || 0), 0);
  const streak = longestBuukitStreak(myDaily);
  const dealsCount = myDeals.length;
  const maxDealMegis = myDeals.reduce((m, d) => Math.max(m, Number(d.megis) || 0), 0);
  const totalMegis = sum(myDeals, 'megis');
  const buukkiPct = totalVastatut > 0 ? Math.round(totalBuukit / totalVastatut * 100) : 0;

  const CATS = {
    first_buukki: 'buukit', month_pace: 'buukit', hundred: 'buukit', year_pace: 'buukit',
    tulipallo: 'day', superpaiva: 'day', streak5: 'streak', sharpshooter: 'aim',
    first_deal: 'deal', kauppakone: 'deal', iso_kauppa: 'deal', megis_master: 'deal', month_champ: 'champ',
  };
  const B = (id, icon, name, desc, earned, cur, target) => ({
    id, icon, name, desc, cat: CATS[id] || 'buukit', earned: !!earned,
    progress: (!earned && target) ? { cur: Math.min(cur, target), target } : null,
    pct: target ? Math.min(100, Math.round((Math.min(cur, target) / target) * 100)) : (earned ? 100 : 0),
  });
  return [
    B('first_buukki', '🎯', 'Ensimmäinen buukki', 'Kirjaa 1 buukki', totalBuukit >= 1, totalBuukit, 1),
    B('month_pace', '📊', 'Kuukausivauhti', '20 buukkia (kk-tavoite)', totalBuukit >= 20, totalBuukit, 20),
    B('hundred', '🏅', 'Satanen', '100 buukkia yhteensä', totalBuukit >= 100, totalBuukit, 100),
    B('year_pace', '💎', 'Vuosivauhti', '240 buukkia (vuositavoite)', totalBuukit >= 240, totalBuukit, 240),
    B('tulipallo', '🔥', 'Tulipallo', '5+ buukkia yhtenä päivänä', maxDay >= 5, maxDay, 5),
    B('superpaiva', '🚀', 'Superpäivä', '8+ buukkia yhtenä päivänä', maxDay >= 8, maxDay, 8),
    B('streak5', '🔄', 'Pitkä putki', 'Buukki 5 päivänä peräkkäin', streak >= 5, streak, 5),
    B('sharpshooter', '🎯', 'Tarkka-ampuja', 'Buukki-% ≥ 50 (väh. 10 vastattua)', totalVastatut >= 10 && buukkiPct >= 50, buukkiPct, 50),
    B('first_deal', '🤝', 'Ensimmäinen kauppa', 'Kirjaa 1 kauppa', dealsCount >= 1, dealsCount, 1),
    B('kauppakone', '💼', 'Kauppakone', '10 kauppaa', dealsCount >= 10, dealsCount, 10),
    B('iso_kauppa', '🐘', 'Iso kauppa', 'Yksittäinen kauppa ≥ 2000 Megis', maxDealMegis >= 2000, maxDealMegis, 2000),
    B('megis_master', '⚡', 'Megis-mestari', '10 000 Megis yhteensä', totalMegis >= 10000, totalMegis, 10000),
    B('month_champ', '👑', 'Kuukauden mestari', 'Eniten buukkeja kuluvassa kuussa', !!opts.isMonthChampion, 0, 0),
  ];
}

// ── Live-syöte (tiimin tapahtumat tickeriin) ────────────────────────────
// Rakentaa jaetusta datasta (kaupat + päivän buukit) uusimmat-ensin -syötteen.
function buildTickerFeed(dailyStats, deals, playersMap, limit) {
  limit = limit || 20;
  const nickOf = (pid) => (playersMap && playersMap[pid] && playersMap[pid].nick) || pid;
  const hhmm = (ts) => {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  const ddmm = (dk) => (dk ? dk.slice(8, 10) + '.' + dk.slice(5, 7) + '.' : '');
  const items = [];
  (deals || []).forEach(d => {
    const ts = d.created_at ? new Date(d.created_at).getTime()
      : (d.signed_date ? new Date(d.signed_date + 'T12:00:00').getTime()
      : (d.date_key ? new Date(d.date_key + 'T12:00:00').getTime() : 0));
    items.push({
      id: 'd-' + d.id, ts, kind: 'deal', nick: nickOf(d.player_id), accent: true,
      note: `KAUPPA ${d.megis || 0} Megis${d.toimiala ? ' · ' + d.toimiala : ''}`,
    });
  });
  (dailyStats || []).forEach(r => {
    if ((r.buukit || 0) <= 0) return;
    const ts = r.updated_at ? new Date(r.updated_at).getTime()
      : (r.date_key ? new Date(r.date_key + 'T18:00:00').getTime() : 0);
    items.push({
      id: 'b-' + r.player_id + '-' + r.date_key, ts, kind: 'buukit', nick: nickOf(r.player_id), accent: false,
      note: `${r.buukit} buukkia · ${ddmm(r.date_key)}`,
    });
  });
  items.sort((a, b) => b.ts - a.ts);
  return items.slice(0, limit).map(it => ({ ...it, time: it.ts ? hhmm(it.ts) : '' }));
}

// ── Tiimitavoite (osaprojekti D1) ────────────────────────────
// Kuukausitavoitteen edistyminen. Palauttaa {pct,remaining,daysLeft,neededPerDay,hit,target,current}.
function monthProgress(target, current, refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - d.getDate() + 1; // sisältää tämän päivän
  const t = Number(target) || 0, c = Number(current) || 0;
  const remaining = Math.max(0, t - c);
  const pct = t > 0 ? Math.min(100, Math.round(c / t * 100)) : 0;
  const hit = t > 0 && c >= t;
  const neededPerDay = (t > 0 && !hit) ? (daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining) : 0;
  return { pct, remaining, daysLeft, neededPerDay, hit, target: t, current: c };
}

// ── Aikajaksot (osaprojekti C) ────────────────────────────
// Aikaväli valitulle jaksolle. Palauttaa {startKey,endKey,label} muodossa YYYY-MM-DD.
function periodRange(kind, refDate, customStart, customEnd) {
  const d = refDate ? new Date(refDate) : new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const key = (yy, mm, dd) => `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const lastDay = (yy, mm) => new Date(yy, mm + 1, 0).getDate();
  if (kind === 'today') { const k = localDateKey(d); return { startKey: k, endKey: k, label: 'Tänään' }; }
  if (kind === 'thisWeek') {
    const dow = (d.getDay() + 6) % 7; // ma=0
    const mon = new Date(d); mon.setDate(d.getDate() - dow);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { startKey: localDateKey(mon), endKey: localDateKey(sun), label: 'Tämä viikko' };
  }
  if (kind === 'thisMonth') return { startKey: key(y, m, 1), endKey: key(y, m, lastDay(y, m)), label: 'Tämä kuukausi' };
  if (kind === 'lastMonth') {
    const pm = new Date(y, m - 1, 1); const py = pm.getFullYear(), pmo = pm.getMonth();
    return { startKey: key(py, pmo, 1), endKey: key(py, pmo, lastDay(py, pmo)), label: 'Viime kuukausi' };
  }
  if (kind === 'thisYear') return { startKey: key(y, 0, 1), endKey: key(y, 11, 31), label: 'Tämä vuosi' };
  if (kind === 'custom') return { startKey: customStart, endKey: customEnd, label: 'Oma väli' };
  const k = localDateKey(d); return { startKey: k, endKey: k, label: 'Tänään' };
}

// Jaksorajattu pelaaja-aggregointi. Admin/is_admin suodatetaan pois.
function aggregatePlayersForPeriod(playersMap, dailyStats, deals, startKey, endKey) {
  const inRange = (dk) => dk >= startKey && dk <= endKey;
  // Summataan jaksolle osuvat rivit KERRAN pelaajittain. Aiemmin jokaiselle
  // pelaajalle käytiin koko rivilista läpi → O(pelaajat × rivit), mikä hidastuu
  // jatkuvasti datan kasvaessa (~4000 riviä/vuosi).
  const dayBy = {};
  (dailyStats || []).forEach(r => {
    if (!inRange(r.date_key)) return;
    const a = dayBy[r.player_id] || (dayBy[r.player_id] = { luurit: 0, vastatut: 0, buukit: 0, tapaamiset: 0 });
    a.luurit += r.luurit || 0; a.vastatut += r.vastatut || 0; a.buukit += r.buukit || 0; a.tapaamiset += r.tapaamiset || 0;
  });
  const dealBy = {};
  (deals || []).forEach(dl => {
    if (!inRange(dl.date_key)) return;
    const a = dealBy[dl.player_id] || (dealBy[dl.player_id] = { dealsCount: 0, megisTotal: 0, eurTotal: 0 });
    a.dealsCount++; a.megisTotal += Number(dl.megis) || 0; a.eurTotal += Number(dl.eurot) || 0;
  });
  const out = [];
  Object.values(playersMap || {}).forEach(p => {
    if (!p || p.key === '__admin__' || p.is_admin) return;
    const d = dayBy[p.key] || { luurit: 0, vastatut: 0, buukit: 0, tapaamiset: 0 };
    const luurit = d.luurit, vastatut = d.vastatut, buukit = d.buukit, tapaamiset = d.tapaamiset;
    const k = dealBy[p.key] || { dealsCount: 0, megisTotal: 0, eurTotal: 0 };
    const dealsCount = k.dealsCount, megisTotal = k.megisTotal, eurTotal = k.eurTotal;
    out.push({
      ...p, luurit, vastatut, buukit, tapaamiset, dealsCount, megisTotal, eurTotal,
      avgMegis: dealsCount ? megisTotal / dealsCount : 0,
      avgEur: dealsCount ? eurTotal / dealsCount : 0,
    });
  });
  return out;
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
  periodRange, aggregatePlayersForPeriod, monthProgress, buildTickerFeed,
  BADGE_TIERS, playerTier, computeBadges, longestBuukitStreak, h2hStanding, hallOfFame,
  LS_CURRENT,
  playerKey, emptyStats,
  loadCurrentKey, saveCurrentKey,
  localDateKey,
  currentWeekdayIndex, currentWeekDays, currentDayNumber,
  competitionPhase,
  EMPTY_PLAYOFF, MATCH_ORDER,
  setMatchWinner, clearMatchWinner, startPlayoffs, resetPlayoffs, recomputeAdvancement, migratePlayoff,
  WEEKDAY_DATE_KEYS, weekdayIndexToDateKey, dateKeyToWeekdayIndex, recalcPlayerFromDailyStats, recalcPlayerFromDeals, dealLeadTimeDays, newDealId,
  recentDayKeys, currentBuukitStreak, recentDayLabels,
  EMPTY_PLAYOUT, startPlayout, setSakko, clearSakko, resetPlayout,
});
