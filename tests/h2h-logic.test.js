const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const players = { 'a:x': { nick: 'AA' }, 'b:y': { nick: 'BB' } };
const daily = [
  { player_id: 'a:x', date_key: '2026-08-05', buukit: 14 }, // tässä viikossa
  { player_id: 'b:y', date_key: '2026-08-06', buukit: 11 }, // tässä viikossa
  { player_id: 'a:x', date_key: '2026-07-01', buukit: 99 }, // viikon ulkopuolella
];

const s = w.h2hStanding({ a: 'a:x', b: 'b:y' }, daily, players, new Date('2026-08-06T12:00:00'));
assert(s.a.buukit === 14 && s.b.buukit === 11, 'vain kuluvan viikon buukit');
assert(s.a.nick === 'AA' && s.b.nick === 'BB', 'nickit mapattu');
assert(s.leaderKey === 'a:x' && s.diff === 3, 'AA johtaa +3');
assert(s.tie === false, 'ei tasapeli');

const tie = w.h2hStanding({ a: 'a:x', b: 'b:y' }, [
  { player_id: 'a:x', date_key: '2026-08-05', buukit: 5 },
  { player_id: 'b:y', date_key: '2026-08-05', buukit: 5 },
], players, new Date('2026-08-06T12:00:00'));
assert(tie.tie === true && tie.leaderKey === null && tie.diff === 0, 'tasapeli 5–5');

assert(w.h2hStanding(null, daily, players) === null, 'ei duellia → null');
assert(w.h2hStanding({ a: 'a:x' }, daily, players) === null, 'vain toinen pelaaja → null');
