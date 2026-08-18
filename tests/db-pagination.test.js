// tests/db-pagination.test.js
// Regressiotesti: PostgREST palauttaa oletuksena max 1000 riviä. Ilman sivutusta
// daily_stats-haku katkesi hiljaisesti → totaalit laskettiin vajaista riveistä
// ja osalta pelaajista katosi historiaa.
const { load, makeLocalStorage, assert } = require('./_harness');

// Rakentaa valeasiakkaan joka jäljittelee PostgRESTin range-sivutusta.
function fakeSupabase(rowsByTable, opts = {}) {
  const failTable = opts.failTable || null;
  return {
    createClient() {
      return {
        auth: {},
        channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
        from(table) {
          return {
            select() {
              return {
                range(a, b) {
                  if (table === failTable) {
                    return Promise.resolve({ data: null, error: { message: 'boom' } });
                  }
                  const rows = rowsByTable[table] || [];
                  return Promise.resolve({ data: rows.slice(a, b + 1), error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

function makeRows(n, table) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: table + '_' + i, player_id: 'p' + (i % 17), date_key: '2026-01-01', buukit: 1 });
  }
  return out;
}

function loadDB(rowsByTable, opts) {
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: fakeSupabase(rowsByTable, opts),
  };
  return load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
}

(async () => {
  // 1) Yli 1000 riviä: kaikki rivit on haettava, ei katkaisua
  {
    const DB = loadDB({ daily_stats: makeRows(2500, 'ds'), deals: makeRows(1200, 'd'), players: [] });
    assert(DB.backend === 'supabase', 'backend = supabase valeasiakkaalla');

    const daily = await DB.fetchAllDailyStats();
    assert(daily.length === 2500, 'daily_stats: kaikki 2500 riviä haettu (ei katkaisua 1000:een), sai ' + daily.length);

    const deals = await DB.fetchAllDeals();
    assert(deals.length === 1200, 'deals: kaikki 1200 riviä haettu, sai ' + deals.length);
  }

  // 2) Tasan 1000 riviä: ei saa jäädä ikuiseen sivutussilmukkaan eikä duplikoida
  {
    const DB = loadDB({ daily_stats: makeRows(1000, 'ds') });
    const daily = await DB.fetchAllDailyStats();
    assert(daily.length === 1000, 'tasan 1000 riviä haettu ilman duplikaatteja, sai ' + daily.length);
  }

  // 3) Virhe haussa: EI saa palauttaa vajaita rivejä (vajaat summat ylikirjoittaisivat
  //    oikeat totaalit). Turvallinen degradaatio = tyhjä + terveyslippu alas.
  {
    const DB = loadDB({ daily_stats: makeRows(2500, 'ds') }, { failTable: 'daily_stats' });
    const daily = await DB.fetchAllDailyStats();
    assert(daily.length === 0, 'virhetilanteessa palautetaan tyhjä, ei vajaita rivejä');
    assert(DB.fetchHealth.daily === false, 'fetchHealth.daily = false virheen jälkeen');
  }

  // 4) Onnistuneen haun jälkeen terveyslippu on kunnossa
  {
    const DB = loadDB({ daily_stats: makeRows(5, 'ds') });
    await DB.fetchAllDailyStats();
    assert(DB.fetchHealth.daily === true, 'fetchHealth.daily = true onnistuneen haun jälkeen');
  }
})();
