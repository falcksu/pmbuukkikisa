# Sales Dashboard 2.0 · Osaprojekti E: Tiimichat + kauppailmoitukset + reaktiot

**Päivämäärä:** 2026-08-25
**Tila:** Suunnittelu hyväksytty, valmis spec-reviewiin
**Osaprojekti:** E (uusi, A–D:n jälkeen). Kattaa VAIN tiimichatin — ei YouTube-voittolaulua (erillinen, myöhempi osaprojekti).

---

## 1. Tausta ja tavoite

Etusivun sivupalkissa (Top3/H2H-korttien alla) on käyttämätöntä tilaa. Kaupat näkyvät jo
ylälaidan vierivässä tikkerissä (`buildTickerFeed`), mutta se on lyhytikäinen eikä
pysyvä — eikä siihen voi reagoida tai kommentoida.

### Tavoite (success criteria)
- Tiimi voi kirjoittaa vapaita viestejä toisilleen samassa näkymässä missä tilastot ovat.
- Kaupat näkyvät chatissa automaattisena, juhlallisena ilmoituksena — **taattuna**, ei
  riippuvaisena siitä että kirjaajan selain ehtii lähettää mitään erikseen.
- Viesteihin (myös kauppailmoituksiin) voi reagoida nopealla emoji-napilla.
- Uudet viestit ja reaktiot näkyvät kaikille avoinna oleville näkymille reaaliajassa.
- Admin voi poistaa asiattoman viestin.

### Päätetyt valinnat (brainstorm 2026-08-25)
- Chat on **oikea vapaa chat** (ei pelkkä automaattinen tapahtumaloki).
- Automaattisista tapahtumista chatissa näkyvät **vain kaupat**, ei buukkeja (liikaa volyymia).
- Reaaliaikainen (Supabase Realtime, sama malli kuin muualla sovelluksessa).
- Admin voi poistaa minkä tahansa viestin. Ei viestin muokkausta kenellekään.
- Reaktiot: **kiinteä 5 emojin joukko** — 👍 🔥 🎉 💰 😂 — ei vapaata emoji-valitsinta.
- Yksi henkilö saa antaa useita eri emoji-reaktioita samaan viestiin, mutta vain yhden
  kutakin emojia (klikkaus uudelleen poistaa oman reaktion — toggle).
- **GIF:t rajattu pois tästä osaprojektista** (skipattu brainstormissa, voidaan lisätä
  myöhemmin omana osaprojektinaan).
- Ei emoji-valitsinta viestin kirjoitukseen — selaimen/käyttöjärjestelmän oma emoji-
  näppäimistö riittää (Win+. / Cmd+Ctrl+Space / mobiilin oma näppäimistö).

---

## 2. Datamalli

### 2.1 `chat_messages` — uusi taulu

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id         bigserial PRIMARY KEY,
  player_id  text        NOT NULL REFERENCES players(id),
  kind       text        NOT NULL DEFAULT 'user' CHECK (kind IN ('user','deal')),
  body       text,                          -- ihmisviestin teksti; NULL kind='deal'-riveillä
  deal_id    text        REFERENCES deals(id) ON DELETE CASCADE,  -- vain kind='deal'
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_body_or_deal CHECK (
    (kind = 'user' AND body IS NOT NULL AND length(trim(body)) > 0 AND length(body) <= 1000)
    OR
    (kind = 'deal' AND deal_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS chat_messages_created ON chat_messages (created_at DESC);
```

- `body`-pituus rajattu 1000 merkkiin sovellus- JA kantatasolla (CHECK).
- `kind='deal'`-rivit luodaan **vain** palvelinpuolen laukaisimella (ks. 2.3) — client ei
  saa koskaan insertoida `kind='deal'`-riviä itse (estetään RLS:n WITH CHECK -lausekkeella).

### 2.2 `chat_reactions` — uusi taulu

```sql
CREATE TABLE IF NOT EXISTS chat_reactions (
  id         bigserial PRIMARY KEY,
  message_id bigint      NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  player_id  text        NOT NULL REFERENCES players(id),
  emoji      text        NOT NULL CHECK (emoji IN ('👍','🔥','🎉','💰','😂')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, player_id, emoji)
);
CREATE INDEX IF NOT EXISTS chat_reactions_message ON chat_reactions (message_id);
```

- `UNIQUE (message_id, player_id, emoji)` estää saman reaktion kaksinkertaisen lisäyksen;
  poisto = oman rivin DELETE (toggle-käytös clientissä: jos oma reaktio on jo olemassa,
  klikkaus poistaa sen sen sijaan että lisäisi toisen).
- `ON DELETE CASCADE` viestin poistuessa (admin-poisto) reaktiot poistuvat automaattisesti.

### 2.3 Laukaisin: kauppa → chat-ilmoitus (palvelinpuolella, ei clientin varassa)

```sql
CREATE OR REPLACE FUNCTION chat_announce_deal() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO chat_messages (player_id, kind, deal_id)
  VALUES (NEW.player_id, 'deal', NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chat_announce_deal ON deals;
CREATE TRIGGER trg_chat_announce_deal
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION chat_announce_deal();
```

**Kaupan poisto:** `deal_id`-viittaus on `ON DELETE CASCADE` (kohta 2.1) — kun kauppa
poistetaan (olemassa oleva ominaisuus, `DB.deleteDeal` / `handleDeleteDeal`), sen
chat-ilmoitus poistuu automaattisesti mukana. **Tämä on välttämätön**, ei vain siisteyttä:
ilman `CASCADE`a (oletus `NO ACTION`) jokainen kaupan poisto epäonnistuisi vierasavain-
rikkomukseen heti kun laukaisin on käytössä, koska joka ikiselle kaupalle syntyy chat-rivi.
Tarkistettu ettei olemassa olevaa poisto-koodipolkua tarvitse muuttaa muilta osin.

**Miksi laukaisin eikä client-koodi:** koko tämän session korjaussarjan opetus on ollut,
ettei clientin varaan voi jättää mitään mikä on pakko tapahtua — selain voi kaatua,
verkko katketa, välilehti jäätyä. Laukaisin takaa että kauppailmoitus syntyy **aina** kun
kauppa tallentuu, riippumatta siitä mitä selaimessa tapahtuu sen jälkeen. Sama periaate
kuin `stat_events`-lokissa.

Deal-rivin **sisältö** (Megis, toimiala, nimimerkki) ei denormalisoidu chat-riville —
`chat_messages.kind='deal'`-rivi kantaa vain `player_id`+`deal_id`+`created_at`. Sisältö
yhdistetään **client-puolella jo ladatusta tilasta**: sovellus pitää muutenkin muistissa
koko `deals`-taulun ja `playersMap`:in (realtime-tilauksilla synkassa), ja täsmälleen
sama yhdistämismalli on jo käytössä `buildTickerFeed`:ssä (data.jsx) — `deals.find(d =>
d.id === msg.deal_id)` ja `playersMap[msg.player_id].nick`. Tämä toimii identtisesti
sekä alkuhaussa (`fetchAllChatMessages`) että realtime-päivityksen jälkeen. Realtime
toimii samalla debounce+kokohaku-mallilla kuin `subscribeDeals`/`subscribeDaily` jo nyt
(db.js): tapahtuma ei tuo yksittäistä riviä clientille, vaan laukaisee koko
`chat_messages`-taulun uudelleenhaun (`fetchAllChatMessages`) 400 ms debouncen jälkeen,
ja tulos korvaa koko listan — täysin sama malli kuin muillakin tauluilla, ei uutta
per-rivi-käsittelijää tarvita.
Jos `deal_id` ei löydy vielä ladatusta `deals`-listasta (esim. realtime-viesti ehtii
ennen deals-tilauksen päivitystä), rivi renderöidään tilapäisesti pelkällä nimimerkillä
("🎉 RÄNTILÄ teki kaupan") ja täydentyy kun deals-data saapuu.

---

## 3. Oikeudet (RLS)

```sql
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- chat_messages
CREATE POLICY cm_select ON chat_messages FOR SELECT USING (has_linked_player());
CREATE POLICY cm_insert ON chat_messages FOR INSERT
  WITH CHECK (kind = 'user' AND owns_player(player_id));  -- 'deal'-rivit vain laukaisimelta
  -- (chat_announce_deal on SECURITY DEFINER: ajaa funktion OMISTAJAN — migraatiota ajavan
  -- roolin — oikeuksin, ei sen käyttäjän joka lisäsi kaupan; RLS:n INSERT-tarkistus koskee
  -- vain käyttäjän omilla oikeuksillaan tekemiä suoria INSERTejä, ei tätä.)
CREATE POLICY cm_delete ON chat_messages FOR DELETE USING (is_admin());
-- Ei UPDATE-politiikkaa: viestit ovat muuttumattomia (ei muokkausta).

-- chat_reactions
CREATE POLICY cr_select ON chat_reactions FOR SELECT USING (has_linked_player());
CREATE POLICY cr_insert ON chat_reactions FOR INSERT WITH CHECK (owns_player(player_id));
CREATE POLICY cr_delete ON chat_reactions FOR DELETE USING (owns_player(player_id));
```

Hyödyntää olemassa olevia `has_linked_player()`, `owns_player()`, `is_admin()` -funktioita
(osaprojekti B:stä) — ei uusia turvafunktioita tarvita.

---

## 4. Client (db.js)

Uudet funktiot samaan tyyliin kuin `deals`/`daily_stats`:

- `fetchAllChatMessages()` — **EI** käytä `fetchPaged`-apufunktiota (se hakee koko taulun
  ilman järjestystä/rajaa, väärä muoto tähän). Oma kysely:
  `client.from('chat_messages').select('*').order('created_at', {ascending:false}).limit(200)`.
  Palauttaa siis aina viimeisimmät ≤200 riviä, ei koko historiaa. Vanhempaa historiaa ei
  voi selata v1:ssä (ei infinite scrollia) — jos tämä osoittautuu tarpeelliseksi, lisätään
  myöhemmin omana pyyntönä. **Huom:** rivit tulevat uusin-ensin; UI (kohta 5) kääntää
  järjestyksen näyttääkseen vanhin ylhäällä / uusin alhaalla.
- `sendChatMessage(body)` — `ensureLiveSession()` ensin (sama yhteysvarmistus kuin
  kirjauksissa), sitten INSERT. Palauttaa `{ok, error}`.
- `deleteChatMessage(id)` — vain adminille (RLS estää muut joka tapauksessa, mutta UI
  näyttää poistonapin vain adminille).
- `toggleReaction(messageId, emoji)` — jos oma reaktio on jo olemassa: DELETE, muuten INSERT.
- `subscribeChat(cb)` — **yksi** realtime-tilaus kattaa sekä viestit että reaktiot (UI
  hakee molemmat kun jompikumpi muuttuu), sama `debounced`-malli kuin muilla tauluilla.
  *(Toteutussuunnitelmassa yhdistetty yhdeksi tilaukseksi kahden sijaan — kaksi erillistä
  tilausta hakisi käytännössä aina molemmat listat joka tapauksessa.)*

**Pelaajan id parametrina:** `sendChatMessage(body, playerId)` ja
`toggleReaction(messageId, emoji, reactions, playerId)` saavat kirjautuneen pelaajan
id:n kutsujalta (`app.jsx` tietää sen jo: `currentKey`). db.js ei kysele sitä itse —
näin vältetään ylimääräinen edestakainen kutsu, välimuistin vanhentuminen käyttäjän
vaihtuessa, ja funktiot pysyvät testattavina ilman auth-tynkiä.

Kaikki kirjoitukset kulkevat `withTimeout`/`ensureLiveSession`-suojan läpi kuten muutkin
tämän session aikana korjatut tallennukset — ei uutta epäluotettavuusluokkaa.

---

## 5. UI (app.jsx)

Uusi `TeamChat`-komponentti sivupalkkiin (Top3/H2H-korttien alle), sekä admin- että
pelaajanäkymään:

- Kiinteä korkeus (~400px) sisäisellä vierityksellä, uusin viesti alimpana, autoscroll
  uuden viestin saapuessa (paitsi jos käyttäjä on itse vierittänyt ylös lukemaan
  historiaa — silloin ei pakoteta alas).
- Kauppailmoitus-rivi korostettuna (esim. `chat-deal`-luokka, 🎉-ikoni):
  *"🎉 RÄNTILÄ · KAUPPA 250 Megis · Teollisuus"*
- Ihmisviesti: nimimerkki + kellonaika + teksti.
- Jokaisen viestin alla 5 emoji-nappia (👍🔥🎉💰😂) + määrä jos ≥1 reaktio; oma reaktio
  korostettu (esim. taustaväri). Klikkaus kutsuu `toggleReaction`.
- Admin näkee pienen ✕-poistonapin viestin vieressä.
- Tekstikenttä + lähetä-nappi pohjassa; Enter lähettää, Shift+Enter rivinvaihto.
- Lähetysnappi disabloituu tyhjällä/pelkkää whitespacea sisältävällä viestillä.

Mobiilissa `TeamChat` asettuu sivupalkin muiden korttien tapaan sisällön alle
(olemassa oleva responsiivisuus, ei erillistä mobiilityötä).

---

## 6. Rajattu pois (YAGNI)

- GIF:t (oma myöhempi osaprojekti).
- Vapaa emoji-valitsin reaktioihin (kiinteä 5 kpl riittää).
- Viestin muokkaus.
- Lukukuittaukset / "joku kirjoittaa…" -indikaattori.
- Maininnat (@nimimerkki) ja ilmoitukset.
- Viestien haku/suodatus.
- Kuvien/linkkien upotus (koska GIF:t rajattu pois, viesti renderöidään aina pelkkänä
  tekstinä — ei tarvita XSS-suojausta linkin esikatselulle).

---

## 7. Testaus

Sama malli kuin projektin muu koodi: riippumattomat Node-testit (`tests/_harness.js`,
vm-sandbox), ei erillistä testikehystä. Uudet tiedostot:
- `tests/chat-logic.test.js` — viestin validointi (tyhjä/liian pitkä hylätään), reaktion
  toggle-logiikka, kauppailmoituksen renderöintimuoto.
- `tests/db-chat.test.js` — samaan tyyliin kuin `tests/db-deals.test.js`: valeasiakas,
  `sendChatMessage`/`toggleReaction` palauttavat `{ok,error}` oikein, eivät heitä eivätkä
  jää roikkumaan (sama aikakatkaisu-/uusintasuoja kuin muualla).

---

## 8. Migraatio (Supabase-SQL ajettavaksi tuotantoon)

Kohdat 2.1–2.3 ja 3 kootaan yhdeksi SQL-tiedostoksi
(`docs/migraatio-tiimichat.sql`, samaan tyyliin kuin
`docs/migraatio-atominen-kirjaus.sql`) joka ajetaan Supabasen SQL-editorissa ennen
masterin pushaamista — koodi olettaa taulujen olemassaoloa heti deployn jälkeen.

Ei vaikuta olemassa oleviin **riveihin** (`deals`, `daily_stats`, `players` -sisältö
pysyy koskemattomana). Käyttäytymiseen tulee kuitenkin yksi tarkoituksellinen muutos:
`deals`-tauluun lisätään AFTER INSERT -laukaisin (kohta 2.3), ja kaupan poisto
(`DB.deleteDeal`, olemassa oleva ominaisuus) poistaa jatkossa myös sen chat-ilmoituksen
`ON DELETE CASCADE`:n kautta (kohta 2.1). Tämä on tietoinen, tarpeellinen sivuvaikutus —
ilman `CASCADE`a kaupan poisto alkaisi epäonnistua heti kun laukaisin on käytössä.
