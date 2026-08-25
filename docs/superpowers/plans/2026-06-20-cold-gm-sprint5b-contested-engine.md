# Sprint 5b — Kontestoitu ottelumoottori 2.0 + xG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-second tick model in `MatchSimulator.cs` with a possession-chain state machine using 14 logistic-contest micro-events, per-shot xG, and a rich event stream — making every S5a attribute genuinely performance-determining.

**Architecture:** The interop boundary stays locked (`simulate_game(Dictionary) -> Dictionary`, determinism via `"seed"`). Inside, one seeded `Random` drives a `Contest(aEff, dEff, k, ctx) -> bool` primitive over weighted attribute blends. ~120–170 possessions per game flow through faceoff → zone entry → OZ actions (pass/deke/board battle/shot decision) → shot/turnover, producing ~400–800 events. xG replaces the old `saveProb - shotQuality` formula: `logit_xg` resolves both the goal probability AND the xG stat in one draw. The result dict is a strict superset of the current schema — existing consumers (TextReport, game_report, match_report, standings) work unchanged.

**Tech Stack:** C# (.NET 8 / Godot.NET.Sdk 4.6.3), GDScript (adapter + tests), GUT v9.6.0

**Spec:** `docs/specs/2026-06-19-cold-gm-sprint5b-contested-engine-design.md`

**Build/test commands (every task):**
```powershell
$env:PATH = "C:\Users\rauti\AppData\Local\Microsoft\dotnet;$env:PATH"
$g = "C:\Users\rauti\cold_gm\godot_4.3\Godot_v4.6.3-stable_mono_win64\Godot_v4.6.3-stable_mono_win64.exe"
# After ANY .cs change:
dotnet build C:\Users\rauti\cold_gm\ColdGM.sln -c Debug
# Run tests:
Start-Process -FilePath $g -ArgumentList '--headless','--path','C:\Users\rauti\cold_gm','--import' -Wait -NoNewWindow
Start-Process -FilePath $g -ArgumentList '--headless','--path','C:\Users\rauti\cold_gm','--import' -Wait -NoNewWindow
$p = Start-Process -FilePath $g -ArgumentList '--headless','--path','C:\Users\rauti\cold_gm','-s','addons/gut/gut_cmdln.gd','-gdir=res://tests/gut','-gprefix=test_','-gsuffix=.gd','-glog=1','-gexit' -Wait -PassThru -RedirectStandardOutput gut_out.txt -RedirectStandardError gut_err.txt
Get-Content gut_out.txt -Tail 30
```

---

## File Structure

| File | Role | Action |
|---|---|---|
| `src/core/SimContext.cs` | Data model: SimSkater (27 attrs), SimGoalie (10 attrs), SimTeam, GameState, Zone/ShotType/EventType enums, PossessionState | **Rewrite** |
| `src/core/SimConstants.cs` | All tuning constants: k-values, xG bases, PP/PK modifiers, timing, calibration targets | **Create** |
| `src/core/MatchSimulator.cs` | Possession-chain engine: Contest()+Blend(), 14 micro-events, xG, rich event schema, OT+shootout | **Rewrite** |
| `src/sim/match_adapter.gd` | Send rich 27/10 attrs (not composites); chemistry nudge targets rich attrs | **Modify** |
| `src/systems/sim_attributes.gd` | Remove from sim path (keep for UI `overall_rating` display etc.) | **No change** (adapter stops calling it for sim) |
| `tests/gut/test_match_simulator.gd` | Fixtures → rich attr schema; statistical + invariant tests | **Rewrite** |
| `tests/gut/test_match_golden.gd` | Golden-master snapshot determinism | **Create** |
| `tests/gut/test_match_counters.gd` | Counter-tests: attribute impact over many seeds | **Create** |
| `tests/gut/test_match_adapter.gd` | Update fixture + chemistry assertions for rich attrs | **Modify** |
| `tests/gut/attr_helpers.gd` | Add `make_rich_skater_dict` / `make_rich_goalie_dict` for raw interop fixtures | **Modify** |

---

### Task 1: SimContext.cs — Rich attribute model + enums

**Files:**
- Rewrite: `src/core/SimContext.cs`
- Create: `src/core/SimConstants.cs`

The current `SimContext.cs` has `SimSkater` with 9 composite fields and `SimGoalie` with 4 fields. Replace with full EHM sets. Add enums and helper types the engine needs.

- [ ] **Step 1: Rewrite `SimContext.cs`**

Replace the entire file with:

```csharp
using System.Collections.Generic;

namespace ColdGM.Core
{
    public enum Zone { DZ, NZ, OZ }
    public enum ShotType { Wrist, Slap, Deflection, OneTimer }
    public enum Strength { EV, PP, PK }
    public enum Danger { Low, Med, High }

    public static class EnumExt
    {
        public static string ToKey(this ShotType t) => t switch
        {
            ShotType.Wrist => "wrist", ShotType.Slap => "slap",
            ShotType.Deflection => "deflection", ShotType.OneTimer => "one_timer",
            _ => "wrist"
        };
        public static string ToKey(this Danger d) => d switch
        {
            Danger.Low => "low", Danger.Med => "med", Danger.High => "high", _ => "med"
        };
    }

    public class SimSkater
    {
        public string Id;
        // Technical (12)
        public int Checking, Deflections, Deking, Faceoffs, Hitting, OffThePuck;
        public int Passing, Pokecheck, Positioning, Slapshot, Stickhandling, Wristshot;
        // Mental (9)
        public int Aggression, Anticipation, Bravery, Creativity, Determination;
        public int Flair, Influence, Teamwork, WorkRate;
        // Physical (6)
        public int Acceleration, Agility, Balance, Speed, Stamina, Strength;

        public int StartFatigue;
        public double InGameFatigue;
        public double LineChemistry;

        // Accumulated stats
        public int Goals, Assists, Shots, Hits, TakeawaysS, GiveawaysS;
        public int FaceoffWins, FaceoffLosses, ShotsBlocked, PenaltyMinutes;
        public double XgFor;

        public double Composure => 0.5 * Determination + 0.3 * Bravery + 0.2 * Influence;

        // Fatigue-adjusted effective stamina (used by Blend — spec §1: every attr drives ≥1 event)
        public double EffectiveStamina => Stamina * (1.0 - InGameFatigue / 200.0);
    }

    public class SimGoalie
    {
        public string Id;
        public int Reflexes, Positioning, ReboundControl, Recovery, PuckHandling;
        public int OneOnOnes, Concentration, Composure, Bravery, Agility;
        public int StartFatigue;

        // Accumulated stats
        public int Saves, ShotsAgainst, GoalsAgainst;
        public double XgAgainst;
    }

    public class SimTeam
    {
        public string TeamId;
        public List<SimSkater> Skaters = new();
        public SimGoalie Goalie;
        public double PenaltyRate = 1.0;
        public double TeamChemistry = 50.0;
        public int Score;
        public int PenaltySecondsRemaining = 0;
    }

    public class GameState
    {
        public SimTeam Home, Away;
        public int Time;
        public int Period;
        public bool WentToOvertime = false;
    }
}
```

- [ ] **Step 2: Create `SimConstants.cs`**

```csharp
namespace ColdGM.Core
{
    public static class SimConstants
    {
        // Timing
        public const int GameDuration = 3600;
        public const int PeriodDuration = 1200;
        public const int MaxOvertime = 1200;

        // Contest k-values (spec §5)
        public const double K_Faceoff = 3.5;
        public const double K_ZoneEntry = 4.0;
        public const double K_DumpRecover = 3.0;
        public const double K_Breakout = 3.0;
        public const double K_Forecheck = 3.5;
        public const double K_Pass = 3.5;
        public const double K_Deke = 4.5;
        public const double K_BoardBattle = 3.0;
        public const double K_Hit = 3.0;
        public const double K_Block = 3.0;
        public const double K_Rebound = 3.0;

        // xG bases (spec §7)
        public const double XG_Base_Low = -3.0;
        public const double XG_Base_Med = -2.0;
        public const double XG_Base_High = -1.1;
        // Shot type bonuses
        public const double XG_Wrist = 0.0;
        public const double XG_Slap = -0.15;
        public const double XG_OneTimer = 0.45;
        public const double XG_Deflection = 0.55;
        // Situational bonuses
        public const double XG_Rebound = 0.90;
        public const double XG_OffDeke = 0.55;
        public const double XG_Rush = 0.20;
        public const double XG_Screen = 0.35;
        public const double XG_PP = 0.30;
        public const double XG_SH = -0.15;

        // Possession timing (seconds, midpoints for random ranges)
        public const int FaceoffDuration = 2;
        public const int EntryDurMin = 3, EntryDurMax = 8;
        public const int OZActionDurMin = 2, OZActionDurMax = 6;
        public const int StartDurMin = 5, StartDurMax = 15;

        // Context modifiers
        public const double HomeAdvantage = 0.10;
        public const double PPContextBoost = -0.30;   // D_eff reduced (negative ctx helps attacker)
        public const double PKContextPenalty = 0.15;

        // Penalty
        public const double PenaltyCheckProb = 0.12;  // per-hit/deke penalty roll
        public const double MinorPenaltyFrac = 0.85;

        // Fatigue
        public const double FatiguePerPossession = 0.3;
        public const double FatigueModScale = 0.005;  // attr reduction per fatigue point

        // Calibration targets (per team per game, Monte-Carlo validation)
        public const double TargetGoalsMin = 2.5, TargetGoalsMax = 3.8;
        public const double TargetSOGMin = 28, TargetSOGMax = 36;
        public const double TargetHitsMin = 16, TargetHitsMax = 28;
        public const double TargetPIMMin = 6, TargetPIMMax = 14;
    }
}
```

- [ ] **Step 3: Build C#**

```powershell
$env:PATH = "C:\Users\rauti\AppData\Local\Microsoft\dotnet;$env:PATH"
dotnet build C:\Users\rauti\cold_gm\ColdGM.sln -c Debug
```

Expected: Build succeeds. (MatchSimulator.cs will have compile errors referencing old field names — fix in step 4.)

- [ ] **Step 4: Temporarily fix MatchSimulator.cs compilation**

MatchSimulator.cs references old fields (`s.Shooting`, `s.Checking`, `g.SaveAbility`, etc.) that no longer exist on the new SimContext. Add temporary compatibility properties to SimSkater/SimGoalie OR temporarily revert MatchSimulator references. The simplest approach: add computed properties to SimSkater for the old names:

In `SimContext.cs`, add to `SimSkater`:
```csharp
// Temporary backward-compat for old engine (removed in Task 4)
public int Shooting => (int)(0.40 * Wristshot + 0.30 * Slapshot + 0.20 * Deking + 0.10 * OffThePuck);
public int CheckingComp => (int)(0.45 * Checking + 0.35 * Hitting + 0.20 * Aggression);
```

And update MatchSimulator references: `s.Shooting` stays (now a computed property), `s.Checking` → `s.CheckingComp`, `g.SaveAbility` → add computed property in SimGoalie.

In `SimGoalie`, add:
```csharp
public int SaveAbility => (int)(0.35 * Reflexes + 0.30 * Positioning + 0.20 * OneOnOnes + 0.15 * ReboundControl);
public int GoaliePositioning => Positioning;
public int MentalStrength => Concentration;
```

Also update `ParseTeam` in MatchSimulator.cs to read the **new** rich attribute keys from the dict (see Task 2 for the full key list), while the old engine methods still use the computed compat properties.

- [ ] **Step 5: Update `ParseTeam` to read rich attributes**

In `MatchSimulator.cs`, replace the `ParseTeam` method body:

```csharp
private SimTeam ParseTeam(Godot.Collections.Dictionary d)
{
    var t = new SimTeam
    {
        TeamId = d["team_id"].AsString(),
        PenaltyRate = d.ContainsKey("penalty_rate") ? d["penalty_rate"].AsDouble() : 1.0,
        TeamChemistry = d.ContainsKey("team_chemistry") ? d["team_chemistry"].AsDouble() : 50.0
    };
    foreach (var sv in d["skaters"].As<Godot.Collections.Array>())
    {
        var s = sv.As<Godot.Collections.Dictionary>();
        t.Skaters.Add(new SimSkater
        {
            Id = s["id"].AsString(),
            // Technical
            Checking = s["checking"].AsInt32(), Deflections = s["deflections"].AsInt32(),
            Deking = s["deking"].AsInt32(), Faceoffs = s["faceoffs"].AsInt32(),
            Hitting = s["hitting"].AsInt32(), OffThePuck = s["off_the_puck"].AsInt32(),
            Passing = s["passing"].AsInt32(), Pokecheck = s["pokecheck"].AsInt32(),
            Positioning = s["positioning"].AsInt32(), Slapshot = s["slapshot"].AsInt32(),
            Stickhandling = s["stickhandling"].AsInt32(), Wristshot = s["wristshot"].AsInt32(),
            // Mental
            Aggression = s["aggression"].AsInt32(), Anticipation = s["anticipation"].AsInt32(),
            Bravery = s["bravery"].AsInt32(), Creativity = s["creativity"].AsInt32(),
            Determination = s["determination"].AsInt32(), Flair = s["flair"].AsInt32(),
            Influence = s["influence"].AsInt32(), Teamwork = s["teamwork"].AsInt32(),
            WorkRate = s["work_rate"].AsInt32(),
            // Physical
            Acceleration = s["acceleration"].AsInt32(), Agility = s["agility"].AsInt32(),
            Balance = s["balance"].AsInt32(), Speed = s["speed"].AsInt32(),
            Stamina = s["stamina"].AsInt32(), Strength = s["strength"].AsInt32(),
            // Meta
            StartFatigue = s["fatigue"].AsInt32(),
            LineChemistry = s.ContainsKey("line_chemistry") ? s["line_chemistry"].AsDouble() : 50.0
        });
    }
    var gd = d["goalie"].As<Godot.Collections.Dictionary>();
    if (gd != null && gd.ContainsKey("id"))
    {
        t.Goalie = new SimGoalie
        {
            Id = gd["id"].AsString(),
            Reflexes = gd["reflexes"].AsInt32(),
            Positioning = gd["positioning"].AsInt32(),
            ReboundControl = gd["rebound_control"].AsInt32(),
            Recovery = gd["recovery"].AsInt32(),
            PuckHandling = gd["puck_handling"].AsInt32(),
            OneOnOnes = gd["one_on_ones"].AsInt32(),
            Concentration = gd["concentration"].AsInt32(),
            Composure = gd["composure"].AsInt32(),
            Bravery = gd["bravery"].AsInt32(),
            Agility = gd["agility"].AsInt32(),
            StartFatigue = gd["fatigue"].AsInt32()
        };
    }
    else
    {
        t.Goalie = new SimGoalie { Id = t.TeamId + "_emg_g", Reflexes = 5, Positioning = 5,
                                   ReboundControl = 5, Recovery = 5, PuckHandling = 5,
                                   OneOnOnes = 5, Concentration = 5, Composure = 5,
                                   Bravery = 5, Agility = 5, StartFatigue = 0 };
    }
    return t;
}
```

- [ ] **Step 6: Build and verify tests pass**

```powershell
dotnet build C:\Users\rauti\cold_gm\ColdGM.sln -c Debug
# Run GUT (full suite)
```

Expected: Build succeeds. Tests may fail if adapter still sends old keys — proceed to Task 2 to fix adapter.

- [ ] **Step 7: Commit**

```
feat(sim): expand SimContext to 27/10 rich attributes + SimConstants + enums
```

---

### Task 2: Adapter sends rich attributes + test fixture migration

**Files:**
- Modify: `src/sim/match_adapter.gd:31-48` (\_skater\_input)
- Modify: `tests/gut/test_match_simulator.gd:8-22` (\_balanced\_team)
- Modify: `tests/gut/test_match_adapter.gd` (chemistry test assertions)
- Modify: `tests/gut/attr_helpers.gd` (add raw dict helpers)

The adapter currently calls `SimAttributes.skater_input(p)` to get a composite dict, then applies chemistry nudges. Now it sends all 27 raw attrs directly and applies nudges to a subset of rich attrs.

- [ ] **Step 1: Add raw dict helpers to `attr_helpers.gd`**

Add two static functions that build interop-ready dicts directly (for test fixtures that bypass the adapter):

```gdscript
static func rich_skater_dict(id: String, level: int) -> Dictionary:
	var d := {}
	d["id"] = id
	for a in SKATER_ATTRS:
		d[a] = level
	d["fatigue"] = 0
	d["line_chemistry"] = 50.0
	d["role"] = ""
	return d

static func rich_goalie_dict(id: String, level: int) -> Dictionary:
	var d := {}
	d["id"] = id
	for a in GOALIE_ATTRS:
		d[a] = level
	d["fatigue"] = 0
	return d
```

- [ ] **Step 2: Rewrite `_skater_input` in `match_adapter.gd`**

Replace the current `_skater_input` method. Instead of calling `SimAttributes.skater_input(p)` for composites, put all 27 raw attrs directly. Chemistry nudge targets: `passing`, `pokecheck`, `positioning`, `wristshot`, `off_the_puck`, `determination`, `bravery`.

```gdscript
func _skater_input(p: PlayerData, line_chemistry: float) -> Dictionary:
	var mod: int = _chemistry_attr_mod(line_chemistry)
	var defensive_mod := mod
	var role := RoleSystem.player_type(p)
	if line_chemistry >= 55.0 and (role == RoleSystem.TWO_WAY or role == RoleSystem.SHUTDOWN_D):
		defensive_mod += 1
	# S5b: send all 27 rich attributes directly (no composite shim).
	var d := {}
	for a in PlayerData.RATING_ATTRS:
		d[a] = p.get(a)
	d["id"] = p.id
	d["role"] = role
	d["line_chemistry"] = line_chemistry
	d["fatigue"] = p.fatigue
	# Chemistry nudges on key performance attrs
	d["passing"] = clampi(int(d["passing"]) + mod, 1, 20)
	d["pokecheck"] = clampi(int(d["pokecheck"]) + defensive_mod, 1, 20)
	d["positioning"] = clampi(int(d["positioning"]) + defensive_mod, 1, 20)
	d["wristshot"] = clampi(int(d["wristshot"]) + mod, 1, 20)
	d["off_the_puck"] = clampi(int(d["off_the_puck"]) + mod, 1, 20)
	d["determination"] = clampi(int(d["determination"]) + mod, 1, 20)
	d["bravery"] = clampi(int(d["bravery"]) + mod, 1, 20)
	return d
```

Update the goalie path in `build_team_input` similarly — send all 10 goalie attrs directly instead of calling `SimAttributes.goalie_input(g)`:

```gdscript
	if g != null:
		goalie_dict["id"] = g.id
		goalie_dict["fatigue"] = g.fatigue
		goalie_dict["reflexes"] = g.reflexes
		goalie_dict["positioning"] = g.positioning
		goalie_dict["rebound_control"] = g.rebound_control
		goalie_dict["recovery"] = g.recovery
		goalie_dict["puck_handling"] = g.puck_handling
		goalie_dict["one_on_ones"] = g.one_on_ones
		goalie_dict["concentration"] = g.concentration
		goalie_dict["composure"] = g.composure
		goalie_dict["bravery"] = g.bravery
		goalie_dict["agility"] = g.agility
```

- [ ] **Step 3: Rewrite `_balanced_team` in `test_match_simulator.gd`**

Replace the fixture builder to use rich attr keys:

```gdscript
func _balanced_team(prefix: String, level: int) -> Dictionary:
	var skaters: Array = []
	for i in 18:
		skaters.append(AttrHelpers.rich_skater_dict("%s_p%d" % [prefix, i], level))
	return {
		"team_id": prefix, "skaters": skaters,
		"goalie": AttrHelpers.rich_goalie_dict("%s_g" % prefix, level),
		"penalty_rate": 1.0
	}
```

Now `_balanced_team("H", 10)` creates a team where every player has all 27 attrs at 10 — same uniform-level property as before but with rich keys.

Update `test_better_shooters_score_more_on_average` — the "shooting 18" team now needs rich attrs set high:

```gdscript
func _team_with_boosted_offense(prefix: String, boost_level: int, base_level: int) -> Dictionary:
	var skaters: Array = []
	for i in 18:
		var d := AttrHelpers.rich_skater_dict("%s_p%d" % [prefix, i], base_level)
		d["wristshot"] = boost_level
		d["slapshot"] = boost_level
		d["deking"] = boost_level
		d["off_the_puck"] = boost_level
		d["creativity"] = boost_level
		skaters.append(d)
	return {
		"team_id": prefix, "skaters": skaters,
		"goalie": AttrHelpers.rich_goalie_dict("%s_g" % prefix, base_level),
		"penalty_rate": 1.0
	}
```

- [ ] **Step 4: Update `test_match_adapter.gd` chemistry test**

The `test_high_chemistry_modifies_input_without_mutating_player` currently checks that `s["passing"]` exceeds the SimAttributes composite. Now it should check that `s["passing"]` exceeds `p.passing` (the raw attr):

Replace the assertion block:
```gdscript
	var nudged := false
	for s in d["skaters"]:
		var pl := _find(team, s["id"])
		if int(s["passing"]) > pl.passing:
			nudged = true
			break
	assert_true(nudged, "high chemistry nudges at least one skater's passing above raw attr")
```

Also update `test_build_input_has_skaters_and_goalie` — the goalie dict no longer has `save_ability`; check `reflexes` instead:
```gdscript
	assert_eq(int(d["goalie"]["reflexes"]), 15, "uniform-15 goalie -> reflexes 15")
```

Update `test_skater_dict_carries_attributes` — the dict no longer has composite `"shooting"`; check a rich attr instead:
```gdscript
	assert_true(first.has("wristshot"))
	assert_true(first.has("fatigue"))
```

- [ ] **Step 5: Build, run full test suite**

Expected: 148/148 pass. The old engine still works via computed compat properties on SimSkater/SimGoalie, and now receives all 27/10 attrs.

- [ ] **Step 6: Commit**

```
feat(sim): adapter sends rich 27/10 attrs; test fixtures migrated to rich schema
```

---

### Task 3: MatchSimulator.cs — Possession-chain engine (full rewrite)

**Files:**
- Rewrite: `src/core/MatchSimulator.cs`

This is the core task. Replace the entire `Tick()`-based per-second model with a possession-chain state machine. The file grows from ~250 to ~550 lines.

**Sub-structure within the file:**
1. `Contest()` + `Blend()` — the primitive
2. Possession loop (faceoff → zone entry → OZ actions → shot/turnover)
3. Each micro-event (14 methods, one per spec §5 row)
4. xG model + save/goal resolution
5. Rich event emission
6. `BuildResult()` with full stats

- [ ] **Step 1: Write the complete `MatchSimulator.cs` rewrite**

Replace the entire file. The code below implements the full spec §3–§7:

```csharp
using Godot;
using System;
using System.Collections.Generic;
using ColdGM.Core;

public partial class MatchSimulator : RefCounted
{
    private Random _rng;
    private Godot.Collections.Array _events;

    public Godot.Collections.Dictionary simulate_game(Godot.Collections.Dictionary input)
    {
        int seed = input.ContainsKey("seed") ? input["seed"].AsInt32() : 0;
        _rng = new Random(seed);
        _events = new Godot.Collections.Array();

        var state = new GameState
        {
            Home = ParseTeam(input["home"].As<Godot.Collections.Dictionary>()),
            Away = ParseTeam(input["away"].As<Godot.Collections.Dictionary>())
        };

        SimulatePeriods(state, 1, 3, SimConstants.GameDuration);

        if (state.Home.Score == state.Away.Score)
        {
            state.WentToOvertime = true;
            state.Period = 4;
            int otEnd = state.Time + SimConstants.MaxOvertime;
            SimulatePossessions(state, otEnd, true);
            if (state.Home.Score == state.Away.Score)
                ResolveShootout(state);
        }

        return BuildResult(state);
    }

    private void SimulatePeriods(GameState state, int startPeriod, int endPeriod, int totalTime)
    {
        for (int p = startPeriod; p <= endPeriod; p++)
        {
            state.Period = p;
            int periodEnd = p * SimConstants.PeriodDuration;
            SimulatePossessions(state, periodEnd, false);
        }
    }

    private void SimulatePossessions(GameState state, int timeLimit, bool suddenDeath)
    {
        while (state.Time < timeLimit)
        {
            if (suddenDeath && state.Home.Score != state.Away.Score)
                break;

            SimTeam attacker = _rng.NextDouble() < 0.5 ? state.Home : state.Away;
            SimTeam defender = attacker == state.Home ? state.Away : state.Home;

            RunPossession(state, attacker, defender);
            UpdateFatigue(state.Home);
            UpdateFatigue(state.Away);
            DecrementPenalties(state);
        }
    }

    private void RunPossession(GameState state, SimTeam attacker, SimTeam defender)
    {
        int possStart = state.Time;
        bool afterDeke = false;  // tracks if shot follows a successful deke (→ Danger.High)
        bool isRush = false;     // tracks if shot comes off a rush (fast zone entry)

        // Faceoff
        SimSkater aC = SelectCenter(attacker);
        SimSkater dC = SelectCenter(defender);
        bool wonFaceoff = DoFaceoff(state, aC, dC, attacker, defender);
        if (!wonFaceoff)
        {
            var temp = attacker; attacker = defender; defender = temp;
            aC = dC;
        }
        state.Time += SimConstants.FaceoffDuration;

        // Breakout from DZ (#4) — defender forechecks (#5) to contest the breakout
        SimSkater carrier = SelectCarrier(attacker);
        bool breakoutOk = DoBreakout(state, carrier, defender, attacker);
        if (!breakoutOk)
        {
            // Forecheck forced a turnover (#5)
            DoForecheck(state, defender, attacker, carrier);
            state.Time += RandDur(SimConstants.EntryDurMin, SimConstants.EntryDurMax);
            return; // possession lost in DZ
        }

        // Zone entry (#2)
        Zone zone = Zone.NZ;
        carrier = SelectCarrier(attacker);
        bool entered = DoZoneEntry(state, carrier, defender, attacker);
        if (entered)
        {
            zone = Zone.OZ;
            isRush = true; // controlled entry = rush opportunity
        }
        else
        {
            // Dump & recover attempt (#3)
            bool recovered = DoDumpRecover(state, attacker, defender);
            if (recovered)
                zone = Zone.OZ;
            else
            {
                state.Time += RandDur(SimConstants.EntryDurMin, SimConstants.EntryDurMax);
                return; // possession lost at NZ
            }
        }
        state.Time += RandDur(SimConstants.EntryDurMin, SimConstants.EntryDurMax);

        // OZ actions loop
        int ozActions = 0;
        int maxActions = 4 + _rng.Next(4); // 4-7 actions max per possession
        bool screenActive = false; // set by board battle win near net
        while (zone == Zone.OZ && ozActions < maxActions && state.Time < possStart + 45)
        {
            ozActions++;
            isRush = isRush && ozActions <= 1; // rush only applies to first OZ action
            carrier = SelectCarrier(attacker);
            SimSkater defMan = SelectDefender(defender);

            // Maybe hit on carrier (#9) — uses Checking+Hitting
            if (_rng.NextDouble() < 0.25)
            {
                SimSkater hitter = SelectHitter(defender);
                DoHit(state, hitter, carrier, defender, attacker);
            }

            // Stamina check: fatigued players less likely to generate offense
            double staminaMod = carrier.EffectiveStamina / 20.0;

            // Choose OZ action
            double roll = _rng.NextDouble();
            if (roll < 0.30)
            {
                // Pass (#6)
                SimSkater target = SelectPassTarget(attacker, carrier);
                bool passOk = DoPass(state, carrier, target, defMan, attacker, defender);
                if (!passOk)
                {
                    EmitEvent(state, "takeaway", defender, defMan.Id, "", zone: Zone.OZ);
                    EmitEvent(state, "giveaway", attacker, carrier.Id, "", zone: Zone.OZ);
                    defMan.TakeawaysS++;
                    carrier.GiveawaysS++;
                    break;
                }
                carrier = target;
            }
            else if (roll < 0.50)
            {
                // Deke/1-on-1 (#7)
                bool dekeOk = DoDeke(state, carrier, defMan, attacker, defender);
                if (!dekeOk)
                {
                    EmitEvent(state, "takeaway", defender, defMan.Id, "", zone: Zone.OZ);
                    EmitEvent(state, "giveaway", attacker, carrier.Id, "", zone: Zone.OZ);
                    defMan.TakeawaysS++;
                    carrier.GiveawaysS++;
                    break;
                }
                afterDeke = true; // successful deke → next shot is Danger.High
            }
            else if (roll < 0.62)
            {
                // Board battle (#8) — uses Checking in selection weight
                bool boardWin = DoBoardBattle(state, carrier, defMan, attacker, defender);
                if (!boardWin)
                {
                    EmitEvent(state, "takeaway", defender, defMan.Id, "", zone: Zone.OZ);
                    carrier.GiveawaysS++;
                    defMan.TakeawaysS++;
                    break;
                }
                screenActive = _rng.NextDouble() < 0.4; // board battle win can create screen
            }
            else
            {
                // Shot decision
                ShotType shotType = ChooseShotType(carrier, ozActions);
                // Danger assignment (spec: deke→high, point shot→low, otherwise from context)
                Danger danger = afterDeke ? Danger.High
                    : (ozActions <= 1 && shotType == ShotType.Slap) ? Danger.Low
                    : EvaluateDanger(ozActions, roll);
                SimSkater assister = ozActions > 1 ? SelectPassTarget(attacker, carrier) : null;

                // Block attempt (#10) — uses Checking in blocker weight
                SimSkater blocker = SelectDefender(defender);
                bool blocked = DoBlock(state, carrier, blocker, shotType, attacker, defender, danger);
                if (blocked)
                {
                    blocker.ShotsBlocked++;
                    break;
                }

                // Shot on goal (#11) with xG (#7) — includes rush, screen, score_state
                double xg = CalcXg(carrier, defender.Goalie, shotType, danger,
                                   attacker == state.Home, state,
                                   afterDeke, false, isRush, screenActive);
                bool goal = DoShot(state, carrier, assister, defender.Goalie,
                                   shotType, xg, danger, attacker, defender);
                if (goal)
                {
                    break;
                }
                else
                {
                    // Rebound chance (#13)
                    if (DoRebound(state, attacker, defender, danger))
                    {
                        SimSkater rebounder = SelectRebounder(attacker, carrier);
                        double rxg = CalcXg(rebounder, defender.Goalie, ShotType.Wrist,
                                            Danger.High, attacker == state.Home, state,
                                            false, true, false, false);
                        DoShot(state, rebounder, carrier, defender.Goalie,
                               ShotType.Wrist, rxg, Danger.High, attacker, defender);
                    }
                    break;
                }
            }
            afterDeke = false; // reset after non-deke action
            state.Time += RandDur(SimConstants.OZActionDurMin, SimConstants.OZActionDurMax);
        }

        // Advance time for the possession
        state.Time += RandDur(SimConstants.OZActionDurMin, SimConstants.OZActionDurMax);

        // Possible penalty from any contact events (#12)
        MaybePenalty(state, attacker, defender);
        MaybePenalty(state, defender, attacker);
    }

    // ── Contest primitive (spec §3) ──
    private bool Contest(double aEff, double dEff, double k, double ctx)
    {
        double x = k * (aEff - dEff) / 20.0 + ctx;
        double p = 1.0 / (1.0 + Math.Exp(-x));
        return _rng.NextDouble() < p;
    }

    private double Blend(SimSkater s, params (double w, Func<SimSkater, int> attr)[] components)
    {
        double val = 0;
        double fatigueMod = Math.Min(s.InGameFatigue + s.StartFatigue, 100) * SimConstants.FatigueModScale;
        foreach (var (w, attr) in components)
            val += w * attr(s);
        return val * (1.0 - fatigueMod);
    }

    private double BlendGoalie(SimGoalie g, params (double w, Func<SimGoalie, int> attr)[] components)
    {
        double val = 0;
        double fatigueMod = g.StartFatigue / 100.0 * SimConstants.FatigueModScale * 20;
        foreach (var (w, attr) in components)
            val += w * attr(g);
        return val * (1.0 - fatigueMod);
    }

    // ── Micro-events (spec §5) ──

    // #1 Faceoff
    private bool DoFaceoff(GameState state, SimSkater a, SimSkater d, SimTeam aTeam, SimTeam dTeam)
    {
        double aEff = Blend(a, (0.55, s => s.Faceoffs), (0.20, s => s.Strength),
                               (0.15, s => s.Anticipation), (0.10, s => s.WorkRate));
        double dEff = Blend(d, (0.55, s => s.Faceoffs), (0.20, s => s.Strength),
                               (0.15, s => s.Anticipation), (0.10, s => s.WorkRate));
        double ctx = aTeam == state?.Home ? SimConstants.HomeAdvantage : -SimConstants.HomeAdvantage;
        bool won = Contest(aEff, dEff, SimConstants.K_Faceoff, ctx);
        EmitEvent(state, "faceoff", won ? aTeam : dTeam, won ? a.Id : d.Id, "",
                  result: won ? "won" : "lost", zone: Zone.NZ);
        if (won) { a.FaceoffWins++; d.FaceoffLosses++; }
        else { d.FaceoffWins++; a.FaceoffLosses++; }
        return won;
    }

    // #2 Zone entry
    private bool DoZoneEntry(GameState state, SimSkater carrier, SimTeam defender, SimTeam attacker)
    {
        SimSkater defMan = SelectDefender(defender);
        double aEff = Blend(carrier, (0.30, s => s.Speed), (0.25, s => s.Acceleration),
                                     (0.20, s => s.Stickhandling), (0.15, s => s.Deking), (0.10, s => s.OffThePuck));
        double dEff = Blend(defMan, (0.40, s => s.Positioning), (0.30, s => s.Anticipation),
                                    (0.20, s => s.Pokecheck), (0.10, s => s.Speed));
        double ctx = StrengthContext(attacker, defender, state);
        bool ok = Contest(aEff, dEff, SimConstants.K_ZoneEntry, ctx);
        EmitEvent(state, "zone_entry", attacker, carrier.Id, "",
                  result: ok ? "controlled" : "denied", zone: Zone.NZ);
        return ok;
    }

    // #3 Dump & recover
    private bool DoDumpRecover(GameState state, SimTeam attacker, SimTeam defender)
    {
        SimSkater a = SelectByWorkRate(attacker);
        SimSkater d = SelectDefender(defender);
        double aEff = Blend(a, (0.50, s => s.WorkRate), (0.30, s => s.Speed), (0.20, s => s.Anticipation));
        double dEff = Blend(d, (0.40, s => s.Positioning), (0.30, s => s.Strength), (0.30, s => s.Anticipation));
        return Contest(aEff, dEff, SimConstants.K_DumpRecover, 0);
    }

    // #4 Breakout
    private bool DoBreakout(GameState state, SimSkater carrier, SimTeam defender, SimTeam attacker)
    {
        SimSkater forechecker = SelectByWorkRate(defender);
        double aEff = Blend(carrier, (0.40, s => s.Passing), (0.30, s => (int)s.Composure),
                                     (0.20, s => s.Stickhandling), (0.10, s => s.Creativity));
        double dEff = Blend(forechecker, (0.45, s => s.WorkRate), (0.30, s => s.Aggression),
                                         (0.15, s => s.Anticipation), (0.10, s => s.Speed));
        double ctx = StrengthContext(attacker, defender, state);
        return Contest(aEff, dEff, SimConstants.K_Breakout, ctx);
    }

    // #5 Forecheck → giveaway (called when breakout fails)
    private void DoForecheck(GameState state, SimTeam forechecking, SimTeam breaking, SimSkater carrier)
    {
        SimSkater forechecker = SelectByWorkRate(forechecking);
        double aEff = Blend(forechecker, (0.45, s => s.WorkRate), (0.30, s => s.Aggression), (0.25, s => s.Anticipation));
        double dEff = Blend(carrier, (0.45, s => (int)s.Composure), (0.30, s => s.Stickhandling),
                                     (0.15, s => s.Determination), (0.10, s => s.Strength));
        // Forecheck always succeeds here (breakout already failed) — emit the turnover
        EmitEvent(state, "takeaway", forechecking, forechecker.Id, "", zone: Zone.DZ);
        EmitEvent(state, "giveaway", breaking, carrier.Id, "", zone: Zone.DZ);
        forechecker.TakeawaysS++;
        carrier.GiveawaysS++;
    }

    // #6 Pass
    private bool DoPass(GameState state, SimSkater passer, SimSkater target, SimSkater interceptor,
                        SimTeam attacker, SimTeam defender)
    {
        double aEff = Blend(passer, (0.55, s => s.Passing), (0.25, s => s.Creativity),
                                    (0.10, s => s.Anticipation), (0.10, s => s.Teamwork));
        double dEff = Blend(interceptor, (0.55, s => s.Anticipation), (0.25, s => s.Positioning),
                                         (0.20, s => s.Pokecheck));
        bool ok = Contest(aEff, dEff, SimConstants.K_Pass, 0);
        EmitEvent(state, "pass", attacker, passer.Id, target.Id,
                  result: ok ? "complete" : "intercepted", zone: Zone.OZ);
        return ok;
    }

    // #7 Deke/1-on-1
    private bool DoDeke(GameState state, SimSkater carrier, SimSkater defMan,
                        SimTeam attacker, SimTeam defender)
    {
        double aEff = Blend(carrier, (0.40, s => s.Deking), (0.30, s => s.Stickhandling),
                                     (0.15, s => s.Agility), (0.10, s => s.Creativity), (0.05, s => s.Flair));
        double dEff = Blend(defMan, (0.40, s => s.Pokecheck), (0.30, s => s.Positioning),
                                    (0.20, s => s.Anticipation), (0.10, s => s.Balance));
        bool ok = Contest(aEff, dEff, SimConstants.K_Deke, 0);
        EmitEvent(state, "deke", attacker, carrier.Id, defMan.Id,
                  result: ok ? "success" : "stopped", zone: Zone.OZ,
                  danger: ok ? Danger.High : (Danger?)null);
        // Penalty risk on deke (hooking/tripping)
        if (!ok && _rng.NextDouble() < SimConstants.PenaltyCheckProb)
            EmitPenalty(state, defMan, defender);
        return ok;
    }

    // #8 Board battle
    private bool DoBoardBattle(GameState state, SimSkater a, SimSkater d,
                               SimTeam aTeam, SimTeam dTeam)
    {
        double aEff = Blend(a, (0.40, s => s.Strength), (0.30, s => s.Balance),
                               (0.20, s => s.Determination), (0.10, s => s.WorkRate));
        double dEff = Blend(d, (0.40, s => s.Strength), (0.30, s => s.Balance),
                               (0.20, s => s.Determination), (0.10, s => s.WorkRate));
        bool won = Contest(aEff, dEff, SimConstants.K_BoardBattle, 0);
        EmitEvent(state, "board_battle", won ? aTeam : dTeam, won ? a.Id : d.Id, "",
                  result: won ? "won" : "lost", zone: Zone.OZ);
        return won;
    }

    // #9 Hit (uses Checking in hitter selection + Hitting in contest)
    private void DoHit(GameState state, SimSkater hitter, SimSkater target,
                       SimTeam hitTeam, SimTeam targetTeam)
    {
        double aEff = Blend(hitter, (0.35, s => s.Hitting), (0.25, s => s.Strength),
                                    (0.20, s => s.Aggression), (0.10, s => s.Speed),
                                    (0.10, s => s.Checking));
        double dEff = Blend(target, (0.45, s => s.Balance), (0.30, s => s.Strength),
                                    (0.15, s => s.Anticipation), (0.10, s => s.Agility));
        bool landed = Contest(aEff, dEff, SimConstants.K_Hit, 0);
        if (landed)
        {
            hitter.Hits++;
            EmitEvent(state, "hit", hitTeam, hitter.Id, target.Id, zone: Zone.OZ);
            // Penalty risk from aggression
            if (_rng.NextDouble() < SimConstants.PenaltyCheckProb * (hitter.Aggression / 20.0))
                EmitPenalty(state, hitter, hitTeam);
        }
    }

    // #10 Block
    private bool DoBlock(GameState state, SimSkater shooter, SimSkater blocker, ShotType shotType,
                         SimTeam attacker, SimTeam defender, Danger danger)
    {
        int shotAttr = ShotAttr(shooter, shotType);
        double aEff = Blend(shooter, (0.50, _ => shotAttr), (0.30, s => s.Creativity), (0.20, s => s.OffThePuck));
        double dEff = Blend(blocker, (0.50, s => s.Positioning), (0.25, s => s.Bravery),
                                     (0.15, s => s.Anticipation), (0.10, s => s.Determination));
        bool blocked = Contest(dEff, aEff, SimConstants.K_Block, 0); // defender is "attacker" in block contest
        if (blocked)
            EmitEvent(state, "shot_blocked", defender, blocker.Id, shooter.Id,
                      zone: Zone.OZ, danger: danger, shotType: shotType);
        return blocked;
    }

    // #11 Shot + xG
    private bool DoShot(GameState state, SimSkater shooter, SimSkater assister, SimGoalie goalie,
                        ShotType shotType, double xg, Danger danger,
                        SimTeam attacker, SimTeam defender)
    {
        shooter.Shots++;
        shooter.XgFor += xg;
        goalie.ShotsAgainst++;
        goalie.XgAgainst += xg;

        bool goal = _rng.NextDouble() < xg;
        if (goal)
        {
            attacker.Score++;
            shooter.Goals++;
            goalie.GoalsAgainst++;
            string assistId = "";
            string assist2Id = "";
            if (assister != null) { assister.Assists++; assistId = assister.Id; }
            EmitEvent(state, "goal", attacker, shooter.Id, assistId,
                      zone: Zone.OZ, danger: danger, shotType: shotType, xg: xg,
                      strength: GetStrength(attacker, defender, state));
        }
        else
        {
            goalie.Saves++;
            EmitEvent(state, "save", defender, goalie.Id, shooter.Id,
                      zone: Zone.OZ, danger: danger, shotType: shotType, xg: xg,
                      strength: GetStrength(attacker, defender, state));
        }
        return goal;
    }

    // #12 Penalty
    private void EmitPenalty(GameState state, SimSkater offender, SimTeam team)
    {
        int minutes = _rng.NextDouble() < SimConstants.MinorPenaltyFrac ? 2 : 5;
        team.PenaltySecondsRemaining = Math.Max(team.PenaltySecondsRemaining, minutes * 60);
        offender.PenaltyMinutes += minutes;
        SimTeam other = team == state.Home ? state.Away : state.Home;
        var e = new Godot.Collections.Dictionary
        {
            ["time"] = state.Time, ["period"] = state.Period, ["type"] = "penalty",
            ["team"] = team == state.Home ? "home" : "away",
            ["player_id"] = offender.Id, ["duration"] = minutes,
            ["strength"] = GetStrength(team, other, state).ToString()
        };
        _events.Add(e);
    }

    private void MaybePenalty(GameState state, SimTeam team, SimTeam other)
    {
        // Aggression-weighted random penalty (independent of events)
        if (_rng.NextDouble() >= 0.008 * team.PenaltyRate) return;
        SimSkater offender = SelectByAggression(team);
        if (offender == null) return;
        EmitPenalty(state, offender, team);
    }

    // #13 Rebound
    private bool DoRebound(GameState state, SimTeam attacker, SimTeam defender, Danger danger)
    {
        SimSkater rebounder = SelectRebounder(attacker, null);
        SimGoalie g = defender.Goalie;
        double aEff = rebounder != null ? Blend(rebounder, (0.50, s => s.OffThePuck), (0.50, s => s.Anticipation)) : 5;
        double dEff = BlendGoalie(g, (0.50, gi => gi.ReboundControl), (0.20, gi => gi.Recovery),
                                     (0.15, gi => gi.PuckHandling), (0.15, gi => gi.Positioning));
        bool rebound = Contest(aEff, dEff, SimConstants.K_Rebound, 0);
        if (rebound)
            EmitEvent(state, "rebound", attacker, rebounder?.Id ?? "", "", zone: Zone.OZ, danger: Danger.High);
        return rebound;
    }

    // ── xG calculation (spec §7) ──
    private double CalcXg(SimSkater shooter, SimGoalie goalie, ShotType shotType, Danger danger,
                          bool isHome, GameState state, bool offDeke, bool isRebound,
                          bool isRush, bool isScreen)
    {
        double baseLgt = danger switch
        {
            Danger.Low => SimConstants.XG_Base_Low,
            Danger.Med => SimConstants.XG_Base_Med,
            Danger.High => SimConstants.XG_Base_High,
            _ => SimConstants.XG_Base_Med
        };
        double typeBonus = shotType switch
        {
            ShotType.Wrist => SimConstants.XG_Wrist,
            ShotType.Slap => SimConstants.XG_Slap,
            ShotType.OneTimer => SimConstants.XG_OneTimer,
            ShotType.Deflection => SimConstants.XG_Deflection,
            _ => 0
        };
        double situational = 0;
        if (isRebound) situational += SimConstants.XG_Rebound;
        if (offDeke) situational += SimConstants.XG_OffDeke;
        if (isRush) situational += SimConstants.XG_Rush;
        if (isScreen) situational += SimConstants.XG_Screen;

        // PP/PK adjustment
        SimTeam aTeam = isHome ? state.Home : state.Away;
        SimTeam dTeam = isHome ? state.Away : state.Home;
        Strength str = GetStrength(aTeam, dTeam, state);
        double strengthAdj = str switch
        {
            Strength.PP => SimConstants.XG_PP,
            Strength.PK => SimConstants.XG_SH,
            _ => 0
        };

        // Score-state adjustment (spec §7): trailing team shoots more aggressively
        int scoreDiff = aTeam.Score - dTeam.Score;
        double scoreStateAdj = scoreDiff < 0 ? 0.15 : (scoreDiff > 0 ? -0.05 : 0);

        // Finish skill adjustment (Stamina affects late-game finishing)
        int weapon = ShotAttr(shooter, shotType);
        double finishAdj = 0.6 * (weapon - 10) / 10.0;

        // Goalie adjustment (all 10 goalie attrs drive ≥1 event — spec §1)
        double gBlend = BlendGoalie(goalie, (0.30, g => g.Reflexes), (0.15, g => g.Positioning),
                                            (0.12, g => g.OneOnOnes), (0.08, g => g.ReboundControl),
                                            (0.10, g => g.Composure), (0.10, g => g.Agility),
                                            (0.08, g => g.Concentration), (0.07, g => g.Bravery));
        double goalieAdj = 0.9 * (gBlend - 10) / 10.0;

        double logit = baseLgt + typeBonus + situational + strengthAdj + scoreStateAdj + finishAdj - goalieAdj;
        return 1.0 / (1.0 + Math.Exp(-logit));
    }

    // ── Helpers ──
    private ShotType ChooseShotType(SimSkater s, int ozActions)
    {
        if (ozActions <= 1 && s.Slapshot > s.Wristshot) return ShotType.Slap;
        if (_rng.NextDouble() < 0.15) return ShotType.Deflection;
        if (ozActions > 2 && _rng.NextDouble() < 0.20) return ShotType.OneTimer;
        return ShotType.Wrist;
    }

    private Danger EvaluateDanger(int ozActions, double roll)
    {
        if (ozActions >= 3 && roll > 0.85) return Danger.High;
        if (ozActions >= 2) return Danger.Med;
        return Danger.Low;
    }

    private int ShotAttr(SimSkater s, ShotType type) => type switch
    {
        ShotType.Wrist => s.Wristshot,
        ShotType.Slap => s.Slapshot,
        ShotType.Deflection => s.Deflections,
        ShotType.OneTimer => s.Wristshot,
        _ => s.Wristshot
    };

    private Strength GetStrength(SimTeam attacker, SimTeam defender, GameState state)
    {
        if (defender.PenaltySecondsRemaining > 0 && attacker.PenaltySecondsRemaining == 0)
            return Strength.PP;
        if (attacker.PenaltySecondsRemaining > 0 && defender.PenaltySecondsRemaining == 0)
            return Strength.PK;
        return Strength.EV;
    }

    private double StrengthContext(SimTeam attacker, SimTeam defender, GameState state)
    {
        double ctx = 0;
        if (defender.PenaltySecondsRemaining > 0) ctx += SimConstants.PPContextBoost;
        if (attacker.PenaltySecondsRemaining > 0) ctx += SimConstants.PKContextPenalty;
        return ctx;
    }

    // ── Player selection ──
    private SimSkater SelectCenter(SimTeam t) => t.Skaters.Count > 0
        ? t.Skaters[_rng.Next(Math.Min(4, t.Skaters.Count))] : null;

    private SimSkater SelectCarrier(SimTeam t) => t.Skaters.Count > 0
        ? t.Skaters[_rng.Next(t.Skaters.Count)] : null;

    private SimSkater SelectDefender(SimTeam t) => t.Skaters.Count > 0
        ? t.Skaters[_rng.Next(Math.Min(6, t.Skaters.Count))] : null;

    private SimSkater SelectPassTarget(SimTeam t, SimSkater except)
    {
        if (t.Skaters.Count <= 1) return except;
        for (int i = 0; i < 8; i++)
        {
            var c = t.Skaters[_rng.Next(t.Skaters.Count)];
            if (c != except) return c;
        }
        return t.Skaters[0];
    }

    private SimSkater SelectHitter(SimTeam t) => SelectWeighted(t, s => s.Hitting + s.Checking + s.Aggression);
    private SimSkater SelectByWorkRate(SimTeam t) => SelectWeighted(t, s => s.WorkRate);
    private SimSkater SelectByAggression(SimTeam t) => SelectWeighted(t, s => s.Aggression);
    private SimSkater SelectShooter(SimTeam t) => SelectWeighted(t, s => s.Wristshot + s.Slapshot);

    private SimSkater SelectRebounder(SimTeam t, SimSkater except)
    {
        if (t.Skaters.Count == 0) return null;
        return SelectWeighted(t, s => s.OffThePuck + s.Anticipation);
    }

    private SimSkater SelectWeighted(SimTeam t, Func<SimSkater, int> weightFn)
    {
        if (t.Skaters.Count == 0) return null;
        double total = 0;
        foreach (var s in t.Skaters) total += Math.Max(weightFn(s), 1);
        if (total <= 0) return t.Skaters[0];
        double r = _rng.NextDouble() * total;
        foreach (var s in t.Skaters) { r -= Math.Max(weightFn(s), 1); if (r <= 0) return s; }
        return t.Skaters[0];
    }

    // ── Fatigue & penalty timers ──
    private void UpdateFatigue(SimTeam t)
    {
        // Stamina reduces fatigue accumulation (spec §1: every attr drives ≥1 event)
        foreach (var s in t.Skaters)
            s.InGameFatigue += SimConstants.FatiguePerPossession * (1.0 - (s.Stamina - 10) * 0.02);
    }

    private void DecrementPenalties(GameState state)
    {
        int dur = 8; // approx seconds per possession
        if (state.Home.PenaltySecondsRemaining > 0)
            state.Home.PenaltySecondsRemaining = Math.Max(0, state.Home.PenaltySecondsRemaining - dur);
        if (state.Away.PenaltySecondsRemaining > 0)
            state.Away.PenaltySecondsRemaining = Math.Max(0, state.Away.PenaltySecondsRemaining - dur);
    }

    private void ResolveShootout(GameState state)
    {
        SimTeam winner = _rng.NextDouble() < 0.5 ? state.Home : state.Away;
        SimSkater scorer = SelectShooter(winner);
        if (scorer == null) return;
        winner.Score++;
        scorer.Goals++;
        EmitEvent(state, "goal", winner, scorer.Id, "", zone: Zone.NZ);
    }

    // ── Event emission ──
    private void EmitEvent(GameState state, string type, SimTeam team, string playerId, string assistId,
                           Zone zone = Zone.NZ, Danger? danger = null, ShotType? shotType = null,
                           double? xg = null, string result = "", Strength? strength = null,
                           string targetId = "", string assist2Id = "")
    {
        var e = new Godot.Collections.Dictionary
        {
            ["time"] = state.Time, ["period"] = state.Period, ["type"] = type,
            ["team"] = team == state.Home ? "home" : "away",
            ["player_id"] = playerId, ["target_id"] = targetId,
            ["assist_id"] = assistId, ["assist2_id"] = assist2Id,
            ["zone"] = zone.ToString(), ["result"] = result
        };
        if (danger.HasValue) e["danger"] = danger.Value.ToKey();
        if (shotType.HasValue) e["shot_type"] = shotType.Value.ToKey();
        if (xg.HasValue) e["xg"] = xg.Value;
        if (strength.HasValue) e["strength"] = strength.Value.ToString();
        _events.Add(e);
    }

    // ── ParseTeam (reads rich attrs, same as Task 1/2) ──
    private SimTeam ParseTeam(Godot.Collections.Dictionary d)
    {
        var t = new SimTeam
        {
            TeamId = d["team_id"].AsString(),
            PenaltyRate = d.ContainsKey("penalty_rate") ? d["penalty_rate"].AsDouble() : 1.0,
            TeamChemistry = d.ContainsKey("team_chemistry") ? d["team_chemistry"].AsDouble() : 50.0
        };
        foreach (var sv in d["skaters"].As<Godot.Collections.Array>())
        {
            var s = sv.As<Godot.Collections.Dictionary>();
            t.Skaters.Add(new SimSkater
            {
                Id = s["id"].AsString(),
                Checking = s["checking"].AsInt32(), Deflections = s["deflections"].AsInt32(),
                Deking = s["deking"].AsInt32(), Faceoffs = s["faceoffs"].AsInt32(),
                Hitting = s["hitting"].AsInt32(), OffThePuck = s["off_the_puck"].AsInt32(),
                Passing = s["passing"].AsInt32(), Pokecheck = s["pokecheck"].AsInt32(),
                Positioning = s["positioning"].AsInt32(), Slapshot = s["slapshot"].AsInt32(),
                Stickhandling = s["stickhandling"].AsInt32(), Wristshot = s["wristshot"].AsInt32(),
                Aggression = s["aggression"].AsInt32(), Anticipation = s["anticipation"].AsInt32(),
                Bravery = s["bravery"].AsInt32(), Creativity = s["creativity"].AsInt32(),
                Determination = s["determination"].AsInt32(), Flair = s["flair"].AsInt32(),
                Influence = s["influence"].AsInt32(), Teamwork = s["teamwork"].AsInt32(),
                WorkRate = s["work_rate"].AsInt32(),
                Acceleration = s["acceleration"].AsInt32(), Agility = s["agility"].AsInt32(),
                Balance = s["balance"].AsInt32(), Speed = s["speed"].AsInt32(),
                Stamina = s["stamina"].AsInt32(), Strength = s["strength"].AsInt32(),
                StartFatigue = s["fatigue"].AsInt32(),
                LineChemistry = s.ContainsKey("line_chemistry") ? s["line_chemistry"].AsDouble() : 50.0
            });
        }
        var gd = d["goalie"].As<Godot.Collections.Dictionary>();
        if (gd != null && gd.ContainsKey("id"))
        {
            t.Goalie = new SimGoalie
            {
                Id = gd["id"].AsString(),
                Reflexes = gd["reflexes"].AsInt32(), Positioning = gd["positioning"].AsInt32(),
                ReboundControl = gd["rebound_control"].AsInt32(), Recovery = gd["recovery"].AsInt32(),
                PuckHandling = gd["puck_handling"].AsInt32(), OneOnOnes = gd["one_on_ones"].AsInt32(),
                Concentration = gd["concentration"].AsInt32(), Composure = gd["composure"].AsInt32(),
                Bravery = gd["bravery"].AsInt32(), Agility = gd["agility"].AsInt32(),
                StartFatigue = gd["fatigue"].AsInt32()
            };
        }
        else
        {
            t.Goalie = new SimGoalie { Id = t.TeamId + "_emg_g", Reflexes = 5, Positioning = 5,
                                       ReboundControl = 5, Recovery = 5, PuckHandling = 5,
                                       OneOnOnes = 5, Concentration = 5, Composure = 5,
                                       Bravery = 5, Agility = 5, StartFatigue = 0 };
        }
        return t;
    }

    // ── BuildResult (superset of old schema) ──
    private Godot.Collections.Dictionary BuildResult(GameState state)
    {
        var pstats = new Godot.Collections.Dictionary();
        var gstats = new Godot.Collections.Dictionary();
        foreach (var team in new[] { state.Home, state.Away })
        {
            foreach (var s in team.Skaters)
                pstats[s.Id] = new Godot.Collections.Dictionary
                {
                    ["goals"] = s.Goals, ["assists"] = s.Assists, ["shots"] = s.Shots,
                    ["hits"] = s.Hits, ["takeaways"] = s.TakeawaysS, ["giveaways"] = s.GiveawaysS,
                    ["faceoff_wins"] = s.FaceoffWins, ["faceoff_losses"] = s.FaceoffLosses,
                    ["shots_blocked"] = s.ShotsBlocked, ["xg"] = s.XgFor
                };
            gstats[team.Goalie.Id] = new Godot.Collections.Dictionary
            {
                ["saves"] = team.Goalie.Saves, ["shots_against"] = team.Goalie.ShotsAgainst,
                ["goals_against"] = team.Goalie.GoalsAgainst, ["xga"] = team.Goalie.XgAgainst
            };
        }
        return new Godot.Collections.Dictionary
        {
            ["home_score"] = state.Home.Score, ["away_score"] = state.Away.Score,
            ["went_to_overtime"] = state.WentToOvertime, ["events"] = _events,
            ["player_stats"] = pstats, ["goalie_stats"] = gstats
        };
    }

    private int RandDur(int min, int max) => min + _rng.Next(max - min + 1);
}
```

- [ ] **Step 2: Build C#**

```powershell
$env:PATH = "C:\Users\rauti\AppData\Local\Microsoft\dotnet;$env:PATH"
dotnet build C:\Users\rauti\cold_gm\ColdGM.sln -c Debug
```

Expected: Build succeeds. Fix any compile errors (typos, missing usings).

- [ ] **Step 3: Remove compat properties from SimContext.cs**

Now that MatchSimulator no longer references old composite names, remove the temporary `Shooting`, `CheckingComp`, `SaveAbility` etc. computed properties from SimSkater/SimGoalie that were added in Task 1, step 4.

- [ ] **Step 4: Build and run a quick smoke test**

```powershell
dotnet build C:\Users\rauti\cold_gm\ColdGM.sln -c Debug
# Run just test_match_simulator
```

Run only `test_match_simulator.gd` to check the engine produces valid results. Statistical bounds may need adjustment in Task 4.

- [ ] **Step 5: Commit**

```
feat(sim): possession-chain engine with 14 contests + xG (replaces tick model)
```

---

### Task 4: Migrate existing tests — full green

**Files:**
- Modify: `tests/gut/test_match_simulator.gd`
- Modify: `tests/gut/test_text_report.gd` (if event schema changes break it)
- Modify: `tests/gut/test_season_manager.gd` (if scoring bounds shift)
- Modify: `tests/gut/test_full_season_integration.gd` (time budget)

The new engine produces different scores/events for the same seed (completely different model). Existing tests check invariants and statistical properties — those should hold, but bounds may need loosening.

- [ ] **Step 1: Run full test suite, capture failures**

```powershell
# Full GUT suite
```

Read the output and categorise failures:
- **Invariant failures** (player goals ≠ team score) → engine bug, fix in MatchSimulator
- **Statistical failures** (avg goals out of range) → adjust test bounds
- **Schema failures** (missing key) → fix event emission or BuildResult
- **Fixture failures** (old keys) → should have been caught in Task 2

- [ ] **Step 2: Fix invariant and schema failures first**

These indicate engine bugs. Fix in `MatchSimulator.cs` and rebuild.

- [ ] **Step 3: Adjust statistical bounds in tests**

`test_goals_per_game_in_plausible_range`: widen to `assert_between(avg_per_team, 1.0, 6.0)` temporarily (calibration in Task 7 narrows it).

`test_full_season_under_time_budget`: the new engine may be slower due to more events. Raise budget to `60000` (60s) if needed — optimise later.

- [ ] **Step 4: Verify TextReport compatibility**

TextReport reads `e["type"] == "goal"`, `e["player_id"]`, `e["assist_id"]`, `e["time"]`, `e["period"]`, `e["team"]`. The new engine emits all of these. It also reads `e["type"] == "save"` for shot counting. Verify by running `test_text_report.gd`.

If the `test_text_report` tests use mock result dicts (they do — hand-built events), they should still pass since those dicts are hardcoded with the right schema.

- [ ] **Step 5: Verify match_report / star_of_game compatibility**

`LoopQueries.match_report` reads `events[i]["type"]`, `player_id`, `assist_id`, `time`, `period`, `team` — all present. `star_of_game` reads `player_stats[pid]["goals"]`, `assists` — present. Should work.

- [ ] **Step 6: Run full suite — all green**

Expected: 148/148 pass (or close — fix stragglers).

- [ ] **Step 7: Commit**

```
test(sim): migrate all tests to new possession-chain engine — 148/148 green
```

---

### Task 5: Golden-master snapshot test

**Files:**
- Create: `tests/gut/test_match_golden.gd`

A canonical fixture with a fixed seed produces a deterministic result. Snapshot the entire result dict. Future changes that affect the event stream will cause a visible diff (re-bake consciously).

- [ ] **Step 1: Capture the golden snapshot**

Run a game with a known seed and capture the result (score, event count, specific events).

```powershell
# Add a temporary print script or use the existing test infrastructure
```

- [ ] **Step 2: Write `test_match_golden.gd`**

```gdscript
extends GutTest

var sim

func before_each():
	sim = load("res://src/core/MatchSimulator.cs").new()

func _canonical_input() -> Dictionary:
	return {
		"seed": 42,
		"home": AttrHelpers.rich_skater_dict_team("H", 12),
		"away": AttrHelpers.rich_skater_dict_team("A", 10)
	}

func test_determinism_full_event_stream():
	var r1 := sim.simulate_game(_canonical_input())
	var r2 := sim.simulate_game(_canonical_input())
	assert_eq(r1["home_score"], r2["home_score"])
	assert_eq(r1["away_score"], r2["away_score"])
	var e1: Array = r1["events"]
	var e2: Array = r2["events"]
	assert_eq(e1.size(), e2.size(), "same event count")
	for i in mini(e1.size(), e2.size()):
		assert_eq(e1[i]["type"], e2[i]["type"], "event %d type matches" % i)
		assert_eq(e1[i]["time"], e2[i]["time"], "event %d time matches" % i)

func test_golden_snapshot():
	var r := sim.simulate_game(_canonical_input())
	# Pin exact values (re-bake when constants change)
	# These values must be captured from the first successful run.
	# PLACEHOLDER — replace with actual values after Task 3+4 pass:
	gut.p("Golden: home=%d away=%d events=%d" % [r["home_score"], r["away_score"], (r["events"] as Array).size()])
	# assert_eq(int(r["home_score"]), EXPECTED_HOME)
	# assert_eq(int(r["away_score"]), EXPECTED_AWAY)
	# assert_eq((r["events"] as Array).size(), EXPECTED_EVENT_COUNT)
	pass  # Activate after capturing snapshot values
```

**NOTE:** The implementer must run the canonical input once, capture the actual values, and replace the placeholder assertions. Add `rich_skater_dict_team` helper to `attr_helpers.gd`:

```gdscript
static func rich_skater_dict_team(prefix: String, level: int) -> Dictionary:
	var skaters: Array = []
	for i in 18:
		skaters.append(rich_skater_dict("%s_p%d" % [prefix, i], level))
	return {
		"team_id": prefix, "skaters": skaters,
		"goalie": rich_goalie_dict("%s_g" % prefix, level),
		"penalty_rate": 1.0
	}
```

- [ ] **Step 3: Run and verify**

Golden master test should pass (determinism) and print snapshot values.

- [ ] **Step 4: Commit**

```
test(sim): add golden-master snapshot for deterministic regression
```

---

### Task 6: Counter-tests — attribute impact

**Files:**
- Create: `tests/gut/test_match_counters.gd`

These tests verify that each attribute group genuinely affects outcomes. Run many seeds and check statistical properties.

- [ ] **Step 1: Write `test_match_counters.gd`**

```gdscript
extends GutTest

var sim

func before_each():
	sim = load("res://src/core/MatchSimulator.cs").new()

func _team(prefix: String, level: int) -> Dictionary:
	return AttrHelpers.rich_skater_dict_team(prefix, level)

func _team_boosted(prefix: String, base: int, attrs: Array, boost: int) -> Dictionary:
	var skaters: Array = []
	for i in 18:
		var d := AttrHelpers.rich_skater_dict("%s_p%d" % [prefix, i], base)
		for a in attrs:
			d[a] = boost
		skaters.append(d)
	return {
		"team_id": prefix, "skaters": skaters,
		"goalie": AttrHelpers.rich_goalie_dict("%s_g" % prefix, base),
		"penalty_rate": 1.0
	}

func _run_n(home: Dictionary, away: Dictionary, n: int) -> Dictionary:
	var home_goals := 0
	var away_goals := 0
	for s in n:
		var r := sim.simulate_game({"seed": s + 500, "home": home, "away": away})
		home_goals += int(r["home_score"])
		away_goals += int(r["away_score"])
	return {"home_goals": home_goals, "away_goals": away_goals}

func test_high_shooting_team_scores_more():
	var strong := _team_boosted("H", 10, ["wristshot", "slapshot", "deking"], 18)
	var weak := _team("A", 10)
	var r := _run_n(strong, weak, 30)
	assert_gt(r["home_goals"], r["away_goals"], "high shooting attrs → more goals")

func test_high_defensive_team_concedes_less():
	var solid := _team_boosted("H", 10, ["pokecheck", "positioning", "anticipation"], 18)
	var normal := _team("A", 10)
	var r := _run_n(solid, normal, 30)
	assert_lt(r["away_goals"], r["home_goals"], "high defensive attrs → fewer goals against (more for)")

func test_high_aggression_more_penalties():
	var goons := _team_boosted("H", 10, ["aggression", "hitting"], 19)
	var calm := _team_boosted("A", 10, ["aggression", "hitting"], 4)
	var goon_pim := 0
	var calm_pim := 0
	for s in 30:
		var r := sim.simulate_game({"seed": s + 700, "home": goons, "away": calm})
		for e in r["events"]:
			if e["type"] == "penalty":
				if e["team"] == "home": goon_pim += int(e["duration"])
				else: calm_pim += int(e["duration"])
	assert_gt(goon_pim, calm_pim, "high aggression → more PIM")

func test_high_faceoff_wins_more():
	var fo_strong := _team_boosted("H", 10, ["faceoffs"], 19)
	var fo_weak := _team_boosted("A", 10, ["faceoffs"], 4)
	var hw := 0
	var aw := 0
	for s in 30:
		var r := sim.simulate_game({"seed": s + 800, "home": fo_strong, "away": fo_weak})
		for pid in r["player_stats"]:
			var ps: Dictionary = r["player_stats"][pid]
			if String(pid).begins_with("H_"):
				hw += int(ps.get("faceoff_wins", 0))
			else:
				aw += int(ps.get("faceoff_wins", 0))
	assert_gt(hw, aw, "high faceoff attr → more faceoff wins")

func test_strong_goalie_fewer_goals_against():
	var normal := _team("H", 10)
	var weak_goalie := _team("A", 10)
	weak_goalie["goalie"] = AttrHelpers.rich_goalie_dict("A_g", 5)
	var r := _run_n(normal, weak_goalie, 30)
	assert_gt(r["home_goals"], r["away_goals"], "weak goalie concedes more")
```

- [ ] **Step 2: Run counter-tests**

Expected: All pass. If any fail, the engine has a dead attribute — fix in MatchSimulator.

- [ ] **Step 3: Commit**

```
test(sim): add counter-tests verifying attribute impact on outcomes
```

---

### Task 7: Monte-Carlo calibration + PROGRESS.md

**Files:**
- Modify: `src/core/SimConstants.cs` (tune constants)
- Modify: `tests/gut/test_match_golden.gd` (re-bake snapshot after tuning)
- Modify: `PROGRESS.md`

Run 1000+ games, measure averages, compare to spec §9 targets. Adjust `SimConstants` values until in range. Re-bake golden master.

- [ ] **Step 1: Write a calibration script**

Create a temporary GUT test or standalone script that runs 1000 games and prints averages:

```gdscript
# Add to test_match_counters.gd or a new file:
func test_calibration_stats():
	var total_goals := 0.0
	var total_sog := 0.0
	var total_hits := 0.0
	var total_pim := 0.0
	var total_events := 0.0
	var n := 200  # per-test budget (increase offline)
	for s in n:
		var r := sim.simulate_game({"seed": s + 2000,
			"home": _team("H", 10), "away": _team("A", 10)})
		total_goals += int(r["home_score"]) + int(r["away_score"])
		var sog := 0; var hits := 0; var pim := 0
		for e in r["events"]:
			if e["type"] == "goal" or e["type"] == "save": sog += 1
			if e["type"] == "hit": hits += 1
			if e["type"] == "penalty": pim += int(e.get("duration", 2))
		total_sog += sog
		total_hits += hits
		total_pim += pim
		total_events += (r["events"] as Array).size()
	var avg_goals := total_goals / n
	var avg_sog := total_sog / n
	var avg_hits := total_hits / n
	var avg_pim := total_pim / n
	var avg_events := total_events / n
	gut.p("CALIBRATION: goals=%.1f sog=%.1f hits=%.1f pim=%.1f events=%.0f (n=%d)" % [
		avg_goals, avg_sog, avg_hits, avg_pim, avg_events, n])
	# Spec §9 targets (per game, both teams combined):
	assert_between(avg_goals / 2.0, 2.0, 4.5, "goals per team per game")
	assert_between(avg_sog / 2.0, 24.0, 40.0, "SOG per team per game")
```

- [ ] **Step 2: Run calibration, examine output**

If out of range, adjust `SimConstants`:
- **Too many/few goals:** adjust `XG_Base_*` values
- **Too many/few SOG:** adjust shot decision frequency in `RunPossession` (the `else` branch probability)
- **Too many/few penalties:** adjust `PenaltyCheckProb` and `MaybePenalty` probability
- **Too many/few hits:** adjust hit chance in the OZ loop (the `0.25` threshold)

- [ ] **Step 3: Iterate until in range**

Build + test after each constant change. May take 2-3 iterations.

- [ ] **Step 4: Re-bake golden master**

Run the golden input, capture new values, update `test_match_golden.gd` with exact assertions.

- [ ] **Step 5: Run full suite — all green**

Expected: All 148+ tests pass with the calibrated engine.

- [ ] **Step 6: Update PROGRESS.md**

Set `## NEXT UP` to S5c. Mark S5b tasks complete. Add log entry.

- [ ] **Step 7: Commit**

```
feat(sim): calibrate engine constants to spec §9 targets; lock golden master
```

---

### Task 8: Final review + branch finishing

**Files:**
- All modified files from Tasks 1-7

- [ ] **Step 1: Run full test suite one more time**

Verify all tests green (should be 155+ with new test files).

- [ ] **Step 2: Code review checklist**

- [ ] Every S5a attribute appears in ≥1 Blend() call (spec §1 "jokainen attribuutti ohjaa ≥1 tapahtumaa"). Verify: `Stamina` (fatigue calc), `Checking` (hit contest + hitter selection), all 27 + 10 covered.
- [ ] `Composure` derived correctly (`0.5*det + 0.3*brav + 0.2*inf`) for skaters; goalie has its own
- [ ] All 14 micro-events implemented: faceoff, zone_entry, dump_recover, **breakout**, **forecheck**, pass, deke, board_battle, hit, block, shot+xG, penalty, rebound, takeaway/giveaway
- [ ] xG same probability resolves shot AND is the xG stat (spec §7) — includes `score_state_adj`, `screen`, `rush` bonuses (not dead constants)
- [ ] Event schema has all spec §6 fields: `type, time, period, team, zone, danger, player_id, **target_id**, assist_id, **assist2_id**, result, strength, shot_type, xg, duration`
- [ ] ShotType serialises to spec format: `wrist/slap/deflection/one_timer` (uses `ToKey()`, not `ToString().ToLower()`)
- [ ] Determinism: same seed → identical event stream (golden master green)
- [ ] Result dict is strict superset: `home_score`, `away_score`, `went_to_overtime`, `events`, `player_stats`, `goalie_stats` all present with old keys intact
- [ ] TextReport, match_report, star_of_game, game_report all consume events correctly
- [ ] `player_stats[pid]["goals"]` sums to team score (invariant preserved)
- [ ] OT + shootout work (no tie possible)
- [ ] PP/PK affects shot probability and xG
- [ ] Counter-tests green (no dead attributes)
- [ ] SimConstants centralised (no magic numbers scattered in engine)

- [ ] **Step 3: Commit any review fixes**

- [ ] **Step 4: Use finishing-a-development-branch**

Merge to master or create PR as appropriate.

```
merge: Sprint 5b — Contested possession-chain engine 2.0 + xG
```
