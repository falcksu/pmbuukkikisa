# Tutkimus: Cold GM ottelumoottori 2.0 — kontestoidut tapahtumat + xG

**2026-06-19 · tutkimus/suunnittelu (ei koodia) · lähde: tutkimusagentti 1**

> Tämä korvaa nykyisen `MatchSimulator.cs`:n SISÄISEN mallin mutta säilyttää lukitun
> arkkitehtuurin: yksi interop-rajapinta, täysin pre-laskettu deterministinen tapahtumavirta,
> jonka 2D-näkymä toistaa. Tämä on oma erillinen "moottori"-sprintti (Phase 0:n jälkeen).

## 0. Ydin
Nykyinen moottori (per-sekunti laukaustodennäköisyys yhdellä komposiitilla) ei pysty toteuttamaan
"jokainen attribuutti merkitsee, oikein vastustettuna" -tavoitetta. Korvataan **hallussapitoketju-
simulaattorilla**: peli = jono hallussapitoja; kukin kulkee pienen tilakoneen läpi (aloitus → alueelle­
tulo → forecheck/laitataistelu → kuljetus/harhautus/syöttö → laukaus → blokki/torjunta → rebound),
jokainen ratkaistaan **logistisella kontestilla** painotetuista attribuuteista + konteksti + seedattu RNG.

## 1. Kontestin perusprimitiivi (lukittu)
```
contest(A_eff, D_eff, k, ctx):
    x = k * (A_eff - D_eff) / 20.0 + ctx     # attr. 1–20 normalisoituna
    p = 1 / (1 + exp(-x))                     # logistinen
    return rng.NextDouble() < p               # yksi seedattu virta
```
- `A_eff`/`D_eff` = painotetut sekoitukset (painot summautuvat 1.0:aan, pysyvät 1–20-asteikolla).
- `k` = jyrkkyys per tapahtuma (k≈3–5: +5 attr-ero ≈ 60–72% voitto, +10 ≈ 70–85%).
- `ctx` = additiivinen logit-siirtymä tilanteelle (PP/PK, väsymys, kotietu, tulos).
- **Yksi RNG-virta, kiinteä vetojärjestys** = determinismi (sama input+seed → identtinen tulos).

Miksi logistinen eikä nykyinen lineaarinen `saveProb − shotQuality`? Sigmoid ei koskaan ylitä (0,1),
tekee countereista symmetrisiä ja viritettäviä yhdellä `k`:lla.

## 2. Hallussapidon tilakone
~120–170 hallussapitoa/ottelu (NHL-tahti) per-sekunnin 3600 tikin sijaan. Aika edistyy per tapahtuma
seedatulla kestolla → 2D-replaylla on silti realistinen kello. Looppi: aloitus → alueelletulo →
(syöttö | harhautus | laitataistelu | laukauspäätös)* → laukaus → blokki?/torjunta?/rebound? →
käännös/vihellys → seuraava. Hitit ja jäähyt lomittuvat.

## 3. Mikrotapahtumat (hyökkääjä-attr. vs puolustaja/MV-attr.)
| # | Tapahtuma | Hyökkääjä A_eff | Puolustaja/MV D_eff | k | Konteksti |
|---|---|---|---|---|---|
| 1 | Aloitus | 0.55·Faceoffs + 0.20·Strength + 0.15·Anticipation + 0.10·WorkRate | vastustajan sentteri sama | 3.5 | kätisyys, pieni kotietu |
| 2 | Alueelletulo (kontrolloitu) | 0.30·Speed + 0.25·Acceleration + 0.20·Stickhandling + 0.15·Deking + 0.10·OffThePuck | 0.40·Positioning + 0.30·Anticipation + 0.20·Pokecheck + 0.10·Speed | 4.0 | PP → −D; korkea forecheck → vaikeampi |
| 3 | Dump & recover | 0.50·WorkRate + 0.30·Speed + 0.20·Anticipation | 0.40·Positioning + 0.30·Strength + 0.30·Anticipation | 3.0 | tulon fallback → laitataistelu |
| 4 | Breakout / alueelta ulos | 0.40·Passing + 0.30·Composure + 0.20·Stickhandling + 0.10·Creativity | 0.45·WorkRate + 0.30·Aggression + 0.15·Anticipation + 0.10·Speed | 3.0 | forecheck-slider nostaa D |
| 5 | Forecheck → giveaway | forechecker 0.45·WorkRate + 0.30·Aggression + 0.25·Anticipation | kantaja vastustaa: 0.45·Composure + 0.30·Stickhandling + 0.15·Determination + 0.10·Strength | 3.5 | **Composure vs forecheck** -counter; häviö → giveaway |
| 6 | Syöttö | 0.55·Passing + 0.25·Creativity + 0.10·Anticipation + 0.10·Teamwork | sieppaaja 0.55·Anticipation + 0.25·Positioning + 0.20·Pokecheck | 3.5 | **Anticipation vs Passing**; häviö → sieppaus/takeaway |
| 7 | **Harhautus / 1-on-1** | 0.40·Deking + 0.30·Stickhandling + 0.15·Agility + 0.10·Creativity + 0.05·Flair | 0.40·Pokecheck + 0.30·Positioning + 0.20·Anticipation + 0.10·Balance | 4.5 | käyttäjän headline-counter; voitto → `off_deke=true` (xG-boost), voi vetää jäähyn |
| 8 | Laitataistelu | 0.40·Strength + 0.30·Balance + 0.20·Determination + 0.10·WorkRate | sama vastustaja | 3.0 | **Strength/Balance vs Hitting**; voittaja saa kiekon ("Boardplay Won") |
| 9 | Hitti / taklaus | 0.45·Hitting + 0.25·Strength + 0.20·Aggression + 0.10·Speed | väistö 0.45·Balance + 0.30·Strength + 0.15·Anticipation + 0.10·Agility | 3.0 | osunut → `hit`; vahva osuma kiekolliseen → erotus (turnover); Aggression nostaa jäähyriskiä |
| 11 | Laukauksen blokki | 0.50·(laukaustyyppi) + 0.30·Creativity + 0.20·OffThePuck | 0.50·Positioning + 0.25·Bravery + 0.15·Anticipation + 0.10·Determination | 3.0 | **Bravery** = blokkihalukkuus; blokki → `shot_blocked` |
| 12 | Torjunta / maali | laukaustyyppi + xG-konteksti (§4) | 0.45·Reflexes + 0.20·Positioning + 0.15·OneOnOnes + 0.10·ReboundControl + 0.10·Composure | viritetty SV%≈.905 | **xG-ratkaisu**: `p_goal = xG` |
| 13 | Jäähy | (vedetään, ei kontesti) | rikkoja: 0.55·Aggression + 0.25·(20−Composure) + 0.20·holtittomuus | — | laukeaa tapahtumista 7/9, team aggressiveness; vedetyt jäähyt hyvittävät hyökkääjälle |
| 14 | Rebound | 0.x·OffThePuck + Anticipation (irtokiekolle) | MV 0.70·ReboundControl + 0.20·Recovery + 0.10·Positioning | 3.0 | MV voittaa → jäädytys; hyökkääjä → rebound-laukaus (`rebound=true`, iso xG-boost) |

**Takeaways/giveaways ovat tapahtumien 5/6/7/9 LOPPUTULOKSIA**, ei erillisiä kontesteja → todellinen
attribuuttipohja (Anticipation, Pokecheck, Composure, Strength), emergenttejä eivätkä satunnaisia.

## 4. Laukaustyypin valinta
Wrist (oletus/slot, Wristshot+Creativity), Slap (etäältä/one-timer, Slapshot+Strength),
Deflection (maalin edestä, Deflections+OffThePuck+Bravery), One-timer (syötön jälkeen, +xG-bonus,
rasittaa Reflexes). Näin Wristshot/Slapshot/Deflections counteroivat Reflexes/Positioning/One-on-Ones.

## 5. Attribuutti → vaikutus -matriisi (ei kuolleita attribuutteja)
Jokainen 27 kenttäpelaaja- + 10 MV-attribuutti ohjaa ≥1 tapahtumaa ja sillä on nimetty counter.
Avain-counterit: Deking↔Pokecheck (7), Speed/Acceleration↔Positioning (2), Strength/Balance↔Hitting
(8/9), Composure↔forecheck (5), Anticipation↔Passing (6), Faceoffs head-to-head (1),
Wristshot/Slapshot/Deflections↔Reflexes/Positioning/One-on-Ones (12). Bravery→blokkaus/maalinedusta;
Flair→harhautusdeception + off_deke-bonus; Influence→kapteenin team-wide ctx; Teamwork→syöttötarkkuus
linjassa; WorkRate→forecheck/backcheck; Recovery→toinen torjunta; PuckHandling(G)→breakout-apu;
Concentration(G)→soft goal -varianssi; Agility(G)→one-timer/post-to-post. (Täysi matriisi tutkimuksen
liitteessä — jokaiselle attribuutille: vaikuttaa / counteroidaan.)

## 6. Box-score → tapahtuma-mappaus + tapahtumaskeema
Stats johdetaan virrasta: Goals=`goal`; SOG=`goal`+`save`; Shots Blocked=`shot_blocked`;
PP x/y, PK x/y `penalty`+strength-markkereista; PIM=`penalty.duration`; Giveaways=`giveaway`;
Takeaways=`takeaway`; Hits=`hit`(osunut); Boardplays Won %=`board_battle.won`; Faceoffs Won %=`faceoff.winner`;
Passes Completed %=`pass.completed`.

**Tapahtumaskeema (nykyisen superset, vanhat kuluttajat toimivat):**
```
{ type, time, period, team, zone(DZ/NZ/OZ), danger(low/med/high|null),
  player_id, target_id, assist_id, assist2_id, result, strength(EV/PP/PK),
  shot_type(wrist/slap/deflection/one_timer|null), xg(double) }
```
Volyymi ~400–800 tapahtumaa/ottelu (nykyinen 50–70). Hyvin budjetissa (pre-laskettu virta). 2D-tikkeri
suodattaa "headline"-tapahtumiin; liike voi käyttää kaikkia. `zone`-data PARANTAA §7.4-ankkurointia.

## 7. Expected Goals (xG)
Hockey-xG:n ajurit (kirjallisuus): laukauspaikka/vaaravyöhyke, kulma, laukaustyyppi (deflection/one-timer
> wrist > slap etäältä), rebound (vahva +), rush (marginaalinen kun paikka kontrolloitu), screen/traffic,
voimatilanne. Ei tarvita koordinaatteja — simu TIETÄÄ kontekstuaaliset vastineet laukaushetkellä.

**Per-laukaus xG (laskee saman ratkaisun kuin torjunta):**
```
logit_xg = base[danger] + type_bonus[shot_type]
         + (rebound ? +0.90 : 0) + (off_deke ? +0.55 : 0) + (rush ? +0.20 : 0)
         + (screen ? +0.35 : 0) + strength_adj + finish_adj - goalie_adj + score_state_adj
xg = 1/(1+exp(-logit_xg));  goal = rng < xg     # SAMA veto ratkaisee tapahtuman 12
```
Lähtövakiot: base[low]=−3.0(≈4.7%), base[med]=−2.0(≈11.9%), base[high]=−1.1(≈25%); type_bonus wrist 0,
slap −0.15, one_timer +0.45, deflection +0.55; PP +0.30 / SH −0.15;
finish_adj=+0.6·(weapon−10)/10; goalie_adj=+0.9·(G_blend−10)/10.

**Kriittinen ominaisuus:** koska sama `xg` ratkaisee laukauksen, **team xG = odotetut maalit
rakenteellisesti** (Σ xG ≈ Σ maalit monen ottelun yli). Player: xG_for, GAx=goals−xG_for (viimeistely);
Goalie: xGA, GSAx=xGA−GA. Näytetään pelaajakortilla ja box-scoressa.

## 8. Arkkitehtuuri, determinismi, testit
- **Rikkaat attribuutit ylittävät interop-rajan suoraan** (per-pelaaja-dict ~10 → ~27/~10 avainta).
  Pudota komposiittikerros simun kuumalta polulta (se tuhoaisi tiedon jota kontestit tarvitsevat).
  Interop-FUNKTIO säilyy: `simulate_game(Dictionary)→Dictionary`. `ParseTeam` lukee samalla `.AsInt32()`.
  **RISTIRIITA-LIPPU:** tämä on ristiriidassa nyk. Sprint 3 -speksin §5.0 "C# muuttumaton / komposiitti"
  kanssa. Ratkaisu: Phase 0 (rikkaat attr. + komposiittishim, simu ennallaan) ENSIN; tämä moottori
  OMANA sprinttinään jälkeenpäin, jolloin shim poistetaan simupolulta. Lukittu replay-arkkitehtuuri säilyy.
- **Determinismi:** yksi RNG-virta, kiinteä järjestys, `double`-vakiot, single-thread → golden-master.
- **94 testiä:** determinismi/tilastolliset/järjestys/invariantit (Σ maalit==score, Σ GA) SÄILYVÄT.
  Tarkat numeeriset regressiot → **golden-master-snapshotit** (canonical fixture+seed → tallenna result-dict).
  `test_match_simulator.gd` (raaka interop-dict, thin-avaimet) → kirjoita fixturet rikkaaseen skeemaan.
  Lisää **counter-kohtaiset behavioral-testit** (esim. korkea-Deking vs matala-Pokecheck → enemmän
  onnistuneita tuloja/jäähyjä) — estää kuolleet attribuutit.

## 9. Kalibrointitavoitteet (per joukkue/ottelu)
Maalit ~3.0–3.3; SOG 30–34; blokit 13–16; SH% ~9–10%; FOW% 50; pass% 75–82; boardplay% 50; hitit 18–26;
takeaways 5–9; giveaways 7–12; PIM ~8–12; PP% 18–22; SV% .900–.910; team xGF/GF ±3% (1000 ottelua).
Viritys kerroksittain: hallussapidon volyymi → xG base → tapahtuma-jakaumat → skill-kontrasti `k` → PP/PK
→ lukitse golden-master. 1000–5000 ottelua/viritys, CI-vahdit.

## 10. Lähteet
Säfvenberg xG; Hockey-Graphs pre-shot xG; arXiv 2511.07703 skill-adjusted xG; Evolving-Hockey;
nhlscraper; NBC danger zones; ScoresAndStats HDSC.
