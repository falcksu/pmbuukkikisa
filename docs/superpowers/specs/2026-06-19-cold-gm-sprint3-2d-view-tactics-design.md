> ⚠️ **KORVATTU (2026-06-19).** Markkinatutkimuksen jälkeen Sprint 3 uudelleenpriorisoitiin
> **Playable Manager Loopiksi** — ks. [`2026-06-19-cold-gm-sprint3-playable-manager-loop-design.md`](2026-06-19-cold-gm-sprint3-playable-manager-loop-design.md).
> Tämä dokumentti EI ole enää seuraava sprintti, mutta sen suunnittelu on **edelleen voimassa
> myöhemmille sprinteille:** §4 EHM-attribuutit + §5 komposiitti/migraatio → **Sprint 6**;
> §6 ketjueditori/chemistry → **Sprint 4**; §7 2D-näkymä → **Sprint 5**. Säilytetään lähteenä.

# Cold GM — Sprint 3: pelaajajärjestelmä + 2D-ottelunäkymä + taktiikat + kevyt kuori (KORVATTU)

**Spesifikaatio | 2026-06-19 | Sprint 3 — korvattu, ks. yllä**

> Edeltävät: Sprint 1 (datapohja, 53 testiä) ja Sprint 2 (ottelusimu + talous, 94 testiä) valmiit.
> Tämä spec kattaa pelin **ensimmäisen graafisen kerroksen** + **EHM-tasoisen pelaajajärjestelmän**:
> rikkaat attribuutit ja profiilikortti (Vaihe 0), 2D-otteluvisualisoinnin, taktiikkanäkymän ja kevyen
> navigaatiokuoren, joka sitoo ne yhteen pelattavaksi silmukaksi.

---

## 1. Tavoite ja laajuus

### Ydintavoite
Tehdä pelin **pääerottautumistekijä näkyväksi ja pelattavaksi**: pelaaja asettaa
taktiikat (ketjut + strategia), pelaa ottelun ja **katsoo sen 2D-näkymässä** broadcast-tyylillä,
ja näkee tuloksen. Yksi yhtenäinen silmukka uudesta pelistä otteluun ja takaisin.

### Sprint 3:n pilarit
0. **Pelaajajärjestelmä** (EHM-tasoinen) — rikas attribuuttimalli (~27 kenttäpelaaja-attr. +
   MV-setti) + pelaajaprofiilikortti. Tämä on Sprint 3:n **ensimmäinen vaihe**; muut pilarit
   rakentuvat sen päälle (kortit ja simu lukevat rikkaita attribuutteja).
1. **Taktiikkanäkymä** (NHL-pelien tyylinen ketjueditori) — pelaaja päättää kokoonpanon ja strategian.
2. **2D-ottelunäkymä** (broadcast-tyyli) — pre-lasketun tapahtumavirran visuaalinen toisto.
3. **Kevyt kuori** — minimaalinen navigaatio joka tekee yllä olevista pelattavan kokonaisuuden.

### Vaiheistus (toteutusjärjestys)
- **Vaihe 0 — Pelaajajärjestelmä:** PlayerData/GoalieData rikas attribuuttimalli + meta-kentät,
  `PlayerGenerator` (positiokohtaiset jakaumat), `overall_rating()` uudelleenpainotus,
  `match_adapter`-komposiittimappaus (rikkaat attr. → simun inputit), Sprint 2 -testien migraatio,
  pelaajaprofiilikortti. **Simu (C#) pysyy muuttumattomana.**
- **Vaihe 1 — Taktiikat:** TacticsData, TacticsBuilder, ketjueditori (käyttää pelaajakortteja), simu-laajennus.
- **Vaihe 2 — 2D-näkymä:** MatchPlayback, RinkMotion, match_view, rink.
- **Vaihe 3 — Kuori:** scene_router, main_menu, hub, post_match, kytkennät.

### Arkkitehtoninen kulmakivi (lukittu päätös)
Simulaatio ajetaan **kokonaan loppuun ENNEN visualisointia** (`GameRunner.run_game`
tuottaa täyden tuloksen + `events`-virran determinisesti). 2D-näkymä on tämän valmiin
tapahtumavirran **toisto/replay**, EI tikittävä reaaliaikasimu.

**Miksi:** säilyttää Sprint 2:n determinismin (sama seed + taktiikat → sama tulos),
tekee "pikasimuloi loppuun" -toiminnosta triviaalin (lopeta animaatio, näytä jo tiedossa
oleva tulos), ja pitää sim-logiikan ja esityskerroksen täysin erillään.

**Jatkuva liike (lukittu vaatimus):** kaukalo EI ole koskaan paikallaan ottelun aikana.
Pelaajat ja kiekko ovat **jatkuvassa, uskottavassa liikkeessä joka ruudulla**, eivät vain
tapahtumien kohdalla. Tämän tuottaa kevyt **proseduraalinen liikemalli** (§7.4) joka pyörii
`_process`-silmukassa pelinopeudella; oikeat tapahtumat (maali/torjunta/jäähy) ovat tämän
virtauksen päälle laukeavia "huutomerkkejä".

**Rehellisyys esityksestä:** tapahtumavirta sisältää vain maalit, torjunnat ja jäähyt
(~50–70 tapahtumaa/ottelu). Jatkuva liike on siis **uskottava abstraktio** (hallussapidon
virtaus + muodostelma), EI kirjaimellinen pelaajien sijaintisimu. Se on ankkuroitu oikeisiin
tapahtumiin (kiekko on hyökkäysalueella kun maali/torjunta laukeaa) mutta liike tapahtumien
välissä on generoitua. Tämä on tarkoituksellista, ei oikopolku.

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

### Rating-värikoodaus (lukittu — sama 1–20-tasoasteikko OVR:lle JA yksittäisille attribuuteille)
> `ui_palette.ovr_color(rating)` (kortin OVR) ja `ui_palette.attr_color(value)` (profiilikortin
> attribuuttiarvot) käyttävät samaa taulukkoa.
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
    player_data.gd          (MUOKKAA: EHM-attribuutit (27) + meta + handedness; overall_rating uudelleen)
    goalie_data.gd          (MUOKKAA: EHM-MV-attribuutit (~10) + meta)
    team_data.gd            (MUOKKAA: lisää tactics-viittaus)
    tactics_data.gd         (UUSI: ketjut, parit, MV:t, PP/PK, strategiasäätimet)
  data/
    player_generator.gd     (MUOKKAA: generoi kaikki EHM-attribuutit + meta, positiokohtaiset jakaumat)
    save_manager.gd         (MUOKKAA: serialisoi/deserialisoi uudet attribuutit (uudet lyhytavaimet); ei vanhaa yhteensopivuutta)
  systems/
    sim_attributes.gd       (UUSI: komposiittimappaus — rikkaat attr. -> simun inputit, §5.0)
    training_system.gd      (MUOKKAA: `attrs`-lista + fokusmappaus uusiin EHM-attribuutteihin)
    tactics_builder.gd      (UUSI: auto_generate(team) -> TacticsData, validointi)
  sim/
    match_adapter.gd        (MUOKKAA: build_team_input käyttää sim_attributes-komposiitteja + tactics-rakenteen)
  core/
    MatchSimulator.cs       (MUOKKAA: jääaika-painot, strategiakertoimet, PP/PK-yksiköt)
    SimContext.cs           (MUOKKAA: SimSkater.IceTimeWeight, SimTeam strategiakentät/yksiköt)
  match/
    match_playback.gd       (UUSI: puhdas logiikka — tapahtumavirta + kello -> visuaalitila)
    rink_motion.gd          (UUSI: jatkuva proseduraalinen liikemalli — kosmeettinen, testattava)
  ui/
    ui_palette.gd           (UUSI: värivakiot + ovr_color(rating))
    scene_router.gd         (UUSI autoload: näkymien vaihto)
    main_menu.gd/.tscn      (UUSI: New Game / Continue)
    hub.gd/.tscn            (UUSI: joukkuehubi — seuraava ottelu, tilanne, napit)
    tactics_screen.gd/.tscn (UUSI: ketjueditori)
    match_view.gd/.tscn     (UUSI: 2D-ottelunäkymä)
    post_match.gd/.tscn     (UUSI: tuloskooste)
    player_profile.gd/.tscn (UUSI: täysi EHM-tyylinen profiilikortti — kaikki attribuutit, §4.8)
    components/
      player_card.gd/.tscn  (UUSI: kompakti kortti ketjueditoriin — avatar, nimi, positio, OVR)
      attr_grid.gd/.tscn    (UUSI: 3-sarakkeinen attribuuttiruudukko, värikoodattu (Tech/Mental/Phys))
      rink.gd/.tscn         (UUSI: kaukalo + kiekot)
assets/
  theme/cold_gm_theme.tres  (UUSI)
tests/gut/
  test_player_attributes.gd (UUSI: EHM-attribuutit, overall_rating, MV-attribuutit)
  test_player_generator.gd  (MUOKKAA/UUSI: kaikki attr. generoidaan, positiokohtaiset, rajat 1–20)
  test_sim_attributes.gd    (UUSI: komposiittimappaus — neutraalit arvot säilyttävät Sprint 2 -käytöksen)
  test_tactics_data.gd      (UUSI)
  test_tactics_builder.gd   (UUSI)
  test_match_adapter_tactics.gd (UUSI)
  test_match_sim_tactics.gd (UUSI: strategia/jääaika/PP-yksikkö vaikuttavat tulokseen)
  test_match_playback.gd    (UUSI: toistologiikka)
  test_rink_motion.gd       (UUSI: jatkuva liike — sijainnit muuttuvat, pysyvät rajoissa)
```

---

## 4. Datamalli

### 4.1 PlayerData — EHM-tasoinen attribuuttimalli (kentällispelaajat)
Korvaa nykyiset 12 ohutta attribuuttia rikkaalla EHM-setillä. **Kaikki 1–20-asteikolla**
(sama kuin nyt: ~10 keskiverto, ≥16 tähti) → OVR-värikoodaus säilyy. Rikkaat attribuutit ovat
**uusi totuuslähde**; simu lukee niistä johdetut komposiitit (§5.0), ei näitä suoraan.

```gdscript
class_name PlayerData
extends Resource
enum Position { FORWARD, DEFENSE, GOALIE }
enum Handedness { LEFT, RIGHT }

# --- Technical (12) ---
@export var checking: int = 10
@export var deflections: int = 10
@export var deking: int = 10
@export var faceoffs: int = 10
@export var hitting: int = 10
@export var off_the_puck: int = 10
@export var passing: int = 10
@export var pokecheck: int = 10
@export var positioning: int = 10
@export var slapshot: int = 10
@export var stickhandling: int = 10
@export var wristshot: int = 10
# --- Mental (9) ---
@export var aggression: int = 10
@export var anticipation: int = 10
@export var bravery: int = 10
@export var creativity: int = 10
@export var determination: int = 10
@export var flair: int = 10
@export var influence: int = 10
@export var teamwork: int = 10
@export var work_rate: int = 10
# --- Physical (6) ---
@export var acceleration: int = 10
@export var agility: int = 10
@export var balance: int = 10
@export var speed: int = 10
@export var stamina: int = 10
@export var strength: int = 10
# --- Meta / kortti ---
@export var handedness: Handedness = Handedness.LEFT
@export var secondary_position: Position = Position.FORWARD   # esim. RW/LW (näyttö)
@export var height_cm: int = 183
@export var weight_kg: int = 84
@export var morale: int = 50         # 0–100 (vire/tahto-näyttö)
@export var plus_minus: int = 0      # kausi +/- (kausitilasto)
@export var penalty_minutes: int = 0 # kausi PIM (kausitilasto)
# (säilyy ennallaan: id, etu/sukunimi, ikä, kansallisuus, position, hidden_potential,
#  contract_years_left, annual_salary, fatigue, is_injured, injury_weeks_remaining,
#  games_played, season_goals/assists/shots)
```

**Poistuvat vanhat attribuutit:** `skating, shooting, puck_handling, defensive_play, power_play,
composure, team_spirit`. Niiden rooli siirtyy joko suoraan uuteen attribuuttiin (esim.
`team_spirit → teamwork`) tai komposiittiin (§5.0). `season_shots` = SOG kortissa.

### 4.2 GoalieData — EHM-MV-attribuutit
Maalivahdeilla oma setti (EHM-tyyli). Korvaa nykyiset `save_ability, reflexes,
goalie_positioning, mental_strength`.
```gdscript
# Technical: reflexes, positioning, rebound_control, recovery, puck_handling, one_on_ones (1–20)
# Mental:    concentration, composure, bravery (1–20)
# Physical:  agility (1–20)
# + meta kuten PlayerData (height/weight/handedness=catches, morale)
# + kausitilastot säilyvät: season_saves, season_shots_against, season_goals_against, season_shutouts
```

### 4.3 overall_rating() — positiopainotettu
Ei enää tasainen 12 attr. keskiarvo. Painotettu positiittain (1–20-asteikko säilyy):
- **Hyökkääjä:** painota Wristshot, Slapshot, Deking, Off The Puck, Speed, Anticipation.
- **Puolustaja:** painota Pokecheck, Positioning, Checking, Hitting, Passing, Strength.
- **Maalivahti:** painota Reflexes, Positioning, Rebound Control, One-on-Ones, Composure.

Painot ovat tasapainotettavissa; lähtöpisteenä yllä mainitut "avainattribuutit" ×1.5,
muut ×1.0, normalisoituna takaisin 1–20-alueelle. Tämä ohjaa myös OVR-värikoodausta.

### 4.4 PlayerGenerator — laajennus
Generoi kaikki EHM-attribuutit positiokohtaisilla jakaumilla (hyökkääjillä korkeammat
laukaisu-/luistelu-attribuutit, puolustajilla pokecheck/checking/strength, MV omat).
Arpoo myös meta-kentät: handedness (~60 % vasen), height/weight (positiokohtainen normaali­jakauma),
secondary_position. Säilyttää nykyisen tähti/runkopelaaja-vaihtelun (`hidden_potential`-kytkentä).

### 4.5 TacticsData (uusi Resource)
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

### 4.6 TeamData-lisäys
```gdscript
@export var tactics: TacticsData = null   # null = auto-generoidaan tarvittaessa
```

### 4.7 TacticsBuilder (uusi)
```gdscript
class_name TacticsBuilder
static func auto_generate(team: TeamData) -> TacticsData
```
- Hyökkääjät overall-järjestyksessä → täytä L1..L4 (paikat LW/C/RW järjestyksessä).
- Puolustajat overall-järjestyksessä → täytä parit 1..3.
- Paras MV → starting, toiseksi paras → backup.
- PP-yksikkö: 5 parasta hyökkäyssummalla `wristshot + slapshot + off_the_puck + passing`.
- PK-yksikkö: 4 parasta puolustussummalla `pokecheck + checking + positioning + work_rate`.
- Loukkaantuneet ohitetaan; jos kenttäpelaajia/MV:itä liian vähän, jätetään paikkoja tyhjiksi
  (validointi nappaa, hätä-MV-logiikka adapterissa kattaa MV-puutteen kuten Sprint 2:ssa).

### 4.8 Pelaajaprofiilikortti (`player_profile.tscn`) — UI
Täysi EHM-tyylinen profiilikortti, hyväksytyn mockupin mukainen (broadcast-paletti). Komponentit:
- **Otsikko:** pelinumero-avatar (joukkuevärinen), nimi, joukkue, positiot (esim. RW/LW), OVR värikoodattuna.
- **Meta-rivi:** ikä, kansallisuus, kätisyys (Shoots/Catches), pituus/paino, palkka, sopimus, vire/morale, kunto.
- **Attribuuttiruudukko (`attr_grid.tscn`):** kolme saraketta — Technical / Mental / Physical —
  jokainen attribuutti nimi + arvo, **arvo värikoodattu §2:n OVR-tasoilla** (`ui_palette.attr_color`).
- **Kausitilastorivi:** GP, G, A, P, +/−, PIM, SOG, Sh% (`season_*`-kentistä; Sh% = G/SOG).
- MV-versio näyttää MV-attribuutit + torjunta% (`save_percentage`).
- `attr_grid` on uudelleenkäytettävä; se ei tiedä pelaajasta muuta kuin (nimi, arvo, väri) -rivit.

---

## 5. Simulaation laajennus — taktiikat vaikuttavat mitattavasti

**Taaksepäin-yhteensopivuus (kriittinen):** kaikki uudet parametrit ovat valinnaisia ja
neutraalit oletuksilla (jääaikapaino 1.0, säätimet 50 → kertoimet ≈ 1.0). Ilman taktiikoita
sim käyttäytyy täsmälleen kuten Sprint 2:ssa. **Interop-dictin skeema (`"shooting"`, `"checking"`,
`save_ability`…) pysyy ennallaan** — adapter vain laskee ne rikkaista attribuuteista (§5.0).
Näin C#-`MatchSimulator` ei muutu lainkaan tässä vaiheessa.

### 5.0 Komposiittimappaus — rikkaat attribuutit → simun inputit (`sim_attributes.gd`)
Adapter johtaa simun odottamat komposiitit EHM-attribuuteista. **Avain:** kun kaikki rikkaat
attribuutit ovat samalla tasolla `L`, jokainen komposiitti palautuu arvoon `L` (painot summautuvat
1.0:aan) → Sprint 2:n testit jotka käyttivät tasaisia arvoja (esim. `shooting=10`) tuottavat
identtisen simun, kun migratoidaan tasaiseen rikkaaseen settiin (`make_skater(10)`).

Lähtöpainot (tasapainotettavissa; summa per rivi = 1.0):
| Simun input | Kaava (EHM-attribuuteista) |
|---|---|
| `shooting` | 0.40·wristshot + 0.30·slapshot + 0.20·deking + 0.10·off_the_puck |
| `passing` | 0.60·passing + 0.40·creativity |
| `defensive_play` | 0.40·pokecheck + 0.30·positioning + 0.30·anticipation |
| `positioning` | 0.60·positioning + 0.40·off_the_puck |
| `power_play` | 0.35·wristshot + 0.25·passing + 0.25·off_the_puck + 0.15·creativity |
| `speed` | 0.50·speed + 0.50·acceleration |
| `checking` | 0.45·checking + 0.35·hitting + 0.20·aggression |
| `composure` | 0.50·determination + 0.30·bravery + 0.20·influence |
| `stamina` | 1.00·stamina |
| MV `save_ability` | 0.35·reflexes + 0.30·positioning + 0.20·one_on_ones + 0.15·rebound_control |
| MV `reflexes` / `goalie_positioning` / `mental_strength` | reflexes / positioning / concentration |

Tulos pyöristetään intiksi (1–20). Testi (`test_sim_attributes.gd`) varmistaa: tasainen `L` → kaikki
komposiitit = `L`; ja että vahva profiili tuottaa korkeamman `shooting`-komposiitin kuin heikko.

### 5.0b Migraation kokonaislaajuus (poistuvat attribuutit)
Poistuvat attribuutit (`skating, shooting, puck_handling, defensive_play, power_play, composure,
team_spirit` ja MV:n `save_ability, reflexes, goalie_positioning, mental_strength`) ovat käytössä
useassa **tuotantotiedostossa** — kaikki päivitetään Vaiheessa 0. Interop-dictin avaimet (joita
`MatchSimulator.cs` lukee) EIVÄT muutu, joten **C# pysyy koskemattomana**.

**Tuotantokoodi (MUOKKAA Vaiheessa 0):**
| Tiedosto | Mitä |
|---|---|
| `models/player_data.gd`, `models/goalie_data.gd` | uudet attribuutit (§4.1–4.2), `overall_rating` (§4.3); poista `average_technical` tai päivitä |
| `data/player_generator.gd` | generoi uudet attribuutit (§4.4); rivin 57 `avg_attr` päivitettävä |
| `data/save_manager.gd` | serialisointi/deserialisointi uusilla lyhytavaimilla (ei vanhojen tallennusten yhteensopivuutta — peliä ei ole julkaistu) |
| `systems/training_system.gd` | `attrs`-lista (rivit 33–35) + fokus→attribuutti-mappaus uuteen settiin |
| `sim/match_adapter.gd` | `build_team_input` laskee komposiitit (§5.0/§5.1) `sim_attributes`-luokalla |
| `core/MatchSimulator.cs`, `core/SimContext.cs` | **ei muutosta** (lukevat samat interop-avaimet) |

**Sprint 2 -testien migraatio (5 tiedostoa).** Lisää testiapurit `make_skater(level)` /
`make_goalie(level)` jotka asettavat KAIKKI rikkaat attribuutit arvoon `level` (komposiitti palautuu
arvoon `level` → identtinen simu). Erityistapaukset:
- `test_match_simulator.gd` — operoi **raakojen interop-dictien** päällä (`"shooting"`, `"save_ability"`…),
  EI PlayerDatan. **Ei migraatiota** (avainskeema säilyy).
- `test_match_adapter.gd` — käyttää **gradienttia** (`p.shooting = 10 + i%5`) testatakseen top-18-järjestyksen.
  Apuri tarvitsee vaihtelevan tason (esim. `make_skater(level)` joka asettaa kaikki = level) → aseta eri
  pelaajille eri level säilyttääkseen erottelun; ordering testataan `overall_rating()`-pohjalta.
- `test_training_system.gd` — lukee/kirjoittaa poistuvaa `shooting`-kenttää; **uudelleenkohdista**
  säilyvään attribuuttiin (esim. `wristshot`). Testit seuraavat TrainingSystemin uutta `attrs`-listaa.
- `test_game_runner.gd`, `test_season_manager.gd` — korvaa suorat kenttäasetukset apureilla.

Komposiittimappaus + apurit takaavat että 94 testin tilastolliset/determinismiväitteet pysyvät voimassa.

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
  **kemia-mittari** (palkki) — yksinkertainen heuristiikka: ketjun keskiarvo-`teamwork`
  + `passing` normalisoituna (vain visuaalinen Sprint 3:ssa, ei vaikuta simuun → pidetään rehellisenä:
  mittari kuvaa "ketjun yhteensopivuutta" mutta sim käyttää jääaikapainoja, ei kemiaa).
- **Puolustusparit:** 3 riviä, kukin 2 korttia (LD/RD) + kemia-mittari.
- **Maalivahdit:** 2 korttia (Starter / Backup) erillisinä MV-kortteina (torjunta% jos saatavilla).
- **Erikoistilanteet:** PP1 (5 paikkaa) ja PK1 (4 paikkaa) -rivit.
- **Strategia:** kaksi liukusäädintä — Aggressiivisuus, Forecheck (0–100, oletus 50),
  kuvaavat tekstit ("Varovainen ↔ Hyökkäävä", "Passiivinen ↔ Painostava").

### Pelaajakortti (`player_card.tscn`) — kompakti
- Pelinumero-avatar (joukkuevärinen ympyrä + numero).
- Nimi (sukunimi korostettuna), positiomerkki, kätisyys (L/R).
- OVR-luku värikoodattuna (§2-taulukko `ui_palette.ovr_color`).
- Loukkaantunut → himmennetty + "INJ"-merkki, ei valittavissa kenttäpaikalle.
- **Klikkaus avaa täyden profiilikortin (§4.8)** — kaikki EHM-attribuutit. Sama kortti
  saavutettavissa hubin/rosterin kautta.

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
- **Animaatio:**
  - *Jatkuva pohjavirta:* §7.4 liikemalli ajaa kiekkoa ja pelaajia joka ruudulla — näkymä on aina liikkeessä.
  - *`save`/`goal`:* virtaus on jo vienyt kiekon hyökkäysalueelle → laukaisijakiekko astuu esiin →
    kiekko maalille; `goal` → välähdys + tuloksen päivitys + lyhyt juhlinta; `save` → MV-animaatio + kiekko pois.
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
- Suorituskyky: 12 kiekkoa + kiekko, kevyt vektorimatikka per ruutu → triviaali kuorma. Ei huolta.

### 7.4 Jatkuva liikemalli — `rink_motion.gd`
Erillinen, kosmeettinen liikemalli joka pitää kaukalon aina liikkeessä. Pyörii
`match_view._process(delta)`-silmukassa pelinopeudella skaalattuna. **Ei vaikuta tulokseen**
(oma, **pakollinen** seedattu RNG toistettavuuteen; erillään sim-RNG:stä). Looginen ydin erotetaan
testattavaksi luokaksi (kuten `MatchPlayback`), näkymä vain piirtää sen tilan.

```gdscript
class_name RinkMotion
# Jatkuva, uskottava liikevirta. Kutsutaan joka ruudulla.
func _init(seed: int)
func set_possession(side, attack_intensity)  # MatchPlayback ohjaa: kumpi hyökkää nyt
func step(delta: float) -> void               # päivittää puck + 12 luistelijan sijainnit
func puck_pos() -> Vector2                     # 0..1 normalisoitu kaukalossa
func skater_pos(side, slot) -> Vector2         # per pelaaja
```

**Malli (lukittu pääpiirteet):**
1. **Hallussapidon virtaus:** skalaariarvo `puck_x ∈ [0,1]` (0 = kotimaali, 1 = vierasmaali)
   etenee jatkuvasti kohti hyökkäävän joukkueen aluetta easing-liikkeellä. Hallussapito vaihtuu
   ajastimella (~3–8 s, satunnaistettu) JA tapahtuman kohdalla. Maalin/torjunnan jälkeen kiekko
   palaa keskialueelle (aloitus) ja virtaus jatkuu.
2. **Muodostelma:** kukin kentällä oleva luistelija easaa jatkuvasti kohti roolipaikkaansa
   (hyökkäävä/neutraali/puolustava muodostelma hallussapidon mukaan) + pieni per-disci-wander
   (sin/kohina-pohjainen) niin ettei kukaan ole koskaan paikallaan. MV pysyy maalialueella ja
   seuraa kiekkoa sivusuunnassa.
3. **Tapahtuma-ankkurointi:** `MatchPlayback` kertoo kun tapahtuma lähestyy → `set_possession`
   asettaa virtauksen oikealle alueelle, jotta laukaus/maali näyttää tulevan oikeasta paikasta.
4. **Miesvahvuus:** jäähyn aikana lyhytkätinen joukkue piirtää 4 luistelijaa (yksi aitiossa);
   muodostelma sopeutuu (PK-boksi / PP-kehä) — kosmeettinen, kuvaa §5:n PP/PK-tilannetta.

**Testattava takuu (`test_rink_motion.gd`):** usean `step()`-kutsun jälkeen kiekon ja
luistelijoiden sijainnit ovat siirtyneet **vähintään määritellyn minimimatkan** (ei pelkkä
`!=`, vaan riittävä magnitudi → oikeasti näkyvää liikettä, ei mikrovärinää) ja pysyvät kaukalon
rajojen sisällä; hallussapidon vaihto siirtää virtauksen suuntaa. Seed on kiinteä → testi on
toistettava. Tämä on "jatkuva liike" -vaatimuksen automaattivahti.

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
| PlayerData/GoalieData | EHM-attribuutit olemassa, overall_rating positiopainotus, MV-attribuutit, 1–20-rajat | GUT-yksikkö |
| PlayerGenerator | kaikki attr. generoituvat 1–20, positiokohtaiset jakaumat, meta-kentät (handedness/pituus/paino) | GUT-yksikkö |
| sim_attributes | tasainen `L` → kaikki komposiitit = `L`; vahva > heikko; MV save_ability-komposiitti | GUT-yksikkö |
| TacticsData | all_skater_ids, ice_time_weight_for, validate (duplikaatit, loukkaantuneet, väärä MV) | GUT-yksikkö |
| TacticsBuilder | auto_generate täyttää 4 ketjua/3 paria/2 MV/PP/PK, ohittaa loukkaantuneet | GUT-yksikkö |
| match_adapter | build_team_input liittää oikeat painot+säätimet+yksiköt; null-tactics = vanha polku | GUT-yksikkö |
| MatchSimulator | §5.5 tilastolliset väitteet + determinismi + Sprint 2 -regressio | GUT-through-interop |
| MatchPlayback | toisto saavuttaa lopputuloksen, monotoninen tulos, jäähyn miesvahvuus oikein | GUT-yksikkö |
| RinkMotion | sijainnit muuttuvat step():n yli (ei staattinen), pysyvät rajoissa, hallussapito ohjaa virtausta | GUT-yksikkö |
| UI-näkymät | smoke: jokainen .tscn instantioituu headless-tilassa ilman virhettä | GUT scene-smoke |

UI:n raskas visuaalinen logiikka on eristetty testattaviin luokkiin (`MatchPlayback`,
`TacticsData`, `sim_attributes`, `ui_palette.ovr_color/attr_color`), joten Node/renderöintikerros pysyy ohuena.
Godot-näkymien pikseliperfektiä ei yksikkötestata; ne todennetaan smoke-testillä +
manuaalisella `/design`-vertailulla mockupiin.

---

## 11. Hyväksymiskriteerit (Sprint 3 valmis kun)

- [ ] **Pelaajajärjestelmä:** pelaajilla on täysi EHM-attribuuttisetti (27 + MV-setti), generaattori
      tuottaa ne positiokohtaisesti, ja profiilikortti näyttää ne värikoodattuna (Tech/Mental/Phys + tilastot).
- [ ] **Simu ennallaan:** komposiittimappaus tuottaa simun inputit rikkaista attr.; C#-`MatchSimulator`
      muuttumaton; Sprint 2:n 94 testiä migratoitu apureilla ja pysyvät vihreinä.
- [ ] Pelaaja voi: aloittaa uuden pelin → valita joukkueen → nähdä hubin.
- [ ] Taktiikkanäkymä: aseta ketjut, parit, MV:t, PP/PK, kaksi strategiasäädintä; auto-täyttö toimii;
      validointi estää virheellisen kokoonpanon; ulkoasu vastaa hyväksyttyä mockupia (broadcast, OVR-värit).
- [ ] Taktiikat **vaikuttavat mitattavasti** otteluun (§5.5-testit vihreinä).
- [ ] 2D-ottelunäkymä toistaa ottelun broadcast-tyylillä: kaukalo, joukkuevärilliset numeroidut kiekot,
      HUD (tulos/erä/kello), play-by-play, kontrollit (nopeus, linjavaihto, aikalisä, pikasimu).
- [ ] **Jatkuva liike:** kaukalo on aina liikkeessä toiston aikana (ei staattinen tapahtumien välissä);
      `RinkMotion`-testi vahvistaa sijaintien muuttuvan ja pysyvän rajoissa.
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

