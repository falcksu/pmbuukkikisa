// tests/session-health.test.js
// Viikkoja auki ollut välilehti voi kantaa vanhentunutta istuntoa ja kuollutta
// realtime-yhteyttä. Ennen jokaista kirjausta varmistetaan että istunto on
// voimassa — ja uusitaan se tarvittaessa — jotta kirjaus ei epäonnistu tai jää
// roikkumaan vanhentuneen tokenin takia.
const { load, makeLocalStorage, assert } = require('./_harness');

function loadDB(opts) {
  opts = opts || {};
  const calls = { getSession: 0, refresh: 0, rpc: 0, connect: 0 };
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: { createClient() { return {
      auth: {
        getSession: () => { calls.getSession++; return opts.getSession ? opts.getSession() :
          Promise.resolve({ data: { session: { expires_at: Math.floor(Date.now()/1000) + 3600 } } }); },
        refreshSession: () => { calls.refresh++; return opts.refresh ? opts.refresh() :
          Promise.resolve({ data: {}, error: null }); },
      },
      realtime: { isConnected: () => !!opts.rtConnected, connect: () => { calls.connect++; } },
      channel() { const c={on(){return c;},subscribe(){return c;}}; return c; },
      rpc: () => { calls.rpc++; return Promise.resolve({ data: { id:'x', date_key:'2026-08-25' }, error: null }); },
      from() { return { select() { return { range: () => Promise.resolve({data:[],error:null}) }; } }; },
    }; } },
  };
  const DB = load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
  return { DB, calls };
}

(async () => {
  // 1) Voimassa oleva istunto → kirjaus menee läpi, turhaa uusintaa ei tehdä
  {
    const { DB, calls } = loadDB();
    const res = await DB.bumpDailyStat('luurit', 1, '2026-08-25');
    assert(res.ok === true, 'kirjaus onnistuu voimassa olevalla istunnolla');
    assert(calls.getSession >= 1, 'istunto tarkistettiin ennen kirjausta');
    assert(calls.refresh === 0, 'voimassa olevaa istuntoa ei uusita turhaan');
    assert(calls.rpc === 1, 'RPC kutsuttiin');
  }

  // 2) Pian vanhentuva istunto → uusitaan AUTOMAATTISESTI ennen kirjausta
  {
    const { DB, calls } = loadDB({
      getSession: () => Promise.resolve({ data: { session: { expires_at: Math.floor(Date.now()/1000) + 30 } } }),
    });
    const res = await DB.bumpDailyStat('luurit', 1, '2026-08-25');
    assert(calls.refresh === 1, 'vanhentumassa oleva istunto uusittiin, refresh=' + calls.refresh);
    assert(res.ok === true, 'kirjaus onnistuu uusimisen jälkeen');
  }

  // 3) Ei istuntoa lainkaan → selkeä ohje, EI hiljaista epäonnistumista
  {
    const { DB, calls } = loadDB({ getSession: () => Promise.resolve({ data: { session: null } }) });
    const res = await DB.bumpDailyStat('luurit', 1, '2026-08-25');
    assert(res.ok === false, 'ilman istuntoa kirjaus ei onnistu');
    assert(/kirjaudu/i.test(res.error.message), 'viesti ohjaa kirjautumaan: ' + res.error.message);
    assert(calls.rpc === 0, 'turhaa RPC-kutsua ei tehdä ilman istuntoa');
  }

  // 4) Istunnon tarkistus hyytyy → ei jää roikkumaan
  {
    const { DB } = loadDB({ getSession: () => new Promise(() => {}) });
    DB.setRequestTimeout(80);
    const alku = Date.now();
    const res = await DB.bumpDailyStat('luurit', 1, '2026-08-25');
    assert(res.ok === false, 'hyytynyt istuntotarkistus → ok:false');
    assert(Date.now() - alku < 2000, 'ei jäänyt roikkumaan');
  }

  // 5) Kuollut realtime-yhteys herätetään kirjauksen yhteydessä
  {
    const { DB, calls } = loadDB({ rtConnected: false });
    await DB.bumpDailyStat('luurit', 1, '2026-08-25');
    assert(calls.connect >= 1, 'katkennut realtime-yhteys yhdistettiin uudelleen');
  }

  // 6) Toimiva realtime-yhteys jätetään rauhaan
  {
    const { DB, calls } = loadDB({ rtConnected: true });
    await DB.bumpDailyStat('luurit', 1, '2026-08-25');
    assert(calls.connect === 0, 'toimivaa yhteyttä ei katkota turhaan');
  }
})();
