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
  test_loop_queries.gd       (UUSI: next_game, taulukko, pörssi, tähti, player_name)
  test_game_state_advance.gd (UUSI: vaiheorkestrointi — runkosarja→playoffit→kausivaihto, ei jumia)
  test_ui_smoke.gd           (UUSI: jokainen .tscn instantioituu headless ilman virhettä)
  test_ui_palette.gd         (UUSI: ovr_color/attr_color rajat)
src/autoload/game_state.gd   (MUOKKAA: lisää vaihetietoinen advance() — §4.8, UI-glue)
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
- **HUOM:** `season_ended` kantaa kahta merkitystä: mestarin id TAI `"GAME_OVER:<id>"`. Dashboard
  haarauttaa `"GAME_OVER:"`-prefiksillä (mestari ≠ game over).

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
- game_report: lopputulos (OT-merkki), maalit erittäin (aika/tekijä/syöttäjä, **nimet** ei id:t —
  `loop_queries.player_name`), laukaukset, **tähtipelaaja**, play-by-play tekstinä. "Jatka" →
  `GameState.advance(world)` (vaihetietoinen, §4.8) → dashboard.
- Reuna: jos pelaajan ottelua ei tänään, dashboard näyttää "Edistä päivää" joka kutsuu `GameState.advance`.
- Kausi valmis → vaiheorkestrointi (§4.8) ajaa playoffit + kausivaihdon; dashboard näyttää mestarin / uuden kauden.
  Game over → `season_ended.emit("GAME_OVER:"+team_id)` → lopetusruutu/uusi peli.

### 4.8 Kausivaiheen orkestrointi (GameState-lisäys — UI-glue, EI sim/malli-muutos)
**Reviewin nostama aukko:** nyk. `GameState.advance_day()` kutsuu vain `_season_manager.advance_day`
(pelaa päivän ottelut + kasvattaa päivää) — se EI havaitse runkosarjan päättymistä eikä aja playoffeja
tai kausivaihtoa. Vain `simulate_full_season` ketjuttaa ne. Loop tarvitsee **vaihetietoisen edistyksen**.

Lisätään `GameState.advance(world)` (tai laajenna `advance_day`), joka käyttää SeasonManagerin
**julkista APIa** (`is_regular_season_complete`, `run_playoffs`, `end_season`) — GDScript-glue
autoloadissa, ei kosketa C#-simua, malleja eikä taloutta:
```gdscript
func advance() -> void:
    if not _all_premier_regular_complete():
        _season_manager.advance_day(world)
    elif not _all_premier_playoffs_complete():
        for lg in _premier_leagues(): _season_manager.run_playoffs(world, lg)
    else:
        _season_manager.end_season(world)   # talous, nousu/putoaminen, uusi kausi+kalenteri
```
Apurit `_all_premier_regular_complete` / `_all_premier_playoffs_complete` / `_premier_leagues`
iteroivat `world.leagues` (tier == PREMIER). Testataan `test_game_state_advance.gd`:llä:
runkosarja → playoffit → kausivaihto → seuraavan kauden runkosarja, ilman jumiutumista.

---

## 5. Olemassa olevan moottorin uudelleenkäyttö

| Tarve | Käytetään | Muutos |
|---|---|---|
| Maailman luonti / pelin aloitus | `GameState.start_new_game` (WorldFactory) | ei |
| Ottelun ajo | `GameRunner.run_game` | ei |
| Päivän edistys + AI-ottelut + viikkotreeni | `SeasonManager.advance_day` | ei |
| Playoffit + kausivaihto | `SeasonManager.run_playoffs/end_season` | ei (metodit ennallaan) |
| **Vaiheorkestrointi** (runkosarja→playoffit→kausivaihto) | **`GameState.advance` (UUSI glue)** | **UUSI GDScript-glue autoloadissa, käyttää SeasonManagerin julkista APIa** |
| Id → pelaajan nimi (raportti/pörssi) | **`loop_queries.player_name(world, id)` (UUSI)** | UUSI apuri (raaka virta käyttää id:itä) |
| Otteluraportti | `TextReport.generate` | ei |
| Tallennus/lataus | `GameState.save/load_slot` (SaveManager) | ei |
| Signaalit | `EventBus` (match_result, game_day_advanced, season_ended) | ei (UI kuuntelee) |

**Simu (C#), mallit ja talous pysyvät koskemattomina.** Ainoa uusi ei-UI-koodi on
`GameState`-vaiheorkestrointi (§4.8) — GDScript-glue joka käyttää SeasonManagerin julkista APIa.

---

## 6. Testattavat apurit + smoke-testit

UI:n logiikka eristetään `loop_queries.gd`-luokkaan (puhdas, ei Node-riippuvuutta):
- `next_game_for(world, team) -> ScheduledGame` (seuraava pelaamaton oma ottelu; suodatin `not is_played`).
- `standings_rows(league) -> Array` (lajiteltu taulukko: sija, W-L-OTL-P-GF-GA-GD).
- `roster_rows(team) -> Array` (lajiteltu pelaajalista + status).
- `scoring_leaders(league, n) -> Array` (pistepörssi — iteroi **kaikki liigan joukkueet**, ei vain omaa).
- `star_of_game(result, world) -> String` (ottelun tähti; palauttaa **nimen** id:n sijaan).
- `player_name(world, id) -> String` (id → "Etunimi Sukunimi"; raaka tapahtumavirta käyttää id:itä,
  joten raportti/pörssi/tähti resolvoivat nimet tällä).

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
game_report ─Jatka→ GameState.advance (§4.8 vaihetietoinen) → dashboard
   ├─ runkosarja kesken → SeasonManager.advance_day (AI-ottelut, viikkotreeni, EventBus)
   └─ runkosarja valmis → run_playoffs (kaikki premier) → end_season (talous, nousu/putoaminen, uusi kalenteri)
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
