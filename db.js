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
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      lastSeen:  row.last_seen  ? new Date(row.last_seen).getTime()  : Date.now(),
    };
  }
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
    const { data, error } = await client.from('players').select('*');
    if (error) {
      console.error('Supabase fetchAll error:', error);
      return loadLocal();
    }
    const map = {};
    (data || []).forEach((row) => { map[row.id] = rowToPlayer(row); });
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
      const { error } = await client.from('players').upsert(playerToRow(player));
      if (error) console.error('Upsert error:', error);
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
    const { data, error } = await client.from('daily_stats').select('*');
    if (error) { console.error('fetchAllDailyStats error:', error); return loadLocalDaily(); }
    return data || [];
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
      updated_at: new Date().toISOString(),
    };
    if (client) {
      const { error } = await client.from('daily_stats').upsert(row);
      if (error) console.error('upsertDailyStats error:', error);
    } else {
      let rows = loadLocalDaily();
      const idx = rows.findIndex(r => r.id === id);
      if (idx >= 0) rows[idx] = row; else rows.push(row);
      saveLocalDaily(rows);
      notifyDaily(rows);
    }
    return row;
  }

  // ── Init ─────────────────────────
  async function init() {
    const initialPlayers = await fetchAll();
    const initialPlayoff = await fetchPlayoff();
    const initialDaily   = await fetchAllDailyStats();
    if (client) {
      client
        .channel('public:players')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'players' },
            async () => { const fresh = await fetchAll(); notify(fresh); })
        .subscribe();
      client
        .channel('public:meta')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'meta', filter: 'id=eq.playoffs' },
            async () => { const fresh = await fetchPlayoff(); notifyPlayoff(fresh); })
        .subscribe();
      client
        .channel('public:daily_stats')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'daily_stats' },
            async () => { const fresh = await fetchAllDailyStats(); notifyDaily(fresh); })
        .subscribe();
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === LS_KEY)     notify(loadLocal());
        if (e.key === LS_PLAYOFF) notifyPlayoff(loadLocalPlayoff());
        if (e.key === LS_DAILY)   notifyDaily(loadLocalDaily());
      });
    }
    return { players: initialPlayers, playoff: initialPlayoff, daily: initialDaily };
  }

  window.DB = {
    isConfigured,
    backend: client ? 'supabase' : 'local',
    init,
    subscribe,
    upsertPlayer,
    deletePlayer,
    deleteAllPlayers,
    subscribePlayoff,
    savePlayoff,
    fetchPlayoff,
    subscribeDaily,
    fetchAllDailyStats,
    upsertDailyStats,
  };
})();
