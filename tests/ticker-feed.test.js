const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const players = { 'a:x': { nick: 'AA' }, 'b:y': { nick: 'BB' } };
const daily = [
  { player_id: 'a:x', date_key: '2026-08-07', buukit: 3, updated_at: '2026-08-07T10:00:00Z' },
  { player_id: 'b:y', date_key: '2026-08-07', buukit: 0, updated_at: '2026-08-07T09:00:00Z' }, // 0 buukit → skip
  { player_id: 'b:y', date_key: '2026-08-06', buukit: 2, updated_at: '2026-08-06T08:00:00Z' },
];
const deals = [
  { id: 'd1', player_id: 'a:x', megis: 25, toimiala: 'Teollisuus', created_at: '2026-08-07T11:00:00Z' },
];

const feed = w.buildTickerFeed(daily, deals, players, 10);
assert(feed.length === 3, '3 tapahtumaa (2 buukit-riviä + 1 kauppa; 0-buukit skipattu)');
assert(feed[0].kind === 'deal', 'uusin ensin: kauppa (11:00)');
assert(/25 Megis/.test(feed[0].note), 'kauppa-note sisältää Megis');
assert(/Teollisuus/.test(feed[0].note), 'kauppa-note sisältää toimialan');
assert(feed[0].nick === 'AA', 'nick mapattu pelaajasta');
assert(feed[1].kind === 'buukit' && /3 buukkia/.test(feed[1].note), 'toiseksi uusin: AA 3 buukkia (10:00)');
assert(feed[2].nick === 'BB' && /2 buukkia/.test(feed[2].note), 'vanhin: BB 2 buukkia');
assert(typeof feed[0].time === 'string' && feed[0].time.length === 5, 'time HH:MM');

// tyhjä data → tyhjä syöte
assert(w.buildTickerFeed([], [], {}, 10).length === 0, 'tyhjä data → tyhjä');
// limit
assert(w.buildTickerFeed(daily, deals, players, 2).length === 2, 'limit rajaa');
