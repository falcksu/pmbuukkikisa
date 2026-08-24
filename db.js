// db.js — persistence layer
// Käyttää Supabasea jos config täytetty, muuten putoaa localStorageen.

(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const isConfigured = !!(cfg.url && cfg.anonKey
    && !cfg.url.startsWith('PASTE')
    && !cfg.anonKey.startsWith('PASTE'));

  const LS_KEY = 'buukkauskisa.players.v2';
  let client = null;
  let listeners = [];

  if (isConfigured && window.supabase) {
    try {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        realtime: { params: { eventsPerSecond: 5 } },
      });
    } catch (e) {
      console.warn('Supabase client init failed', e);
    }
  }

  // Konfiguroitu Supabaseen, mutta asiakasta ei saatu luotua (SDK:n CDN estetty,
  // ei latautunut, tai createClient heitti). TÄSSÄ TILASSA EI SAA hiljaa pudota
  // localStorageen: käyttäjä näkisi kirjaustensa tallentuvan ja säilyvän latauksesta
  // toiseen, mutta mikään ei päätyisi kantaan. Sovellus estää kirjaamisen tässä tilassa.
  const offlineMisconfig = isConfigured && !client;
  if (offlineMisconfig) {
    console.error('Supabase on konfiguroitu mutta yhteyttä ei saatu — kirjaaminen estetty.');
  }

  // ── localStorage helpers ─────────────────────────
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveLocal(map) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch (e) { /* noop */ }
  }

  // ── Haun terveys ─────────────────────────
  // PostgREST palauttaa oletuksena enintään 1000 riviä. Ilman sivutusta haku
  // katkesi hiljaisesti, ja koska pelaajien totaalit lasketaan daily_stats-riveistä,
  // vajaa haku pienensi totaaleja → "tilastot katosivat historiasta".
  const PAGE_SIZE = 1000;
  const fetchHealth = { players: true, daily: true, deals: true };

  // Aikakatkaisu: fetchillä ei ole oletusaikakatkaisua, joten hyytynyt pyyntö jäi
  // roikkumaan ikuisesti ja UI:n "Tallennetaan…" ei koskaan poistunut.
  let requestTimeoutMs = 15000;
  function setRequestTimeout(ms) { requestTimeoutMs = ms; }

  // Yhdistää tapahtumaryöpyn yhdeksi hauksi. Ilman tätä jokainen rivimuutos
  // laukaisi koko taulun uudelleenhaun jokaisella klientillä (pikavalinta
  // kirjoittaa 2 riviä → 2 täyshakua per klikki, per käyttäjä).
  function debounced(fn, ms) {
    let timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn(); }, ms);
    };
  }

  function withTimeout(promise, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error((label || 'Pyyntö') + ' aikakatkaistiin — tarkista verkkoyhteys ja yritä uudelleen.'));
      }, requestTimeoutMs);
      Promise.resolve(promise).then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }

  // Hakee taulun KOKONAAN sivuttamalla. Virhetilanteessa palauttaa null (ei vajaita
  // rivejä) — kutsuja päättää turvallisen degradaation.
  async function fetchPaged(table) {
    let out = [];
    let from = 0;
    for (;;) {
      const { data, error } = await client.from(table).select('*').range(from, from + PAGE_SIZE - 1);
      if (error) { console.error('fetch ' + table + ' error:', error); return null; }
      const batch = data || [];
      out = out.concat(batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return out;
  }

  // ── row <-> player ─────────────────────────
  function rowToPlayer(row) {
    return {
      key: row.id,
      nick: row.nick,
      city: row.city,
      init: row.init,
      luurit:   row.luurit   || 0,
      vastatut: row.vastatut || 0,
      buukit:   row.buukit   || 0,
      streak:   row.streak   || 0,
      trendN:   row.trend_n  || 0,
      last5:    Array.isArray(row.last5) ? row.last5 : [0,0,0,0,0],
      is_admin: !!row.is_admin,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      lastSeen:  row.last_seen  ? new Date(row.last_seen).getTime()  : Date.now(),
    };
  }
  // Huom: playerToRow EI sisällä auth_id/is_admin-kenttiä tarkoituksella —
  // upsert ei silloin ylikirjoita autentikointilinkkiä/admin-lippua.
  function playerToRow(p) {
    return {
      id:       p.key,
      nick:     p.nick,
      city:     p.city,
      init:     p.init,
      luurit:   p.luurit   || 0,
      vastatut: p.vastatut || 0,
      buukit:   p.buukit   || 0,
      streak:   p.streak   || 0,
      trend_n:  p.trendN   || 0,
      last5:    p.last5    || [0,0,0,0,0],
      last_seen: new Date().toISOString(),
    };
  }

  // ── API ─────────────────────────
  async function fetchAll() {
    if (!client) return loadLocal();
    const rows = await fetchPaged('players');
    fetchHealth.players = rows !== null;
    if (rows === null) return loadLocal();
    const map = {};
    rows.forEach((row) => { map[row.id] = rowToPlayer(row); });
    return map;
  }

  function notify(map) {
    listeners.forEach((cb) => { try { cb(map); } catch (e) { /* noop */ } });
  }


  function subscribe(cb) {
    listeners.push(cb);
    return () => { listeners = listeners.filter((x) => x !== cb); };
  }

  async function upsertPlayer(player) {
    if (client) {
      // players-taululla ei ole INSERT-politiikkaa (rivit luodaan vain register_player-RPC:llä),
      // joten päivitetään olemassa olevaa riviä. RLS sallii vain oman rivin (owns_player) / adminin.
      // Kutsutaan usein ilman awaitia → ei saa heittää (käsittelemätön hylkäys).
      try {
        const { error } = await withTimeout(
          client.from('players').update(playerToRow(player)).eq('id', player.key), 'Pelaajan päivitys');
        if (error) { console.error('Update player error:', error); return { ok: false, error }; }
      } catch (e) {
        console.error('Update player exception:', e);
        return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe' } };
      }
    } else {
      const map = loadLocal();
      map[player.key] = player;
      saveLocal(map);
      notify(map);
    }
  }

  async function deletePlayer(key) {
    if (client) {
      const { error } = await client.from('players').delete().eq('id', key);
      if (error) console.error('Delete error:', error);
    } else {
      const map = loadLocal();
      delete map[key];
      saveLocal(map);
      notify(map);
    }
  }

  async function deleteAllPlayers() {
    if (client) {
      const { error } = await client.from('players').delete().neq('id', '');
      if (error) console.error('Delete all error:', error);
    } else {
      saveLocal({});
      notify({});
    }
  }

  // ── Playoff (meta table) ─────────────────────────
  const LS_PLAYOFF = 'buukkauskisa.playoff.v1';
  let playoffListeners = [];

  function loadLocalPlayoff() {
    try {
      const raw = localStorage.getItem(LS_PLAYOFF);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveLocalPlayoff(state) {
    try { localStorage.setItem(LS_PLAYOFF, JSON.stringify(state)); } catch (e) { /* noop */ }
  }

  async function fetchPlayoff() {
    if (!client) return loadLocalPlayoff();
    const { data, error } = await client.from('meta').select('payload').eq('id', 'playoffs').maybeSingle();
    if (error) {
      console.error('Supabase fetchPlayoff error:', error);
      return loadLocalPlayoff();
    }
    return data ? data.payload : null;
  }

  function notifyPlayoff(state) {
    playoffListeners.forEach((cb) => { try { cb(state); } catch (e) { /* noop */ } });
  }

  function subscribePlayoff(cb) {
    playoffListeners.push(cb);
    return () => { playoffListeners = playoffListeners.filter((x) => x !== cb); };
  }

  async function savePlayoff(state) {
    if (client) {
      const { error } = await client.from('meta').upsert({ id: 'playoffs', payload: state, updated_at: new Date().toISOString() });
      if (error) console.error('Save playoff error:', error);
    } else {
      saveLocalPlayoff(state);
      notifyPlayoff(state);
    }
  }

  // ── Playout (meta table) ─────────────────────────
  const LS_PLAYOUT = 'buukkauskisa.playout.v1';
  let playoutListeners = [];

  function loadLocalPlayout() {
    try { const r = localStorage.getItem(LS_PLAYOUT); return r ? JSON.parse(r) : null; } catch(e) { return null; }
  }
  function saveLocalPlayout(state) {
    try { localStorage.setItem(LS_PLAYOUT, JSON.stringify(state)); } catch(e) {}
  }
  async function fetchPlayout() {
    if (!client) return loadLocalPlayout();
    const { data, error } = await client.from('meta').select('payload').eq('id', 'playout').maybeSingle();
    if (error) { console.error('Supabase fetchPlayout error:', error); return loadLocalPlayout(); }
    return data ? data.payload : null;
  }
  function notifyPlayout(state) {
    playoutListeners.forEach(cb => { try { cb(state); } catch(e) {} });
  }
  function subscribePlayout(cb) {
    playoutListeners.push(cb);
    return () => { playoutListeners = playoutListeners.filter(x => x !== cb); };
  }
  async function savePlayout(state) {
    if (client) {
      const { error } = await client.from('meta').upsert({ id: 'playout', payload: state, updated_at: new Date().toISOString() });
      if (error) console.error('Save playout error:', error);
    } else {
      saveLocalPlayout(state);
      notifyPlayout(state);
    }
  }

  // ── Daily stats ─────────────────────────
  const LS_DAILY = 'buukkauskisa.daily.v1';
  let dailyListeners = [];

  function loadLocalDaily() {
    try { const r = localStorage.getItem(LS_DAILY); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function saveLocalDaily(rows) {
    try { localStorage.setItem(LS_DAILY, JSON.stringify(rows)); } catch(e) {}
  }
  function notifyDaily(rows) {
    dailyListeners.forEach(cb => { try { cb(rows); } catch(e) {} });
  }
  function subscribeDaily(cb) {
    dailyListeners.push(cb);
    return () => { dailyListeners = dailyListeners.filter(x => x !== cb); };
  }

  async function fetchAllDailyStats() {
    if (!client) return loadLocalDaily();
    const rows = await fetchPaged('daily_stats');
    fetchHealth.daily = rows !== null;
    // Virheessä EI pudota localStorageen (se on Supabase-tilassa tyhjä/vanhentunut)
    // eikä palauteta vajaita rivejä — kumpikin pienentäisi laskettuja totaaleja.
    return rows || [];
  }

  // Atominen kasvatus palvelimella. Client EI enää laske absoluuttisia lukuja
  // omasta (mahdollisesti vanhentuneesta) kopiostaan — se lähettää vain muutoksen
  // (+1 / -1) ja palvelin kasvattaa lukua transaktiossa. Tämä poistaa "lost update"
  // -luokan: kaksi välilehteä/laitetta tai katkennut realtime ei voi enää
  // ylikirjoittaa tuoreempaa lukua vanhalla. Palvelin päättää myös päivämäärän,
  // joten laitteen väärä kello ei arkistoi kirjausta väärälle päivälle.
  async function bumpDailyStat(field, delta, clientDate) {
    if (!client) {
      // dev-local: sama semantiikka paikallisesti
      const rows = loadLocalDaily();
      const dateKey = clientDate || new Date().toISOString().slice(0, 10);
      const id = '__local__' + '_' + dateKey;
      let row = rows.find(r => r.id === id);
      if (!row) { row = { id, player_id: '__local__', date_key: dateKey, luurit:0, vastatut:0, buukit:0, tapaamiset:0 }; rows.push(row); }
      row[field] = Math.max(0, (row[field] || 0) + delta);
      saveLocalDaily(rows); notifyDaily(rows);
      return { ok: true, row };
    }
    try {
      const { data, error } = await withTimeout(
        client.rpc('bump_daily_stat', { p_field: field, p_delta: delta, p_client_date: clientDate || null }),
        'Kirjauksen tallennus');
      if (error) { console.error('bumpDailyStat error:', error); return { ok: false, error }; }
      const row = Array.isArray(data) ? data[0] : data;
      return { ok: true, row };
    } catch (e) {
      console.error('bumpDailyStat exception:', e);
      return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe tallennuksessa' } };
    }
  }

  // Päiväraportin tallennus palvelimen kautta: asettaa päivän luvut ja kirjaa
  // muutoksen tapahtumalokiin, jolloin vahingossa tapahtunut ylikirjoitus on
  // aina palautettavissa.
  async function setDailyStatsRemote(dateKey, stats) {
    if (!client) return upsertDailyStats('__local__', dateKey, stats);
    try {
      const { data, error } = await withTimeout(client.rpc('set_daily_stats', {
        p_date_key: dateKey,
        p_luurit: Math.max(0, stats.luurit || 0),
        p_vastatut: Math.max(0, stats.vastatut || 0),
        p_buukit: Math.max(0, stats.buukit || 0),
        p_tapaamiset: Math.max(0, stats.tapaamiset || 0),
      }), 'Päivän tallennus');
      if (error) { console.error('setDailyStats error:', error); return { ok: false, error }; }
      return { ok: true, row: Array.isArray(data) ? data[0] : data };
    } catch (e) {
      console.error('setDailyStats exception:', e);
      return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe tallennuksessa' } };
    }
  }

  async function upsertDailyStats(playerId, dateKey, stats) {
    const id = playerId + '_' + dateKey;
    const row = {
      id,
      player_id: playerId,
      date_key: dateKey,
      luurit:   Math.max(0, stats.luurit   || 0),
      vastatut: Math.max(0, stats.vastatut || 0),
      buukit:   Math.max(0, stats.buukit   || 0),
      tapaamiset: Math.max(0, stats.tapaamiset || 0),
      updated_at: new Date().toISOString(),
    };
    if (client) {
      // Ei saa heittää eikä roikkua — kutsuja luottaa {ok}-vastaukseen ja
      // perii optimistisen päivityksen takaisin jos tallennus epäonnistui.
      try {
        const { error } = await withTimeout(client.from('daily_stats').upsert(row), 'Päivän tallennus');
        if (error) { console.error('upsertDailyStats error:', error); return { ok: false, error, row }; }
      } catch (e) {
        console.error('upsertDailyStats exception:', e);
        return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe tallennuksessa' }, row };
      }
    } else {
      let rows = loadLocalDaily();
      const idx = rows.findIndex(r => r.id === id);
      if (idx >= 0) rows[idx] = row; else rows.push(row);
      saveLocalDaily(rows);
      notifyDaily(rows);
    }
    return { ok: true, row };
  }

  // ── Deals (kaupat) ─────────────────────────
  const LS_DEALS = 'buukkauskisa.deals.v1';
  let dealsListeners = [];

  function loadLocalDeals() {
    try { const r = localStorage.getItem(LS_DEALS); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function saveLocalDeals(rows) {
    try { localStorage.setItem(LS_DEALS, JSON.stringify(rows)); } catch(e) {}
  }
  function notifyDeals(rows) {
    dealsListeners.forEach(cb => { try { cb(rows); } catch(e) {} });
  }
  function subscribeDeals(cb) {
    dealsListeners.push(cb);
    return () => { dealsListeners = dealsListeners.filter(x => x !== cb); };
  }
  async function fetchAllDeals() {
    if (!client) return loadLocalDeals();
    const rows = await fetchPaged('deals');
    fetchHealth.deals = rows !== null;
    return rows || [];
  }
  async function upsertDeal(deal) {
    if (client) {
      // Ei saa koskaan heittää eikä roikkua — kutsuja luottaa {ok}-vastaukseen.
      try {
        const { error } = await withTimeout(client.from('deals').upsert(deal), 'Kaupan tallennus');
        if (error) { console.error('upsertDeal error:', error); return { ok: false, error, deal }; }
      } catch (e) {
        console.error('upsertDeal exception:', e);
        return { ok: false, error: { message: (e && e.message) || 'Verkkovirhe tallennuksessa' }, deal };
      }
    } else {
      let rows = loadLocalDeals();
      const idx = rows.findIndex(r => r.id === deal.id);
      if (idx >= 0) rows[idx] = deal; else rows.push(deal);
      saveLocalDeals(rows);
      notifyDeals(rows);
    }
    return { ok: true, deal };
  }
  async function deleteDeal(id) {
    if (client) {
      const { error } = await client.from('deals').delete().eq('id', id);
      if (error) console.error('deleteDeal error:', error);
    } else {
      const rows = loadLocalDeals().filter(r => r.id !== id);
      saveLocalDeals(rows);
      notifyDeals(rows);
    }
  }

  // ── Tiimitavoitteet (osaprojekti D1) — meta id='goals' ─────────────
  const LS_GOALS = 'buukkauskisa.goals.v1';
  let goalsListeners = [];
  function loadLocalGoals() {
    try { const r = localStorage.getItem(LS_GOALS); return r ? JSON.parse(r) : {}; } catch(e) { return {}; }
  }
  function saveLocalGoals(state) { try { localStorage.setItem(LS_GOALS, JSON.stringify(state)); } catch(e) {} }
  async function fetchGoals() {
    if (!client) return loadLocalGoals();
    const { data, error } = await client.from('meta').select('payload').eq('id', 'goals').maybeSingle();
    if (error) { console.error('fetchGoals error:', error); return loadLocalGoals(); }
    return data ? (data.payload || {}) : {};
  }
  function notifyGoals(state) { goalsListeners.forEach(cb => { try { cb(state); } catch(e) {} }); }
  function subscribeGoals(cb) { goalsListeners.push(cb); return () => { goalsListeners = goalsListeners.filter(x => x !== cb); }; }
  async function saveGoals(state) {
    if (client) {
      const { error } = await client.from('meta').upsert({ id: 'goals', payload: state, updated_at: new Date().toISOString() });
      if (error) console.error('saveGoals error:', error);
    } else {
      saveLocalGoals(state);
      notifyGoals(state);
    }
  }

  // ── H2H-haaste (osaprojekti D3) — meta id='h2h' ─────────────
  const LS_H2H = 'buukkauskisa.h2h.v1';
  let h2hListeners = [];
  function loadLocalH2H() {
    try { const r = localStorage.getItem(LS_H2H); return r ? JSON.parse(r) : null; } catch(e) { return null; }
  }
  function saveLocalH2H(state) { try { localStorage.setItem(LS_H2H, JSON.stringify(state)); } catch(e) {} }
  async function fetchH2H() {
    if (!client) return loadLocalH2H();
    const { data, error } = await client.from('meta').select('payload').eq('id', 'h2h').maybeSingle();
    if (error) { console.error('fetchH2H error:', error); return loadLocalH2H(); }
    return data ? (data.payload || null) : null;
  }
  function notifyH2H(state) { h2hListeners.forEach(cb => { try { cb(state); } catch(e) {} }); }
  function subscribeH2H(cb) { h2hListeners.push(cb); return () => { h2hListeners = h2hListeners.filter(x => x !== cb); }; }
  async function saveH2H(state) {
    if (client) {
      const { error } = await client.from('meta').upsert({ id: 'h2h', payload: state, updated_at: new Date().toISOString() });
      if (error) console.error('saveH2H error:', error);
    } else {
      saveLocalH2H(state);
      notifyH2H(state);
    }
  }

  // ── Init ─────────────────────────
  async function init() {
    // Rinnakkain — aiemmin 7 peräkkäistä edestakaista kutsua ketjussa, mikä
    // hidasti ensilatausta suoraan niiden summalla.
    const [
      initialPlayers, initialPlayoff, initialPlayout,
      initialDaily, initialDeals, initialGoals, initialH2H,
    ] = await Promise.all([
      fetchAll(), fetchPlayoff(), fetchPlayout(),
      fetchAllDailyStats(), fetchAllDeals(), fetchGoals(), fetchH2H(),
    ]);
    if (client) {
      const REFRESH_MS = 400; // yhdistä ryöpyt yhdeksi hauksi
      // Realtime-yhteys voi kuolla hiljaa (kone nukkuu, verkko vaihtuu, palomuuri
      // estää websocketit). Silloin paikallinen kopio jäätyy. Haetaan tuore data
      // aina kun välilehti palaa näkyviin tai verkko palautuu.
      const refreshAll = async () => {
        const [p, d, dl] = await Promise.all([fetchAll(), fetchAllDailyStats(), fetchAllDeals()]);
        notify(p); notifyDaily(d); notifyDeals(dl);
      };
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
      }
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('online', refreshAll);
        window.addEventListener('focus', refreshAll);
      }
      const refreshPlayers = debounced(async () => { const fresh = await fetchAll(); notify(fresh); }, REFRESH_MS);
      const refreshDaily   = debounced(async () => { const fresh = await fetchAllDailyStats(); notifyDaily(fresh); }, REFRESH_MS);
      const refreshDeals   = debounced(async () => { const fresh = await fetchAllDeals(); notifyDeals(fresh); }, REFRESH_MS);
      client
        .channel('public:players')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'players' },
            refreshPlayers)
        .subscribe();
      client
        .channel('public:meta')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'meta' },
            async (payload) => {
              const id = payload?.new?.id || payload?.old?.id;
              if (id === 'playoffs') { const fresh = await fetchPlayoff(); notifyPlayoff(fresh); }
              if (id === 'playout')  { const fresh = await fetchPlayout(); notifyPlayout(fresh); }
              if (id === 'goals')    { const fresh = await fetchGoals(); notifyGoals(fresh); }
              if (id === 'h2h')      { const fresh = await fetchH2H(); notifyH2H(fresh); }
            })
        .subscribe();
      client
        .channel('public:daily_stats')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'daily_stats' },
            refreshDaily)
        .subscribe();
      client
        .channel('public:deals')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'deals' },
            refreshDeals)
        .subscribe();
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === LS_KEY)     notify(loadLocal());
        if (e.key === LS_PLAYOFF) notifyPlayoff(loadLocalPlayoff());
        if (e.key === LS_PLAYOUT) notifyPlayout(loadLocalPlayout());
        if (e.key === LS_DAILY)   notifyDaily(loadLocalDaily());
        if (e.key === LS_DEALS)   notifyDeals(loadLocalDeals());
        if (e.key === LS_GOALS)   notifyGoals(loadLocalGoals());
        if (e.key === LS_H2H)     notifyH2H(loadLocalH2H());
      });
    }
    return { players: initialPlayers, playoff: initialPlayoff, playout: initialPlayout, daily: initialDaily, deals: initialDeals, goals: initialGoals, h2h: initialH2H };
  }

  // ── Auth (osaprojekti B) ─────────────────────────
  const hasAuth = !!(client && client.auth);

  async function signUp(email, password) { return client.auth.signUp({ email, password }); }
  async function signIn(email, password) { return client.auth.signInWithPassword({ email, password }); }
  async function signOut() { return client.auth.signOut(); }
  async function getSession() {
    const { data } = await client.auth.getSession();
    return data ? data.session : null;
  }
  function onAuthChange(cb) {
    const { data } = client.auth.onAuthStateChange((_e, s) => cb(s));
    return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
  }
  async function registerPlayer(nick, city, code) {
    return client.rpc('register_player', { p_nick: nick, p_city: city, p_code: code });
  }
  async function linkExistingPlayer(playerId, code) {
    return client.rpc('link_existing_player', { p_player_id: playerId, p_code: code });
  }
  async function fetchUnlinkedPlayers() {
    const { data, error } = await client.rpc('list_unlinked_players');
    if (error) { console.error('list_unlinked_players error:', error); return []; }
    return data || [];
  }
  async function fetchMyPlayer(authId) {
    const { data, error } = await client.from('players').select('*').eq('auth_id', authId).maybeSingle();
    if (error) { console.error('fetchMyPlayer error:', error); return null; }
    return data ? rowToPlayer(data) : null;
  }

  window.DB = {
    isConfigured,
    backend: client ? 'supabase' : 'local',
    hasAuth,
    offlineMisconfig,
    fetchHealth,
    setRequestTimeout,
    signUp, signIn, signOut, getSession, onAuthChange,
    registerPlayer, linkExistingPlayer, fetchUnlinkedPlayers, fetchMyPlayer,
    init,
    subscribe,
    upsertPlayer,
    deletePlayer,
    deleteAllPlayers,
    subscribePlayoff,
    savePlayoff,
    fetchPlayoff,
    subscribePlayout,
    savePlayout,
    fetchPlayout,
    subscribeDaily,
    fetchAllDailyStats,
    upsertDailyStats,
    bumpDailyStat,
    setDailyStatsRemote,
    subscribeDeals,
    fetchAllDeals,
    upsertDeal,
    deleteDeal,
    subscribeGoals,
    fetchGoals,
    saveGoals,
    subscribeH2H,
    fetchH2H,
    saveH2H,
  };
})();
