const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

{
  const mp = w.monthProgress(200, 142, new Date('2026-08-07T12:00:00'));
  assert(mp.pct === 71, '142/200 = 71%');
  assert(mp.remaining === 58, 'remaining 58');
  assert(mp.daysLeft === 25, 'elokuun 7. pv → 25 pv jäljellä (incl. tänään)');
  assert(mp.neededPerDay === 3, 'ceil(58/25)=3');
  assert(mp.hit === false, 'ei täyttynyt');
}
{
  const hit = w.monthProgress(100, 120, new Date('2026-08-15T12:00:00'));
  assert(hit.hit === true, 'täyttynyt kun current>=target');
  assert(hit.pct === 100, 'pct clampattu 100');
  assert(hit.neededPerDay === 0, 'ei tarvetta/pv kun täynnä');
}
{
  const zero = w.monthProgress(0, 50, new Date('2026-08-15T12:00:00'));
  assert(zero.pct === 0 && zero.hit === false, 'nolla-tavoite → 0%, ei hit');
}
