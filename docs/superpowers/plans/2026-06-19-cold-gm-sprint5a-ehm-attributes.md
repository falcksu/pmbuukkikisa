# Cold GM Sprint 5a — EHM Attribute Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Expand the player model from 12 thin attributes to a rich EHM set (27 skater + 10 goalie) without changing the C# simulator, via a composite shim, keeping all 136 existing tests green.

**Architecture:** **Additive-first migration.** The model change is breaking (removing a field breaks every consumer at once). So we ADD the 27 new attributes alongside the old 12, route the simulator input through a composite shim that reads the NEW attributes, migrate every consumer + test to the new attributes, and only DELETE the old 12 in the final task. Tests stay green at every step.

**Tech Stack:** Godot 4.6.3 mono, GDScript (C# untouched), GUT v9.6.0.

**Branch:** S5a builds on S4's `RoleSystem`/`LineupSystem`. **Prerequisite: S4 merged to master.** Create `sprint5a-ehm-attributes` from master.

**Running tests / conventions:** see `AGENTS.md` (mono Godot, dotnet on PATH, two `--import` passes, GUT cmdln). GDScript uses **tab** indentation. `push_warning` not `push_error`. Commit per task. After each task, update `PROGRESS.md`.

**Spec:** `docs/specs/2026-06-19-cold-gm-sprint5a-ehm-attributes-design.md`.

### ⚠️ GoalieData inheritance subtlety (read before Task 1 and Task 12)
`GoalieData extends PlayerData`, so it inherits all skater attributes. The 10 goalie attributes map as:
- **Reused from parent (no redeclare):** `positioning`, `bravery`, `agility` (present on the new PlayerData).
- **Goalie-owned, present on parent during the additive phase:** `puck_handling`, `composure` — the goalie uses the inherited ones until Task 12 removes them from PlayerData; in Task 12 GoalieData declares its **own** `puck_handling` and `composure` (no shadow once the parent drops them).
- **Goalie-owned, declared in Task 1:** `reflexes` (already exists), `rebound_control`, `recovery`, `one_on_ones`, `concentration`.

---

## File Structure
```
src/models/player_data.gd        add 27 attrs + meta; positiopainotettu overall_rating; remove old 12 (Task 12)
src/models/goalie_data.gd        goalie attrs; goalie overall_rating; remove old (Task 12)
src/systems/sim_attributes.gd    NEW: composite shim (new attrs -> old interop keys)
src/data/player_generator.gd     generate new attrs + meta
src/data/save_manager.gd         serialize new attrs
src/systems/training_system.gd   attrs list -> new
src/systems/role_system.gd       role_fit/chemistry weights -> new
src/systems/lineup_system.gd     goalie sort save_ability -> overall_rating
src/sim/match_adapter.gd         build_team_input -> sim_attributes composites
src/ui/lines.gd                  goalie display save_ability -> overall_rating/save%
src/ui/player_profile.gd         3-column EHM grid + player type + role fits
tests/gut/test_sim_attributes.gd NEW
tests/gut/_helpers... make_skater/make_goalie in each migrated test (or a shared helper script)
```

---

## Task 1: Add 27 skater + goalie attributes (additive — keep old)

**Files:** Modify `src/models/player_data.gd`, `src/models/goalie_data.gd`; Test `tests/gut/test_player_data.gd` (add, don't rewrite yet)

- [ ] **Step 1: Failing test** — assert the new attributes exist and default to 10.
```gdscript
func test_new_ehm_attributes_exist_and_default_10():
	var p := PlayerData.new()
	for a in ["checking","deflections","deking","faceoffs","hitting","off_the_puck","passing","pokecheck","positioning","slapshot","stickhandling","wristshot","aggression","anticipation","bravery","creativity","determination","flair","influence","teamwork","work_rate","acceleration","agility","balance","speed","stamina","strength"]:
		assert_eq(p.get(a), 10, a + " defaults to 10")
	assert_eq(p.handedness, PlayerData.Handedness.LEFT)

func test_goalie_new_attributes_exist():
	var g := GoalieData.new()
	for a in ["reflexes","rebound_control","recovery","one_on_ones","concentration"]:
		assert_eq(g.get(a), 10, a + " defaults to 10")
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — add to `player_data.gd` (KEEP the old 12 for now):
```gdscript
enum Handedness { LEFT, RIGHT }
# Technical (12)
@export var checking: int = 10
@export var deflections: int = 10
@export var deking: int = 10
@export var faceoffs: int = 10
@export var hitting: int = 10
@export var off_the_puck: int = 10
@export var passing_new: int = 10   # NOTE: 'passing' already exists (old). Use a temp then rename in Task 12.
# ... (see note below)
```
**Naming-collision note:** `passing`, `positioning`, `speed`, `stamina`, `checking` already exist as old attributes. For these five, the old field already carries the right meaning — KEEP the existing field and do NOT add a duplicate. The genuinely new skater fields to add are: `deflections, deking, faceoffs, hitting, off_the_puck, pokecheck, slapshot, stickhandling, wristshot` (technical), all 9 mental, and `acceleration, agility, balance, strength` (physical — `speed`/`stamina` already exist). Plus meta: `handedness`, `secondary_position`, `height_cm`, `weight_kg`.
For `goalie_data.gd` add: `rebound_control, recovery, one_on_ones, concentration` (`reflexes` exists; `positioning`/`bravery`/`agility`/`puck_handling`/`composure` come from the parent during this phase).

- [ ] **Step 4: Run → PASS** + full suite still green.
- [ ] **Step 5: Commit** — `feat(model): add EHM attributes (additive)`

---

## Task 2: sim_attributes.gd composite shim

**Files:** Create `src/systems/sim_attributes.gd`; Test `tests/gut/test_sim_attributes.gd`

- [ ] **Step 1: Failing test** — uniform level L → every composite returns L; stronger profile → higher shooting.
```gdscript
extends GutTest

func _skater(level: int) -> PlayerData:
	var p := PlayerData.new()
	for a in ["deflections","deking","faceoffs","hitting","off_the_puck","pokecheck","slapshot","stickhandling","wristshot","aggression","anticipation","bravery","creativity","determination","flair","influence","teamwork","work_rate","acceleration","agility","balance","strength","passing","positioning","speed","stamina","checking"]:
		p.set(a, level)
	return p

func test_uniform_level_maps_each_composite_to_level():
	var p := _skater(13)
	var c := SimAttributes.skater_input(p)
	for key in ["shooting","passing","defensive_play","positioning","power_play","speed","checking","composure","stamina"]:
		assert_eq(int(c[key]), 13, key + " == uniform level")

func test_stronger_shooting_profile_scores_higher():
	var weak := _skater(8); var strong := _skater(8)
	strong.wristshot = 18; strong.slapshot = 18; strong.deking = 18; strong.off_the_puck = 18
	assert_gt(int(SimAttributes.skater_input(strong)["shooting"]), int(SimAttributes.skater_input(weak)["shooting"]))
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `sim_attributes.gd` — the §3 table (weights sum to 1.0), `round()` to int:
```gdscript
class_name SimAttributes

static func skater_input(p: PlayerData) -> Dictionary:
	return {
		"shooting": _r(0.40*p.wristshot + 0.30*p.slapshot + 0.20*p.deking + 0.10*p.off_the_puck),
		"passing": _r(0.60*p.passing + 0.40*p.creativity),
		"defensive_play": _r(0.40*p.pokecheck + 0.30*p.positioning + 0.30*p.anticipation),
		"positioning": _r(0.60*p.positioning + 0.40*p.off_the_puck),
		"power_play": _r(0.35*p.wristshot + 0.25*p.passing + 0.25*p.off_the_puck + 0.15*p.creativity),
		"speed": _r(0.50*p.speed + 0.50*p.acceleration),
		"checking": _r(0.45*p.checking + 0.35*p.hitting + 0.20*p.aggression),
		"composure": _r(0.50*p.determination + 0.30*p.bravery + 0.20*p.influence),
		"stamina": p.stamina,
	}

static func goalie_input(g: GoalieData) -> Dictionary:
	return {
		"save_ability": _r(0.35*g.reflexes + 0.30*g.positioning + 0.20*g.one_on_ones + 0.15*g.rebound_control),
		"reflexes": g.reflexes, "goalie_positioning": g.positioning, "mental_strength": g.concentration,
	}

static func _r(v: float) -> int:
	return clampi(int(round(v)), 1, 20)
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(sim): composite attribute shim`

---

## Task 3: Shared test helpers make_skater / make_goalie

**Files:** Create `tests/gut/lib/attr_helpers.gd` (a plain helper, or inline per test); Test: used by later tasks.

- [ ] Add a helper that sets ALL new attributes (and old, during additive phase) to a level, so migrated tests get predictable uniform inputs:
```gdscript
class_name AttrHelpers
static func make_skater(id: String, level: int) -> PlayerData:
	var p := PlayerData.new(); p.id = id
	for a in PlayerData.new().get_property_list():
		pass # set known attribute list explicitly (see Task 2 list) to `level`
	return p
```
(Set the explicit attribute list, not reflection, for clarity.) Include `make_goalie(id, level)` setting goalie attrs too.
- [ ] **Commit** — `test: shared attribute helpers`

---

## Task 4: Route match_adapter through the shim

**Files:** Modify `src/sim/match_adapter.gd`; Test `tests/gut/test_match_adapter.gd`
- [ ] **Step 1:** Migrate test fixtures to `AttrHelpers.make_skater(level)`. Assert the built interop dict still has the 9 skater keys + goalie keys and that a uniform team yields those keys == level.
- [ ] **Step 2: Run → FAIL** (adapter still reads old raw fields).
- [ ] **Step 3:** In `build_team_input`, replace the raw `"shooting": p.shooting, ...` block with `SimAttributes.skater_input(p)` merged with `{"id":p.id, "role":..., "line_chemistry":..., "fatigue":p.fatigue}`; goalie via `SimAttributes.goalie_input(g)` + id/fatigue. Keep S4 chemistry modifiers applied ON TOP of the composite values.
- [ ] **Step 4: Run → PASS** + full suite green (sim behaviour identical under uniform attrs).
- [ ] **Step 5: Commit** — `refactor(sim): adapter uses composite shim`

---

## Task 5: Position-weighted overall_rating

**Files:** Modify `player_data.gd`, `goalie_data.gd`; Test `tests/gut/test_player_data.gd`
- [ ] **Step 1: Failing test** — a forward with high wristshot/slapshot/deking/off_the_puck/speed/anticipation outrates a flat-10 forward; goalie OVR weights reflexes/positioning/rebound_control/one_on_ones/composure.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Implement positiopainotus (§2.3): key attrs ×1.5, others ×1.0, normalized back to 1–20. Override `overall_rating()` in GoalieData for the goalie key set. (Old `overall_rating` formula still references old fields — keep it working by computing from new attrs now.)
- [ ] **Step 4: Run → PASS** + migrate any test asserting specific OVR values (`test_loop_queries` roster sort still works by relative OVR).
- [ ] **Step 5: Commit** — `feat(model): position-weighted overall_rating`

---

## Task 6: RoleSystem remap to new attributes

**Files:** Modify `src/systems/role_system.gd`; Test `tests/gut/test_role_system.gd`
- [ ] **Step 1:** Migrate `test_role_system` fixtures to set new attrs (sniper → high wristshot/slapshot/deking; playmaker → high passing/stickhandling/creativity; etc.). Assertions on archetype detection stay.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Replace role_fit weights with §4 table; chemistry intangibles use `teamwork` (was team_spirit) and a determination-derived term (was composure).
- [ ] **Step 4: Run → PASS** + full suite green.
- [ ] **Step 5: Commit** — `refactor(roles): remap role fit to EHM attributes`

---

## Task 7: PlayerGenerator generates new attributes + meta

**Files:** Modify `src/data/player_generator.gd`; Test `tests/gut/test_player_generator.gd`
- [ ] **Step 1:** Test asserts every new attr is in 1–20, position-appropriate spread (forwards higher shooting cluster, D higher pokecheck/checking), and meta set (handedness ~mostly LEFT over many, height/weight in sane ranges).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Generate all new attrs with position-specific base/spread + meta. Goalie generates goalie attrs.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(gen): generate EHM attributes + meta`

---

## Task 8: SaveManager serializes new attributes

**Files:** Modify `src/data/save_manager.gd`; Test `tests/gut/test_save_manager.gd`
- [ ] **Step 1:** Roundtrip test: generate a world, save, load, assert new attrs + meta survive (and goalie attrs).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Add new short keys for all new attrs + meta; read them back. (No old-save compatibility required.)
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(save): serialize EHM attributes`

---

## Task 9: TrainingSystem attribute list

**Files:** Modify `src/systems/training_system.gd`; Test `tests/gut/test_training_system.gd`
- [ ] **Step 1:** Migrate test to a surviving/new attribute target (e.g. `wristshot`).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Replace the `attrs` list with the 27 new attrs; map training focuses (TECHNIQUE/PHYSICAL/TACTICS) to new-attr subsets.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `refactor(training): develop EHM attributes`

---

## Task 10: Lineup goalie sort + lines goalie display

**Files:** Modify `src/systems/lineup_system.gd`, `src/ui/lines.gd`; Test `tests/gut/test_lineup_system.gd`
- [ ] **Step 1:** Migrate `test_lineup_system` fixtures to helpers. Assert goalie depth chart picks the higher-`overall_rating()` goalie.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3:** Replace `_best_goalie` / `starting_goalie` sort key `save_ability` with `overall_rating()`. In `lines.gd` replace `goalie.save_ability` display with `overall_rating()` (or `save_percentage()`).
- [ ] **Step 4: Run → PASS** + `test_ui_smoke` green.
- [ ] **Step 5: Commit** — `refactor(lines): goalie ordering by overall_rating`

---

## Task 11: Player profile EHM grid

**Files:** Modify `src/ui/player_profile.gd`, maybe `src/ui/components/attr_grid.gd`; Test `tests/gut/test_ui_smoke.gd`
- [ ] **Step 1:** Smoke test still instantiates; (optionally) a small test that the grid builds 27 rows for a skater, 10 for a goalie.
- [ ] **Step 2:** Build 3-column grid (Technical/Mental/Physical) colored via `UIPalette.attr_color`; header shows `RoleSystem.player_type` + `RoleSystem.best_roles`; goalie variant shows goalie attrs + `save_percentage()`. Match the approved mockup.
- [ ] **Step 3: Run → PASS** (smoke green).
- [ ] **Step 4: Commit** — `feat(ui): EHM player profile grid`

---

## Task 12: Remove old attributes + rewrite test_player_data + stragglers

**Files:** Modify `player_data.gd`, `goalie_data.gd`; Rewrite `tests/gut/test_player_data.gd`; fix `test_loop_integration.gd`, `test_game_state_advance.gd`
- [ ] **Step 1:** Rewrite `test_player_data.gd` to assert the NEW 27/10 model (existence, defaults, positiopainotettu OVR) — remove the old-model assertions.
- [ ] **Step 2:** Migrate `test_loop_integration` (`team_spirit`/`composure`) and `test_game_state_advance` (`shooting`/`save_ability`) to helpers/new attrs.
- [ ] **Step 3:** Remove old fields from `PlayerData` (`skating, shooting, puck_handling, defensive_play, power_play, composure, team_spirit`) and `GoalieData` (`save_ability, goalie_positioning, mental_strength`). Declare goalie-owned `puck_handling` and `composure` on `GoalieData` now (parent no longer has them). Remove `average_technical`.
- [ ] **Step 4: Run → grep confirms zero references to removed names in src/ and tests/; full suite GREEN (all 136 + new tests).**
- [ ] **Step 5: Commit** — `refactor(model): remove legacy 12-attribute set`

---

## Final
- [ ] Dispatch a final code-review subagent over the whole S5a diff.
- [ ] Update `PROGRESS.md` (S5a complete; NEXT UP → S5b engine spec).
- [ ] superpowers:finishing-a-development-branch.
