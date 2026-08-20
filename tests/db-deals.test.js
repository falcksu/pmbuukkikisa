// tests/db-deals.test.js
const { load, makeLocalStorage, assert } = require('./_harness');
const ls = makeLocalStorage();
// db.js on IIFE: ilman window.supabasea se menee localStorage-tilaan
const sandbox = load('db.js', { localStorage: ls });
const DB = sandbox.window.DB;

(async () => {
  assert(DB.backend === 'local', 'backend = local kun ei Supabasea');
  assert(typeof DB.upsertDeal === 'function', 'upsertDeal on olemassa');
  assert(typeof DB.fetchAllDeals === 'function', 'fetchAllDeals on olemassa');
  assert(typeof DB.deleteDeal === 'function', 'deleteDeal on olemassa');

  await DB.upsertDeal({ id:'a_2026-06-22_1', player_id:'a', date_key:'2026-06-22', toimiala:'Teollisuus', megis:12, eurot:1200 });
  let all = await DB.fetchAllDeals();
  assert(all.length === 1 && all[0].megis === 12, 'kauppa tallentui ja luettiin');

  // upsert samalla id:llä korvaa
  await DB.upsertDeal({ id:'a_2026-06-22_1', player_id:'a', date_key:'2026-06-22', toimiala:'Kauppa', megis:5, eurot:500 });
  all = await DB.fetchAllDeals();
  assert(all.length === 1 && all[0].toimiala === 'Kauppa', 'sama id korvaa, ei duplikaattia');

  await DB.deleteDeal('a_2026-06-22_1');
  all = await DB.fetchAllDeals();
  assert(all.length === 0, 'deleteDeal poistaa');

  // tapaamiset kulkee upsertDailyStats:n läpi
  const res = await DB.upsertDailyStats('a', '2026-06-22', { luurit:5, vastatut:3, buukit:1, tapaamiset:2 });
  assert(res.ok === true, 'upsertDailyStats palauttaa ok:true');
  assert(res.row.tapaamiset === 2, 'upsertDailyStats säilyttää tapaamiset');
})();
