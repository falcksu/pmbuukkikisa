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

  // ── Init ─────────────────────────
  async function init() {
    const initialPlayers = await fetchAll();
    const initialPlayoff = await fetchPlayoff();
    if (client) {
      client
        .channel('public:players')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'players' },
            async () => {
              const fresh = await fetchAll();
              notify(fresh);
            })
        .subscribe();
      client
        .channel('public:meta')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'meta', filter: 'id=eq.playoffs' },
            async () => {
              const fresh = await fetchPlayoff();
              notifyPlayoff(fresh);
            })
        .subscribe();
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === LS_KEY) notify(loadLocal());
        if (e.key === LS_PLAYOFF) notifyPlayoff(loadLocalPlayoff());
      });
    }
    return { players: initialPlayers, playoff: initialPlayoff };
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
  };
})();
