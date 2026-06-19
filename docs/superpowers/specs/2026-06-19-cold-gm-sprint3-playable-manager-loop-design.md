# Cold GM — Sprint 3: Playable Manager Loop

**Spesifikaatio | 2026-06-19 | Sprint 3 (uudelleenpriorisoitu)**

> **Konteksti:** markkinatutkimus osoitti että meillä on vahva *moottori* mutta ei vielä *peliä*.
> Tärkein puuttuva pala on pelattava manageri-päivälooppi. Tämä spec korvaa aiemman laajan
> Sprint 3 -luonnoksen (attribuutit+taktiikat+2D); sen sisältö siirtyy myöhemmille sprinteille
> (ks. §9 roadmap). Tämä sprintti tekee moottorista pelin **nykyisellä simulla ja attribuuteilla**.

---

## 1. Tavoite ja laajuus

### Ydintavoite
Pelattava **pystyviiva**: pelaaja aloittaa pelin, valitsee joukkueen, näkee dashboardin,
katsoo rosterin ja sarjataulukon, pelaa seuraavan ottelun, lukee otteluraportin, edistää päivää,
ja tallentaa/lataa — kausi toisensa jälkeen. Ei uusia simusysteemejä; **olemassa oleva moottori
kääritään pelattavaan UI-kuoreen.**

### Mukana (P0)
- Aloitusvalikko: Uusi peli / Jatka (lataa).
- Joukkuevalinta (Premier-liigasta).
- Dashboard (hub): joukkueen identiteetti, sija + W-L-OTL-pisteet, seuraava ottelu, kassa, napit.
- Rosterinäkymä: pelaajalista (nimi, positio, ikä, OVR, status); klikkaus → pelaajaprofiilikortti.
- Pelaajaprofiilikortti: **nykyiset attribuutit** broadcast-tyylillä (laajennetaan S6:ssa).
- Sarjataulukko: oma liiga, korostettu oma joukkue; pistepörssin kärki (kausitilastoista).
- "Pelaa seuraava ottelu" → `GameRunner` → tekstiotteluraportti → advance day (AI-ottelut).
- "Edistä päivää" kun ei omaa ottelua → `SeasonManager.advance_day`.
- Kausi → playoffit → kausivaihto pyörii (SeasonManager) ja näkyy loopissa.
- Save/Load (GameState).

### Laajuuden ulkopuolella (YAGNI — myöhemmät sprintit, §9)
- 2D-ottelunäkymä (S5) — ottelu näytetään **tekstiraporttina** nyt.
- Ketju-/taktiikkaeditori (S4) — kokoonpano valitaan automaattisesti (nyk. `build_team_input` top-18).
- EHM-27-attribuuttimalli + kontestoitu moottori + xG (S6) — kortti käyttää nyk. attribuutteja.
- Pelaajatyypit & chemistry (S4); scouting/draft/prospektit, persoonat/moraali, AI-GM, historia (myöhemmin).
- Siirrot, sopimukset, cap, staff (myöhemmin).

### Attribuuttilupaus (lukittu roadmappiin)
Attribuutit ovat pelin syvyyden ydin ja PYSYVÄT keskeisinä — ei pudoteta:
- **Jo nyt:** nykysimu erottaa pelaajat attribuuteilla → kokoonpanon vahvuus näkyy tuloksissa.
- **S4:** roolit + pelaajatyypit + chemistry tekevät attribuuttieroista päätösten arvoisia.
- **S6:** syvä EHM-attribuuttimalli + kontestoitu moottori → pelaajat suoriutuvat oikeasti erilailla.
Tämä sprintti rakennetaan **estämättä** näitä: pelaajaprofiilikortti on attribuuttipohjainen ja
suoraan laajennettavissa, eikä mikään UI kovakoodaa nykyistä 12-attribuutin settiä.

---

## 2. Visuaalinen suunta (säilyy)

Broadcast-tyyli kuten aiemmin: tumma kromi `#14161b`, paneeli `#1a1d26`, korostus `#6ea8e6`,
teksti `#e2e4e9`/`#7a7f8e`. OVR-värikoodaus (kulta ≥16 `#e3b341`, vihreä 12–15 `#57b368`,
sininen 10–11 `#6ea8e6`, harmaa <10). Joukkuevärit `TeamData.primary/secondary_color`.

- **Yksi jaettu `Theme`** (`assets/theme/cold_gm_theme.tres`) + värivakiot `src/ui/ui_palette.gd`
  (`ovr_color`, `attr_color`). Ei kovakoodattuja värejä per näkymä.
- **/design-työnkulku:** jokaisesta näkymästä korkearesoluutioinen mockup ENNEN toteutusta;
  toteutusta verrataan siihen. Dashboard/rosteri/taulukko ovat siistejä kortteja/tauluja, ei blankkeja.

---

## 3. Näkymät ja navigaatio

`SceneRouter` (autoload) vaihtaa pakatut näkymät; pitää pinon "takaisin"-navigointiin.

```
main_menu ──"Uusi peli"──> team_select ──valitse──> dashboard
main_menu ──"Jatka"──────> GameState.load_slot() ──> dashboard

dashboard ──"Rosteri"────────> roster ──klikkaa pelaajaa──> player_profile ──takaisin──> roster
dashboard ──"Sarjataulukko"──> standings ──takaisin──> dashboard
dashboard ──"Pelaa ottelu"───> (GameRunner) ──> game_report ──"Jatka"──> (advance day) ──> dashboard
dashboard ──"Edistä päivää"──> (SeasonManager.advance_day) ──> dashboard
dashboard ──"Tallenna"───────> GameState.save()
```

### Tiedostorakenne
```
src/ui/
  scene_router.gd            (UUSI autoload: näkymien vaihto + back-pino)
  ui_palette.gd              (UUSI: värivakiot + ovr_color/attr_color)
  main_menu.gd/.tscn         (UUSI)
  team_select.gd/.tscn       (UUSI)
  dashboard.gd/.tscn         (UUSI)
  roster.gd/.tscn            (UUSI)
  player_profile.gd/.tscn    (UUSI: kortti nyk. attribuuteilla)
  standings.gd/.tscn         (UUSI)
  game_report.gd/.tscn       (UUSI: tekstiraportti + tähtipelaaja)
  components/
    player_row.gd/.tscn      (UUSI: rosterin rivi)
    standings_row.gd/.tscn   (UUSI: taulukon rivi)
src/systems/
  loop_queries.gd            (UUSI: puhtaat apurit — seuraava ottelu, taulukko-rivit, rosteri-rivit, pörssi)
assets/theme/cold_gm_theme.tres  (UUSI)
tests/gut/
  test_loop_queries.gd       (UUSI)
  test_ui_smoke.gd           (UUSI: jokainen .tscn instantioituu headless ilman virhettä)
  test_ui_palette.gd         (UUSI: ovr_color/attr_color rajat)
project.godot                (MUOKKAA: main scene = main_menu; autoloadit: SceneRouter)
```

---

## 4. Näkymät yksityiskohtaisesti

### 4.1 main_menu
"Uusi peli" → team_select. "Jatka" → `GameState.load_slot(0)`; jos tallennusta ei ole, nappi
himmennetty. Tyylitelty otsikko/logo, broadcast-paletti.

### 4.2 team_select
Listaa Premier-liigojen joukkueet (väri, nimi, kaupunki, alue). Valinta →
`GameState.start_new_game(team_id, league_id)` (olemassa) → dashboard. (First Divisionista
aloittaminen on myöhempi laajennus.)

### 4.3 dashboard (hub)
Lukee `GameState.world`. Näyttää:
- Joukkueen identiteetti (nimi, väri, alue/liiga), sija liigassa, W-L-OTL + pisteet, GF/GA.
- **Seuraava ottelu:** vastustaja, koti/vieras, päivä (`loop_queries.next_game_for`).
- Kassa (`cash_balance`) ja kevyt talousvihje.
- Napit: Rosteri, Sarjataulukko, **Pelaa ottelu** (jos oma ottelu tänään) / **Edistä päivää**, Tallenna.
- Kuuntelee `EventBus`-signaaleja (match_result, game_day_advanced, season_ended) päivittääkseen näkymän.

### 4.4 roster
Pelaajalista `player_row`-komponenteilla: pelinumero/positio, nimi, ikä, OVR (värikoodattu),
status (terve/loukkaantunut+viikot, kunto/fatigue). Lajiteltavissa (OVR/positio/ikä). Maalivahdit eroteltu.
Klikkaus rivistä → player_profile.

### 4.5 player_profile
Pelaajaprofiilikortti broadcast-tyylillä **nykyisillä attribuuteilla** (Technical: skating, shooting,
passing, puck_handling; Tactical: positioning, defensive_play, power_play; Physical: speed, stamina,
checking; Mental: composure, team_spirit) — kukin värikoodattu `attr_color`. Header: numero-avatar,
nimi, positio, OVR, ikä/kansallisuus/palkka/sopimus. Kausitilastorivi (GP, G, A, P, SOG). MV-versio:
MV-attribuutit + torjunta%. **Layout suunniteltu laajenemaan** S6:n EHM-settiin (3-sarakkeinen ruudukko).

### 4.6 standings
Oman liigan sarjataulukko `standings_row`-riveillä: sija, joukkue (väri+nimi), GP, W, L, OTL, P,
GF, GA, GD; oma joukkue korostettu. `loop_queries.standings_rows(league)`. Lisäksi pistepörssin
top-10 (`loop_queries.scoring_leaders`). (Liigan vaihto valinnainen lisä.)

### 4.7 Ottelun pelaaminen + game_report
- "Pelaa ottelu": `loop_queries.next_game_for(world, player_team)` → `GameRunner.run_game(game, home,
  away, seed)` (sama seed-johtaminen kuin SeasonManagerissa) → `TextReport.generate(result, ...)`.
- game_report: lopputulos (OT-merkki), maalit erittäin (aika/tekijä/syöttäjä), laukaukset, **tähtipelaaja**
  (eniten pisteitä ottelussa), play-by-play tekstinä. "Jatka" → `GameState.advance_day()` pelaa loput
  sen päivän AI-ottelut → dashboard.
- Reuna: jos pelaajan ottelua ei tänään, dashboard näyttää "Edistä päivää" joka kutsuu `advance_day`.
- Kausi valmis → SeasonManager ajaa playoffit + kausivaihdon; dashboard näyttää uuden kauden / mestarin.
  Game over (`consecutive_negative_seasons >= 2`) → "GAME_OVER:"-signaali → lopetusruutu/uusi peli.

---

## 5. Olemassa olevan moottorin uudelleenkäyttö (ei simumuutoksia)

| Tarve | Käytetään | Muutos |
|---|---|---|
| Maailman luonti / pelin aloitus | `GameState.start_new_game` (WorldFactory) | ei |
| Ottelun ajo | `GameRunner.run_game` | ei |
| Päivän edistys + AI-ottelut + viikkotreeni | `SeasonManager.advance_day` (GameState kautta) | ei |
| Playoffit + kausivaihto | `SeasonManager.run_playoffs/end_season` | ei |
| Otteluraportti | `TextReport.generate` | ei |
| Tallennus/lataus | `GameState.save/load_slot` (SaveManager) | ei |
| Signaalit | `EventBus` (match_result, game_day_advanced, season_ended) | ei (UI kuuntelee) |

**Simu, mallit ja talous pysyvät koskemattomina.** Tämä on puhtaasti UI-kerros + ohuet kyselyapurit.

---

## 6. Testattavat apurit + smoke-testit

UI:n logiikka eristetään `loop_queries.gd`-luokkaan (puhdas, ei Node-riippuvuutta):
- `next_game_for(world, team) -> ScheduledGame` (seuraava pelaamaton oma ottelu).
- `standings_rows(league) -> Array` (lajiteltu taulukko: sija, W-L-OTL-P-GF-GA-GD).
- `roster_rows(team) -> Array` (lajiteltu pelaajalista + status).
- `scoring_leaders(league, n) -> Array` (pistepörssi kausitilastoista).
- `star_of_game(result) -> String` (ottelun tähti).

**Testit:**
- `test_loop_queries.gd` — kukin apuri (seuraava ottelu, taulukon järjestys/tiebreak, pörssi, tähti).
- `test_ui_smoke.gd` — jokainen `.tscn` instantioituu headless-tilassa ilman virhettä; `SceneRouter`
  vaihtaa näkymästä toiseen.
- `test_ui_palette.gd` — `ovr_color`/`attr_color` tasorajat.
- **Sprint 2:n 94 testiä pysyvät vihreinä** (ei simumuutoksia).

---

## 7. Datavirta

```
main_menu ─Uusi peli→ team_select ─valitse→ GameState.start_new_game ─→ dashboard
dashboard ←lukee── GameState.world  (EventBus-signaalit päivittävät näkymän)
dashboard ─Pelaa→ loop_queries.next_game_for → GameRunner.run_game → TextReport → game_report
game_report ─Jatka→ GameState.advance_day (AI-ottelut, viikkotreeni, EventBus) → dashboard
[kausi valmis] → SeasonManager: playoffit → end_season (talous, nousu/putoaminen, uusi kalenteri) → dashboard
dashboard ─Tallenna→ GameState.save();  main_menu ─Jatka→ GameState.load_slot → dashboard
```

---

## 8. Hyväksymiskriteerit (Sprint 3 valmis kun)

- [ ] Pelaaja voi aloittaa uuden pelin, valita joukkueen ja nähdä dashboardin.
- [ ] Rosteri ja sarjataulukko näkyvät siisteinä (broadcast-tyyli, värikoodattu OVR); pelaajaprofiilikortti
      avautuu klikkaamalla ja näyttää nyk. attribuutit + kausitilastot.
- [ ] "Pelaa ottelu" ajaa oman ottelun, näyttää tekstiraportin tähtipelaajineen, ja edistää päivän.
- [ ] Koko kausi on pelattavissa loopissa runkosarjasta playoffeihin ja kausivaihtoon asti.
- [ ] Save/Load toimii loopin läpi; "Jatka" palauttaa pelin.
- [ ] Yksi jaettu Theme; ei kovakoodattuja värejä; paletti §2:n mukainen; jokainen näkymä vastaa mockupia.
- [ ] `loop_queries`-apurit ja UI-smoke-testit vihreinä; Sprint 2:n 94 testiä pysyvät vihreinä.

---

## 9. Roadmap (uudelleenpriorisoitu markkinatutkimuksen perusteella)

| Sprint | Sisältö | Tila |
|---|---|---|
| **3 — Playable Manager Loop** | tämä spec | suunniteltu |
| **4 — Ketjut, roolit, pelaajatyypit & chemistry** | kokoonpanopäätökset jotka muokkaavat simua; arkkityypit (Sniper/Playmaker/Two-way/Grinder/Offensive D/Shutdown D/Butterfly-MV); chemistry oikeana synergiana | tutkimus: nyk. taktiikka-spec + §6 chemistry |
| **5 — 2D-ottelunäkymä** | broadcast-2D (mailat, kiekon hallinta, harhautus, live-box-score, xG-esitys) | tutkimus: `research/2026-06-19-2d-view-rendering-stats-xg.md` |
| **6 — Syvä attribuuttimalli + moottori 2.0** | EHM-27-attribuutit + kontestoidut tapahtumat + xG; pelaajat suoriutuvat oikeasti erilailla | tutkimus: `research/2026-06-19-match-engine-2.0-contested-events-xg.md` + aiempi attribuutti-spec |
| **7+ — Syvyys & tarinat** | scouting/draft/prospektit; persoonat/moraali → emergentit tarinat; AI-GM-suunnitelmat (rebuild/contend/balanced/budget); historia/ennätykset/dynastiat | backlog (markkinatutkimus) |

**Ei vielä (markkinatutkimus vahvistaa):** koko NHL CBA (LTIR, arbitration, buyouts, offer sheets,
retention); täydet juniorisarjat simuloituina. Tehdään kun ydinpeli koukuttaa.

---

## 10. Avoimet päätökset (oletukset, voi muuttaa)

1. **Kokoonpano** valitaan automaattisesti (nyk. top-18) kunnes S4 tuo ketjueditorin.
2. **Joukkuevalinta** vain Premier-liigoista; First Divisionista aloitus myöhemmin.
3. **Ottelu tekstiraporttina** kunnes S5 tuo 2D-näkymän; game_report-näkymä on sama riippumatta esitystavasta.
4. **Yksi tallennusslotti** (slot 0) riittää tähän sprinttiin; useat slotit myöhemmin.
