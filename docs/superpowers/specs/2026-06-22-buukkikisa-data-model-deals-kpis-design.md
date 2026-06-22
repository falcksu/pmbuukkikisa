# Buukkikisa → Sales Dashboard 2.0 · Osaprojekti A: Datamallin laajennus

**Päivämäärä:** 2026-06-22
**Tila:** Hyväksytty suunnittelu, valmis toteutussuunnitelmaan
**Osaprojekti:** A / (A–D). Tämä spec kattaa VAIN datamallin laajennuksen.

---

## 1. Tausta ja tavoite

Buukkauskisa-sovellus (React UMD/CDN + Babel standalone, ei build-vaihetta;
Supabase + RLS + Realtime; Vercel-hosting) muutetaan kilpailusta pysyväksi
myynnin seurantanäytöksi. Tämä osaprojekti laajentaa datamallia kahdella tavalla:

1. **Uudet KPI:t myyntiputkeen** — lisätään *tapaamiset* nykyisten mittareiden rinnalle.
2. **Kauppojen kirjaus** — jokainen toteutunut kauppa tallennetaan omana rivinään
   (toimiala, Megis, eurot).

Yritys myy energiaa. Asiakkaiden nimiä **ei saa** tallentaa tähän projektiin
(julkinen hosting). Siksi:
- Asiakas korvataan **toimialalla** (vapaa teksti).
- MWh-volyymi naamioidaan termillä **"Megis"** (1 Megis = 1 MWh, todelliset luvut).
- Eurot tallennetaan todellisina arvoina.

### Tavoite (success criteria)
- Pelaaja voi kirjata omat tapaamisensa (+1) ja kauppansa (lomake) omasta näkymästään.
- Pelaajakortti näyttää keskikaupan koon Megiksinä ja euroina sekä kokonaisvolyymin.
- Vanha kisadata (luurit/vastatut/buukit) säilyy koskemattomana.
- Sarjataulukon järjestys pysyy ennallaan (buukki-pohjainen).

---

## 2. Myyntiputki ja KPI:t

Vahvistettu putki (järjestyksessä):

```
Lähteneet puhelut → Vastatut puhelut → Buukit → Tapaamiset → Kaupat
   (luurit)          (vastatut)        (buukit)  (UUSI)        (UUSI: toimiala/Megis/€)
```

- **Lähteneet puhelut** = nykyinen `luurit`-kenttä. Kentän nimi säilyy koodissa
  (`luurit`), mutta käyttöliittymässä se nimetään "Lähteneet puhelut" / "Lähteneet".
  Nykyinen "LUURIN NOSTO" -teksti UI:ssa korvataan johdonmukaisesti.
- **Vastatut puhelut** = nykyinen `vastatut`.
- **Buukit** = nykyinen `buukit`.
- **Tapaamiset** = uusi päiväkohtainen laskuri (`tapaamiset`).
- **Kaupat** = uusi erillinen taulu (ei laskuri).

---

## 3. Tietokantarakenne

### 3.1 `daily_stats` — laajennetaan nykyistä taulua

Lisätään yksi sarake:

```sql
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS tapaamiset int NOT NULL DEFAULT 0;
```

Lopullinen rakenne:

| Sarake | Tyyppi | Huom |
|---|---|---|
| id | text | `player_id + '_' + date_key` (ennallaan) |
| player_id | text | |
| date_key | date | |
| luurit | int | = lähteneet puhelut |
| vastatut | int | |
| buukit | int | |
| **tapaamiset** | **int default 0** | **UUSI** |
| updated_at | timestamptz | |

Vanhat rivit saavat `tapaamiset = 0`. Ei datahäviötä.

### 3.2 `deals` — uusi taulu

```sql
CREATE TABLE IF NOT EXISTS deals (
  id          text PRIMARY KEY,
  player_id   text NOT NULL,
  date_key    date NOT NULL,
  toimiala    text,
  megis       numeric NOT NULL DEFAULT 0,
  eurot       numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- **id**: `player_id + '_' + date_key + '_' + juokseva` (esim. `mikko:tampere_2026-06-22_3`).
  Juokseva numero = pelaajan kyseisen päivän kaupparivien määrä + 1. Tämä takaa
  vakaan, ennustettavan id:n upsert-pohjaiseen tallennukseen ja poistoon ilman uuid-riippuvuutta.
  **id on läpinäkymätön avain:** sitä käytetään aina kokonaisuutena (upsert/delete/lookup),
  EI koskaan pilkota takaisin osiin (`id.split('_')` on kielletty — player_id voi sisältää `_`).
- **Juoksevan numeron kilpailutilanne (tiedostettu reunatapaus):** kaksi nopeaa
  kauppakirjausta (tai kaksi laitetta) voi laskea saman juoksevan numeron ja upsert
  ylikirjoittaisi toisen. Käyttötapa on yksi pelaaja per näkymä, joten riski on pieni;
  juokseva numero lasketaan paikallisesta deals-tilasta. Hyväksytään reunatapaus tässä vaiheessa.
- **megis**: numeric (= MWh, 1:1).
- **eurot**: numeric.
- **toimiala**: vapaa teksti, voi olla tyhjä.

### 3.3 RLS

`deals`-taulun RLS-politiikka asetetaan **samaksi kuin nykyisillä tauluilla**
(`players`, `daily_stats`, `meta`) — eli anon-avaimella luku/kirjoitus sallittu.
Tietoturvan koventaminen (käyttäjäkohtainen auth, kireämmät politiikat) on
**osaprojekti B** eikä kuulu tähän speciin.

> **Tietoinen tradeoff:** todelliset eurot ja volyymit tallennetaan kantaan, jota
> luetaan julkisella anon-avaimella. Naamiointi (ei asiakasnimiä, Megis-termi)
> on käyttäjän valitsema suojaustapa tässä vaiheessa. Tämä riski dokumentoidaan ja
> ratkaistaan osaprojekti B:ssä.

---

## 4. Sovelluslogiikka (data.jsx / app.jsx / db.js)

### 4.1 Pelaaja-objektin aggregaatit

`recalcPlayerFromDailyStats` (data.jsx) laskee jatkossa myös:
- `tapaamiset` — summa `daily_stats`-riveistä.

Lisäksi uusi laskenta kaupoista (joko `recalcPlayerFromDeals` tai osana
samaa polkua), joka tuottaa pelaajalle:
- `dealsCount` — kauppojen lukumäärä
- `megisTotal` — Megis-summa
- `eurTotal` — €-summa
- `avgMegis` = `megisTotal / dealsCount` (0 jos ei kauppoja)
- `avgEur` = `eurTotal / dealsCount` (0 jos ei kauppoja)

Aggregaatit lasketaan client-puolella deals-riveistä, samaa periaatetta kuin
nykyiset buukit lasketaan `daily_stats`-riveistä (deals-rivit = totuuden lähde).

**Yksi yhtenäinen uudelleenlaskupolku:** kauppa-aggregaatit ja daily_stats-aggregaatit
lasketaan samoissa triggereissä (init, realtime-refetch, paikallinen mutaatio), jotta
pelaaja-objekti pysyy johdonmukaisena. Toteutus valitsee yhden tavan (esim. erillinen
`recalcPlayerFromDeals` joka ajetaan samassa kohdassa kuin `recalcPlayerFromDailyStats`).

### 4.2 db.js — uusi deals-rajapinta

Lisätään `daily_stats`-mallia mukaillen:
- `fetchAllDeals()` — hakee kaikki kaupparivit (Supabase tai localStorage-fallback).
- `upsertDeal(deal)` — tallentaa/päivittää kaupan.
- `deleteDeal(id)` — poistaa kaupan.
- `subscribeDeals(cb)` — realtime-tilaus.
- `init()` palauttaa jatkossa myös `deals`-listan.
- localStorage-fallback: avain `buukkauskisa.deals.v1`, peilaa saman skeeman.
- Realtime-kanava `public:deals` (postgres_changes → refetch → notify).

`upsertDailyStats` laajennetaan kuljettamaan myös `tapaamiset`.

### 4.3 Pikavalinta: tapaaminen

`performAction(kind, rect)` (app.jsx) saa uuden lajin `'tapaaminen'`:
- Kasvattaa pelaajan `tapaamiset`-aggregaattia ja kirjaa `daily_stats`-riville
  oikealle päivälle (sama `currentWeekdayIndex`-pohja kuin muut pikavalinnat).
- Käyttäytyy kuten muut +1-laskurit (flash, float-animaatio valinnainen).

### 4.4 Kaupan kirjaus

Uusi käsittelijä (esim. `handleAddDeal({ toimiala, megis, eurot })`):
- Määrittää `date_key` = tämä päivä.
- Muodostaa id:n (player_id + date_key + juokseva nro).
- Kutsuu `DB.upsertDeal` ja päivittää paikallisen deals-tilan.
- Negatiiviset arvot estetään (Math.max(0, …)).

Uusi käsittelijä `handleDeleteDeal(id)` poistaa kaupan.

---

## 5. Käyttöliittymä

### 5.1 Datan syöttö (Oma raportti -näkymä, jokainen omansa)

- **Tapaaminen-pikavalinta:** `+1`-nappi luuri/vastattu/buukki -nappien rinnalle.
  Teksti esim. "+ TAPAAMINEN".
- **Kauppalomake:** "➕ Lisää kauppa" -nappi avaa pienen inline-lomakkeen:
  - Toimiala — tekstikenttä, placeholder/vihje: *"Vain toimiala, ei asiakkaan nimeä"*.
  - Megis — numerokenttä.
  - Eurot — numerokenttä.
  - "Tallenna kauppa" -nappi.
- **Päivän kaupat -lista:** kirjatut kaupat listataan (toimiala · Megis · €),
  jokaisella poistonappi.
- Admin voi muokata kenen tahansa lukuja/kauppoja kuten nykyisinkin
  (admin käyttää samaa näkymälogiikkaa valitulle pelaajalle).

### 5.2 Pelaajakortti / näkymä

Pelaajakorttiin ja oma raportti -yhteenvetoon lisätään kaupoista lasketut luvut:
- **Keskikauppa:** `ø {avgMegis} Megis` ja `ø {avgEur} €`.
- **Yhteensä:** `{dealsCount} kpl · {megisTotal} Megis · {eurTotal} €`.
- **Tapaamiset:** osana putken lukuja.

Terminologia: yksikkö "Megis" kaikkialla (esim. "142 Megis", "ø 12 Megis").
"MWh" ei esiinny käyttöliittymässä.

### 5.3 Sarjataulukko

Järjestys pysyy **buukki-pohjaisena**. Uudet mittarit voivat näkyä
sarakkeina/korteissa, mutta eivät vaikuta sijoituksiin tässä vaiheessa.

---

## 6. Yhteensopivuus ja migraatio

- Kaikki muutokset ovat **additiivisia**. Olemassa oleva kisadata säilyy.
- Supabase: aja `ALTER TABLE` (kohta 3.1) ja `CREATE TABLE deals` (kohta 3.2).
  Annetaan käyttäjälle valmis SQL toteutusvaiheessa.
- localStorage-fallback toimii ilman skeeman migraatiota (uudet kentät defaulttaavat).
- Jos `daily_stats`-rivillä ei ole `tapaamiset`-arvoa (vanha localStorage-data),
  käsitellään se nollana.

---

## 7. Rajaus (out of scope tässä osaprojektissa)

| Aihe | Osaprojekti |
|---|---|
| Pisteytyksen muutos (Megis/€ vaikuttaa sijoituksiin) | Myöhemmin |
| Käyttäjäkohtaiset salasanat / auth-koventaminen / RLS-kiristys | B |
| Aikajaksosuodatus, kausihistorian selailu-UI | C |
| Tiimitavoitteet, badget, H2H, Hall of Fame | D |

---

## 8. Avoimet oletukset (vahvista toteutuksen alussa jos epäselvää)

- **Megis = MWh 1:1**, ei skaalausta.
- **Kaupat eivät vaadi tapaamista** edeltäjäksi (ei pakotettua putkivalidointia).
- **Tapaamiset** ovat päiväkohtainen kokonaislaskuri (ei sidottu yksittäiseen kauppaan).
- Yksi pelaaja voi kirjata useita kauppoja samalle päivälle.
