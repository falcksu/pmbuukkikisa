# Sales Dashboard 2.0 · Osaprojekti B: Käyttäjäkohtainen kirjautuminen (Supabase Auth + RLS)

**Päivämäärä:** 2026-06-23
**Tila:** Suunnittelu hyväksytty, valmis spec-reviewiin
**Osaprojekti:** B / (A–D). Kattaa VAIN autentikoinnin ja pääsynhallinnan.

---

## 1. Tausta ja tavoite

Nykyinen kirjautuminen on turvaton: yksi jaettu salasana (**VENI**) avaa koko sovelluksen,
ja sen jälkeen kuka tahansa voi "kirjautua" pelkällä **nimellä + paikkakunnalla** kenä
tahansa pelaajana. Supabasea käytetään julkisella **anon-avaimella** ja RLS on käytännössä
auki. Koska kannassa on nyt arkaa kauppadataa (eurot, Megis-volyymit), tarvitaan aito
käyttäjäkohtainen autentikointi.

### Tavoite (success criteria)
- Jokainen käyttäjä kirjautuu omalla **sähköpostilla + salasanalla** (Supabase Auth).
- Dataa pääsee lukemaan/kirjoittamaan vain kirjautunut, **palvelinpuolen RLS** pakottaa pääsyn — julkinen anon-avain ei riitä datan lukemiseen.
- Käyttäjä voi rekisteröityessään joko **luoda uuden pelaajan** tai **linkittää olemassa olevan pelaajansa** (ja sen historian) sähköpostitiliinsä.
- VENI-portti ja nimi+paikkakunta-kirjautuminen poistuvat.

### Päätetyt valinnat (brainstorm 2026-06-23)
- Turvataso: **oikea autentikointi** (Supabase Auth + RLS), ei kevyt client-tarkistus.
- Kirjautumistapa: **sähköposti + salasana**.
- Tilien luonti: **itse-rekisteröinti kutsukoodilla**.
- Näkyvyys: **täysi läpinäkyvyys** — kaikki kirjautuneet näkevät kaikkien tilastot ja kaupat.

---

## 2. Turvamalli (keskeinen)

**Ongelma:** Supabasen julkinen `signUp` on avoin anon-avaimella. Pelkkä selaimessa
tarkistettu kutsukoodi ei suojaa lukua: kuka tahansa voisi kutsua `signUp`:ia suoraan,
saada autentikoidun session ja — jos luku olisi sallittu pelkälle "authenticated"-roolille —
lukea kaikkien eurot.

**Ratkaisu (pysyy selain + Postgres -mallissa, ei Edge Functionia, ei build-vaihetta):**

1. **Lukuoikeus vaatii linkitetyn pelaajarivin.** RLS-politiikat sallivat luvun vain, jos
   käyttäjällä on `players`-rivi, jossa `auth_id = auth.uid()`. Pelkkä autentikoitu "tyhjä"
   tili (ilman pelaajariviä) ei näe mitään.
2. **Pelaajarivin luonti/linkitys on portitettu** Postgres-funktiolla (SECURITY DEFINER),
   joka validoi kutsukoodin **palvelinpuolella**. Suora `INSERT players` estetään RLS:llä.
   → kutsukoodi on aito palvelinpuolen portti.

Näin rogue-signup ilman kelvollista kutsukoodia ei saa pelaajariviä eikä siten lukuoikeutta.

> Anon-avain pysyy config.js:ssä (se on tarkoitettu julkiseksi). Turva tulee RLS:stä, ei
> avaimen piilottamisesta.

---

## 3. Datamalli

### 3.1 `players` — uudet sarakkeet
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_id  uuid;        -- linkki auth.users.id
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
-- (valinnainen) yksilöivä indeksi, ettei sama auth_id linkity kahteen pelaajaan:
CREATE UNIQUE INDEX IF NOT EXISTS players_auth_id_uniq ON players(auth_id) WHERE auth_id IS NOT NULL;
```
- `players.id` säilyy `nick:city`-sluginä (näyttönimi). Kanoninen omistaja = `auth_id`.

### 3.2 `app_config` — kutsukoodi ym. (ei luettavissa clientille)
```sql
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
-- esim. INSERT INTO app_config(key,value) VALUES ('invite_code','<koodi>');
-- RLS: ei SELECT-politiikkaa → client ei voi lukea. Vain SECURITY DEFINER -funktio lukee.
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
```

### 3.3 Portitetut RPC-funktiot (SECURITY DEFINER)

**`register_player(p_nick text, p_city text, p_code text)`** — luo UUDEN pelaajan:
- Validoi `p_code` `app_config.invite_code`:a vasten; väärä → virhe.
- Laskee slugin (`lower(nick):lower(city)`).
- Jos slug on jo olemassa → virhe ("nimi varattu, käytä linkitystä").
- Luo `players`-rivin: id=slug, nick, city, init, auth_id=auth.uid(), nollatilastot.
- Vaatii `auth.uid()` (kirjautunut).

**`link_existing_player(p_player_id text, p_code text)`** — linkittää OLEMASSA olevan pelaajan:
- Validoi `p_code`.
- Hakee `players`-rivin `p_player_id`:llä; jos `auth_id` on jo asetettu (ja ≠ auth.uid()) → virhe ("jo linkitetty").
- Asettaa `auth_id = auth.uid()` (claim). Vaatii `auth.uid()`.

> Molemmat funktiot tarkistavat, ettei käyttäjällä ole jo linkitettyä pelaajaa
> (`auth_id`-uniikkius), jotta yksi tili = yksi pelaaja.

---

## 4. Rekisteröinti-, linkitys- ja kirjautumisvirrat

### 4.1 Rekisteröinti (AuthScreen → "Rekisteröidy")
1. Käyttäjä syöttää sähköpostin + salasanan + kutsukoodin.
2. `supabase.auth.signUp({ email, password })` → luo auth-käyttäjän + session.
3. Käyttäjä valitsee:
   - **Luo uusi pelaaja:** syöttää nick + city → `rpc('register_player', {nick, city, code})`.
   - **Linkitä olemassa oleva pelaaja:** valitsee listasta linkittämättömän pelaajan
     (auth_id null) → `rpc('link_existing_player', {player_id, code})`.
4. Onnistuessa sessio + linkitetty pelaaja → sovellus latautuu.

> Linkitettävien pelaajien lista: kirjautuneelle näytetään `players`-rivit joilla `auth_id IS NULL`
> (vain nick + city, ei muuta). Tämä mahdollistaa vanhan datan claimin sivustolla.

### 4.2 Sähköpostivahvistus
Sisäinen työkalu → Supabasessa **email confirmation pois päältä** (käyttäjä pääsee heti
sisään). Jos halutaan myöhemmin päälle, se on Supabase-asetus.

### 4.3 Kirjautuminen / ulos / sessio
- `supabase.auth.signInWithPassword({ email, password })`.
- `supabase.auth.signOut()`.
- Sessio säilyy supabase-js:n omassa tallennuksessa (localStorage), `onAuthStateChange`
  kuuntelee. Sovellus näyttää AuthScreenin kun ei sessiota, datan kun sessio + linkitetty pelaaja.

---

## 5. RLS-politiikat

Yhteinen apufunktio luettavuuden vuoksi:
```sql
-- Onko nykyisellä käyttäjällä linkitetty pelaaja?
CREATE OR REPLACE FUNCTION has_linked_player() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE auth_id = auth.uid());
$$;
-- Onko nykyinen käyttäjä admin?
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE auth_id = auth.uid() AND is_admin);
$$;
-- Omistaako käyttäjä player_id-slugin?
CREATE OR REPLACE FUNCTION owns_player(pid text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM players WHERE id = pid AND auth_id = auth.uid());
$$;
```

| Taulu | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `players` | `has_linked_player()` | UPDATE: `owns_player(id)` tai `is_admin()`. Suora INSERT: **estetty** (vain RPC). DELETE: `is_admin()`. |
| `daily_stats` | `has_linked_player()` | `owns_player(player_id)` tai `is_admin()` |
| `deals` | `has_linked_player()` | `owns_player(player_id)` tai `is_admin()` |
| `meta` | `has_linked_player()` | vain `is_admin()` |

- anon-roolilla ei mitään politiikkaa → ei pääsyä.
- Realtime kunnioittaa RLS:ää; client asettaa session tokenin (supabase-js hoitaa).

---

## 6. Client-muutokset

### 6.1 `db.js`
- Lisätään auth-API: `signUp`, `signIn`, `signOut`, `getSession`, `onAuthStateChange`,
  `registerPlayer(nick, city, code)` (rpc), `linkExistingPlayer(playerId, code)` (rpc),
  `fetchUnlinkedPlayers()` (SELECT players WHERE auth_id IS NULL — sallittu kirjautuneelle).
- `init()` ajetaan vasta kun sessio on olemassa; muuten palautetaan tyhjä.
- localStorage-fallback: **dev-only** tila ilman Supabasea ei tue oikeaa authia
  (kehitysapu; ei tuotannossa). Dokumentoidaan.

### 6.2 `app.jsx`
- **Poistetaan** `PasswordGate` (VENI) ja nimi+paikkakunta-`LoginScreen`-kirjautuminen.
- **Uusi `AuthScreen`**: välilehdet "Kirjaudu" / "Rekisteröidy".
  - Kirjaudu: email + salasana.
  - Rekisteröidy: email + salasana + kutsukoodi + valinta (luo uusi: nick/city | linkitä olemassa oleva: lista).
- Sovelluksen porttilogiikka: `session?` → ei: AuthScreen; on, mutta ei linkitettyä pelaajaa: linkitys/luonti-näkymä; on + pelaaja: normaali sovellus.
- `currentKey` = linkitetyn pelaajan slug (auth-käyttäjältä, ei localStoragesta).
- Admin: `me.is_admin` (ei enää kovakoodattu Admin/Tampere `isAdminCreds`/`ADMIN_KEY`).
  > `ADMIN_KEY`-pohjainen suodatus (excludedKeys, sortedPublic) korvataan: admin on
  > normaali pelaaja jolla `is_admin=true`; hänet voidaan piilottaa leaderboardilta
  > `is_admin`-lipun perusteella (säilytetään nykyinen "admin ei näy kisassa" -käytös).
- `handleLogout` → `signOut()`.

---

## 7. Mitä käyttäjä tekee Supabasessa (kerran)

1. **Auth → Providers:** ota Email käyttöön, kytke "Confirm email" pois (sisäinen työkalu).
2. **Aja SQL** (annetaan toteutusvaiheessa): sarakkeet (3.1), `app_config` (3.2), RPC-funktiot
   (3.3), apufunktiot + RLS-politiikat (5).
3. **Aseta kutsukoodi:** `INSERT INTO app_config(key,value) VALUES ('invite_code','<koodi>');`
4. **Admin-bootstrap:** admin rekisteröityy normaalisti, sitten kerran käsin:
   `UPDATE players SET is_admin=true WHERE id='<admin-slug>';`

> Järjestys tuotantoon: aja SQL + auth-asetukset **ennen** uuden clientin deployta, koska
> uusi client vaatii authin eikä vanha anon-luku enää toimi RLS:n alla.

---

## 8. Olemassa olevan datan claim + tunnetut rajoitteet

- Vanhat pelaajat (nick:city, auth_id null) näkyvät linkityslistassa ja voidaan claimata
  rekisteröityessä → historia (daily_stats, deals) säilyy, koska ne viittaavat slugiin.
- **Tunnettu rajoite (impersonointi):** kutsukoodin omaava käyttäjä voi periaatteessa claimata
  toisen vanhan, vielä linkittämättömän pelaajan. Hyväksytään sisäisen tiimin + kutsukoodin
  kontekstissa. Suojakeino: admin voi korjata väärän linkityksen Supabasessa
  (`UPDATE players SET auth_id=NULL WHERE id=...`). Vaihtoehto myöhemmin: admin-hyväksyntä linkitykselle.

---

## 9. Testaus

Projektissa ei ole testikehystä; käytetään olemassa olevaa riippuvuudetonta Node-apuria.
- **Node-testit:** puhdas client-logiikka, esim. slug-laskenta, AuthScreenin syöte-validointi
  (email/salasana/koodi täytetty), porttilogiikan tilakoneen päättely (session/linked → näkymä).
- **Manuaalinen verifiointi (oikeaa Supabasea vasten):** rekisteröinti kutsukoodilla, väärä koodi
  → esto, uuden pelaajan luonti, olemassa olevan linkitys, kirjautuminen/ulos, RLS:
  toinen käyttäjä ei voi kirjoittaa toisen rivejä, anon ei lue mitään, admin kirjoittaa metaan.
- localStorage-dev-tila ei kata authia (dokumentoitu rajoite).

---

## 10. Rajaus (out of scope tässä osaprojektissa)

| Aihe | Minne |
|---|---|
| Aikajaksosuodatus, kuukausittaiset sarjataulukot, kausihistoria | C |
| Tiimitavoitteet, badget, H2H, Hall of Fame | D |
| Salasanan palautus -UI (Supabasen oma flow riittää alkuun) | Myöhemmin |
| Admin-hyväksyntä pelaajan linkitykselle | Myöhemmin (jos tarve) |
| Roolit admin/peruskäyttäjää hienojakoisemmin | Myöhemmin |
