// tests/offline-guard.test.js
// Regressiotesti: jos sovellus on konfiguroitu Supabaseen mutta asiakasta ei saada
// luotua (esim. SDK:n CDN estetty/ei latautunut), db.js putosi HILJAA localStorageen.
// Käyttäjä näki kirjaukset tallentuvan ja ne säilyivät latauksesta toiseen, mutta
// mikään ei päätynyt kantaan. Tämä tila on nyt tunnistettava.
const { load, makeLocalStorage, assert } = require('./_harness');

function loadDB(win) {
  return load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
}
const CFG = { url: 'https://example.supabase.co', anonKey: 'anon-key' };
const fakeSdk = {
  createClient() {
    return { auth: {}, channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
             from() { return { select() { return { range: () => Promise.resolve({ data: [], error: null }) }; } }; } };
  },
};

// 1) Konfiguroitu + SDK puuttuu (CDN estetty) → offlineMisconfig
{
  const DB = loadDB({ SUPABASE_CONFIG: CFG /* window.supabase puuttuu */ });
  assert(DB.isConfigured === true, 'config tunnistetaan');
  assert(DB.backend === 'local', 'ilman SDK:ta backend = local');
  assert(DB.offlineMisconfig === true, 'konfiguroitu mutta yhteydetön → offlineMisconfig=true');
}

// 2) Konfiguroitu + createClient heittää → offlineMisconfig
{
  const DB = loadDB({ SUPABASE_CONFIG: CFG, supabase: { createClient() { throw new Error('boom'); } } });
  assert(DB.offlineMisconfig === true, 'createClient-virhe → offlineMisconfig=true');
}

// 3) Konfiguroitu + SDK toimii → normaali tila
{
  const DB = loadDB({ SUPABASE_CONFIG: CFG, supabase: fakeSdk });
  assert(DB.backend === 'supabase', 'toimiva SDK → backend=supabase');
  assert(DB.offlineMisconfig === false, 'toimiva yhteys → offlineMisconfig=false');
}

// 4) EI konfiguroitu (dev-local) → local-tila on laillinen, ei varoitusta
{
  const DB = loadDB({ SUPABASE_CONFIG: { url: 'PASTE', anonKey: 'PASTE' } });
  assert(DB.isConfigured === false, 'PASTE-placeholder ei ole konfiguraatio');
  assert(DB.backend === 'local', 'dev-local backend = local');
  assert(DB.offlineMisconfig === false, 'dev-local ei ole virhetila');
}
