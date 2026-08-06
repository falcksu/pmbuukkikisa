# Käyttäjäkohtainen kirjautuminen (Supabase Auth + RLS) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Korvaa jaettu VENI-portti + nimi-kirjautuminen oikealla Supabase Auth -autentikoinnilla (email+salasana), RLS pakottaa pääsyn palvelinpuolella, ja käyttäjä voi rekisteröityessään luoda uuden pelaajan tai linkittää olemassa olevan.

**Architecture:** Supabase Auth (anon-avain pysyy julkisena, turva RLS:stä). Luku vaatii linkitetyn pelaajarivin; pelaajarivin luonti/linkitys portitettu SECURITY DEFINER -RPC:llä joka validoi kutsukoodin. Client saa kaksi tilaa: **tuotanto** (Supabase → oikea auth) ja **dev-local** (ei Supabasea → yksinkertainen nimi-kirjautuminen, EI turvattu, vain kehitys/verifiointi).

**Tech Stack:** React 18 UMD/CDN + Babel standalone (ei buildia), supabase-js UMD (auth + rpc), Supabase Postgres RLS. Testaus: riippuvuudeton Node vm-sandbox (`tests/_harness.js`); auth/RLS manuaalisesti oikeaa Supabasea vasten.

**Spec:** `docs/superpowers/specs/2026-06-23-buukkikisa-auth-supabase-rls-design.md`

---

## Verifiointistrategia

- **Puhdas logiikka** (data.jsx: slug, validointi, gate-tilakone) → Node-testit.
- **db.js auth-API muoto + local-fallback** → Node-smoke.
- **UI + oikea auth/RLS** → auth-flow vaatii oikean Supabasen setupin (Task 1). Paikallisesti
  verifioidaan **dev-local-tila** (nimi-kirjautuminen) selaimessa: sovellus renderöityy,
  kaupat/tilastot toimivat kuten ennen. Tuotannon auth-flow verifioidaan käyttäjän Supabasea
  vasten setupin ajon jälkeen (manuaalinen checklist Task 8).

---

## Tiedostorakenne

| Tiedosto | Muutos |
|---|---|
| **Supabase (manuaali, Task 1)** | Sarakkeet, app_config, RPC:t, helper-funktiot, RLS-politiikat |
| `data.jsx` | `resolveAuthGate(session, linkedPlayer)`, `validateEmail`, `validateRegForm`; export |
| `db.js` | `hasAuth`, auth-API (signUp/signIn/signOut/getSession/onAuthChange), RPC-wrapperit, `fetchMyPlayer` |
| `app.jsx` | Sessio/linkedPlayer-tila, gate-render, `AuthScreen` (tuotanto), dev-local-login säilyy, admin `is_admin`-pohjaiseksi, logout `signOut` |
| `styles.css` | AuthScreen-tyylit |
| `tests/auth-logic.test.js` | data.jsx auth-logiikan testit |

---

## Task 1: Supabase-setup SQL (KÄYTTÄJÄ ajaa ENNEN deployta)

> Kriittinen. Tuotannon uusi client EI toimi ilman tätä. Aja Supabasen SQL-editorissa.
> **Sisältää myös osaprojekti A:n migraation** (jos ei vielä ajettu).

- [ ] **Step 1: Ota Email-auth käyttöön** — Supabase → Authentication → Providers → Email:
  Enable. Kytke "Confirm email" **pois** (sisäinen työkalu).

- [ ] **Step 2: Aja SQL**

```sql
-- ===== A-migraatio (jos ei ajettu) =====
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS tapaamiset int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS deals (
  id text PRIMARY KEY, player_id text NOT NULL, date_key date NOT NULL,
  toimiala text, megis numeric NOT NULL DEFAULT 0, eurot numeric NOT NULL DEFAULT 0,
  first_meeting_date date, signed_date date, meeting_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== B: sarakkeet =====
ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_id  uuid;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS players_auth_id_uniq ON players(auth_id) WHERE auth_id IS NOT NULL;

-- ===== app_config (kutsukoodi) — RLS päällä, ei policyja => vain DEFINER-funktiot lukevat =====
CREATE TABLE IF NOT EXISTS app_config ( key text PRIMARY KEY, value text NOT NULL );
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- ===== helper-funktiot (SECURITY DEFINER, search_path pinnattu) =====
CREATE OR REPLACE FUNCTION has_linked_player() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE auth_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE auth_id = auth.uid() AND is_admin); $$;
CREATE OR REPLACE FUNCTION owns_player(pid text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE id = pid AND auth_id = auth.uid()); $$;

-- ===== RPC: rekisteröi uusi pelaaja =====
CREATE OR REPLACE FUNCTION register_player(p_nick text, p_city text, p_code text)
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_code text; v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT value INTO v_code FROM app_config WHERE key='invite_code';
  IF v_code IS NULL OR p_code IS DISTINCT FROM v_code THEN RAISE EXCEPTION 'invalid invite code'; END IF;
  IF EXISTS (SELECT 1 FROM players WHERE auth_id=v_uid) THEN RAISE EXCEPTION 'account already has a player'; END IF;
  v_slug := lower(trim(p_nick)) || ':' || lower(trim(p_city));
  IF EXISTS (SELECT 1 FROM players WHERE id=v_slug) THEN RAISE EXCEPTION 'name taken, use linking'; END IF;
  INSERT INTO players (id, nick, city, init, auth_id, luurit, vastatut, buukit, tapaamiset)
    VALUES (v_slug, upper(trim(p_nick)), trim(p_city), upper(left(trim(p_nick),2)), v_uid, 0,0,0,0);
  RETURN v_slug;
END; $$;

-- ===== RPC: linkitä olemassa oleva pelaaja =====
CREATE OR REPLACE FUNCTION link_existing_player(p_player_id text, p_code text)
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_code text; v_existing uuid; v_found boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT value INTO v_code FROM app_config WHERE key='invite_code';
  IF v_code IS NULL OR p_code IS DISTINCT FROM v_code THEN RAISE EXCEPTION 'invalid invite code'; END IF;
  IF EXISTS (SELECT 1 FROM players WHERE auth_id=v_uid) THEN RAISE EXCEPTION 'account already has a player'; END IF;
  SELECT auth_id, true INTO v_existing, v_found FROM players WHERE id=p_player_id;
  IF NOT v_found THEN RAISE EXCEPTION 'player not found'; END IF;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'player already linked'; END IF;
  UPDATE players SET auth_id=v_uid WHERE id=p_player_id;
  RETURN p_player_id;
END; $$;

-- ===== RPC: listaa linkittämättömät pelaajat (luku-RLS estäisi suoran SELECTin) =====
CREATE OR REPLACE FUNCTION list_unlinked_players()
  RETURNS TABLE(id text, nick text, city text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id, nick, city FROM players WHERE auth_id IS NULL ORDER BY nick; $$;

GRANT EXECUTE ON FUNCTION register_player(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION link_existing_player(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION list_unlinked_players() TO authenticated;

-- ===== RLS päälle + politiikat =====
ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS players_select ON players;
CREATE POLICY players_select ON players FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS players_update ON players;
CREATE POLICY players_update ON players FOR UPDATE USING (owns_player(id) OR is_admin()) WITH CHECK (owns_player(id) OR is_admin());
DROP POLICY IF EXISTS players_delete ON players;
CREATE POLICY players_delete ON players FOR DELETE USING (is_admin());
-- ei INSERT-policyä => suora insert estetty, vain RPC (DEFINER) lisää

DROP POLICY IF EXISTS ds_select ON daily_stats;
CREATE POLICY ds_select ON daily_stats FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS ds_write ON daily_stats;
CREATE POLICY ds_write ON daily_stats FOR ALL USING (owns_player(player_id) OR is_admin()) WITH CHECK (owns_player(player_id) OR is_admin());

DROP POLICY IF EXISTS deals_select ON deals;
CREATE POLICY deals_select ON deals FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS deals_write ON deals;
CREATE POLICY deals_write ON deals FOR ALL USING (owns_player(player_id) OR is_admin()) WITH CHECK (owns_player(player_id) OR is_admin());

DROP POLICY IF EXISTS meta_select ON meta;
CREATE POLICY meta_select ON meta FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS meta_write ON meta;
CREATE POLICY meta_write ON meta FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== kutsukoodi (VAIHDA arvo) =====
INSERT INTO app_config(key,value) VALUES ('invite_code','VAIHDA_TAMA')
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
```

- [ ] **Step 3: Admin-bootstrap** — admin rekisteröityy sovelluksessa normaalisti, sitten kerran:
  `UPDATE players SET is_admin=true WHERE id='<admin-slug>';`

---

## Task 2: data.jsx — puhdas auth-logiikka

**Files:** Modify `data.jsx`; Create `tests/auth-logic.test.js`

- [ ] **Step 1: Testi** (`tests/auth-logic.test.js`)
```js
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;
assert(w.resolveAuthGate(null, null) === 'auth', 'ei sessiota → auth');
assert(w.resolveAuthGate({user:{id:'x'}}, null) === 'link', 'sessio, ei pelaajaa → link');
assert(w.resolveAuthGate({user:{id:'x'}}, {id:'a:b'}) === 'app', 'sessio + pelaaja → app');
assert(w.validateEmail('a@b.co') === true, 'kelpo email');
assert(w.validateEmail('roska') === false, 'kelvoton email');
const r = w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'new', nick:'Aa', city:'Bb' });
assert(r.ok === true, 'kelpo uusi-rekisteröinti');
assert(w.validateRegForm({ email:'a@b.co', password:'123', code:'x', mode:'new', nick:'Aa', city:'Bb' }).ok === false, 'liian lyhyt salasana');
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'', mode:'new', nick:'Aa', city:'Bb' }).ok === false, 'puuttuva koodi');
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'link', playerId:'a:b' }).ok === true, 'kelpo linkitys');
assert(w.validateRegForm({ email:'a@b.co', password:'salasana1', code:'x', mode:'link', playerId:'' }).ok === false, 'linkitys ilman valintaa');
```

- [ ] **Step 2: Aja → FAIL.** Run: `node tests/auth-logic.test.js`

- [ ] **Step 3: Toteuta data.jsx:ään** (ennen `Object.assign(window,...)`)
```js
function resolveAuthGate(session, linkedPlayer) {
  if (!session) return 'auth';
  if (!linkedPlayer) return 'link';
  return 'app';
}
function validateEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v||'').trim()); }
function validateRegForm(f) {
  f = f || {};
  if (!validateEmail(f.email)) return { ok:false, error:'Virheellinen sähköposti' };
  if (!f.password || f.password.length < 8) return { ok:false, error:'Salasana väh. 8 merkkiä' };
  if (!f.code || !f.code.trim()) return { ok:false, error:'Kutsukoodi puuttuu' };
  if (f.mode === 'link') {
    if (!f.playerId) return { ok:false, error:'Valitse linkitettävä pelaaja' };
    return { ok:true };
  }
  if (!f.nick || f.nick.trim().length < 2) return { ok:false, error:'Nimi väh. 2 merkkiä' };
  if (!f.city || f.city.trim().length < 2) return { ok:false, error:'Paikkakunta väh. 2 merkkiä' };
  return { ok:true };
}
```
Vie: lisää `resolveAuthGate, validateEmail, validateRegForm,` window-listaan.

- [ ] **Step 4: Aja → PASS.** Run: `node tests/auth-logic.test.js`
- [ ] **Step 5: Commit** `feat(data): auth-gate tilakone + rekisteröinnin validointi`

---

## Task 3: db.js — auth-API + RPC-wrapperit

**Files:** Modify `db.js`

- [ ] **Step 1:** Lisää `hasAuth` (client && auth olemassa) `window.DB`-objektiin ja backend-logiikkaan:
  `hasAuth: !!(client && client.auth)`.

- [ ] **Step 2:** Lisää auth-metodit (client olemassa):
```js
  async function signUp(email, password) { return client.auth.signUp({ email, password }); }
  async function signIn(email, password) { return client.auth.signInWithPassword({ email, password }); }
  async function signOut() { return client.auth.signOut(); }
  async function getSession() { const { data } = await client.auth.getSession(); return data ? data.session : null; }
  function onAuthChange(cb) { const { data } = client.auth.onAuthStateChange((_e, s) => cb(s)); return () => data.subscription.unsubscribe(); }
  async function registerPlayer(nick, city, code) { return client.rpc('register_player', { p_nick: nick, p_city: city, p_code: code }); }
  async function linkExistingPlayer(playerId, code) { return client.rpc('link_existing_player', { p_player_id: playerId, p_code: code }); }
  async function fetchUnlinkedPlayers() { const { data, error } = await client.rpc('list_unlinked_players'); if (error) { console.error(error); return []; } return data || []; }
  async function fetchMyPlayer(authId) { const { data, error } = await client.from('players').select('*').eq('auth_id', authId).maybeSingle(); if (error) { console.error(error); return null; } return data ? rowToPlayer(data) : null; }
```
  Ei-client (local) -tilassa nämä palauttavat turvalliset oletukset (esim. `hasAuth=false`, muut ei-kutsuttuja).

- [ ] **Step 3:** `rowToPlayer`/`playerToRow`: lisää `is_admin` (ja säilytä auth_id kannassa):
  `rowToPlayer`: `is_admin: !!row.is_admin`. `playerToRow`: ÄLÄ ylikirjoita auth_id/is_admin
  (jätä pois playerToRow:sta, jotta upsert ei nollaa niitä — päivitä vain tunnetut tilastokentät).

- [ ] **Step 4:** Vie uudet funktiot `window.DB`-objektiin.

- [ ] **Step 5: Node-smoke** (laajenna olemassa olevaa tai uusi): local-tilassa `DB.hasAuth===false`.
  Run: `node -e "..."` tai osana db-testiä.

- [ ] **Step 6: Commit** `feat(db): Supabase auth-API + RPC-wrapperit + is_admin`

---

## Task 4: app.jsx — sessio/gate + tuotannon AuthScreen

**Files:** Modify `app.jsx`

- [ ] **Step 1:** Lisää tila: `session`, `linkedPlayer`, `authReady`. Poista `unlocked`/VENI-riippuvuus
  (PasswordGate poistetaan tuotantopolusta).

- [ ] **Step 2:** Käynnistys-effekti (kun `DB.hasAuth`):
  - `getSession()` → setSession; jos sessio, `fetchMyPlayer(session.user.id)` → setLinkedPlayer.
  - `onAuthChange(s => { setSession(s); if (s) fetchMyPlayer(s.user.id).then(setLinkedPlayer); else setLinkedPlayer(null); })`.
  - `setAuthReady(true)` alkukyselyn jälkeen.
  - Datan lataus (`DB.init()` + subscribet) ajetaan vasta kun `linkedPlayer` on olemassa.

- [ ] **Step 3:** Gate-render (kun `DB.hasAuth`):
  `resolveAuthGate(session, linkedPlayer)` → `'auth'` = `<AuthScreen>`, `'link'` = linkitys/luonti-näkymä
  (osa AuthScreeniä), `'app'` = normaali sovellus. `currentKey = linkedPlayer.id`.

- [ ] **Step 4:** `AuthScreen`-komponentti: välilehdet Kirjaudu / Rekisteröidy.
  - Kirjaudu: email + salasana → `DB.signIn`; virhe näkyviin.
  - Rekisteröidy: email + salasana + kutsukoodi + moodi (uusi: nick/city | linkitä: `fetchUnlinkedPlayers`-lista).
    `validateRegForm` ennen lähetystä; `DB.signUp` → sitten `registerPlayer` tai `linkExistingPlayer`;
    onnistuessa `fetchMyPlayer` → setLinkedPlayer.
  - "link"-tilassa (sessio ilman pelaajaa) näytetään suoraan luonti/linkitys-vaihe.

- [ ] **Step 5:** Dev-local-polku (kun `!DB.hasAuth`): säilytä nykyinen `LoginScreen` (nimi+city)
  ilman VENI-porttia — dev/verifiointi. Selkeä huomio ettei turvattu.

- [ ] **Step 6:** Manuaalinen verifiointi (dev-local selaimessa): sovellus latautuu, nimi-kirjautuminen
  toimii, kaupat/tilastot kuten ennen. (Tuotannon auth Task 8.)

- [ ] **Step 7: Commit** `feat(app): Supabase-sessio + gate + AuthScreen (tuotanto), dev-local säilyy`

---

## Task 5: app.jsx — admin is_admin-pohjaiseksi + logout

**Files:** Modify `app.jsx`

- [ ] **Step 1:** `isAdmin`-määrittely: tuotannossa `linkedPlayer?.is_admin === true`;
  dev-localissa säilytä `isAdminCreds`/`ADMIN_KEY`-polku. Yksi `isAdmin`-boolean ohjaa admin-UI:ta.
- [ ] **Step 2:** Korvaa `currentKey === ADMIN_KEY` -vartijat (performAction, handleAddDeal,
  handleDeleteDeal, handleSaveDay) → `isAdmin`-tarkistuksella ("admin ei kirjaa omia lukuja").
- [ ] **Step 3:** `sortedPublic`: sulje pois ADMIN_KEY (local) JA pelaajat joilla `is_admin`
  (tuotanto), plus excludedKeys.
- [ ] **Step 4:** `handleLogout` → tuotannossa `DB.signOut()`; dev-localissa entinen.
- [ ] **Step 5:** Manuaalinen verifiointi dev-localissa: admin-näkymä toimii, admin ei näy leaderboardilla.
- [ ] **Step 6: Commit** `feat(app): admin is_admin-lipusta + logout signOut`

---

## Task 6: styles.css — AuthScreen

**Files:** Modify `styles.css`

- [ ] **Step 1:** Lisää AuthScreen-tyylit (välilehdet, kentät, virheviesti, linkityslista) sovituen
  olemassa oleviin tokeneihin. Hyödynnä nykyisiä `.login-*`-tyylejä missä sopii.
- [ ] **Step 2: Commit** `style: AuthScreen-tyylit`

---

## Task 7: Loppuverifiointi (paikallinen)

- [ ] **Step 1:** `node tests/deals-logic.test.js && node tests/db-deals.test.js && node tests/auth-logic.test.js` → kaikki PASS.
- [ ] **Step 2:** Dev-local selaintesti: login, kaupat, tapaamiset, admin — toimivat.
- [ ] **Step 3:** Merge feature-haara masteriin paikallisesti (ei push).

---

## Task 8: Tuotannon käyttöönotto (KÄYTTÄJÄ + push)

> Push = deploy Verceliin. Tämä on rikkova muutos: **aja Task 1 (SQL + auth-asetukset) ENSIN.**

- [ ] **Step 1:** Käyttäjä ajaa Task 1:n (email-auth päälle, SQL, kutsukoodi).
- [ ] **Step 2:** Push masteriin (käyttäjän luvalla) → Vercel deploy.
- [ ] **Step 3:** Manuaalinen tuotanto-checklist:
  1. Rekisteröidy kutsukoodilla → uusi pelaaja; väärä koodi → esto.
  2. Toinen käyttäjä: linkitä olemassa oleva pelaaja → historia näkyy.
  3. Kirjaudu ulos / sisään; sessio säilyy reloadissa.
  4. Käyttäjä A ei voi muokata käyttäjä B:n kauppoja (RLS).
  5. Admin (is_admin) näkee/hallitsee; admin-bootstrap tehty.
  6. Kirjautumaton / anon ei näe dataa.

---

## Riippuvuudet

```
Task 1 (Supabase SQL — käyttäjä, ennen deployta)
Task 2 (data.jsx) → Task 3 (db.js) → Task 4 (app: gate+AuthScreen) → Task 5 (app: admin)
  → Task 6 (styles) → Task 7 (paikallinen verifiointi + merge) → Task 8 (setup + push + tuotantotesti)
```
