# Aikajaksot & kuukausinäkymät (C) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox-vaiheet.

**Goal:** Muuta sovellus jatkuvaksi myynnin dashboardiksi: kirjaus oikealle päivälle, aikajaksovalitsin, kuukausittainen sarjataulukko valittavalla järjestyksellä, kisa arkistoon, premium-kiillotus.

**Architecture:** Puhtaat aikajakso- ja aggregointifunktiot data.jsx:ään (Node-testattavia). app.jsx: SARJATAULUKKO-välilehti käyttää jaksorajattua aggregointia; uusi Arkisto-välilehti kisalle. styles.css: kohdennettu premium-kiillotus. Ei skeemamuutoksia.

**Tech Stack:** React 18 UMD/CDN + Babel, ei buildia. Testaus: Node vm-sandbox; UI dev-local selaimessa.

**Spec:** docs/superpowers/specs/2026-06-23-buukkikisa-aikajaksot-kuukausinakymat-design.md

---

## Task 1: data.jsx — periodRange + aggregatePlayersForPeriod (+ Node-testit)

**Files:** Modify `data.jsx`; Create `tests/period-logic.test.js`

- [ ] **Step 1: Testit** (`tests/period-logic.test.js`)
```js
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// periodRange
{
  const m = w.periodRange('thisMonth', new Date('2026-06-15T12:00:00'));
  assert(m.startKey==='2026-06-01' && m.endKey==='2026-06-30', 'thisMonth 06 rajat');
  const lm = w.periodRange('lastMonth', new Date('2026-01-10T12:00:00'));
  assert(lm.startKey==='2025-12-01' && lm.endKey==='2025-12-31', 'lastMonth ylittää vuodenvaihteen');
  const y = w.periodRange('thisYear', new Date('2026-03-03T12:00:00'));
  assert(y.startKey==='2026-01-01' && y.endKey==='2026-12-31', 'thisYear rajat');
  const t = w.periodRange('today', new Date('2026-06-23T09:00:00'));
  assert(t.startKey==='2026-06-23' && t.endKey==='2026-06-23', 'today');
  const wk = w.periodRange('thisWeek', new Date('2026-06-24T12:00:00')); // ke
  assert(wk.startKey==='2026-06-22' && wk.endKey==='2026-06-28', 'thisWeek ma–su');
  const c = w.periodRange('custom', null, '2026-05-01', '2026-05-15');
  assert(c.startKey==='2026-05-01' && c.endKey==='2026-05-15', 'custom väli');
}
// aggregatePlayersForPeriod
{
  const players = { 'a:x':{key:'a:x',nick:'A',city:'X'}, 'b:y':{key:'b:y',nick:'B',city:'Y'}, '__admin__':{key:'__admin__',nick:'Ad',city:'T',is_admin:true} };
  const daily = [
    { player_id:'a:x', date_key:'2026-06-05', luurit:10, vastatut:6, buukit:3, tapaamiset:1 },
    { player_id:'a:x', date_key:'2026-07-05', luurit:5,  vastatut:2, buukit:9, tapaamiset:0 }, // eri kk
    { player_id:'b:y', date_key:'2026-06-20', luurit:4,  vastatut:3, buukit:2, tapaamiset:2 },
  ];
  const deals = [
    { player_id:'a:x', date_key:'2026-06-10', megis:12, eurot:1200 },
    { player_id:'b:y', date_key:'2026-06-11', megis:30, eurot:3000 },
    { player_id:'a:x', date_key:'2026-07-01', megis:99, eurot:9900 }, // eri kk
  ];
  const rows = w.aggregatePlayersForPeriod(players, daily, deals, '2026-06-01', '2026-06-30');
  assert(rows.length===2, 'admin suodattuu pois → 2 pelaajaa');
  const A = rows.find(r=>r.key==='a:x');
  assert(A.buukit===3 && A.megisTotal===12, 'A vain kesäkuun luvut (ei heinäkuu)');
  const B = rows.find(r=>r.key==='b:y');
  assert(B.buukit===2 && B.megisTotal===30, 'B kesäkuu');
}
```

- [ ] **Step 2: Aja → FAIL.** `node tests/period-logic.test.js`

- [ ] **Step 3: Toteuta data.jsx:ään** (ennen `Object.assign`):
```js
// Aikaväli valitulle jaksolle. Palauttaa {startKey,endKey,label} YYYY-MM-DD.
function periodRange(kind, refDate, customStart, customEnd) {
  const d = refDate ? new Date(refDate) : new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const key = (yy, mm, dd) => `${yy}-${String(mm+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  const lastDay = (yy, mm) => new Date(yy, mm+1, 0).getDate();
  if (kind === 'today')   { const k = localDateKey(d); return { startKey:k, endKey:k, label:'Tänään' }; }
  if (kind === 'thisWeek') {
    const dow = (d.getDay()+6)%7; // ma=0
    const mon = new Date(d); mon.setDate(d.getDate()-dow);
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    return { startKey:localDateKey(mon), endKey:localDateKey(sun), label:'Tämä viikko' };
  }
  if (kind === 'thisMonth') return { startKey:key(y,m,1), endKey:key(y,m,lastDay(y,m)), label:'Tämä kuukausi' };
  if (kind === 'lastMonth') { const pm = new Date(y, m-1, 1); const py=pm.getFullYear(), pmo=pm.getMonth();
    return { startKey:key(py,pmo,1), endKey:key(py,pmo,lastDay(py,pmo)), label:'Viime kuukausi' }; }
  if (kind === 'thisYear')  return { startKey:key(y,0,1), endKey:key(y,11,31), label:'Tämä vuosi' };
  if (kind === 'custom')    return { startKey:customStart, endKey:customEnd, label:'Oma väli' };
  const k = localDateKey(d); return { startKey:k, endKey:k, label:'Tänään' };
}

// Jaksorajattu pelaaja-aggregointi. Admin/is_admin pois.
function aggregatePlayersForPeriod(playersMap, dailyStats, deals, startKey, endKey) {
  const inRange = (dk) => dk >= startKey && dk <= endKey;
  const out = [];
  Object.values(playersMap || {}).forEach(p => {
    if (!p || p.key === '__admin__' || p.is_admin) return;
    let luurit=0, vastatut=0, buukit=0, tapaamiset=0;
    (dailyStats||[]).forEach(r => { if (r.player_id===p.key && inRange(r.date_key)) {
      luurit+=r.luurit||0; vastatut+=r.vastatut||0; buukit+=r.buukit||0; tapaamiset+=r.tapaamiset||0; } });
    let dealsCount=0, megisTotal=0, eurTotal=0;
    (deals||[]).forEach(d => { if (d.player_id===p.key && inRange(d.date_key)) {
      dealsCount++; megisTotal+=Number(d.megis)||0; eurTotal+=Number(d.eurot)||0; } });
    out.push({ ...p, luurit, vastatut, buukit, tapaamiset, dealsCount, megisTotal, eurTotal,
      avgMegis: dealsCount? megisTotal/dealsCount : 0, avgEur: dealsCount? eurTotal/dealsCount : 0 });
  });
  return out;
}
```
Vie: lisää `periodRange, aggregatePlayersForPeriod,` window-listaan.

- [ ] **Step 4: Aja → PASS.** `node tests/period-logic.test.js`
- [ ] **Step 5: Commit** `feat(data): periodRange + aggregatePlayersForPeriod`

---

## Task 2: app.jsx — kirjaus oikealle päivälle

**Files:** Modify `app.jsx` (`performAction` daily-kirjaus)

- [ ] **Step 1:** `performAction`-daily-kirjaus: korvaa `dayIdx2 = currentWeekdayIndex(); dateKey2 = weekdayIndexToDateKey(dayIdx2)` → `dateKey2 = localDateKey(new Date())`; poista `dayIdx2 >= 0` -ehto (aina tosi). Säilytä muu logiikka.
- [ ] **Step 2:** Manuaalinen verifiointi: pikavalinta kirjaa daily_stats-rivin tälle oikealle päivälle (dev-local).
- [ ] **Step 3: Commit** `fix(app): pikavalinnat kirjaavat oikealle kalenteripäivälle`

---

## Task 3: app.jsx — aikajaksovalitsin + rankBy-tila + jaksotaulukko

**Files:** Modify `app.jsx` (App-tila, leaderboard-render, uusi PeriodBar + RankTabs)

- [ ] **Step 1:** App-tila: `const [periodKind, setPeriodKind] = useState('thisMonth')`, `custom` alku/loppu, `const [rankBy, setRankBy] = useState('buukit')`.
- [ ] **Step 2:** `periodPlayers` useMemo: `const {startKey,endKey,label} = periodRange(periodKind, null, cStart, cEnd); const rows = decoratePlayers(Object.fromEntries(aggregatePlayersForPeriod(playersMap, dailyStats, deals, startKey, endKey).map(p=>[p.key,p]))); ` sitten järjestä `rankBy`:n mukaan (buukit/megisTotal/eurTotal/tapaamiset).
- [ ] **Step 3:** Uusi `PeriodBar`-komponentti (segmented control): Tänään/Viikko/Kuukausi/Viime kk/Vuosi/Oma väli + custom date-inputit. Uusi `RankTabs`: Buukit/Megis/€/Tapaamiset.
- [ ] **Step 4:** SARJATAULUKKO-välilehti: renderöi PeriodBar + RankTabs + `Table sorted={periodPlayers}` (jaksorajattu) valitulla järjestyksellä. Podium/MyCard voivat käyttää samaa jaksodataa.
- [ ] **Step 5:** Manuaalinen verifiointi: kuukauden vaihto muuttaa taulun; järjestysnappi vaihtaa järjestyksen; jakson ulkopuoliset eivät näy.
- [ ] **Step 6: Commit** `feat(app): aikajaksovalitsin + valittava järjestys + jaksotaulukko`

---

## Task 4: app.jsx — Arkisto-välilehti (kisa pois etusivulta)

**Files:** Modify `app.jsx` (TabNav, render)

- [ ] **Step 1:** TabNav: lisää välilehti **ARKISTO** (kaikille). Säilytä SARJATAULUKKO/TIIMIRAPORTTI/OMA RAPORTTI.
- [ ] **Step 2:** Siirrä `Bracket`, `PlayoutPanel`, `PhaseBanner`, kausibrändäys ARKISTO-välilehden alle. Etusivu (SARJATAULUKKO) = puhdas jakso-dashboard ilman playoffia.
- [ ] **Step 3:** Admin: "Käynnistä uusi kilpailu" (nykyinen `onStart`/`startPlayoffs`) näkyy Arkistossa.
- [ ] **Step 4:** Manuaalinen verifiointi: etusivulla ei playoffia; Arkistosta löytyy kaavio + kisa; admin voi aloittaa uuden.
- [ ] **Step 5: Commit** `feat(app): Arkisto-välilehti — kisa/playoff pois etusivulta`

---

## Task 5: app.jsx — Oma raportti päivämäärävalitsimella

**Files:** Modify `app.jsx` (`DailyReport` pelaajanäkymä)

- [ ] **Step 1:** Korvaa kisakalenteri-päivägrid pelaajanäkymässä `<input type="date">`-valitsimella (oletus `localDateKey(new Date())`). `dateKey` = valittu pvm. Lomake lataa/tallentaa sen päivän luvut (ml. tapaamiset). Kaupat-lista (DealEntry) ennallaan.
- [ ] **Step 2:** Oma yhteenveto: näytä pelaajan omat daily-rivit (viimeisimmät) date_key-järjestyksessä, ei kisaindekseillä.
- [ ] **Step 3:** Manuaalinen verifiointi: voi valita tämän päivän + menneen päivän, syöttää luvut, tallennus toimii.
- [ ] **Step 4: Commit** `feat(app): oma raportti päivämäärävalitsimella (irti kisakalenterista)`

---

## Task 6: styles.css — premium-kiillotus

**Files:** Modify `styles.css`

- [ ] **Step 1:** PeriodBar/RankTabs segmented control -tyylit (premium: pehmeät reunat, aktiivikorostus). Kortit/mittarit: hienovaraiset varjot, ilmavuus. Sarjataulukko: aktiivisen järjestyssarakkeen korostus, hover. Käytä olemassa olevia tokeneita.
- [ ] **Step 2:** Manuaalinen verifiointi: ilme siistimpi/premium, ei rikkoutunutta asettelua, mobiili ok.
- [ ] **Step 3: Commit** `style: premium-kiillotus (aikajaksovalitsin, järjestys, kortit, taulukko)`

---

## Task 7: Loppuverifiointi + merge

- [ ] **Step 1:** `node tests/*.test.js` kaikki PASS.
- [ ] **Step 2:** Dev-local selain: aikajaksot, järjestys, arkisto, oma raportti, premium-ilme.
- [ ] **Step 3:** Merge masteriin; push (käyttäjän luvalla → Vercel deploy). Ei Supabase-muutoksia.

---

## Riippuvuudet
Task 1 → 2 → 3 → 4 → 5 → 6 → 7
