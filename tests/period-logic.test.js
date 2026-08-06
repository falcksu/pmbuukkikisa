const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// periodRange
{
  const m = w.periodRange('thisMonth', new Date('2026-06-15T12:00:00'));
  assert(m.startKey==='2026-06-01' && m.endKey==='2026-06-30', 'thisMonth 06 rajat');
  const lm = w.periodRange('lastMonth', new Date('2026-01-10T12:00:00'));
  assert(lm.startKey==='2025-12-01' && lm.endKey==='2025-12-31', 'lastMonth ylittää vuodenvaihteen');
  const y = w.periodRange('thisYear', new Date('2026-03-03T12:00:00'));
  assert(y.startKey==='2026-01-01' && y.endKey==='2026-12-31', 'thisYear rajat');
  const t = w.periodRange('today', new Date('2026-06-23T09:00:00'));
  assert(t.startKey==='2026-06-23' && t.endKey==='2026-06-23', 'today');
  const wk = w.periodRange('thisWeek', new Date('2026-06-24T12:00:00')); // ke
  assert(wk.startKey==='2026-06-22' && wk.endKey==='2026-06-28', 'thisWeek ma–su');
  const c = w.periodRange('custom', null, '2026-05-01', '2026-05-15');
  assert(c.startKey==='2026-05-01' && c.endKey==='2026-05-15', 'custom väli');
}
// aggregatePlayersForPeriod
{
  const players = { 'a:x':{key:'a:x',nick:'A',city:'X'}, 'b:y':{key:'b:y',nick:'B',city:'Y'}, '__admin__':{key:'__admin__',nick:'Ad',city:'T',is_admin:true} };
  const daily = [
    { player_id:'a:x', date_key:'2026-06-05', luurit:10, vastatut:6, buukit:3, tapaamiset:1 },
    { player_id:'a:x', date_key:'2026-07-05', luurit:5,  vastatut:2, buukit:9, tapaamiset:0 }, // eri kk
    { player_id:'b:y', date_key:'2026-06-20', luurit:4,  vastatut:3, buukit:2, tapaamiset:2 },
  ];
  const deals = [
    { player_id:'a:x', date_key:'2026-06-10', megis:12, eurot:1200 },
    { player_id:'b:y', date_key:'2026-06-11', megis:30, eurot:3000 },
    { player_id:'a:x', date_key:'2026-07-01', megis:99, eurot:9900 }, // eri kk
  ];
  const rows = w.aggregatePlayersForPeriod(players, daily, deals, '2026-06-01', '2026-06-30');
  assert(rows.length===2, 'admin suodattuu pois → 2 pelaajaa');
  const A = rows.find(r=>r.key==='a:x');
  assert(A.buukit===3 && A.megisTotal===12, 'A vain kesäkuun luvut (ei heinäkuu)');
  const B = rows.find(r=>r.key==='b:y');
  assert(B.buukit===2 && B.megisTotal===30, 'B kesäkuu');
}
