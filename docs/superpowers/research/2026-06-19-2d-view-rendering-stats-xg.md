# Tutkimus: Cold GM 2D-ottelunäkymä — renderöinti, tilastot, xG

**2026-06-19 · tutkimus/suunnittelu (ei koodia) · lähde: tutkimusagentti 2**

> Broadcast-tyylinen 2D-replay: maila + kiekon hallinta + harhautuksen erottuvuus + live-box-score + xG.
> Lukittu arkkitehtuuri säilyy: deterministinen pre-laskettu tapahtumavirta → kosmeettinen replay;
> aina-päällä `RinkMotion` (oma seedattu RNG, erillään sim-RNG:stä).

## 0. Kaksi kerrosta, toinen kosmeettinen
- **Totuuskerros (deterministinen):** `result`-dict (tulos, `events[]`, tilastot, per-laukaus `xG`). Read-only.
- **Esityskerros (kosmeettinen, seedattu):** `RinkMotion`-virtaus + mailojen/hallussapidon/harhautusten/
  tilastojen renderöinti. Oma RNG. Ei voi muuttaa lopputulosta.
- Periaate: `RinkMotion` tuottaa sijainnit joka ruudulla; tapahtumat KAAPPAAVAT hetkeksi tietyt toimijat
  (kantaja, laukoja, puolustaja) punktuaatioon ja palauttavat kontrollin virtaukselle.

## 1. Renderöinti — suositus: yksi custom-`_draw()`-kangas
| Lähestymistapa | Plussat | Miinukset |
|---|---|---|
| A. Node-per-pelaaja (Sprite/Polygon + stick-lapsi) | helppo editorissa, per-node Tween | ~60+ CanvasItemiä, transform-churn, vaikea yhtenäinen ilme |
| **B. Yksi `_draw()`-kangas (suositus)** | yksi CanvasItem, täysi piirtojärjestyksen hallinta, halvin & puhtain broadcast-ilme, rotaatio = trig | hit-testaus käsin (halpa 14 pisteelle) |
| C. MultiMeshInstance2D | skaalaa tuhansiin | ylimitoitettu 14 toimijalle, mailat/numerot hankalia |

**`rink.tscn`:**
```
Rink (Node2D, _draw + RinkMotion + arrayt; queue_redraw joka ruutu)
├── RinkStatic (Node2D, _draw kerran; vain resize) — jää, viivat, aloituspisteet, maalialueet, maalit
├── (puck + trailit piirretään Rink._draw:ssa bodyjen alle)
└── PuckHud (CanvasLayer) — HUD, tilastopaneeli, xG-palkki, tikkeri, kontrollit (Control-solmut)
```
**Koordinaatit:** `RinkMotion` normalisoidussa tilassa (0..1, 0..1); `rink_to_px()` mappaa pikseleiksi
→ logiikka resoluutioriippumaton, §7.4-testit pysyvät normalisoituina.

## 2. Luistelijan piirto (body + maila + numero)
Piirtojärjestys: (1) kontaktivarjo (alfa 0.18), (2) body-disc `team.primary_color` + 2px rengas
`secondary_color`, (3) numero `draw_string` kontrastivärillä (luminanssi laskettu kerran),
(4) **maila** `draw_line` shaftin ankkurista terään + pieni terä-polyline, väri `#cfd3da`, 2px (kantaja 3px).
**Mailan suuntaussääntö (EHM:stä puuttuva):** kantajan maila → kiekkoon (kiekko terällä); muut →
kiekkoon päin (`(puck−pos).angle()`), pehmennetty `lerp_angle(... 1-exp(-k·dt))`, k≈10; MV → kiekkoon
mutta eteen-kaareen rajattuna. Tämä "koko kentän katse peliin" on suurin luettavuusvoitto EHM:ään nähden.
Värit `TeamData`-hexeistä kerran cachattuna; jos primaryt liian lähellä → away käyttää secondarya renkaaseen.

## 3. Kiekon hallinta & siirto
**Hallussapito päätellään** (ei virrassa): `MatchPlayback` omistaa `possession={side, carrier_slot}`,
jota näkymä lukee joka ruutu (kosmeettinen, testattava — lisää `possession_at_current_time()`).
Säännöt: aloituksen voittaja → kantaja; onnistunut syöttö → primary→secondary; sieppaus/takeaway/giveaway/
hitti → puoli vaihtuu; laukaus/torjunta → kiekko irti, "loose"; maali → keskelle.
**Kiekko terällä:** `blade_tip = pos + RIGHT.rotated(stick_angle)*len; puck → lerp(blade_tip+offset)` (~12/s,
pieni viive = "cradle"-tunne). **Kiekkotrail** (8 viim. sijaintia haalistuen) = halvin moderni-vs-vanha -päivitys.
**Kantajan korostus:** ohut pulssirengas `secondary_color` (alfa 0.3–0.6, ~2Hz) → kiekkoa ei koskaan etsitä.
**Siirtoanimaatiot (Tween kiekolle, kesto / pelinopeus):** syöttö = lane-Tween 0.18–0.30s (TRANS_QUAD);
sieppaus = divergoi 60%:ssa sieppaajalle; laukaus = kohti maalia, motion-blur-streak, xG-tintattu;
torjunta = MV:n lapaan → rebound/jäädytys; blokki = pysähtyy puolustajaan, kimpoaa; takeaway/giveaway =
lapahyppy. 4×:llä jaa kesto nopeudella.

## 4. Harhautus (oltava yksiselitteinen)
Reseptin (~0.45–0.60s, nopeusskaalattu) kolme samanaikaista signaalia: (1) wind-up: maila levenee,
kiekko heilahtaa toiselle sivulle overshootilla ("näytä toinen suunta"); (2) counter-move: kiekko napsahtaa
VASTAKKAISELLE puolelle ohi puolustajan + kantajan pieni juke; (3) puolustajan **lunge & miss**: kiihdytys
kohti kiekon FAKE-sijaintia, ohitus, lyhyt "kompastus"; (4) burst: kantaja kiihtyy ohi + motion-trail +
speed-lines. **Tell = kiekon zigzag-trail** jota mikään muu tapahtuma ei tuota; tee siitä kirkkaampi/pidempi.
Lisäksi tikkeri-mikroteksti; valinnainen lyhyt slow-mo (0.6×, ~0.3s) vain korkean-xG:n harhautuksissa
(cooldown). Juke-suunta kosmeettisesta seedistä → deterministinen, replayttava.

## 5. Live-tilastopaneeli (moderni box score)
**Sijainti:** pysyvä oikea sivupalkki (~300–340px), `#1a1d26` + `#22252e` vasen reuna, ei peitä jäätä.
**Layout:** team-chipit; GOALS (iso, johtava kultainen `#e3b341`); SOG; sitten **"köydenveto"-vertailupalkit**
(label + keskiviivasta jaettu palkki: koti vasen `primary_color`, vieras oikea `primary_color`, suhde =
home/(home+away)) seuraaville: Shots Blocked, Hits, Giveaways, Takeaways, Faceoffs %, Boardplays %, Passes %;
SPECIAL TEAMS: Powerplay x/y, Penalty Kill x/y, PIM; xG-blokki (§6). Köydenveto on paljon luettavampi kuin
EHM:n kaksi numerosaraketta. **Typografia:** tabular-figuurit (numerot eivät tärise tweenissä), iso GOALS,
hiljaiset labelit `#7a7f8e`. **Live-päivitys:** vain muuttunut rivi animoituu — palkki tweenaa (~0.35s
TRANS_CUBIC), numero rullaa, lyhyt flash-pulssi maalintekijän värissä; muu pysyy paikallaan → ei meluisa.
4×:llä lyhennä; pikasimussa snäppää loppuarvoihin. Testattavissa: `MatchPlayback`-tally ajassa T.

## 6. xG-esitys (3 tasoa)
1. **Team-xG-totaalit (aina):** xG-blokki sivupalkkiin, köydenveto-palkki yhdellä desimaalilla + actual
   vieressä (tarina: "2 maalia / 2.3 xG"). Valinnainen G−xG luck-delta.
2. **xG-momentum / game-flow -aikajana (keskiössä, toteutetaan):** vaaka-aikajana (x = kello 0–60min),
   kaksi nousevaa kumulatiivista xG-step-viivaa joukkuevärein; pystyväli = kontrolli. Vaihtoehto B
   (suositus kompaktiin): erotus-"momentum"-täyttö keskiviivasta johtavan joukkueen väriin = painostusaalto.
   Maalit pisteinä. Piirtyy progressiivisesti replayn kelloon asti (playhead "nyt") → "live"-tunne.
   Toteutus: `_draw` polyline kumulatiivisesta xG:stä jota `MatchPlayback` kerää.
3. **Per-laukaus-vaara (halpa, tehokas):** laukauksen streak + kohdemerkki tintataan xG:llä lukitulla
   rating-rampilla: ≥0.20 kulta `#e3b341`, 0.08–0.20 vihreä `#57b368`, <0.08 sininen `#6ea8e6`. Pelaaja
   "tuntee" laukauksen laadun lukematta numeroa. Valinnainen kelluva xG-arvo hetkeksi.

## 7. Modernisointi (konkreettiset voitot EHM:ään)
Mailat seuraavat peliä; aina näkyvä kantajakorostus + kiekkotrail; kaikki tweenattu (siirrot, numerorullat,
palkit, mailakulmat); köydenveto-vertailupalkit; xG-game-flow-aikajana; palettikuri + syvyysvihjeet
(kontaktivarjot, jää-reflektio, vinjetti); typografiahierarkia; joukkueidentiteetti kaikkialla; maltillinen
gated-punktuaatio (maaliflash, high-xG-harhautus-slow-mo, vaaratintatut laukaukset, cooldownit);
jatkuva `RinkMotion`-virtaus → jää aina elossa.

## 8. Tapahtuma → visuaali -mappaus + ankkurointi
Jokainen tapahtumatyyppi: base-flow-muutos (RinkMotion) + punktuaatio (kaappaa toimijat) + tilastopäivitys.
**Ankkurointisääntö:** `MatchPlayback` katsoo hieman ETEEN virrassa ja kutsuu `RinkMotion.set_possession`
niin että laukaus/maali/torjunta-hetkellä virtaus on JO vienyt kiekon oikealle alueelle → punktuaatio
näyttää nousevan virtauksesta, ei teleporttaavan (§7.4-3). Pikasimu: pysäytä RinkMotion, snäppää
tilastot/xG/aikajana loppuun, → post_match. Mikään ei kosketa `result`-dictiä.

## 9. Toteutus-checklist (spec-tiedostoihin)
- `rink.gd/.tscn`: RinkStatic + Rink._draw arrayista; rink_to_px; hit-test; kantajarengas, kiekkotrail,
  vaaratintatut laukaukset, harhautustrailit.
- `rink_motion.gd`: §7.4 ennallaan; `set_possession/step/puck_pos/skater_pos` syöttävät piirron; juke kosmeettisesta seedistä.
- `match_playback.gd`: lisää `possession_at_current_time()` + kumulatiivinen tilasto-tally + xG/puoli (testattuna).
- `match_view.gd`: ajaa RinkMotion.step + queue_redraw `_process`:ssa; punktuaatio-Tweenit; sivupalkki, xG, tikkeri, kontrollit.
- Ei uutta palettia — vaaratasot käyttävät lukittua rating-ramppia; muut värit §2 Themestä.

## 10. Lähteet
Hockey-Graphs xG; Statpede xG; MoneyPuck glossary (game flow); SportLogiq iCE; Godot custom drawing 2D -docs;
Godot issue #19943 (Polygon2D vs draw); EHM Steam (2D-referenssi).
