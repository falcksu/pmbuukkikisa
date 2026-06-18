# Cold GM — Sprint 2: Match Sim + Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rakenna ottelusimulaatioydin (C#) ja kausilogiikka (GDScript) niin että koko kausi — runkosarja + pudotuspelit — voidaan simuloida, pelaaja- ja joukkuetilastot kertyvät, tekstipohjainen otteluraportti syntyy ja kausitalous (budjetti, palkat, lipputulot, game over) toimii.

**Architecture:** Ottelusimulaattori on **C#** (`src/core/MatchSimulator.cs`) suorituskyvyn vuoksi — se on ainoa kuuma polku (tuhansia otteluita/kausi). **Koko C#↔GDScript-rajapinta on yksi metodikutsu:** `MatchSimulator.simulate_game(input: Dictionary) -> Dictionary`, jossa kulkee vain natiiveja Godot-tyyppejä (Dictionary/Array/int/float/String/bool). Kaikki muu — adapteri, tekstiraportti, harjoittelu, talous, kausimanageri — on **GDScriptiä** ja operoi suoraan Sprint 1:n `Resource`-malleilla. Tämä minimoi interop-rajapinnan (oppi Sprint 1:n "interop blockers" -kierroksesta: jokainen rajanylitys on marshalling-kustannus ja virhelähde).

**Tech Stack:** Godot **4.6.3 .NET (Mono) -build**, .NET SDK 8.0 (LTS), C# 12, GDScript, GUT addon v9.6.0, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-17-cold-gm-hockey-manager-design.md` (§4.1 ottelusimulaatio, §4.2 pelaajamalli, §4.3 harjoittelu, §4.5 talous, §6 arkkitehtuuri)

---

## Scope

Tämä on Sprint 2 viidestä sprintistä.

| Sprint | Dokumentti | Status |
|---|---|---|
| 1 — Foundation | `2026-06-17-cold-gm-sprint1-foundation.md` | ✅ VALMIS (53/53 testiä) |
| 2 — Match Sim + Economy (tämä) | `2026-06-18-cold-gm-sprint2-match-sim-economy.md` | Kirjoitettu |
| 3 — 2D Match View + Tactics UI | Kirjoitetaan Sprint 3 alkaessa | — |
| 4 — Modding + Steam | Kirjoitetaan Sprint 4 alkaessa | — |
| 5 — Balancing + EA Launch | Kirjoitetaan Sprint 5 alkaessa | — |

**Sprint 2 valmistumiskriteeri:** `SeasonManager` simuloi koko kauden (runkosarja → top-8 best-of-5 pudotuspelit Premierissä, top-2 nousu First Divisionissa) loppuun headless-ajossa. Pelaajatilastot (maalit, syötöt, laukaukset, torjunnat) ja joukkuetilastot (W/L/OTL, GF/GA, pisteet) täsmäävät otteluiden summaan. `EconomyEngine` laskee kausituloksen ja game over -ehto laukeaa kahdesta peräkkäisestä negatiivisesta kassakaudesta. Tekstiraportti tulostaa luettavan otteluselosteen. Kaikki GUT-testit vihreänä. CI vihreänä.

### Mukana Sprint 2:ssa
- C#-ottelusimulaattori (tapahtumapohjainen, deterministinen siemenellä)
- Yli-/alivoima (PP/PK), rangaistukset, jatkoaika (sudden death)
- Pelaaja- ja maalivahtitilastojen keräys per ottelu ja per kausi
- Tekstipohjainen otteluraportti
- Harjoitusjärjestelmä (viikkofokus, fatigue, loukkaantumiset)
- Ikäpohjainen pelaajakehitys kauden lopussa
- Kausitalous (tulot/menot/kassavaranto/game over)
- Kausimanageri: päivän edistys, runkosarja, pudotuspelit, kausivaihto

### EI mukana Sprint 2:ssa (myöhemmät sprintit / YAGNI)
- **2D-ottelunäkymä** → Sprint 3. Sprint 2 tuottaa vain tekstiraportin + `events`-listan, jonka 2D-näkymä myöhemmin kuluttaa.
- **Taktiikoiden vaikutus simuun** → Sprint 3. Sprint 2 käyttää kiinteää linjajakoa (parhaat attribuutit ensin).
- **Siirrot ja sopimusneuvottelut** (§4.4) → vaativat UI:n (Sprint 3+). `SeasonManager` jättää siirtoikkunoille koukun (`EventBus`-signaali), mutta siirtologiikkaa ei toteuteta.
- **NUnit-testiprojekti** → korvattu GUT-through-interop-testauksella (ks. "Testausstrategia").

---

## Arkkitehtuuripäätökset (poikkeamat speksistä — perustellut)

1. **`EconomyEngine` on GDScript, ei C# (`EconomyEngine.cs`).** Speksi §6.2 listaa `EconomyEngine.cs`, mutta talous lasketaan kerran per kausi (ei kuuma polku) ja operoi suoraan `WorldData`/`TeamData`-malleilla. C#:ksi vieminen lisäisi toisen interop-rajapinnan ilman suorituskykyhyötyä. → GDScript.

2. **Yksi testiharness (GUT), ei NUnit.** Speksi mainitsi NUnitin C#-testaukseen. Sen sijaan testaamme `MatchSimulator`-C#-koodin **GUT:n kautta** kutsumalla sitä GDScriptistä. Hyödyt: (a) testaa oikean interop-polun, ei vain C#-logiikkaa eristyksissä; (b) yksi testikomento; (c) determinismi siemenellä. Puhtaan C#-yksikkötestauksen lisääminen myöhemmin on mahdollista, jos sim-logiikka monimutkaistuu.

3. **Determinismi siemenellä.** `simulate_game`-input sisältää `"seed"`-kentän. Sama siemen + sama input → identtinen tulos. Tämä tekee TDD:stä mahdollista (assertoi tarkkoja tuloksia) ja mahdollistaa Sprint 5:n Monte Carlo -toiston.

4. **Fatigue-vastuunjako.** `PlayerData.fatigue` (pysyvä, 0–100) on simun **syöte** (ei mutaatiota simussa). Simu laskee pelinsisäisen väsymyksen päälle vain laukauslaadun matematiikkaa varten. Ottelun jälkeen **GDScript** (`MatchAdapter`/`SeasonManager`) lisää pysyvän fatiguen (+8 pelanneille, +2 vaihtopenkille). `TrainingSystem` käsittelee viikoittaiset muutokset.

5. **Promotion/relegation -oletus (LIPUTETTU).** Speksi sanoo "First Division top-2 nousee Premieriin" mutta on hiljaa putoamisesta. Liigakoot pysyvät 20:ssä vain jos 2 putoaa per nousu. Tämä suunnitelma toteuttaa **alueparillisen** nousun/putoamisen (esim. North First top-2 ↔ North Premier bottom-2). **Vahvista tämä oletus ennen Task 13:a** — vaihtoehtoisesti promotion/relegation lykätään Sprint 3:een ja kausivaihto vain nollaa/kehittää saman kokoonpanon.

---

## Tiedostorakenne

```
cold_gm/
├── ColdGM.sln                       # C#-ratkaisu (Godot .NET generoi/konfiguroidaan Task 1:ssä)
├── ColdGM.csproj                    # C#-projektitiedosto
├── project.godot                    # + [dotnet] -konfiguraatio
├── src/
│   ├── core/                        # C# — ottelusimulaation ydin (AINOA C#-koodi)
│   │   ├── MatchSimulator.cs        # Godot Node; simulate_game(Dictionary)->Dictionary (interop-rajapinta)
│   │   └── SimContext.cs            # sisäiset C#-tyypit: SimSkater, SimGoalie, SimTeam, GameState (ei Godot-riippuvuutta)
│   ├── sim/                         # GDScript — simun orkestrointi
│   │   ├── match_adapter.gd         # MatchAdapter: TeamData -> input Dictionary; tulos -> mallien tilastot/fatigue
│   │   └── text_report.gd           # TextReport: tulos-Dictionary -> luettava teksti
│   ├── systems/                     # GDScript — pelijärjestelmät
│   │   ├── training_system.gd       # TrainingSystem: viikkofokus, fatigue, loukkaantumiset, kausikehitys
│   │   ├── economy_engine.gd        # EconomyEngine: kausibudjetti, kassa, game over
│   │   └── season_manager.gd        # SeasonManager: päivän edistys, runkosarja, pudotuspelit, kausivaihto
│   ├── models/                      # Sprint 1 -mallit + Sprint 2 -lisäkentät
│   │   ├── player_data.gd           # + season-tilastot (Task 2)
│   │   ├── goalie_data.gd           # + goalie season-tilastot (Task 2)
│   │   ├── team_data.gd             # + consecutive_negative_seasons (Task 10)
│   │   ├── scheduled_game.gd        # + went_to_overtime (Task 5)
│   │   ├── league_data.gd           # + playoff-kentät (Task 12)
│   │   └── world_data.gd            # (ennallaan)
│   └── autoload/
│       ├── game_state.gd            # + advance_day-delegointi SeasonManagerille (Task 11)
│       └── event_bus.gd             # (signaalit jo olemassa Sprint 1:stä)
├── tests/
│   └── gut/
│       ├── test_interop_skeleton.gd # Task 1
│       ├── test_match_simulator.gd  # Task 3–7
│       ├── test_match_adapter.gd    # Task 2
│       ├── test_text_report.gd      # Task 8
│       ├── test_training_system.gd  # Task 9
│       ├── test_economy_engine.gd   # Task 10
│       └── test_season_manager.gd   # Task 11–13
└── .github/
    └── workflows/
        └── ci.yml                   # + dotnet setup + build solution ennen GUT-ajoa (Task 1)
```

**Rajapintasäännöt:**
- `src/core/*.cs` — ainoa C#. `MatchSimulator` on ainoa `public` interop-piste. `SimContext.cs` on puhdas C# (ei `using Godot` paitsi tarvittaessa RNG).
- `src/sim/*.gd` — kääntää mallit ↔ Dictionary, ei pelilogiikkaa.
- `src/systems/*.gd` — pelilogiikka, operoi malleilla.
- Mallit (`src/models/`) pysyvät puhtaana datana (ei Node-riippuvuuksia).

---

## Interop-sopimus (lukitaan Task 3:ssa, käytetään kaikkialla)

**`MatchSimulator.simulate_game(input: Dictionary) -> Dictionary`**

Input:
```gdscript
{
  "seed": 12345,                       # int — determinismi
  "home": {
    "team_id": "wolves",
    "skaters": [                        # 18 kenttäpelaajaa (parhaat ensin)
      { "id": "p1", "shooting": 14, "passing": 12, "defensive_play": 10,
        "positioning": 11, "power_play": 13, "speed": 12, "checking": 9,
        "composure": 11, "stamina": 13, "fatigue": 20 },
      # ...
    ],
    "goalie": { "id": "g1", "save_ability": 15, "reflexes": 13,
                "goalie_positioning": 12, "mental_strength": 14, "fatigue": 10 },
    "penalty_rate": 1.0                 # joukkueen rangaistusalttius (1.0 = neutraali)
  },
  "away": { ... sama rakenne ... }
}
```

Output:
```gdscript
{
  "home_score": 3,
  "away_score": 2,
  "went_to_overtime": false,
  "events": [                          # aikajärjestyksessä; Sprint 3:n 2D-näkymä kuluttaa tämän
    { "time": 142, "period": 1, "type": "goal", "team": "home",
      "player_id": "p3", "assist_id": "p1" },
    { "time": 320, "period": 1, "type": "penalty", "team": "away",
      "player_id": "p9", "duration": 2 },
    { "time": 415, "period": 1, "type": "save", "team": "home", "player_id": "p5" },
    # ...
  ],
  "player_stats": {                    # vain kenttäpelaajat
    "p3": { "goals": 1, "assists": 0, "shots": 4 },
    "p1": { "goals": 0, "assists": 1, "shots": 2 },
    # ...
  },
  "goalie_stats": {
    "g1": { "saves": 28, "shots_against": 30, "goals_against": 2 },
    "g2": { "saves": 25, "shots_against": 28, "goals_against": 3 }
  }
}
```

Vain natiivit Godot-tyypit (Dictionary, Array, int, float, String, bool) ylittävät rajan → marshalling on automaattista ja luotettavaa.

> **C#-puolen marshalling-idiomi (TÄRKEÄ):** Godot 4.x .NET:ssä `Godot.Collections.Dictionary`-indeksointi palauttaa `Variant`-arvon. **Älä** käytä C-tyylistä castia (`(int)dict["x"]`) — se ei käänny/heittää. Käytä Variant-purkua: `dict["x"].AsInt32()`, `.AsString()`, `.AsDouble()`, `.AsBool()`, sisäkkäiset `dict["x"].As<Godot.Collections.Dictionary>()` ja `dict["x"].As<Godot.Collections.Array>()`. Avaimen olemassaolo: `dict.ContainsKey("x")`. C#-int/string/bool-arvon **asetus** Godot-Dictionaryyn (`result["k"] = 3;`) toimii implisiittisesti. Task 1:n kävelyluuranko paljastaa tämän idiomin heti.

---

## Testausstrategia

- **Yksi komento** ajaa kaikki testit (sama kuin Sprint 1, mutta C# käännetään ensin):
  ```bash
  # 1) Käännä C#-ratkaisu (Godot .NET vaatii käännetyn assemblyn ennen skriptien latausta)
  dotnet build ColdGM.sln -c Debug
  # 2) Importoi kahdesti (class_name-ristiriippuvuudet, kuten Sprint 1:ssä)
  "<godot_mono>" --headless --path . --import
  "<godot_mono>" --headless --path . --import
  # 3) Aja GUT
  "<godot_mono>" --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -glog=1 -gexit
  ```
  jossa `<godot_mono>` = `C:\Users\rauti\cold_gm\godot_4.3\Godot_v4.6.3-stable_mono_win64\Godot_v4.6.3-stable_mono_win64.exe` (ladataan Task 1:ssä; huomaa: .NET-build on hakemisto, ei yksittäinen .exe).
- **Determinismi:** sim-testit antavat kiinteän `seed`-arvon ja assertoivat tarkkoja tuloksia.
- **Tilastolliset testit:** aja sama matsi N kertaa eri siemenillä, assertoi keskiarvo haarukkaan (esim. maaleja/ottelu 1.5–5.0 per joukkue). Löysät rajat — tarkka kalibrointi on Sprint 5.
- **`assert_engine_error_count(0)`** epäsuorasti: jos C#-kutsu heittää, GUT näkee sen. Kuten Sprint 1:ssä, käytä `push_warning` (ei `push_error`) palautettaville virheille GDScript-puolella.

---

## Task 1: C#-työkaluketju ja interop-kävelyluuranko

**Tavoite:** Todista että GDScript→C#→GDScript-kutsu toimii headless-ajossa, ENNEN kuin rakennetaan oikeaa logiikkaa. Tämä de-riskaa "interop blockers" -ongelman etukäteen.

**Files:**
- Download: Godot 4.6.3 **.NET (mono)** -build → `cold_gm/godot_4.3/`
- Install: .NET SDK 8.0
- Create: `cold_gm/src/core/HelloSim.cs` (väliaikainen luuranko, poistetaan Task 3:ssa)
- Create: `cold_gm/tests/gut/test_interop_skeleton.gd`
- Modify: `cold_gm/project.godot` (dotnet-konfiguraatio — Godot luo)
- Modify: `cold_gm/.github/workflows/ci.yml`
- Modify: `cold_gm/.gitignore` (lisää `.mono/`, `bin/`, `obj/`)

- [ ] **1.1 Asenna .NET SDK 8.0**

Lataa ja asenna .NET SDK 8.0 (LTS): https://dotnet.microsoft.com/download/dotnet/8.0
Varmista (uudessa terminaalissa):
```bash
dotnet --version
```
Odotettu: `8.0.xxx`. (Nykytila: vain .NET-host löytyy, ei SDK:ta — tämä on pakollinen.)

- [ ] **1.2 Lataa Godot 4.6.3 .NET-build**

Nykyinen `Godot_v4.6.3-stable_win64.exe` on **vakiobuild — ei tue C#:aa.** Lataa .NET-versio:
```powershell
$url = "https://github.com/godotengine/godot/releases/download/4.6.3-stable/Godot_v4.6.3-stable_mono_win64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Users\rauti\cold_gm\godot_4.3\mono.zip" -UseBasicParsing
Expand-Archive "C:\Users\rauti\cold_gm\godot_4.3\mono.zip" -DestinationPath "C:\Users\rauti\cold_gm\godot_4.3\" -Force
```
Tulos: hakemisto `Godot_v4.6.3-stable_mono_win64/` jossa `.exe` + `GodotSharp/`-kansio.

- [ ] **1.3 Konfiguroi projekti C#:lle**

Avaa projekti .NET-Godotilla kerran editorissa (`Project → Tools → C# → Create C# solution`), TAI luo `ColdGM.csproj` + `ColdGM.sln` manuaalisesti. Godot lisää `project.godot`:hen:
```ini
[dotnet]
project/assembly_name="ColdGM"
```
Varmista että `ColdGM.csproj` targetoi `net8.0` ja viittaa `GodotSharp`-pakettiin (Godot generoi oikean version).

- [ ] **1.4 Kirjoita C#-luuranko**

`src/core/HelloSim.cs`:
```csharp
using Godot;

public partial class HelloSim : RefCounted
{
    // Yksinkertaisin mahdollinen interop: ota Dictionary, palauta Dictionary.
    public Godot.Collections.Dictionary Echo(Godot.Collections.Dictionary input)
    {
        var result = new Godot.Collections.Dictionary();
        // Godot 4.x .NET: Dictionary-indeksointi palauttaa Variantin.
        // EI C-tyylistä castia ((int)input["x"]) — käytä .AsInt32()/.AsString()/.AsDouble()/.As<T>().
        int seed = input.ContainsKey("seed") ? input["seed"].AsInt32() : -1;
        int value = input.ContainsKey("value") ? input["value"].AsInt32() : 0;
        result["received_seed"] = seed;
        result["doubled"] = value * 2;
        return result;
    }
}
```

- [ ] **1.5 Kirjoita testi joka epäonnistuu (luuranko ei vielä käänny/lataudu)**

`tests/gut/test_interop_skeleton.gd`:
```gdscript
extends GutTest

func test_csharp_echo_roundtrip():
    var hello = load("res://src/core/HelloSim.cs").new()
    var result: Dictionary = hello.Echo({ "seed": 42, "value": 21 })
    assert_eq(int(result["received_seed"]), 42, "seed should round-trip through C#")
    assert_eq(int(result["doubled"]), 42, "C# should double 21 -> 42")
```

- [ ] **1.6 Aja: käännä + importoi + testaa**

```bash
dotnet build ColdGM.sln -c Debug
"<godot_mono>" --headless --path . --import
"<godot_mono>" --headless --path . --import
"<godot_mono>" --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -glog=1 -gexit
```
Odotettu: `test_interop_skeleton.gd 1/1 passed`. **Jos tämä toimii, interop-riski on poistettu.** Jos C# ei käänny tai lataudu → ratkaise ENNEN jatkoa (tämä on Task 1:n koko tarkoitus).

- [ ] **1.7 Päivitä CI**

`.github/workflows/ci.yml` — lisää ennen GUT-stepiä:
```yaml
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      - name: Build C# solution
        run: dotnet build ColdGM.sln -c Debug
```
Ja vaihda CI:n Godot-lataus .NET-buildiin (mono).

- [ ] **1.8 Commit**

```bash
git add src/core/HelloSim.cs tests/gut/test_interop_skeleton.gd project.godot ColdGM.csproj ColdGM.sln .gitignore .github/workflows/ci.yml
git commit -m "build: C# toolchain + GDScript<->C# interop walking skeleton"
```

---

## Task 2: Pelaajatilastot malleihin + MatchAdapter

**Tavoite:** Lisää season-tilastokentät malleihin ja rakenna kaksisuuntainen kääntäjä `TeamData`/`PlayerData` ↔ interop-Dictionary.

**Files:**
- Modify: `src/models/player_data.gd` (season-tilastot)
- Modify: `src/models/goalie_data.gd` (goalie season-tilastot)
- Create: `src/sim/match_adapter.gd`
- Create: `tests/gut/test_match_adapter.gd`

- [ ] **2.1 Lisää season-tilastot PlayerDataan**

`src/models/player_data.gd`, lisää ennen `func full_name()`:
```gdscript
# Season-tilastot (nollataan kauden alussa SeasonManagerin toimesta)
@export var games_played: int = 0
@export var season_goals: int = 0
@export var season_assists: int = 0
@export var season_shots: int = 0

func season_points() -> int:
    return season_goals + season_assists
```

`src/models/goalie_data.gd`, lisää:
```gdscript
@export var season_saves: int = 0
@export var season_shots_against: int = 0
@export var season_goals_against: int = 0
@export var season_shutouts: int = 0

func save_percentage() -> float:
    if season_shots_against == 0:
        return 0.0
    return float(season_saves) / float(season_shots_against)
```

- [ ] **2.2 Kirjoita MatchAdapter-testi (epäonnistuu)**

`tests/gut/test_match_adapter.gd`:
```gdscript
extends GutTest

var adapter: MatchAdapter

func before_each():
    adapter = MatchAdapter.new()

func _make_team() -> TeamData:
    var t := TeamData.new()
    t.id = "wolves"
    for i in 18:
        var p := PlayerData.new()
        p.id = "p%d" % i
        p.shooting = 10 + (i % 5)
        p.fatigue = 20
        t.players.append(p)
    var g := GoalieData.new()
    g.id = "g1"
    g.save_ability = 15
    t.players.append(g)
    return t

func test_build_input_has_skaters_and_goalie():
    var d := adapter.build_team_input(_make_team())
    assert_eq(d["team_id"], "wolves")
    assert_eq((d["skaters"] as Array).size(), 18, "18 skaters expected")
    assert_eq(d["goalie"]["id"], "g1")
    assert_eq(int(d["goalie"]["save_ability"]), 15)

func test_skater_dict_carries_attributes():
    var d := adapter.build_team_input(_make_team())
    var first: Dictionary = d["skaters"][0]
    assert_true(first.has("shooting"))
    assert_true(first.has("fatigue"))

func test_apply_result_updates_player_stats():
    var team := _make_team()
    var result := {
        "player_stats": { "p0": { "goals": 2, "assists": 1, "shots": 5 } },
        "goalie_stats": { "g1": { "saves": 30, "shots_against": 33, "goals_against": 3 } }
    }
    adapter.apply_result_to_team(team, result, true)  # true = played this game
    var p0 := team.players[0]
    assert_eq(p0.season_goals, 2)
    assert_eq(p0.season_assists, 1)
    assert_eq(p0.season_shots, 5)
    assert_eq(p0.games_played, 1)
    var goalie: GoalieData = team.players[18]
    assert_eq(goalie.season_saves, 30)
    assert_eq(goalie.season_goals_against, 3)
```

- [ ] **2.3 Aja testi → FAIL** (`MatchAdapter` ei ole olemassa).

- [ ] **2.4 Toteuta MatchAdapter**

`src/sim/match_adapter.gd`:
```gdscript
class_name MatchAdapter

# Rakentaa interop-input-Dictionaryn joukkueesta.
# Valitsee 18 parasta kenttäpelaajaa + parhaan maalivahdin.
func build_team_input(team: TeamData) -> Dictionary:
    var skaters: Array = []
    var goalies: Array = []
    for p in team.players:
        if p.is_injured:
            continue
        if p is GoalieData:
            goalies.append(p)
        else:
            skaters.append(p)
    skaters.sort_custom(func(a, b): return a.overall_rating() > b.overall_rating())
    goalies.sort_custom(func(a, b): return a.save_ability > b.save_ability)

    var skater_dicts: Array = []
    for p in skaters.slice(0, 18):
        skater_dicts.append({
            "id": p.id, "shooting": p.shooting, "passing": p.passing,
            "defensive_play": p.defensive_play, "positioning": p.positioning,
            "power_play": p.power_play, "speed": p.speed, "checking": p.checking,
            "composure": p.composure, "stamina": p.stamina, "fatigue": p.fatigue
        })

    var goalie_dict := {}
    if goalies.size() > 0:
        var g: GoalieData = goalies[0]
        goalie_dict = {
            "id": g.id, "save_ability": g.save_ability, "reflexes": g.reflexes,
            "goalie_positioning": g.goalie_positioning,
            "mental_strength": g.mental_strength, "fatigue": g.fatigue
        }

    return {
        "team_id": team.id, "skaters": skater_dicts,
        "goalie": goalie_dict, "penalty_rate": 1.0
    }

# Soveltaa simu-tuloksen joukkueen pelaajiin (tilastot + games_played).
# played = pelasiko tämä joukkue tämän ottelun (true: +games_played).
func apply_result_to_team(team: TeamData, result: Dictionary, played: bool) -> void:
    var pstats: Dictionary = result.get("player_stats", {})
    var gstats: Dictionary = result.get("goalie_stats", {})
    for p in team.players:
        if p is GoalieData and gstats.has(p.id):
            var gs: Dictionary = gstats[p.id]
            p.season_saves += int(gs.get("saves", 0))
            p.season_shots_against += int(gs.get("shots_against", 0))
            p.season_goals_against += int(gs.get("goals_against", 0))
            if int(gs.get("goals_against", 0)) == 0:
                p.season_shutouts += 1
            if played:
                p.games_played += 1
        elif pstats.has(p.id):
            var ps: Dictionary = pstats[p.id]
            p.season_goals += int(ps.get("goals", 0))
            p.season_assists += int(ps.get("assists", 0))
            p.season_shots += int(ps.get("shots", 0))
            if played:
                p.games_played += 1
```

- [ ] **2.5 Aja testi → PASS.**

- [ ] **2.6 Commit**
```bash
git add src/models/player_data.gd src/models/goalie_data.gd src/sim/match_adapter.gd tests/gut/test_match_adapter.gd src/models/*.uid src/sim/*.uid
git commit -m "feat: season stat fields + MatchAdapter (model<->interop dict)"
```

---

## Task 3: MatchSimulator-ydin — laukaus/torjunta + maalit

**Tavoite:** Korvaa `HelloSim.cs` oikealla `MatchSimulator.cs`:llä. Toteuta deterministinen tapahtumasilmukka laukaus/torjunta-matematiikalla (spec §4.1). Ei vielä rangaistuksia/PP — Task 4.

**Files:**
- Create: `src/core/SimContext.cs`
- Create: `src/core/MatchSimulator.cs`
- Delete: `src/core/HelloSim.cs` ja `tests/gut/test_interop_skeleton.gd`
- Create: `tests/gut/test_match_simulator.gd`

- [ ] **3.1 Kirjoita sisäiset C#-tyypit**

`src/core/SimContext.cs`:
```csharp
using System.Collections.Generic;

namespace ColdGM.Core
{
    public class SimSkater
    {
        public string Id;
        public int Shooting, Passing, DefensivePlay, Positioning, PowerPlay, Speed, Checking, Composure, Stamina;
        public int StartFatigue;          // 0–100, simun syöte
        public double InGameFatigue;      // kertyy pelin aikana
        public int Goals, Assists, Shots; // kertyvät tilastot
    }

    public class SimGoalie
    {
        public string Id;
        public int SaveAbility, Reflexes, GoaliePositioning, MentalStrength;
        public int StartFatigue;
        public int Saves, ShotsAgainst, GoalsAgainst;
    }

    public class SimTeam
    {
        public string TeamId;
        public List<SimSkater> Skaters = new();
        public SimGoalie Goalie;
        public double PenaltyRate = 1.0;
        public int Score;
        // PP/PK-tila (Task 4)
        public int PenaltySecondsRemaining = 0;
    }

    public class GameState
    {
        public SimTeam Home, Away;
        public int Time;       // sekuntia 0..3600 (+ OT)
        public int Period;     // 1,2,3, (4=OT)
        public bool WentToOvertime = false;
    }
}
```

- [ ] **3.2 Kirjoita MatchSimulator-testi (epäonnistuu)**

`tests/gut/test_match_simulator.gd`:
```gdscript
extends GutTest

var sim

func before_each():
    sim = load("res://src/core/MatchSimulator.cs").new()

func _balanced_team(prefix: String, shooting: int, save_ability: int) -> Dictionary:
    var skaters: Array = []
    for i in 18:
        skaters.append({
            "id": "%s_p%d" % [prefix, i], "shooting": shooting, "passing": 10,
            "defensive_play": 10, "positioning": 10, "power_play": 10,
            "speed": 10, "checking": 10, "composure": 10, "stamina": 10, "fatigue": 0
        })
    return {
        "team_id": prefix, "skaters": skaters,
        "goalie": { "id": "%s_g" % prefix, "save_ability": save_ability,
                    "reflexes": 10, "goalie_positioning": 10,
                    "mental_strength": 10, "fatigue": 0 },
        "penalty_rate": 1.0
    }

func test_result_has_required_keys():
    var r: Dictionary = sim.simulate_game({
        "seed": 1, "home": _balanced_team("H", 10, 10), "away": _balanced_team("A", 10, 10)
    })
    for key in ["home_score", "away_score", "went_to_overtime", "events", "player_stats", "goalie_stats"]:
        assert_true(r.has(key), "result missing key: " + key)

func test_deterministic_same_seed_same_score():
    var input := { "seed": 777, "home": _balanced_team("H", 10, 10), "away": _balanced_team("A", 10, 10) }
    var r1: Dictionary = sim.simulate_game(input)
    var r2: Dictionary = sim.simulate_game(input)
    assert_eq(r1["home_score"], r2["home_score"], "same seed -> same home score")
    assert_eq(r1["away_score"], r2["away_score"], "same seed -> same away score")

func test_no_tie_after_simulation():
    # Jatkoaika takaa ratkaisun; tulos ei voi olla tasan.
    var r: Dictionary = sim.simulate_game({
        "seed": 5, "home": _balanced_team("H", 10, 10), "away": _balanced_team("A", 10, 10)
    })
    assert_ne(r["home_score"], r["away_score"], "game must have a winner")

func test_better_shooters_score_more_on_average():
    var strong_total := 0
    var weak_total := 0
    for s in 30:
        var r: Dictionary = sim.simulate_game({
            "seed": s, "home": _balanced_team("H", 18, 10), "away": _balanced_team("A", 4, 10)
        })
        strong_total += int(r["home_score"])
        weak_total += int(r["away_score"])
    assert_gt(strong_total, weak_total, "shooting 18 team should outscore shooting 4 team over 30 games")

func test_goals_per_game_in_plausible_range():
    var total := 0
    var n := 40
    for s in n:
        var r: Dictionary = sim.simulate_game({
            "seed": s + 100, "home": _balanced_team("H", 10, 10), "away": _balanced_team("A", 10, 10)
        })
        total += int(r["home_score"]) + int(r["away_score"])
    var avg_per_team := float(total) / float(n) / 2.0
    # Löysät rajat — tarkka kalibrointi Sprint 5 (tavoite 2.5–3.5).
    assert_between(avg_per_team, 1.5, 5.0, "avg goals/team/game should be plausible")

func test_player_stats_sum_to_score():
    var r: Dictionary = sim.simulate_game({
        "seed": 9, "home": _balanced_team("H", 12, 10), "away": _balanced_team("A", 12, 10)
    })
    var home_goals := 0
    for pid in r["player_stats"]:
        if String(pid).begins_with("H_"):
            home_goals += int(r["player_stats"][pid]["goals"])
    assert_eq(home_goals, int(r["home_score"]), "home player goals must sum to home score")
```

- [ ] **3.3 Aja testi → FAIL** (`MatchSimulator` ei olemassa / `HelloSim` poistettava ensin).

- [ ] **3.4 Toteuta MatchSimulator (regulation + OT, ei vielä rangaistuksia)**

`src/core/MatchSimulator.cs`:
```csharp
using Godot;
using System;
using System.Collections.Generic;
using ColdGM.Core;

public partial class MatchSimulator : RefCounted
{
    const int GameDuration = 3600;   // 60 min
    const int PeriodDuration = 1200; // 20 min
    const int MaxOvertime = 1200;    // 20 min OT, sitten shootout-fallback

    // Tuningvakioita — Sprint 5 kalibroi Monte Carlolla.
    const double ShotProbPerSecond = 0.011;  // ~40 laukausyritystä/ottelu/joukkue
    const double FatiguePerSecond = 0.004;    // pelinsisäinen väsymys

    private Random _rng;
    private Godot.Collections.Array _events;

    public Godot.Collections.Dictionary simulate_game(Godot.Collections.Dictionary input)
    {
        // Godot 4.x .NET: Variant-unpacking .AsInt32()/.As<T>() — EI C-tyylistä castia.
        int seed = input.ContainsKey("seed") ? input["seed"].AsInt32() : 0;
        _rng = new Random(seed);
        _events = new Godot.Collections.Array();

        var state = new GameState
        {
            Home = ParseTeam(input["home"].As<Godot.Collections.Dictionary>()),
            Away = ParseTeam(input["away"].As<Godot.Collections.Dictionary>())
        };

        for (state.Time = 0; state.Time < GameDuration; state.Time++)
        {
            state.Period = state.Time / PeriodDuration + 1;
            Tick(state);
        }

        // Jatkoaika: sudden death
        if (state.Home.Score == state.Away.Score)
        {
            state.WentToOvertime = true;
            state.Period = 4;
            int otStart = state.Time;
            while (state.Home.Score == state.Away.Score && state.Time < otStart + MaxOvertime)
            {
                Tick(state);
                state.Time++;
            }
            // Shootout-fallback jos yhä tasan: attribuoi ratkaiseva maali pelaajalle,
            // jotta invariantti "pelaajien maalit = joukkueen maalit" säilyy (Task 14).
            if (state.Home.Score == state.Away.Score)
                ResolveShootout(state);
        }

        return BuildResult(state);
    }

    // Shootout: arvo voittaja, attribuoi maali kentälliselle (EI maalivahdin GA:han —
    // shootout-maalit eivät ole laukauksia maalia kohti eivätkä riko shutoutia).
    private void ResolveShootout(GameState state)
    {
        SimTeam winner = _rng.NextDouble() < 0.5 ? state.Home : state.Away;
        SimSkater scorer = SelectShooter(winner);
        winner.Score++;
        scorer.Goals++;
        AddEvent(state, "goal", winner, scorer.Id, "");
    }

    private void Tick(GameState state)
    {
        UpdateFatigue(state.Home);
        UpdateFatigue(state.Away);
        // Kumpi joukkue hyökkää tällä tickillä (yksinkertaistus: tasapeli + attribuuttipaino tulee Task 4:ssä)
        MaybeShot(state, state.Home, state.Away);
        MaybeShot(state, state.Away, state.Home);
    }

    private void MaybeShot(GameState state, SimTeam attacking, SimTeam defending)
    {
        if (_rng.NextDouble() >= ShotProbPerSecond) return;

        SimSkater shooter = SelectShooter(attacking);
        double fatigueMod = Math.Min(shooter.InGameFatigue + shooter.StartFatigue, 100) / 100.0;
        double zoneMod = 1.0;
        // spec §4.1: shot_quality = (shooting/20)*0.15*(1-fatigueMod)*zoneMod
        double shotQuality = (shooter.Shooting / 20.0) * 0.15 * (1 - fatigueMod) * zoneMod;

        SimGoalie g = defending.Goalie;
        double goalieFatigue = g.StartFatigue / 100.0;
        // spec §4.1: save_prob = 0.80 + (save_ability/20)*0.15*(1 - goalieFatigue*0.1)
        double saveProb = 0.80 + (g.SaveAbility / 20.0) * 0.15 * (1 - goalieFatigue * 0.1);

        double threshold = saveProb - shotQuality;
        shooter.Shots++;
        g.ShotsAgainst++;

        if (_rng.NextDouble() > threshold)
        {
            attacking.Score++;
            shooter.Goals++;
            g.GoalsAgainst++;
            SimSkater assist = SelectAssist(attacking, shooter);
            if (assist != null) assist.Assists++;
            AddEvent(state, "goal", attacking, shooter.Id, assist?.Id ?? "");
        }
        else
        {
            g.Saves++;
            AddEvent(state, "save", defending, g.Id, "");
        }
    }

    private SimSkater SelectShooter(SimTeam t)
    {
        // Painotettu shootingin mukaan
        double totalWeight = 0;
        foreach (var s in t.Skaters) totalWeight += s.Shooting;
        double r = _rng.NextDouble() * totalWeight;
        foreach (var s in t.Skaters) { r -= s.Shooting; if (r <= 0) return s; }
        return t.Skaters[0];
    }

    private SimSkater SelectAssist(SimTeam t, SimSkater shooter)
    {
        // ~60% maaleista saa syöttöpisteen
        if (_rng.NextDouble() > 0.6) return null;
        for (int i = 0; i < 8; i++)
        {
            var cand = t.Skaters[_rng.Next(t.Skaters.Count)];
            if (cand != shooter) return cand;
        }
        return null;
    }

    private void UpdateFatigue(SimTeam t)
    {
        foreach (var s in t.Skaters) s.InGameFatigue += FatiguePerSecond;
    }

    private void AddEvent(GameState state, string type, SimTeam team, string playerId, string assistId)
    {
        var e = new Godot.Collections.Dictionary
        {
            ["time"] = state.Time, ["period"] = state.Period, ["type"] = type,
            ["team"] = team == state.Home ? "home" : "away",
            ["player_id"] = playerId, ["assist_id"] = assistId
        };
        _events.Add(e);
    }

    private SimTeam ParseTeam(Godot.Collections.Dictionary d)
    {
        // Variant-unpacking: .AsString()/.AsInt32()/.AsDouble()/.As<Godot.Collections.X>().
        var t = new SimTeam
        {
            TeamId = d["team_id"].AsString(),
            PenaltyRate = d.ContainsKey("penalty_rate") ? d["penalty_rate"].AsDouble() : 1.0
        };
        foreach (var sv in d["skaters"].As<Godot.Collections.Array>())
        {
            var s = sv.As<Godot.Collections.Dictionary>();
            t.Skaters.Add(new SimSkater
            {
                Id = s["id"].AsString(), Shooting = s["shooting"].AsInt32(), Passing = s["passing"].AsInt32(),
                DefensivePlay = s["defensive_play"].AsInt32(), Positioning = s["positioning"].AsInt32(),
                PowerPlay = s["power_play"].AsInt32(), Speed = s["speed"].AsInt32(), Checking = s["checking"].AsInt32(),
                Composure = s["composure"].AsInt32(), Stamina = s["stamina"].AsInt32(),
                StartFatigue = s["fatigue"].AsInt32()
            });
        }
        var gd = d["goalie"].As<Godot.Collections.Dictionary>();
        t.Goalie = new SimGoalie
        {
            Id = gd["id"].AsString(), SaveAbility = gd["save_ability"].AsInt32(), Reflexes = gd["reflexes"].AsInt32(),
            GoaliePositioning = gd["goalie_positioning"].AsInt32(), MentalStrength = gd["mental_strength"].AsInt32(),
            StartFatigue = gd["fatigue"].AsInt32()
        };
        return t;
    }

    private Godot.Collections.Dictionary BuildResult(GameState state)
    {
        var pstats = new Godot.Collections.Dictionary();
        var gstats = new Godot.Collections.Dictionary();
        foreach (var team in new[] { state.Home, state.Away })
        {
            foreach (var s in team.Skaters)
                pstats[s.Id] = new Godot.Collections.Dictionary
                    { ["goals"] = s.Goals, ["assists"] = s.Assists, ["shots"] = s.Shots };
            gstats[team.Goalie.Id] = new Godot.Collections.Dictionary
                { ["saves"] = team.Goalie.Saves, ["shots_against"] = team.Goalie.ShotsAgainst,
                  ["goals_against"] = team.Goalie.GoalsAgainst };
        }
        return new Godot.Collections.Dictionary
        {
            ["home_score"] = state.Home.Score, ["away_score"] = state.Away.Score,
            ["went_to_overtime"] = state.WentToOvertime, ["events"] = _events,
            ["player_stats"] = pstats, ["goalie_stats"] = gstats
        };
    }
}
```

- [ ] **3.5 Poista luuranko**
```bash
git rm src/core/HelloSim.cs tests/gut/test_interop_skeleton.gd
```

- [ ] **3.6 Aja: käännä + importoi + testaa → kaikki `test_match_simulator.gd` vihreänä.**
Jos `test_goals_per_game_in_plausible_range` failaa, säädä `ShotProbPerSecond`-vakiota (älä testin rajoja — rajat ovat tarkoituksella löysät).

- [ ] **3.7 Commit**
```bash
git add src/core/SimContext.cs src/core/MatchSimulator.cs tests/gut/test_match_simulator.gd
git commit -m "feat: MatchSimulator core — deterministic event loop, shot/save, OT"
```

---

## Task 4: Rangaistukset + ylivoima/alivoima (PP/PK)

**Tavoite:** Lisää rangaistustapahtumat ja PP/PK-tilat jotka muuttavat laukaustodennäköisyyttä (spec §4.1 "Ylivoima/alivoima").

**Files:**
- Modify: `src/core/MatchSimulator.cs`
- Modify: `tests/gut/test_match_simulator.gd`

- [ ] **4.1 Lisää testit (epäonnistuvat)**

Lisää `tests/gut/test_match_simulator.gd`:hen:
```gdscript
func test_penalties_are_emitted():
    var found_penalty := false
    for s in 20:
        var r: Dictionary = sim.simulate_game({
            "seed": s, "home": _balanced_team("H", 10, 10), "away": _balanced_team("A", 10, 10)
        })
        for e in r["events"]:
            if e["type"] == "penalty":
                found_penalty = true
                assert_true(e["duration"] == 2 or e["duration"] == 5, "penalty 2 or 5 min")
    assert_true(found_penalty, "penalties should occur over 20 games")

func test_powerplay_increases_scoring():
    # Korkea penalty_rate vastustajalla -> enemmän PP-aikaa -> enemmän maaleja.
    var pp_total := 0
    var even_total := 0
    for s in 25:
        var pp_away := _balanced_team("A", 10, 10)
        pp_away["penalty_rate"] = 3.0   # ottaa paljon jäähyjä
        var r_pp: Dictionary = sim.simulate_game({ "seed": s, "home": _balanced_team("H", 10, 10), "away": pp_away })
        pp_total += int(r_pp["home_score"])
        var r_even: Dictionary = sim.simulate_game({ "seed": s, "home": _balanced_team("H", 10, 10), "away": _balanced_team("A", 10, 10) })
        even_total += int(r_even["home_score"])
    assert_gt(pp_total, even_total, "more opponent penalties -> more goals for")
```

- [ ] **4.2 Toteuta rangaistukset + PP/PK**

`MatchSimulator.cs`:hen:
- Lisää `const double PenaltyProbPerSecond = 0.0009;` (×penalty_rate).
- `Tick`-metodissa: ennen laukauksia, `MaybePenalty(state, team)` molemmille; jos osuma, aseta `team.PenaltySecondsRemaining = duration*60` ja lisää `penalty`-event (`duration` kentäksi). Valitse rikkoja painottaen `Checking`-attribuutilla.
- Vähennä `PenaltySecondsRemaining` joka tick; kun 0, PK päättyy.
- `MaybeShot`-modifikaattorit (spec §4.1):
  - Jos puolustava joukkue on PK:ssa (sillä on `PenaltySecondsRemaining > 0`): hyökkäävän `ShotProb ×1.6`, `shotQuality ×1.3`.
  - Jos hyökkäävä joukkue on PK:ssa: sen `ShotProb ×0.6` (−40%).

- [ ] **4.3 Aja → kaikki vihreänä. Tarkista että `test_deterministic_same_seed_same_score` yhä läpäisee** (rangaistukset käyttävät samaa `_rng`-virtaa → yhä deterministinen).

- [ ] **4.4 Commit**
```bash
git add src/core/MatchSimulator.cs tests/gut/test_match_simulator.gd
git commit -m "feat: penalties + power play / penalty kill scoring modifiers"
```

---

## Task 5: Joukkuetulos malleihin (W/L/OTL, GF/GA) + OT-lippu

**Tavoite:** `MatchAdapter` soveltaa ottelutuloksen joukkueiden standings-kenttiin ja `ScheduledGame`-tietueeseen.

**Files:**
- Modify: `src/models/scheduled_game.gd` (lisää `went_to_overtime`)
- Modify: `src/sim/match_adapter.gd` (lisää `apply_game_result`)
- Modify: `tests/gut/test_match_adapter.gd`

- [ ] **5.1 Lisää `went_to_overtime` ScheduledGameen**
```gdscript
@export var went_to_overtime: bool = false
```

- [ ] **5.2 Lisää testi (epäonnistuu)**
```gdscript
func test_apply_game_result_updates_standings():
    var home := _make_team()
    var away := _make_team()
    away.id = "bears"
    var game := ScheduledGame.new()
    game.home_team_id = "wolves"
    game.away_team_id = "bears"
    var result := { "home_score": 4, "away_score": 2, "went_to_overtime": false,
                    "player_stats": {}, "goalie_stats": {} }
    adapter.apply_game_result(game, home, away, result)
    assert_eq(game.is_played, true)
    assert_eq(game.home_score, 4)
    assert_eq(home.wins, 1)
    assert_eq(home.goals_for, 4)
    assert_eq(home.goals_against, 2)
    assert_eq(away.losses, 1)
    assert_eq(away.overtime_losses, 0)

func test_overtime_loss_awards_otl():
    var home := _make_team(); var away := _make_team(); away.id = "bears"
    var game := ScheduledGame.new()
    var result := { "home_score": 3, "away_score": 2, "went_to_overtime": true,
                    "player_stats": {}, "goalie_stats": {} }
    adapter.apply_game_result(game, home, away, result)
    assert_eq(home.wins, 1)
    assert_eq(away.overtime_losses, 1, "OT loser gets OTL")
    assert_eq(away.losses, 0)
```

- [ ] **5.3 Toteuta `apply_game_result`**

`match_adapter.gd`:hen:
```gdscript
# Soveltaa täyden ottelutuloksen: standings molemmille + tilastot + ScheduledGame-tila.
func apply_game_result(game: ScheduledGame, home: TeamData, away: TeamData, result: Dictionary) -> void:
    var hs := int(result["home_score"])
    var as_ := int(result["away_score"])
    var ot: bool = result.get("went_to_overtime", false)

    game.is_played = true
    game.home_score = hs
    game.away_score = as_
    game.went_to_overtime = ot

    home.goals_for += hs
    home.goals_against += as_
    away.goals_for += as_
    away.goals_against += hs

    if hs > as_:
        home.wins += 1
        if ot: away.overtime_losses += 1
        else:  away.losses += 1
    else:
        away.wins += 1
        if ot: home.overtime_losses += 1
        else:  home.losses += 1

    apply_result_to_team(home, result, true)
    apply_result_to_team(away, result, true)
```

- [ ] **5.4 Aja → PASS.**

- [ ] **5.5 Commit**
```bash
git add src/models/scheduled_game.gd src/sim/match_adapter.gd tests/gut/test_match_adapter.gd
git commit -m "feat: apply game result to standings (W/L/OTL, GF/GA) + OT flag"
```

---

## Task 6: GameRunner-fasadi — yksi kutsu pelaa ottelun loppuun

**Tavoite:** Yhdistä adapter + simu yhdeksi GDScript-fasadiksi jonka `SeasonManager` kutsuu. Pitää SeasonManagerin tietämättömänä interop-yksityiskohdista.

**Files:**
- Create: `src/sim/game_runner.gd`
- Create: `tests/gut/test_game_runner.gd`

- [ ] **6.1 Testi (epäonnistuu)**
```gdscript
extends GutTest

var runner: GameRunner

func before_each():
    runner = GameRunner.new()

func _team(id: String) -> TeamData:
    var t := TeamData.new(); t.id = id
    for i in 18:
        var p := PlayerData.new(); p.id = "%s_p%d" % [id, i]; p.shooting = 10
        t.players.append(p)
    var g := GoalieData.new(); g.id = "%s_g" % id; g.save_ability = 12
    t.players.append(g)
    return t

func test_run_game_updates_both_teams_and_schedule():
    var home := _team("wolves")
    var away := _team("bears")
    var game := ScheduledGame.new()
    game.home_team_id = "wolves"; game.away_team_id = "bears"
    runner.run_game(game, home, away, 42)
    assert_true(game.is_played)
    assert_eq(home.wins + away.wins, 1, "exactly one team won")
    assert_gt(home.players[0].games_played + away.players[0].games_played, 0)
```

- [ ] **6.2 Toteuta GameRunner**

`src/sim/game_runner.gd`:
```gdscript
class_name GameRunner

var _sim = load("res://src/core/MatchSimulator.cs").new()
var _adapter := MatchAdapter.new()

# Pelaa ottelun loppuun ja soveltaa kaiken malleihin.
func run_game(game: ScheduledGame, home: TeamData, away: TeamData, seed: int) -> Dictionary:
    var input := {
        "seed": seed,
        "home": _adapter.build_team_input(home),
        "away": _adapter.build_team_input(away)
    }
    var result: Dictionary = _sim.simulate_game(input)
    _adapter.apply_game_result(game, home, away, result)
    return result
```

- [ ] **6.3 Aja → PASS. Commit**
```bash
git add src/sim/game_runner.gd tests/gut/test_game_runner.gd src/sim/*.uid
git commit -m "feat: GameRunner facade — simulate + apply in one call"
```

---

## Task 7: Pelinsisäisen fatiguen sovellus malleihin ottelun jälkeen

**Tavoite:** Ottelun jälkeen pelanneiden pelaajien pysyvä `fatigue` kasvaa (spec §4.3: pelanneet +8, vaihtopenkki +2). Loukkaantumistarkistus per ottelu.

**Files:**
- Modify: `src/sim/match_adapter.gd` (tai GameRunner) — `apply_post_game_fatigue`
- Modify: `tests/gut/test_match_adapter.gd`

- [ ] **7.1 Testi (epäonnistuu)**
```gdscript
func test_post_game_fatigue_applied():
    var team := _make_team()       # 18 skaters + 1 goalie
    team.players[0].fatigue = 0
    # Merkitse kentällä olleet (top-18 + goalie); loput penkki.
    adapter.apply_post_game_fatigue(team, ["p0", "p1"])  # vain p0,p1 pelasi
    assert_eq(team.players[0].fatigue, 8, "player who played gets +8")
    # Pelaaja joka ei pelannut saa +2
    var bench_idx := -1
    for i in team.players.size():
        if team.players[i].id == "p5": bench_idx = i
    assert_eq(team.players[bench_idx].fatigue, 2, "bench player gets +2")
```

- [ ] **7.2 Toteuta `apply_post_game_fatigue`**
```gdscript
# played_ids = pelaajat jotka olivat kokoonpanossa (build_team_input valitsi).
func apply_post_game_fatigue(team: TeamData, played_ids: Array) -> void:
    for p in team.players:
        if p.is_injured:
            continue
        if p.id in played_ids:
            p.fatigue = mini(100, p.fatigue + 8)
        else:
            p.fatigue = mini(100, p.fatigue + 2)
```
Päivitä `build_team_input` palauttamaan myös valitut id:t, TAI lisää `GameRunner.run_game` keräämään `played_ids` inputista ja kutsumaan tämä. (Suositus: GameRunner kerää `played_ids` rakentamastaan inputista ja kutsuu `apply_post_game_fatigue` molemmille joukkueille.)

- [ ] **7.3 Aja → PASS. Commit**
```bash
git add src/sim/match_adapter.gd src/sim/game_runner.gd tests/gut/test_match_adapter.gd
git commit -m "feat: post-game fatigue accrual (+8 played, +2 bench)"
```

---

## Task 8: Tekstipohjainen otteluraportti

**Tavoite:** Muotoile tulos-Dictionary luettavaksi tekstiselosteeksi (spec roadmap "tekstiraportti"). Tämä on Sprint 2:n näkyvä output ennen Sprint 3:n 2D-näkymää.

**Files:**
- Create: `src/sim/text_report.gd`
- Create: `tests/gut/test_text_report.gd`

- [ ] **8.1 Testi (epäonnistuu)**
```gdscript
extends GutTest

var report: TextReport

func before_each():
    report = TextReport.new()

func test_report_contains_final_score():
    var result := {
        "home_score": 3, "away_score": 2, "went_to_overtime": false,
        "events": [
            { "time": 142, "period": 1, "type": "goal", "team": "home", "player_id": "Korhonen", "assist_id": "Virtanen" }
        ],
        "player_stats": {}, "goalie_stats": {}
    }
    var text := report.generate(result, "Arctic Wolves", "Ice Bears")
    assert_true(text.contains("Arctic Wolves"))
    assert_true(text.contains("Ice Bears"))
    assert_true(text.contains("3") and text.contains("2"))
    assert_true(text.contains("Korhonen"), "goal scorer named in report")

func test_overtime_marked():
    var result := { "home_score": 2, "away_score": 1, "went_to_overtime": true,
                    "events": [], "player_stats": {}, "goalie_stats": {} }
    var text := report.generate(result, "A", "B")
    assert_true(text.to_lower().contains("ot") or text.to_lower().contains("jatkoa"), "OT noted")
```

- [ ] **8.2 Toteuta TextReport**

`src/sim/text_report.gd` — `generate(result, home_name, away_name) -> String`:
- Otsikkorivi: `"%s %d – %d %s%s"` (home, hs, as, away, OT-merkki).
- Maaliyhteenveto erittäin: iteroi `events` joissa `type == "goal"`, tulosta `"  P%d %02d:%02d  %s (%s)"` (period, min, sek, scorer, assist).
- Loppuun laukaukset: summaa `goalie_stats` → "Laukaukset: HOME shots_against vs AWAY shots_against". (Huom: `goalie_stats[g].shots_against` = vastustajan laukaukset kyseistä maalivahtia kohti.)
- Käytä id:itä nimien sijaan jos nimikarttaa ei anneta — Task ei vaadi nimihakua, SeasonManager voi syöttää nimet myöhemmin.

- [ ] **8.3 Aja → PASS. Commit**
```bash
git add src/sim/text_report.gd tests/gut/test_text_report.gd
git commit -m "feat: text match report (score, goal summary, shots)"
```

---

## Task 9: TrainingSystem — viikkofokus, fatigue, loukkaantumiset, kausikehitys

**Tavoite:** Toteuta harjoitusjärjestelmä (spec §4.3) ja kauden lopun ikäkehitys (spec §4.2).

**Files:**
- Create: `src/systems/training_system.gd`
- Create: `tests/gut/test_training_system.gd`

- [ ] **9.1 Testit (epäonnistuvat)**
```gdscript
extends GutTest

var ts: TrainingSystem

func before_each():
    ts = TrainingSystem.new()

func _player(age: int, fatigue: int) -> PlayerData:
    var p := PlayerData.new(); p.age = age; p.fatigue = fatigue; p.id = "p1"
    return p

func test_rest_focus_reduces_fatigue():
    var p := _player(25, 50)
    ts.apply_weekly_training([p], TrainingSystem.Focus.REST)
    assert_eq(p.fatigue, 15, "rest focus -35 fatigue (50->15)")

func test_intensive_increases_fatigue():
    var p := _player(25, 10)
    ts.apply_weekly_training([p], TrainingSystem.Focus.INTENSIVE)
    assert_eq(p.fatigue, 25, "intensive +15 fatigue")

func test_fatigue_never_below_zero():
    var p := _player(25, 5)
    ts.apply_weekly_training([p], TrainingSystem.Focus.REST)
    assert_eq(p.fatigue, 0, "fatigue floored at 0")

func test_injured_player_decrements_weeks():
    var p := _player(25, 0)
    p.is_injured = true; p.injury_weeks_remaining = 2
    ts.apply_weekly_training([p], TrainingSystem.Focus.TECHNIQUE)
    assert_eq(p.injury_weeks_remaining, 1)
    assert_true(p.is_injured)
    ts.apply_weekly_training([p], TrainingSystem.Focus.TECHNIQUE)
    assert_eq(p.injury_weeks_remaining, 0)
    assert_false(p.is_injured, "returns from injury at 0 weeks")

func test_young_player_develops_at_season_end():
    var p := _player(19, 0)
    p.hidden_potential = 18
    p.shooting = 10
    var rng := RandomNumberGenerator.new(); rng.seed = 1
    ts.apply_season_development([p], rng)
    assert_gte(p.shooting, 10, "young high-potential player should not regress")

func test_old_player_declines():
    var p := _player(35, 0)
    p.skating = 15
    var rng := RandomNumberGenerator.new(); rng.seed = 1
    ts.apply_season_development([p], rng)
    assert_lte(p.skating, 15, "35yo should decline or hold")
```

- [ ] **9.2 Toteuta TrainingSystem**

`src/systems/training_system.gd`:
```gdscript
class_name TrainingSystem

enum Focus { TECHNIQUE, PHYSICAL, TACTICS, REST, INTENSIVE }

const _FATIGUE_DELTA := {
    Focus.TECHNIQUE: 5, Focus.PHYSICAL: 4, Focus.TACTICS: 3,
    Focus.REST: -35, Focus.INTENSIVE: 15
}

# Viikoittainen harjoittelu: fatigue + loukkaantumisten purku.
func apply_weekly_training(players: Array, focus: int) -> void:
    for p in players:
        if p.is_injured:
            p.injury_weeks_remaining -= 1
            if p.injury_weeks_remaining <= 0:
                p.is_injured = false
                p.injury_weeks_remaining = 0
                p.fatigue = 0   # spec: nollautuu kun palaa peliin
            continue
        p.fatigue = clampi(p.fatigue + _FATIGUE_DELTA[focus], 0, 100)

# Loukkaantumistarkistus per ottelu (spec §4.3).
# Palauttaa true jos pelaaja loukkaantui.
func check_injury(p: PlayerData, rng: RandomNumberGenerator) -> bool:
    var base_risk := 0.02 + (p.checking / 200.0) + (p.fatigue / 1000.0)
    if rng.randf() < base_risk:
        p.is_injured = true
        p.injury_weeks_remaining = rng.randi_range(1, 8)
        return true
    return false

# Kauden lopun ikäkehitys (spec §4.2).
func apply_season_development(players: Array, rng: RandomNumberGenerator) -> void:
    var attrs := ["skating", "shooting", "passing", "puck_handling", "positioning",
                  "defensive_play", "power_play", "speed", "stamina", "checking",
                  "composure", "team_spirit"]
    for p in players:
        var low: float
        var high: float
        if p.age < 22:
            # Potentiaali ohjaa: korkea potentiaali -> isompi nousu
            var pot_factor := (p.hidden_potential - p.overall_rating()) / 20.0
            low = 0.0; high = 0.5 + maxf(0.0, pot_factor) * 2.0
        elif p.age <= 28:
            low = -0.2; high = 0.8
        elif p.age <= 32:
            low = -0.5; high = 0.2
        else:
            low = -1.0; high = -0.3
        for a in attrs:
            var delta := int(round(rng.randf_range(low, high)))
            p.set(a, clampi(p.get(a) + delta, 1, 20))
        p.age += 1
```
Huom: `apply_season_development` kasvattaa myös ikää. `check_injury` kutsutaan `SeasonManager`/`GameRunner`-tasolta per ottelu (Task 11 kytkee).

- [ ] **9.3 Aja → PASS. Commit**
```bash
git add src/systems/training_system.gd tests/gut/test_training_system.gd src/systems/*.uid
git commit -m "feat: TrainingSystem — weekly focus, injuries, age-based development"
```

---

## Task 10: EconomyEngine — kausibudjetti ja game over

**Tavoite:** Laske kausitulos (tulot − menot), päivitä kassavaranto, toteuta game over -ehto (spec §4.5).

**Files:**
- Modify: `src/models/team_data.gd` (lisää `consecutive_negative_seasons`)
- Create: `src/systems/economy_engine.gd`
- Create: `tests/gut/test_economy_engine.gd`

- [ ] **10.1 Lisää game over -laskuri TeamDataan**
```gdscript
@export var consecutive_negative_seasons: int = 0
```

- [ ] **10.2 Testit (epäonnistuvat)**
```gdscript
extends GutTest

var econ: EconomyEngine

func before_each():
    econ = EconomyEngine.new()

func _team(salary_each: int, capacity: int, fan: int, cash: int) -> TeamData:
    var t := TeamData.new()
    t.arena_capacity = capacity
    t.fan_support = fan
    t.cash_balance = cash
    for i in 25:
        var p := PlayerData.new(); p.annual_salary = salary_each
        t.players.append(p)
    return t

func test_settle_season_returns_breakdown():
    var t := _team(100000, 8000, 50, 500000)
    var breakdown := econ.settle_season(t, LeagueData.Tier.PREMIER, 5, TrainingSystem.Focus.TACTICS)
    assert_true(breakdown.has("income"))
    assert_true(breakdown.has("expenses"))
    assert_true(breakdown.has("result"))
    assert_eq(breakdown["result"], breakdown["income"] - breakdown["expenses"])

func test_cash_balance_updated():
    var t := _team(100000, 8000, 50, 500000)
    var before := t.cash_balance
    var b := econ.settle_season(t, LeagueData.Tier.PREMIER, 5, TrainingSystem.Focus.TACTICS)
    assert_eq(t.cash_balance, before + b["result"])

func test_game_over_after_two_negative_seasons():
    # Valtava palkkasumma -> taatusti negatiivinen.
    var t := _team(900000, 4000, 10, 100000)
    econ.settle_season(t, LeagueData.Tier.FIRST, 20, TrainingSystem.Focus.INTENSIVE)
    assert_eq(t.consecutive_negative_seasons, 1)
    assert_false(econ.is_game_over(t), "one negative season = warning only")
    econ.settle_season(t, LeagueData.Tier.FIRST, 20, TrainingSystem.Focus.INTENSIVE)
    assert_eq(t.consecutive_negative_seasons, 2)
    assert_true(econ.is_game_over(t), "two consecutive negative seasons = game over")

func test_positive_season_resets_counter():
    var t := _team(900000, 4000, 10, 100000)
    econ.settle_season(t, LeagueData.Tier.FIRST, 20, TrainingSystem.Focus.INTENSIVE)  # negatiivinen
    assert_eq(t.consecutive_negative_seasons, 1)
    var rich := _team(10000, 8000, 90, 5000000)
    econ.settle_season(rich, LeagueData.Tier.PREMIER, 1, TrainingSystem.Focus.REST)   # positiivinen
    assert_eq(rich.consecutive_negative_seasons, 0)
```

- [ ] **10.3 Toteuta EconomyEngine**

`src/systems/economy_engine.gd`:
```gdscript
class_name EconomyEngine

# Tuningvakioita — Sprint 5 kalibroi.
const TICKET_PRICE := { LeagueData.Tier.PREMIER: 25, LeagueData.Tier.FIRST: 15 }
const HOME_GAMES := 30                      # 60 pelin runkosarja, puolet kotona
const SPONSOR_BASE := { LeagueData.Tier.PREMIER: 1_500_000, LeagueData.Tier.FIRST: 600_000 }
const LEAGUE_SHARE := { LeagueData.Tier.PREMIER: 800_000, LeagueData.Tier.FIRST: 300_000 }
const ARENA_COST_PER_GAME := 20_000
const TRAINING_COST := {
    TrainingSystem.Focus.REST: 50_000, TrainingSystem.Focus.TACTICS: 100_000,
    TrainingSystem.Focus.TECHNIQUE: 120_000, TrainingSystem.Focus.PHYSICAL: 120_000,
    TrainingSystem.Focus.INTENSIVE: 250_000
}

func _fill_rate(fan_support: int) -> float:
    return clampf(0.40 + (fan_support / 100.0) * 0.60, 0.40, 1.0)

# league_position: 1 = paras (suurin sponsoribonus).
func settle_season(team: TeamData, tier: int, league_position: int, focus: int) -> Dictionary:
    var ticket_income := int(team.arena_capacity * _fill_rate(team.fan_support) \
        * TICKET_PRICE[tier] * HOME_GAMES)
    var position_bonus := int(maxf(0.0, (21 - league_position) / 20.0) * SPONSOR_BASE[tier] * 0.5)
    var sponsors := SPONSOR_BASE[tier] + position_bonus
    var income := ticket_income + sponsors + LEAGUE_SHARE[tier]

    var salaries := 0
    for p in team.players:
        salaries += p.annual_salary
    var arena := ARENA_COST_PER_GAME * HOME_GAMES
    var training := TRAINING_COST[focus]
    var expenses := salaries + arena + training

    var result := income - expenses
    team.cash_balance += result

    if team.cash_balance < 0:
        team.consecutive_negative_seasons += 1
    else:
        team.consecutive_negative_seasons = 0

    return {
        "income": income, "expenses": expenses, "result": result,
        "ticket_income": ticket_income, "sponsors": sponsors, "salaries": salaries
    }

func is_game_over(team: TeamData) -> bool:
    return team.consecutive_negative_seasons >= 2
```

- [ ] **10.4 Aja → PASS. Commit**
```bash
git add src/models/team_data.gd src/systems/economy_engine.gd tests/gut/test_economy_engine.gd
git commit -m "feat: EconomyEngine — season budget, cash balance, game-over condition"
```

---

## Task 11: SeasonManager — päivän edistys + runkosarjan simulointi

**Tavoite:** Aja runkosarja päivä kerrallaan: simuloi päivän ottelut kaikissa liigoissa, sovella tulokset, kytke loukkaantumiset, viikoittainen harjoittelu.

**Files:**
- Create: `src/systems/season_manager.gd`
- Modify: `src/autoload/game_state.gd` (delegoi `advance_day`)
- Create: `tests/gut/test_season_manager.gd`

- [ ] **11.1 Testit (epäonnistuvat)**
```gdscript
extends GutTest

var sm: SeasonManager

func before_each():
    sm = SeasonManager.new()

# Pieni maailma: 1 premier-liiga, 4 joukkuetta, lyhyt kalenteri.
func _mini_world() -> WorldData:
    var world := WorldData.new()
    var league := LeagueData.new()
    league.id = "test_premier"; league.tier = LeagueData.Tier.PREMIER
    for i in 4:
        var t := TeamData.new(); t.id = "t%d" % i; t.league_id = "test_premier"
        for j in 18:
            var p := PlayerData.new(); p.id = "t%d_p%d" % [i, j]; p.shooting = 10
            t.players.append(p)
        var g := GoalieData.new(); g.id = "t%d_g" % i; g.save_ability = 12
        t.players.append(g)
        league.teams.append(t)
    # Kalenteri: kierros jokaisena päivänä
    league.schedule.append(_game("t0", "t1", 1))
    league.schedule.append(_game("t2", "t3", 1))
    league.schedule.append(_game("t0", "t2", 2))
    league.schedule.append(_game("t1", "t3", 2))
    world.leagues.append(league)
    return world

func _game(h: String, a: String, day: int) -> ScheduledGame:
    var g := ScheduledGame.new(); g.home_team_id = h; g.away_team_id = a; g.day_of_season = day
    return g

func test_advance_day_plays_scheduled_games():
    var world := _mini_world()
    sm.advance_day(world)   # day 1 -> day 2; pelaa day 1:n ottelut
    var league := world.leagues[0]
    var played := 0
    for g in league.schedule:
        if g.is_played: played += 1
    assert_eq(played, 2, "two day-1 games played")

func test_standings_accumulate():
    var world := _mini_world()
    sm.advance_day(world)
    var total_wins := 0
    for t in world.leagues[0].teams:
        total_wins += t.wins
    assert_eq(total_wins, 2, "two games -> two winners")

func test_regular_season_complete_detection():
    var world := _mini_world()
    sm.advance_day(world)  # day 1
    assert_false(sm.is_regular_season_complete(world.leagues[0]))
    sm.advance_day(world)  # day 2
    assert_true(sm.is_regular_season_complete(world.leagues[0]))
```

- [ ] **11.2 Toteuta SeasonManager (runkosarja)**

`src/systems/season_manager.gd`:
```gdscript
class_name SeasonManager

var _runner := GameRunner.new()
var _training := TrainingSystem.new()
var _rng := RandomNumberGenerator.new()

func _team_by_id(world: WorldData, tid: String) -> TeamData:
    for league in world.leagues:
        for t in league.teams:
            if t.id == tid: return t
    return null

# Edistää yhden päivän: pelaa kaikki sen päivän ottelut, soveltaa tulokset.
func advance_day(world: WorldData) -> void:
    var today := world.day_of_season
    for league in world.leagues:
        for game in league.schedule:
            if game.day_of_season == today and not game.is_played:
                var home := _team_by_id(world, game.home_team_id)
                var away := _team_by_id(world, game.away_team_id)
                if home == null or away == null:
                    continue
                var seed := hash("%d-%s-%s" % [world.season, game.home_team_id, game.away_team_id])
                _runner.run_game(game, home, away, seed)
                _check_injuries(home)
                _check_injuries(away)
                EventBus.match_result.emit(game.home_team_id, game.away_team_id,
                    game.home_score, game.away_score)
    world.day_of_season += 1
    EventBus.game_day_advanced.emit(world.day_of_season)
    # Viikoittainen harjoittelu (oletusfokus; UI ohittaa Sprint 3:ssa)
    if today % 7 == 0:
        for league in world.leagues:
            for t in league.teams:
                _training.apply_weekly_training(t.players, TrainingSystem.Focus.TACTICS)

func _check_injuries(team: TeamData) -> void:
    for p in team.players:
        if not p.is_injured:
            _training.check_injury(p, _rng)

func is_regular_season_complete(league: LeagueData) -> bool:
    for g in league.schedule:
        if not g.is_played:
            return false
    return true
```

- [ ] **11.3 Delegoi GameStatesta**

`src/autoload/game_state.gd`:hen:
```gdscript
var _season_manager := SeasonManager.new()

func advance_day() -> void:
    if world:
        _season_manager.advance_day(world)
```

- [ ] **11.4 Aja → PASS. Commit**
```bash
git add src/systems/season_manager.gd src/autoload/game_state.gd tests/gut/test_season_manager.gd
git commit -m "feat: SeasonManager — day advance, regular season simulation, injuries"
```

---

## Task 12: Pudotuspelit — siemennys, best-of-5, 2-2-1

**Tavoite:** Runkosarjan jälkeen Premier-liigoissa: top-8 siemennys, best-of-5-sarjat (1v8…4v5), 2-2-1-kotietuformaatti. First Divisionissa: ei pudotuspelejä. Tuota mestari.

**Files:**
- Modify: `src/models/league_data.gd` (playoff-kentät + `champion_id`)
- Modify: `src/systems/season_manager.gd` (playoff-logiikka)
- Modify: `tests/gut/test_season_manager.gd`

- [ ] **12.1 Lisää playoff-kentät LeagueDataan**
```gdscript
@export var champion_id: String = ""
@export var playoff_complete: bool = false
```

- [ ] **12.2 Testit (epäonnistuvat)**
```gdscript
func test_seeding_orders_by_points():
    var league := _completed_league()  # apufunktio: 8+ joukkuetta eri pisteillä
    var seeds := sm.compute_playoff_seeds(league)
    assert_eq(seeds.size(), 8, "top 8 seeded")
    for i in range(seeds.size() - 1):
        assert_gte(seeds[i].points(), seeds[i + 1].points(), "seeds in descending points")

func test_run_playoffs_produces_champion():
    var world := _mini_playoff_world()  # 8 joukkuetta, runkosarja pelattu
    var league := world.leagues[0]
    sm.run_playoffs(world, league)
    assert_true(league.playoff_complete)
    assert_ne(league.champion_id, "", "a champion is crowned")
    # Mestari on yksi top-8:sta
    var seed_ids := []
    for t in sm.compute_playoff_seeds(league): seed_ids.append(t.id)
    assert_true(league.champion_id in seed_ids)

func test_best_of_5_series_winner_needs_3():
    # Sarja päättyy kun toinen saa 3 voittoa.
    var high := _team_with_strength("strong", 18, 18)
    var low := _team_with_strength("weak", 4, 4)
    var winner := sm.play_series(high, low, 1, 100)  # seed-base 100
    assert_eq(winner.id, "strong", "much stronger team wins best-of-5")

func test_first_division_has_no_playoffs():
    var world := _mini_world()
    world.leagues[0].tier = LeagueData.Tier.FIRST
    sm.run_playoffs(world, world.leagues[0])
    assert_false(world.leagues[0].playoff_complete, "First Division: no playoffs")
    assert_eq(world.leagues[0].champion_id, "")
```

- [ ] **12.3 Toteuta playoff-logiikka**

`season_manager.gd`:hen. Siemennys tasapistesäännöillä (spec §2: maaliero → voitot → keskinäiset; keskinäiset jätetään MVP-yksinkertaistuksena pois tai TODO):
```gdscript
# Lajittele top-8 (spec: pisteet → maaliero → voitot).
func compute_playoff_seeds(league: LeagueData) -> Array:
    var teams := league.teams.duplicate()
    teams.sort_custom(func(a, b):
        if a.points() != b.points(): return a.points() > b.points()
        if a.goal_diff() != b.goal_diff(): return a.goal_diff() > b.goal_diff()
        return a.wins > b.wins
    )
    return teams.slice(0, 8)

# Best-of-5, 2-2-1: korkeampi siemen (home_team) pelaa kotona pelit 1,2,5.
func play_series(higher_seed: TeamData, lower_seed: TeamData, season: int, seed_base: int) -> TeamData:
    var home_pattern := [true, true, false, false, true]  # higher seed kotona?
    var higher_wins := 0
    var lower_wins := 0
    for game_idx in 5:
        if higher_wins == 3 or lower_wins == 3:
            break
        var higher_home: bool = home_pattern[game_idx]
        var home := higher_seed if higher_home else lower_seed
        var away := lower_seed if higher_home else higher_seed
        var g := ScheduledGame.new()
        g.home_team_id = home.id; g.away_team_id = away.id
        var seed := seed_base + game_idx
        _runner.run_game(g, home, away, seed)
        var home_won: bool = g.home_score > g.away_score
        var higher_won: bool = (home_won and higher_home) or (not home_won and not higher_home)
        if higher_won: higher_wins += 1
        else: lower_wins += 1
    return higher_seed if higher_wins > lower_wins else lower_seed

# Aja koko bracket: 1v8,2v7,3v6,4v5 -> semifinaalit -> finaali.
func run_playoffs(world: WorldData, league: LeagueData) -> void:
    if league.tier != LeagueData.Tier.PREMIER:
        return
    var seeds := compute_playoff_seeds(league)
    if seeds.size() < 8:
        return
    var round_teams := seeds
    var seed_base := hash("%d-%s-po" % [world.season, league.id]) & 0x7fffffff
    while round_teams.size() > 1:
        var next_round := []
        var n := round_teams.size()
        for i in n / 2:
            var higher := round_teams[i]
            var lower := round_teams[n - 1 - i]
            var winner := play_series(higher, lower, world.season, seed_base)
            seed_base += 10
            next_round.append(winner)
        round_teams = next_round
    league.champion_id = round_teams[0].id
    league.playoff_complete = true
    EventBus.season_ended.emit(league.champion_id)
```
Huom: maalivahdin `played_ids`/fatigue pudotuspeleissä — `run_game` hoitaa saman kuin runkosarjassa.

- [ ] **12.4 Aja → PASS. Commit**
```bash
git add src/models/league_data.gd src/systems/season_manager.gd tests/gut/test_season_manager.gd
git commit -m "feat: playoffs — top-8 seeding, best-of-5, 2-2-1 home format, champion"
```

---

## Task 13: Kausivaihto — talous, kehitys, fatigue-nollaus, uusi kalenteri

**Tavoite:** Kauden lopussa: settle economy + game-over-tarkistus, kausikehitys, fatigue-nollaus, tilastojen nollaus, uusi kalenteri, kausinumero +1. (Nousu/putoaminen: ks. liputettu oletus — vahvista ensin.)

**Files:**
- Modify: `src/systems/season_manager.gd` (`end_season`, `start_new_season`)
- Modify: `tests/gut/test_season_manager.gd`

- [ ] **13.1 Testit (epäonnistuvat)**
```gdscript
func test_end_season_settles_economy_and_resets_stats():
    var world := _mini_playoff_world()
    var league := world.leagues[0]
    # Simuloi runkosarja + pudotuspelit ensin
    for t in league.teams:
        t.wins = 10; t.goals_for = 30; t.goals_against = 20
        for p in t.players: p.season_goals = 5; p.fatigue = 60
    sm.end_season(world)
    for t in league.teams:
        assert_eq(t.wins, 0, "standings reset for new season")
        for p in t.players:
            assert_eq(p.season_goals, 0, "player stats reset")
            assert_eq(p.fatigue, 0, "fatigue fully reset at season end")

func test_end_season_increments_season_number():
    var world := _mini_playoff_world()
    var before: int = world.season
    sm.end_season(world)
    assert_eq(world.season, before + 1)

func test_end_season_generates_new_schedule():
    var world := _mini_playoff_world()
    sm.end_season(world)
    for league in world.leagues:
        if league.tier == LeagueData.Tier.PREMIER:
            assert_gt(league.schedule.size(), 0, "new schedule generated")
            for g in league.schedule:
                assert_false(g.is_played, "new schedule games unplayed")
```

- [ ] **13.2 Toteuta kausivaihto**

`season_manager.gd`:hen:
```gdscript
var _economy := EconomyEngine.new()

# Kutsutaan kun kaikki liigat valmiita (runkosarja + mahdolliset pudotuspelit).
func end_season(world: WorldData) -> void:
    for league in world.leagues:
        var standings := compute_playoff_seeds_full(league)  # koko liiga järjestyksessä
        for i in standings.size():
            var team: TeamData = standings[i]
            _economy.settle_season(team, league.tier, i + 1, TrainingSystem.Focus.TACTICS)
            if team.is_player_controlled and _economy.is_game_over(team):
                EventBus.season_ended.emit("GAME_OVER:" + team.id)
        # Kehitys + nollaukset
        for team in league.teams:
            _economy_reset_team_season(team)

    world.season += 1
    world.day_of_season = 1
    _regenerate_schedules(world)

func _economy_reset_team_season(team: TeamData) -> void:
    _training.apply_season_development(team.players, _rng)  # ikäkehitys (kasvattaa myös ikää)
    for p in team.players:
        p.fatigue = 0
        p.games_played = 0
        p.season_goals = 0
        p.season_assists = 0
        p.season_shots = 0
        if p is GoalieData:
            p.season_saves = 0
            p.season_shots_against = 0
            p.season_goals_against = 0
            p.season_shutouts = 0
    team.wins = 0; team.losses = 0; team.overtime_losses = 0
    team.goals_for = 0; team.goals_against = 0

func compute_playoff_seeds_full(league: LeagueData) -> Array:
    var teams := league.teams.duplicate()
    teams.sort_custom(func(a, b):
        if a.points() != b.points(): return a.points() > b.points()
        if a.goal_diff() != b.goal_diff(): return a.goal_diff() > b.goal_diff()
        return a.wins > b.wins
    )
    return teams

func _regenerate_schedules(world: WorldData) -> void:
    for league in world.leagues:
        league.champion_id = ""
        league.playoff_complete = false
        if league.tier == LeagueData.Tier.PREMIER:
            league.schedule = ScheduleGenerator.generate(league.teams, 60)
        else:
            league.schedule = []
```
**HUOM (liputettu):** nousu/putoaminen ei ole tässä. Jos vahvistat alueparillisen promotion/relegationin, lisää `_apply_promotion_relegation(world)` ennen `_regenerate_schedules`-kutsua: siirrä First top-2 ↔ Premier bottom-2 samalla alueella (`region`).

- [ ] **13.3 Aja → PASS. Commit**
```bash
git add src/systems/season_manager.gd tests/gut/test_season_manager.gd
git commit -m "feat: season rollover — economy settle, development, resets, new schedule"
```

---

## Task 14: Integraatio — koko kausi end-to-end

**Tavoite:** Todista Sprint 2:n valmistumiskriteeri: simuloi koko kausi `WorldFactory`:n tuottamasta maailmasta loppuun ja varmista eheys.

**Files:**
- Create: `tests/gut/test_full_season_integration.gd`
- Modify: `src/systems/season_manager.gd` (lisää `simulate_to_end` apuri jos tarpeen)

- [ ] **14.1 Lisää koko kauden apuri**

`season_manager.gd`:hen:
```gdscript
# Ajaa runkosarjan loppuun, sitten pudotuspelit kaikissa premier-liigoissa, sitten kausivaihdon.
func simulate_full_season(world: WorldData) -> void:
    var guard := 0
    while not _all_regular_seasons_complete(world) and guard < 10000:
        advance_day(world)
        guard += 1
    for league in world.leagues:
        if league.tier == LeagueData.Tier.PREMIER:
            run_playoffs(world, league)
    end_season(world)

func _all_regular_seasons_complete(world: WorldData) -> bool:
    for league in world.leagues:
        if league.tier == LeagueData.Tier.PREMIER and not is_regular_season_complete(league):
            return false
    return true
```
Huom: First Divisionin kalenteri — varmista että `WorldFactory` luo kalenterin myös First-liigoille TAI että `_all_regular_seasons_complete` huomioi vain pelattavat liigat. (Sprint 1 `WorldFactory` loi kalenterin vain Premier-liigoille. First Division ilman kalenteria on ok — niillä ei pelata otteluita Sprint 2:ssa, vain talous/kehitys kausivaihdossa.)

- [ ] **14.2 Integraatiotesti (epäonnistuu)**
```gdscript
extends GutTest

var sm: SeasonManager

func before_all():
    sm = SeasonManager.new()

func test_full_season_completes_and_crowns_champions():
    var world := WorldFactory.new().create_new_world()
    var start_season: int = world.season
    sm.simulate_full_season(world)

    # Jokainen premier-liiga sai mestarin
    var premier_count := 0
    for league in world.leagues:
        if league.tier == LeagueData.Tier.PREMIER:
            premier_count += 1
            # end_season nollasi champion_idn uudelle kaudelle -> tarkista season++ tapahtui
    assert_gt(premier_count, 0, "expected premier leagues")
    assert_eq(world.season, start_season + 1, "season advanced after full simulation")

func test_full_season_stats_are_consistent():
    var world := WorldFactory.new().create_new_world()
    # Aja vain runkosarja (ei kausivaihtoa joka nollaa) tarkistusta varten
    var guard := 0
    while not sm._all_regular_seasons_complete(world) and guard < 10000:
        sm.advance_day(world); guard += 1
    for league in world.leagues:
        if league.tier != LeagueData.Tier.PREMIER:
            continue
        for team in league.teams:
            # games_played johdonmukainen W+L+OTL kanssa
            var games := team.wins + team.losses + team.overtime_losses
            assert_gt(games, 0, "%s played games" % team.id)
            # joukkueen maalit = pelaajien season_goals summa (sama joukkue)
            var player_goals := 0
            for p in team.players:
                if not (p is GoalieData):
                    player_goals += p.season_goals
            assert_eq(player_goals, team.goals_for,
                "%s: player goals (%d) == team goals_for (%d)" % [team.id, player_goals, team.goals_for])

func test_full_season_under_time_budget():
    var world := WorldFactory.new().create_new_world()
    var start := Time.get_ticks_msec()
    sm.simulate_full_season(world)
    var elapsed := Time.get_ticks_msec() - start
    # 3 premier-liigaa × 600 ottelua + pudotuspelit. C#-simu -> tavoite reilusti alle 30s.
    assert_lt(elapsed, 30000, "full season simulates in under 30s (was %d ms)" % elapsed)
```

- [ ] **14.3 Aja → PASS.**
Jos `test_full_season_stats_are_consistent` failaa (pelaajamaalit ≠ joukkueen maalit), tarkista `apply_result_to_team`: vain SAMAN joukkueen pelaajat saavat tilastot. `player_stats`-Dictionary sisältää BOTH joukkueiden pelaajat → adapterin pitää lisätä vain omien pelaajien tilastot (mätsää `p.id`).

- [ ] **14.4 Commit**
```bash
git add tests/gut/test_full_season_integration.gd src/systems/season_manager.gd
git commit -m "test: full-season integration — completion, stat consistency, time budget"
```

---

## Lopputarkistus (kaikkien taskien jälkeen)

- [ ] **Aja koko testisarja:**
  ```bash
  dotnet build ColdGM.sln -c Debug
  "<godot_mono>" --headless --path . --import
  "<godot_mono>" --headless --path . --import
  "<godot_mono>" --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -glog=1 -gexit
  ```
  Odotettu: kaikki vihreänä, exit code 0.
- [ ] **Dispatch final code-reviewer** koko Sprint 2 -toteutukselle (superpowers:requesting-code-review).
- [ ] **Päivitä muisti** `project_cold_gm.md`: Sprint 2 valmis, Sprint 3 edessä.
- [ ] **Käytä superpowers:finishing-a-development-branch** integroidaksesi työn.

## Sprint 2 → Sprint 3 kädenojennus

Sprint 3 (2D-ottelunäkymä + taktiikat) rakentaa tämän päälle:
- `events`-lista (jo tuotettu) → 2D-visualisointi Godot Tweenillä.
- Taktiikkavalinnat → `MatchAdapter.build_team_input` lisää taktiikkaparametrit inputiin; `MatchSimulator` lukee ne (linjajako, painotus).
- "Pikasimuloi" → `GameRunner.run_game` ilman 2D-renderöintiä (jo olemassa).
- Siirrot/sopimukset (§4.4) → siirtoikkunan koukku `SeasonManager`:ssa.
