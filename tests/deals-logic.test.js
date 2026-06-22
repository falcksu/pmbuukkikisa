// tests/deals-logic.test.js
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// recalcPlayerFromDeals
{
  const deals = [
    { player_id:'a', megis: 10, eurot: 1000 },
    { player_id:'a', megis: 30, eurot: 3000 },
  ];
  const p = w.recalcPlayerFromDeals({ nick:'A' }, deals);
  assert(p.dealsCount === 2, 'dealsCount = 2');
  assert(p.megisTotal === 40, 'megisTotal = 40');
  assert(p.eurTotal === 4000, 'eurTotal = 4000');
  assert(p.avgMegis === 20, 'avgMegis = 20');
  assert(p.avgEur === 2000, 'avgEur = 2000');
  assert(p.nick === 'A', 'säilyttää muut kentät');
}
// nolla kauppaa → ei jakoa nollalla
{
  const p = w.recalcPlayerFromDeals({}, []);
  assert(p.dealsCount === 0 && p.avgMegis === 0 && p.avgEur === 0, 'nolla kauppaa → 0');
}
// tapaamiset summautuu daily-riveistä
{
  const rows = [
    { date_key:'2026-06-22', luurit:5, vastatut:3, buukit:1, tapaamiset:2 },
    { date_key:'2026-06-23', luurit:4, vastatut:2, buukit:1, tapaamiset:1 },
  ];
  const p = w.recalcPlayerFromDailyStats({ nick:'A' }, rows);
  assert(p.tapaamiset === 3, 'tapaamiset summautuu = 3');
  assert(p.buukit === 2, 'buukit yhä laskettu = 2');
}
