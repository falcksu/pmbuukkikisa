// tests/db-timeout.test.js
// Regressiotesti: "Tallennetaan…" jäi ikuisesti päälle, kun tallennuspyyntö
// hyytyi (ei vastausta koskaan) tai heitti poikkeuksen — silloin UI:n
// setSaving(false) ei koskaan ajautunut. upsertDeal ei saa koskaan roikkua
// eikä heittää: sen on aina ratkettava {ok:...}-objektiin.
const { load, makeLocalStorage, assert } = require('./_harness');

function loadDB(upsertImpl) {
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: {
      createClient() {
        return {
          auth: {},
          channel() { const ch = { on() { return ch; }, subscribe() { return ch; } }; return ch; },
          from() {
            return {
              upsert: upsertImpl,
              select() { return { range: () => Promise.resolve({ data: [], error: null }) }; },
            };
          },
        };
      },
    },
  };
  return load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
}

const DEAL = { id: 'a_2026-08-18_x', player_id: 'a', date_key: '2026-08-18', megis: 10, eurot: 100 };

(async () => {
  // 1) Hyytynyt pyyntö (ei ratkea koskaan) → aikakatkaisu, ei ikuista roikkumista
  {
    const DB = loadDB(() => new Promise(() => {})); // ei resolve/reject koskaan
    DB.setRequestTimeout(80);
    const started = Date.now();
    const res = await DB.upsertDeal(DEAL);
    const took = Date.now() - started;
    assert(res && res.ok === false, 'hyytynyt tallennus palauttaa ok:false (ei jää roikkumaan)');
    assert(took < 2000, 'aikakatkaisu laukesi nopeasti, kesti ' + took + ' ms');
    assert(!!(res.error && res.error.message), 'virheviesti käyttäjälle mukana');
  }

  // 2) Verkkovirhe (promise rejektoi) → ei heitä ulos, palauttaa ok:false
  {
    const DB = loadDB(() => Promise.reject(new Error('Failed to fetch')));
    DB.setRequestTimeout(500);
    let threw = false;
    let res = null;
    try { res = await DB.upsertDeal(DEAL); } catch (e) { threw = true; }
    assert(threw === false, 'verkkovirhe ei heitä poikkeusta kutsujalle');
    assert(res && res.ok === false, 'verkkovirhe palauttaa ok:false');
  }

  // 3) Onnistunut tallennus toimii yhä
  {
    const DB = loadDB(() => Promise.resolve({ error: null }));
    DB.setRequestTimeout(500);
    const res = await DB.upsertDeal(DEAL);
    assert(res && res.ok === true, 'onnistunut tallennus palauttaa ok:true');
  }
})();

// 4) upsertDailyStats: sama takuu — ei heitä, ei roiku, kertoo virheestä.
//    Ilman tätä pikavalinnan kirjaus katosi hiljaa (käyttäjä näki luvun kasvavan).
(async () => {
  const { load: load2, makeLocalStorage: mls2, assert: a2 } = require('./_harness');
  function loadDB2(impl) {
    const win = {
      SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
      supabase: { createClient() { return {
        auth: {}, channel() { const c={on(){return c;},subscribe(){return c;}}; return c; },
        from() { return { upsert: impl, select(){ return { range: () => Promise.resolve({data:[],error:null}) }; } }; },
      }; } },
    };
    return load2('db.js', { window: win, localStorage: mls2() }).window.DB;
  }
  const DBh = loadDB2(() => new Promise(() => {}));
  DBh.setRequestTimeout(80);
  const r1 = await DBh.upsertDailyStats('a', '2026-08-20', { luurit:1, vastatut:0, buukit:0, tapaamiset:0 });
  a2(r1 && r1.ok === false, 'hyytynyt päivätallennus → ok:false (ei jää roikkumaan)');

  const DBe = loadDB2(() => Promise.reject(new Error('Failed to fetch')));
  DBe.setRequestTimeout(500);
  let threw2 = false, r2 = null;
  try { r2 = await DBe.upsertDailyStats('a', '2026-08-20', { luurit:1, vastatut:0, buukit:0, tapaamiset:0 }); }
  catch (e) { threw2 = true; }
  a2(threw2 === false, 'verkkovirhe päivätallennuksessa ei heitä kutsujalle');
  a2(r2 && r2.ok === false, 'verkkovirhe päivätallennuksessa → ok:false');
})();
