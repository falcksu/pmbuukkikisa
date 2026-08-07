const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const players = { 'a:x': { nick: 'AA' }, 'b:y': { nick: 'BB' }, '__admin__': { nick: 'Ad', is_admin: true } };
const daily = [
  { player_id: 'a:x', date_key: '2026-07-10', buukit: 12 },
  { player_id: 'a:x', date_key: '2026-08-05', buukit: 6 },
  { player_id: 'b:y', date_key: '2026-08-06', buukit: 9 },   // paras päivä
  { player_id: '__admin__', date_key: '2026-08-06', buukit: 99 }, // admin ohitetaan
];
const deals = [
  { player_id: 'a:x', megis: 2500, toimiala: 'Teollisuus' },
  { player_id: 'b:y', megis: 4000, toimiala: 'Kauppa' },     // isoin
];

const hof = w.hallOfFame(daily, deals, players);
const r = (id) => hof.records.find(x => x.id === id);
assert(r('most_buukit').nick === 'AA' && r('most_buukit').value === 18, 'eniten buukkeja AA 18 (12+6)');
assert(r('most_buukit').value !== 99, 'admin ei mukana ennätyksissä');
assert(r('best_day').nick === 'AA' && r('best_day').value === 12, 'paras päivä AA 12 (yksittäisen pv max)');
assert(r('biggest_deal').nick === 'BB' && r('biggest_deal').value === 4000, 'isoin kauppa BB 4000');
assert(r('most_megis').nick === 'BB' && r('most_megis').value === 4000, 'eniten Megis BB');
assert(r('most_deals').value === 1, 'eniten kauppoja = 1 (molemmilla 1)');

// kuukausi-MVP:t, uusin ensin
assert(hof.monthlyMvps[0].month === '2026-08' && hof.monthlyMvps[0].nick === 'BB', 'elokuu MVP BB (9 > 6)');
assert(hof.monthlyMvps[1].month === '2026-07' && hof.monthlyMvps[1].nick === 'AA', 'heinäkuu MVP AA');

// tyhjä data
const empty = w.hallOfFame([], [], {});
assert(empty.records.length === 6 && empty.monthlyMvps.length === 0, 'tyhjä: 6 ennätystä (haltija —), 0 MVP');
