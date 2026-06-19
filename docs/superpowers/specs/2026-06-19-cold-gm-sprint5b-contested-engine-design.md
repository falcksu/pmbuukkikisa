# Cold GM — Sprint 5b: Kontestoitu ottelumoottori 2.0 + xG

**Spesifikaatio | 2026-06-19 | Sprint 5b (2/3 S5-kokonaisuudesta)**

> S5a (EHM-attribuutit) → **S5b (tämä: moottori 2.0)** → S5c (2D-näkymä).
> Korvaa `MatchSimulator.cs`:n SISÄISEN mallin **kontestoidulla hallussapitoketjulla**, säilyttäen lukitun
> arkkitehtuurin: yksi interop-rajapinta, pre-laskettu deterministinen tapahtumavirta, jonka 2D-näkymä
> (S5c) toistaa. Tuottaa rikkaan tapahtumavirran (~400–800/ottelu) + täyden box-scoren + per-laukaus-xG.
> Pohja: `docs/research/2026-06-19-match-engine-2.0-contested-events-xg.md` (hyväksytty brainstormingissa).

---

## 1. Tavoite ja laajuus
**Tavoite:** tehdä attribuuteista aidosti suorituskykyä määrääviä **vastakkainasetteluilla** — esim.
harhautus onnistuu vain jos hyökkääjän `Deking+Stickhandling+Agility` voittaa puolustajan
`Pokecheck+Positioning+Anticipation`. Jokainen S5a:n 27+10 attribuutti ohjaa ≥1 tapahtumaa.

**Mukana:** hallussapitoketju-tilakone (C#), logistinen kontesti-primitiivi, 14 mikrotapahtumaa,
laukaustyypit, **xG** (sama todennäköisyys ratkaisee laukauksen), rikas tapahtumaskeema, box-score-johdanto,
golden-master-testit, Monte-Carlo-kalibrointi. **Rikkaat attribuutit ylittävät interop-rajan** (S5a:n
komposiittishim poistuu simupolulta).

**Ei tässä:** 2D-näkymä (S5c). Tapahtumavirta tuotetaan nyt; S5c visualisoi sen.

---

## 2. Arkkitehtuuri
- **Interop-funktio säilyy:** `MatchSimulator.simulate_game(Dictionary) -> Dictionary`, determinismi `"seed"`.
- **Rikkaat attribuutit boundaryn yli:** `match_adapter.build_team_input` lähettää per-pelaaja KAIKKI
  rikkaat attribuutit (27 skater / 10 MV) `sim_attributes`-komposiittien sijaan. `SimContext.SimSkater`/
  `SimGoalie` saavat rikkaan kenttäsetin; `ParseTeam` lukee ne `.AsInt32()`:llä. **S5a:n `sim_attributes`
  poistuu simupolulta** (voidaan poistaa tai jättää UI-käyttöön).
- **S4 chemistry säilyy:** adapter soveltaa linja-chemistryn per-attribuutti-nudgena ENNEN lähetystä
  (kuten S4:ssä: `clampi(attr + mod, 1, 20)`), TAI lähettää `line_chemistry`-kentän jonka moottori lukee
  `ctx`-modifierina kontesteissa. **Päätös:** lähetä molemmat — nudge attribuutteihin (säilyttää S4-käytöksen)
  + `line_chemistry` per pelaaja (moottori voi käyttää myöhempään hienosäätöön). S5b lukee toistaiseksi nudgatut attr.
  **HUOM defensive-nudge:** S4:n `defensive_mod` nosti komposiittia `defensive_play` (poistuu boundarylta) →
  kohdista se nyt rikkaisiin attr. `pokecheck` + `positioning` (jotka syöttävät puolustuskontesteja 6/7/10),
  ettei two-way/shutdown-D-chemistryn puolustusvaikutus katoa.
- **Replay-arkkitehtuuri ennallaan:** simu ajetaan loppuun → `result` (tulos + `events[]` + tilastot + xG).

---

## 3. Kontesti-primitiivi (lukittu)
```csharp
// Yksi seedattu RNG-virta, kiinteä vetojärjestys = determinismi.
private bool Contest(double aEff, double dEff, double k, double ctx) {
    double x = k * (aEff - dEff) / 20.0 + ctx;
    double p = 1.0 / (1.0 + Math.Exp(-x));
    return _rng.NextDouble() < p;
}
```
- `aEff`/`dEff` = painotetut attribuuttisekoitukset (painot summautuvat 1.0:aan → pysyvät 1–20:ssä).
- `k` = jyrkkyys per tapahtuma (3–5). `ctx` = additiivinen logit-siirtymä (PP/PK, väsymys, kotietu, slider).
- Apuri `double Blend(SimSkater s, params (double w, int attr)[])` laskee `aEff`/`dEff` (väsymys vähentää).

---

## 4. Hallussapidon tilakone
~120–170 hallussapitoa/ottelu. Aika edistyy per tapahtuma seedatulla kestolla (aloitus ~5–15s, tulo ~3–8s,
OZ-toiminto ~2–6s) → kumulatiivinen kello kattaa 3600s + OT/shootout-logiikka säilyy nykyisestä.
```
GAME: aloitus → loop kunnes kello loppuu:
  POSSESSION(owner):
    [aloitus jos faceoff] → alueelletulo (kontrolloitu vs dump)
    loop OZ-toiminnot: valitse {syöttö | harhautus | laitataistelu | laukauspäätös}
        epäonnistuminen → TURNOVER (giveaway/takeaway/sieppaus) → owner vaihtuu
        laukaus → blokki? → torjunta/maali (xG) → rebound?
    turnover/vihellys → hatch; aika eteen; seuraava
  lomita: hitti/taklaus (taisteluissa/tuloissa), jäähy (hiteistä/pokechekeistä/aggressiosta)
```

---

## 5. Mikrotapahtumat (14) — A_eff vs D_eff, k, konteksti
| # | Tapahtuma | Hyökkääjä A_eff | Puolustaja/MV D_eff | k | ctx |
|---|---|---|---|---|---|
| 1 | Aloitus | 0.55·faceoffs + 0.20·strength + 0.15·anticipation + 0.10·work_rate | vastustajan sentteri sama | 3.5 | kotietu |
| 2 | Alueelletulo | 0.30·speed + 0.25·acceleration + 0.20·stickhandling + 0.15·deking + 0.10·off_the_puck | 0.40·positioning + 0.30·anticipation + 0.20·pokecheck + 0.10·speed | 4.0 | PP −D; forecheck-slider |
| 3 | Dump & recover | 0.50·work_rate + 0.30·speed + 0.20·anticipation | 0.40·positioning + 0.30·strength + 0.30·anticipation | 3.0 | tulon fallback |
| 4 | Breakout | 0.40·passing + 0.30·(composure*) + 0.20·stickhandling + 0.10·creativity | 0.45·work_rate + 0.30·aggression + 0.15·anticipation + 0.10·speed | 3.0 | forecheck-slider +D |
| 5 | Forecheck→giveaway | forechecker 0.45·work_rate + 0.30·aggression + 0.25·anticipation | kantaja 0.45·(composure*) + 0.30·stickhandling + 0.15·determination + 0.10·strength | 3.5 | Composure↔forecheck |
| 6 | Syöttö | 0.55·passing + 0.25·creativity + 0.10·anticipation + 0.10·teamwork | sieppaaja 0.55·anticipation + 0.25·positioning + 0.20·pokecheck | 3.5 | Anticipation↔Passing |
| 7 | **Harhautus/1-on-1** | 0.40·deking + 0.30·stickhandling + 0.15·agility + 0.10·creativity + 0.05·flair | 0.40·pokecheck + 0.30·positioning + 0.20·anticipation + 0.10·balance | 4.5 | voitto→off_deke; voi vetää jäähyn |
| 8 | Laitataistelu | 0.40·strength + 0.30·balance + 0.20·determination + 0.10·work_rate | sama vastustaja | 3.0 | voittaja saa kiekon |
| 9 | Hitti | 0.45·hitting + 0.25·strength + 0.20·aggression + 0.10·speed | väistö 0.45·balance + 0.30·strength + 0.15·anticipation + 0.10·agility | 3.0 | osuma kiekolliseen→erotus; aggressio→jäähyriski |
| 10 | Blokki | 0.50·(laukaustyyppi) + 0.30·creativity + 0.20·off_the_puck | 0.50·positioning + 0.25·bravery + 0.15·anticipation + 0.10·determination | 3.0 | Bravery=blokkihalu |
| 11 | Torjunta/maali | laukaustyyppi + xG-konteksti (§7) | MV 0.45·reflexes + 0.20·positioning + 0.15·one_on_ones + 0.10·rebound_control + 0.10·composure | viritetty | **p_goal = xG** |
| 12 | Jäähy | (vedetään, ei Contest()) | rikkoja painotettu 0.55·aggression + 0.25·(20−composure-johd.) + 0.20·hitting | — | tapahtumista 7/9 + slider; offender valitaan painolla (kuten nyk. SelectByChecking) |
| 13 | Rebound | off_the_puck + anticipation (irtokiekko) | MV 0.70·rebound_control + 0.20·recovery + 0.10·positioning | 3.0 | MV→jäädytys; hyökkääjä→rebound (xG-boost) |
| 14 | Takeaway/giveaway | — (tapahtumien 5/6/7/9 lopputulos) | — | — | emergentti, attribuuttipohjainen |

(*) `composure` on poistettu kenttäpelaajilta S5a:ssa → käytä johdannaista `0.5·determination + 0.3·bravery + 0.2·influence` (sama kuin S5a-shimin composure-komposiitti). MV:llä on oma `composure`.

**Laukaustyyppi (§4 tutkimus):** wrist (oletus, wristshot+creativity), slap (etäältä, slapshot+strength),
deflection (maalin edestä, deflections+off_the_puck+bravery), one-timer (syötön jälkeen, +xG, rasittaa reflexes).
**Rivien 10–11 `(laukaustyyppi)` = aktiivisen laukaustyypin attribuutti:** wrist→`wristshot`,
slap→`slapshot`, deflection→`deflections`, one_timer→`wristshot` (one-timer-bonus xG:ssä, ei blendissä).

---

## 6. Tapahtumaskeema (nykyisen superset → vanhat kuluttajat toimivat)
```
{ type, time, period, team, zone(DZ/NZ/OZ), danger(low/med/high|null),
  player_id, target_id, assist_id, assist2_id, result, strength(EV/PP/PK),
  shot_type(wrist/slap/deflection/one_timer|null), xg(double) }
```
Tyypit: faceoff, zone_entry, pass, deke, board_battle, hit, takeaway, giveaway, shot, shot_blocked, save,
goal, rebound, penalty. **Box-score johdetaan virrasta:** Goals=`goal`; SOG=`goal`+`save`; blokit=`shot_blocked`;
PIM=`penalty.duration`; Giveaways/Takeaways/Hits = vastaavat tyypit; Boardplay%/Faceoff%/Pass% = `result`-kentästä.
`TextReport` ja S3 game_report toimivat edelleen (lukevat goal/save/player_id/assist_id).

---

## 7. Expected Goals (xG)
**Sama todennäköisyys ratkaisee laukauksen (tapahtuma 11) JA on xG** → team xG = odotetut maalit rakenteellisesti.
```
logit_xg = base[danger] + type_bonus[shot_type]
         + (rebound? +0.90) + (off_deke? +0.55) + (rush? +0.20) + (screen? +0.35)
         + strength_adj + finish_adj − goalie_adj + score_state_adj
xg = 1/(1+exp(−logit_xg));  goal = rng < xg
```
Lähtövakiot: base low −3.0 / med −2.0 / high −1.1; type_bonus wrist 0 / slap −0.15 / one_timer +0.45 /
deflection +0.55; PP +0.30 / SH −0.15; finish_adj = +0.6·(weapon−10)/10; goalie_adj = +0.9·(G_blend−10)/10.
`danger` syntyy ketjusta (harhautuksen jälkeen slottiin → high; piste­laukaus → low). **Tilastot:** player
`xG_for`, `GAx=goals−xG_for`; goalie `xGA`, `GSAx=xGA−GA` → pelaajakortti + box-score.

---

## 8. Determinismi & testistrategia
- **Determinismi:** yksi `Random(seed)`, kiinteä vetojärjestys, `double`-vakiot `SimConstants`-lohkossa, single-thread.
- **Golden-master:** canonical fixture+seed → tallenna koko `result`-dict snapshotiksi → assert yhtäsuuruus.
  Re-bake tietoisesti kun vakioita viritetään (näkyvä diff).
- **Säilyvät testit:** invariantit (Σ pelaajamaalit==score, Σ MV GA==vastustajan maalit, shutout, OT/shootout),
  tilastolliset (vahva voittaa, PP nostaa laukauksia, slider→jäähyt), järjestys. Determinismi-testi vahvistuu
  (koko virran yhtäsuuruus).
- **Korvattavat:** tarkkojen lukujen regressiot (vanha lineaarimalli) → golden-master. `test_match_simulator.gd`
  rakentaa raa'at interop-dictit thin-avaimilla → **kirjoita fixturet rikkaaseen skeemaan** (rich attr-avaimet).
- **Uudet counter-testit:** esim. korkea-deking-hyökkääjä vs matala-pokecheck-puolustaja → enemmän onnistuneita
  tuloja/harhautuksia/jäähyjä monen seedin yli (estää kuolleet attribuutit). Yksi testi per headline-counter (§5).

---

## 9. Kalibrointitavoitteet (per joukkue/ottelu; Monte-Carlo 1000–5000 ottelua)
Maalit ~3.0–3.3; SOG 30–34; blokit 13–16; SH% ~9–10%; FOW% ~50; pass% 75–82; boardplay% ~50; hitit 18–26;
takeaways 5–9; giveaways 7–12; PIM ~8–12; PP% 18–22; SV% .900–.910; **team xGF/GF ±3%**.
Viritysjärjestys (ulko→sisä, etteivät kerrokset taistele): hallussapidon volyymi → xG base → tapahtuma-jakaumat
→ skill-kontrasti `k` → PP/PK → lukitse golden-master. Hyväksyntäkynnys `k`:lle: +6 attr-etu ≈ 62–68% voitto;
all-14 vs all-10 joukkue voittaa ~60–65% (ei 95%). CI-vahdit löysillä rajoilla.

---

## 10. Muutettavat tiedostot
| Tiedosto | Muutos |
|---|---|
| `src/core/MatchSimulator.cs` | korvaa sisäinen tikkimalli hallussapitoketju-tilakoneella + 14 kontestia + xG + tapahtumaskeema; `SimConstants`-lohko |
| `src/core/SimContext.cs` | `SimSkater`/`SimGoalie` rikas attribuuttisetti (27/10); hallussapito-/tilakonetila |
| `src/sim/match_adapter.gd` | `build_team_input` lähettää rikkaat attr. (S4 chemistry-nudge säilyy); `sim_attributes` pois simupolulta |
| `tests/gut/test_match_simulator.gd` | fixturet rikkaaseen skeemaan; tilastolliset + counter-testit |
| `tests/gut/test_*` (golden-master) | uusi `test_match_golden.gd` (snapshot-determinismi) |
| `dotnet build` pakollinen .cs-muutoksen jälkeen | — |

**C# muuttuu tässä sprintissä** (toisin kuin S5a). Interop-FUNKTIO ja determinismikontrakti säilyvät.

---

## 11. Hyväksymiskriteerit
- [ ] Moottori on hallussapitoketju 14 kontestilla; jokainen S5a-attribuutti ohjaa ≥1 tapahtumaa (counter-testit vihreinä).
- [ ] Tapahtumavirta sisältää uudet tyypit + skeeman (zone/shot_type/xg/result); box-score johdettavissa virrasta.
- [ ] xG: sama todennäköisyys ratkaisee laukauksen; team xGF/GF ±3% 1000 ottelussa.
- [ ] Determinismi säilyy (golden-master snapshot vihreä; sama seed → identtinen virta).
- [ ] Kalibrointi §9 rajoissa; invariantit pitävät; `TextReport`/game_report toimivat.
- [ ] Rikkaat attribuutit boundaryn yli; `sim_attributes` pois simupolulta.

---

## 12. Roadmap-konteksti
S5a (attr) ✅-edellytys → **S5b (tämä)** → S5c (2D-näkymä toistaa tämän rikkaan virran: mailat, kiekon hallinta,
harhautus-visualisointi, köydenveto-box-score, xG-timeline). S5c-tutkimus: `docs/research/2026-06-19-2d-view-*`.
