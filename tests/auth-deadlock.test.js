// tests/auth-deadlock.test.js
// JUURISYY "kirjaus jumittaa / ei tallennu": supabase-js (auth-js 2.65) kutsuu
// onAuthStateChange-kuuntelijaa auth-lukon SISÄLLÄ ja ODOTTAA sen palauttamaa
// promisea. Jos kuuntelija odottaa Supabase-kyselyä, kysely tarvitsee saman lukon
// (getSession → _acquireLock) → jää jonoon lukon taakse → pysyvä lukkiutuminen.
// Tämä testi mallintaa auth-js:n lukon + jonon ja varmistaa, että DB.onAuthChange
// ei koskaan aja kutsujan työtä lukon sisällä.
const { load, makeLocalStorage, assert } = require('./_harness');

function makeAuthModel() {
  // Minimaalinen malli auth-js:n _acquireLock-logiikasta (lockAcquired + pendingInLock):
  // lukon ollessa varattuna uudet pyynnöt odottavat, kunnes haltija on valmis.
  let lockAcquired = false;
  let pending = [];
  async function acquireLock(fn) {
    if (lockAcquired) {
      return new Promise((resolve, reject) => pending.push(() => fn().then(resolve, reject)));
    }
    lockAcquired = true;
    try { return await fn(); }
    finally {
      lockAcquired = false;
      const queued = pending; pending = [];
      queued.forEach((next) => next());
    }
  }
  const handlers = [];
  const auth = {
    onAuthStateChange(h) { handlers.push(h); return { data: { subscription: { unsubscribe() {} } } }; },
    getSession() {
      return acquireLock(async () => ({ data: { session: { user: { id: 'u1' }, expires_at: Math.floor(Date.now() / 1000) + 3600 } } }));
    },
    // Tokenin uusinta: tapahtuma lähetetään lukon sisällä ja kuuntelijat ODOTETAAN
    refreshSession() {
      return acquireLock(async () => {
        await Promise.all(handlers.map((h) => h('TOKEN_REFRESHED', { user: { id: 'u1' } })));
        return { data: {}, error: null };
      });
    },
  };
  return { auth };
}

function race(p, ms) {
  return Promise.race([
    Promise.resolve(p).then(() => 'RESOLVED', () => 'REJECTED'),
    new Promise((r) => setTimeout(() => r('HUNG'), ms)),
  ]);
}

(async () => {
  const model = makeAuthModel();
  let registered = null;
  const origOn = model.auth.onAuthStateChange;
  model.auth.onAuthStateChange = (h) => { registered = h; return origOn(h); };
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: { createClient() { return {
      auth: model.auth,
      channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
      // Jokainen kysely hakee tokenin getSession():lla → tarvitsee lukon (kuten fetchWithAuth)
      from() {
        const q = {
          select() { return q; }, eq() { return q; },
          maybeSingle() { return model.auth.getSession().then(() => ({ data: null, error: null })); },
          range() { return model.auth.getSession().then(() => ({ data: [], error: null })); },
        };
        return q;
      },
      rpc() { return model.auth.getSession().then(() => ({ data: { id: 'x' }, error: null })); },
    }; } },
  };
  const DB = load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
  DB.setRequestTimeout(1500);

  // 1) Kuuntelija palaa synkronisesti (ei promisea, jota auth-js jäisi odottamaan)
  {
    let called = 0;
    DB.onAuthChange(() => { called++; });
    const ret = registered('SIGNED_IN', { user: { id: 'u1' } });
    assert(ret === undefined, 'kuuntelija ei palauta promisea auth-js:lle');
    assert(called === 0, 'kutsujan työtä EI ajeta auth-lukon sisällä (synkronisesti)');
    await new Promise((r) => setTimeout(r, 5));
    assert(called === 1, 'kutsujan työ ajetaan seuraavalla kierroksella');
  }

  // 2) Sovelluksen oikea kuvio: kuuntelija ODOTTAA profiilin hakua. Tokenin uusinta
  //    ei saa lukita välilehteä — sen jälkeen haut ja kirjaukset kulkevat.
  {
    let profileFetched = false;
    DB.onAuthChange(async (s) => { if (s) { await DB.fetchMyPlayer(s.user.id); profileFetched = true; } });
    const refresh = await race(model.auth.refreshSession(), 1000);
    assert(refresh === 'RESOLVED', 'tokenin uusinta valmistui, tila=' + refresh);
    await new Promise((r) => setTimeout(r, 20));
    assert(profileFetched === true, 'profiili haettiin uusinnan jälkeen');
    const bump = await race(DB.bumpDailyStat('luurit', 1, '2026-09-24'), 1000);
    assert(bump === 'RESOLVED', 'kirjaus menee läpi uusinnan jälkeen, tila=' + bump);
    const q = await race(DB.fetchMyPlayer('u1'), 1000);
    assert(q === 'RESOLVED', 'kyselyt kulkevat uusinnan jälkeen, tila=' + q);
  }

  // 3) Kuuntelijan virhe ei kaada mitään
  {
    DB.onAuthChange(async () => { throw new Error('testivirhe (odotettu)'); });
    const refresh = await race(model.auth.refreshSession(), 1000);
    assert(refresh === 'RESOLVED', 'virheellinen kuuntelija ei estä uusintaa');
  }

  // 4) Kontrolli: testimalli todella lukkiutuu vanhalla kuviolla (kuuntelija
  //    ajettuna suoraan lukon sisällä) — varmistaa ettei testi ole tyhjä.
  {
    const m2 = makeAuthModel();
    m2.auth.onAuthStateChange(async () => { await m2.auth.getSession(); });
    const r = await race(m2.auth.refreshSession(), 300);
    assert(r === 'HUNG', 'vanha kuvio lukkiutuu mallissa (kontrolli), tila=' + r);
  }
})();
