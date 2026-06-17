# Cold GM — Sprint 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rakenna Cold GM:n datainfrakstuuri — generoi 3 000 fiktiivistä pelaajaa, 6 liigaa, 120 joukkuetta ja 60 pelin runkosarjakalenteri, sekä toimiva tallennus/lataus. Kaikki koodi on GDScriptiä Sprint 1:ssä — C# tulee Sprint 2:ssa MatchSimulatoria varten.

**Architecture:** Kaikki dataluokat ovat GDScript `Resource`-aliluokkia (`extends Resource`). Resource on Godt 4:n natiivi datakontaineri: GDScriptillä instantioitavissa `.new()`-kutsulla, helppo serializoida JSON:iin ja tallentaa. GUT-addon testaa kaiken GDScriptissä. Ei NUnit-projektiä Sprint 1:ssä — se tulee Sprint 2:ssa C#-simulaattorin mukana.

**Tech Stack:** Godot 4.3+, GDScript, GUT addon v9.x, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-17-cold-gm-hockey-manager-design.md`

---

## Scope

Tämä on Sprint 1 viidestä sprintistä.

| Sprint | Dokumentti | Status |
|---|---|---|
| 1 — Foundation (tämä) | `2026-06-17-cold-gm-sprint1-foundation.md` | Kirjoitettu |
| 2 — Match Sim + Economy | Kirjoitetaan Sprint 2 alkaessa | — |
| 3 — 2D Match View + Tactics UI | Kirjoitetaan Sprint 3 alkaessa | — |
| 4 — Modding + Steam | Kirjoitetaan Sprint 4 alkaessa | — |
| 5 — Balancing + EA Launch | Kirjoitetaan Sprint 5 alkaessa | — |

**Sprint 1 valmistumiskriteeri:** Koko pelimaailma (6 liigaa, 120 joukkuetta, ~3 000 pelaajaa, 60 pelin kalenteri) generoituu alle 2 sekunnissa, tallennetaan tiedostoon, ladataan takaisin ja data täsmää. Kaikki GUT-testit vihreänä. CI vihreänä.

---

## Tiedostorakenne

```
cold_gm/                          # Godot 4 -projekti (uusi hakemisto projektin ulkopuolella)
├── project.godot
├── addons/
│   └── gut/                      # GUT-testiaddon v9.x
├── src/
│   ├── models/                   # GDScript Resource -dataluokat
│   │   ├── player_data.gd        # PlayerData extends Resource (12 attribuuttia)
│   │   ├── goalie_data.gd        # GoalieData extends PlayerData (+4 MV-attribuuttia)
│   │   ├── team_data.gd          # TeamData extends Resource (roster, talous, fanituki)
│   │   ├── league_data.gd        # LeagueData extends Resource (joukkueet, kalenteri)
│   │   ├── scheduled_game.gd     # ScheduledGame extends Resource (ottelu: home/away/päivä)
│   │   └── world_data.gd         # WorldData extends Resource (kaikki liigat, kausi, päivä)
│   ├── data/                     # GDScript — tiedostojen luku/kirjoitus, generaattorit
│   │   ├── league_loader.gd      # LeagueLoader: lukee mods/base/leagues/*.json
│   │   ├── player_generator.gd   # PlayerGenerator: generoi fiktiiviset pelaajat
│   │   ├── schedule_generator.gd # ScheduleGenerator: 60 pelin round-robin-kalenteri
│   │   ├── world_factory.gd      # WorldFactory: kokoaa kaiken yhteen
│   │   └── save_manager.gd       # SaveManager: tallentaa/lataa gzip JSON
│   └── autoload/                 # Godot autoloads (singletonit)
│       ├── game_state.gd         # GameState: koko pelimaailman tila
│       └── event_bus.gd          # EventBus: globaalit signaalit
├── tests/
│   └── gut/
│       ├── test_player_data.gd
│       ├── test_player_generator.gd
│       ├── test_schedule_generator.gd
│       ├── test_league_loader.gd
│       ├── test_world_factory.gd
│       └── test_save_manager.gd
├── mods/
│   └── base/
│       ├── leagues/
│       │   ├── north_premier.json    # 20 joukkuetta
│       │   ├── north_first.json
│       │   ├── central_premier.json
│       │   ├── central_first.json
│       │   ├── south_premier.json
│       │   └── south_first.json
│       ├── names/
│       │   ├── first_names.txt       # ~200 etunimiä
│       │   └── last_names.txt        # ~500 sukunimeä
│       └── logos/                    # Placeholder PNG:t (tyhjät värikuvakkeet)
└── .github/
    └── workflows/
        └── ci.yml                    # GUT headless test runner
```

**Rajapintasäännöt:**
- `src/models/*.gd` — vain dataa, ei logiikkaa, ei `Node`-riippuvuuksia
- `src/data/*.gd` — logiikka ja tiedostokäsittely, käyttää modeleita
- `src/autoload/*.gd` — globaali tila, kaikki UI-näkymät hakevat datan täältä
- C# tulee Sprint 2:ssa: `MatchSimulator.cs` kommunikoi GDScriptin kanssa Dictionary/Array-tyypeillä

---

## Task 1: Godot-projekti ja testausympäristö

**Files:**
- Create: `cold_gm/project.godot` (Godot luo)
- Create: `cold_gm/addons/gut/` (kopioidaan)
- Create: `.github/workflows/ci.yml`
- Create: `cold_gm/.gitignore`

- [ ] **1.1 Luo Godot 4 -projekti**

Avaa Godot 4.3+. Project Manager → New Project → hakemisto `C:\Users\rauti\cold_gm\` (ERILLINEN hakemisto, EI buukkikisa-projektin sisälle). Renderer: **Compatibility** (nopein 2D:lle). Create & Edit.

- [ ] **1.2 Asenna GUT-addon**

Lataa GUT v9.x release: https://github.com/bitwes/Gut/releases (etsi `gut_v9.x.x.zip`). Pura ja kopioi `addons/gut/`-kansio projektin `addons/gut/`-kansioon.

Godotissa: `Project → Project Settings → Plugins → GUT → Enable`.

Tarkista: `addons/gut/gut_cmdln.gd` tiedoston olemassaolo.

- [ ] **1.3 Luo hakemistorakenne**

PowerShellissä (cold_gm-hakemistossa):

```powershell
New-Item -ItemType Directory -Force -Path src/models, src/data, src/autoload, tests/gut, mods/base/leagues, mods/base/names, mods/base/logos, .github/workflows
```

- [ ] **1.4 Luo .gitignore**

Luo `cold_gm/.gitignore`:

```
.godot/
*.import
*.mono/
.vs/
.vscode/
```

- [ ] **1.5 Luo GitHub Actions CI**

Luo `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  gut-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Download Godot 4.3
        run: |
          wget -q https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
          unzip -q Godot_v4.3-stable_linux.x86_64.zip
          chmod +x Godot_v4.3-stable_linux.x86_64
      - name: Import project
        run: ./Godot_v4.3-stable_linux.x86_64 --headless --path . --import --quit || true
      - name: Run GUT tests
        run: |
          ./Godot_v4.3-stable_linux.x86_64 --headless --path . \
            -s addons/gut/gut_cmdln.gd \
            -gdir=res://tests/gut \
            -gprefix=test_ \
            -gsuffix=.gd \
            -glog=1 \
            -gexit
```

- [ ] **1.6 Init git ja ensimmäinen commit**

```powershell
git init
git add .
git commit -m "chore: init Godot 4 project, GUT addon, CI"
```

---

## Task 2: Datamallit — PlayerData, GoalieData

**Files:**
- Create: `src/models/player_data.gd`
- Create: `src/models/goalie_data.gd`
- Create: `tests/gut/test_player_data.gd`

- [ ] **2.1 Kirjoita epäonnistuva GUT-testi**

Luo `tests/gut/test_player_data.gd`:

```gdscript
extends GutTest

func test_player_data_has_12_field_attributes():
    var p := PlayerData.new()
    var attr_names := [
        "skating", "shooting", "passing", "puck_handling",
        "positioning", "defensive_play", "power_play",
        "speed", "stamina", "checking",
        "composure", "team_spirit"
    ]
    for attr in attr_names:
        assert_true(attr in p, "PlayerData missing attribute: " + attr)

func test_player_data_defaults_in_range():
    var p := PlayerData.new()
    assert_between(p.skating, 1, 20)
    assert_between(p.shooting, 1, 20)
    assert_eq(p.position, PlayerData.Position.FORWARD)

func test_player_full_name():
    var p := PlayerData.new()
    p.first_name = "Mikko"
    p.last_name = "Korhonen"
    assert_eq(p.full_name(), "Mikko Korhonen")

func test_goalie_data_has_goalie_attributes():
    var g := GoalieData.new()
    assert_true("save_ability" in g)
    assert_true("reflexes" in g)
    assert_true("goalie_positioning" in g)
    assert_true("mental_strength" in g)
    assert_eq(g.position, PlayerData.Position.GOALIE)
```

- [ ] **2.2 Aja GUT paikallistesti — varmista epäonnistuminen**

```powershell
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -gexit
```

Odotettu: virhe "PlayerData not found" tai "Cannot instantiate".

- [ ] **2.3 Kirjoita PlayerData**

Luo `src/models/player_data.gd`:

```gdscript
class_name PlayerData
extends Resource

enum Position { FORWARD, DEFENSE, GOALIE }

@export var id: String = ""
@export var first_name: String = ""
@export var last_name: String = ""
@export var age: int = 20
@export var nationality: String = ""
@export var position: Position = Position.FORWARD

# Technical
@export var skating: int = 10
@export var shooting: int = 10
@export var passing: int = 10
@export var puck_handling: int = 10

# Tactical
@export var positioning: int = 10
@export var defensive_play: int = 10
@export var power_play: int = 10

# Physical
@export var speed: int = 10
@export var stamina: int = 10
@export var checking: int = 10

# Mental
@export var composure: int = 10
@export var team_spirit: int = 10

# Hidden / meta
@export var hidden_potential: int = 15  # 1-20, ei näytetä suoraan
@export var contract_years_left: int = 1
@export var annual_salary: int = 50000
@export var fatigue: int = 0  # 0-100
@export var is_injured: bool = false
@export var injury_weeks_remaining: int = 0

func full_name() -> String:
    return first_name + " " + last_name

func average_technical() -> float:
    return (skating + shooting + passing + puck_handling) / 4.0
```

Luo `src/models/goalie_data.gd`:

```gdscript
class_name GoalieData
extends PlayerData

@export var save_ability: int = 10
@export var reflexes: int = 10
@export var goalie_positioning: int = 10
@export var mental_strength: int = 10

func _init() -> void:
    position = Position.GOALIE
```

- [ ] **2.4 Aja testit — varmista vihreä**

```powershell
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -gexit
```

Odotettu: `4 passed, 0 failed`

- [ ] **2.5 Commit**

```powershell
git add src/models/player_data.gd src/models/goalie_data.gd tests/gut/test_player_data.gd
git commit -m "feat: PlayerData and GoalieData GDScript Resource models"
```

---

## Task 3: TeamData, LeagueData, ScheduledGame, WorldData

**Files:**
- Create: `src/models/team_data.gd`
- Create: `src/models/league_data.gd`
- Create: `src/models/scheduled_game.gd`
- Create: `src/models/world_data.gd`
- Modify: `tests/gut/test_player_data.gd` (lisää testit)

- [ ] **3.1 Kirjoita testit**

Lisää `tests/gut/test_player_data.gd`:aan uudet testifunktiot (tai luo uusi `tests/gut/test_models.gd`):

```gdscript
# Lisää test_player_data.gd -tiedostoon tai uuteen tiedostoon

func test_team_data_defaults():
    var t := TeamData.new()
    assert_eq(t.players.size(), 0)
    assert_eq(t.fan_support, 50)
    assert_true(t.cash_balance > 0)

func test_team_points_calculation():
    var t := TeamData.new()
    t.wins = 10
    t.overtime_losses = 3
    assert_eq(t.points(), 23)  # 10*2 + 3

func test_league_data_defaults():
    var l := LeagueData.new()
    assert_eq(l.teams.size(), 0)
    assert_eq(l.schedule.size(), 0)

func test_world_data_get_player_team():
    var w := WorldData.new()
    var team := TeamData.new()
    team.id = "test_team_123"
    var league := LeagueData.new()
    league.teams.append(team)
    w.leagues.append(league)
    w.player_team_id = "test_team_123"
    var found := w.get_player_team()
    assert_not_null(found)
    assert_eq(found.id, "test_team_123")
```

- [ ] **3.2 Aja testit — varmista epäonnistuminen**

- [ ] **3.3 Kirjoita mallit**

Luo `src/models/scheduled_game.gd`:

```gdscript
class_name ScheduledGame
extends Resource

@export var home_team_id: String = ""
@export var away_team_id: String = ""
@export var day_of_season: int = 0
@export var is_played: bool = false
@export var home_score: int = 0
@export var away_score: int = 0
```

Luo `src/models/team_data.gd`:

```gdscript
class_name TeamData
extends Resource

@export var id: String = ""
@export var name: String = ""
@export var city: String = ""
@export var logo_path: String = ""
@export var primary_color: String = "#1a3a6b"
@export var secondary_color: String = "#ffffff"
@export var arena_capacity: int = 8000
@export var league_id: String = ""

@export var players: Array[PlayerData] = []

# Economy
@export var cash_balance: int = 500_000
@export var annual_budget: int = 2_000_000
@export var fan_support: int = 50  # 0-100

# Season stats (nollataan kauden alussa)
@export var wins: int = 0
@export var losses: int = 0
@export var overtime_losses: int = 0
@export var goals_for: int = 0
@export var goals_against: int = 0

@export var is_player_controlled: bool = false

func points() -> int:
    return wins * 2 + overtime_losses

func goal_diff() -> int:
    return goals_for - goals_against
```

Luo `src/models/league_data.gd`:

```gdscript
class_name LeagueData
extends Resource

enum Tier { PREMIER, FIRST }
enum Region { NORTH, CENTRAL, SOUTH }

@export var id: String = ""
@export var name: String = ""
@export var tier: Tier = Tier.PREMIER
@export var region: Region = Region.NORTH
@export var teams: Array[TeamData] = []
@export var schedule: Array[ScheduledGame] = []
```

Luo `src/models/world_data.gd`:

```gdscript
class_name WorldData
extends Resource

@export var season: int = 1
@export var day_of_season: int = 1
@export var player_team_id: String = ""
@export var player_team_league_id: String = ""
@export var leagues: Array[LeagueData] = []

func get_player_team() -> TeamData:
    for league in leagues:
        for team in league.teams:
            if team.id == player_team_id:
                return team
    return null

func get_league_by_id(lid: String) -> LeagueData:
    for league in leagues:
        if league.id == lid:
            return league
    return null
```

- [ ] **3.4 Aja testit — varmista vihreä**

- [ ] **3.5 Commit**

```powershell
git add src/models/
git commit -m "feat: TeamData, LeagueData, ScheduledGame, WorldData GDScript models"
```

---

## Task 4: ScheduleGenerator — 60 pelin round-robin

**Files:**
- Create: `src/data/schedule_generator.gd`
- Create: `tests/gut/test_schedule_generator.gd`

**Algoritmi:** 20 joukkueen täydessä round-robinissa jokainen joukkue pelaa 19 ottelua. Tavoite on 60 peliä per joukkue. Tähän tarvitaan 3 täyttä round-robinia (57 peliä) + 3 lisäpeliä per joukkue (ensimmäiset 3 kierrosta neljännestä round-robinista). Yhteensä: 20 × 60 / 2 = 600 ottelua.

- [ ] **4.1 Kirjoita testit**

Luo `tests/gut/test_schedule_generator.gd`:

```gdscript
extends GutTest

var teams: Array = []

func before_each():
    teams = []
    for i in range(20):
        var t := TeamData.new()
        t.id = "team_%d" % i
        t.name = "Team %d" % i
        teams.append(t)

func test_generates_600_total_games():
    var schedule := ScheduleGenerator.generate(teams, 60)
    assert_eq(schedule.size(), 600)

func test_each_team_plays_exactly_60_games():
    var schedule := ScheduleGenerator.generate(teams, 60)
    for team in teams:
        var count := 0
        for game in schedule:
            if game.home_team_id == team.id or game.away_team_id == team.id:
                count += 1
        assert_eq(count, 60, "%s should have 60 games" % team.name)

func test_no_team_plays_itself():
    var schedule := ScheduleGenerator.generate(teams, 60)
    for game in schedule:
        assert_ne(game.home_team_id, game.away_team_id)

func test_games_spread_across_multiple_days():
    var schedule := ScheduleGenerator.generate(teams, 60)
    var days := {}
    for game in schedule:
        days[game.day_of_season] = true
    assert_gt(days.size(), 50, "Games should be spread across many days")

func test_all_games_have_valid_team_ids():
    var team_ids := teams.map(func(t): return t.id)
    var schedule := ScheduleGenerator.generate(teams, 60)
    for game in schedule:
        assert_true(game.home_team_id in team_ids)
        assert_true(game.away_team_id in team_ids)
```

- [ ] **4.2 Aja testit — varmista epäonnistuminen**

- [ ] **4.3 Kirjoita ScheduleGenerator**

Luo `src/data/schedule_generator.gd`:

```gdscript
class_name ScheduleGenerator

# Generoi 60 pelin round-robin-kalenteri 20 joukkueelle.
# Algoritmi: 3 täyttä round-robinia (57 peliä/joukkue) + 3 lisäkierrosta (3 peliä/joukkue)
# Yhteensä: 600 ottelua, 60 per joukkue.
static func generate(teams: Array, games_per_team: int = 60) -> Array[ScheduledGame]:
    var all_pairings: Array = []
    var n := teams.size()

    # Täydet round-robin -kierrokset
    var full_rounds := games_per_team / (n - 1)  # 60 / 19 = 3
    for r in range(full_rounds):
        var rr := _round_robin(teams, r % 2 == 1)  # parillisella kierroksella koti/vieras vaihdetaan
        all_pairings.append_array(rr)

    # Lisäkierrokset (60 % 19 = 3 lisäpeliä per joukkue → 30 lisäottelua)
    var extra_games_per_team := games_per_team % (n - 1)  # 3
    if extra_games_per_team > 0:
        var extra_rr := _round_robin(teams, false)
        # Ota ensimmäiset 'extra_games_per_team' täysiä kierroksia
        # Yksi round-robin -kierros = n/2 = 10 peliä
        var extra_total := extra_games_per_team * n / 2  # 3 * 20 / 2 = 30
        for i in range(mini(extra_total, extra_rr.size())):
            all_pairings.append(extra_rr[i])

    # Sekoita deterministisesti (siemen 42 → toistettavat tulokset)
    var rng := RandomNumberGenerator.new()
    rng.seed = 42
    for i in range(all_pairings.size() - 1, 0, -1):
        var j := rng.randi_range(0, i)
        var tmp = all_pairings[i]
        all_pairings[i] = all_pairings[j]
        all_pairings[j] = tmp

    # Jaa pelipäiville
    # Kausi: 210 päivää (30 viikkoa × 7), pelit ti/to/la (päivät %7 = 2, 4, 6)
    var game_days: Array[int] = []
    for week in range(30):
        game_days.append(week * 7 + 2)
        game_days.append(week * 7 + 4)
        game_days.append(week * 7 + 6)
    # 90 pelipäivää × ~6-7 peliä/päivä ≈ 600 peliä

    var games_per_day := n / 2  # 10 peliä/päivä (10 jäähallissa samanaikaisesti)
    var result: Array[ScheduledGame] = []

    for i in range(all_pairings.size()):
        var pair = all_pairings[i]
        var day_index := i / games_per_day
        var day := game_days[mini(day_index, game_days.size() - 1)]

        var game := ScheduledGame.new()
        game.home_team_id = pair[0]
        game.away_team_id = pair[1]
        game.day_of_season = day
        result.append(game)

    return result

# Luo yhden round-robin -kierroksen kaikki pariniitä (n*(n-1)/2 paria)
# Jos swap_home_away on true, kotietu vaihdetaan (=vastakierros)
static func _round_robin(teams: Array, swap_home_away: bool) -> Array:
    var pairings := []
    var n := teams.size()
    var ids := teams.map(func(t): return t.id)

    for round in range(n - 1):
        for i in range(n / 2):
            var home := ids[i]
            var away := ids[n - 1 - i]
            if swap_home_away:
                pairings.append([away, home])
            else:
                pairings.append([home, away])
        # Rotoi paitsi ensimmäinen elementti
        var last := ids[n - 1]
        for i in range(n - 1, 1, -1):
            ids[i] = ids[i - 1]
        ids[1] = last

    return pairings
```

- [ ] **4.4 Aja testit — varmista vihreä**

```powershell
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -gexit
```

- [ ] **4.5 Commit**

```powershell
git add src/data/schedule_generator.gd tests/gut/test_schedule_generator.gd
git commit -m "feat: ScheduleGenerator, 60-game round-robin for 20 teams, 600 total games"
```

---

## Task 5: Nimidatat ja PlayerGenerator

**Files:**
- Create: `mods/base/names/first_names.txt`
- Create: `mods/base/names/last_names.txt`
- Create: `src/data/player_generator.gd`
- Create: `tests/gut/test_player_generator.gd`

- [ ] **5.1 Luo nimidata**

Luo `mods/base/names/first_names.txt` (200 nimeä, 1 per rivi, kansainvälinen sekoitus):

```
Mikko
Jari
Pekka
Sami
Timo
Antti
Juha
Matti
Ville
Petri
Erik
Lars
Johan
Bjorn
Henrik
Niklas
Anders
Gustav
Oskar
Filip
Connor
Ryan
Tyler
Jake
Dylan
Brendan
Cody
Nathan
Logan
Ethan
Alexei
Dmitri
Pavel
Sergei
Andrei
Nikolai
Viktor
Ivan
Roman
Denis
Lukas
Thomas
Felix
Moritz
Jan
Stefan
Klaus
Hans
Franz
Peter
Marco
Roberto
Luca
Matteo
Andrea
Giuseppe
Tomáš
Jan
Ondřej
Jakub
Martin
Radek
Marek
Lukáš
Petr
Patrik
```
(Täytä vähintään 200 nimeen — generoi AI:n avulla loput)

Luo `mods/base/names/last_names.txt` (500 sukunimeä, 1 per rivi):

```
Korhonen
Virtanen
Mäkinen
Hämäläinen
Leinonen
Heikkinen
Koskinen
Järvinen
Lehtinen
Saarinen
Lindqvist
Eriksson
Andersson
Svensson
Nielsen
Hansen
Petersen
Christensen
Johnson
Williams
Brown
Davis
Wilson
Anderson
Martinez
Thompson
Jackson
White
Harris
Petrov
Volkov
Ivanov
Kozlov
Novak
Mueller
Schmidt
Wagner
Fischer
Bauer
Rossi
Ferrari
Romano
Colombo
Novák
Svoboda
Dvořák
Procházka
Krejčí
```
(Täytä 500:aan — generoi AI:n avulla)

- [ ] **5.2 Kirjoita testit**

Luo `tests/gut/test_player_generator.gd`:

```gdscript
extends GutTest

var gen: PlayerGenerator

func before_each():
    gen = PlayerGenerator.new()
    gen.load_names(
        "res://mods/base/names/first_names.txt",
        "res://mods/base/names/last_names.txt"
    )

func test_generator_loads_names():
    assert_true(gen.first_names_loaded(), "First names not loaded")
    assert_true(gen.last_names_loaded(), "Last names not loaded")

func test_generates_forward_with_valid_attributes():
    var p := gen.generate_player(PlayerData.Position.FORWARD, 24)
    assert_not_null(p)
    assert_eq(p.age, 24)
    assert_eq(p.position, PlayerData.Position.FORWARD)
    assert_between(p.skating, 1, 20)
    assert_between(p.shooting, 1, 20)
    assert_between(p.hidden_potential, 1, 20)

func test_generates_goalie_with_goalie_attributes():
    var g := gen.generate_goalie(28)
    assert_true(g is GoalieData)
    assert_eq(g.position, PlayerData.Position.GOALIE)
    assert_between(g.save_ability, 1, 20)
    assert_between(g.reflexes, 1, 20)

func test_player_has_non_empty_name():
    var p := gen.generate_player(PlayerData.Position.FORWARD, 22)
    assert_true(p.first_name.length() > 0)
    assert_true(p.last_name.length() > 0)

func test_roster_has_25_players():
    var roster := gen.generate_roster()
    assert_eq(roster.size(), 25)

func test_roster_position_mix():
    var roster := gen.generate_roster()
    var forwards = roster.filter(func(p): return p.position == PlayerData.Position.FORWARD)
    var defenders = roster.filter(func(p): return p.position == PlayerData.Position.DEFENSE)
    var goalies = roster.filter(func(p): return p.position == PlayerData.Position.GOALIE)
    assert_eq(forwards.size(), 14, "Should have 14 forwards (12 + 2 extra)")
    assert_eq(defenders.size(), 8, "Should have 8 defenders")
    assert_eq(goalies.size(), 3, "Should have 3 goalies")

func test_salary_correlates_with_skill():
    # Vahvemman pelaajan palkka on korkeampi kuin heikon
    var strong := gen.generate_player(PlayerData.Position.FORWARD, 26)
    strong.skating = 18; strong.shooting = 18; strong.passing = 18
    var weak := gen.generate_player(PlayerData.Position.FORWARD, 26)
    weak.skating = 5; weak.shooting = 5; weak.passing = 5
    # Palkka lasketaan generaattorin sisällä, testataan että vähintään positiivinen
    assert_true(strong.annual_salary > 0)
    assert_true(weak.annual_salary > 0)
```

- [ ] **5.3 Kirjoita PlayerGenerator**

Luo `src/data/player_generator.gd`:

```gdscript
class_name PlayerGenerator

var _first_names: Array[String] = []
var _last_names: Array[String] = []
var _rng := RandomNumberGenerator.new()

func _init() -> void:
    _rng.seed = Time.get_ticks_usec()  # Satunnainen siemen

func load_names(first_path: String, last_path: String) -> void:
    _first_names = _read_lines(first_path)
    _last_names = _read_lines(last_path)

func first_names_loaded() -> bool:
    return _first_names.size() > 0

func last_names_loaded() -> bool:
    return _last_names.size() > 0

func generate_roster() -> Array:
    var roster := []
    # 14 hyökkääjää (12 aktiivia + 2 varaa)
    for i in range(14):
        roster.append(generate_player(PlayerData.Position.FORWARD, _random_age()))
    # 8 puolustajaa
    for i in range(8):
        roster.append(generate_player(PlayerData.Position.DEFENSE, _random_age()))
    # 3 maalivahtia (2 aktiivia + 1 vara)
    for i in range(3):
        roster.append(generate_goalie(_random_age()))
    return roster

func generate_player(pos: PlayerData.Position, age: int) -> PlayerData:
    var p := PlayerData.new()
    p.id = _unique_id()
    p.first_name = _pick(_first_names)
    p.last_name = _pick(_last_names)
    p.age = age
    p.position = pos

    var base := _age_to_base(age)
    var spread := 4

    p.skating      = _attr(base, spread)
    p.shooting     = _attr(base, spread)
    p.passing      = _attr(base, spread)
    p.puck_handling = _attr(base, spread)
    p.positioning  = _attr(base, spread)
    p.defensive_play = _attr(base, spread)
    p.power_play   = _attr(base, spread)
    p.speed        = _attr(base, spread)
    p.stamina      = _attr(base, spread)
    p.checking     = _attr(base, spread)
    p.composure    = _attr(base, spread)
    p.team_spirit  = _attr(base, spread)

    p.hidden_potential = clampi(base + _rng.randi_range(0, 6), 5, 20)

    var avg := (p.skating + p.shooting + p.passing) / 3.0
    p.annual_salary = int(avg * 15000.0) + _rng.randi_range(-20000, 20000)
    p.contract_years_left = _rng.randi_range(1, 4)
    return p

func generate_goalie(age: int) -> GoalieData:
    var g := GoalieData.new()
    g.id = _unique_id()
    g.first_name = _pick(_first_names)
    g.last_name = _pick(_last_names)
    g.age = age

    var base := _age_to_base(age)
    var spread := 4
    g.save_ability        = _attr(base, spread)
    g.reflexes            = _attr(base, spread)
    g.goalie_positioning  = _attr(base, spread)
    g.mental_strength     = _attr(base, spread)
    g.stamina             = _attr(base, spread)
    g.hidden_potential    = clampi(base + _rng.randi_range(0, 6), 5, 20)
    g.annual_salary       = int(g.save_ability * 18000.0) + _rng.randi_range(-20000, 20000)
    g.contract_years_left = _rng.randi_range(1, 4)
    return g

func _age_to_base(age: int) -> int:
    if age < 20:   return _rng.randi_range(4, 8)
    if age < 23:   return _rng.randi_range(7, 12)
    if age <= 28:  return _rng.randi_range(10, 16)
    if age <= 32:  return _rng.randi_range(9, 14)
    return _rng.randi_range(6, 11)

func _random_age() -> int:
    var roll := _rng.randf()
    if roll < 0.15: return _rng.randi_range(18, 21)
    if roll < 0.55: return _rng.randi_range(22, 28)
    if roll < 0.85: return _rng.randi_range(29, 33)
    return _rng.randi_range(34, 38)

func _attr(base: int, spread: int) -> int:
    return clampi(base + _rng.randi_range(-spread, spread), 1, 20)

func _pick(arr: Array[String]) -> String:
    if arr.is_empty(): return "Unknown"
    return arr[_rng.randi_range(0, arr.size() - 1)]

func _unique_id() -> String:
    return "%d_%d" % [Time.get_ticks_usec(), _rng.randi()]

func _read_lines(path: String) -> Array[String]:
    var file := FileAccess.open(path, FileAccess.READ)
    if not file:
        push_error("Cannot open: " + path)
        return []
    var lines: Array[String] = []
    while not file.eof_reached():
        var line := file.get_line().strip_edges()
        if line.length() > 0:
            lines.append(line)
    return lines
```

- [ ] **5.4 Aja testit — varmista vihreä**

- [ ] **5.5 Commit**

```powershell
git add src/data/player_generator.gd tests/gut/test_player_generator.gd mods/base/names/
git commit -m "feat: PlayerGenerator with age curves, 25-player rosters (14F+8D+3G)"
```

---

## Task 6: LeagueLoader — JSON-lataaja

**Files:**
- Create: `mods/base/leagues/*.json` (6 tiedostoa)
- Create: `src/data/league_loader.gd`
- Create: `tests/gut/test_league_loader.gd`

- [ ] **6.1 Luo 6 JSON-liigamäärittelyä**

Luo `mods/base/leagues/north_premier.json` (kopioi tämä pohja kaikille 6:lle, muuta nimi/alue/tier):

```json
{
  "league_id": "north_premier",
  "name": "Northern Premier League",
  "tier": "premier",
  "region": "north",
  "teams": [
    {"team_id":"arctic_wolves","name":"Arctic Wolves","city":"Rovaniemi","logo":"logos/arctic_wolves.png","primary_color":"#1a3a6b","secondary_color":"#ffffff","arena_capacity":9500},
    {"team_id":"polar_bears","name":"Polar Bears","city":"Oulu","logo":"logos/polar_bears.png","primary_color":"#8B0000","secondary_color":"#gold","arena_capacity":8200},
    {"team_id":"northern_eagles","name":"Northern Eagles","city":"Tampere","logo":"logos/northern_eagles.png","primary_color":"#006400","secondary_color":"#ffffff","arena_capacity":12000},
    {"team_id":"ice_lynx","name":"Ice Lynx","city":"Turku","logo":"logos/ice_lynx.png","primary_color":"#FF8C00","secondary_color":"#000000","arena_capacity":11000},
    {"team_id":"frost_hawks","name":"Frost Hawks","city":"Helsinki","logo":"logos/frost_hawks.png","primary_color":"#1C1C1C","secondary_color":"#FFD700","arena_capacity":13500},
    {"team_id":"winter_wolves","name":"Winter Wolves","city":"Jyväskylä","logo":"logos/winter_wolves.png","primary_color":"#800080","secondary_color":"#ffffff","arena_capacity":8800},
    {"team_id":"snow_tigers","name":"Snow Tigers","city":"Kuopio","logo":"logos/snow_tigers.png","primary_color":"#FF4500","secondary_color":"#000000","arena_capacity":7500},
    {"team_id":"blizzard_bulls","name":"Blizzard Bulls","city":"Vaasa","logo":"logos/blizzard_bulls.png","primary_color":"#006400","secondary_color":"#FFD700","arena_capacity":6800},
    {"team_id":"frozen_foxes","name":"Frozen Foxes","city":"Lahti","logo":"logos/frozen_foxes.png","primary_color":"#4169E1","secondary_color":"#ffffff","arena_capacity":8000},
    {"team_id":"glacier_griffins","name":"Glacier Griffins","city":"Pori","logo":"logos/glacier_griffins.png","primary_color":"#8B4513","secondary_color":"#ffffff","arena_capacity":7200},
    {"team_id":"tundra_ravens","name":"Tundra Ravens","city":"Joensuu","logo":"logos/tundra_ravens.png","primary_color":"#000000","secondary_color":"#C0C0C0","arena_capacity":6500},
    {"team_id":"arctic_stallions","name":"Arctic Stallions","city":"Kouvola","logo":"logos/arctic_stallions.png","primary_color":"#008080","secondary_color":"#ffffff","arena_capacity":7000},
    {"team_id":"permafrost_panthers","name":"Permafrost Panthers","city":"Lappeenranta","logo":"logos/permafrost_panthers.png","primary_color":"#B8860B","secondary_color":"#000000","arena_capacity":6200},
    {"team_id":"ice_vipers","name":"Ice Vipers","city":"Hämeenlinna","logo":"logos/ice_vipers.png","primary_color":"#006400","secondary_color":"#FFD700","arena_capacity":7800},
    {"team_id":"frozen_falcons","name":"Frozen Falcons","city":"Rovaniemi","logo":"logos/frozen_falcons.png","primary_color":"#DC143C","secondary_color":"#ffffff","arena_capacity":8400},
    {"team_id":"snow_sharks","name":"Snow Sharks","city":"Seinäjoki","logo":"logos/snow_sharks.png","primary_color":"#00008B","secondary_color":"#ffffff","arena_capacity":6800},
    {"team_id":"blizzard_bisons","name":"Blizzard Bisons","city":"Kotka","logo":"logos/blizzard_bisons.png","primary_color":"#8B0000","secondary_color":"#C0C0C0","arena_capacity":7100},
    {"team_id":"glacier_gorillas","name":"Glacier Gorillas","city":"Savonlinna","logo":"logos/glacier_gorillas.png","primary_color":"#2F4F4F","secondary_color":"#FFD700","arena_capacity":5800},
    {"team_id":"frostbite_foxhounds","name":"Frostbite Foxhounds","city":"Kajaani","logo":"logos/frostbite_foxhounds.png","primary_color":"#FF6347","secondary_color":"#000000","arena_capacity":6000},
    {"team_id":"polar_pythons","name":"Polar Pythons","city":"Mikkeli","logo":"logos/polar_pythons.png","primary_color":"#7B68EE","secondary_color":"#ffffff","arena_capacity":6300}
  ]
}
```

Tee vastaavat tiedostot: `north_first.json`, `central_premier.json`, `central_first.json`, `south_premier.json`, `south_first.json`. Vaihda `league_id`, `name`, `tier` ja `region` sekä joukkuenimet/kaupungit kullekin liigalle sopiviksi.

- [ ] **6.2 Kirjoita testit**

Luo `tests/gut/test_league_loader.gd`:

```gdscript
extends GutTest

var loader: LeagueLoader

func before_each():
    loader = LeagueLoader.new()

func test_loads_one_league_file():
    var league := loader.load_league("res://mods/base/leagues/north_premier.json")
    assert_not_null(league)
    assert_eq(league.name, "Northern Premier League")
    assert_eq(league.tier, LeagueData.Tier.PREMIER)

func test_loaded_league_has_20_teams():
    var league := loader.load_league("res://mods/base/leagues/north_premier.json")
    assert_eq(league.teams.size(), 20)

func test_team_has_required_fields():
    var league := loader.load_league("res://mods/base/leagues/north_premier.json")
    var team := league.teams[0]
    assert_true(team.name.length() > 0)
    assert_true(team.id.length() > 0)
    assert_gt(team.arena_capacity, 0)

func test_loads_all_6_leagues():
    var leagues := loader.load_all("res://mods/base/leagues/")
    assert_eq(leagues.size(), 6)

func test_3_premier_and_3_first_leagues():
    var leagues := loader.load_all("res://mods/base/leagues/")
    var premiers = leagues.filter(func(l): return l.tier == LeagueData.Tier.PREMIER)
    var firsts = leagues.filter(func(l): return l.tier == LeagueData.Tier.FIRST)
    assert_eq(premiers.size(), 3)
    assert_eq(firsts.size(), 3)
```

- [ ] **6.3 Kirjoita LeagueLoader**

Luo `src/data/league_loader.gd`:

```gdscript
class_name LeagueLoader

func load_all(dir_path: String) -> Array[LeagueData]:
    var leagues: Array[LeagueData] = []
    var dir := DirAccess.open(dir_path)
    if not dir:
        push_error("Cannot open leagues dir: " + dir_path)
        return leagues
    dir.list_dir_begin()
    var fname := dir.get_next()
    while fname != "":
        if fname.ends_with(".json"):
            var l := load_league(dir_path + fname)
            if l:
                leagues.append(l)
        fname = dir.get_next()
    return leagues

func load_league(path: String) -> LeagueData:
    var text := FileAccess.get_file_as_string(path)
    if text.is_empty():
        push_error("Empty or missing: " + path)
        return null
    var d: Variant = JSON.parse_string(text)
    if typeof(d) != TYPE_DICTIONARY:
        push_error("Invalid JSON: " + path)
        return null
    return _parse_league(d)

func _parse_league(d: Dictionary) -> LeagueData:
    var l := LeagueData.new()
    l.id   = d.get("league_id", "")
    l.name = d.get("name", "")
    l.tier = LeagueData.Tier.PREMIER if d.get("tier","") == "premier" else LeagueData.Tier.FIRST
    match d.get("region", ""):
        "north":   l.region = LeagueData.Region.NORTH
        "central": l.region = LeagueData.Region.CENTRAL
        _:         l.region = LeagueData.Region.SOUTH
    for td in d.get("teams", []):
        l.teams.append(_parse_team(td, l.id))
    return l

func _parse_team(d: Dictionary, league_id: String) -> TeamData:
    var t := TeamData.new()
    t.id             = d.get("team_id", "")
    t.name           = d.get("name", "")
    t.city           = d.get("city", "")
    t.logo_path      = d.get("logo", "")
    t.primary_color  = d.get("primary_color", "#1a3a6b")
    t.secondary_color = d.get("secondary_color", "#ffffff")
    t.arena_capacity = d.get("arena_capacity", 8000)
    t.league_id      = league_id
    return t
```

- [ ] **6.4 Aja testit — varmista vihreä**

- [ ] **6.5 Commit**

```powershell
git add src/data/league_loader.gd tests/gut/test_league_loader.gd mods/base/leagues/
git commit -m "feat: LeagueLoader reads 6 JSON leagues, 20 teams each"
```

---

## Task 7: WorldFactory — kaikki yhteen

**Files:**
- Create: `src/data/world_factory.gd`
- Create: `tests/gut/test_world_factory.gd`

- [ ] **7.1 Kirjoita testit**

Luo `tests/gut/test_world_factory.gd`:

```gdscript
extends GutTest

var world: WorldData

func before_all():
    var factory := WorldFactory.new()
    world = factory.create_new_world()

func test_world_has_6_leagues():
    assert_eq(world.leagues.size(), 6)

func test_each_league_has_20_teams():
    for league in world.leagues:
        assert_eq(league.teams.size(), 20,
            "%s should have 20 teams" % league.name)

func test_total_players_around_3000():
    var total := 0
    for league in world.leagues:
        for team in league.teams:
            total += team.players.size()
    assert_between(total, 2900, 3100)

func test_premier_leagues_have_schedule():
    for league in world.leagues:
        if league.tier == LeagueData.Tier.PREMIER:
            assert_gt(league.schedule.size(), 0,
                "%s should have schedule" % league.name)

func test_first_division_has_no_schedule():
    for league in world.leagues:
        if league.tier == LeagueData.Tier.FIRST:
            assert_eq(league.schedule.size(), 0,
                "First division should not have schedule in Sprint 1")

func test_generation_under_2_seconds():
    var factory := WorldFactory.new()
    var start := Time.get_ticks_msec()
    factory.create_new_world()
    var elapsed := Time.get_ticks_msec() - start
    assert_true(elapsed < 2000,
        "Generation took %dms, limit 2000ms" % elapsed)
```

- [ ] **7.2 Kirjoita WorldFactory**

Luo `src/data/world_factory.gd`:

```gdscript
class_name WorldFactory

const LEAGUES_PATH := "res://mods/base/leagues/"
const FIRST_NAMES  := "res://mods/base/names/first_names.txt"
const LAST_NAMES   := "res://mods/base/names/last_names.txt"

func create_new_world() -> WorldData:
    var world := WorldData.new()
    world.season = 1
    world.day_of_season = 1

    var loader := LeagueLoader.new()
    var gen    := PlayerGenerator.new()
    gen.load_names(FIRST_NAMES, LAST_NAMES)

    for league in loader.load_all(LEAGUES_PATH):
        for team in league.teams:
            team.players = gen.generate_roster()
        if league.tier == LeagueData.Tier.PREMIER:
            league.schedule = ScheduleGenerator.generate(league.teams, 60)
        world.leagues.append(league)

    return world
```

- [ ] **7.3 Aja testit — varmista vihreä**

- [ ] **7.4 Commit**

```powershell
git add src/data/world_factory.gd tests/gut/test_world_factory.gd
git commit -m "feat: WorldFactory assembles full game world in <2s"
```

---

## Task 8: SaveManager + GameState + EventBus

**Files:**
- Create: `src/data/save_manager.gd`
- Create: `src/autoload/game_state.gd`
- Create: `src/autoload/event_bus.gd`
- Create: `tests/gut/test_save_manager.gd`

- [ ] **8.1 Kirjoita SaveManager-testi**

Luo `tests/gut/test_save_manager.gd`:

```gdscript
extends GutTest

const SAVE_PATH := "user://test_sprint1_save.json.gz"

func after_each():
    if FileAccess.file_exists(SAVE_PATH):
        DirAccess.remove_absolute(
            OS.get_user_data_dir() + "/test_sprint1_save.json.gz")

func test_save_and_load_roundtrip():
    var factory := WorldFactory.new()
    var w := factory.create_new_world()
    w.season = 3
    w.day_of_season = 42

    var mgr := SaveManager.new()
    mgr.save(w, SAVE_PATH)
    assert_true(FileAccess.file_exists(SAVE_PATH), "Save file not created")

    var loaded := mgr.load(SAVE_PATH)
    assert_not_null(loaded)
    assert_eq(loaded.season, 3)
    assert_eq(loaded.day_of_season, 42)
    assert_eq(loaded.leagues.size(), 6)

func test_loaded_world_has_teams():
    var factory := WorldFactory.new()
    var w := factory.create_new_world()
    var mgr := SaveManager.new()
    mgr.save(w, SAVE_PATH)
    var loaded := mgr.load(SAVE_PATH)
    var total_teams := 0
    for league in loaded.leagues:
        total_teams += league.teams.size()
    assert_eq(total_teams, 120)

func test_load_nonexistent_returns_null():
    var mgr := SaveManager.new()
    var result := mgr.load("user://does_not_exist.json.gz")
    assert_null(result)
```

- [ ] **8.2 Kirjoita SaveManager**

Luo `src/data/save_manager.gd`:

```gdscript
class_name SaveManager

func save(world: WorldData, path: String) -> void:
    var dict := _world_to_dict(world)
    var json := JSON.stringify(dict, "\t")
    var bytes := json.to_utf8_buffer()
    var compressed := bytes.compress(FileAccess.COMPRESSION_GZIP)
    var f := FileAccess.open(path, FileAccess.WRITE)
    if not f:
        push_error("Cannot write: " + path)
        return
    f.store_buffer(compressed)

func load(path: String) -> WorldData:
    if not FileAccess.file_exists(path):
        return null
    var f := FileAccess.open(path, FileAccess.READ)
    if not f:
        return null
    var compressed := f.get_buffer(f.get_length())
    var bytes := compressed.decompress_dynamic(-1, FileAccess.COMPRESSION_GZIP)
    var json := bytes.get_string_from_utf8()
    var d: Variant = JSON.parse_string(json)
    if typeof(d) != TYPE_DICTIONARY:
        push_error("Corrupt save: " + path)
        return null
    return _dict_to_world(d)

# --- Serialisaatio ---

func _world_to_dict(w: WorldData) -> Dictionary:
    return {
        "season": w.season,
        "day": w.day_of_season,
        "player_team_id": w.player_team_id,
        "player_league_id": w.player_team_league_id,
        "leagues": w.leagues.map(func(l): return _league_to_dict(l))
    }

func _league_to_dict(l: LeagueData) -> Dictionary:
    return {
        "id": l.id, "name": l.name,
        "tier": "premier" if l.tier == LeagueData.Tier.PREMIER else "first",
        "region": ["north","central","south"][l.region],
        "teams": l.teams.map(func(t): return _team_to_dict(t)),
        "schedule": l.schedule.map(func(g): return _game_to_dict(g))
    }

func _team_to_dict(t: TeamData) -> Dictionary:
    return {
        "id": t.id, "name": t.name, "city": t.city,
        "logo": t.logo_path, "color1": t.primary_color, "color2": t.secondary_color,
        "capacity": t.arena_capacity, "league_id": t.league_id,
        "cash": t.cash_balance, "budget": t.annual_budget, "fan": t.fan_support,
        "w": t.wins, "l": t.losses, "otl": t.overtime_losses,
        "gf": t.goals_for, "ga": t.goals_against,
        "controlled": t.is_player_controlled,
        "players": t.players.map(func(p): return _player_to_dict(p))
    }

func _player_to_dict(p: PlayerData) -> Dictionary:
    var d := {
        "id": p.id, "fn": p.first_name, "ln": p.last_name,
        "age": p.age, "pos": p.position,
        "sk": p.skating, "sh": p.shooting, "pa": p.passing, "ph": p.puck_handling,
        "po": p.positioning, "dp": p.defensive_play, "pp": p.power_play,
        "sp": p.speed, "st": p.stamina, "ch": p.checking,
        "co": p.composure, "ts": p.team_spirit,
        "pot": p.hidden_potential, "sal": p.annual_salary, "ctr": p.contract_years_left,
        "fat": p.fatigue, "inj": p.is_injured, "inw": p.injury_weeks_remaining
    }
    if p is GoalieData:
        d["g_sav"] = p.save_ability
        d["g_ref"] = p.reflexes
        d["g_pos"] = p.goalie_positioning
        d["g_men"] = p.mental_strength
    return d

func _game_to_dict(g: ScheduledGame) -> Dictionary:
    return {
        "h": g.home_team_id, "a": g.away_team_id, "day": g.day_of_season,
        "played": g.is_played, "hs": g.home_score, "as": g.away_score
    }

# --- Deserialisaatio ---

func _dict_to_world(d: Dictionary) -> WorldData:
    var w := WorldData.new()
    w.season = d.get("season", 1)
    w.day_of_season = d.get("day", 1)
    w.player_team_id = d.get("player_team_id", "")
    w.player_team_league_id = d.get("player_league_id", "")
    for ld in d.get("leagues", []):
        w.leagues.append(_dict_to_league(ld))
    return w

func _dict_to_league(d: Dictionary) -> LeagueData:
    var l := LeagueData.new()
    l.id = d.get("id", "")
    l.name = d.get("name", "")
    l.tier = LeagueData.Tier.PREMIER if d.get("tier","") == "premier" else LeagueData.Tier.FIRST
    match d.get("region",""):
        "north":   l.region = LeagueData.Region.NORTH
        "central": l.region = LeagueData.Region.CENTRAL
        _:         l.region = LeagueData.Region.SOUTH
    for td in d.get("teams", []):
        l.teams.append(_dict_to_team(td))
    for gd in d.get("schedule", []):
        l.schedule.append(_dict_to_game(gd))
    return l

func _dict_to_team(d: Dictionary) -> TeamData:
    var t := TeamData.new()
    t.id = d.get("id",""); t.name = d.get("name",""); t.city = d.get("city","")
    t.logo_path = d.get("logo",""); t.primary_color = d.get("color1","#1a3a6b")
    t.secondary_color = d.get("color2","#ffffff"); t.arena_capacity = d.get("capacity",8000)
    t.league_id = d.get("league_id",""); t.cash_balance = d.get("cash",500000)
    t.annual_budget = d.get("budget",2000000); t.fan_support = d.get("fan",50)
    t.wins = d.get("w",0); t.losses = d.get("l",0); t.overtime_losses = d.get("otl",0)
    t.goals_for = d.get("gf",0); t.goals_against = d.get("ga",0)
    t.is_player_controlled = d.get("controlled",false)
    for pd in d.get("players",[]):
        t.players.append(_dict_to_player(pd))
    return t

func _dict_to_player(d: Dictionary) -> PlayerData:
    var is_goalie := d.has("g_sav")
    var p: PlayerData = GoalieData.new() if is_goalie else PlayerData.new()
    p.id = d.get("id",""); p.first_name = d.get("fn",""); p.last_name = d.get("ln","")
    p.age = d.get("age",20); p.position = d.get("pos", PlayerData.Position.FORWARD)
    p.skating = d.get("sk",10); p.shooting = d.get("sh",10); p.passing = d.get("pa",10)
    p.puck_handling = d.get("ph",10); p.positioning = d.get("po",10)
    p.defensive_play = d.get("dp",10); p.power_play = d.get("pp",10)
    p.speed = d.get("sp",10); p.stamina = d.get("st",10); p.checking = d.get("ch",10)
    p.composure = d.get("co",10); p.team_spirit = d.get("ts",10)
    p.hidden_potential = d.get("pot",15); p.annual_salary = d.get("sal",50000)
    p.contract_years_left = d.get("ctr",1); p.fatigue = d.get("fat",0)
    p.is_injured = d.get("inj",false); p.injury_weeks_remaining = d.get("inw",0)
    if is_goalie:
        var g := p as GoalieData
        g.save_ability = d.get("g_sav",10); g.reflexes = d.get("g_ref",10)
        g.goalie_positioning = d.get("g_pos",10); g.mental_strength = d.get("g_men",10)
    return p

func _dict_to_game(d: Dictionary) -> ScheduledGame:
    var g := ScheduledGame.new()
    g.home_team_id = d.get("h",""); g.away_team_id = d.get("a","")
    g.day_of_season = d.get("day",0); g.is_played = d.get("played",false)
    g.home_score = d.get("hs",0); g.away_score = d.get("as",0)
    return g
```

- [ ] **8.3 Luo autoload-singletonit**

Luo `src/autoload/game_state.gd`:

```gdscript
extends Node

var world: WorldData = null

func start_new_game(player_team_id: String, player_league_id: String) -> void:
    world = WorldFactory.new().create_new_world()
    world.player_team_id = player_team_id
    world.player_team_league_id = player_league_id
    EventBus.new_game_started.emit()

func save(slot: int = 0) -> void:
    if world:
        SaveManager.new().save(world, _path(slot))

func load_slot(slot: int = 0) -> bool:
    var w := SaveManager.new().load(_path(slot))
    if not w: return false
    world = w
    EventBus.game_loaded.emit()
    return true

func _path(slot: int) -> String:
    return "user://save_%d.json.gz" % slot
```

Luo `src/autoload/event_bus.gd`:

```gdscript
extends Node

signal new_game_started
signal game_loaded
signal game_day_advanced(day: int)
signal match_result(home_id: String, away_id: String, home_score: int, away_score: int)
signal player_injured(player_id: String, weeks: int)
signal transfer_done(player_id: String, from_id: String, to_id: String)
signal season_ended(champion_id: String)
```

Rekisteröi Godotissa: `Project → Project Settings → Autoload`:
- `res://src/autoload/game_state.gd` nimellä `GameState`
- `res://src/autoload/event_bus.gd` nimellä `EventBus`

- [ ] **8.4 Aja kaikki testit**

```powershell
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -glog=1 -gexit
```

Odotettu: kaikki testit vihreänä.

- [ ] **8.5 Varmista Sprint 1 -valmistumiskriteeri**

Tarkista GUT-tuloksista seuraavat:
- [ ] `test_world_has_6_leagues` ✅
- [ ] `test_each_league_has_20_teams` ✅
- [ ] `test_total_players_around_3000` ✅
- [ ] `test_premier_leagues_have_schedule` ✅
- [ ] `test_generation_under_2_seconds` ✅
- [ ] `test_save_and_load_roundtrip` ✅
- [ ] `test_loaded_world_has_teams` ✅

- [ ] **8.6 Sprint 1 -loppucommit ja tag**

```powershell
git add src/ tests/ .github/
git commit -m "feat: SaveManager, GameState, EventBus — Sprint 1 complete"
git tag sprint1-complete
git push origin master --tags  # jos GitHub-repo on asetettu
```

---

## Sprint 1 Valmistumiskriteeri

- [ ] Godot 4 -projekti avataan ilman virheitä
- [ ] GUT: kaikki testit vihreänä (0 failures)
- [ ] WorldFactory generoi maailman alle 2 sekunnissa
- [ ] 6 liigaa, 120 joukkuetta, ~3 000 pelaajaa
- [ ] 60-pelin kalenteri Premier-liigoissa (600 ottelua / liiga)
- [ ] Save/load roundtrip toimii täydellisesti
- [ ] CI (GitHub Actions) vihreänä

---

## Seuraava: Sprint 2

Sprint 2 -suunnitelmadokumentti kirjoitetaan Sprint 1:n valmistuttua. Sprint 2 sisältää:
- `MatchSimulator.cs` (C# ensimmäistä kertaa — kommunikoi GDScriptin kanssa Dictionary/Array-tyypeillä)
- `EconomyEngine.gd`
- `TrainingSystem.gd`
- `SeasonManager.gd` (orkestroi viikkosilmukan)
- Tekstipohjainen otteluraportti (ei 2D vielä)
- NUnit-projekti C#-simulaattorin testaukseen
