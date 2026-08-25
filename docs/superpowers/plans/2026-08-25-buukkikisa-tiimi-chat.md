# Tiimichat + kauppailmoitukset + reaktiot — toteutussuunnitelma

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tiimi voi kirjoittaa viestejä ja reagoida niihin etusivun sivupalkissa, ja jokainen kirjattu kauppa ilmestyy chatiin automaattisesti palvelimen takaamana.

**Architecture:** Kaksi uutta Postgres-taulua (`chat_messages`, `chat_reactions`) + AFTER INSERT -laukaisin `deals`-taulussa. Client noudattaa täsmälleen olemassa olevaa `deals`-mallia: `fetchAll*` → `subscribe*` (debounced kokohaku) → `notify*`. Kauppailmoituksen sisältö yhdistetään client-puolella jo ladatusta `deals`/`playersMap`-tilasta, kuten `buildTickerFeed` jo tekee.

**Tech Stack:** Supabase (Postgres + RLS + Realtime), React 18 UMD + Babel selaimessa (ei build-vaihetta), riippumattomat Node-testit (`tests/_harness.js`, vm-sandbox).

**Spec:** `docs/superpowers/specs/2026-08-25-buukkikisa-tiimi-chat-design.md`

---

## Tiedostorakenne

| Tiedosto | Vastuu | Muutos |
|---|---|---|
| `docs/migraatio-tiimichat.sql` | Taulut, RLS, laukaisin | **Uusi** |
| `data.jsx` | Puhdas logiikka: validointi, reaktioiden ryhmittely, kauppailmoituksen muotoilu | Muokkaus |
| `db.js` | Chat-API: haku, lähetys, poisto, reaktiot, realtime | Muokkaus |
| `app.jsx` | `TeamChat`-komponentti + kytkentä `DB.init`-efektiin | Muokkaus |
| `styles.css` | Chatin tyylit | Muokkaus (lisäys loppuun) |
| `tests/chat-logic.test.js` | data.jsx:n puhtaan logiikan testit | **Uusi** |
| `tests/db-chat.test.js` | db.js:n chat-API:n testit | **Uusi** |

**Miksi puhdas logiikka data.jsx:ään:** validointi ja reaktioiden ryhmittely ovat testattavissa ilman selainta tai tietokantaa. `app.jsx` on jo yli 3000 riviä — uusi logiikka sinne tekisi siitä raskaamman testata ja lukea.

---

## Task 1: SQL-migraatio

**Files:**
- Create: `docs/migraatio-tiimichat.sql`

- [ ] **Step 1: Kirjoita migraatiotiedosto**

```sql
-- ============================================================================
-- Buukkikisa — tiimichat (osaprojekti E)
-- Spec: docs/superpowers/specs/2026-08-25-buukkikisa-tiimi-chat-design.md
-- ============================================================================

-- ── 1. Viestit ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         bigserial   PRIMARY KEY,
  player_id  text        NOT NULL REFERENCES players(id),
  kind       text        NOT NULL DEFAULT 'user' CHECK (kind IN ('user','deal')),
  body       text,
  deal_id    text        REFERENCES deals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_body_or_deal CHECK (
    (kind = 'user' AND body IS NOT NULL AND length(trim(body)) > 0 AND length(body) <= 1000)
    OR
    (kind = 'deal' AND deal_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS chat_messages_created ON chat_messages (created_at DESC);

-- ── 2. Reaktiot ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_reactions (
  id         bigserial   PRIMARY KEY,
  message_id bigint      NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  player_id  text        NOT NULL REFERENCES players(id),
  emoji      text        NOT NULL CHECK (emoji IN ('👍','🔥','🎉','💰','😂')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, player_id, emoji)
);
CREATE INDEX IF NOT EXISTS chat_reactions_message ON chat_reactions (message_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cm_select ON chat_messages;
CREATE POLICY cm_select ON chat_messages FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS cm_insert ON chat_messages;
CREATE POLICY cm_insert ON chat_messages FOR INSERT
  WITH CHECK (kind = 'user' AND owns_player(player_id));
DROP POLICY IF EXISTS cm_delete ON chat_messages;
CREATE POLICY cm_delete ON chat_messages FOR DELETE USING (is_admin());
-- Ei UPDATE-politiikkaa: viestit ovat muuttumattomia.

DROP POLICY IF EXISTS cr_select ON chat_reactions;
CREATE POLICY cr_select ON chat_reactions FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS cr_insert ON chat_reactions;
CREATE POLICY cr_insert ON chat_reactions FOR INSERT WITH CHECK (owns_player(player_id));
DROP POLICY IF EXISTS cr_delete ON chat_reactions;
CREATE POLICY cr_delete ON chat_reactions FOR DELETE USING (owns_player(player_id));

-- ── 4. Kauppa → chat-ilmoitus (palvelin takaa, ei clientin varassa) ─────────
CREATE OR REPLACE FUNCTION chat_announce_deal() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  INSERT INTO chat_messages (player_id, kind, deal_id)
  VALUES (NEW.player_id, 'deal', NEW.id);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_chat_announce_deal ON deals;
CREATE TRIGGER trg_chat_announce_deal
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION chat_announce_deal();

-- ── 5. Tarkistus ────────────────────────────────────────────────────────────
SELECT 'chat-migraatio ok' AS status,
       (SELECT count(*) FROM pg_policies WHERE tablename IN ('chat_messages','chat_reactions')) AS politiikkoja,
       (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_chat_announce_deal') AS laukaisimia;
```

- [ ] **Step 2: Aja migraatio Supabasessa**

Aja `docs/migraatio-tiimichat.sql` Supabasen SQL-editorissa (Chrome auki).
Odotettu tulos: `chat-migraatio ok`, `politiikkoja = 6`, `laukaisimia = 1`.

**KRIITTINEN:** Migraatio on ajettava ENNEN kuin koodi pushataan masteriin — Vercel deployaa masterin automaattisesti ja koodi olettaa taulujen olemassaoloa.

- [ ] **Step 3: Varmista ettei kaupan poisto rikkoutunut**

Aja Supabasessa (rollback-transaktio, ei muuta dataa):
```sql
BEGIN;
INSERT INTO deals (id, player_id, date_key, toimiala, megis, eurot, meeting_count)
VALUES ('__testi__', (SELECT id FROM players LIMIT 1), '2026-08-25', 'Testi', 1, 1, 0);
SELECT count(*) AS chat_rivi_syntyi FROM chat_messages WHERE deal_id = '__testi__';
DELETE FROM deals WHERE id = '__testi__';
SELECT count(*) AS chat_rivi_poistui FROM chat_messages WHERE deal_id = '__testi__';
ROLLBACK;
```
Odotettu: `chat_rivi_syntyi = 1`, `chat_rivi_poistui = 0`. Jos DELETE heittää vierasavain-
virheen, `ON DELETE CASCADE` puuttuu — korjaa ennen jatkoa.

- [ ] **Step 4: Commit**

```bash
git add docs/migraatio-tiimichat.sql && git commit -m "docs: tiimichatin SQL-migraatio"
```

---

## Task 2: data.jsx — puhdas logiikka

**Files:**
- Modify: `data.jsx` (lisää funktiot ennen `Object.assign(window, {...})` -lohkoa, n. rivi 611)
- Test: `tests/chat-logic.test.js` (uusi)

- [ ] **Step 1: Kirjoita kaatuva testi**

```js
// tests/chat-logic.test.js
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// ── Viestin validointi ──
assert(w.validateChatMessage('Moi').ok === true, 'tavallinen viesti kelpaa');
assert(w.validateChatMessage('').ok === false, 'tyhjä hylätään');
assert(w.validateChatMessage('   ').ok === false, 'pelkkä välilyönti hylätään');
assert(w.validateChatMessage('\n\t ').ok === false, 'pelkkä rivinvaihto hylätään');
assert(w.validateChatMessage('a'.repeat(1000)).ok === true, '1000 merkkiä kelpaa');
assert(w.validateChatMessage('a'.repeat(1001)).ok === false, '1001 merkkiä hylätään');
assert(typeof w.validateChatMessage('').error === 'string', 'hylkäys kertoo syyn');

// ── Reaktiovalikoima ──
assert(Array.isArray(w.CHAT_REACTIONS) && w.CHAT_REACTIONS.length === 5, '5 reaktiovaihtoehtoa');

// ── Reaktioiden ryhmittely ──
{
  const reactions = [
    { message_id: 1, player_id: 'a', emoji: '🔥' },
    { message_id: 1, player_id: 'b', emoji: '🔥' },
    { message_id: 1, player_id: 'a', emoji: '🎉' },
    { message_id: 2, player_id: 'c', emoji: '👍' },
  ];
  const g = w.groupReactions(reactions, 1, 'a');
  const tuli = g.find(x => x.emoji === '🔥');
  assert(tuli.count === 2, '🔥 laskettu kahdesti, sai ' + tuli.count);
  assert(tuli.mine === true, 'oma reaktio tunnistetaan');
  const juhla = g.find(x => x.emoji === '🎉');
  assert(juhla.count === 1 && juhla.mine === true, '🎉 yksi, oma');
  assert(!g.some(x => x.emoji === '👍'), 'toisen viestin reaktio ei vuoda mukaan');
  assert(g.every(x => x.count > 0), 'nolla-reaktioita ei palauteta');

  const gToiselle = w.groupReactions(reactions, 1, 'b');
  assert(gToiselle.find(x => x.emoji === '🎉').mine === false, 'toisen reaktio ei ole omani');
}
assert(w.groupReactions([], 1, 'a').length === 0, 'ei reaktioita → tyhjä lista');
assert(w.groupReactions(null, 1, 'a').length === 0, 'null ei kaada');

// ── Kauppailmoituksen muotoilu ──
{
  const players = { 'räntilä:hämeenlinna': { nick: 'RÄNTILÄ' } };
  const deals = [{ id: 'd1', megis: 250, eurot: 750, toimiala: 'Teollisuus' }];
  const msg = { kind: 'deal', player_id: 'räntilä:hämeenlinna', deal_id: 'd1' };
  const t = w.formatDealMessage(msg, deals, players);
  assert(/RÄNTILÄ/.test(t), 'nimimerkki mukana: ' + t);
  assert(/250/.test(t) && /Megis/.test(t), 'Megis-määrä mukana: ' + t);
  assert(/Teollisuus/.test(t), 'toimiala mukana: ' + t);

  // Kauppa ei vielä ladattu (realtime ehti ensin) → varamuoto, ei kaadu
  const vara = w.formatDealMessage(msg, [], players);
  assert(/RÄNTILÄ/.test(vara), 'varamuodossa nimimerkki: ' + vara);
  assert(!/undefined/.test(vara) && !/null/.test(vara), 'ei undefined/null näkyviin: ' + vara);

  // Toimiala puuttuu
  const ilmanToimialaa = w.formatDealMessage(msg, [{ id: 'd1', megis: 100 }], players);
  assert(!/undefined/.test(ilmanToimialaa), 'puuttuva toimiala ei tuota undefined: ' + ilmanToimialaa);
}
```

- [ ] **Step 2: Aja testi → FAIL**

Run: `node tests/chat-logic.test.js`
Expected: `TypeError: w.validateChatMessage is not a function`

- [ ] **Step 3: Toteuta data.jsx:ään**

Lisää ennen `Object.assign(window, {` -riviä:

```js
// ── Tiimichat (osaprojekti E) ────────────────────────────────────────────────
const CHAT_MAX_LEN = 1000;
const CHAT_REACTIONS = ['👍', '🔥', '🎉', '💰', '😂'];

function validateChatMessage(body) {
  const t = (body || '').trim();
  if (!t) return { ok: false, error: 'Kirjoita viesti ennen lähetystä.' };
  if ((body || '').length > CHAT_MAX_LEN) {
    return { ok: false, error: 'Viesti on liian pitkä (max ' + CHAT_MAX_LEN + ' merkkiä).' };
  }
  return { ok: true, body: t };
}

// Reaktiot yhdelle viestille: [{emoji, count, mine}], vain ne joilla on ≥1 reaktio.
function groupReactions(reactions, messageId, myPlayerId) {
  const counts = {};
  (reactions || []).forEach(function (r) {
    if (String(r.message_id) !== String(messageId)) return;
    const e = counts[r.emoji] || (counts[r.emoji] = { emoji: r.emoji, count: 0, mine: false });
    e.count++;
    if (r.player_id === myPlayerId) e.mine = true;
  });
  return CHAT_REACTIONS.filter(function (e) { return counts[e]; }).map(function (e) { return counts[e]; });
}

// Kauppailmoituksen teksti. Sisältö yhdistetään jo ladatusta tilasta (sama malli
// kuin buildTickerFeed) — jos kauppa ei ole vielä listassa (realtime ehti ensin),
// näytetään suppeampi muoto ja se täydentyy kun deals-data saapuu.
function formatDealMessage(msg, deals, playersMap) {
  const nick = (playersMap && playersMap[msg.player_id] && playersMap[msg.player_id].nick) || msg.player_id;
  const deal = (deals || []).find(function (d) { return d.id === msg.deal_id; });
  if (!deal) return nick + ' teki kaupan';
  const osat = [nick, 'KAUPPA ' + (Number(deal.megis) || 0) + ' Megis'];
  if (deal.toimiala) osat.push(deal.toimiala);
  return osat.join(' · ');
}
```

Lisää exporttiin (`Object.assign(window, {...}`):
```js
  CHAT_REACTIONS, CHAT_MAX_LEN, validateChatMessage, groupReactions, formatDealMessage,
```

- [ ] **Step 4: Aja testi → PASS**

Run: `node tests/chat-logic.test.js`
Expected: kaikki `✓`, ei yhtään `✗`

- [ ] **Step 5: Aja koko sarja**

Run: `for f in tests/*.test.js; do node "$f" 2>&1 | grep "✗"; done`
Expected: ei tulostetta (ei rikkoutuneita testejä)

- [ ] **Step 6: Commit**

```bash
git add data.jsx tests/chat-logic.test.js && git commit -m "feat(chat): puhdas logiikka — validointi, reaktioiden ryhmittely, kauppailmoitus"
```

---

## Task 3: db.js — chat-API

**Files:**
- Modify: `db.js` (uusi osio `// ── Deals` -osion jälkeen, n. rivi 545; export n. rivi 771; init n. rivi 610–690)
- Test: `tests/db-chat.test.js` (uusi)

- [ ] **Step 1: Kirjoita kaatuva testi**

```js
// tests/db-chat.test.js
const { load, makeLocalStorage, assert } = require('./_harness');

function loadDB(handlers) {
  handlers = handlers || {};
  const calls = [];
  const win = {
    SUPABASE_CONFIG: { url: 'https://example.supabase.co', anonKey: 'anon-key' },
    supabase: { createClient() { return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { expires_at: Math.floor(Date.now()/1000) + 3600 } } }),
        refreshSession: () => Promise.resolve({ error: null }),
      },
      realtime: { isConnected: () => true, connect() {} },
      channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
      from(table) {
        return {
          select() {
            const q = {
              order() { return q; },
              limit() { calls.push({ op: 'select', table }); return handlers.select ? handlers.select() : Promise.resolve({ data: [], error: null }); },
              range: () => Promise.resolve({ data: [], error: null }),
            };
            return q;
          },
          insert(row) { calls.push({ op: 'insert', table, row }); return handlers.insert ? handlers.insert() : Promise.resolve({ error: null }); },
          delete() { return { eq(col, val) { calls.push({ op: 'delete', table, col, val });
            return { eq(c2, v2) { calls.push({ op: 'delete2', table, col: c2, val: v2 }); return handlers.del ? handlers.del() : Promise.resolve({ error: null }); },
                     then(res) { return (handlers.del ? handlers.del() : Promise.resolve({ error: null })).then(res); } }; } }; },
        };
      },
    }; } },
  };
  const DB = load('db.js', { window: win, localStorage: makeLocalStorage() }).window.DB;
  return { DB, calls };
}

(async () => {
  // API on olemassa
  {
    const { DB } = loadDB();
    ['fetchAllChatMessages','fetchAllChatReactions','sendChatMessage','deleteChatMessage',
     'toggleReaction','subscribeChat'].forEach(function (fn) {
      assert(typeof DB[fn] === 'function', 'DB.' + fn + ' on olemassa');
    });
  }

  // Lähetys onnistuu ja käyttää insertiä
  {
    const { DB, calls } = loadDB();
    const res = await DB.sendChatMessage('moi tiimi');
    assert(res.ok === true, 'viestin lähetys onnistuu');
    const ins = calls.find(c => c.op === 'insert' && c.table === 'chat_messages');
    assert(!!ins, 'insert kohdistui chat_messages-tauluun');
    assert(ins.row.kind === 'user', 'kind = user (deal-rivit vain laukaisimelta)');
    assert(ins.row.body === 'moi tiimi', 'viestin teksti mukana');
  }

  // Tyhjä viesti ei lähde palvelimelle asti
  {
    const { DB, calls } = loadDB();
    const res = await DB.sendChatMessage('   ');
    assert(res.ok === false, 'tyhjä viesti hylätään');
    assert(!calls.some(c => c.op === 'insert'), 'tyhjää viestiä ei lähetetä kantaan');
  }

  // Virhe → {ok:false}, ei heitä
  {
    const { DB } = loadDB({ insert: () => Promise.resolve({ error: { message: 'permission denied' } }) });
    let threw = false, res = null;
    try { res = await DB.sendChatMessage('moi'); } catch (e) { threw = true; }
    assert(threw === false, 'virhe ei heitä kutsujalle');
    assert(res.ok === false && /permission/.test(res.error.message), 'virheviesti välittyy');
  }

  // Hyytynyt lähetys → aikakatkaisu, ei jää roikkumaan
  {
    const { DB } = loadDB({ insert: () => new Promise(() => {}) });
    DB.setRequestTimeout(80);
    const alku = Date.now();
    const res = await DB.sendChatMessage('moi');
    assert(res.ok === false, 'hyytynyt lähetys → ok:false');
    assert(Date.now() - alku < 2000, 'ei jäänyt roikkumaan');
  }

  // Reaktio: ei omaa → lisätään
  {
    const { DB, calls } = loadDB();
    const res = await DB.toggleReaction(1, '🔥', []);
    assert(res.ok === true, 'reaktion lisäys onnistuu');
    assert(calls.some(c => c.op === 'insert' && c.table === 'chat_reactions'), 'insert chat_reactions-tauluun');
  }

  // Reaktio: oma jo olemassa → poistetaan (toggle)
  {
    const { DB, calls } = loadDB();
    const omat = [{ message_id: 1, player_id: '__me__', emoji: '🔥' }];
    const res = await DB.toggleReaction(1, '🔥', omat, '__me__');
    assert(res.ok === true, 'reaktion poisto onnistuu');
    assert(calls.some(c => c.op === 'delete' || c.op === 'delete2'), 'delete kutsuttiin, ei insert');
    assert(!calls.some(c => c.op === 'insert'), 'olemassa olevaa reaktiota ei lisätä uudelleen');
  }
})();
```

- [ ] **Step 2: Aja testi → FAIL**

Run: `node tests/db-chat.test.js`
Expected: `✗ DB.fetchAllChatMessages on olemassa`

- [ ] **Step 3: Toteuta db.js:ään**

Lisää `// ── Deals (kaupat)` -osion JÄLKEEN (ennen `// ── Playoff` -osiota tai `// ── Init`):

```js
  // ── Tiimichat (osaprojekti E) ─────────────────────────
  const LS_CHAT_MSG = 'buukkauskisa.chatmsg.v1';
  const LS_CHAT_RCT = 'buukkauskisa.chatrct.v1';
  let chatListeners = [];

  function loadLocalChat(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : []; } catch (e) { return []; }
  }
  function saveLocalChat(key, rows) {
    try { localStorage.setItem(key, JSON.stringify(rows)); } catch (e) {}
  }
  function notifyChat() {
    chatListeners.forEach(function (cb) { try { cb(); } catch (e) {} });
  }
  // Yksi tilaus kattaa sekä viestit että reaktiot — UI hakee molemmat kun jompikumpi muuttuu.
  function subscribeChat(cb) {
    chatListeners.push(cb);
    return function () { chatListeners = chatListeners.filter(function (x) { return x !== cb; }); };
  }

  // HUOM: EI fetchPaged — se hakee koko taulun ilman järjestystä/rajaa (väärä muoto).
  // Chatista halutaan aina vain viimeisimmät ≤200 riviä.
  async function fetchAllChatMessages() {
    if (!client) return loadLocalChat(LS_CHAT_MSG);
    try {
      const { data, error } = await withTimeout(
        client.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(200),
        'Chatin haku');
      if (error) { console.error('fetchAllChatMessages error:', error); return []; }
      return data || [];
    } catch (e) { console.error('fetchAllChatMessages exception:', e); return []; }
  }

  async function fetchAllChatReactions() {
    if (!client) return loadLocalChat(LS_CHAT_RCT);
    try {
      const { data, error } = await withTimeout(
        client.from('chat_reactions').select('*').order('created_at', { ascending: false }).limit(1000),
        'Reaktioiden haku');
      if (error) { console.error('fetchAllChatReactions error:', error); return []; }
      return data || [];
    } catch (e) { console.error('fetchAllChatReactions exception:', e); return []; }
  }

  async function sendChatMessage(body) {
    const v = validateChatMessage(body);          // data.jsx (ladattu ennen db.js:ää? ks. HUOM alla)
    if (!v.ok) return { ok: false, error: { message: v.error } };
    if (!client) {
      const rows = loadLocalChat(LS_CHAT_MSG);
      rows.unshift({ id: Date.now(), player_id: '__local__', kind: 'user', body: v.body, created_at: new Date().toISOString() });
      saveLocalChat(LS_CHAT_MSG, rows); notifyChat();
      return { ok: true };
    }
    const health = await ensureLiveSession();
    if (!health.ok) return { ok: false, error: health.error };
    const pid = await currentPlayerId();
    if (!pid) return { ok: false, error: { message: 'Kirjautunutta pelaajaa ei löytynyt.' } };
    try {
      const { error } = await withTimeout(
        client.from('chat_messages').insert({ player_id: pid, kind: 'user', body: v.body }),
        'Viestin lähetys');
      if (error) { console.error('sendChatMessage error:', error); return { ok: false, error: error }; }
      return { ok: true };
    } catch (e) {
      console.error('sendChatMessage exception:', e);
      return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe' } };
    }
  }

  async function deleteChatMessage(id) {
    if (!client) {
      saveLocalChat(LS_CHAT_MSG, loadLocalChat(LS_CHAT_MSG).filter(function (m) { return m.id !== id; }));
      notifyChat(); return { ok: true };
    }
    try {
      const { error } = await withTimeout(
        client.from('chat_messages').delete().eq('id', id), 'Viestin poisto');
      if (error) return { ok: false, error: error };
      return { ok: true };
    } catch (e) { return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe' } }; }
  }

  // reactions = tämänhetkinen reaktiolista (clientin tila), myPid = oma pelaaja-id.
  // Jos oma reaktio on jo olemassa → poistetaan (toggle), muuten lisätään.
  async function toggleReaction(messageId, emoji, reactions, myPid) {
    const pid = myPid || await currentPlayerId();
    if (!pid) return { ok: false, error: { message: 'Kirjautunutta pelaajaa ei löytynyt.' } };
    const omaOlemassa = (reactions || []).some(function (r) {
      return String(r.message_id) === String(messageId) && r.player_id === pid && r.emoji === emoji;
    });
    if (!client) {
      let rows = loadLocalChat(LS_CHAT_RCT);
      rows = omaOlemassa
        ? rows.filter(function (r) { return !(String(r.message_id) === String(messageId) && r.player_id === pid && r.emoji === emoji); })
        : rows.concat([{ message_id: messageId, player_id: pid, emoji: emoji }]);
      saveLocalChat(LS_CHAT_RCT, rows); notifyChat();
      return { ok: true };
    }
    const health = await ensureLiveSession();
    if (!health.ok) return { ok: false, error: health.error };
    try {
      if (omaOlemassa) {
        const { error } = await withTimeout(
          client.from('chat_reactions').delete().eq('message_id', messageId).eq('player_id', pid).eq('emoji', emoji),
          'Reaktion poisto');
        if (error) return { ok: false, error: error };
      } else {
        const { error } = await withTimeout(
          client.from('chat_reactions').insert({ message_id: messageId, player_id: pid, emoji: emoji }),
          'Reaktio');
        if (error) return { ok: false, error: error };
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe' } }; }
  }
```

**HUOM 1 — `currentPlayerId()`:** db.js ei tällä hetkellä tiedä kirjautuneen pelaajan
id:tä. Lisää apufunktio `ensureLiveSession`-funktion viereen:
```js
  // Kirjautuneen käyttäjän pelaajarivin id. Välimuistitetaan — ei kysytä joka viestillä.
  let cachedPlayerId = null;
  async function currentPlayerId() {
    if (cachedPlayerId) return cachedPlayerId;
    if (!client || !client.auth) return null;
    try {
      const { data } = await withTimeout(client.auth.getSession(), 'Istunnon luku');
      const uid = data && data.session && data.session.user && data.session.user.id;
      if (!uid) return null;
      const { data: rows } = await client.from('players').select('id').eq('auth_id', uid).maybeSingle();
      cachedPlayerId = rows ? rows.id : null;
      return cachedPlayerId;
    } catch (e) { return null; }
  }
```
Testissä tämä palauttaa `null` (fake-clientin `select` ei tue `.eq().maybeSingle()`) —
siksi testin `toggleReaction`-kutsut antavat `myPid`-parametrin eksplisiittisesti, ja
`sendChatMessage`-testi tarvitsee fake-clientiin `eq/maybeSingle`-tuen. **Lisää fake-
clientiin** `select()`-palautukseen: `eq() { return { maybeSingle: () => Promise.resolve({ data: { id: '__me__' } }) }; }`

**HUOM 2 — latausjärjestys:** `db.js` ladataan HTML:ssä ENNEN `data.jsx`:ää (rivit 26 ja 35).
`validateChatMessage` ei siis ole määritelty db.js:n suoritushetkellä — mutta koska sitä
kutsutaan vasta funktion sisällä ajonaikana (ei moduulitasolla), se on siihen mennessä
saatavilla globaalina. Testissä `load('db.js')` ei lataa data.jsx:ää, joten testin
sandboxiin on lisättävä `validateChatMessage`-tynkä TAI validointi on toistettava db.js:ssä.
**Valitse:** toista minimivalidointi db.js:ssä (`const t=(body||'').trim(); if(!t||body.length>1000) return {...}`)
— välttää piilotetun globaaliriippuvuuden ja pitää db.js:n itsenäisesti testattavana.

Lisää exporttiin (`window.DB = {` -lohkoon, `subscribeDeals`-rivin lähelle):
```js
    fetchAllChatMessages, fetchAllChatReactions, sendChatMessage, deleteChatMessage,
    toggleReaction, subscribeChat,
```

- [ ] **Step 4: Kytke realtime `init()`-funktioon**

`init()`:ssä `const refreshDeals = debounced(...)` -rivin JÄLKEEN:
```js
      const refreshChat = debounced(function () { notifyChat(); }, REFRESH_MS);
```
ja `.channel('public:deals')`-lohkon jälkeen:
```js
      client
        .channel('public:chat')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, refreshChat)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, refreshChat)
        .subscribe();
```

- [ ] **Step 5: Aja testit → PASS**

Run: `node tests/db-chat.test.js`
Expected: kaikki `✓`

- [ ] **Step 6: Aja koko sarja + commit**

```bash
for f in tests/*.test.js; do node "$f" 2>&1 | grep "✗"; done
git add db.js tests/db-chat.test.js && git commit -m "feat(chat): db.js-API — haku, lähetys, poisto, reaktiot, realtime"
```

---

## Task 4: app.jsx — TeamChat-komponentti

**Files:**
- Modify: `app.jsx` (komponentti ennen `function App()`; tila+kytkentä `DB.init`-efektiin n. rivi 2325–2412; renderöinti kahteen `.side`-lohkoon: admin n. rivi 2986, julkinen n. rivi 3058)

- [ ] **Step 1: Lisää tila ja datan kytkentä**

`App()`-komponentin tiloihin (muiden `useState`-rivien viereen):
```js
  const [chatMessages, setChatMessages] = useState([]);
  const [chatReactions, setChatReactions] = useState([]);
```

`DB.init()`-efektissä, `unsubDeals = DB.subscribeDeals(...)` -lohkon JÄLKEEN:
```js
      const loadChat = async () => {
        const [msgs, rcts] = await Promise.all([DB.fetchAllChatMessages(), DB.fetchAllChatReactions()]);
        setChatMessages(msgs);
        setChatReactions(rcts);
      };
      await loadChat();
      unsubChat = DB.subscribeChat(loadChat);
```
Lisää `unsubChat` efektin muuttujaluetteloon (`let unsubP, unsubPO, ... unsubChat;`) ja
siivousfunktioon (`if (unsubChat) unsubChat();`).

- [ ] **Step 2: Lisää TeamChat-komponentti**

Sijoita `function App()` -määrittelyn ETEEN:

```jsx
function TeamChat({ messages, reactions, deals, playersMap, myKey, isAdmin, onSend, onDelete, onReact }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const listRef = useRef(null);
  const pinnedRef = useRef(true); // seurataanko automaattisesti alas

  // Uusin alimpana: haku palauttaa uusin-ensin, joten käännetään
  const rows = [...(messages || [])].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at));

  useEffect(() => {
    const el = listRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    // "Kiinni pohjassa" jos käyttäjä on ~40px päässä alareunasta
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const submit = async () => {
    if (busy) return;
    const v = validateChatMessage(draft);
    if (!v.ok) { setErr(v.error); return; }
    setBusy(true); setErr(null);
    let res;
    try { res = await onSend(v.body); }
    catch (e) { res = { ok: false, error: { message: (e && e.message) || 'Virhe' } }; }
    finally { setBusy(false); }
    if (res && res.ok === false) setErr((res.error && res.error.message) || 'Viestin lähetys epäonnistui.');
    else setDraft('');
  };

  const hhmm = (ts) => {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  return (
    <div className="chat-card">
      <div className="chat-head">💬 TIIMICHAT</div>
      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {rows.length === 0 && <div className="chat-empty">Ei viestejä vielä. Aloita keskustelu!</div>}
        {rows.map((m) => {
          const isDeal = m.kind === 'deal';
          const nick = (playersMap && playersMap[m.player_id] && playersMap[m.player_id].nick) || m.player_id;
          const groups = groupReactions(reactions, m.id, myKey);
          return (
            <div key={m.id} className={cls('chat-msg', isDeal && 'chat-deal')}>
              <div className="chat-msg-head">
                <span className="chat-nick">{isDeal ? '🎉' : nick}</span>
                <span className="chat-time">{hhmm(m.created_at)}</span>
                {isAdmin && (
                  <button className="chat-del" title="Poista viesti" onClick={() => onDelete(m.id)}>✕</button>
                )}
              </div>
              <div className="chat-body">
                {isDeal ? formatDealMessage(m, deals, playersMap) : m.body}
              </div>
              <div className="chat-reactions">
                {CHAT_REACTIONS.map((e) => {
                  const g = groups.find((x) => x.emoji === e);
                  return (
                    <button
                      key={e}
                      className={cls('chat-react', g && g.mine && 'mine', g && 'has')}
                      onClick={() => onReact(m.id, e)}
                    >
                      {e}{g ? ' ' + g.count : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {err && <div className="deal-error" role="alert">⚠️ {err}</div>}
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={2}
          maxLength={CHAT_MAX_LEN}
          placeholder="Kirjoita viesti…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="chat-send" disabled={busy || !draft.trim()} onClick={submit}>
          {busy ? '…' : 'Lähetä'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Renderöi molempiin sivupalkkeihin**

**Admin-haara** (n. rivi 2986, `<div className="side">` jossa `<H2HCard stand={h2hStand} />`):
lisää `{t.showPodium && <Podium .../>}` -rivin JÄLKEEN:
```jsx
            <TeamChat
              messages={chatMessages} reactions={chatReactions}
              deals={deals} playersMap={playersMap} myKey={currentKey} isAdmin
              onSend={handleSendChat} onDelete={handleDeleteChat} onReact={handleReact}
            />
```

**Julkinen haara** (n. rivi 3058, sama rakenne): sama lohko ilman `isAdmin`-lippua.

- [ ] **Step 4: Lisää käsittelijät App()-komponenttiin**

`handleAddDeal`-käsittelijän viereen:
```js
  const handleSendChat = useCallback(async (body) => {
    return DB.sendChatMessage(body);
  }, []);

  const handleDeleteChat = useCallback(async (id) => {
    const res = await DB.deleteChatMessage(id);
    if (res && res.ok === false) setSaveError((res.error && res.error.message) || 'Viestin poisto epäonnistui.');
  }, []);

  const handleReact = useCallback(async (messageId, emoji) => {
    const res = await DB.toggleReaction(messageId, emoji, chatReactions, currentKey);
    if (res && res.ok === false) setSaveError((res.error && res.error.message) || 'Reaktio ei tallentunut.');
  }, [chatReactions, currentKey]);
```

- [ ] **Step 5: Commit**

```bash
git add app.jsx && git commit -m "feat(chat): TeamChat-komponentti sivupalkkiin"
```

---

## Task 5: styles.css

**Files:**
- Modify: `styles.css` (lisäys tiedoston loppuun)

- [ ] **Step 1: Lisää tyylit**

```css

/* ── Tiimichat (osaprojekti E) ─────────────────────────────────────────────── */
.chat-card { background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; margin-top: 14px; display: flex; flex-direction: column; }
.chat-head { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); padding: 10px 12px; border-bottom: 1px solid var(--line); }
.chat-list { height: 340px; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.chat-empty { color: var(--ink-4); font-size: 13px; text-align: center; padding: 20px 0; }
.chat-msg { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px; }
.chat-msg.chat-deal { background: #fff6e0; border-color: #d79a1e; }
.chat-msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.chat-nick { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 12px; letter-spacing: .04em; color: var(--ink); }
.chat-time { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-4); }
.chat-del { margin-left: auto; background: none; border: none; color: var(--ink-4); cursor: pointer; font-size: 12px; padding: 0 3px; }
.chat-del:hover { color: #c0392b; }
.chat-body { font-size: 13.5px; line-height: 1.45; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
.chat-reactions { display: flex; gap: 4px; margin-top: 5px; flex-wrap: wrap; }
.chat-react { background: transparent; border: 1px solid transparent; border-radius: 10px; padding: 1px 6px; font-size: 12px; cursor: pointer; opacity: .45; line-height: 1.6; }
.chat-react:hover { opacity: 1; background: var(--bg-3); }
.chat-react.has { opacity: 1; background: var(--bg-3); border-color: var(--line); }
.chat-react.mine { background: var(--accent); border-color: var(--accent); color: #fff; }
.chat-input-row { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--line); }
.chat-input { flex: 1; resize: none; font-family: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--ink); }
.chat-send { flex: none; padding: 6px 12px; background: var(--accent); color: #fff; border: none; border-radius: 4px; font-weight: 700; font-size: 13px; cursor: pointer; }
.chat-send:disabled { opacity: .45; cursor: default; }
@media (max-width: 680px) { .chat-list { height: 260px; } }
```

- [ ] **Step 2: Commit**

```bash
git add styles.css && git commit -m "style(chat): tiimichatin tyylit"
```

---

## Task 6: Selainverifiointi ja julkaisu

- [ ] **Step 1: Nosta versio ja rakenna esikatselu**

```bash
python -c "
import io,datetime,re
V=datetime.datetime.now().strftime('%Y%m%d-%H%M')
p='Buukkauskisa.html'; s=io.open(p,encoding='utf-8').read()
s=re.sub(r'window\.APP_VERSION = \"[^\"]*\"','window.APP_VERSION = \"%s\"'%V,s)
s=re.sub(r'\?v=\d{8}-\d{4}','?v=%s'%V,s)
io.open(p,'w',encoding='utf-8',newline='').write(s); print(V)"
sed -e 's#<script src="config.js?v=[^"]*"></script>#<script>window.SUPABASE_CONFIG={url:"PASTE",anonKey:"PASTE"};</script>#' Buukkauskisa.html > _local-preview.html
```

- [ ] **Step 2: Verifioi dev-local-selaimessa**

Käynnistä esikatselu ja tarkista:
1. Chat-kortti näkyy sivupalkissa, ei konsolivirheitä
2. Viestin lähetys: kirjoita → Enter → viesti ilmestyy listaan
3. Tyhjä viesti: lähetysnappi on disabloitu
4. Reaktio: klikkaa 🔥 → korostuu ja laskuri 1; klikkaa uudelleen → poistuu
5. Vieritys: uusin viesti alimpana

- [ ] **Step 3: Tarkista mobiilinäkymä**

Aseta 375 px leveys, varmista ettei vaakavieritystä synny ja että chat-kortti asettuu
sisällön alle.

- [ ] **Step 4: Aja koko testisarja**

```bash
for f in tests/*.test.js; do node "$f" 2>&1 | grep "✗"; done
```
Expected: ei tulostetta.

- [ ] **Step 5: Push ja tuotantoverifiointi**

```bash
git push origin master
```
Odota Vercel-deploy, lataa tuotanto, tarkista versionumero footerista ja ettei
konsolivirheitä ole. Kirjaa yksi testikauppa ja varmista että se ilmestyy chatiin
automaattisesti kauppailmoituksena.

---

## Riskit ja huomiot

| Riski | Torjunta |
|---|---|
| Migraatio ajamatta ennen pushia → sovellus kaatuu | Task 1 ennen Task 6:n pushia; `fetchAllChatMessages` palauttaa `[]` virheessä eikä kaada UI:ta |
| `ON DELETE CASCADE` puuttuu → kaupan poisto rikkoutuu | Task 1 Step 3 testaa tämän eksplisiittisesti rollback-transaktiossa |
| `currentPlayerId()` palauttaa `null` → viesti ei lähde | Palauttaa selkeän virheen käyttäjälle, ei hiljaista epäonnistumista |
| Reaktiotaulun kasvu | `limit(1000)` haussa; 17 pelaajaa × 200 viestiä on kaukana rajasta |
| Chat täyttyy kauppailmoituksista | Vain kaupat (ei buukkeja) — n. 1–3 kauppaa/päivä |
