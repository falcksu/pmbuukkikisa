# Cold GM — Sprint 5a: EHM-attribuuttimalli

**Spesifikaatio | 2026-06-19 | Sprint 5a (1/3 S5-kokonaisuudesta)**

> S5 yhdistää kolme alasprinttiä: **S5a EHM-attribuutit** → S5b kontestoitu moottori 2.0 → S5c 2D-näkymä.
> Tämä spec kattaa S5a:n: laajennetaan pelaajamalli EHM-tasolle (27+10 attribuuttia) **muuttamatta
> simua**. Komposiittishim pitää C#-simun ja olemassa olevat testit ennallaan; S5b lukee sitten rikkaat
> attribuutit suoraan ja shim poistuu. Pohja: tutkimus `docs/research/2026-06-19-match-engine-2.0-*`.

---

## 1. Tavoite ja laajuus
**Tavoite:** korvata nykyiset 12 ohutta attribuuttia rikkaalla EHM-setillä (27 kenttäpelaaja + 10 MV),
jotta pelaajat erottuvat aidosti ja profiilikortti on FM/EHM-tasoinen. **Ei simu/moottori-muutoksia**
tässä alasprintissä — C#-`MatchSimulator` pysyy koskemattomana komposiittishimin ansiosta.

**Mukana:** PlayerData/GoalieData rikas malli + meta; `overall_rating` positiopainotus; PlayerGenerator;
`sim_attributes.gd` komposiittishim; `RoleSystem`-painojen uudelleenmappaus; save/load; profiilikortti;
koko migraatio (8 tuotantotiedostoa + testit).

**Ei tässä (S5b/S5c):** kontestoitu moottori, uudet tapahtumatyypit, xG, 2D-näkymä. Asteikko säilyy 1–20.

---

## 2. Attribuuttimalli

### 2.1 PlayerData — 27 attribuuttia (1–20)
```gdscript
# Technical (12)
checking, deflections, deking, faceoffs, hitting, off_the_puck,
passing, pokecheck, positioning, slapshot, stickhandling, wristshot
# Mental (9)
aggression, anticipation, bravery, creativity, determination, flair, influence, teamwork, work_rate
# Physical (6)
acceleration, agility, balance, speed, stamina, strength
# Meta
handedness: Handedness = LEFT      # enum {LEFT, RIGHT}
secondary_position: Position = FORWARD
height_cm: int = 183
weight_kg: int = 84
# Säilyy: id, etu/sukunimi, ikä, kansallisuus, position, hidden_potential, contract_years_left,
#         annual_salary, fatigue, is_injured, injury_weeks_remaining, games_played, season_*
```
**Poistuvat:** `skating, shooting, puck_handling, defensive_play, power_play, composure, team_spirit`.

### 2.2 GoalieData — 10 attribuuttia (1–20)
```gdscript
# Technical: reflexes, positioning, rebound_control, recovery, puck_handling, one_on_ones
# Mental:    concentration, composure, bravery
# Physical:  agility
# Säilyy: save-tilastot (season_saves/shots_against/goals_against/shutouts), save_percentage()
# Poistuvat: save_ability, goalie_positioning, mental_strength  (korvataan yllä olevilla)
```

### 2.3 overall_rating() — positiopainotus
Ei tasaista keskiarvoa. Painotettu (avainattribuutit ×1.5, muut ×1.0, normalisoitu 1–20:een):
- **Hyökkääjä:** wristshot, slapshot, deking, off_the_puck, speed, anticipation
- **Puolustaja:** pokecheck, positioning, checking, hitting, passing, strength
- **Maalivahti:** reflexes, positioning, rebound_control, one_on_ones, composure

---

## 3. Komposiittishim — `src/systems/sim_attributes.gd` (UUSI)
Adapter johtaa simun vanhat avaimet rikkaista attribuuteista. **Painot summautuvat 1.0:aan** →
tasainen taso `L` palautuu arvoon `L` → migratoidut testit identtisiä.

| Simun avain | Kaava |
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
| MV `reflexes`/`goalie_positioning`/`mental_strength` | reflexes / positioning / concentration |

Tulos pyöristetään intiksi (1–20). `match_adapter.build_team_input` käyttää tätä — **interop-dictin
skeema säilyy** → C# muuttumaton. **S5b poistaa shimin simupolulta** (sim lukee rikkaat attr. suoraan).

---

## 4. RoleSystem-painojen uudelleenmappaus (S4 → uudet attr.)
`role_system.gd` (21 vanhaa viittausta) remapataan. Rakenne säilyy; vain attribuutit vaihtuvat:
| Rooli | Uudet painot |
|---|---|
| Sniper | 0.30·wristshot + 0.20·slapshot + 0.20·deking + 0.15·off_the_puck + 0.15·creativity |
| Playmaker | 0.40·passing + 0.25·stickhandling + 0.15·creativity + 0.10·positioning + 0.10·teamwork |
| Two-way | 0.30·pokecheck + 0.25·positioning + 0.20·passing + 0.15·anticipation + 0.10·work_rate |
| Grinder | 0.30·checking + 0.25·hitting + 0.20·work_rate + 0.15·strength + 0.10·stamina |
| Offensive D | 0.25·passing + 0.20·wristshot + 0.20·skating→acceleration + 0.20·creativity + 0.15·positioning |
| Shutdown D | 0.35·pokecheck + 0.25·checking + 0.20·positioning + 0.10·anticipation + 0.10·strength |
| Butterfly G | 0.30·reflexes + 0.25·positioning + 0.25·one_on_ones + 0.20·rebound_control |

Chemistry (intangibles) käyttää nyt `teamwork` (ent. team_spirit) ja `composure→determination`-johdannaista.
`test_role_system.gd` migratoidaan uusiin attribuutteihin (arkkityyppi-tunnistus säilyy).

---

## 5. Migraation kokonaislaajuus (8 tuotantotiedostoa)
| Tiedosto | Muutos |
|---|---|
| `models/player_data.gd` | uudet 27 attr + meta; `overall_rating` positiopainotus; poista `average_technical` |
| `models/goalie_data.gd` | uudet 10 attr; säilytä save-tilastot |
| `data/player_generator.gd` | generoi kaikki uudet attr (positiokohtaiset jakaumat) + meta (handedness ~60% L, pituus/paino) |
| `data/save_manager.gd` | serialisoi/deserialisoi uudet attr (uudet lyhytavaimet; ei vanhaa yhteensopivuutta) |
| `systems/training_system.gd` | `attrs`-lista + fokus→attribuutti-mappaus uuteen settiin |
| `systems/role_system.gd` | §4 painot uusiin attr. |
| `sim/match_adapter.gd` | `build_team_input` käyttää `sim_attributes`-komposiitteja |
| `core/MatchSimulator.cs`, `SimContext.cs` | **EI muutosta** (lukevat samat interop-avaimet shimin kautta) |

**Testimigraatio:** lisää `make_skater(level)` / `make_goalie(level)` -apurit (asettavat KAIKKI rikkaat
attr. arvoon `level`). Päivitä testit jotka asettavat vanhoja kenttiä: `test_role_system`, `test_loop_queries`,
`test_match_adapter`, `test_lineup_system`, `test_season_manager`, `test_game_runner`, `test_training_system`,
`test_player_generator`, `test_save_manager`. Komposiittishim takaa identtisen simu-käytöksen tasaisilla arvoilla.
`test_match_simulator` operoi raaoilla interop-dicteillä → ei migraatiota.

---

## 6. Pelaajaprofiilikortti (`player_profile.gd` päivitys)
Laajennetaan nyk. kortti 3-sarakkeiseksi EHM-ruudukoksi (Technical/Mental/Physical), arvot
värikoodattu `UIPalette.attr_color`. Header: numero-avatar, nimi, positiot, OVR, **pelaajatyyppi**
(`RoleSystem.player_type`), ikä/kansallisuus/kätisyys/pituus/paino/palkka/sopimus. **Rooli-fit-rivi**
(`RoleSystem.best_roles`). Kausitilastorivi (GP/G/A/P/+−/PIM/SOG/Sh%). MV-versio: 10 MV-attr + torjunta%.
Hyväksytty mockup on visuaalinen totuuslähde (broadcast-paletti).

---

## 7. Testaus
| Taso | Mitä | Miten |
|---|---|---|
| PlayerData/GoalieData | 27/10 attr olemassa, overall_rating positiopainotus, 1–20-rajat | GUT |
| PlayerGenerator | kaikki attr 1–20, positiokohtaiset, meta-kentät | GUT |
| sim_attributes | tasainen L → kaikki komposiitit = L; vahva > heikko | GUT |
| RoleSystem | arkkityyppitunnistus uusilla attr; fit-järjestys | GUT (migratoitu) |
| Regressio | **136 olemassa olevaa testiä vihreinä** apureilla | koko GUT-suite |

---

## 8. Hyväksymiskriteerit
- [ ] PlayerData 27 + GoalieData 10 attr + meta; generaattori tuottaa ne positiokohtaisesti.
- [ ] `sim_attributes`-komposiitit: tasainen L → kaikki avaimet = L (testattu).
- [ ] C#-simu muuttumaton; **136 testiä migratoitu apureilla ja vihreinä.**
- [ ] RoleSystem toimii uusilla attribuuteilla; chemistry säilyy.
- [ ] Profiilikortti näyttää 27 attr värikoodattuna + pelaajatyyppi + rooli-fitit + tilastot.
- [ ] Save/load roundtrippaa uudet attribuutit.

---

## 9. Roadmap-konteksti
- **S5a (tämä)** → **S5b** kontestoitu moottori (lukee rikkaat attr., shim pois, 14 tapahtumatyyppiä, xG,
  golden-master) → **S5c** 2D-näkymä (mailat, kiekon hallinta, harhautus, box-score, xG-timeline).
- S5b/S5c speksataan vuorollaan; tutkimus `docs/research/`:ssa.
- Myöhemmin: scouting/draft, persoonat/moraali→tarinat, AI-GM, historia.
