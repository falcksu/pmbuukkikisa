// tests/chart-labels.test.js
// Pelaajakortin "Buukit viim. 5 arkipäivänä" -kaavion PALKIT tulivat oikeasta
// kalenterista, mutta OTSIKOT kisakalenterista (MA 1.6 … PE 5.6) — vaikka
// tänään on elokuu. Luvut olivat oikein, päivämäärät täysin väärin.
// Otsikoiden on tultava samasta lähteestä kuin datan.
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const TIISTAI = new Date('2026-08-25T12:00:00'); // ti 25.8.2026

{
  const labels = w.recentDayLabels(5, TIISTAI);
  const keys = w.recentDayKeys(5, TIISTAI);
  assert(labels.length === 5, '5 otsikkoa');
  assert(labels.length === keys.length, 'otsikoita yhtä monta kuin datapäiviä');

  // Viimeinen = tämä päivä
  assert(labels[4].date === '25.8', 'viimeinen otsikko on tämä päivä 25.8, sai ' + labels[4].date);
  assert(labels[4].wd === 'TI', 'ti 25.8 on tiistai, sai ' + labels[4].wd);

  // Edellinen arkipäivä
  assert(labels[3].date === '24.8', 'edellinen arkipäivä 24.8, sai ' + labels[3].date);
  assert(labels[3].wd === 'MA', '24.8 on maanantai, sai ' + labels[3].wd);

  // Viikonloppu ohitettu → vanhin on ke 19.8
  assert(labels[0].date === '19.8', 'vanhin on 19.8 (viikonloppu ohitettu), sai ' + labels[0].date);
  assert(labels[0].wd === 'KE', '19.8 on keskiviikko, sai ' + labels[0].wd);

  // Otsikot vastaavat TÄSMÄLLEEN datapäiviä
  const kaikkiTasmaa = labels.every(function (l, i) {
    const osat = keys[i].split('-');
    const odotettu = parseInt(osat[2], 10) + '.' + parseInt(osat[1], 10);
    return l.date === odotettu;
  });
  assert(kaikkiTasmaa, 'jokainen otsikko vastaa saman indeksin datapäivää');

  // Ei enää kisakalenterin kesäkuuta
  assert(!labels.some(l => /\.6$/.test(l.date)), 'elokuussa ei näy kesäkuun päiviä');
}

// Maanantaina katsotaan taaksepäin perjantaihin, ei lauantaihin
{
  const labels = w.recentDayLabels(5, new Date('2026-08-24T12:00:00')); // ma 24.8
  assert(labels[4].date === '24.8' && labels[4].wd === 'MA', 'ma 24.8 viimeisenä');
  assert(labels[3].date === '21.8' && labels[3].wd === 'PE', 'edellinen arkipäivä pe 21.8, sai ' + labels[3].date);
}
