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
// lead time -laskenta
{
  assert(w.dealLeadTimeDays({ first_meeting_date:'2026-06-01', signed_date:'2026-06-15' }) === 14, 'lead time = 14 pv');
  assert(w.dealLeadTimeDays({ first_meeting_date:'2026-06-10', signed_date:'2026-06-10' }) === 0, 'sama päivä = 0 pv');
  assert(w.dealLeadTimeDays({ signed_date:'2026-06-15' }) === null, 'puuttuva first meeting → null');
  assert(w.dealLeadTimeDays({ first_meeting_date:'2026-06-20', signed_date:'2026-06-10' }) === null, 'negatiivinen → null');
}
// recalcPlayerFromDeals: avgLeadDays + avgMeetings
{
  const deals = [
    { player_id:'a', megis:10, eurot:1000, first_meeting_date:'2026-06-01', signed_date:'2026-06-11', meeting_count:3 },
    { player_id:'a', megis:30, eurot:3000, first_meeting_date:'2026-06-01', signed_date:'2026-06-21', meeting_count:5 },
    { player_id:'a', megis:5,  eurot:500 }, // ei pvm/tapaamisia → ei mukaan keskiarvoihin
  ];
  const p = w.recalcPlayerFromDeals({}, deals);
  assert(p.dealsCount === 3, 'dealsCount = 3');
  assert(p.avgLeadDays === 15, 'avgLeadDays = (10+20)/2 = 15');
  assert(p.avgMeetings === 4, 'avgMeetings = (3+5)/2 = 4');
}
// newDealId: uniikki id, ei kierrätä sekvenssiä (estää ylikirjoituksen poiston jälkeen)
{
  const a = w.newDealId('räntilä:hämeenlinna', '2026-08-13');
  const b = w.newDealId('räntilä:hämeenlinna', '2026-08-13');
  assert(a !== b, 'kaksi kutsua samalle pelaajalle+päivälle → eri id');
  assert(a.startsWith('räntilä:hämeenlinna_2026-08-13_'), 'id alkaa pelaaja_päivä_');
  assert(w.newDealId('a:b', '2026-01-01').indexOf('_2026-01-01_') > -1, 'sisältää päivämäärän');
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
