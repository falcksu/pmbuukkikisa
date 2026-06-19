# Cold GM Sprint 3 — Playable Manager Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Cold GM engine in a playable manager loop — start a game, pick a team, see a dashboard / roster / standings, play your match as a text report, advance through the season (regular → playoffs → rollover), and save/load.

**Architecture:** First real Godot UI layer over the existing autoloads/systems. All decision logic lives in pure, testable helpers (`UIPalette`, `LoopQueries`, a new phase-aware `GameState.advance`). Scenes are thin Control nodes that read those helpers + `GameState.world`, styled by one shared `Theme`. No simulation / model / economy changes — the only new non-UI code is GDScript glue in the `GameState` autoload that drives season phases via `SeasonManager`'s public API.

**Tech Stack:** Godot 4.6.3 .NET (mono), GDScript UI + existing C# sim (unchanged), GUT v9.6.0 tests.

**Project root:** `C:\Users\rauti\cold_gm\` (separate repo). Docs/plan live in `buukkikisa`.

**Running tests (every test/build step):** prepend dotnet to PATH, use the **mono** Godot exe, do two `--import` passes, then GUT headless:
```powershell
$env:PATH = "C:\Users\rauti\AppData\Local\Microsoft\dotnet;$env:PATH"
$g = "C:\Users\rauti\cold_gm\godot_4.3\Godot_v4.6.3-stable_mono_win64\Godot_v4.6.3-stable_mono_win64.exe"
& $g --headless --path C:\Users\rauti\cold_gm --import; & $g --headless --path C:\Users\rauti\cold_gm --import
& $g --headless --path C:\Users\rauti\cold_gm -s addons/gut/gut_cmdln.gd -gdir=res://tests/gut -gprefix=test_ -gsuffix=.gd -glog=1 -gexit
```
To run one suite, add `-gtest=res://tests/gut/<file>.gd`.

**Conventions:** GDScript files use **tab** indentation (match existing files). Data classes are `Resource` subclasses instantiated with `.new()`. Keep `push_warning` (not `push_error`) on recoverable paths (GUT treats `push_error` as a failure). Commit after each task.

**Visual quality gate:** Before building each screen scene (Tasks 9–15), produce a `/design` mockup (inline / visual companion) in the broadcast palette and match the implementation to it. Screens must not look blank — use cards, tables, team colors, color-coded OVR.

---

## File Structure

```
src/ui/
  ui_palette.gd              UIPalette: color constants + ovr_color/attr_color   (Task 1)
  scene_router.gd            SceneRouter autoload: goto/back + stack             (Task 8)
  main_menu.gd/.tscn         New Game / Continue                                 (Task 9)
  team_select.gd/.tscn       pick a Premier team                                 (Task 10)
  dashboard.gd/.tscn         hub: identity, next game, buttons                   (Task 11)
  roster.gd/.tscn            player list                                         (Task 12)
  player_profile.gd/.tscn    full card (current attributes)                      (Task 13)
  standings.gd/.tscn         league table + scoring leaders                      (Task 14)
  game_report.gd/.tscn       match result + star                                 (Task 15)
  components/
    player_row.gd/.tscn      one roster row                                      (Task 12)
    standings_row.gd/.tscn   one standings row                                   (Task 14)
    attr_grid.gd/.tscn       3-column attribute grid                             (Task 13)
src/systems/
  loop_queries.gd            LoopQueries: pure query helpers                     (Tasks 2-6)
src/autoload/
  game_state.gd              MODIFY: add phase-aware advance()                   (Task 7)
assets/theme/
  cold_gm_theme.tres         shared Theme                                        (Task 8)
tests/gut/
  test_ui_palette.gd                                                            (Task 1)
  test_loop_queries.gd                                                          (Tasks 2-6)
  test_game_state_advance.gd                                                    (Task 7)
  test_scene_router.gd                                                          (Task 8)
  test_ui_smoke.gd           every .tscn instantiates headless                  (Tasks 9-15)
project.godot                MODIFY: main scene = main_menu; autoload SceneRouter (Task 8)
```

---

## Phase A — Pure logic (TDD)

### Task 1: UIPalette — color constants + rating colors

**Files:**
- Create: `src/ui/ui_palette.gd`
- Test: `tests/gut/test_ui_palette.gd`

- [ ] **Step 1: Write the failing test**
```gdscript
extends GutTest

func test_ovr_color_tiers():
	assert_eq(UIPalette.ovr_color(17.0), UIPalette.GOLD, "16+ = gold")
	assert_eq(UIPalette.ovr_color(13.0), UIPalette.GREEN, "12-15 = green")
	assert_eq(UIPalette.ovr_color(10.5), UIPalette.BLUE, "10-11 = blue")
	assert_eq(UIPalette.ovr_color(8.0), UIPalette.GRAY, "<10 = gray")

func test_boundaries_inclusive_low():
	assert_eq(UIPalette.ovr_color(16.0), UIPalette.GOLD)
	assert_eq(UIPalette.ovr_color(12.0), UIPalette.GREEN)
	assert_eq(UIPalette.ovr_color(10.0), UIPalette.BLUE)

func test_attr_color_uses_same_tiers():
	assert_eq(UIPalette.attr_color(16), UIPalette.GOLD)
	assert_eq(UIPalette.attr_color(9), UIPalette.GRAY)
```

- [ ] **Step 2: Run → expect FAIL** (UIPalette not defined). Command: GUT with `-gtest=res://tests/gut/test_ui_palette.gd`.

- [ ] **Step 3: Implement**
```gdscript
class_name UIPalette

const BG := Color("#14161b")
const PANEL := Color("#1a1d26")
const BORDER := Color("#22252e")
const ACCENT := Color("#6ea8e6")
const TEXT := Color("#e2e4e9")
const TEXT_DIM := Color("#7a7f8e")

const GOLD := Color("#e3b341")
const GREEN := Color("#57b368")
const BLUE := Color("#6ea8e6")
const GRAY := Color("#5a5f6e")

static func ovr_color(rating: float) -> Color:
	if rating >= 16.0: return GOLD
	if rating >= 12.0: return GREEN
	if rating >= 10.0: return BLUE
	return GRAY

static func attr_color(value: int) -> Color:
	return ovr_color(float(value))
```

- [ ] **Step 4: Run → expect PASS.**
- [ ] **Step 5: Commit** — `feat(ui): UIPalette rating color tiers`

---

### Task 2: LoopQueries.next_game_for

**Files:**
- Create: `src/systems/loop_queries.gd`
- Test: `tests/gut/test_loop_queries.gd`

- [ ] **Step 1: Failing test** (add a `_world()` helper reused by later tasks)
```gdscript
extends GutTest

func _team(id: String, name: String) -> TeamData:
	var t := TeamData.new(); t.id = id; t.name = name; t.league_id = "L"
	return t

func _world() -> WorldData:
	var w := WorldData.new()
	var lg := LeagueData.new(); lg.id = "L"; lg.tier = LeagueData.Tier.PREMIER
	lg.teams.append(_team("a", "Aces"))
	lg.teams.append(_team("b", "Bears"))
	lg.teams.append(_team("c", "Cubs"))
	var g1 := ScheduledGame.new(); g1.home_team_id = "a"; g1.away_team_id = "b"; g1.day_of_season = 1
	var g2 := ScheduledGame.new(); g2.home_team_id = "c"; g2.away_team_id = "a"; g2.day_of_season = 3
	lg.schedule.append(g1); lg.schedule.append(g2)
	w.leagues.append(lg)
	return w

func test_next_game_for_returns_earliest_unplayed():
	var w := _world()
	var g := LoopQueries.next_game_for(w, "a")
	assert_eq(g.day_of_season, 1, "earliest unplayed game for team a")

func test_next_game_skips_played():
	var w := _world()
	w.leagues[0].schedule[0].is_played = true
	var g := LoopQueries.next_game_for(w, "a")
	assert_eq(g.day_of_season, 3, "skips the played day-1 game")

func test_next_game_none_returns_null():
	var w := _world()
	for s in w.leagues[0].schedule: s.is_played = true
	assert_null(LoopQueries.next_game_for(w, "a"))
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**
```gdscript
class_name LoopQueries

static func next_game_for(world: WorldData, team_id: String) -> ScheduledGame:
	var best: ScheduledGame = null
	for league in world.leagues:
		for g in league.schedule:
			if g.is_played: continue
			if g.home_team_id != team_id and g.away_team_id != team_id: continue
			if best == null or g.day_of_season < best.day_of_season:
				best = g
	return best
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(ui): LoopQueries.next_game_for`

---

### Task 3: LoopQueries.standings_rows

**Files:** Modify `src/systems/loop_queries.gd`; Test `tests/gut/test_loop_queries.gd`

- [ ] **Step 1: Failing test**
```gdscript
func test_standings_rows_sorted_by_points_then_gd():
	var lg := LeagueData.new(); lg.tier = LeagueData.Tier.PREMIER
	var t1 := _team("t1", "One"); t1.wins = 5; t1.goals_for = 20; t1.goals_against = 10  # 10 pts, +10
	var t2 := _team("t2", "Two"); t2.wins = 5; t2.goals_for = 15; t2.goals_against = 10  # 10 pts, +5
	var t3 := _team("t3", "Three"); t3.wins = 3; t3.overtime_losses = 1                  # 7 pts
	lg.teams.append(t3); lg.teams.append(t1); lg.teams.append(t2)
	var rows := LoopQueries.standings_rows(lg)
	assert_eq(rows[0].team_id, "t1", "best GD first among equal points")
	assert_eq(rows[1].team_id, "t2")
	assert_eq(rows[2].team_id, "t3")
	assert_eq(rows[0].rank, 1)
	assert_eq(rows[0].pts, 10)
	assert_eq(rows[0].gd, 10)
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (append to LoopQueries)
```gdscript
static func standings_rows(league: LeagueData) -> Array:
	var teams := league.teams.duplicate()
	teams.sort_custom(func(a, b):
		if a.points() != b.points(): return a.points() > b.points()
		if a.goal_diff() != b.goal_diff(): return a.goal_diff() > b.goal_diff()
		if a.wins != b.wins: return a.wins > b.wins
		return a.id < b.id)
	var rows := []
	for i in teams.size():
		var t: TeamData = teams[i]
		rows.append({
			"rank": i + 1, "team_id": t.id, "name": t.name, "primary_color": t.primary_color,
			"gp": t.wins + t.losses + t.overtime_losses, "w": t.wins, "l": t.losses,
			"otl": t.overtime_losses, "pts": t.points(),
			"gf": t.goals_for, "ga": t.goals_against, "gd": t.goal_diff()
		})
	return rows
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(ui): LoopQueries.standings_rows`

---

### Task 4: LoopQueries.roster_rows

**Files:** Modify `src/systems/loop_queries.gd`; Test `tests/gut/test_loop_queries.gd`

- [ ] **Step 1: Failing test**
```gdscript
func test_roster_rows_sorted_by_ovr_desc_with_status():
	var t := _team("t", "Team")
	var p1 := PlayerData.new(); p1.id = "p1"; p1.first_name = "Al"; p1.last_name = "Low"
	for a in ["skating","shooting","passing","puck_handling"]: p1.set(a, 8)
	var p2 := PlayerData.new(); p2.id = "p2"; p2.first_name = "Bo"; p2.last_name = "High"
	for a in ["skating","shooting","passing","puck_handling","positioning","defensive_play","power_play","speed","stamina","checking","composure","team_spirit"]: p2.set(a, 17)
	p1.is_injured = true; p1.injury_weeks_remaining = 2
	var g := GoalieData.new(); g.id = "g1"; g.first_name = "Net"; g.last_name = "Minder"
	t.players.append(p1); t.players.append(p2); t.players.append(g)
	var rows := LoopQueries.roster_rows(t)
	assert_eq(rows[0].id, "p2", "highest OVR first")
	assert_true(rows.any(func(r): return r.id == "p1" and r.injured and r.injury_weeks == 2))
	assert_true(rows.any(func(r): return r.id == "g1" and r.is_goalie))
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**
```gdscript
static func roster_rows(team: TeamData) -> Array:
	var rows := []
	for p in team.players:
		rows.append({
			"id": p.id, "name": p.full_name(), "pos": p.position, "is_goalie": p is GoalieData,
			"age": p.age, "ovr": p.overall_rating(), "injured": p.is_injured,
			"injury_weeks": p.injury_weeks_remaining, "fatigue": p.fatigue
		})
	rows.sort_custom(func(a, b): return a.ovr > b.ovr)
	return rows
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(ui): LoopQueries.roster_rows`

---

### Task 5: LoopQueries.scoring_leaders + player_name

**Files:** Modify `src/systems/loop_queries.gd`; Test `tests/gut/test_loop_queries.gd`

- [ ] **Step 1: Failing test**
```gdscript
func test_scoring_leaders_ranks_by_points_excludes_goalies_and_unplayed():
	var w := _world()
	var lg := w.leagues[0]
	var pa := PlayerData.new(); pa.id = "pa"; pa.first_name = "Top"; pa.last_name = "Scorer"
	pa.games_played = 10; pa.season_goals = 12; pa.season_assists = 8
	var pb := PlayerData.new(); pb.id = "pb"; pb.first_name = "Mid"; pb.last_name = "Man"
	pb.games_played = 10; pb.season_goals = 5; pb.season_assists = 5
	var pc := PlayerData.new(); pc.id = "pc"; pc.games_played = 0  # never played -> excluded
	lg.teams[0].players.append(pa); lg.teams[1].players.append(pb); lg.teams[2].players.append(pc)
	var rows := LoopQueries.scoring_leaders(lg, 10)
	assert_eq(rows[0].id, "pa"); assert_eq(rows[0].p, 20)
	assert_eq(rows[1].id, "pb")
	assert_false(rows.any(func(r): return r.id == "pc"), "unplayed excluded")

func test_player_name_resolves_or_falls_back_to_id():
	var w := _world()
	var p := PlayerData.new(); p.id = "px"; p.first_name = "Jane"; p.last_name = "Doe"
	w.leagues[0].teams[0].players.append(p)
	assert_eq(LoopQueries.player_name(w, "px"), "Jane Doe")
	assert_eq(LoopQueries.player_name(w, "unknown"), "unknown")
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**
```gdscript
static func scoring_leaders(league: LeagueData, n: int) -> Array:
	var all := []
	for t in league.teams:
		for p in t.players:
			if p is GoalieData: continue
			if p.games_played == 0: continue
			all.append({
				"id": p.id, "name": p.full_name(), "team": t.name,
				"gp": p.games_played, "g": p.season_goals, "a": p.season_assists, "p": p.season_points()
			})
	all.sort_custom(func(a, b):
		if a.p != b.p: return a.p > b.p
		if a.g != b.g: return a.g > b.g
		return a.id < b.id)
	return all.slice(0, n)

static func player_name(world: WorldData, pid: String) -> String:
	for league in world.leagues:
		for t in league.teams:
			for p in t.players:
				if p.id == pid: return p.full_name()
	return pid
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(ui): LoopQueries.scoring_leaders + player_name`

---

### Task 6: LoopQueries.match_report + star_of_game

**Files:** Modify `src/systems/loop_queries.gd`; Test `tests/gut/test_loop_queries.gd`

- [ ] **Step 1: Failing test**
```gdscript
func test_match_report_resolves_names_and_star():
	var w := _world()
	var s := PlayerData.new(); s.id = "s"; s.first_name = "Goal"; s.last_name = "Getter"
	var a := PlayerData.new(); a.id = "a1"; a.first_name = "Setup"; a.last_name = "Guy"
	w.leagues[0].teams[0].players.append(s); w.leagues[0].teams[0].players.append(a)
	var result := {
		"home_score": 1, "away_score": 0, "went_to_overtime": false,
		"events": [{"type":"goal","team":"home","time":125,"period":1,"player_id":"s","assist_id":"a1"}],
		"player_stats": {"s": {"goals":1,"assists":0,"shots":3}, "a1": {"goals":0,"assists":1,"shots":1}}
	}
	var rep := LoopQueries.match_report(result, w, "Aces", "Bears")
	assert_eq(rep.home_score, 1)
	assert_eq(rep.goals[0].scorer, "Goal Getter")
	assert_eq(rep.goals[0].assist, "Setup Guy")
	assert_eq(rep.goals[0].mmss, "02:05")
	assert_eq(rep.star, "Goal Getter", "most points = star")
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**
```gdscript
static func match_report(result: Dictionary, world: WorldData, home_name: String, away_name: String) -> Dictionary:
	var goals := []
	for e in result.get("events", []):
		if e.get("type", "") != "goal": continue
		var t := int(e.get("time", 0))
		var period := int(e.get("period", 1))
		var in_p: int = t - (period - 1) * 1200
		var assist_id: String = e.get("assist_id", "")
		goals.append({
			"period": period, "mmss": "%02d:%02d" % [in_p / 60, in_p % 60],
			"side": home_name if e.get("team", "") == "home" else away_name,
			"scorer": player_name(world, e.get("player_id", "")),
			"assist": player_name(world, assist_id) if assist_id != "" else ""
		})
	return {
		"home_score": int(result["home_score"]), "away_score": int(result["away_score"]),
		"ot": result.get("went_to_overtime", false), "goals": goals,
		"star": star_of_game(result, world)
	}

static func star_of_game(result: Dictionary, world: WorldData) -> String:
	var best_id := ""
	var best_pts := -1
	var best_goals := -1
	var pstats: Dictionary = result.get("player_stats", {})
	for pid in pstats:
		var st: Dictionary = pstats[pid]
		var g: int = int(st.get("goals", 0))
		var pts: int = g + int(st.get("assists", 0))
		if pts > best_pts or (pts == best_pts and g > best_goals):
			best_pts = pts; best_goals = g; best_id = pid
	return player_name(world, best_id) if best_id != "" else ""
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(ui): LoopQueries.match_report + star_of_game`

---

### Task 7: GameState.advance — phase-aware loop driver

**Files:**
- Modify: `src/autoload/game_state.gd`
- Test: `tests/gut/test_game_state_advance.gd`

- [ ] **Step 1: Failing test** (drives regular season → playoffs → rollover via `advance()` only)
```gdscript
extends GutTest

var gs

func before_each():
	gs = load("res://src/autoload/game_state.gd").new()

func _world_one_premier() -> WorldData:
	var w := WorldData.new()
	var lg := LeagueData.new(); lg.id = "P"; lg.tier = LeagueData.Tier.PREMIER
	for i in 8:
		var t := TeamData.new(); t.id = "t%d" % i; t.league_id = "P"
		for j in 18:
			var p := PlayerData.new(); p.id = "t%d_p%d" % [i, j]; p.shooting = 10
			t.players.append(p)
		var g := GoalieData.new(); g.id = "t%d_g" % i; g.save_ability = 12
		t.players.append(g)
		lg.teams.append(t)
	# tiny schedule: one game on day 1
	var game := ScheduledGame.new(); game.home_team_id = "t0"; game.away_team_id = "t1"; game.day_of_season = 1
	lg.schedule.append(game)
	w.leagues.append(lg)
	return w

func test_advance_runs_regular_then_playoffs_then_rollover():
	gs.world = _world_one_premier()
	var season0: int = gs.world.season
	# 1) regular season incomplete -> advance plays the day
	gs.advance()
	assert_true(gs._all_premier_regular_complete(), "single game played -> regular season complete")
	assert_false(gs.world.leagues[0].playoff_complete)
	# 2) regular complete, playoffs not -> advance runs playoffs
	gs.advance()
	assert_true(gs.world.leagues[0].playoff_complete, "playoffs run")
	assert_ne(gs.world.leagues[0].champion_id, "")
	# 3) playoffs complete -> advance does end_season (new season + fresh schedule)
	gs.advance()
	assert_eq(gs.world.season, season0 + 1, "season advanced")
	assert_gt(gs.world.leagues[0].schedule.size(), 0, "new schedule generated")
	assert_false(gs.world.leagues[0].playoff_complete, "playoff flag reset for new season")
```
(Note: `run_playoffs` needs 8 seeded teams — this mini league has exactly 8.)

- [ ] **Step 2: Run → FAIL** (`advance` not defined).
- [ ] **Step 3: Implement** — add to `game_state.gd` (keep existing `advance_day`):
```gdscript
func advance() -> void:
	if not world: return
	if not _all_premier_regular_complete():
		_season_manager.advance_day(world)
	elif not _all_premier_playoffs_complete():
		for lg in _premier_leagues():
			if not lg.playoff_complete:
				_season_manager.run_playoffs(world, lg)
	else:
		_season_manager.end_season(world)

func _premier_leagues() -> Array:
	var out := []
	for lg in world.leagues:
		if lg.tier == LeagueData.Tier.PREMIER:
			out.append(lg)
	return out

func _all_premier_regular_complete() -> bool:
	for lg in _premier_leagues():
		if not _season_manager.is_regular_season_complete(lg):
			return false
	return true

func _all_premier_playoffs_complete() -> bool:
	for lg in _premier_leagues():
		if not lg.playoff_complete:
			return false
	return true
```

- [ ] **Step 4: Run → PASS.** Also run the FULL suite — confirm Sprint 2's 94 tests still pass.
- [ ] **Step 5: Commit** — `feat(loop): phase-aware GameState.advance (regular->playoffs->rollover)`

---

## Phase B — Navigation + theme

### Task 8: SceneRouter autoload + shared Theme + project wiring

**Files:**
- Create: `src/ui/scene_router.gd`, `assets/theme/cold_gm_theme.tres`
- Modify: `project.godot` (autoload `SceneRouter`; main scene set in Task 9 once main_menu exists)
- Test: `tests/gut/test_scene_router.gd`

- [ ] **Step 1: Failing test** (test the back-stack logic in isolation; scene change itself is smoke-tested later)
```gdscript
extends GutTest

var r

func before_each():
	r = load("res://src/ui/scene_router.gd").new()

func test_push_and_back_stack():
	r._push("res://src/ui/a.tscn")
	r._push("res://src/ui/b.tscn")
	assert_eq(r.current(), "res://src/ui/b.tscn")
	assert_eq(r._back_target(), "res://src/ui/a.tscn", "back goes to previous")
	r._pop()
	assert_eq(r.current(), "res://src/ui/a.tscn")

func test_back_target_null_when_at_root():
	r._push("res://src/ui/a.tscn")
	assert_null(r._back_target())
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `scene_router.gd` (autoload; pure stack helpers + a thin `goto/back` that calls the tree)
```gdscript
extends Node

var _stack: Array[String] = []

func _push(path: String) -> void:
	_stack.push_back(path)

func _pop() -> void:
	if _stack.size() >= 1:
		_stack.pop_back()

func current() -> String:
	return _stack[-1] if _stack.size() > 0 else ""

func _back_target() -> Variant:
	return _stack[-2] if _stack.size() >= 2 else null

func goto(path: String) -> void:
	_push(path)
	get_tree().change_scene_to_file(path)

func back() -> void:
	var target := _back_target()
	if target != null:
		_pop()
		get_tree().change_scene_to_file(target)
```

- [ ] **Step 4:** Create `assets/theme/cold_gm_theme.tres` — a Godot `Theme` resource: default font color `#e2e4e9`, panel `StyleBoxFlat` bg `#1a1d26` border `#22252e`, Button styles (normal/hover/pressed) in the broadcast palette. Register `SceneRouter` as an autoload in `project.godot`.

- [ ] **Step 5: Run test → PASS.** **Commit** — `feat(ui): SceneRouter autoload + shared Theme`

---

## Phase C — Screens (build + `/design` mockup + smoke test)

For every screen below: (a) produce a `/design` mockup first, (b) build the `.tscn` + script reading `GameState.world` + `LoopQueries` + `UIPalette`, applying `cold_gm_theme.tres`, (c) add it to `test_ui_smoke.gd`. Create `test_ui_smoke.gd` in Task 9 and extend it per screen.

**Smoke test pattern** (`test_ui_smoke.gd`):
```gdscript
extends GutTest

func _instantiate(path: String):
	var ps: PackedScene = load(path)
	assert_not_null(ps, "loads: " + path)
	var inst = ps.instantiate()
	assert_not_null(inst, "instantiates: " + path)
	add_child_autofree(inst)

func test_main_menu_instantiates():
	_instantiate("res://src/ui/main_menu.tscn")
# ... one test per screen, added as each is built
```
Screens that read `GameState.world` must guard against a null world (smoke test has no world): scripts read `GameState.world` in a `_refresh()` that no-ops when `world == null`, called from `_ready()`.

### Task 9: main_menu
**Files:** Create `src/ui/main_menu.gd/.tscn`, `tests/gut/test_ui_smoke.gd`; Modify `project.godot` (main scene = `res://src/ui/main_menu.tscn`).
- [ ] `/design` mockup (title/logo, New Game, Continue).
- [ ] Build scene: "Uusi peli" → `SceneRouter.goto(team_select)`; "Jatka" → `GameState.load_slot(0)` then goto dashboard; disable Continue when no save file (`FileAccess.file_exists(GameState._path(0))` — add a public `has_save(slot)` helper to GameState if cleaner).
- [ ] Smoke test added + green. Set `application/run/main_scene` to main_menu in `project.godot`.
- [ ] **Commit** — `feat(ui): main menu`

### Task 10: team_select
**Files:** Create `src/ui/team_select.gd/.tscn`; Modify `test_ui_smoke.gd`.
- [ ] `/design` mockup (grid/list of Premier teams: color swatch, name, city, region).
- [ ] Build: iterate `GameState.world` Premier leagues’ teams (or build from a fresh `WorldFactory` preview if no world yet — simplest: call `GameState.start_new_game` only after selection; for the list, create the world first on entry, then let the user pick → set `world.player_team_id/_league_id` + `is_player_controlled`). Selection → dashboard.
- [ ] Smoke test + green.
- [ ] **Commit** — `feat(ui): team select`

### Task 11: dashboard
**Files:** Create `src/ui/dashboard.gd/.tscn`; Modify `test_ui_smoke.gd`.
- [ ] `/design` mockup (identity card, standing + record, next-game card, cash, buttons).
- [ ] Build: read player team from `GameState.world.player_team_id`; show rank via `LoopQueries.standings_rows(playerLeague)`, record (W-L-OTL, pts, GF/GA), `LoopQueries.next_game_for`. Buttons: Roster, Standings, Play/Advance, Save. Show **Play match** when next game is on `world.day_of_season`, else **Advance day** (calls `GameState.advance()`). Connect `EventBus` signals (`game_day_advanced`, `match_result`, `season_ended`) to `_refresh()`. Branch `season_ended` on `"GAME_OVER:"` prefix (show game-over) vs champion.
- [ ] Smoke test + green.
- [ ] **Commit** — `feat(ui): dashboard hub`

### Task 12: roster + player_row
**Files:** Create `src/ui/roster.gd/.tscn`, `src/ui/components/player_row.gd/.tscn`; Modify `test_ui_smoke.gd`.
- [ ] `/design` mockup (rows: number/pos, name, age, OVR color-coded, status; goalies grouped).
- [ ] Build: `LoopQueries.roster_rows(playerTeam)` → instance `player_row` per row; OVR via `UIPalette.ovr_color`; injured dimmed + "INJ". Row click → `SceneRouter.goto(player_profile)` passing the player id (via a transient on `SceneRouter` or a small `GameState.selected_player_id`).
- [ ] Smoke test (roster + player_row) + green.
- [ ] **Commit** — `feat(ui): roster + player row`

### Task 13: player_profile + attr_grid
**Files:** Create `src/ui/player_profile.gd/.tscn`, `src/ui/components/attr_grid.gd/.tscn`; Modify `test_ui_smoke.gd`.
- [ ] `/design` mockup (header: number avatar, name, pos, OVR, age/nat/salary/contract; 3-col attr grid color-coded; season stat row).
- [ ] Build: resolve the selected player from `GameState.world`; `attr_grid` takes `[{name, value}]` rows and colors values via `UIPalette.attr_color`. Skater columns: Technical(skating,shooting,passing,puck_handling), Tactical(positioning,defensive_play,power_play), Physical(speed,stamina,checking,composure,team_spirit). Goalie variant: goalie attrs + `save_percentage()`. Stat row: GP/G/A/P/SOG (`season_*`). Back button → `SceneRouter.back()`.
- [ ] Smoke test (profile + attr_grid; instantiate with a stub player) + green.
- [ ] **Commit** — `feat(ui): player profile card + attr grid`

### Task 14: standings + standings_row
**Files:** Create `src/ui/standings.gd/.tscn`, `src/ui/components/standings_row.gd/.tscn`; Modify `test_ui_smoke.gd`.
- [ ] `/design` mockup (table header + rows; player team highlighted; scoring leaders panel).
- [ ] Build: `LoopQueries.standings_rows(playerLeague)` → rows (rank, color+name, GP/W/L/OTL/P/GF/GA/GD), highlight `world.player_team_id`. Side panel `LoopQueries.scoring_leaders(playerLeague, 10)`. Back → dashboard.
- [ ] Smoke test + green.
- [ ] **Commit** — `feat(ui): standings + scoring leaders`

### Task 15: game_report + play-match wiring
**Files:** Create `src/ui/game_report.gd/.tscn`; Modify `dashboard.gd` (Play button), `test_ui_smoke.gd`.
- [ ] `/design` mockup (big score + OT, goals list with names, star-of-game, shots, Continue).
- [ ] Build the Play flow in dashboard: on **Play match**, find player game (`LoopQueries.next_game_for`), resolve home/away `TeamData`, compute `seed = hash("%d-%s-%s" % [world.season, game.home_team_id, game.away_team_id])` (match SeasonManager), `GameRunner.new().run_game(game, home, away, seed)`, then `SceneRouter.goto(game_report)` carrying the result. game_report renders `LoopQueries.match_report(result, world, home.name, away.name)` (names, not ids) + star. **Continue** → `GameState.advance()` (plays the rest of the day's AI games + advances) → `SceneRouter.goto(dashboard)`.
- [ ] Smoke test (game_report with a stub result) + green.
- [ ] **Commit** — `feat(ui): game report + play-match flow`

---

## Phase D — Integration

### Task 16: Full-loop integration test + manual run
**Files:** Create `tests/gut/test_loop_integration.gd`; manual run of the app.
- [ ] **Step 1: Integration test** — start a world, set a player team, then drive `GameState.advance()` (and a manual `GameRunner` for the player game when one is due) in a loop with a guard until the season rolls over; assert: a champion was crowned, season incremented, new schedule exists, and player/team season stats reset. (Pure-logic; no scenes.)
```gdscript
extends GutTest

func test_one_full_season_through_advance():
	var gs = load("res://src/autoload/game_state.gd").new()
	gs.start_new_game("", "")            # full world
	# pick a premier team as player
	var lg = null
	for l in gs.world.leagues:
		if l.tier == LeagueData.Tier.PREMIER: lg = l; break
	gs.world.player_team_id = lg.teams[0].id
	gs.world.player_team_league_id = lg.id
	var season0 = gs.world.season
	var guard = 0
	while gs.world.season == season0 and guard < 20000:
		gs.advance()
		guard += 1
	assert_eq(gs.world.season, season0 + 1, "season rolled over via advance()")
	for l in gs.world.leagues:
		if l.tier == LeagueData.Tier.PREMIER:
			assert_gt(l.schedule.size(), 0, "fresh schedule")
```
- [ ] **Step 2: Run → PASS** + full suite green (Sprint 2's 94 + all new).
- [ ] **Step 3: Manual run** — launch the app (mono Godot, no `--headless`), click through: New Game → pick team → dashboard → roster → a player profile → standings → Play/Advance through several days → a game report → continue → confirm a season eventually rolls over. Capture a screenshot for the visual-quality check vs mockups.
- [ ] **Step 4: Commit** — `test(loop): full-season integration through advance()`
- [ ] **Step 5:** Use superpowers:finishing-a-development-branch.
