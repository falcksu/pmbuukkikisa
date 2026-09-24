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

  // ── Jonon eheys (audit 2026-09) ─────────────────────────
  // 6) Onnistunut tallennus poistaa saman päivän VANHAN jonokirjauksen
  //    (muuten jono lähettäisi myöhemmin vanhat luvut tuoreiden päälle)
  {
    const ls = makeLocalStorage();
    let toimii = false;
    const sent = [];
    const DB = loadDB((name, args) => {
      if (toimii) { sent.push(args); return Promise.resolve({ data: { id:'x' }, error: null }); }
      return Promise.resolve({ data: null, error: { message: 'poikki' } });
    }, ls);
    DB.setRequestTimeout(50);
    await DB.setDailyStatsRemote('2026-09-24', { luurit:3, vastatut:0, buukit:0, tapaamiset:0 });
    assert(DB.outboxCount() === 1, 'vanha kirjaus jonossa');
    toimii = true;
    const res = await DB.setDailyStatsRemote('2026-09-24', { luurit:9, vastatut:2, buukit:1, tapaamiset:0 });
    assert(res.ok === true, 'uusi tallennus onnistui');
    assert(DB.outboxCount() === 0, 'vanha jonokirjaus poistettiin, jonossa ' + DB.outboxCount());
    await DB.flushOutbox();
    assert(sent.length === 1 && sent[0].p_luurit === 9, 'vanhoja lukuja ei lähetetty tuoreiden päälle');
  }

  // 7) Päällekkäiset purut (visibilitychange + focus) → yksi lähetys per kirjaus
  {
    const ls = makeLocalStorage();
    let toimii = false; let calls = 0;
    const DB = loadDB(() => {
      if (toimii) { calls++; return new Promise((r) => setTimeout(() => r({ data: { id:'x' }, error: null }), 20)); }
      return Promise.resolve({ data: null, error: { message: 'poikki' } });
    }, ls);
    DB.setRequestTimeout(200);
    await DB.setDailyStatsRemote('2026-09-23', STATS);
    toimii = true;
    await Promise.all([DB.flushOutbox(), DB.flushOutbox(), DB.flushOutbox()]);
    assert(calls === 1, 'rinnakkaiset purut lähettivät kirjauksen kerran, lähetyksiä ' + calls);
    assert(DB.outboxCount() === 0, 'jono tyhjä');
  }

  // 8) Purun aikana jonoon tullut uusi kirjaus EI katoa
  {
    const ls = makeLocalStorage();
    let mode = 'fail';
    let release = null;
    const DB = loadDB(() => {
      if (mode === 'slow') return new Promise((r) => { release = () => r({ data: { id:'x' }, error: null }); });
      return Promise.resolve({ data: null, error: { message: 'poikki' } });
    }, ls);
    DB.setRequestTimeout(2000);
    await DB.setDailyStatsRemote('2026-09-22', STATS);
    mode = 'slow';
    const f = DB.flushOutbox();
    await new Promise((r) => setTimeout(r, 10));
    mode = 'fail'; // toinen päivä epäonnistuu kesken purun → jonoon
    await DB.setDailyStatsRemote('2026-09-24', STATS);
    release();
    await f;
    const q = DB.outboxItems().map((x) => x.dateKey);
    assert(q.length === 1 && q[0] === '2026-09-24', 'purun aikana jonoon tullut kirjaus säilyi: ' + JSON.stringify(q));
  }
})();
