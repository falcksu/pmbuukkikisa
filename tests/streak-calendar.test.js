// tests/streak-calendar.test.js
// Regressiotesti: putki (streak), 5 päivän trendipalkit ja trendinuoli laskettiin
// KISAKALENTERISTA (WEEKDAY_DATE_KEYS 25.5–18.6.2026). Kisan jälkeen kirjatut
// tulokset eivät osuneet siihen lainkaan → käyttäjä näki klikkauksen jälkeen
// putken kasvavan, mutta seuraavalla päivityksellä recalc nollasi sen.
// Nyt lasketaan oikeasta kalenterista.
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const rows = (obj) => Object.entries(obj).map(([date_key, buukit]) => ({ date_key, buukit }));

// Viiteajankohta: ti 18.8.2026 (kaukana kisakalenterin ulkopuolella)
const TUE = new Date('2026-08-18T12:00:00');

// recentDayKeys: tänään aina viimeisenä, taaksepäin vain arkipäivät
{
  const keys = w.recentDayKeys(5, TUE);
  assert(keys.length === 5, '5 päivää');
  assert(keys[4] === '2026-08-18', 'tänään on viimeinen slotti, sai ' + keys[4]);
  assert(keys[3] === '2026-08-17', 'edellinen arkipäivä ma 17.8');
  assert(keys[0] === '2026-08-12', 'vanhin = ke 12.8 (viikonloput ohitettu), sai ' + keys[0]);
  // maanantaina katsotaan taaksepäin perjantaihin, ei lauantaihin
  const mon = w.recentDayKeys(5, new Date('2026-08-17T12:00:00'));
  assert(mon[3] === '2026-08-14', 'maanantaista edellinen arkipäivä on pe 14.8, sai ' + mon[3]);
}

// last5 + trendN nykykalenterista
{
  const p = w.recalcPlayerFromDailyStats({}, rows({
    '2026-08-12': 1, '2026-08-13': 2, '2026-08-14': 3, '2026-08-17': 4, '2026-08-18': 6,
  }), TUE);
  assert(JSON.stringify(p.last5) === JSON.stringify([1, 2, 3, 4, 6]), 'last5 = kuluvat 5 arkipäivää, sai ' + JSON.stringify(p.last5));
  assert(p.trendN === 2, 'trendN = tänään 6 − eilen 4 = 2, sai ' + p.trendN);
  assert(p.buukit === 16, 'kokonaissumma säilyy = 16');
}

// Putki: peräkkäiset arkipäivät, viikonloppu ei katkaise
{
  const p = w.recalcPlayerFromDailyStats({}, rows({
    '2026-08-13': 1, '2026-08-14': 2, '2026-08-17': 1, '2026-08-18': 3,
  }), TUE);
  assert(p.streak === 4, 'putki 4 arkipäivää (pe→ma yli viikonlopun), sai ' + p.streak);
}

// Nolla-päivä katkaisee putken
{
  const p = w.recalcPlayerFromDailyStats({}, rows({
    '2026-08-13': 5, '2026-08-14': 0, '2026-08-17': 2, '2026-08-18': 1,
  }), TUE);
  assert(p.streak === 2, 'nollapäivä katkaisee → putki 2, sai ' + p.streak);
}

// Aamulla ennen ensimmäistä buukkia putki EI saa pudota nollaan
{
  const p = w.recalcPlayerFromDailyStats({}, rows({
    '2026-08-13': 1, '2026-08-14': 2, '2026-08-17': 3, // tänään ei vielä mitään
  }), TUE);
  assert(p.streak === 3, 'putki lasketaan edellisestä arkipäivästä kun tänään 0, sai ' + p.streak);
  assert(p.last5[4] === 0, 'tämä päivä näkyy vielä nollana');
}

// Kisan aikaiset rivit eivät enää vuoda nykyisiin trendipalkkeihin
{
  const p = w.recalcPlayerFromDailyStats({}, rows({
    '2026-06-01': 9, '2026-06-02': 9, '2026-06-03': 9, '2026-06-04': 9, '2026-06-05': 9,
  }), TUE);
  assert(JSON.stringify(p.last5) === JSON.stringify([0, 0, 0, 0, 0]), 'vanhat kisapäivät eivät näy last5:ssä, sai ' + JSON.stringify(p.last5));
  assert(p.streak === 0, 'vanha kisaputki ei jää roikkumaan, sai ' + p.streak);
  assert(p.buukit === 45, 'kisan buukit säilyvät kokonaissummassa = 45');
}
