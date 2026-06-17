# Cold GM — Jääkiekko-manageri PC:lle (Steam)
**Spesifikaatio v1.0 | 2026-06-17**

---

## 1. Konsepti ja tuotevaatimukset (PRD)

### Ydinlupaus
> "Rakenna dynastia. Katso kun taktiikkasi toimii kentällä."

Cold GM on yksinpelattava jääkiekko-managerisimulaattori PC:lle (Steam). Pelin tärkein erottautumistekijä kilpailijoihin (erityisesti Franchise Hockey Manager) nähden on **2D-otteluvisualisointi**: pelaaja ei lue tekstiraporttia vaan näkee joukkueensa kentällä reaaliaikaisessa 2D-näkymässä.

Peli käyttää **fiktiivisiä liigoja ja pelaajia** lisenssiriskien välttämiseksi. Steam Workshop -integraatio mahdollistaa yhteisön luomien modien kautta oikeiden liigajen, joukkueiden, pelaajien ja logojen lisäämisen.

### Kohdeyleisö
- Primääri: jääkiekon seuraajat 18–40v, jotka haluavat syvää managerkokemusta
- Sekundääri: Football Manager -pelaajat, jotka haluavat jääkiekkoon sopeutetun vastaavan
- Tertiääri: modausyhteisö, joka lisää oikeat liigat

### Kilpailuasema
| | Cold GM | Franchise Hockey Manager | Eastside Hockey Manager |
|---|---|---|---|
| 2D-ottelunäkymä | ✅ | ❌ | ❌ |
| Modaus / Workshop | ✅ | Rajattu | ✅ |
| Moderni UI | ✅ | ❌ | Kohtalainen |
| Hinta (EA) | ~15 € | ~35 € | ~15 € |

---

## 2. MVP-ominaisuuslista (Polku B — Early Access)

### P0 — Pakollinen EA-julkaisuun

- [ ] **6 fiktiivistä liigaa** — 3 aluetta (Pohjoinen, Keski, Etelä) × 2 sarjatasoa (Premier Division + First Division per alue)
- [ ] 20 joukkuetta per liiga (120 joukkuetta), ~25 pelaajaa per joukkue (~3 000 pelaajaa generoituna)
- [ ] **Promootio/relegaatio:** kauden lopussa ylimmän liigan viimeiset 2 ja First Divisionin top-2 vaihtavat paikkoja automaattisesti
- [ ] Kausirakenne: runkosarja (60 peliä) → pudotuspelit Premier Divisionissa (top-8, best-of-5); First Divisionissa vain runkosarja (ei omia pudotuspelejä)
- [ ] **Playoff-siemennys:** pisteet runkosarjasta, tasapisteet ratkotaan: maaliero → voitot → keskinäiset ottelut. Siemenet 1v8, 2v7, 3v6, 4v5.
- [ ] **Playoff-kotiedun formaatti (2-2-1):** Korkeampi siemen pelaa kotona pelit 1, 2 ja 5 (jos tarvitaan); vieraat pelaavat kotona pelit 3 ja 4. Tämä on tarkoituksellinen NHL-tyyppinen 2-2-1-formaatti, ei virhe.
- [ ] **First Division kauden päätös:** runkosarja → sijoitus → top-2 nousee automaattisesti Premier Divisioniin. Muuta post-season-sisältöä ei ole MVP:ssä.
- [ ] 2D-ottelusimulaatio graafisella näkymällä (Godot 2D)
- [ ] Siirtoikkuna (kaksi per kausi) ja sopimusneuvottelut
- [ ] Perustalous: budjetti, palkat, lipputulot, sponsorit
- [ ] Harjoitusjärjestelmä (viikko-ohjelma, fokusvalinta)
- [ ] JSON/CSV-pohjainen modausrajapinta
- [ ] Steam Workshop -tuki
- [ ] **20 saavutusta** (lista alla)
- [ ] Pilvitallennus (Steam Cloud)

**Saavutuslista (EA-julkaisuun):**
| # | Nimi | Ehto |
|---|---|---|
| 1 | First Win | Voita ensimmäinen ottelu |
| 2 | Unbeaten Run | 10 peliä ilman häviötä |
| 3 | Champion | Voita Premier Division |
| 4 | Promoted | Nouse First Divisionista Premier Divisioniin |
| 5 | Survival | Vältä relegaatio viimeisellä sijalla joukkue |
| 6 | Budget Boss | Päätä kausi positiivisella kassavarannolla 3 kertaa peräkkäin |
| 7 | Bargain Hunter | Osta pelaaja alle 50 % arvioidusta hinnasta |
| 8 | Academy Graduate | Nosta nuorisoakatemian pelaaja kokoonpanoon (P1, mutta saavutus kirjataan myöhemmin) |
| 9 | Shutout | Voita ottelu 0 päästettyä maalia |
| 10 | Hat Trick Hero | Yksi pelaaja tekee 3 maalia yhdessä ottelussa |
| 11 | Comeback Kings | Voita ottelu oltuasi 3 maalilla tappiolla |
| 12 | Perfect Season | Voita kaikki kotiottelut runkosarjassa |
| 13 | Iron Man | Sama pelaaja pelaa kaikki runkosarjan ottelut |
| 14 | Power Play King | PP-teho yli 30 % koko kaudella |
| 15 | Penalty Box | Joukkueella yli 100 rangaistusminuuttia kaudella |
| 16 | Underdog | Voita mestaruus alimman alkubudjetin joukkueella |
| 17 | Treble | Voita sekä alue- että kansallinen mestaruus samana kaudena (tuleva ominaisuus, placeholder) |
| 18 | Decade of Dominance | Pelaa 10 kautta saman joukkueen kanssa |
| 19 | Workshop Pioneer | Pelaa mod-paketilla (Workshop-modi aktivoitu) |
| 20 | Cold GM | Saavuta kaikki muut saavutukset |

### P1 — EA:n aikana (kk 8–14)

- [ ] Scoutausjärjestelmä (epävarmuus raporteissa, kulut)
- [ ] Nuorisoakatemia (yksinkertaistettu)
- [ ] Managerimaine ja vaikutus rekrytointiin
- [ ] Joukkueen kemia ja pukukoppidynamiikka
- [ ] Tilastoarkisto ja historiadata kausittain
- [ ] Mediapaineen hallinta

### P2 — Täyttä julkaisua varten (kk 14–20)

- [ ] Kansainväliset pelaajasiirrot liigasta toiseen
- [ ] Asynkroninen online-liiga (8 pelaajaa)
- [ ] Syvä loukkaantumisjärjestelmä (tyypeittäin, kuntoutus)
- [ ] Stadioninvestoinnit ja fanikanta

---

## 3. Pelisilmukka (Core Loop)

```
KAUSI ALKAA
  │
  ├── Esikausileirintä
  │     ├── Budjetin vahvistus
  │     ├── Siirtoikkuna (osta / myy / lainaa)
  │     └── Taktiikkojen asetus
  │
  ├── VIIKKOSILMUKKA (×30 runkosarjaviikkoa)
  │     ├── Harjoitusohjelman valinta
  │     │     └── Fokus: tekniikka / fysiikka / taktiikat / lepo
  │     ├── Ottelu(t)
  │     │     ├── Kokoonpanon valinta
  │     │     ├── Taktiikkaohjeet
  │     │     ├── 2D-ottelunäkymä (tai pikasimuloi)
  │     │     └── Vaihtojen hallinta reaaliajassa
  │     └── Analytiikka ja tilannearvio
  │
  ├── Puolikauden siirtoikkuna
  │
  └── PUDOTUSPELIT
        ├── Bracket (8 joukkuetta, best-of-5)
        └── Mestaruus / Relegaatio / Promootio

KAUSI PÄÄTTYY
  ├── Arviointi (tavoitteet vs. tulos)
  ├── Sopimusneuvottelut
  └── Uusi kausi
```

---

## 4. Pelimekaniikat

### 4.1 Ottelusimulaatio

**Malli:** Tapahtumapohjainen eventtiketju + 2D-positiointi (ei fysiikkamoottoria).

**Simulaatiosilmukka (pseudokoodi):**

```
CONSTANTS:
  GAME_DURATION = 3600  # sekuntia (60 min)
  PERIOD_DURATION = 1200  # 20 min per erä

FUNCTION simulate_game(home_team, away_team):
  game_state = init_state(home_team, away_team)

  FOR t IN 0..GAME_DURATION:
    update_fatigue(game_state)   # fatigue kasvaa ajan myötä
    check_line_change(game_state)  # vaihda linja tarvittaessa

    event_prob = calculate_event_probability(game_state)
    # event_prob perustuu: linja-attribuuttien summa, fatigue, PP/PK-tila

    event_type = weighted_random([
      ("attack_zone_entry", event_prob.attack),
      ("shot",              event_prob.shot),
      ("penalty",           event_prob.penalty),
      ("icing",             event_prob.icing),
      ("offsides",          event_prob.offsides),
      ("nothing",           event_prob.nothing)
    ])

    IF event_type == "shot":
      shooter = select_shooter(active_line)
      # shot_quality: normalisoitu arvo välillä 0.0–0.15
      # shooting 1→ 0.0, shooting 20 → 0.15; fatigue pienentää lineaarisesti
      shot_quality = (shooter.shooting / 20.0) * 0.15 * (1 - fatigue_modifier) * zone_modifier

      # goalie save_skill 1→ 0.80, save_skill 20→ 0.95; goalie_fatigue pienentää
      save_prob = 0.80 + (goalie.save_skill / 20.0) * 0.15 * (1 - goalie_fatigue * 0.1)

      # Maali syntyy kun satunnaisluku ylittää (save_prob - shot_quality)
      # Eli hyvä laukaus laskee kynnystä, hyvä MV nostaa sitä
      threshold = save_prob - shot_quality  # välillä ~0.65–0.95
      IF random() > threshold:
        GOAL → update_score, create_goal_event
      ELSE:
        SAVE → create_save_event
      # Kalibrointi: average shooter (10) vs. average goalie (10) → ~maalit ~3.0/peli
      # Tulee tarkistaa Monte Carlo -ajoissa Sprint 5:ssä

    IF event_type == "penalty":
      team = weighted_random(home_penalty_rate, away_penalty_rate)
      duration = random_choice([2, 5])  # minor/major
      set_powerplay_state(game_state, team, duration)

    update_2d_positions(game_state, event_type)
    emit_event_to_ui(game_state.last_event)

  RETURN game_state.score, game_state.stats
```

**Ylivoima/alivoima (PP/PK):**
- PP-tila: hyökkäystodennäköisyys ×1.6, laukauslaatu ×1.3
- PK-tila: puolustus ×1.4, laukausmahdollisuus −40%
- 4v4-tilanne: avoin peli, nopeus korostuu

**2D-positiointi:**
- Pelaajat esitetään värillisillä ympyröillä + numero
- Positiot päivitetään tapahtumien välissä Godot Tweenillä (0.3–0.8s siirtymä)
- Kiekko seuraa tapahtuman loogista polkua (syöttö → laukaus → torjunta)
- Kameraperspektiivi: yläpuolelta, koko kenttä näkyvissä, zoomaus vaihdettavissa

### 4.2 Pelaajamalli

**Attribuutit (asteikko 1–20):**

| Kategoria | Attribuutti | Vaikuttaa |
|---|---|---|
| Tekniset | Luistelu | Nopeus kentällä, zone-entry |
| | Laukominen | Maalin todennäköisyys |
| | Syöttäminen | Onnistunut syöttöketju PP:ssa |
| | Kiekonkäsittely | Kiekon pitäminen, 1v1-tilanteet |
| Taktiset | Positiopeli | Puolustusasemointi, turnoväri |
| | Puolustuspeli | PK-tehokkuus, taklaukset |
| | Ylivoimapeli | PP-tuotanto |
| Fyysiset | Nopeus | Vaihtojen tehokkuus, breakaway |
| | Kestävyys | Fatigue-kertymänopeus |
| | Taklaaminen | Kiekon riistot, penaltytodennäköisyys |
| Psyykkiset | Paine-alaisuus | Playoff-suorituskerroin |
| | Joukkuehenki | Kemia-bonus linjalle |

**Maalivahtiattribuutit (erilliset):**
- Torjunta (yleisteho, pääkerroin)
- Reaktionopeus (nopeat laukaukset)
- Asemointi (kulmapelaaminen)
- Henkinen kestävyys (pitkät ottelut, tappiosekvenssi)

**Ikäkehitys:**
```
IF ikä < 22: kehityskerroin = +0.5 to +2.0 per attribuutti/kausi (potentiaali ohjaa)
IF 22 ≤ ikä ≤ 28: kehityskerroin = -0.2 to +0.8 (huippuvaihe)
IF 29 ≤ ikä ≤ 32: kehityskerroin = -0.5 to +0.2 (vakaa lasku)
IF ikä > 32: kehityskerroin = -1.0 to -0.3 (selkeä lasku)
potentiaali = piilotettu katto, näytetään scoutille arviolla ± 2
```

### 4.3 Harjoittelu ja Fatigue

**Viikko-ohjelma:**
```
HARJOITUSFOKUKSET:
  "tekniikka"   → +kehitys teknisissä, fatigue +5
  "fysiikka"    → +kehitys fyysisissä, loukkaantumisriski -10%
  "taktiikat"   → +kehitys taktisissa, fatigue +3
  "lepo"        → fatigue -20, kehitys 0
  "intensiivi"  → +kehitys kaikissa ×1.5, fatigue +15, loukkaantumisriski +15%

FATIGUE_OTTELUSSA:
  0–30:  täydet attribuutit
  31–60: attribuutit × 0.95
  61–80: attribuutit × 0.85
  81–100: attribuutit × 0.70, loukkaantumisriski ×2
```

**Fatigue-nollaus:**
- Ottelun jälkeen: fatigue +8 (kaikki pelaajat, myös penkkivaraukset +2)
- Lepopäivä harjoitusohjelmassa: fatigue −20
- Viikon "lepo"-fokus: fatigue −35 koko viikolle
- Kauden päättyessä: fatigue nollataan kokonaan kaikille pelaajille ennen seuraavaa kautta
- Loukkaantunut pelaaja: fatigue pysyy loukkaantumisen aikana; nollautuu kun palaa peliin

**Loukkaantumiset (MVP-taso):**
- Todennäköisyys per ottelu: `base_risk = 0.02 + (checking / 200) + (fatigue / 1000)`
- Kesto: `random(1, 8)` viikkoa, ei erillisiä tyyppejä MVP:ssä (P1-ominaisuus)
- Loukkaantunut pelaaja poistetaan rosterin käytettävissä-listalta kuntouttumisajaksi

### 4.4 Siirtoikkuna

**Kaksi ikkunaa per kausi:**
- **Esikausi-ikkuna:** ennen runkosarjan alkua, kesto 4 peliviikkoa. Vapaat agentit + joukkueiden väliset kaupat.
- **Puolikausi-ikkuna:** runkosarjan 30. pelin jälkeen, kesto 2 peliviikkoa. Rajatumpi aktiviteetti.

**Siirtomekaniikat (MVP):**
- Pelaaja saa siirtohinnan automaattisesti (= palkka × ikäkerroin × attribuuttikerroin)
- Pelaaja voidaan ostaa suoraan tai tehdä tarjous (AI voi torjua)
- AI-joukkueet tekevät omia siirtojaan (yksinkertaistettu: satunnainen ostaja arvotaan, jos budjetti riittää)
- Laina-sopimukset: pelaaja pelaa toisessa joukkueessa 1 kauden, palaa sen jälkeen
- Palkkakatto: **valinnainen asetus** (päällä/pois asetuksissa), ei pakollinen MVP:ssä

**Sopimusneuvottelut:**
- Sopimuksen pituus: 1–4 kautta
- Palkka: pelaaja esittää vaatimuksen (= attribuuttitaso × liigakertoin), pelaaja voi neuvotella ±20%
- Jos sopimusta ei synny, pelaaja siirtyy vapaaksi agentiksi kauden päättyessä

### 4.5 Talous

```
KAUSIBUDJETTI:
  Tulot:
    lipputulot     = kapasiteetti × täyttöaste × lippuhinta
    sponsorit      = perussopimus + suoritusbonus (sijoitus liigassa)
    liigaosuus     = kiinteä per liiga (tasapuolinen)
    pelaajamyynnit = siirtosumma (jos myyt)

  Menot:
    palkat         = SUM(pelaaja.palkka) per kausi
    harjoituskulut = valittu ohjelma-intensiteetti × kerroin
    siirtomaksut   = maksetut siirtosummat
    hallikulut     = kiinteä per ottelu

  TULOS = tulot - menot
  kassavaranto += tulos  # kumulatiivinen saldo

GAME OVER -EHTO (irtisanominen):
  # Tarkistushetki: kauden päätyttyä, ENNEN uuden kauden siirtoikkunaa
  # Pelaaja voi estää game overin myymällä pelaajia siirtoikkunassa (tulot realisoituvat heti)
  # Lainoja tai hallituksen bailoutia EI ole MVP:ssä
  IF kassavaranto < 0 kauden lopussa:
    varoitus (1. kerta: "Hallitus antaa lisäaikaa — myy tai säästä")
    # Pelaajalle näytetään kassavaje ja ehdotettu säästötoimenpide
  IF kassavaranto < 0 KAHTENA peräkkäisenä kauden lopussa:
    game over — "Hallitus irtisanoo sinut"
  # Kassavaranto = kumulatiivinen rahavaranto kauden päättyessä.
  # Negatiivinen = joukkue maksukyvytön.

FANITUKI (0–100):
  kasvaa: voitot, mestaruus, nuorten nostaminen
  laskee: häviöputket, tähtilähtö, budjettileikkaukset
  vaikuttaa: täyttöasteeseen → lipputuloihin
```

---

## 5. UI/UX-rakenne

### 5.1 Päänavigaatio

Vasen sidebar (pysyvä), 7 päänäkymää:

```
[Cold GM logo]
──────────────
📊 Dashboard
👥 Roster
⚔️  Taktiikat
🔍 Siirtomarkkinat
🏋️  Harjoittelu
💰 Talous
🏒 Ottelu
──────────────
[Kausi: 1 | Pvä: 47]
[Seuraava: vs. Wolves]
```

### 5.2 Näkymäkuvaukset

**Dashboard:**
- Seuraavan ottelun info (vastustaja, muoto, loukkaantumiset)
- Roster-terveysmittari (% kunnossa)
- Budjettitilanne (palkkapotti vs. tulos)
- Liigasijoitus + pisteet
- Ilmoitusfeed (siirtotarjoukset, mediauutiset)

**Roster:**
- Sortatettava taulukko: nimi, ikä, positio, top-3-attribuuttia, palkka, sopimuksen pituus
- Klikkaa pelaajaa → pelaajan profiilisivu (kaikki attribuutit, kehityskäyrä, sopimus)
- Filtterit: positio, ikä, arvo, sopimustilanne

**Taktiikat:**
- Kolme linjaa (hyökkäys) + kaksi puolustusparia + MV
- Drag-and-drop kokoonpanoon
- Erityistilanteet: PP1, PP2, PK1, PK2
- Taktiikkaohje per linja: "Hyökkäävä" / "Tasapainoinen" / "Puolustava"

**2D-ottelunäkymä:**
- Koko ruutu: jääkiekkokenttä yläpuolelta
- Vasen yläkulma: pisteet, aika, erä
- Oikealla: tapahtumaseuranta (tekstitiivistelmä viimeisistä 5 tapahtumasta)
- Alaosa: aktiiviset linjat, fatigue-palkit, MV-tilasto
- Painikkeet: vaihda linja, timeout (2 per ottelu), pikasimuloi loppuun

**Siirtomarkkinat:**
- Vapaiden agenttien lista (suodatettavissa)
- Siirtopyyntöilmoitukset (omilta pelaajilta tai muilta joukkueilta)
- Scoutausjonoon lisäys (P1)

**Harjoittelu:**
- Viikkokalenteri (7 päivää)
- Fokusvalinta päivälle: napit + tooltip kustannuksista ja hyödyistä
- Fatigue-yhteenveto per pelaaja (värikoodattu: vihreä/keltainen/punainen)

**Talous:**
- Tuloslaskelma: tämä kausi vs. edellinen kausi
- Palkkarakenne: taulukko ja piirakkakaavio
- Lipputulo-ennuste (fanituen mukaan)

### 5.3 Progressiivinen paljastaminen

Uusi pelaaja: näkee yksinkertaistetun näkymän (top-3 attribuuttia, karkeat talousluvut).
Asetuksissa: "Edistynyt tila" — avaa kaikki 12 attribuuttia, tarkat talousnäkymät, sim-tilastot.

### 5.4 Onboarding

- 3-ottelun tutoriaalikausi (ohjattu, ei rangaistuksia)
- Kontekstuaaliset tooltiptit (näkyvät ensikertalaiselle, piiloutuvat kun klikataan)
- Pelinsisäinen wiki (hakutoiminto)

---

## 6. Tekninen arkkitehtuuri

### 6.1 Stack

| Kerros | Teknologia | Perustelu |
|---|---|---|
| Engine | Godot 4.3+ | Ilmainen, erinomainen 2D, GodotSteam |
| Pelilogiikka | GDScript | Nopea kehitys, Godt-natiivi |
| Sim-ydin | C# (Godot Mono) | Suorituskyky massimulaatiossa |
| Tietokanta | SQLite (godot-sqlite) | Paikallinen, modaajille helppo |
| Steam | GodotSteam 4.x | Saavutukset, Workshop, Cloud |
| Modausdata | JSON + CSV | Ihmisluettava, helppo editoida |
| Build | GitHub Actions | Automaattiset Windows/Linux/Mac buildit |

### 6.2 Hakemistorakenne

```
cold_gm/
├── project.godot
├── src/
│   ├── core/            # Simulaatioydin (C#)
│   │   ├── MatchSimulator.cs
│   │   ├── PlayerModel.cs
│   │   └── EconomyEngine.cs
│   ├── ui/              # Näkymät (GDScript)
│   │   ├── Dashboard.gd
│   │   ├── MatchView.gd
│   │   └── RosterView.gd
│   ├── data/            # Datamallit ja lataajat
│   │   ├── LeagueLoader.gd
│   │   └── SaveManager.gd
│   └── steam/           # Steam-integraatio
│       └── SteamManager.gd
├── assets/
│   ├── sprites/
│   ├── fonts/
│   └── audio/
├── mods/                # Modausdata (myös Workshop-modit tänne)
│   └── base/
│       ├── leagues/
│       │   └── north_league.json
│       ├── players.csv
│       └── logos/
└── docs/
```

### 6.3 Modausrajapinta

**`leagues/north_league.json`:**
```json
{
  "league_id": "north_1",
  "name": "Northern Premier League",
  "teams": [
    {
      "team_id": "wolves",
      "name": "Arctic Wolves",
      "city": "Rovaniemi",
      "logo": "logos/wolves.png",
      "primary_color": "#1a3a6b",
      "secondary_color": "#ffffff",
      "arena_capacity": 8500
    }
  ]
}
```

**`players.csv` (otsikkorivi + data):**
```
player_id,first_name,last_name,age,nationality,position,skating,shooting,...
```

Steam Workshop: modit ladataan `user://workshop/<mod_id>/`-polkuun, engine yhdistää base-datan ja modeista ladatun datan käynnistyksessä.

### 6.4 Tallennus

- Tallennusslotteja: 3 manuaalista + 1 automaattinen
- Formaatti: pakattu JSON (gzip)
- Steam Cloud Saves: synkronointi automaattisesti

---

## 7. MVP-roadmap (8 kuukautta → Early Access)

| Sprint | Kk | Tavoite | Valmistumiskriteeri |
|---|---|---|---|
| 1 | 1–2 | Perusdatamallit ja liigageneraattori | 1 500 pelaajaa generoituna, kausirakenne toimii, tallennus/lataus toimii |
| 2 | 3–4 | Ottelusimulaatioydin + tekstiraportti | Koko kausi simuloitavissa, tilastot laskettuna, talouslogiikka toimii |
| 3 | 5–6 | 2D-ottelunäkymä + taktiikat | Ottelu näkyy 2D:nä, linjavaihto, timeout, pikasimuloi; taktiikat vaikuttavat sim-tuloksiin |
| 4 | 7 | Modausrajapinta + Steam SDK + UI-polish | Workshop-modi latautuu, saavutukset toimivat, pilvitallennus toimii |
| 5 | 8 | Testaus + tasapainotus + julkaisu | 500+ simuloitua kautta, tilastot realistiset, Steam-sivu julki, EA-launch |

### Tasapainotusmetodologia

Sprint 5:ssä ajetaan Monte Carlo -tyyppinen massimulaatio:
```
FOR i IN 1..500:
  simulate_full_season(random_tactics_variation)
  record(goals_per_game, save_pct, pp_efficiency, score_distribution)
ANALYZE:
  goals_per_game → tavoite 2.5–3.5 (NHL-realismi)
  save_pct → tavoite 0.89–0.915
  pp_efficiency → tavoite 18–24%
TUNE: attribuuttikerroimia kunnes kaikki osuvat haarukkaan
```

---

## 8. Monetisaatio ja yhteisöstrategia

### Hinnoittelu
- Early Access: **14,99 €** (matala kynnys, kerää ensiarvostelut)
- Täysi julkaisu: **24,99 €** (EA:n ostajat saavat pysyvästi)
- Ei tilauksia, ei mikromaksuja

### DLC-polku (täyden julkaisun jälkeen)
- "Legends Pack": historialliset fiktiiviisit pelaajatähdet (+5 €)
- "International Expansion": lisäliigoja Eurooppa/Pohjois-Amerikka (+5 €)
- Kosmetiikka: manageritoimiston ulkoasut, pisteytysanimaatiot (+3 €)

### Yhteisö
- Steam Workshop: ilmainen, avoin modausrajapinta
- Discord-server: bugipalautteen ja tasapainotusehdotusten primäärikanava
- Community Hub: kuukausittaiset "parhaat modit" -nostot
- Early Access -päivitykset: joka 4–6 viikko (näkyvyys Steam-uutisissa)

### Telemetry (opt-in)
- Pelaajaistuntojen pituus, yleisimmät taktiikat, joukkueiden suosio
- Käytetään tasapainotukseen ja sisältöpäätöksiin
- GDPR-yhteensopiva, täysin valinnainen

---

## 9. Riskit ja mitigaatiot

| Riski | Todennäköisyys | Mitigaatio |
|---|---|---|
| 2D-simulaatio vie liikaa aikaa | Keskisuuri | Sprint 3:ssa prototyyppi ensin; jos liian hidas, yksinkertaistaa animaatiot |
| FHM julkaisee merkittävän päivityksen | Pieni | Differointi UX:llä ja modaustuella, ei pelkästään sim-syvyydellä |
| Solo-kehittäjä uupuu | Keskisuuri | EA ensin, tulo mahdollistaa avun ostamisen; selkeä P0/P1/P2-priorisointi |
| Modausyhteisö ei synny | Pieni | Julkaistaan itse 2–3 "virallista" mod-pakettia yhteisön käynnistämiseksi |
| Tasapainotus epäonnistuu | Pieni | Monte Carlo -testaus Sprint 5:ssä, EA kerää dataa |
