// tests/auth-lock.test.js
// supabase-js v2 sarjallistaa token-päivityksen selaimen Web Locks -lukolla
// (navigatorLock). Jos lukko jää toiselle välilehdelle jumiin, TÄMÄN välilehden
// kaikki REST/RPC-kutsut jäävät odottamaan lukkoa eivätkä lähde koskaan → 15 s
// aikakatkaisu, nolla pyyntöä palvelimella, mutta istunto päivittyy normaalisti
// siinä toisessa välilehdessä. Estetään antamalla läpimenevä lukko.
const { load, makeLocalStorage, assert } = require('./_harness');

let capturedOptions = null;
const win = {
  SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
  supabase: {
    createClient(url, key, options) {
      capturedOptions = options;
      return { auth: {}, channel() { const c={on(){return c;},subscribe(){return c;}}; return c; },
               from() { return { select() { return { range: () => Promise.resolve({data:[],error:null}) }; } }; } };
    },
  },
};
load('db.js', { window: win, localStorage: makeLocalStorage() });

assert(capturedOptions !== null, 'createClient sai asetukset');
assert(capturedOptions.auth && typeof capturedOptions.auth.lock === 'function',
  'auth.lock on annettu (ei jätetä oletuslukon varaan)');

// Läpimenevä lukko: suorittaa funktion heti eikä odota mitään
{
  let ajettu = false;
  const tulos = capturedOptions.auth.lock('lukko', 5000, async () => { ajettu = true; return 42; });
  assert(ajettu === true, 'lukko suorittaa funktion heti');
  assert(typeof tulos.then === 'function', 'palauttaa promisen');
}

// Ei saa jäädä odottamaan vaikka acquireTimeout olisi iso
{
  const alku = Date.now();
  let valmis = false;
  capturedOptions.auth.lock('lukko', 999999, async () => { valmis = true; });
  assert(valmis === true, 'ei odota lukkoa vaikka aikakatkaisu olisi valtava');
  assert(Date.now() - alku < 100, 'suoritus oli välitön');
}

// Realtime-asetus säilyy ennallaan
assert(capturedOptions.realtime && capturedOptions.realtime.params, 'realtime-asetukset säilyivät');
