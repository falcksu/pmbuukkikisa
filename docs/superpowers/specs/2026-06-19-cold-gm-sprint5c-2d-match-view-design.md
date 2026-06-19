# Cold GM — Sprint 5c: 2D-ottelunäkymä (broadcast)

**Spesifikaatio | 2026-06-19 | Sprint 5c (3/3 S5-kokonaisuudesta)**

> S5a (EHM-attribuutit) → S5b (kontestoitu moottori 2.0) → **S5c (tämä: 2D-näkymä)**.
> Toistaa S5b:n pre-lasketun rikkaan tapahtumavirran broadcast-tyylisessä 2D-näkymässä: pelaajat mailoineen,
> kiekko kantajan lavassa, harhautukset yksiselitteisesti, live-box-score + xG. Lukittu arkkitehtuuri säilyy:
> simu ajetaan loppuun ENNEN visualisointia; 2D on **kosmeettinen replay**. Pohja: tutkimus
> `docs/research/2026-06-19-2d-view-rendering-stats-xg.md` (hyväksytty), mockup hyväksytty brainstormingissa.

---

## 1. Tavoite ja laajuus
**Tavoite:** pelin **pääerottautumistekijä** — pelaaja *katsoo* ottelunsa 2D:nä. Käyttäjän vaatimukset:
(1) pelaajat mailoineen jotka osoittavat kiekkoon, (2) kiekko selvästi kantajalla, (3) harhautus erottuu,
(4) live-box-score kuten EHM mutta modernimpi, (5) xG-esitys, (6) jatkuva liike (lukittu).

**Mukana:** `rink` (custom-draw-kaukalo), `rink_motion` (jatkuva liike), `match_playback` (puhdas toistologiikka
+ tilasto/xG-tally), `match_view` (orkestrointi: HUD, box-score, xG, tikkeri, kontrollit), S3-integraatio
(dashboard "Pelaa ottelu" → 2D → jatka). **Ei tässä:** uusia simumuutoksia (S5b tuotti virran).

---

## 2. Kaksi kerrosta (lukittu)
- **Totuus (deterministinen):** `result`-dict S5b-moottorilta — tulos, `events[]` (rikas skeema), tilastot,
  per-laukaus `xg`. **Read-only.** 2D ei voi muuttaa lopputulosta.
- **Esitys (kosmeettinen, oma seedattu RNG erillään sim-RNG:stä):** `RinkMotion`-virtaus + mailat/hallussapito/
  harhautukset/tilastotweenit. Periaate: `RinkMotion` tuottaa sijainnit joka ruudulla; tapahtumat KAAPPAAVAT
  hetkeksi tietyt toimijat punktuaatioon ja palauttavat kontrollin virtaukselle.
- **Degradoituu siroon virtaan:** jos vain goal/save/penalty (esim. ennen S5b:tä), näkymä toimii silti
  (jatkuva liike + maalit/torjunnat). Box-score-rivit joiden lähdetapahtumia ei ole näyttävät **0** (tyhjä
  tally ei ole bugi). S5c olettaa kuitenkin S5b:n rikkaan virran täyteen kokemukseen.

---

## 3. Renderöinti — `rink.gd/.tscn` (yksi custom-`_draw()`-kangas)
Tutkimuksen suositus B: yksi `Node2D` piirtää kaiken joka ruutu (14 toimijaa = triviaali kuorma).
```
Rink (Node2D, _draw + arrayt; queue_redraw joka ruutu)
├── RinkStatic (Node2D, _draw kerran, vain resize) — jää #e8edf2, sini/keski/maaliviivat, aloituspisteet, maalialueet, maalit
└── PuckHud (CanvasLayer) — HUD, box-score-paneeli, xG, tikkeri, kontrollit (Control-solmut)
```
**Koordinaatit:** normalisoitu (0..1) → `rink_to_px()` cachatusta `rink_rect`:istä (resoluutioriippumaton).
**Luistelijan piirto** (järjestys): kontaktivarjo (alfa 0.18) → body-disc `team.primary_color` + 2px rengas
`secondary_color` → numero `draw_string` kontrastivärillä → **maila** (`draw_line` shaftista terään + teräpätkä,
`#cfd3da`, kantaja 3px). **Mailan suuntaus:** kantaja → kiekkoon; muut → kiekkoon (`(puck−pos).angle()`)
pehmennetty `lerp_angle(a, t, 1−exp(−10·dt))`; MV → kiekkoon eteen-kaareen rajattuna. Värit `TeamData`-hexeistä
cachattuna (jos primaryt liian lähellä → away-rengas secondarysta).

---

## 4. Jatkuva liike — `rink_motion.gd` (kosmeettinen, testattava)
Sama lukittu malli kuin aiemmin: kaukalo EI ole koskaan paikallaan. **Oma pakollinen seedattu RNG.**
Looginen ydin erotettu testattavaksi (kuten `match_playback`). Julkinen API:
```gdscript
class_name RinkMotion
func _init(seed: int)
func set_possession(side, attack_intensity)   # MatchPlayback ohjaa
func step(delta: float) -> void                # päivittää puck + 12 luistelijaa joka ruutu
func puck_pos() -> Vector2
func skater_pos(side, slot) -> Vector2
```
Malli: hallussapidon virtaus (`puck_x` easaa hyökkäysalueelle) + muodostelma-wander (per-disci sin/kohina)
+ tapahtuma-ankkurointi (`set_possession`) + miesvahvuus (jäähy → 4 luistelijaa). **Testitakuu:** usean
`step()`:n jälkeen sijainnit siirtyneet vähintään minimimatkan (ei mikrovärinä), pysyvät rajoissa, hallussapidon
vaihto siirtää virtausta. Kiinteä seed → toistettava.

---

## 5. Kiekon hallinta & harhautus
**Hallussapito päätellään** (ei virrassa): `MatchPlayback.possession_at_current_time() = {side, carrier_slot}`.
Säännöt: aloituksen voittaja → kantaja; onnistunut syöttö → primary→secondary; sieppaus/takeaway/giveaway/hitti
→ puoli vaihtuu; laukaus/torjunta → "loose"; maali → keskelle. **Kiekko terällä:** `blade_tip = pos +
RIGHT.rotated(stick_angle)·len; puck → lerp(blade_tip)` (~12/s, viive = cradle). **Kiekkotrail** (8 sijaintia
haalistuen). **Kantajan korostus:** pulssirengas `secondary_color` (alfa 0.3–0.6, ~2Hz) → kiekkoa ei etsitä.

**Harhautus (yksiselitteinen, ~0.45–0.60s, nopeusskaalattu):** (1) wind-up: kiekko heilahtaa toiselle sivulle
overshootilla; (2) counter-move: kiekko napsahtaa VASTAKKAISELLE puolelle + kantajan juke; (3) puolustajan
**lunge & miss** (kiihtyy fake-sijaintiin, ohitus, kompastus); (4) burst: kantaja kiihtyy ohi + speed-lines.
**Tell = kiekon zigzag-trail** (kirkkaampi/pidempi). Valinnainen slow-mo (0.6×, ~0.3s) vain korkean-xG:n
harhautuksissa (cooldown). Juke-suunta kosmeettisesta seedistä → deterministinen.

---

## 6. Toistologiikka — `match_playback.gd` (puhdas, testattava)
Erotettu visuaalista (GUT testaa ilman renderöintiä).
```gdscript
class_name MatchPlayback
func _init(result: Dictionary, home: TeamData, away: TeamData)
func advance(delta_game_seconds) -> Array     # tapahtumat jotka "laukesivat" tällä askeleella
func score_at_current_time() -> Vector2i
func is_finished() -> bool
func current_period() -> int
func on_ice(team_side) -> Array                # kentällä oleva ketju (vaihtuu ~45s / maalin jälkeen)
func possession_at_current_time() -> Dictionary
func stats_at_current_time() -> Dictionary     # kumulatiivinen box-score-tally (§7)
func xg_at_current_time() -> Dictionary        # {home: float, away: float} + aikajanapisteet
```
Testit: toisto saavuttaa lopputuloksen; tulos kasvaa monotonisesti; jäähyn miesvahvuus oikea kesto;
hallussapitosiirtymät vastaavat tapahtumajonoa; tilasto-/xG-tally ajassa T = odotettu kumulatiivinen.

---

## 7. Live-box-score + xG (`match_view` + Control-solmut)
**Box-score-paneeli:** pysyvä oikea sivupalkki (~300–340px, `#1a1d26` + `#22252e` reuna). GOALS (iso, johtava
kulta `#e3b341`), SOG; **köydenveto-vertailupalkit** (keskiviivasta jaettu, koti vasen / vieras oikea
`primary_color`, suhde home/(home+away)): Shots Blocked, Hits, Giveaways, Takeaways, Faceoffs %, Boardplays %,
Passes %; SPECIAL TEAMS: PP x/y, PK x/y, PIM. **Live:** vain muuttunut rivi animoituu (palkki tween ~0.35s,
numero rullaa, flash maalintekijän värissä); muu paikallaan. Lähde: `MatchPlayback.stats_at_current_time()`.

**xG (3 tasoa):** (1) team-xG-totaalit köydenveto-palkkina + actual vieressä; (2) **xG-game-flow-aikajana**
(`_draw` polyline kumulatiivisesta xG:stä, kaksi joukkuevärillistä viivaa, playhead "nyt" → kasvaa replayssä;
maalit pisteinä); (3) **per-laukaus-vaara:** laukauksen streak tintataan xG:llä lukitulla rating-rampilla
(≥0.20 kulta, 0.08–0.20 vihreä, <0.08 sininen). Lähde: `MatchPlayback.xg_at_current_time()`.

---

## 8. Tapahtuma → visuaali + kontrollit
**Ankkurointi:** `MatchPlayback` katsoo hieman ETEEN ja kutsuu `RinkMotion.set_possession` niin että
laukaus/maali/torjunta-hetkellä virtaus on JO vienyt kiekon oikealle alueelle (punktuaatio nousee virtauksesta).
Tapahtumatyypit kaappaavat toimijat: pass→lane-tween; deke→§5-resepti; hit→lunge+recoil; shot→streak (xG-tintti);
goal→välähdys+juhlinta+GOALS-skaalaus; penalty→aitio+5v4-muodostelma; takeaway/giveaway→lapahyppy.
**Kontrollit (alapalkki):** nopeus 1×/2×/4× (kellon skaalaus), aikalisä (pysäytä), **pikasimu loppuun**
(pysäytä RinkMotion, snäppää tilastot/xG/aikajana loppuun → siirry game_reportiin).

**S3-integraatio:** dashboard "Pelaa ottelu" → `GameRunner.run_game` (tuottaa `result`) →
`SceneRouter.goto(match_view, {result, home_name, away_name})` (sama payload-muoto kuin game_report lukee nyt)
→ 2D-replay → "Jatka/pikasimu" → S3 `game_report` (sama tekstikooste) → `GameState.advance()` → dashboard.
**Säilytä `EventBus.match_result.emit(...)`** dashboardissa ennen `goto`:a (laukaisee dashboard-refreshin;
älä pudota redirectissä). **`match_view` EI kutsu `GameState.advance()`** — se jää game_reportin vastuulle.
**Mikään ei kosketa `result`-dictiä.**

---

## 9. Tiedostorakenne
```
src/ui/match/
  rink.gd/.tscn            UUSI: custom-draw-kaukalo (RinkStatic + Rink._draw)
  rink_motion.gd           UUSI: jatkuva liike (kosmeettinen, seedattu, testattava)
  match_playback.gd        UUSI: puhdas toistologiikka + tilasto/xG-tally
src/ui/
  match_view.gd/.tscn      UUSI: orkestrointi (HUD, box-score, xG, tikkeri, kontrollit)
  dashboard.gd             MUOKKAA: "Pelaa ottelu" → match_view (game_report jää jatkoksi)
src/ui/components/
  stat_bar.gd/.tscn        UUSI: köydenveto-vertailupalkki
tests/gut/
  test_match_playback.gd   UUSI: toisto, possession, tilasto/xG-tally, miesvahvuus
  test_rink_motion.gd      UUSI: jatkuva liike (minimisiirtymä, rajat, possession)
  test_ui_smoke.gd         MUOKKAA: match_view + rink instantioituu headless
```

---

## 10. Testaus
| Taso | Mitä | Miten |
|---|---|---|
| MatchPlayback | toisto→lopputulos, monotoninen, possession-siirtymät, tilasto/xG-tally ajassa T, jäähy-miesvahvuus | GUT-yksikkö |
| RinkMotion | sijainnit muuttuvat ≥minimimatka (ei staattinen), rajoissa, possession ohjaa virtausta | GUT-yksikkö |
| Box-score/xG | köydenveto-suhteet + xG-tally johdettu oikein virrasta | GUT (MatchPlayback-pohjalta) |
| UI-näkymät | match_view + rink instantioituu headless ilman virhettä | GUT scene-smoke |

Pikseliperfektiä ei yksikkötestata; todennetaan smoke + manuaalinen `/design`-vertailu hyväksyttyyn mockupiin.

---

## 11. Hyväksymiskriteerit
- [ ] 2D-näkymä toistaa S5b:n tapahtumavirran broadcast-tyylillä: pelaajat **mailoineen** (osoittavat kiekkoon),
      kiekko **kantajan lavassa** (korostus + trail), **jatkuva liike** (RinkMotion-testi vihreä).
- [ ] **Harhautus erottuu** (zigzag-trail + puolustajan lunge & miss + burst).
- [ ] **Live-box-score** köydenveto-palkein (SOG/blokit/hitit/giveaways/takeaways/faceoff%/board%/pass%/PP/PK/PIM).
- [ ] **xG**: team-totaalit + game-flow-aikajana + vaaratintatut laukaukset.
- [ ] Kontrollit (nopeus/aikalisä/pikasimu); S3-virta dashboard→2D→game_report→advance toimii.
- [ ] Determinismi: `result` read-only; RinkMotion oma seed; `MatchPlayback`-testit + 136+ testiä vihreinä.
- [ ] Ulkoasu vastaa hyväksyttyä mockupia (broadcast-paletti, jaettu Theme).

---

## 12. Roadmap-konteksti
S5a (attr) → S5b (moottori+virta) → **S5c (tämä)** päättää S5-kokonaisuuden: peli on nyt *katsottava* ja
*pelattava* syvällä simulla. Seuraavaksi: scouting/draft, persoonat/moraali→tarinat, AI-GM-suunnitelmat,
historia/ennätykset/dynastiat (markkinatutkimuksen backlog).
