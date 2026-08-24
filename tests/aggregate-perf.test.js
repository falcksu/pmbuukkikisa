// tests/aggregate-perf.test.js
// aggregatePlayersForPeriod kävi JOKAISELLE pelaajalle koko daily_stats- ja deals-
// listan läpi → O(pelaajat × rivit). Data kasvaa ~4000 rivillä vuodessa, joten tämä
// hidastuu jatkuvasti. Ryhmitellään kerran. Testi varmistaa että tulos on identtinen.
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const players = {};
const daily = [];
const deals = [];
for (let i = 0; i < 20; i++) players['p' + i] = { key: 'p' + i, nick: 'P' + i, luurit:0, vastatut:0, buukit:0 };
for (let d = 1; d <= 28; d++) {
  const dk = '2026-08-' + String(d).padStart(2, '0');
  for (let i = 0; i < 20; i++) {
    daily.push({ player_id: 'p' + i, date_key: dk, luurit: 10, vastatut: 5, buukit: 2, tapaamiset: 1 });
    if (d % 7 === 0) deals.push({ player_id: 'p' + i, date_key: dk, megis: 100, eurot: 1000 });
  }
}

const rows = w.aggregatePlayersForPeriod(players, daily, deals, '2026-08-01', '2026-08-31');
assert(rows.length === 20, '20 pelaajaa, sai ' + rows.length);
const p0 = rows.find(r => r.key === 'p0');
assert(p0.buukit === 56, 'p0 buukit = 28×2 = 56, sai ' + p0.buukit);
assert(p0.luurit === 280, 'p0 luurit = 28×10 = 280, sai ' + p0.luurit);
assert(p0.tapaamiset === 28, 'p0 tapaamiset = 28, sai ' + p0.tapaamiset);
assert(p0.dealsCount === 4, 'p0 kaupat = 4, sai ' + p0.dealsCount);
assert(p0.megisTotal === 400, 'p0 Megis = 400, sai ' + p0.megisTotal);

// Jaksorajaus toimii yhä
const vain1pv = w.aggregatePlayersForPeriod(players, daily, deals, '2026-08-05', '2026-08-05');
assert(vain1pv.find(r => r.key === 'p0').buukit === 2, 'yhden päivän rajaus = 2 buukkia');

// Admin suodattuu pois
const withAdmin = Object.assign({}, players, { a: { key: 'a', nick: 'A', is_admin: true } });
assert(w.aggregatePlayersForPeriod(withAdmin, daily, deals, '2026-08-01', '2026-08-31').length === 20,
  'admin ei näy jaksotaulukossa');
