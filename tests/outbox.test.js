// tests/outbox.test.js
// Päiväraportin kirjaus ei saa kadota vaikka verkko pettäisi. Epäonnistunut
// tallennus jää jonoon ja lähtee automaattisesti uudelleen. set_daily_stats on
// absoluuttinen asetus → idempotentti → uudelleenlähetys on turvallinen.
const { load, makeLocalStorage, assert } = require('./_harness');

function loadDB(rpcImpl, ls) {
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: { createClient() { return {
      auth: {}, channel() { const c={on(){return c;},subscribe(){return c;}}; return c; },
      rpc: rpcImpl,
      from() { return { select() { return { range: () => Promise.resolve({data:[],error:null}) }; } }; },
    }; } },
  };
  return load('db.js', { window: win, localStorage: ls }).window.DB;
}
const STATS = { luurit: 10, vastatut: 5, buukit: 2, tapaamiset: 1 };

(async () => {
  // 1) Epäonnistunut tallennus jää jonoon
  {
    const ls = makeLocalStorage();
    const DB = loadDB(() => Promise.resolve({ data: null, error: { message: 'verkko poikki' } }), ls);
    DB.setRequestTimeout(50);
    const res = await DB.setDailyStatsRemote('2026-08-25', STATS);
    assert(res.ok === false, 'epäonnistuminen raportoidaan');
    assert(DB.outboxCount() === 1, 'kirjaus jäi jonoon, jonossa ' + DB.outboxCount());
    assert(res.queued === true, 'vastaus kertoo että kirjaus on jonossa');
  }

  // 2) Jono purkautuu kun yhteys palaa
  {
    const ls = makeLocalStorage();
    let toimii = false;
    const DB = loadDB(() => toimii
      ? Promise.resolve({ data: { id:'x', date_key:'2026-08-25' }, error: null })
      : Promise.resolve({ data: null, error: { message: 'verkko poikki' } }), ls);
    DB.setRequestTimeout(50);
    await DB.setDailyStatsRemote('2026-08-25', STATS);
    assert(DB.outboxCount() === 1, 'jonossa 1 ennen yhteyden palautumista');
    toimii = true;
    const flush = await DB.flushOutbox();
    assert(flush.sent === 1, 'jonosta lähti 1, sai ' + flush.sent);
    assert(DB.outboxCount() === 0, 'jono tyhjeni onnistuneen lähetyksen jälkeen');
  }

  // 3) Saman päivän uusi tallennus KORVAA jonossa olevan (absoluuttinen arvo)
  {
    const ls = makeLocalStorage();
    const DB = loadDB(() => Promise.resolve({ data: null, error: { message: 'poikki' } }), ls);
    DB.setRequestTimeout(50);
    await DB.setDailyStatsRemote('2026-08-25', { luurit:1, vastatut:0, buukit:0, tapaamiset:0 });
    await DB.setDailyStatsRemote('2026-08-25', { luurit:7, vastatut:3, buukit:1, tapaamiset:0 });
    assert(DB.outboxCount() === 1, 'saman päivän kirjaus ei kasaa duplikaatteja, jonossa ' + DB.outboxCount());
    const q = DB.outboxItems();
    assert(q[0].stats.luurit === 7, 'jonossa on UUSIN arvo (7), sai ' + q[0].stats.luurit);
  }

  // 4) Eri päivät säilyvät erikseen
  {
    const ls = makeLocalStorage();
    const DB = loadDB(() => Promise.resolve({ data: null, error: { message: 'poikki' } }), ls);
    DB.setRequestTimeout(50);
    await DB.setDailyStatsRemote('2026-08-24', STATS);
    await DB.setDailyStatsRemote('2026-08-25', STATS);
    assert(DB.outboxCount() === 2, 'kaksi eri päivää jonossa, sai ' + DB.outboxCount());
  }

  // 5) Jono säilyy sivun latauksen yli (localStorage)
  {
    const ls = makeLocalStorage();
    const DB1 = loadDB(() => Promise.resolve({ data: null, error: { message: 'poikki' } }), ls);
    DB1.setRequestTimeout(50);
    await DB1.setDailyStatsRemote('2026-08-25', STATS);
    const DB2 = loadDB(() => Promise.resolve({ data: { id:'x' }, error: null }), ls); // uusi "sivunlataus"
    assert(DB2.outboxCount() === 1, 'jono säilyi latauksen yli');
    const flush = await DB2.flushOutbox();
    assert(flush.sent === 1, 'jono lähti heti kun yhteys toimi');
  }
})();
