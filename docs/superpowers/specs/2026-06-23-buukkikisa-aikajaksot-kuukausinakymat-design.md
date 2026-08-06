# Sales Dashboard 2.0 · Osaprojekti C: Aikajaksot, kuukausinäkymät & premium-kiillotus

**Päivämäärä:** 2026-06-23
**Tila:** Suunnittelu hyväksytty, valmis spec-reviewiin
**Osaprojekti:** C / (A–D).

---

## 1. Tausta ja tavoite

Sovellus näyttää yhä "vanhalta kisalta": tilastot on sidottu kiinteään kilpailukalenteriin
(`WEEKDAY_DATE_KEYS`, 25.5–18.6), minkä vuoksi **päivämäärät loppuvat kisan loppuun** eikä
jatkuvaa myynnin seurantaa voi tehdä. Playoff-kaavio ja kausibrändäys hallitsevat etusivua.

Tämä osaprojekti muuttaa sovelluksen **jatkuvaksi myynnin dashboardiksi**:

### Tavoite (success criteria)
- Kirjaus (pikavalinnat + kauppa) tallentuu **oikealle tämän päivän päivämäärälle**, ei kisakalenteriin.
- Etusivulla **aikajaksovalitsin**; kuukausi = **puhdas taulu** vain sen kuukauden datalla, ja
  aiemmat kuukaudet ovat **selattavissa** (historia säilyy).
- Sarjataulukon **järjestysperuste on valittavissa** (Buukit / Megis / Eurot / Tapaamiset).
- Playoff/playout/"Kausi 1" siirtyvät **Arkisto-välilehdelle**; admin voi **käynnistää uuden kilpailun**.
- **Premium-henkinen, kohdennettu ulkoasun kiillotus** (rakenne säilyy).

### Päätetyt valinnat (brainstorm 2026-06-23)
- Järjestys: **valittavissa napista**.
- Kisa-artefaktit: **arkistoon** + mahdollisuus aloittaa uusi kilpailu.
- UI: **kohdennettu kiillotus** (ei täyttä uudistusta).

---

## 2. Päivämäärämallin irrotus kilpailukalenterista (ydin)

**Nyt:** `performAction` ja `handleSaveDay` kirjoittavat `daily_stats`-rivin
`weekdayIndexToDateKey(currentWeekdayIndex())`-avaimelle → sidottu kisakalenteriin, joka
päättyy 18.6.

**Muutos:**
- **Pikavalinnat** (`performAction`): daily_stats-kirjaus käyttää suoraan
  `localDateKey(new Date())` (oikea tänään). Ei `currentWeekdayIndex`-riippuvuutta kirjauksessa.
- **Oma raportti** (`DailyReport`, pelaajanäkymä): kilpailukalenteri-päivägrid korvataan
  **päivämäärävalitsimella** (`<input type="date">`, oletus tänään). Pelaaja voi valita minkä
  tahansa päivän ja syöttää/korjata sen luvut.
- **Aggregointi** ei enää nojaa `WEEKDAY_DATE_KEYS`-indekseihin vaan suodattaa rivit
  `date_key`-merkkijonovertailulla valitulle välille (YYYY-MM-DD on leksikografisesti järjestyvä).

> `WEEKDAY_DATE_KEYS` ja kisaindeksit jäävät käyttöön vain **Arkisto**-välilehden
> kisanäkymissä (playoff-päivät). Jatkuva dashboard ei niitä tarvitse.

---

## 3. Aikajaksot

### 3.1 Aikajaksovalitsin (etusivun yläpalkki)
Vaihtoehdot: **Tänään · Tämä viikko · Tämä kuukausi · Viime kuukausi · Tämä vuosi · Oma väli**.
Oletus: **Tämä kuukausi**. "Oma väli" avaa kaksi date-inputtia.

### 3.2 Aikaväli-logiikka (data.jsx, puhtaat funktiot)
```
periodRange(kind, refDate?) → { startKey, endKey, label }
```
- `today`      → [tänään, tänään]
- `thisWeek`   → [ma, su] (ISO-viikko)
- `thisMonth`  → [kuun 1. pv, kuun viim. pv]
- `lastMonth`  → edellinen kuukausi kokonaan
- `thisYear`   → [1.1., 31.12.]
- `custom`     → annetut alku/loppu
Kaikki avaimet muotoa `YYYY-MM-DD` (localDateKey-pohjaiset).

---

## 4. Kuukausittainen sarjataulukko + valittava järjestys

### 4.1 Jaksokohtainen aggregointi (data.jsx)
```
aggregatePlayersForPeriod(playersMap, dailyStats, deals, startKey, endKey) → array
```
Jokaiselle pelaajalle lasketaan **vain valitun jakson** rivit:
- daily_stats: summaa lähteneet(luurit)/vastatut/buukit/tapaamiset joissa `startKey ≤ date_key ≤ endKey`
- deals: summaa kaupat/Megis/eurot joissa `startKey ≤ date_key ≤ endKey`; keskikauppa, lead time -ka
Palauttaa pelaaja-objektit jakson luvuilla + johdetut kentät (vastaus-%, buukki-%, keskikauppa).
Admin/`is_admin`-pelaajat suodatetaan pois (kuten `sortedPublic`).

### 4.2 Järjestysperuste (nappi)
Uusi UI-tila `rankBy ∈ {buukit, megis, eurot, tapaamiset}`. Sarjataulukko järjestetään sen mukaan.
Kaikki mittarit näkyvät sarakkeina; aktiivinen järjestyssarake korostetaan. Oletus: **buukit**.

### 4.3 "Puhdas taulu" kuukausittain
Koska aggregointi on jaksorajattu, jokainen kuukausi näyttää automaattisesti vain oman datansa
(nollasta). Aiemman kuukauden valinta näyttää sen historian.

---

## 5. Kisa arkistoon + uuden kilpailun aloitus

- **Uusi "Arkisto"-välilehti**: sinne siirtyvät playoff-kaavio, playout ja kausibrändäys
  (nykyiset komponentit siirretään, ei poisteta). Vanha kisadata näkyy siellä.
- **Etusivu (SARJATAULUKKO)** = puhdas kuukauden dashboard (aikajaksovalitsin + jaksotaulukko).
- **Admin**: "Käynnistä uusi kilpailu" -toiminto Arkisto/Admin-alueella käyttää nykyistä
  `startPlayoffs`/`resetPlayoffs`-logiikkaa. Täysi monikausihallinta (nimet, useita rinnakkaisia
  kausia, seasons-taulu) EI kuulu tähän — vain arkisto + uuden aloitus nykylogiikalla.

---

## 6. Premium-kiillotus (kohdennettu)

Säilytetään rakenne; parannetaan ilmettä:
- **Typografia & välit**: johdonmukainen skaala, ilmavuus, otsikkohierarkia.
- **Kortit & mittarit**: pehmeämmät varjot/reunat, selkeämmät KPI-lohkot, aksentti harkiten.
- **Aikajaksovalitsin & järjestysnappi**: premium-henkiset segmented controlit.
- **Sarjataulukko**: selkeät sarakkeet, aktiivisen järjestyssarakkeen korostus, hover-tilat.
- Toteutus `styles.css`-tokeneilla (olemassa olevat `--ink/--bg/--accent` ym.); ei uutta kirjastoa.

---

## 7. Datamalli & yhteensopivuus

- **Ei skeemamuutoksia.** `daily_stats.date_key` ja `deals.date_key`(=signed_date) tukevat jo
  mielivaltaisia päiviä.
- Vanha kisadata (date_key 2026-05-25…2026-06-18) näkyy touko-/kesäkuun kuukausina ja Arkistossa.
- RLS/auth (B) ennallaan.

---

## 8. Testaus

Riippuvuudeton Node-apuri (`tests/_harness.js`):
- `periodRange`: kuukauden/viikon/vuoden rajat oikein (ml. vuoden-/kuunvaihteet).
- `aggregatePlayersForPeriod`: laskee vain jakson rivit; jakson ulkopuoliset eivät vuoda;
  järjestys eri `rankBy`-arvoilla; admin suodattuu pois.
UI + premium-ilme: manuaalinen selaintesti (dev-local).

---

## 9. Rajaus (out of scope)

| Aihe | Minne |
|---|---|
| Badget, tavoitteet, H2H, Hall of Fame | D |
| Täysi seasons-hallinta (nimetyt kaudet, useita rinnakkain, seasons-taulu) | Myöhemmin |
| Pisteytyksen sitominen palkintoihin/sijoituksiin automaattisesti | Myöhemmin |
