// tests/_harness.js — lataa CDN-tyylisen .jsx/.js-tiedoston Node-sandboxiin.
// Tiedostot eivät ole moduuleja; ne kirjoittavat window-objektiin.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store,
  };
}

// Lataa tiedosto sandboxiin ja palauta sandbox (sis. window).
// extra: lisämuuttujia sandboxiin (esim. localStorage).
function load(relFile, extra = {}) {
  const code = fs.readFileSync(path.join(__dirname, '..', relFile), 'utf8');
  const sandbox = Object.assign({
    window: {},
    console,
    Date, Math, JSON, Array, Object, Number, String, Set, Map,
    setTimeout, clearTimeout,
  }, extra);
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

function assert(cond, msg) {
  if (!cond) { console.error('  ✗ ' + msg); process.exitCode = 1; }
  else { console.log('  ✓ ' + msg); }
}

module.exports = { load, makeLocalStorage, assert };
