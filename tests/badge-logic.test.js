const { load, assert } = require('./_harness');
const w = load('data.jsx').window;

// playerTier
{
  const t0 = w.playerTier(0);   assert(t0.tier.key === 'bronze', '0 → Bronze');
  const t1 = w.playerTier(40);  assert(t1.tier.key === 'silver', '40 → Silver');
  const t2 = w.playerTier(119); assert(t2.tier.key === 'silver', '119 → Silver');
  const t3 = w.playerTier(120); assert(t3.tier.key === 'gold', '120 → Gold');
  const t4 = w.playerTier(240); assert(t4.tier.key === 'platinum', '240 → Platinum');
  const t5 = w.playerTier(480); assert(t5.tier.key === 'legend', '480 → Legend');
  const p = w.playerTier(80); // silver (40..120)
  assert(p.progressPct === 50, '80: puolimatkassa Goldiin (40→120)');
  assert(p.toNext === 40, '80: 40 buukkia Goldiin');
  const leg = w.playerTier(600);
  assert(leg.next === null && leg.progressPct === 100, 'Legend: ei seuraavaa, 100%');
}

// computeBadges
{
  const daily = [
    { player_id:'a', date_key:'2026-08-03', luurit:20, vastatut:12, buukit:6, tapaamiset:2 },
    { player_id:'a', date_key:'2026-08-04', luurit:20, vastatut:12, buukit:6, tapaamiset:2 },
    { player_id:'a', date_key:'2026-08-05', luurit:20, vastatut:12, buukit:9, tapaamiset:2 }, // superpäivä 8+
  ];
  const deals = [
    { player_id:'a', date_key:'2026-08-03', megis:2500, eurot:250000 }, // iso kauppa >2000
  ];
  const badges = w.computeBadges('a', daily, deals, { isMonthChampion: true });
  const by = (id) => badges.find(b => b.id === id);
  assert(by('first_buukki').earned === true, 'ensimmäinen buukki ansaittu');
  assert(by('month_pace').earned === true, 'kk-vauhti (≥20 buukkia: 6+6+9=21) ansaittu');
  assert(by('tulipallo').earned === true, 'tulipallo (5+/pv) ansaittu');
  assert(by('superpaiva').earned === true, 'superpäivä (8+/pv: 9) ansaittu');
  assert(by('streak5').earned === false, 'putki5: vain 3 pv peräkkäin → ei');
  assert(by('first_deal').earned === true, 'ensimmäinen kauppa ansaittu');
  assert(by('iso_kauppa').earned === true, 'iso kauppa (2500 ≥ 2000) ansaittu');
  assert(by('kauppakone').earned === false, 'kauppakone (10 kauppaa): vain 1 → ei');
  assert(by('month_champ').earned === true, 'kuukauden mestari (opts) ansaittu');
  // progress kentät lukituille
  assert(by('kauppakone').progress && by('kauppakone').progress.cur === 1 && by('kauppakone').progress.target === 10, 'kauppakone-progress 1/10');
}
