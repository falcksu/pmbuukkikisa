# Datamallin laajennus (kaupat + KPI:t) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lisää myynnin dashboardiin tapaamiset-KPI ja kauppojen kirjaus (toimiala/Megis/eurot), ja näytä keskikauppa pelaajakortissa — säilyttäen vanhan kisadatan ja buukki-pohjaisen järjestyksen.

**Architecture:** Noudatetaan olemassa olevaa mallia: `daily_stats` + uusi `deals`-taulu ovat totuuden lähde, ja pelaaja-aggregaatit lasketaan niistä client-puolella (`recalcPlayerFromDailyStats` + uusi `recalcPlayerFromDeals`). `db.js` saa deals-CRUD:n ja realtime-tilauksen `daily_stats`-mallia mukaillen. UI: tapaaminen on +1-pikavalinta, kauppa on pieni lomake oma raportti -näkymässä.

**Tech Stack:** React 18 UMD/CDN + Babel standalone (ei build-vaihetta), Supabase (PostgreSQL + RLS + Realtime) localStorage-fallbackilla, Vercel-hosting. Testaus: ei testikehystä → puhdas logiikka todennetaan riippuvuudettomalla Node-skriptillä (`node tests/x.js`), UI manuaalisella selaintestillä.

**Spec:** `docs/superpowers/specs/2026-06-22-buukkikisa-data-model-deals-kpis-design.md`

---

## Verifiointistrategia (lue ensin)

Projektissa **ei ole** `package.json`:ia, testikehystä eikä build-vaihetta. Siksi:

- **Puhdas logiikka** (`data.jsx`, `db.js`:n localStorage-polku) testataan pienellä Node-skriptillä, joka lataa tiedoston `vm`-sandboxissa `window`-shimin kanssa ja ajaa `assert`-tarkistuksia. Ei npm-riippuvuuksia.
- **UI ja realtime** (`app.jsx`) todennetaan manuaalisesti selaimessa (paikallinen localStorage-tila riittää; Supabase ei pakollinen paikallistestiin).
- **Commit jokaisen tehtävän jälkeen.**

Yhteinen testiapuri luodaan Task 0:ssa.

---

## Tiedostorakenne (mitä muuttuu)

| Tiedosto | Vastuu | Muutos |
|---|---|---|
| `data.jsx` | Puhdas domain-logiikka, aggregaatit | Laajenna `recalcPlayerFromDailyStats` (tapaamiset); lisää `recalcPlayerFromDeals`; vie uudet funktiot |
| `db.js` | Persistenssi (Supabase/LS) | Lisää deals-CRUD + `subscribeDeals` + init; `upsertDailyStats` kuljettaa `tapaamiset` |
| `app.jsx` | UI + tila | deals-tila, init/subscribe, `applyDerivedToPlayers`, käsittelijät, entry-UI, kortit, terminologia |
| `styles.css` | Tyylit | Kauppalomake, kaupparivit, kortin uudet mittarit, tapaaminen-nappi |
| `tests/_harness.js` | Testiapuri | UUSI — lataa jsx/js-tiedostot Node-sandboxiin |
| `tests/deals-logic.test.js` | data.jsx-testit | UUSI |
| `tests/db-deals.test.js` | db.js LS-polun testit | UUSI |
| **Supabase (manuaali)** | Skeema | `ALTER TABLE daily_stats` + `CREATE TABLE deals` (Task 9) |

---

## Task 0: Testiapuri

**Files:**
- Create: `tests/_harness.js`

- [ ] **Step 1: Luo testiapuri**

```js
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

// Lataa tiedosto sandboxiin ja palauta sandboxin window.
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
```

- [ ] **Step 2: Sanity-check apurin lataus toimii nykyiselle data.jsx:lle**

Run: `node -e "const{load}=require('./tests/_harness');const w=load('data.jsx').window;console.log(typeof w.playerKey)"`
Expected: tulostaa `function`

- [ ] **Step 3: Commit**

```bash
git add tests/_harness.js
git commit -m "test: lisää riippuvuudeton Node-testiapuri (vm-sandbox)"
```

---

## Task 1: data.jsx — aggregaatit (tapaamiset + kaupat)

**Files:**
- Modify: `data.jsx` (`recalcPlayerFromDailyStats`, exports)
- Create/Modify: `tests/deals-logic.test.js`

- [ ] **Step 1: Kirjoita kaatuva testi**

```js
// tests/deals-logic.test.js
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// recalcPlayerFromDeals
{
  const deals = [
    { player_id:'a', megis: 10, eurot: 1000 },
    { player_id:'a', megis: 30, eurot: 3000 },
  ];
  const p = w.recalcPlayerFromDeals({ nick:'A' }, deals);
  assert(p.dealsCount === 2, 'dealsCount = 2');
  assert(p.megisTotal === 40, 'megisTotal = 40');
  assert(p.eurTotal === 4000, 'eurTotal = 4000');
  assert(p.avgMegis === 20, 'avgMegis = 20');
  assert(p.avgEur === 2000, 'avgEur = 2000');
  assert(p.nick === 'A', 'säilyttää muut kentät');
}
// nolla kauppaa → ei jakoa nollalla
{
  const p = w.recalcPlayerFromDeals({}, []);
  assert(p.dealsCount === 0 && p.avgMegis === 0 && p.avgEur === 0, 'nolla kauppaa → 0');
}
// tapaamiset summautuu daily-riveistä
{
  const rows = [
    { date_key:'2026-06-22', luurit:5, vastatut:3, buukit:1, tapaamiset:2 },
    { date_key:'2026-06-23', luurit:4, vastatut:2, buukit:1, tapaamiset:1 },
  ];
  const p = w.recalcPlayerFromDailyStats({ nick:'A' }, rows);
  assert(p.tapaamiset === 3, 'tapaamiset summautuu = 3');
  assert(p.buukit === 2, 'buukit yhä laskettu = 2');
}
```

- [ ] **Step 2: Aja testi → epäonnistuu**

Run: `node tests/deals-logic.test.js`
Expected: FAIL — `recalcPlayerFromDeals` ei ole funktio / `tapaamiset` undefined.

- [ ] **Step 3: Lisää `tapaamiset` summaus `recalcPlayerFromDailyStats`-funktioon**

`data.jsx`: etsi `let luurit = 0, vastatut = 0, buukit = 0;` ja sen `myRows.forEach(...)`-summa. Muuta:

```js
  let luurit = 0, vastatut = 0, buukit = 0, tapaamiset = 0;
  myRows.forEach(r => { luurit += (r.luurit||0); vastatut += (r.vastatut||0); buukit += (r.buukit||0); tapaamiset += (r.tapaamiset||0); });
```

Ja `return { ...player, luurit, vastatut, buukit, last5, streak, trendN };` →

```js
  return { ...player, luurit, vastatut, buukit, tapaamiset, last5, streak, trendN };
```

- [ ] **Step 4: Lisää `recalcPlayerFromDeals` (heti `recalcPlayerFromDailyStats`-funktion jälkeen)**

```js
// Laskee pelaajan kauppa-aggregaatit kauppariveistä (deals = totuuden lähde)
function recalcPlayerFromDeals(player, myDeals) {
  let megisTotal = 0, eurTotal = 0;
  const dealsCount = myDeals.length;
  myDeals.forEach(d => { megisTotal += Number(d.megis) || 0; eurTotal += Number(d.eurot) || 0; });
  const avgMegis = dealsCount > 0 ? megisTotal / dealsCount : 0;
  const avgEur   = dealsCount > 0 ? eurTotal / dealsCount : 0;
  return { ...player, dealsCount, megisTotal, eurTotal, avgMegis, avgEur };
}
```

- [ ] **Step 5: Vie funktio `Object.assign(window, {...})`-listaan**

`data.jsx`: lisää `recalcPlayerFromDailyStats`-rivin viereen:

```js
  WEEKDAY_DATE_KEYS, weekdayIndexToDateKey, dateKeyToWeekdayIndex, recalcPlayerFromDailyStats, recalcPlayerFromDeals,
```

- [ ] **Step 6: Aja testi → läpäisee**

Run: `node tests/deals-logic.test.js`
Expected: kaikki `✓`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add data.jsx tests/deals-logic.test.js
git commit -m "feat(data): tapaamiset-summaus + recalcPlayerFromDeals aggregaatit"
```

---

## Task 2: db.js — deals-persistenssi + tapaamiset daily-riville

**Files:**
- Modify: `db.js`
- Create: `tests/db-deals.test.js`

- [ ] **Step 1: Kirjoita kaatuva testi (localStorage-fallback-polku)**

```js
// tests/db-deals.test.js
const { load, makeLocalStorage, assert } = require('./_harness');
const ls = makeLocalStorage();
// db.js on IIFE: ilman window.supabasea se menee localStorage-tilaan
const sandbox = load('db.js', { localStorage: ls });
const DB = sandbox.window.DB;

(async () => {
  assert(DB.backend === 'local', 'backend = local kun ei Supabasea');
  assert(typeof DB.upsertDeal === 'function', 'upsertDeal on olemassa');
  assert(typeof DB.fetchAllDeals === 'function', 'fetchAllDeals on olemassa');
  assert(typeof DB.deleteDeal === 'function', 'deleteDeal on olemassa');

  await DB.upsertDeal({ id:'a_2026-06-22_1', player_id:'a', date_key:'2026-06-22', toimiala:'Teollisuus', megis:12, eurot:1200 });
  let all = await DB.fetchAllDeals();
  assert(all.length === 1 && all[0].megis === 12, 'kauppa tallentui ja luettiin');

  // upsert samalla id:llä korvaa
  await DB.upsertDeal({ id:'a_2026-06-22_1', player_id:'a', date_key:'2026-06-22', toimiala:'Kauppa', megis:5, eurot:500 });
  all = await DB.fetchAllDeals();
  assert(all.length === 1 && all[0].toimiala === 'Kauppa', 'sama id korvaa, ei duplikaattia');

  await DB.deleteDeal('a_2026-06-22_1');
  all = await DB.fetchAllDeals();
  assert(all.length === 0, 'deleteDeal poistaa');

  // tapaamiset kulkee upsertDailyStats:n läpi
  const row = await DB.upsertDailyStats('a', '2026-06-22', { luurit:5, vastatut:3, buukit:1, tapaamiset:2 });
  assert(row.tapaamiset === 2, 'upsertDailyStats säilyttää tapaamiset');
})();
```

- [ ] **Step 2: Aja testi → epäonnistuu**

Run: `node tests/db-deals.test.js`
Expected: FAIL — `upsertDeal` ei funktio; `row.tapaamiset` undefined.

- [ ] **Step 3: Lisää `tapaamiset` `upsertDailyStats`-funktion riviin**

`db.js`: `upsertDailyStats`-funktiossa `row`-olioon, `buukit`-rivin jälkeen:

```js
      buukit:   Math.max(0, stats.buukit   || 0),
      tapaamiset: Math.max(0, stats.tapaamiset || 0),
```

- [ ] **Step 4: Lisää deals-lohko (mallina `Daily stats` -lohko)**

`db.js`: lisää `Daily stats`-lohkon jälkeen, ennen `Init`-lohkoa:

```js
  // ── Deals (kaupat) ─────────────────────────
  const LS_DEALS = 'buukkauskisa.deals.v1';
  let dealsListeners = [];

  function loadLocalDeals() {
    try { const r = localStorage.getItem(LS_DEALS); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function saveLocalDeals(rows) {
    try { localStorage.setItem(LS_DEALS, JSON.stringify(rows)); } catch(e) {}
  }
  function notifyDeals(rows) {
    dealsListeners.forEach(cb => { try { cb(rows); } catch(e) {} });
  }
  function subscribeDeals(cb) {
    dealsListeners.push(cb);
    return () => { dealsListeners = dealsListeners.filter(x => x !== cb); };
  }
  async function fetchAllDeals() {
    if (!client) return loadLocalDeals();
    const { data, error } = await client.from('deals').select('*');
    if (error) { console.error('fetchAllDeals error:', error); return loadLocalDeals(); }
    return data || [];
  }
  async function upsertDeal(deal) {
    if (client) {
      const { error } = await client.from('deals').upsert(deal);
      if (error) console.error('upsertDeal error:', error);
    } else {
      let rows = loadLocalDeals();
      const idx = rows.findIndex(r => r.id === deal.id);
      if (idx >= 0) rows[idx] = deal; else rows.push(deal);
      saveLocalDeals(rows);
      notifyDeals(rows);
    }
    return deal;
  }
  async function deleteDeal(id) {
    if (client) {
      const { error } = await client.from('deals').delete().eq('id', id);
      if (error) console.error('deleteDeal error:', error);
    } else {
      const rows = loadLocalDeals().filter(r => r.id !== id);
      saveLocalDeals(rows);
      notifyDeals(rows);
    }
  }
```

- [ ] **Step 5: Liitä deals init-funktioon ja realtimeen**

`db.js` `init()`: lisää haku
```js
    const initialDeals   = await fetchAllDeals();
```
Lisää Supabase-realtime-kanava (muiden `client.channel(...)`-kutsujen viereen):
```js
      client
        .channel('public:deals')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'deals' },
            async () => { const fresh = await fetchAllDeals(); notifyDeals(fresh); })
        .subscribe();
```
Lisää localStorage-fallbackin `storage`-kuuntelijaan:
```js
        if (e.key === LS_DEALS)   notifyDeals(loadLocalDeals());
```
Ja `return { players: ..., daily: initialDaily, deals: initialDeals };`

- [ ] **Step 6: Vie uudet funktiot `window.DB`-objektiin**

```js
    subscribeDeals,
    fetchAllDeals,
    upsertDeal,
    deleteDeal,
```

- [ ] **Step 7: Aja testi → läpäisee**

Run: `node tests/db-deals.test.js`
Expected: kaikki `✓`, exit 0.

- [ ] **Step 8: Commit**

```bash
git add db.js tests/db-deals.test.js
git commit -m "feat(db): deals-CRUD + realtime + tapaamiset upsertDailyStatsiin"
```

---

## Task 3: app.jsx — deals-tila, init/subscribe, yhtenäinen aggregaattipolku

**Files:**
- Modify: `app.jsx` (App-komponentti: tila, refit, init, subscribe, `applyDailyToPlayers`)

- [ ] **Step 1: Lisää deals-tila ja ref**

`app.jsx` lähelle `const [dailyStats, setDailyStats] = useState([]);`:
```js
  const [deals, setDeals] = useState([]);
```
`app.jsx` lähelle `const dailyRef = useRef([]);`:
```js
  const dealsRef = useRef([]);
```

- [ ] **Step 2: Korvaa `applyDailyToPlayers` → `applyDerivedToPlayers` (daily + deals)**

```js
  function applyDerivedToPlayers(rawMap, rows, dealRows) {
    const out = {};
    Object.entries(rawMap).forEach(([key, p]) => {
      const myRows  = rows.filter(r => r.player_id === key);
      const myDeals = dealRows.filter(d => d.player_id === key);
      let np = myRows.length > 0 ? recalcPlayerFromDailyStats(p, myRows) : p;
      np = recalcPlayerFromDeals(np, myDeals);
      out[key] = np;
    });
    return out;
  }
```
Päivitä KAIKKI `applyDailyToPlayers(...)`-kutsut käyttämään `applyDerivedToPlayers(..., dealsRef.current)`. (Init-kohdassa käytä paikallista `dealRows`-muuttujaa, ks. Step 3.)

- [ ] **Step 3: Lataa deals init-effectissä**

`app.jsx` init-`(async () => { const initial = await DB.init(); ... })()`-lohkossa:
```js
      const dealRows = initial.deals || [];
```
Aseta ennen players-laskentaa:
```js
      dealsRef.current = dealRows;
      setDeals(dealRows);
```
Muuta `const players = applyDailyToPlayers(rawPlayers, dailyRows);` →
```js
      const players = applyDerivedToPlayers(rawPlayers, dailyRows, dealRows);
```

- [ ] **Step 4: Päivitä players-subscribe ja lisää deals-subscribe**

`players`-subscribe (`unsubP = DB.subscribe(...)`): muuta recalc käyttämään dealsRef:iä:
```js
        const recalced = applyDerivedToPlayers(freshMap, dailyRef.current, dealsRef.current);
```
`daily`-subscribe (`unsubD = DB.subscribeDaily(...)`): samoin varmista että pelaaja-aggregaatit lasketaan `applyDerivedToPlayers(playersMapRef.current, rows, dealsRef.current)`-tyyppisesti (säilytä nykyinen rakenne, lisää dealsRef-parametri).

Lisää uusi deals-subscribe muiden viereen:
```js
      const unsubDeals = DB.subscribeDeals((rows) => {
        dealsRef.current = rows;
        setDeals(rows);
        const recalced = applyDerivedToPlayers(playersMapRef.current, dailyRef.current, rows);
        playersMapRef.current = recalced;
        setPlayersMap(recalced);
      });
```
Lisää cleanupiin: `unsubDeals && unsubDeals();`

- [ ] **Step 5: Manuaalinen verifiointi — sivu latautuu ilman virheitä**

Avaa `Buukkauskisa.html` selaimessa (tai paikallinen preview). Syötä salasana VENI.
Expected: sivu latautuu, konsolissa ei uusia virheitä, olemassa olevat tilastot näkyvät normaalisti.

- [ ] **Step 6: Commit**

```bash
git add app.jsx
git commit -m "feat(app): deals-tila + yhtenäinen applyDerivedToPlayers-aggregaattipolku"
```

---

## Task 4: app.jsx — käsittelijät (tapaaminen, lisää/poista kauppa)

**Files:**
- Modify: `app.jsx` (`performAction`, uudet `handleAddDeal`/`handleDeleteDeal`, `handleSaveDay`)

- [ ] **Step 1: Lisää `'tapaaminen'` performAction-päivitykseen**

`performAction`-funktion `setPlayersMap`-päivittäjässä, muiden lajien rinnalle:
```js
      } else if (kind === 'tapaaminen') {
        next.tapaamiset = (cur.tapaamiset || 0) + 1;
```
Lisää daily_stats-kirjoitusosan ehtoon `'tapaaminen'`:
```js
    if (dateKey2 && dayIdx2 >= 0 && (kind === 'luuri' || kind === 'vastattu' || kind === 'buukki' || kind === '-buukki' || kind === 'tapaaminen')) {
```
Ja saman lohkon `ds`-rakennukseen:
```js
        const ds = existing
          ? { luurit: existing.luurit, vastatut: existing.vastatut, buukit: existing.buukit, tapaamiset: existing.tapaamiset || 0 }
          : { luurit: 0, vastatut: 0, buukit: 0, tapaamiset: 0 };
        if (kind === 'luuri')          ds.luurit++;
        else if (kind === 'vastattu')  ds.vastatut++;
        else if (kind === 'buukki')    ds.buukit++;
        else if (kind === '-buukki')   ds.buukit = Math.max(0, ds.buukit - 1);
        else if (kind === 'tapaaminen') ds.tapaamiset++;
```

- [ ] **Step 2: Lisää `handleAddDeal` ja `handleDeleteDeal` (lähelle `handleSaveDay`-funktiota)**

```js
  const handleAddDeal = useCallback(async ({ toimiala, megis, eurot }) => {
    if (!currentKey || currentKey === ADMIN_KEY) return;
    const dayIdx = currentWeekdayIndex();
    const safeIdx = dayIdx >= 0 ? Math.min(dayIdx, WEEKDAY_DATE_KEYS.length - 1) : 0;
    const dateKey = weekdayIndexToDateKey(safeIdx);
    const todays = dealsRef.current.filter(d => d.player_id === currentKey && d.date_key === dateKey);
    const seq = todays.length + 1;
    const id = `${currentKey}_${dateKey}_${seq}`;
    const deal = {
      id, player_id: currentKey, date_key: dateKey,
      toimiala: (toimiala || '').trim(),
      megis: Math.max(0, Number(megis) || 0),
      eurot: Math.max(0, Number(eurot) || 0),
      created_at: new Date().toISOString(),
    };
    await DB.upsertDeal(deal);
    const nextDeals = [...dealsRef.current.filter(d => d.id !== id), deal];
    dealsRef.current = nextDeals;
    setDeals(nextDeals);
    const base = playersMapRef.current[currentKey];
    if (base) {
      const recalced = recalcPlayerFromDeals(base, nextDeals.filter(d => d.player_id === currentKey));
      setPlayersMap(prev => ({ ...prev, [currentKey]: recalced }));
    }
  }, [currentKey]);

  const handleDeleteDeal = useCallback(async (id) => {
    if (!currentKey || currentKey === ADMIN_KEY) return;
    await DB.deleteDeal(id);
    const nextDeals = dealsRef.current.filter(d => d.id !== id);
    dealsRef.current = nextDeals;
    setDeals(nextDeals);
    const base = playersMapRef.current[currentKey];
    if (base) {
      const recalced = recalcPlayerFromDeals(base, nextDeals.filter(d => d.player_id === currentKey));
      setPlayersMap(prev => ({ ...prev, [currentKey]: recalced }));
    }
  }, [currentKey]);
```

- [ ] **Step 3: Tue `tapaamiset` `handleSaveDay`-funktiossa**

`handleSaveDay` saa `stats`-oliossa myös `tapaamiset` (DailyReport-lomake lisää sen Task 5:ssä). Varmista että rakennettu daily-rivi sisältää sen:
```js
      { id: currentKey+'_'+dateKey, player_id: currentKey, date_key: dateKey, ...stats },
```
(`...stats` kuljettaa `tapaamiset`-kentän automaattisesti; ei muuta muutosta tarvita kunhan lomake lähettää sen.)

- [ ] **Step 4: Manuaalinen verifiointi**

Selaimessa kirjaudu pelaajana. (Nappi tulee Task 5:ssä; tässä voi testata konsolista jos haluaa, esim. tarkistaa ettei syntaksivirheitä.)
Expected: ei konsolivirheitä, sivu toimii.

- [ ] **Step 5: Commit**

```bash
git add app.jsx
git commit -m "feat(app): tapaaminen-pikavalinta + handleAddDeal/handleDeleteDeal"
```

---

## Task 5: app.jsx — syöttö-UI (tapaaminen-nappi, kauppalomake, päivän kaupat)

**Files:**
- Modify: `app.jsx` (`MyCard`, `DailyReport`, niiden kutsukohdat)

- [ ] **Step 1: Lisää tapaaminen-nappi MyCardiin**

`MyCard`:n `mc-actions`-lohkoon, BUUKKI-napin jälkeen (ennen `− BUUKKI`):
```jsx
        <button
          className="btn"
          onClick={(e) => onAction('tapaaminen', e.currentTarget.getBoundingClientRect())}
          title="Kirjaa tapaaminen"
        >
          <span className="ico">+</span> TAPAAMINEN
        </button>
```

- [ ] **Step 2: Lisää tapaamiset-laskuririvi DailyReportin pelaajalomakkeeseen**

`DailyReport`: laajenna `form`-aloitustila ja lataus-effekti sisältämään `tapaamiset`:
```js
  const [form, setForm] = useState({ luurit: 0, vastatut: 0, buukit: 0, tapaamiset: 0 });
```
Lataus-effektissä:
```js
    setForm(row ? { luurit: row.luurit||0, vastatut: row.vastatut||0, buukit: row.buukit||0, tapaamiset: row.tapaamiset||0 } : { luurit:0, vastatut:0, buukit:0, tapaamiset:0 });
```
Lisää lomakkeen kenttälistaan (`{ key:'buukit', ... }`-rivin jälkeen):
```js
            { key: 'tapaamiset', label: 'TAPAAMISET', max: null },
```

- [ ] **Step 3: Lisää kauppalomake + päivän kaupat -lista DailyReportiin**

`DailyReport`-komponentti saa uudet propsit: `deals`, `onAddDeal`, `onDeleteDeal`. Lisää komponentin sisään (vain ei-admin -näkymässä, lomakkeen jälkeen) inline-lohko:

```jsx
      {/* Kaupat — vain pelaajanäkymä, valitulle päivälle */}
      {!isAdmin && (
        <DealEntry
          deals={deals.filter(d => d.player_id === currentKey && d.date_key === dateKey)}
          onAdd={onAddDeal}
          onDelete={onDeleteDeal}
          isToday={selIdx === todayIdx}
        />
      )}
```

Lisää uusi komponentti (esim. `DailyReport`-funktion yläpuolelle):
```jsx
function DealEntry({ deals, onAdd, onDelete, isToday }) {
  const [open, setOpen] = useState(false);
  const [toimiala, setToimiala] = useState('');
  const [megis, setMegis] = useState('');
  const [eurot, setEurot] = useState('');

  const submit = () => {
    if (!megis && !eurot && !toimiala.trim()) return;
    onAdd({ toimiala, megis, eurot });
    setToimiala(''); setMegis(''); setEurot(''); setOpen(false);
  };

  return (
    <div className="deal-entry">
      <div className="deal-entry-head">
        <span className="deal-entry-title">KAUPAT</span>
        {isToday && !open && (
          <button className="deal-add-btn" onClick={() => setOpen(true)}>➕ Lisää kauppa</button>
        )}
      </div>

      {open && (
        <div className="deal-form">
          <input className="deal-input" type="text" placeholder="Toimiala (vain toimiala, ei asiakkaan nimeä)"
                 value={toimiala} onChange={e => setToimiala(e.target.value)} />
          <div className="deal-form-nums">
            <input className="deal-input" type="number" min="0" placeholder="Megis"
                   value={megis} onChange={e => setMegis(e.target.value)} />
            <input className="deal-input" type="number" min="0" placeholder="Eurot"
                   value={eurot} onChange={e => setEurot(e.target.value)} />
          </div>
          <div className="deal-form-actions">
            <button className="deal-save" onClick={submit}>Tallenna kauppa</button>
            <button className="deal-cancel" onClick={() => setOpen(false)}>Peruuta</button>
          </div>
        </div>
      )}

      {deals.length > 0 ? (
        <ul className="deal-list">
          {deals.map(d => (
            <li key={d.id} className="deal-row">
              <span className="deal-toimiala">{d.toimiala || '—'}</span>
              <span className="deal-megis">{d.megis} Megis</span>
              <span className="deal-eur">{Math.round(d.eurot)} €</span>
              {isToday && <button className="deal-del" title="Poista kauppa" onClick={() => onDelete(d.id)}>✕</button>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="deal-empty">Ei kauppoja tälle päivälle.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Välitä uudet propsit DailyReportille**

Lisää ensin propsit `DailyReport`-funktion destrukturointiin (nykyinen:
`function DailyReport({ currentKey, isAdmin, dailyStats, players, onSaveDay })`):
```js
function DailyReport({ currentKey, isAdmin, dailyStats, players, onSaveDay, deals, onAddDeal, onDeleteDeal }) {
```
Etsi sitten `DailyReport`-kutsukohdat (`<DailyReport ... />`). Lisää propsit:
```jsx
            deals={deals} onAddDeal={handleAddDeal} onDeleteDeal={handleDeleteDeal}
```
(Admin-näkymässä propsit voi välittää myös; DealEntry renderöityy vain ei-admin-haarassa.)

- [ ] **Step 5: Manuaalinen verifiointi**

Selaimessa pelaajana:
1. Klikkaa "+ TAPAAMINEN" → MyCardin tapaamiset kasvaa (näkyy Task 6:n jälkeen kortissa; tässä vaiheessa varmista ettei virhettä).
2. Oma raportti → valitse tämä päivä → "➕ Lisää kauppa" → täytä toimiala/Megis/eurot → Tallenna → kauppa ilmestyy listaan.
3. Poista kauppa ✕ → katoaa listalta.
4. Lataa sivu uudelleen → kauppa säilyy (localStorage/Supabase).
Expected: kaikki toimii ilman konsolivirheitä.

- [ ] **Step 6: Commit**

```bash
git add app.jsx
git commit -m "feat(app): tapaaminen-nappi + kauppalomake ja päivän kaupat -lista"
```

---

## Task 6: app.jsx — korttien mittarit + terminologia

**Files:**
- Modify: `app.jsx` (`MyCard`, `PlayerModal`, "LUURIN NOSTO" -tekstit)

- [ ] **Step 1: Lisää keskikauppa + tapaamiset MyCardin tilastoihin**

`MyCard`:n `mc-stats`-lohkoon lisää uudet `stat`-laatikot (esim. Buukit-laatikoiden jälkeen):
```jsx
        <div className="stat">
          <div className="lbl">Tapaamiset</div>
          <div className="v">{me.tapaamiset || 0}</div>
        </div>
        <div className="stat">
          <div className="lbl">Kaupat</div>
          <div className="v">{me.dealsCount || 0}</div>
        </div>
        <div className="stat">
          <div className="lbl">Ø kauppa</div>
          <div className="v">{Math.round(me.avgMegis || 0)}<span style={{ fontSize: 12, color: 'var(--ink-3)' }}> Megis</span></div>
        </div>
        <div className="stat">
          <div className="lbl">Megis yht.</div>
          <div className="v">{Math.round(me.megisTotal || 0)}</div>
        </div>
```

- [ ] **Step 2: Vaihda "LUURIN NOSTO" → "LÄHTENEET PUHELUT" / "Lähteneet"**

Korvaa käyttöliittymätekstit (EI kentännimeä `luurit` koodissa):
- `MyCard`: nappi `+ LUURIN NOSTO` → `+ LÄHTENYT PUHELU`; otsikko `Luurit` → `Lähteneet`.
- `PlayerModal`: `+ LUURIN NOSTO` → `+ LÄHTENYT PUHELU`.
- `DailyReport`-lomake: label `'LUURIN NOSTOT'` → `'LÄHTENEET PUHELUT'`.
- `DailyReport`-yhteenvetotaulu: otsikko `Luurit` → `Lähteneet`.
- `Row`/`Table` (`col-luurit`, "LUURIN NOSTO" -tekstit): otsikkotekstit → `LÄHTENEET`. (CSS-luokkanimet `col-luurit` voi jättää ennalleen.)

Huom: jätä kentät `luurit` koodissa ja DB:ssä ennalleen; vain näkyvä teksti muuttuu.

- [ ] **Step 3: (Valinnainen) Lisää keskikauppa PlayerModaliin**

Jos PlayerModal näyttää tilastoja, lisää sinne `Ø kauppa: {Math.round(player.avgMegis||0)} Megis` ja `Kaupat: {player.dealsCount||0}` vastaavalla tyylillä.

- [ ] **Step 4: Manuaalinen verifiointi**

Selaimessa: pelaajan kortti näyttää Tapaamiset, Kaupat, Ø kauppa (Megis), Megis yht. Lisää kauppa → Ø kauppa ja Megis yht. päivittyvät heti. Tekstit lukevat "Lähteneet" eikä "Luurit/Luurin nosto".
Expected: luvut oikein, terminologia johdonmukainen.

- [ ] **Step 5: Commit**

```bash
git add app.jsx
git commit -m "feat(app): kortin keskikauppa/Megis-mittarit + Lähteneet puhelut -terminologia"
```

---

## Task 7: styles.css — kauppalomakkeen ja mittareiden tyylit

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Lisää tyylit (sovita olemassa oleviin design-tokeneihin: --bg-2, --line, --accent, --ink-3 jne.)**

```css
/* ── Kaupat (DealEntry) ────────────────────────── */
.deal-entry { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 14px; }
.deal-entry-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.deal-entry-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; letter-spacing: .08em; font-size: 14px; }
.deal-add-btn { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 13px; padding: 6px 12px; background: var(--accent); color: #fff; border: none; cursor: pointer; }
.deal-form { display: flex; flex-direction: column; gap: 8px; background: var(--bg-2); border: 1px solid var(--line); padding: 12px; margin-bottom: 12px; }
.deal-form-nums { display: flex; gap: 8px; }
.deal-input { padding: 8px 10px; border: 1px solid var(--line); background: #fff; font-size: 14px; width: 100%; }
.deal-form-actions { display: flex; gap: 8px; }
.deal-save { flex: 1; padding: 8px; background: var(--green, #1a8a3e); color: #fff; border: none; font-weight: 700; cursor: pointer; }
.deal-cancel { padding: 8px 12px; background: var(--bg-3); border: 1px solid var(--line); cursor: pointer; }
.deal-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.deal-row { display: grid; grid-template-columns: 1fr auto auto 24px; align-items: center; gap: 8px; padding: 7px 8px; background: var(--bg-2); border: 1px solid var(--line); font-size: 13px; }
.deal-toimiala { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deal-megis { font-family: 'JetBrains Mono', monospace; color: var(--accent); font-weight: 700; }
.deal-eur { font-family: 'JetBrains Mono', monospace; color: var(--ink-3); }
.deal-del { width: 22px; height: 22px; border: none; background: transparent; color: var(--ink-3); cursor: pointer; font-size: 14px; }
.deal-del:hover { color: var(--red); }
.deal-empty { font-size: 13px; color: var(--ink-4); font-style: italic; }
```

- [ ] **Step 2: Manuaalinen verifiointi**

Selaimessa: kauppalomake ja -lista näyttävät siisteiltä, sopivat sivuston ilmeeseen, toimivat mobiilileveydellä.
Expected: ei rikkonaista asettelua.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "style: kauppalomakkeen ja kaupparivien tyylit"
```

---

## Task 8: Loppuverifiointi (manuaalinen, koko polku)

**Files:** —

- [ ] **Step 1: Aja kaikki Node-testit**

Run: `node tests/deals-logic.test.js && node tests/db-deals.test.js`
Expected: kaikki `✓`, exit 0.

- [ ] **Step 2: Manuaalinen end-to-end selaimessa (localStorage-tila riittää)**

1. Salasana VENI → kirjaudu pelaajana (nick+city).
2. "+ TAPAAMINEN" pari kertaa → kortin Tapaamiset kasvaa.
3. Oma raportti → tämä päivä → lisää 2 kauppaa eri Megis/€-arvoilla.
4. Kortti: Kaupat=2, Ø kauppa = keskiarvo Megis, Megis yht. = summa. Tarkista laskenta käsin.
5. Poista 1 kauppa → luvut päivittyvät.
6. Lataa sivu uudelleen → tapaamiset ja kaupat säilyvät.
7. Sarjataulukon järjestys EI muuttunut (yhä buukki-pohjainen).
8. Vanha kisadata (luurit/vastatut/buukit) näkyy ennallaan.
Expected: kaikki kohdat OK.

- [ ] **Step 3: Push (deploy Verceliin)** — vain käyttäjän luvalla

```bash
git push
```

---

## Task 9: Supabase-skeeman migraatio (KÄYTTÄJÄ ajaa)

> Tämä on **manuaalinen** vaihe, jonka käyttäjä ajaa Supabasen SQL-editorissa
> ennen kuin Supabase-backend toimii oikein. localStorage-fallback toimii ilman tätä,
> joten paikallinen kehitys/testaus onnistuu ennen migraatiota.

- [ ] **Step 1: Anna käyttäjälle SQL ajettavaksi**

```sql
-- 1) Uusi sarake daily_stats-tauluun
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS tapaamiset int NOT NULL DEFAULT 0;

-- 2) Uusi deals-taulu
CREATE TABLE IF NOT EXISTS deals (
  id          text PRIMARY KEY,
  player_id   text NOT NULL,
  date_key    date NOT NULL,
  toimiala    text,
  megis       numeric NOT NULL DEFAULT 0,
  eurot       numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3) RLS samaksi kuin muilla tauluilla (anon luku/kirjoitus).
--    Toista deals-taululle samat politiikat kuin daily_stats-taululla.
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_anon_all ON deals FOR ALL USING (true) WITH CHECK (true);

-- 4) Realtime: lisää deals-taulu julkaisuun
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
```

- [ ] **Step 2: Käyttäjä vahvistaa**

Käyttäjä ajaa SQL:n, vahvistaa että taulut/sarakkeet luotiin (Supabase → Table editor).
Tämän jälkeen Supabase-backend tallentaa kaupat ja tapaamiset oikein, ja realtime synkronoi ne.

---

## Riippuvuudet ja järjestys

```
Task 0 (apuri)
  → Task 1 (data.jsx)  → Task 2 (db.js)
      → Task 3 (app: tila/init)  → Task 4 (app: käsittelijät)
          → Task 5 (app: syöttö-UI)  → Task 6 (app: kortit/terminologia)
              → Task 7 (styles)  → Task 8 (loppuverifiointi)
Task 9 (Supabase SQL) — käyttäjä, ennen tuotantokäyttöä; rinnakkainen paikallistestin kanssa
```
