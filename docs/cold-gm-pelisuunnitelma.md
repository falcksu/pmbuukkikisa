# Cold GM — pelisuunnitelma

*Jääkiekko-managerisimulaattori PC:lle (Steam) · tilanne kesäkuu 2026*

---

## Mikä Cold GM on

Cold GM on yksinpelattava jääkiekko-manageri: johdat seuraa kuin oikea GM. Valitset
kokoonpanot, asetat taktiikat, hoidat talouden ja siirrot, ja viet joukkueen kauden läpi
runkosarjasta pudotuspeleihin — kausi toisensa jälkeen.

**Tärkein erottautumistekijä:** **2D-otteluvisualisointi.** Et lue tylsää tekstiraporttia
vaan *katsot* joukkuettasi kentällä reaaliaikaisessa 2D-näkymässä — näet ketjut, laukaukset,
maalit ja torjunnat tapahtumassa. Tämä puuttuu pääkilpailijalta (Franchise Hockey Manager),
ja se on syy miksi tästä voi tulla erottuva tuote.

---

## Missä mennään nyt

Peli rakennetaan viidessä vaiheessa ("sprintissä"). **Kaksi ensimmäistä on valmiina ja
testattu** — pelin "moottori" toimii jo kokonaan, vaikka grafiikkaa ei vielä ole.

| Vaihe | Sisältö | Tila |
|---|---|---|
| Sprint 1 | Datapohja: 6 liigaa, 120 joukkuetta, ~3000 fiktiivistä pelaajaa, kausikalenteri, tallennus | ✅ valmis |
| Sprint 2 | Ottelusimulaatio + talous: koko kausi simuloituu, tilastot, palkat, pelaajakehitys | ✅ valmis |
| Sprint 3 | **2D-ottelunäkymä + taktiikat** (seuraavaksi) | 🔨 suunniteltu |
| Sprint 4 | Modaus + Steam (saavutukset, Workshop, pilvitallennus) + viimeistely | — |
| Sprint 5 | Tasapainotus + Early Access -julkaisu | — |

**Konkreettinen todiste että moottori toimii:** se simuloi juuri kokonaisen kauden
Central Premier Leaguessa. Mestariksi nousi **Capital Cougars**, ja pistepörssin voitti
**Olli Forsberg (22 maalia, 28 pistettä)**. Kaikki joukkueet, pelaajien nimet, tulokset ja
tilastot syntyivät automaattisesti simulaattorista. Koko kauden (1800 ottelua + pudotuspelit)
simulointi kestää noin 13 sekuntia. Laadun takeena **94 automaattitestiä**, jotka menevät läpi
joka muutoksella.

---

## Miltä se näyttää

Taidesuunta on **"urheilulähetys"**: tumma, tyylikäs käyttöliittymä, kirkas jää,
joukkueväriset pelaajat ja värikoodatut pelaajaratingit (kulta = tähti, vihreä = hyvä,
sininen = keskiverto, harmaa = rivipelaaja).

- **2D-ottelunäkymä:** kaukalo ylhäältä kuvattuna, pelaajat numeroituina kiekkoina jotka
  liikkuvat tapahtumien mukaan, yläpalkissa tulos/erä/kello, alapalkissa ottelutapahtumat
  ja kontrollit (linjavaihto, aikalisä, pikasimuloi, nopeus).
- **Ketjueditori (NHL-pelien tyylinen):** pelaajakortit numeroineen ja ratingeineen,
  4 hyökkäysketjua + 3 puolustusparia + maalivahti, ketjukemia-mittarit, erikoistilanteet
  (yli-/alivoima).

*(Pelin sisäiset näkymät ovat työn alla — yllä kuvattu ulkoasu on jo suunniteltu ja mallinnettu.)*

---

## Mitä seuraavaksi — Sprint 3

Tämä on se vaihe joka tekee pelistä katsottavan ja pelattavan:

- **Katsottava 2D-ottelu** — pelaajat liikkuvat kentällä simulaattorin tapahtumien mukaan,
  kiekko kulkee laukauksiin ja maaleihin, ketjut vaihtuvat.
- **Ottelunsisäiset kontrollit** — linjavaihto, aikalisä, "pikasimuloi loppuun", nopeussäätö (1× / 2× / 4×).
- **Taktiikat jotka oikeasti vaikuttavat** — asetat ketjut ja kaksi strategiasäädintä
  (hyökkäävyys, forecheck-painostus); valintasi muuttavat ottelun lopputulosta mitattavasti.
- **Kevyt navigaatio** — koti → taktiikat → "pelaa seuraava ottelu" → katso 2D:nä → tulos.

Yksityiskohtaiset hallintanäkymät (tarkat roster-/talous-/siirtonäytöt) tulevat myöhemmissä
vaiheissa — Sprint 3 keskittyy pääerottautumistekijään.

---

## Kaupallinen suunnitelma

- **Hinta:** Early Access 14,99 € → täysi julkaisu 24,99 € (EA:n ostajat saavat pysyvästi).
- **Ei** tilauksia eikä mikromaksuja.
- **Yhteisö:** Steam Workshop (ilmainen, avoin modaus), Discord palautteelle ja tasapainotukselle.
- **DLC-polku julkaisun jälkeen:** "Legends Pack" (historialliset tähdet), lisäliigoja, kosmetiikkaa.

---

## Tekniikka lyhyesti

Godot 4.6 -pelimoottori. Ottelusimulaattorin ydin on **C#** (nopeus massasimulaatiossa),
muu logiikka GDScriptiä. Koodi GitHubissa, automaattinen testaus (CI) joka päivityksellä.
Yhden hengen projekti — kehitys etenee vaihe kerrallaan, jokainen vaihe testattuna ennen seuraavaa.
