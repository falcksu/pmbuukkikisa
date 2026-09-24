// tests/daily-merge.test.js
// Taustahaku (fokus/realtime/ajastin) voi lähteä ennen kirjausta ja palata sen
// jälkeen. Vanha rivi ei saa pyyhkiä juuri tallennettua lukua näytöltä.
const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

const row = (pid, dk, luurit, updated_at, extra) =>
  Object.assign({ id: pid + '_' + dk, player_id: pid, date_key: dk, luurit, vastatut: 0, buukit: 0, tapaamiset: 0, updated_at }, extra || {});

// 1) Haun vanhempi rivi ei korvaa paikallista tuoreempaa
{
  const local = [row('a', '2026-09-24', 5, '2026-09-24T10:00:05Z')];
  const incoming = [row('a', '2026-09-24', 4, '2026-09-24T10:00:01Z')];
  const out = w.mergeDailyRows(local, incoming);
  assert(out.length === 1 && out[0].luurit === 5, 'tuoreempi paikallinen rivi säilyi, luurit=' + out[0].luurit);
}

// 2) Haun tuoreempi rivi voittaa (toinen laite kirjasi)
{
  const local = [row('a', '2026-09-24', 5, '2026-09-24T10:00:05Z')];
  const incoming = [row('a', '2026-09-24', 7, '2026-09-24T10:01:00Z')];
  const out = w.mergeDailyRows(local, incoming);
  assert(out[0].luurit === 7, 'tuoreempi palvelinrivi voitti');
}

// 3) Juuri kirjattu uusi rivi, jota haku ei vielä tunne, säilyy hetken
{
  const now = Date.parse('2026-09-24T10:00:10Z');
  const local = [row('a', '2026-09-24', 1, '2026-09-24T10:00:09Z', { _savedAt: now - 1000 })];
  const out = w.mergeDailyRows(local, [], now);
  assert(out.length === 1, 'juuri kirjattu rivi säilyi');
  const out2 = w.mergeDailyRows(local, [], now + 60000);
  assert(out2.length === 0, 'vanha hausta puuttuva rivi poistuu (poistettu kannasta)');
}

// 4) Muiden pelaajien rivit tulevat haun mukaan sellaisenaan
{
  const local = [row('a', '2026-09-24', 5, '2026-09-24T10:00:05Z')];
  const incoming = [row('a', '2026-09-24', 5, '2026-09-24T10:00:05Z'), row('b', '2026-09-24', 3, '2026-09-24T09:00:00Z')];
  const out = w.mergeDailyRows(local, incoming);
  assert(out.length === 2, 'kaikki rivit mukana');
}

// 5) Rivit ilman updated_at: haku voittaa (ei jumiuduta vanhaan)
{
  const out = w.mergeDailyRows([row('a', '2026-09-24', 5, null)], [row('a', '2026-09-24', 6, null)]);
  assert(out[0].luurit === 6, 'ilman aikaleimaa haku voittaa');
}
