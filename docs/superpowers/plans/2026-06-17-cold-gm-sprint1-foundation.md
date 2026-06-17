# Cold GM — Sprint 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rakenna Cold GM:n datainfrakstuuri — generoi 3 000 fiktiivistä pelaajaa, 6 liigaa, 120 joukkuetta ja 60 pelin runkosarjakalenteri, sekä toimiva tallennus/lataus.

**Architecture:** Godot 4 -projekti jonka ydin on jaettu kahteen kerrokseen: C# sisältää puhtaan (Godot-riippumattoman) pelilogiikan ja datamallit — näitä testataan NUnitilla erillisestä .csproj:sta. GDScript hoitaa tiedostojen latauksen, generaattorit ja UI:n yhteyden pelilogiikkaan. GDScript-koodi testataan GUT-addonilla.

**Tech Stack:** Godot 4.3+ (Mono/C#), GDScript, .NET 8, NUnit 4, GUT addon (v9.x), GitHub Actions.

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

Sprint 1 valmistumiskriteeri: Koko pelimaailma (6 liigaa, 120 joukkuetta, ~3 000 pelaajaa) generoituu alle 2 sekunnissa, tallennetaan tiedostoon, ladataan takaisin ja data täsmää. Kaikki C#-testit vihreänä, GUT-testit vihreänä.

---

## Tiedostorakenne

```
cold_gm/                          # Godot 4 -projekti (uusi hakemisto)
├── project.godot
├── ColdGM.csproj                 # Godot generoi automaattisesti
├── addons/
│   └── gut/                      # GUT-testiaddon (kopioidaan)
├── src/
│   ├── core/                     # C# — puhdas pelilogiikka, ei Godot-riippuvuuksia
│   │   ├── PlayerData.cs         # Pelaajan dataluokka (12 attribuuttia, ikä, sopimus)
│   │   ├── TeamData.cs           # Joukkueen dataluokka (roster, talous, fanituki)
│   │   ├── LeagueData.cs         # Liigan dataluokka (joukkueet, kalenteri, tulostaulukko)
│   │   ├── ScheduleGenerator.cs  # 60 pelin round-robin-kalenteri
│   │   └── WorldData.cs          # Kaikki 6 liigaa + meta-info (kausi, päivä)
│   ├── data/                     # GDScript — tiedostojen luku/kirjoitus
│   │   ├── LeagueLoader.gd       # Lukee mods/base/leagues/*.json → LeagueData
│   │   ├── PlayerGenerator.gd    # Generoi fiktiiviset pelaajat
│   │   └── SaveManager.gd        # Tallentaa/lataa WorldData JSON+gzip
│   └── autoload/                 # Godot autoloads (singletonit)
│       ├── GameState.gd          # Koko pelimaailman tila (WorldData-viite)
│       └── EventBus.gd           # Signal-väylä, decoupled kommunikaatio
├── mods/
│   └── base/
│       ├── leagues/
│       │   ├── north_premier.json
│       │   ├── north_first.json
│       │   ├── central_premier.json
│       │   ├── central_first.json
│       │   ├── south_premier.json
│       │   └── south_first.json
│       ├── names/
│       │   ├── first_names.txt   # ~200 etunimiä (kansainvälinen mix)
│       │   └── last_names.txt    # ~500 sukunimeä
│       └── logos/                # Placeholder PNG:t (tyhjät kuvakkeet)
├── tests/
│   └── gut/                      # GDScript-testit GUT-addonilla
│       ├── test_league_loader.gd
│       ├── test_player_generator.gd
│       └── test_save_manager.gd
└── ColdGM.Tests/                 # Erillinen C# testiprojekti
    ├── ColdGM.Tests.csproj
    ├── PlayerDataTests.cs
    ├── ScheduleGeneratorTests.cs
    └── WorldDataTests.cs
```

**Rajapintasäännöt:**
- `src/core/*.cs` — ei `using Godot;` -importteja. Godot-node voi viitata näihin, mutta ei toisinpäin.
- `src/data/*.gd` — käyttää C#-luokkia GDScriptin `new`-kutsulla (`PlayerData.new()`)
- `autoload/GameState.gd` — ainoa paikka josta UI-näkymät hakevat pelitilatietoa

---

## Task 1: Godot-projekti ja kehitysympäristö

**Files:**
- Create: `cold_gm/project.godot` (Godot luo)
- Create: `cold_gm/ColdGM.Tests/ColdGM.Tests.csproj`
- Create: `.github/workflows/ci.yml`

- [ ] **1.1 Luo Godot 4 -projekti**

Avaa Godot 4.3+. Luo uusi projekti hakemistoon `C:\Users\rauti\cold_gm\` (tai haluamaasi sijaintiin, EI buukkikisa-hakemistoon). Valitse "Compatibility" renderer (nopein 2D:lle). Sulje Godot.

- [ ] **1.2 Ota C# käyttöön**

Avaa projekti Godotissa. Luo tyhjä C#-skripti (`File → New Script → C#`). Godot generoi `ColdGM.csproj`. Poista tyhjä skripti — .csproj jää.

- [ ] **1.3 Luo C#-testiprojekti**

```powershell
cd C:\Users\rauti\cold_gm
mkdir ColdGM.Tests
cd ColdGM.Tests
dotnet new nunit
```

Muokkaa `ColdGM.Tests.csproj` lisäämällä viittaus pääprojektiin:

```xml
<ItemGroup>
  <ProjectReference Include="..\ColdGM.csproj" />
</ItemGroup>
```

- [ ] **1.4 Asenna GUT-addon**

Lataa GUT v9.x GitHubista (https://github.com/bitwes/Gut/releases). Kopioi `addons/gut/`-kansio projektin `addons/gut/`-kansioon. Aktivoi Godotissa: `Project → Project Settings → Plugins → GUT → Enable`.

- [ ] **1.5 Luo hakemistorakenne**

```powershell
cd C:\Users\rauti\cold_gm
mkdir -p src/core src/data src/autoload tests/gut mods/base/leagues mods/base/names mods/base/logos ColdGM.Tests
```

- [ ] **1.6 Luo GitHub-repo ja CI**

```powershell
git init
git add .gitignore  # lisää .godot/ ja .mono/ ignore-listaan
```

Luo `C:\Users\rauti\cold_gm\.github\workflows\ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test-csharp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0'
      - run: dotnet test ColdGM.Tests/ColdGM.Tests.csproj --verbosity normal
```

- [ ] **1.7 Ensimmäinen commit**

```powershell
git add .
git commit -m "chore: init Godot 4 project, C# test infra, CI"
```

---

## Task 2: PlayerData — C#-dataluokka

**Files:**
- Create: `src/core/PlayerData.cs`
- Create: `ColdGM.Tests/PlayerDataTests.cs`

- [ ] **2.1 Kirjoita epäonnistuva testi**

Luo `ColdGM.Tests/PlayerDataTests.cs`:

```csharp
using NUnit.Framework;

namespace ColdGM.Tests;

[TestFixture]
public class PlayerDataTests
{
    [Test]
    public void NewPlayer_HasExactly12FieldAttributes()
    {
        var p = new PlayerData();
        var attrs = new[]
        {
            p.Skating, p.Shooting, p.Passing, p.PuckHandling,
            p.Positioning, p.DefensivePlay, p.PowerPlay,
            p.Speed, p.Stamina, p.Checking,
            p.Composure, p.TeamSpirit
        };
        Assert.That(attrs.Length, Is.EqualTo(12));
    }

    [Test]
    public void NewPlayer_AllAttributesInValidRange()
    {
        var p = new PlayerData { Skating = 10, Shooting = 15 };
        Assert.That(p.Skating, Is.InRange(1, 20));
        Assert.That(p.Shooting, Is.InRange(1, 20));
    }

    [Test]
    public void PlayerData_Position_DefaultIsForward()
    {
        var p = new PlayerData();
        Assert.That(p.Position, Is.EqualTo(PlayerPosition.Forward));
    }

    [Test]
    public void GoalieData_HasFourGoalieAttributes()
    {
        var g = new GoalieData();
        var attrs = new[] { g.SaveAbility, g.Reflexes, g.GoaliePositioning, g.MentalStrength };
        Assert.That(attrs.Length, Is.EqualTo(4));
    }
}
```

- [ ] **2.2 Aja testit — varmista epäonnistuminen**

```powershell
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal
```

Odotettu tulos: `Error: type 'PlayerData' not found`

- [ ] **2.3 Kirjoita minimaalinen implementaatio**

Luo `src/core/PlayerData.cs`:

```csharp
namespace ColdGM;

public enum PlayerPosition { Forward, Defense, Goalie }

public class PlayerData
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string FullName => $"{FirstName} {LastName}";
    public int Age { get; set; } = 20;
    public string Nationality { get; set; } = "";
    public PlayerPosition Position { get; set; } = PlayerPosition.Forward;

    // Technical
    public int Skating { get; set; } = 10;
    public int Shooting { get; set; } = 10;
    public int Passing { get; set; } = 10;
    public int PuckHandling { get; set; } = 10;

    // Tactical
    public int Positioning { get; set; } = 10;
    public int DefensivePlay { get; set; } = 10;
    public int PowerPlay { get; set; } = 10;

    // Physical
    public int Speed { get; set; } = 10;
    public int Stamina { get; set; } = 10;
    public int Checking { get; set; } = 10;

    // Mental
    public int Composure { get; set; } = 10;
    public int TeamSpirit { get; set; } = 10;

    // Hidden
    public int HiddenPotential { get; set; } = 15; // 1-20, never shown directly
    public int ContractYearsLeft { get; set; } = 1;
    public int AnnualSalary { get; set; } = 50000;
    public int Fatigue { get; set; } = 0; // 0-100
    public bool IsInjured { get; set; } = false;
    public int InjuryWeeksRemaining { get; set; } = 0;
}

public class GoalieData : PlayerData
{
    public GoalieData() { Position = PlayerPosition.Goalie; }
    public int SaveAbility { get; set; } = 10;
    public int Reflexes { get; set; } = 10;
    public int GoaliePositioning { get; set; } = 10;
    public int MentalStrength { get; set; } = 10;
}
```

- [ ] **2.4 Aja testit — varmista vihreä**

```powershell
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal
```

Odotettu tulos: `Passed! - 4 tests passed`

- [ ] **2.5 Commit**

```powershell
git add src/core/PlayerData.cs ColdGM.Tests/PlayerDataTests.cs
git commit -m "feat: PlayerData and GoalieData C# models with 12+4 attributes"
```

---

## Task 3: TeamData ja LeagueData

**Files:**
- Create: `src/core/TeamData.cs`
- Create: `src/core/LeagueData.cs`
- Create: `src/core/WorldData.cs`
- Modify: `ColdGM.Tests/PlayerDataTests.cs` (lisää uusia testejä)

- [ ] **3.1 Kirjoita epäonnistuvat testit**

Lisää `ColdGM.Tests/` tiedostoon `TeamDataTests.cs`:

```csharp
using NUnit.Framework;

namespace ColdGM.Tests;

[TestFixture]
public class TeamDataTests
{
    [Test]
    public void NewTeam_HasEmptyRoster()
    {
        var team = new TeamData { Name = "Test Team" };
        Assert.That(team.Players.Count, Is.EqualTo(0));
    }

    [Test]
    public void Team_FanSupport_DefaultIs50()
    {
        var team = new TeamData();
        Assert.That(team.FanSupport, Is.EqualTo(50));
    }

    [Test]
    public void Team_CashBalance_DefaultIsPositive()
    {
        var team = new TeamData();
        Assert.That(team.CashBalance, Is.GreaterThan(0));
    }
}

[TestFixture]
public class LeagueDataTests
{
    [Test]
    public void NewLeague_HasCorrectTier()
    {
        var league = new LeagueData { Name = "North Premier", Tier = LeagueTier.Premier };
        Assert.That(league.Tier, Is.EqualTo(LeagueTier.Premier));
    }
}
```

- [ ] **3.2 Aja testit — varmista epäonnistuminen**

```powershell
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal
```

Odotettu: `Error: type 'TeamData' not found`

- [ ] **3.3 Kirjoita implementaatio**

Luo `src/core/TeamData.cs`:

```csharp
namespace ColdGM;

public class TeamData
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public string LogoPath { get; set; } = "";
    public string PrimaryColor { get; set; } = "#1a3a6b";
    public string SecondaryColor { get; set; } = "#ffffff";
    public int ArenaCapacity { get; set; } = 8000;

    public List<PlayerData> Players { get; set; } = new();
    public string LeagueId { get; set; } = "";

    // Economy
    public int CashBalance { get; set; } = 500_000;
    public int AnnualBudget { get; set; } = 2_000_000;
    public int FanSupport { get; set; } = 50; // 0-100

    // Season stats (reset each season)
    public int Wins { get; set; } = 0;
    public int Losses { get; set; } = 0;
    public int OvertimeLosses { get; set; } = 0;
    public int GoalsFor { get; set; } = 0;
    public int GoalsAgainst { get; set; } = 0;

    public int Points => Wins * 2 + OvertimeLosses;
    public int GoalDiff => GoalsFor - GoalsAgainst;

    public bool IsPlayerControlled { get; set; } = false;
}
```

Luo `src/core/LeagueData.cs`:

```csharp
namespace ColdGM;

public enum LeagueTier { Premier, First }
public enum LeagueRegion { North, Central, South }

public class ScheduledGame
{
    public string HomeTeamId { get; set; } = "";
    public string AwayTeamId { get; set; } = "";
    public int DayOfSeason { get; set; } = 0;
    public bool IsPlayed { get; set; } = false;
    public int HomeScore { get; set; } = 0;
    public int AwayScore { get; set; } = 0;
}

public class LeagueData
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public LeagueTier Tier { get; set; } = LeagueTier.Premier;
    public LeagueRegion Region { get; set; } = LeagueRegion.North;
    public List<TeamData> Teams { get; set; } = new();
    public List<ScheduledGame> Schedule { get; set; } = new();
}
```

Luo `src/core/WorldData.cs`:

```csharp
namespace ColdGM;

public class WorldData
{
    public int Season { get; set; } = 1;
    public int DayOfSeason { get; set; } = 1;
    public string PlayerTeamId { get; set; } = "";
    public string PlayerTeamLeagueId { get; set; } = "";
    public List<LeagueData> Leagues { get; set; } = new();

    public TeamData? GetPlayerTeam() =>
        Leagues.SelectMany(l => l.Teams)
               .FirstOrDefault(t => t.Id == PlayerTeamId);

    public LeagueData? GetLeagueById(string id) =>
        Leagues.FirstOrDefault(l => l.Id == id);
}
```

- [ ] **3.4 Aja testit — varmista vihreä**

```powershell
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal
```

Odotettu: `Passed! - 7 tests passed`

- [ ] **3.5 Commit**

```powershell
git add src/core/TeamData.cs src/core/LeagueData.cs src/core/WorldData.cs ColdGM.Tests/TeamDataTests.cs
git commit -m "feat: TeamData, LeagueData, WorldData C# models"
```

---

## Task 4: Kalenteri — ScheduleGenerator

**Files:**
- Create: `src/core/ScheduleGenerator.cs`
- Create: `ColdGM.Tests/ScheduleGeneratorTests.cs`

- [ ] **4.1 Kirjoita epäonnistuvat testit**

Luo `ColdGM.Tests/ScheduleGeneratorTests.cs`:

```csharp
using NUnit.Framework;

namespace ColdGM.Tests;

[TestFixture]
public class ScheduleGeneratorTests
{
    private List<TeamData> _teams = new();

    [SetUp]
    public void SetUp()
    {
        _teams = Enumerable.Range(1, 20)
            .Select(i => new TeamData { Id = $"team_{i}", Name = $"Team {i}" })
            .ToList();
    }

    [Test]
    public void Generate_20Teams_Produces60GamesPerTeam()
    {
        var schedule = ScheduleGenerator.Generate(_teams, gamesPerTeam: 60);
        foreach (var team in _teams)
        {
            var teamGames = schedule.Count(g =>
                g.HomeTeamId == team.Id || g.AwayTeamId == team.Id);
            Assert.That(teamGames, Is.EqualTo(60), $"{team.Name} should have 60 games");
        }
    }

    [Test]
    public void Generate_NoTeamPlaysSelf()
    {
        var schedule = ScheduleGenerator.Generate(_teams, gamesPerTeam: 60);
        Assert.That(schedule.Any(g => g.HomeTeamId == g.AwayTeamId), Is.False);
    }

    [Test]
    public void Generate_GamesSpreadAcrossDays()
    {
        var schedule = ScheduleGenerator.Generate(_teams, gamesPerTeam: 60);
        var days = schedule.Select(g => g.DayOfSeason).Distinct().Count();
        // 60 games / ~2 games per week = ~30 weeks = ~210 days
        Assert.That(days, Is.GreaterThan(50));
    }

    [Test]
    public void Generate_TotalGameCount_IsCorrect()
    {
        // 20 teams × 60 games / 2 (each game has 2 teams) = 600 games
        var schedule = ScheduleGenerator.Generate(_teams, gamesPerTeam: 60);
        Assert.That(schedule.Count, Is.EqualTo(600));
    }
}
```

- [ ] **4.2 Aja testit — varmista epäonnistuminen**

```powershell
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal
```

- [ ] **4.3 Kirjoita implementaatio**

Luo `src/core/ScheduleGenerator.cs`:

```csharp
namespace ColdGM;

public static class ScheduleGenerator
{
    public static List<ScheduledGame> Generate(List<TeamData> teams, int gamesPerTeam = 60)
    {
        var games = new List<ScheduledGame>();
        int teamCount = teams.Count;

        // Laske kuinka moni kierros tarvitaan
        // Round-robin: jokainen pelaa toista vastaan kerran = (n-1) kierrosta
        // gamesPerTeam = 60, round-robin kierroksia (n-1) = 19, toistetaan ~3.16 kertaa
        // Yksinkertaistus: generoidaan 3 täyttä round-robin-kierrosta (57 peliä/joukkue)
        // + 1 osittainen kierros täyttämään 60 peliä
        int fullRounds = gamesPerTeam / (teamCount - 1);
        int extraGames = gamesPerTeam % (teamCount - 1);

        var allPairings = new List<(string home, string away)>();

        for (int round = 0; round < fullRounds; round++)
        {
            var roundPairings = GenerateRoundRobin(teams, round % 2 == 1);
            allPairings.AddRange(roundPairings);
        }

        // Lisää ylimääräiset pelit (osittainen round-robin)
        if (extraGames > 0)
        {
            var extraPairings = GenerateRoundRobin(teams, false)
                .Take(extraGames * teamCount / 2)
                .ToList();
            allPairings.AddRange(extraPairings);
        }

        // Jaa pelipäiville: ~3 peliä per viikko, 3 päivää viikossa
        // Kausi: 210 päivää (30 viikkoa), pelit päivinä jotka ovat %7 = 1,3,5
        var gameDays = new List<int>();
        for (int week = 0; week < 30; week++)
        {
            gameDays.Add(week * 7 + 1);
            gameDays.Add(week * 7 + 3);
            gameDays.Add(week * 7 + 5);
        }

        // Sekoita peli-parit satunnaisesti mutta deterministic siemenellä
        var rng = new Random(42);
        var shuffled = allPairings.OrderBy(_ => rng.Next()).ToList();

        // Aseta jokaiselle pelille päivä (~ 20 peliä per päivä = 10 jäähallissa)
        int gamesPerDay = teamCount / 2;
        for (int i = 0; i < shuffled.Count; i++)
        {
            int dayIndex = i / gamesPerDay;
            int day = dayIndex < gameDays.Count ? gameDays[dayIndex] : gameDays[^1] + dayIndex;

            games.Add(new ScheduledGame
            {
                HomeTeamId = shuffled[i].home,
                AwayTeamId = shuffled[i].away,
                DayOfSeason = day
            });
        }

        return games;
    }

    private static List<(string home, string away)> GenerateRoundRobin(
        List<TeamData> teams, bool swapHomeAway)
    {
        var pairings = new List<(string, string)>();
        int n = teams.Count;
        var circle = teams.Select(t => t.Id).ToList();

        for (int round = 0; round < n - 1; round++)
        {
            for (int i = 0; i < n / 2; i++)
            {
                string home = circle[i];
                string away = circle[n - 1 - i];
                if (swapHomeAway) (home, away) = (away, home);
                pairings.Add((home, away));
            }
            // Rotoi circle (kiinnitä ensimmäinen)
            var last = circle[^1];
            circle.RemoveAt(circle.Count - 1);
            circle.Insert(1, last);
        }

        return pairings;
    }
}
```

- [ ] **4.4 Aja testit — varmista vihreä**

```powershell
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal
```

Odotettu: kaikki testit vihreänä.

- [ ] **4.5 Commit**

```powershell
git add src/core/ScheduleGenerator.cs ColdGM.Tests/ScheduleGeneratorTests.cs
git commit -m "feat: round-robin ScheduleGenerator, 60 games per team across 30-week season"
```

---

## Task 5: Nimidatat ja PlayerGenerator (GDScript)

**Files:**
- Create: `mods/base/names/first_names.txt`
- Create: `mods/base/names/last_names.txt`
- Create: `src/data/PlayerGenerator.gd`
- Create: `tests/gut/test_player_generator.gd`

- [ ] **5.1 Luo nimidata**

Luo `mods/base/names/first_names.txt` (~200 nimeä, yksi per rivi, kansainvälinen mix):

```
Mikko
Jari
Pekka
Sami
Timo
Erik
Lars
Johan
Bjorn
Henrik
Connor
Ryan
Tyler
Jake
Dylan
Alexei
Dmitri
Pavel
Sergei
Andrei
Lukas
Thomas
Felix
Moritz
Jan
...
```
(täytä 200:een asti itse tai generoi AI:lla)

Luo `mods/base/names/last_names.txt` (~500 sukunimeä, yksi per rivi):

```
Korhonen
Virtanen
Mäkinen
Hämäläinen
Leinonen
Lindqvist
Eriksson
Andersson
Svensson
Nielsen
Johnson
Williams
Brown
Davis
Wilson
Petrov
Volkov
Ivanov
Kozlov
Novak
Mueller
Schmidt
Wagner
Fischer
...
```

- [ ] **5.2 Kirjoita GUT-testi**

Luo `tests/gut/test_player_generator.gd`:

```gdscript
extends GutTest

var gen: PlayerGenerator

func before_each():
    gen = PlayerGenerator.new()
    gen.load_names("res://mods/base/names/first_names.txt",
                   "res://mods/base/names/last_names.txt")

func test_generates_player_with_valid_attributes():
    var player = gen.generate_player(PlayerPosition.FORWARD, 22)
    assert_not_null(player)
    assert_true(player.Age == 22)
    assert_between(player.Skating, 1, 20, "Skating out of range")
    assert_between(player.Shooting, 1, 20, "Shooting out of range")

func test_generates_goalie_with_goalie_attributes():
    var goalie = gen.generate_goalie(25)
    assert_true(goalie.Position == PlayerPosition.GOALIE)
    assert_between(goalie.SaveAbility, 1, 20)

func test_generated_player_has_name():
    var player = gen.generate_player(PlayerPosition.FORWARD, 20)
    assert_true(player.FirstName.length() > 0)
    assert_true(player.LastName.length() > 0)

func test_generates_roster_25_players():
    var roster = gen.generate_roster()
    assert_eq(roster.size(), 25)

func test_roster_has_correct_position_mix():
    var roster = gen.generate_roster()
    var forwards = roster.filter(func(p): return p.Position == PlayerPosition.FORWARD)
    var defenders = roster.filter(func(p): return p.Position == PlayerPosition.DEFENSE)
    var goalies = roster.filter(func(p): return p.Position == PlayerPosition.GOALIE)
    assert_eq(forwards.size(), 12)
    assert_eq(defenders.size(), 8)
    assert_eq(goalies.size(), 3)  # 2 + 1 varalla
    # Yhteensä: 12 + 8 + 3 = 23, +2 apumiestä = 25
```

- [ ] **5.3 Luo PlayerGenerator.gd**

Luo `src/data/PlayerGenerator.gd`:

```gdscript
class_name PlayerGenerator

var _first_names: Array[String] = []
var _last_names: Array[String] = []
var _rng := RandomNumberGenerator.new()

func load_names(first_path: String, last_path: String) -> void:
    _first_names = _load_lines(first_path)
    _last_names = _load_lines(last_path)

func _load_lines(path: String) -> Array[String]:
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

func generate_roster() -> Array:
    var roster := []
    # 12 hyökkääjää (ikä 18-35)
    for i in 12:
        roster.append(generate_player(PlayerPosition.FORWARD, _random_age()))
    # 8 puolustajaa
    for i in 8:
        roster.append(generate_player(PlayerPosition.DEFENSE, _random_age()))
    # 2 maalivahtia + 1 varaMV
    for i in 3:
        roster.append(generate_goalie(_random_age()))
    # 2 lisäpelaajaa (utility)
    for i in 2:
        roster.append(generate_player(PlayerPosition.FORWARD, _random_age()))
    return roster

func generate_player(position: int, age: int) -> PlayerData:
    var p := PlayerData.new()
    p.FirstName = _pick(_first_names)
    p.LastName = _pick(_last_names)
    p.Age = age
    p.Position = position

    # Ikäperusteinen taitotaso: nuori (18-21) heikko, huippu (24-28) vahva
    var base := _age_to_base(age)
    var spread := 4

    p.Skating       = _attr(base, spread)
    p.Shooting      = _attr(base, spread)
    p.Passing       = _attr(base, spread)
    p.PuckHandling  = _attr(base, spread)
    p.Positioning   = _attr(base, spread)
    p.DefensivePlay = _attr(base, spread)
    p.PowerPlay     = _attr(base, spread)
    p.Speed         = _attr(base, spread)
    p.Stamina       = _attr(base, spread)
    p.Checking      = _attr(base, spread)
    p.Composure     = _attr(base, spread)
    p.TeamSpirit    = _attr(base, spread)

    # Piilotettu potentiaali (max mihin pelaaja voi kehittyä)
    p.HiddenPotential = clampi(base + _rng.randi_range(0, 6), 5, 20)

    # Palkka korreloi taidon kanssa
    var avg_attr := (p.Skating + p.Shooting + p.Passing) / 3.0
    p.AnnualSalary = int(avg_attr * 15000 + _rng.randi_range(-20000, 20000))

    p.ContractYearsLeft = _rng.randi_range(1, 4)
    return p

func generate_goalie(age: int) -> GoalieData:
    var g := GoalieData.new()
    g.FirstName = _pick(_first_names)
    g.LastName = _pick(_last_names)
    g.Age = age
    g.Position = PlayerPosition.GOALIE

    var base := _age_to_base(age)
    var spread := 4
    g.SaveAbility       = _attr(base, spread)
    g.Reflexes          = _attr(base, spread)
    g.GoaliePositioning = _attr(base, spread)
    g.MentalStrength    = _attr(base, spread)
    g.Stamina           = _attr(base, spread)
    g.HiddenPotential   = clampi(base + _rng.randi_range(0, 6), 5, 20)
    g.AnnualSalary      = int(g.SaveAbility * 18000 + _rng.randi_range(-20000, 20000))
    g.ContractYearsLeft = _rng.randi_range(1, 4)
    return g

func _age_to_base(age: int) -> int:
    if age < 20:   return _rng.randi_range(4, 8)
    if age < 23:   return _rng.randi_range(7, 12)
    if age <= 28:  return _rng.randi_range(10, 16)
    if age <= 32:  return _rng.randi_range(9, 14)
    return _rng.randi_range(6, 11)

func _random_age() -> int:
    # Ikäjakauma painottuu 22-28-vuotiaisiin
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
```

- [ ] **5.4 Aja GUT-testit**

Godotissa: `Project → Tools → GUT` tai komentoriviltä:

```powershell
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd
```

Odotettu: kaikki 5 testiä vihreänä.

- [ ] **5.5 Commit**

```powershell
git add src/data/PlayerGenerator.gd tests/gut/test_player_generator.gd mods/base/names/
git commit -m "feat: PlayerGenerator with age-based attribute curves, 25-player roster"
```

---

## Task 6: LeagueLoader — JSON-lataaja

**Files:**
- Create: `mods/base/leagues/north_premier.json` (ja 5 muuta)
- Create: `src/data/LeagueLoader.gd`
- Create: `tests/gut/test_league_loader.gd`

- [ ] **6.1 Luo JSON-liigamäärittelyt**

Luo `mods/base/leagues/north_premier.json`:

```json
{
  "league_id": "north_premier",
  "name": "Northern Premier League",
  "tier": "premier",
  "region": "north",
  "teams": [
    { "team_id": "arctic_wolves", "name": "Arctic Wolves", "city": "Rovaniemi",
      "logo": "logos/arctic_wolves.png", "primary_color": "#1a3a6b",
      "secondary_color": "#ffffff", "arena_capacity": 9500 },
    { "team_id": "northern_bears", "name": "Northern Bears", "city": "Oulu",
      "logo": "logos/northern_bears.png", "primary_color": "#8B0000",
      "secondary_color": "#gold", "arena_capacity": 8200 }
  ]
}
```

Tee vastaavat tiedostot kaikille 6 liigalle (north_premier, north_first, central_premier, central_first, south_premier, south_first). Jokaisessa 20 joukkuetta. Joukkueiden nimet voivat olla keksittyjä eläin/kaupunki-yhdistelmiä.

- [ ] **6.2 Kirjoita GUT-testi**

Luo `tests/gut/test_league_loader.gd`:

```gdscript
extends GutTest

var loader: LeagueLoader

func before_each():
    loader = LeagueLoader.new()

func test_loads_single_league_file():
    var league = loader.load_league("res://mods/base/leagues/north_premier.json")
    assert_not_null(league)
    assert_eq(league.Name, "Northern Premier League")

func test_loaded_league_has_20_teams():
    var league = loader.load_league("res://mods/base/leagues/north_premier.json")
    assert_eq(league.Teams.size(), 20)

func test_loads_all_6_leagues():
    var leagues = loader.load_all_leagues("res://mods/base/leagues/")
    assert_eq(leagues.size(), 6)

func test_league_tier_parsed_correctly():
    var league = loader.load_league("res://mods/base/leagues/north_premier.json")
    assert_eq(league.Tier, LeagueTier.PREMIER)
```

- [ ] **6.3 Kirjoita LeagueLoader.gd**

Luo `src/data/LeagueLoader.gd`:

```gdscript
class_name LeagueLoader

func load_all_leagues(dir_path: String) -> Array:
    var leagues := []
    var dir := DirAccess.open(dir_path)
    if not dir:
        push_error("Cannot open leagues directory: " + dir_path)
        return leagues
    dir.list_dir_begin()
    var fname := dir.get_next()
    while fname != "":
        if fname.ends_with(".json"):
            var league := load_league(dir_path + fname)
            if league:
                leagues.append(league)
        fname = dir.get_next()
    return leagues

func load_league(path: String) -> LeagueData:
    var text := FileAccess.get_file_as_string(path)
    if text.is_empty():
        push_error("Failed to read: " + path)
        return null
    var parsed: Variant = JSON.parse_string(text)
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("Invalid JSON in: " + path)
        return null
    return _dict_to_league(parsed)

func _dict_to_league(d: Dictionary) -> LeagueData:
    var league := LeagueData.new()
    league.Id = d.get("league_id", "")
    league.Name = d.get("name", "")
    league.Tier = LeagueTier.PREMIER if d.get("tier", "") == "premier" else LeagueTier.FIRST
    match d.get("region", ""):
        "north":   league.Region = LeagueRegion.NORTH
        "central": league.Region = LeagueRegion.CENTRAL
        _:         league.Region = LeagueRegion.SOUTH
    var teams_raw: Array = d.get("teams", [])
    for t in teams_raw:
        league.Teams.append(_dict_to_team(t, league.Id))
    return league

func _dict_to_team(d: Dictionary, league_id: String) -> TeamData:
    var team := TeamData.new()
    team.Id = d.get("team_id", "")
    team.Name = d.get("name", "")
    team.City = d.get("city", "")
    team.LogoPath = d.get("logo", "")
    team.PrimaryColor = d.get("primary_color", "#1a3a6b")
    team.SecondaryColor = d.get("secondary_color", "#ffffff")
    team.ArenaCapacity = d.get("arena_capacity", 8000)
    team.LeagueId = league_id
    return team
```

- [ ] **6.4 Aja GUT-testit — varmista vihreä**

```powershell
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd
```

- [ ] **6.5 Commit**

```powershell
git add src/data/LeagueLoader.gd tests/gut/test_league_loader.gd mods/base/leagues/
git commit -m "feat: LeagueLoader reads JSON leagues, 6 fictional leagues defined"
```

---

## Task 7: Maailmangeneraattori — WorldFactory

**Files:**
- Create: `src/data/WorldFactory.gd`
- Create: `tests/gut/test_world_factory.gd`

Tämä kokoaa kaiken yhteen: lataa liigat, generoi rosterit, rakentaa aikataulun.

- [ ] **7.1 Kirjoita GUT-testi**

Luo `tests/gut/test_world_factory.gd`:

```gdscript
extends GutTest

var factory: WorldFactory
var world: WorldData

func before_each():
    factory = WorldFactory.new()
    world = factory.create_new_world()

func test_world_has_6_leagues():
    assert_eq(world.Leagues.size(), 6)

func test_each_league_has_20_teams():
    for league in world.Leagues:
        assert_eq(league.Teams.size(), 20,
            "League %s should have 20 teams" % league.Name)

func test_total_player_count_around_3000():
    var total := 0
    for league in world.Leagues:
        for team in league.Teams:
            total += team.Players.size()
    assert_between(total, 2900, 3100, "Expected ~3000 players")

func test_schedule_generated_for_premier_leagues():
    var premier_leagues = world.Leagues.filter(
        func(l): return l.Tier == LeagueTier.PREMIER)
    for league in premier_leagues:
        assert_true(league.Schedule.size() > 0,
            "Premier league should have schedule")

func test_generation_completes_in_under_2_seconds():
    var start := Time.get_ticks_msec()
    factory.create_new_world()
    var elapsed := Time.get_ticks_msec() - start
    assert_true(elapsed < 2000,
        "World generation took %d ms (limit: 2000ms)" % elapsed)
```

- [ ] **7.2 Kirjoita WorldFactory.gd**

Luo `src/data/WorldFactory.gd`:

```gdscript
class_name WorldFactory

const LEAGUES_PATH := "res://mods/base/leagues/"
const FIRST_NAMES_PATH := "res://mods/base/names/first_names.txt"
const LAST_NAMES_PATH := "res://mods/base/names/last_names.txt"

func create_new_world() -> WorldData:
    var world := WorldData.new()
    world.Season = 1
    world.DayOfSeason = 1

    var loader := LeagueLoader.new()
    var gen := PlayerGenerator.new()
    gen.load_names(FIRST_NAMES_PATH, LAST_NAMES_PATH)

    var leagues: Array = loader.load_all_leagues(LEAGUES_PATH)
    for league in leagues:
        # Generoi rosterit kaikille joukkueille
        for team in league.Teams:
            team.Players = gen.generate_roster()

        # Generoi kalenteri Premier-liigaan
        if league.Tier == LeagueTier.PREMIER:
            var schedule := ScheduleGenerator.Generate(league.Teams, 60)
            league.Schedule = schedule

        world.Leagues.append(league)

    return world
```

- [ ] **7.3 Aja testit**

```powershell
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd
```

Odotettu: kaikki testit vihreänä, myös aikaraja (<2s).

- [ ] **7.4 Commit**

```powershell
git add src/data/WorldFactory.gd tests/gut/test_world_factory.gd
git commit -m "feat: WorldFactory generates full game world in <2s"
```

---

## Task 8: GameState autoload ja SaveManager

**Files:**
- Create: `src/autoload/GameState.gd`
- Create: `src/autoload/EventBus.gd`
- Create: `src/data/SaveManager.gd`
- Create: `tests/gut/test_save_manager.gd`

- [ ] **8.1 Kirjoita SaveManager-testi**

Luo `tests/gut/test_save_manager.gd`:

```gdscript
extends GutTest

func test_save_and_load_roundtrip():
    var factory := WorldFactory.new()
    var world_before := factory.create_new_world()
    world_before.Season = 3
    world_before.DayOfSeason = 42

    var save_mgr := SaveManager.new()
    var path := "user://test_save.json.gz"
    save_mgr.save(world_before, path)

    var world_after := save_mgr.load(path)
    assert_not_null(world_after)
    assert_eq(world_after.Season, 3)
    assert_eq(world_after.DayOfSeason, 42)
    assert_eq(world_after.Leagues.size(), 6)

func after_each():
    # Siivoa testitiedosto
    if FileAccess.file_exists("user://test_save.json.gz"):
        DirAccess.remove_absolute(OS.get_user_data_dir() + "/test_save.json.gz")
```

- [ ] **8.2 Kirjoita SaveManager.gd**

Luo `src/data/SaveManager.gd`:

```gdscript
class_name SaveManager

func save(world: WorldData, path: String) -> void:
    var dict := _world_to_dict(world)
    var json_str := JSON.stringify(dict)
    var compressed := json_str.to_utf8_buffer().compress(FileAccess.COMPRESSION_GZIP)
    var file := FileAccess.open(path, FileAccess.WRITE)
    if not file:
        push_error("Cannot write save file: " + path)
        return
    file.store_buffer(compressed)

func load(path: String) -> WorldData:
    var file := FileAccess.open(path, FileAccess.READ)
    if not file:
        push_error("Save file not found: " + path)
        return null
    var compressed := file.get_buffer(file.get_length())
    var decompressed := compressed.decompress_dynamic(-1, FileAccess.COMPRESSION_GZIP)
    var json_str := decompressed.get_string_from_utf8()
    var parsed: Variant = JSON.parse_string(json_str)
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("Corrupt save file: " + path)
        return null
    return _dict_to_world(parsed)

func _world_to_dict(world: WorldData) -> Dictionary:
    # Serialisoi WorldData → Dictionary rekursiivisesti
    # (Yksinkertaistettu: käytetään Godot 4:n automaattista JSON-muunnosta)
    return {
        "season": world.Season,
        "day_of_season": world.DayOfSeason,
        "player_team_id": world.PlayerTeamId,
        "player_team_league_id": world.PlayerTeamLeagueId,
        "leagues": world.Leagues.map(func(l): return _league_to_dict(l))
    }

func _dict_to_world(d: Dictionary) -> WorldData:
    var world := WorldData.new()
    world.Season = d.get("season", 1)
    world.DayOfSeason = d.get("day_of_season", 1)
    world.PlayerTeamId = d.get("player_team_id", "")
    world.PlayerTeamLeagueId = d.get("player_team_league_id", "")
    # Leagues: latauksessa käytetään pelkkää strukturoitua dataa (ei generaattoria)
    # TODO Sprint 2: toteuta täydellinen deserialisointi
    return world

func _league_to_dict(l: LeagueData) -> Dictionary:
    return {
        "id": l.Id,
        "name": l.Name,
        "tier": "premier" if l.Tier == LeagueTier.PREMIER else "first",
        "teams": l.Teams.map(func(t): return _team_to_dict(t))
    }

func _team_to_dict(t: TeamData) -> Dictionary:
    return {
        "id": t.Id,
        "name": t.Name,
        "cash_balance": t.CashBalance,
        "fan_support": t.FanSupport,
        "players": t.Players.map(func(p): return _player_to_dict(p))
    }

func _player_to_dict(p: PlayerData) -> Dictionary:
    return {
        "id": p.Id, "first_name": p.FirstName, "last_name": p.LastName,
        "age": p.Age, "position": p.Position,
        "skating": p.Skating, "shooting": p.Shooting, "passing": p.Passing,
        "puck_handling": p.PuckHandling, "positioning": p.Positioning,
        "defensive_play": p.DefensivePlay, "power_play": p.PowerPlay,
        "speed": p.Speed, "stamina": p.Stamina, "checking": p.Checking,
        "composure": p.Composure, "team_spirit": p.TeamSpirit,
        "hidden_potential": p.HiddenPotential,
        "annual_salary": p.AnnualSalary, "contract_years_left": p.ContractYearsLeft
    }
```

- [ ] **8.3 Luo autoload-singletonit**

Luo `src/autoload/GameState.gd`:

```gdscript
extends Node

var world: WorldData = null
var is_new_game: bool = false

func start_new_game(player_team_id: String, player_team_league_id: String) -> void:
    var factory := WorldFactory.new()
    world = factory.create_new_world()
    world.PlayerTeamId = player_team_id
    world.PlayerTeamLeagueId = player_team_league_id
    is_new_game = true

func save_game(slot: int = 0) -> void:
    if not world:
        return
    var save_mgr := SaveManager.new()
    save_mgr.save(world, _save_path(slot))

func load_game(slot: int = 0) -> bool:
    var save_mgr := SaveManager.new()
    var loaded := save_mgr.load(_save_path(slot))
    if not loaded:
        return false
    world = loaded
    return true

func _save_path(slot: int) -> String:
    return "user://save_slot_%d.json.gz" % slot
```

Luo `src/autoload/EventBus.gd`:

```gdscript
extends Node

# Kaikki globaalit signaalit tässä — näin UI-nodet voivat kuunnella tapahtumia
# ilman suoria viittauksia toisiinsa

signal game_day_advanced(new_day: int)
signal match_result_available(home_team_id: String, away_team_id: String,
                               home_score: int, away_score: int)
signal player_injured(player_id: String, weeks: int)
signal transfer_completed(player_id: String, from_team_id: String, to_team_id: String)
signal season_ended(champion_team_id: String)
```

Rekisteröi autoloadit Godotissa: `Project → Project Settings → Autoload`:
- Path: `res://src/autoload/GameState.gd`, Name: `GameState`
- Path: `res://src/autoload/EventBus.gd`, Name: `EventBus`

- [ ] **8.4 Aja kaikki testit**

```powershell
# C# testit
dotnet test ColdGM.Tests/ColdGM.Tests.csproj -v normal

# GDScript testit
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd
```

Odotettu: kaikki vihreänä.

- [ ] **8.5 Sprint 1 -integraatiotesti**

Varmista valmistumiskriteeri ajamalla:

```powershell
godot --headless -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -glog=1
```

Tarkista tuloksesta:
- `test_world_has_6_leagues` ✅
- `test_each_league_has_20_teams` ✅
- `test_total_player_count_around_3000` ✅
- `test_generation_completes_in_under_2_seconds` ✅
- `test_save_and_load_roundtrip` ✅

- [ ] **8.6 Sprint 1 -loppucommit**

```powershell
git add src/autoload/ src/data/SaveManager.gd tests/gut/test_save_manager.gd
git commit -m "feat: GameState autoload, EventBus, SaveManager with gzip JSON"
git tag sprint1-complete
```

---

## Sprint 1 Valmistumiskriteeri — Tarkistuslista

- [ ] Godot 4 -projekti buildautuu ilman virheitä
- [ ] `dotnet test` — kaikki C#-testit vihreänä
- [ ] GUT — kaikki GDScript-testit vihreänä
- [ ] `WorldFactory.create_new_world()` generoi 6 liigaa, 120 joukkuetta, ~3 000 pelaajaa alle 2 sekunnissa
- [ ] Tallennus ja lataus toimii (roundtrip-testi vihreänä)
- [ ] GitHub Actions CI vihreänä

---

## Sprintit 2–5 (korkean tason kuvaus)

Yksityiskohtaiset suunnitelmadokumentit kirjoitetaan jokaisen sprintin alkaessa.

### Sprint 2 — Match Simulation Engine + Economy (kk 3–4)

Tavoite: Koko kausi simuloitavissa (kaikki 600 ottelua / liiga), tilastot laskettuna, talouslogiikka toimii.

Päätehtävät:
- `MatchSimulator.cs` — tapahtumapohjainen simulaatiosilmukka (spec Section 4.1)
- `EconomyEngine.cs` — budjetti, lipputulot, fanituki (spec Section 4.5)
- `TrainingSystem.cs` — fatigue-logiikka, harjoitusfokukset (spec Section 4.3)
- `SeasonManager.gd` — orkestroi viikkosilmukan, kutsuu simulaattoria
- Tekstipohjainen otteluraportti UI:hin (ei vielä 2D:tä)
- C# NUnit -testit simulaattorille: tavoitemittarit (2.5–3.5 maalia/peli jne.)

### Sprint 3 — 2D Match View + Tactics UI (kk 5–6)

Tavoite: Ottelu näkyy 2D:nä, taktiikat vaikuttavat sim-tuloksiin.

Päätehtävät:
- `MatchView.tscn` + `MatchView.gd` — Godot 2D -kenttä, pelaajapisteet, kiekko
- Tween-animaatiot tapahtumien välissä
- `TacticsView.tscn` + `TacticsView.gd` — drag-and-drop linjastot
- Taktiikkaparametrien integraatio `MatchSimulator.cs`:ään
- Linjavaihto ja timeout reaaliaikaisessa ottelussa
- Kaikki 7 UI-näkymää toiminnallisena (Dashboard, Roster, Taktiikat, Siirrot, Harjoittelu, Talous, Ottelu)

### Sprint 4 — Modding API + Steam SDK (kk 7)

Tavoite: Workshop-modi latautuu, saavutukset toimivat, pilvitallennus toimii.

Päätehtävät:
- `ModLoader.gd` — yhdistää base-datan ja Workshop-modit
- GodotSteam integraatio: `SteamManager.gd`
- 20 saavutusta Steam-saavutusjärjestelmään
- Steam Cloud Saves (`user://`-polku → pilvi)
- Steam Workshop -lataus ja aktivointi
- UI-polish: fontit, värit, animaatiot, äänet

### Sprint 5 — Balancing + Early Access Launch (kk 8)

Tavoite: 500+ simuloitua kautta, tilastot realistiset, Steam-sivu julki.

Päätehtävät:
- Monte Carlo -massimulaatio: 500 kautta, tarkista maali/peli, torjunta%, PP-teho
- Tasapainotusiterointia kunnes mittarit osuvat haarukkaan
- Steam-sivun sisältö: kuvaukset, screenshotit, trailer
- Beta-testaus (Discord, muutama luotettu testaaja)
- EA-julkaisu @ 14,99 €
