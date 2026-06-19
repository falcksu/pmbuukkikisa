# Cold GM — Sprint 3: 2D-ottelunäkymä + taktiikat + kevyt kuori

**Spesifikaatio | 2026-06-19 | Sprint 3**

> Edeltävät: Sprint 1 (datapohja, 53 testiä) ja Sprint 2 (ottelusimu + talous, 94 testiä) valmiit.
> Tämä spec kattaa pelin **ensimmäisen graafisen kerroksen**: 2D-otteluvisualisoinnin,
> taktiikkanäkymän ja kevyen navigaatiokuoren, joka sitoo ne yhteen pelattavaksi silmukaksi.

---

## 1. Tavoite ja laajuus

### Ydintavoite
Tehdä pelin **pääerottautumistekijä näkyväksi ja pelattavaksi**: pelaaja asettaa
taktiikat (ketjut + strategia), pelaa ottelun ja **katsoo sen 2D-näkymässä** broadcast-tyylillä,
ja näkee tuloksen. Yksi yhtenäinen silmukka uudesta pelistä otteluun ja takaisin.

### Sprint 3:n kolme pilaria
1. **Taktiikkanäkymä** (NHL-pelien tyylinen ketjueditori) — pelaaja päättää kokoonpanon ja strategian.
2. **2D-ottelunäkymä** (broadcast-tyyli) — pre-lasketun tapahtumavirran visuaalinen toisto.
3. **Kevyt kuori** — minimaalinen navigaatio joka tekee yllä olevista pelattavan kokonaisuuden.

### Arkkitehtoninen kulmakivi (lukittu päätös)
Simulaatio ajetaan **kokonaan loppuun ENNEN visualisointia** (`GameRunner.run_game`
tuottaa täyden tuloksen + `events`-virran determinisesti). 2D-näkymä on tämän valmiin
tapahtumavirran **toisto/replay**, EI tikittävä reaaliaikasimu.

**Miksi:** säilyttää Sprint 2:n determinismin (sama seed + taktiikat → sama tulos),
tekee "pikasimuloi loppuun" -toiminnosta triviaalin (lopeta animaatio, näytä jo tiedossa
oleva tulos), ja pitää sim-logiikan ja esityskerroksen täysin erillään.

**Rehellisyys esityksestä:** tapahtumavirta sisältää vain maalit, torjunnat ja jäähyt
(~50–70 tapahtumaa/ottelu). Kiekkojen ja pelaajien liike tapahtumien VÄLISSÄ on
**proseduraalista, uskottavaa ambienssia** (Tween), ei kirjaimellinen pelaajien
sijaintisimu. Näkymä on eloisa abstraktio joka on ankkuroitu oikeisiin tapahtumiin.

### Laajuuden ulkopuolella (YAGNI — Sprint 4+)
- Siirtomarkkina, sopimusneuvottelut, pelaajaskautti
- Täydet talous-/budjettinäkymät (talous laskee taustalla kuten Sprint 2:ssa)
- Sarjataulukko-/tilastoselainnäkymät (hubissa vain minimitiedot)
- Audio/SFX, musiikki
- Steam Workshop / modaus
- Useat PP/PK-yksiköt (vain PP1 + PK1 Sprint 3:ssa)
- Tallennusvalikon kiillotus (autoload `GameState.save/load` on jo olemassa; kuori kutsuu sitä)

---

## 2. Visuaalinen suunta (ensiluokkainen vaatimus)

Ulkoasu ei ole jälkikäteen lisättävä kuorrutus — se on Sprint 3:n hyväksymiskriteeri.
Taidesuunta on **"urheilulähetys" (broadcast)**: tumma kromi, kirkas jää, joukkueväriset elementit.

### Paletti (lukittu)
| Rooli | Väri | Käyttö |
|---|---|---|
| Tausta (kromi) | `#14161b` | Kaikkien näkymien pohja |
| Paneeli | `#1a1d26` | Kortit, palkit, paneelit |
| Reuna | `#22252e` / `#2a2d38` | Erottimet, korttireunat |
| Jää | `#e8edf2` | Kaukalon pinta 2D-näkymässä |
| Kaukalon viivat | `#6ea8e6` (sininen) / `#c44` (punainen keskiviiva) | Maali-/sini-/keskiviivat |
| Korostus | `#6ea8e6` | Otsikot, aktiiviset elementit |
| Teksti | `#e2e4e9` (ensisijainen) / `#7a7f8e` (toissijainen) | |

### OVR-ratingien värikoodaus (lukittu, käytetään ketjueditorissa)
| Taso | Väri | Ehto (overall_rating) |
|---|---|---|
| Tähti | Kulta `#e3b341` | ≥ 16 |
| Hyvä | Vihreä `#57b368` | 12–15.99 |
| Keskiverto | Sininen `#6ea8e6` | 10–11.99 |
| Rivipelaaja | Harmaa `#5a5f6e` | < 10 |

### Joukkuevärit
2D-kiekot ja pelaajakorttien pelinumero-avatarit käyttävät `TeamData.primary_color` /
`secondary_color` -kenttiä (jo olemassa). Koti = primary, vieras = oma primary.

### Toteutustapa Godotissa
- **Yksi jaettu `Theme`-resurssi** (`assets/theme/cold_gm_theme.tres`) määrittää fontit,
  värit ja Control-tyylit. Kaikki näkymät käyttävät sitä → yhtenäinen ilme, ei kovakoodattuja värejä per näkymä.
- Värivakiot keskitetään `src/ui/ui_palette.gd`-vakioluokkaan (sama paletti GDScriptistä käytettävänä, esim. OVR-värin valinta).
- **`/design`-työnkulku:** jokaisesta uudesta näkymästä esitetään korkearesoluutioinen mockup
  (visual companion / inline) ENNEN toteutusta, ja toteutusta verrataan siihen. Mockupit
  ketjueditorista ja 2D-näkymästä on jo hyväksytty brainstorming-vaiheessa; ne ovat tämän
  speksin visuaalinen totuuslähde.

---

## 3. Komponentit ja tiedostorakenne

```
src/
  models/
    player_data.gd          (MUOKKAA: lisää handedness)
    team_data.gd            (MUOKKAA: lisää tactics-viittaus)
    tactics_data.gd         (UUSI: ketjut, parit, MV:t, PP/PK, strategiasäätimet)
  systems/
    tactics_builder.gd      (UUSI: auto_generate(team) -> TacticsData, validointi)
  sim/
    match_adapter.gd        (MUOKKAA: build_team_input lukee tactics-rakenteen)
  core/
    MatchSimulator.cs       (MUOKKAA: jääaika-painot, strategiakertoimet, PP/PK-yksiköt)
    SimContext.cs           (MUOKKAA: SimSkater.IceTimeWeight, SimTeam strategiakentät/yksiköt)
  match/
    match_playback.gd       (UUSI: puhdas logiikka — tapahtumavirta + kello -> visuaalitila)
  ui/
    ui_palette.gd           (UUSI: värivakiot + ovr_color(rating))
    scene_router.gd         (UUSI autoload: näkymien vaihto)
    main_menu.gd/.tscn      (UUSI: New Game / Continue)
    hub.gd/.tscn            (UUSI: joukkuehubi — seuraava ottelu, tilanne, napit)
    tactics_screen.gd/.tscn (UUSI: ketjueditori)
    match_view.gd/.tscn     (UUSI: 2D-ottelunäkymä)
    post_match.gd/.tscn     (UUSI: tuloskooste)
    components/
      player_card.gd/.tscn  (UUSI: pelaajakortti — avatar, nimi, positio, OVR)
      rink.gd/.tscn         (UUSI: kaukalo + kiekot)
assets/
  theme/cold_gm_theme.tres  (UUSI)
tests/gut/
  test_tactics_data.gd      (UUSI)
  test_tactics_builder.gd   (UUSI)
  test_match_adapter_tactics.gd (UUSI)
  test_match_sim_tactics.gd (UUSI: strategia/jääaika/PP-yksikkö vaikuttavat tulokseen)
  test_match_playback.gd    (UUSI: toistologiikka)
```

---

## 4. Datamalli

### 4.1 PlayerData-lisäys
```gdscript
enum Handedness { LEFT, RIGHT }
@export var handedness: Handedness = Handedness.LEFT
```
Vain näyttöä varten Sprint 3:ssa (kortin "L"/"R"-merkki). Generaattori arpoo sen
(n. 60 % vasen, kuten oikeassakin jääkiekossa) — `PlayerGenerator`-päivitys.

### 4.2 TacticsData (uusi Resource)
```gdscript
class_name TacticsData
extends Resource

# Hyökkäysketjut: 4 ketjua × 3 paikkaa [LW, C, RW] — player_id:t
@export var forward_lines: Array = [["","",""],["","",""],["","",""],["","",""]]
# Puolustusparit: 3 paria × 2 paikkaa [LD, RD]
@export var defense_pairs: Array = [["",""],["",""],["",""]]
@export var starting_goalie_id: String = ""
@export var backup_goalie_id: String = ""
# Erikoistilanteet
@export var pp_unit: Array = ["","","","",""]   # 5 paikkaa
@export var pk_unit: Array = ["","","",""]       # 4 paikkaa
# Strategiasäätimet (0–100, neutraali 50)
@export var aggressiveness: int = 50
@export var forecheck: int = 50

func all_skater_ids() -> Array          # 12 hyökkääjää + 6 puolustajaa, tyhjät pois
func ice_time_weight_for(pid) -> float  # ketjun mukaan (taulukko alla)
func validate(team) -> Array            # palauttaa virhelistan (tyhjä = ok)
```

**Jääaika-painot (lukittu, sim käyttää):**
| Ryhmä | Paino |
|---|---|
| Hyökkäysketju 1 | 1.30 |
| Hyökkäysketju 2 | 1.10 |
| Hyökkäysketju 3 | 0.80 |
| Hyökkäysketju 4 | 0.50 |
| Puolustuspari 1 | 1.30 |
| Puolustuspari 2 | 1.00 |
| Puolustuspari 3 | 0.60 |

**Validointi (`validate`)** tuottaa virheen jos: sama pelaaja kahdessa paikassa,
loukkaantunut pelaaja paikalla, MV-paikalla ei-MV (tai päinvastoin), tyhjiä pakollisia paikkoja.
UI estää otteluun siirtymisen jos lista ei ole tyhjä.

### 4.3 TeamData-lisäys
```gdscript
@export var tactics: TacticsData = null   # null = auto-generoidaan tarvittaessa
```

### 4.4 TacticsBuilder (uusi)
```gdscript
class_name TacticsBuilder
static func auto_generate(team: TeamData) -> TacticsData
```
- Hyökkääjät overall-järjestyksessä → täytä L1..L4 (paikat LW/C/RW järjestyksessä).
- Puolustajat overall-järjestyksessä → täytä parit 1..3.
- Paras MV → starting, toiseksi paras → backup.
- PP-yksikkö: 5 parasta `power_play + shooting` -summalla.
- PK-yksikkö: 4 parasta `defensive_play + checking` -summalla.
- Loukkaantuneet ohitetaan; jos kenttäpelaajia/MV:itä liian vähän, jätetään paikkoja tyhjiksi
  (validointi nappaa, hätä-MV-logiikka adapterissa kattaa MV-puutteen kuten Sprint 2:ssa).

---

## 5. Simulaation laajennus — taktiikat vaikuttavat mitattavasti

**Taaksepäin-yhteensopivuus (kriittinen):** kaikki uudet parametrit ovat valinnaisia ja
neutraalit oletuksilla (jääaikapaino 1.0, säätimet 50 → kertoimet ≈ 1.0). Ilman taktiikoita
sim käyttäytyy täsmälleen kuten Sprint 2:ssa → **olemassa olevat 94 testiä pysyvät vihreinä.**

### 5.1 build_team_input (match_adapter.gd)
Nykyinen: valitsee top-18 overall-rankingilla. Uusi: jos `team.tactics` on olemassa,
käytä `tactics.all_skater_ids()` (taktiikan määräämät 18) ja liitä per pelaaja:
- `ice_time_weight` = `tactics.ice_time_weight_for(id)`
Lisää team-inputiin: `aggressiveness`, `forecheck`, `pp_unit` (id-lista), `pk_unit` (id-lista),
ja starting goalie taktiikasta. Jos `tactics == null`, säilytä nykyinen top-18-polku
(ice_time_weight = 1.0, säätimet = 50) → identtinen vanha käytös. Hätä-MV-logiikka säilyy.

### 5.2 SimContext.cs / ParseTeam
- `SimSkater.IceTimeWeight` (double, oletus 1.0).
- `SimTeam.Aggressiveness`, `SimTeam.Forecheck` (int, oletus 50).
- `SimTeam.PpUnit`, `SimTeam.PkUnit` (HashSet<string> id:eitä; tyhjä = ei rajoitusta).
- `ParseTeam` lukee nämä `.AsDouble()/.AsInt32()/.AsString()`-purulla; puuttuvat → oletukset.

### 5.3 Kerroinkaavat (lukittu, testattava)
Olkoon `a = Aggressiveness/100`, `f = Forecheck/100` (molemmat 0.5 neutraalilla).
Kertoimet pinotaan olemassa olevien PP/PK-kertoimien PÄÄLLE `MaybeShot`/`MaybePenalty`-funktioissa:

Kaava on **autoritatiivinen**; "Alue"-sarake on vain laskettu havainnollistus (jos ne ovat
ristiriidassa, kaava voittaa).

| Kohde | Kerroin | Alue (säädin 0→100) | Neutraali @50 |
|---|---|---|---|
| Oma laukaustodennäköisyys | `× (0.85 + 0.30·a) × (0.90 + 0.20·f)` | 0.765 → 1.518 | 1.0 |
| Vastustajan laukaustod. | `× (0.85 + 0.30·a)` | 0.85 → 1.15 | 1.0 |
| Vastustajan laukauslaatu | `× (1.05 − 0.10·f)` | 1.05 → 0.95 | 1.0 |
| Oma jäähyaste (PenaltyRate) | `× (0.70 + 0.60·a) × (0.80 + 0.40·f)` | 0.56 → 1.56 | 1.0 |

Tulkinta: **aggressiivisuus** avaa pelin (enemmän laukauksia molempiin suuntiin) ja lisää omia
jäähyjä; **forecheck** painostaa (enemmän omia laukauksia, häiritsee vastustajan laatua, lisää
omia jäähyjä). Säätimet ovat per joukkue (oma taktiikka vs. vastustajan taktiikka).

**Mistä SimTeamista kukin kerroin luetaan (toteuttajalle):** C#:ssa kunkin joukkueen omat
vaikutukset lasketaan sen omassa `MaybeShot(attacking, defending)`/`MaybePenalty`-kutsussa.
Siksi "Oma …" -rivit lukevat `attacking`-joukkueen säätimet, ja **"Vastustajan …" -rivit lukevat
`defending`-joukkueen säätimet** ja vaikuttavat hyökkääjän laukaukseen puolustavana modifierina
(esim. `defending.Forecheck` heikentää hyökkääjän laukauslaatua). Älä lue niitä `attacking`-joukkueesta.

### 5.4 Jääaika ja yksiköt laukaisijan valinnassa
- `SelectShooter`: paino = `Shooting × IceTimeWeight` (oli pelkkä `Shooting`).
  → L1-pelaaja saa enemmän laukauksia kuin L4 (taktiikan ketjujärjestys merkitsee).
- **Ylivoimalla** (vastustajalla jäähy): laukaisija valitaan ensisijaisesti `PpUnit`-joukosta
  (paino `Shooting × IceTimeWeight`, vain PP-yksikön pelaajat; tyhjä yksikkö → koko rosteri).
- **Alivoimalla** (omalla jäähy): laukaisija ja `SelectByChecking`-puolustaja biasoidaan
  `PkUnit`-joukkoon vastaavasti. **Tyhjä `PkUnit` → koko rosteri** (kuten PP-yksiköllä) →
  Sprint 2 -polku säilyy muuttumattomana.
- Determinismi säilyy: RNG-vetojen järjestys ja lähde ennallaan, vain painot muuttuvat.

### 5.5 Testattavuus (GUT-through-interop, kuten Sprint 2)
Tilastolliset väitteet useilla siemenillä (varianssin takia):
- Aggressiivisuus 0 vs 100 (muuten identtiset joukkueet): korkealla yhteismaalimäärä suurempi.
- Forecheck 0 vs 100: korkealla omia laukauksia enemmän JA omia jäähyjä enemmän.
- Sama tähtilaukoja L1:llä vs L4:llä: L1:llä enemmän maaleja keskimäärin.
- PP-yksikkö: yksikön pelaajat tekevät valtaosan ylivoimamaaleista.
- **Determinismi:** sama seed + sama taktiikka → identtinen tulos (regressiotesti).
- **Regressio:** ilman taktiikoita kaikki Sprint 2 -testit vihreinä.

---

## 6. Taktiikkanäkymä (ketjueditori)

NHL-pelien tyylinen, hyväksytyn mockupin mukainen. Broadcast-paletti.

### Layout
- **Otsikkopalkki:** joukkueen nimi/logo, "Tallenna & takaisin", validointivaroitus (jos virheitä).
- **Hyökkäysketjut:** 4 riviä, kukin 3 pelaajakorttia (LW/C/RW). Ketjun oikealla reunalla
  **kemia-mittari** (palkki) — yksinkertainen heuristiikka: ketjun keskiarvo-`team_spirit`
  + `passing` normalisoituna (vain visuaalinen Sprint 3:ssa, ei vaikuta simuun → pidetään rehellisenä:
  mittari kuvaa "ketjun yhteensopivuutta" mutta sim käyttää jääaikapainoja, ei kemiaa).
- **Puolustusparit:** 3 riviä, kukin 2 korttia (LD/RD) + kemia-mittari.
- **Maalivahdit:** 2 korttia (Starter / Backup) erillisinä MV-kortteina (torjunta% jos saatavilla).
- **Erikoistilanteet:** PP1 (5 paikkaa) ja PK1 (4 paikkaa) -rivit.
- **Strategia:** kaksi liukusäädintä — Aggressiivisuus, Forecheck (0–100, oletus 50),
  kuvaavat tekstit ("Varovainen ↔ Hyökkäävä", "Passiivinen ↔ Painostava").

### Pelaajakortti (`player_card.tscn`)
- Pelinumero-avatar (joukkuevärinen ympyrä + numero).
- Nimi (sukunimi korostettuna), positiomerkki, kätisyys (L/R).
- OVR-luku värikoodattuna (§2-taulukko `ui_palette.ovr_color`).
- Loukkaantunut → himmennetty + "INJ"-merkki, ei valittavissa kenttäpaikalle.

### Vuorovaikutus
- Pelaajan vaihto paikkaan: klikkaa paikka → lista valittavista (rosterista) → valitse.
  (Drag-and-drop on Sprint 4:n kiillotusta; Sprint 3:ssa klikkaus + valintalista riittää ja on testattavampi.)
- "Auto-täytä" -nappi → `TacticsBuilder.auto_generate` (nopea aloitus / reset).
- Tallennus kirjoittaa `team.tactics` ja palaa hubiin; validointivirheet estävät otteluun siirtymisen.

---

## 7. 2D-ottelunäkymä

Hyväksytyn mockupin mukainen broadcast-näkymä. Toistaa pre-lasketun tapahtumavirran.

### 7.1 Toistologiikka — `match_playback.gd` (puhdas, testattava)
Erotetaan visuaalisesta kerroksesta jotta GUT voi testata ilman renderöintiä.
```gdscript
class_name MatchPlayback
func _init(result: Dictionary, home: TeamData, away: TeamData)
func advance(delta_game_seconds) -> Array   # palauttaa tapahtumat jotka "laukesivat" tällä askeleella
func score_at_current_time() -> Vector2i     # koti/vieras maalit nykyhetkellä
func is_finished() -> bool
func current_period() -> int
# on-ice -tila: kumman ketjun 5 pelaajaa kentällä (vaihtuu ~45s välein / maalin jälkeen)
func on_ice(team_side) -> Array
```
Tämä luokka tietää tapahtumat ja kellon; se EI tiedä Godot-solmuista. Testit varmistavat:
toisto saavuttaa lopullisen tuloksen, tulos kasvaa monotonisesti, jäähyt aiheuttavat
miesvahvuuseron oikeaksi kestoksi.

### 7.2 Visuaalinen kerros — `match_view.gd` + `rink.tscn`
- **HUD (yläpalkki):** kotijoukkue (väri/nimi) — tulos — vierasjoukkue, erä, kello (laskeva per erä).
- **Kaukalo (`rink.tscn`):** ylhäältä kuvattu jää (#e8edf2), maali-/sini-/keskiviivat, maalit.
- **Kiekot:** 5 kenttäpelaajaa + MV per joukkue, joukkuevärisiä numeroituja ympyröitä.
  Kentällä oleva ryhmä tulee `MatchPlayback.on_ice`-tilasta (ketjun mukaan).
- **Animaatio (Tween):**
  - *Tapahtumien välissä:* ambienssi — kiekko ja pelaajat ajelehtivat uskottavasti (ei staattinen).
  - *`save`/`goal`:* kiekko Tweenaa hyökkäysalueelle → laukaisijakiekko paikalleen → kiekko maalille;
    `goal` → välähdys + tuloksen päivitys + lyhyt juhlinta; `save` → MV-animaatio + kiekko pois.
  - *`penalty`:* rikkojan kiekko jäähyaitiolle, kentällinen putoaa (5v4) jäähyn keston ajaksi.
- **Play-by-play -tikkeri (alapalkki):** tekstirivi per tapahtuma (käyttää `TextReport`-fraseologiaa).
- **Kontrollit (alapalkki):**
  - Nopeus 1× / 2× / 4× (kellon skaalaus).
  - Linjavaihto (selaa kentällä olevaa ketjua manuaalisesti — kosmeettinen).
  - Aikalisä (pysäytä toisto).
  - **Pikasimuloi loppuun** (lopeta animaatio → siirry `post_match`-näkymään lopputuloksella).

### 7.3 Tärkeää
- Lopputulos ja tilastot ovat jo `result`-sanakirjassa ennen kuin näkymä alkaa → näkymä ei
  voi "muuttaa" tulosta. Pikasimu = animaation ohitus.
- Suorituskyky: yksi ottelu on ~50–70 tapahtumaa + Tween-ambienssi → kevyt. Ei huolta.

---

## 8. Kevyt kuori (navigaatio)

Minimaalinen mutta täysi silmukka. `scene_router.gd` (autoload) vaihtaa pakatut näkymät.

### Näkymät ja kulku
```
main_menu  ──"Uusi peli"──>  (valitse joukkue)  ──>  hub
main_menu  ──"Jatka"──────>  GameState.load_slot()  ──>  hub

hub  ──"Taktiikat"────────>  tactics_screen  ──"Tallenna"──>  hub
hub  ──"Pelaa ottelu"─────>  match_view  ──(otttelu/pikasimu)──>  post_match  ──>  hub
```

### main_menu
- "Uusi peli" → `GameState.start_new_game(...)` (olemassa) + yksinkertainen joukkuevalinta
  (pelattava joukkue Premier-liigasta). "Jatka" → `GameState.load_slot(0)`.

### hub (joukkuehubi)
Minimitiedot (EI täysi dashboard): joukkueen nimi/väri, oma sija + voitot–tappiot,
**seuraava ottelu** (vastustaja, koti/vieras, päivä), napit: Taktiikat, Pelaa ottelu, Tallenna.

### tactics_screen / match_view / post_match
- Ks. §6 ja §7.
- **post_match:** lopullinen tulos, maalintekijät, tähtipelaaja, "Jatka"-nappi →
  kutsuu `GameState.advance_day()` (pelaa loput sen päivän AI-ottelut) → takaisin hubiin.
- "Pelaa ottelu" rakentaa pelaajan ottelun: hae seuraava pelaamaton oma ottelu kalenterista,
  aja `GameRunner.run_game` taktiikoilla, avaa match_view tuloksella.

---

## 9. Datavirta (kokonaisuus)

```
Taktiikkanäkymä  ──tallentaa──>  team.tactics (TacticsData)
                                      │
hub "Pelaa ottelu"                    │
   │  hae seuraava oma ottelu         ▼
   ▼                          match_adapter.build_team_input(team)  ← lukee team.tactics
GameRunner.run_game(game, home, away, seed)                          (jääaikapainot, säätimet, PP/PK)
   │                                  │
   │  MatchSimulator.simulate_game()  ▼  (C#: kertoimet + yksiköt + determinismi)
   │  -> result { home_score, away_score, events[], player_stats, goalie_stats }
   ▼
match_view (MatchPlayback toistaa events[])  ──>  post_match  ──>  GameState.advance_day()
```

Ei uutta interop-rajapintaa: sama `simulate_game(Dictionary) -> Dictionary` kuin Sprint 2,
laajennettuna valinnaisilla taktiikkakentillä. Tämä minimoi C#/GDScript-rajapinnan.

---

## 10. Testausstrategia

| Taso | Mitä testataan | Miten |
|---|---|---|
| TacticsData | all_skater_ids, ice_time_weight_for, validate (duplikaatit, loukkaantuneet, väärä MV) | GUT-yksikkö |
| TacticsBuilder | auto_generate täyttää 4 ketjua/3 paria/2 MV/PP/PK, ohittaa loukkaantuneet | GUT-yksikkö |
| match_adapter | build_team_input liittää oikeat painot+säätimet+yksiköt; null-tactics = vanha polku | GUT-yksikkö |
| MatchSimulator | §5.5 tilastolliset väitteet + determinismi + Sprint 2 -regressio | GUT-through-interop |
| MatchPlayback | toisto saavuttaa lopputuloksen, monotoninen tulos, jäähyn miesvahvuus oikein | GUT-yksikkö |
| UI-näkymät | smoke: jokainen .tscn instantioituu headless-tilassa ilman virhettä | GUT scene-smoke |

UI:n raskas visuaalinen logiikka on eristetty testattaviin luokkiin (`MatchPlayback`,
`TacticsData`, `ui_palette.ovr_color`), joten Node/renderöintikerros pysyy ohuena.
Godot-näkymien pikseliperfektiä ei yksikkötestata; ne todennetaan smoke-testillä +
manuaalisella `/design`-vertailulla mockupiin.

---

## 11. Hyväksymiskriteerit (Sprint 3 valmis kun)

- [ ] Pelaaja voi: aloittaa uuden pelin → valita joukkueen → nähdä hubin.
- [ ] Taktiikkanäkymä: aseta ketjut, parit, MV:t, PP/PK, kaksi strategiasäädintä; auto-täyttö toimii;
      validointi estää virheellisen kokoonpanon; ulkoasu vastaa hyväksyttyä mockupia (broadcast, OVR-värit).
- [ ] Taktiikat **vaikuttavat mitattavasti** otteluun (§5.5-testit vihreinä).
- [ ] 2D-ottelunäkymä toistaa ottelun broadcast-tyylillä: kaukalo, joukkuevärilliset numeroidut kiekot,
      HUD (tulos/erä/kello), play-by-play, kontrollit (nopeus, linjavaihto, aikalisä, pikasimu).
- [ ] Täysi silmukka pelattavissa: hub → taktiikat → pelaa ottelu → katso 2D → tulos → seuraava päivä → hub.
- [ ] Determinismi säilyy; Sprint 2:n 94 testiä pysyvät vihreinä; uudet testit vihreinä.
- [ ] Yksi jaettu Theme; ei kovakoodattuja värejä per näkymä; paletti §2:n mukainen.

---

## 12. Avoimet päätökset (ratkaistu oletuksilla, voi muuttaa)

1. **Kemia-mittari** ketjueditorissa on Sprint 3:ssa **vain visuaalinen** (ei vaikuta simuun).
   Sim käyttää jääaikapainoja. Pidetään rehellisenä UI:ssa. (Kemia simuun = Sprint 4+.)
2. **Joukkuevalinta** uudessa pelissä: pelattava joukkue mistä tahansa Premier-liigasta.
   First Divisionista aloittaminen on Sprint 4+.
3. **Linjavaihto 2D:ssä** on kosmeettinen (vaihtaa näytettyä ketjua), ei muuta jo laskettua tulosta —
   linjajärjestys vaikuttaa simuun jo etukäteen jääaikapainojen kautta.
```

