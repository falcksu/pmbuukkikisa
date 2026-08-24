// tests/atomic-bump.test.js
// Regressiotesti KRIITTISELLE tietohäviölle: pikavalinta laski uuden absoluuttisen
// arvon clientin PAIKALLISESTA kopiosta (existing+1) ja kirjoitti sen kantaan.
// Jos paikallinen kopio oli vanhentunut (toinen välilehti/laite, katkennut
// realtime-yhteys), kirjoitus ylikirjoitti palvelimen tuoreemman luvun vanhalla
// → kirjauksia katosi. Nyt palvelin kasvattaa lukua atomisesti (RPC) ja palauttaa
// auktoritatiivisen rivin; client ei enää lähetä absoluuttisia lukuja.
const { load, makeLocalStorage, assert } = require('./_harness');

function loadDB(rpcImpl) {
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: { createClient() { return {
      auth: {},
      channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
      rpc: rpcImpl,
      from() { return { select() { return { range: () => Promise.resolve({ data: [], error: null }) }; } }; },
    }; } },
  };
  return load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
}

(async () => {
  assert(typeof loadDB(() => {}).bumpDailyStat === 'function', 'DB.bumpDailyStat on olemassa');

  // 1) Onnistunut kasvatus palauttaa PALVELIMEN rivin (ei clientin laskemaa)
  {
    let got = null;
    const DB = loadDB((fn, args) => { got = { fn, args };
      return Promise.resolve({ data: { id:'a_2026-08-20', player_id:'a', date_key:'2026-08-20',
                                       luurit: 9, vastatut: 4, buukit: 2, tapaamiset: 0 }, error: null }); });
    const res = await DB.bumpDailyStat('luurit', 1, '2026-08-20');
    assert(res.ok === true, 'kasvatus onnistuu');
    assert(got.fn === 'bump_daily_stat', 'kutsuu bump_daily_stat-RPC:tä, sai ' + got.fn);
    assert(got.args.p_field === 'luurit' && got.args.p_delta === 1, 'välittää kentän ja muutoksen (delta), ei absoluuttista arvoa');
    assert(res.row.luurit === 9, 'palauttaa PALVELIMEN arvon 9 (ei clientin arvausta), sai ' + res.row.luurit);
  }

  // 2) Vanhentunut paikallinen kopio ei voi enää ylikirjoittaa: lähetetään vain delta
  {
    let sent = null;
    const DB = loadDB((fn, args) => { sent = args;
      return Promise.resolve({ data: { id:'a_2026-08-20', luurit: 41 }, error: null }); });
    await DB.bumpDailyStat('luurit', 1, '2026-08-20');
    const keys = Object.keys(sent);
    assert(!keys.some(k => /luurit$|vastatut$|buukit$|tapaamiset$/.test(k) && typeof sent[k] === 'number' && k !== 'p_delta'),
      'ei lähetä absoluuttisia kenttäarvoja — vain p_field + p_delta');
  }

  // 3) Virhe → ok:false, ei heitä
  {
    const DB = loadDB(() => Promise.resolve({ data: null, error: { message: 'permission denied' } }));
    let threw = false, res = null;
    try { res = await DB.bumpDailyStat('buukit', 1, '2026-08-20'); } catch (e) { threw = true; }
    assert(threw === false, 'RPC-virhe ei heitä kutsujalle');
    assert(res && res.ok === false, 'RPC-virhe → ok:false');
    assert(/permission denied/.test(res.error.message), 'virheviesti välittyy käyttäjälle');
  }

  // 4) Hyytynyt RPC → aikakatkaisu, ei ikuista roikkumista
  {
    const DB = loadDB(() => new Promise(() => {}));
    DB.setRequestTimeout(80);
    const res = await DB.bumpDailyStat('buukit', 1, '2026-08-20');
    assert(res && res.ok === false, 'hyytynyt RPC → ok:false');
  }
})();
