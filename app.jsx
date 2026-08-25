// Buukkauskisa · App
// Multi-pelaaja localStorage-pohjaisesti. Login = nick+city → avain.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "regular",
  "showPodium": true,
  "showBracket": true,
  "showTicker": true,
  "accent": "#ff4a1a",
  "confetti": true,
  "pulse": true
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ['#ff4a1a', '#1c64f2', '#1a8a3e', '#c5972a', '#1a1612'];

const ADMIN_KEY  = '__admin__';
const ADMIN_NICK = 'ADMIN';
const ADMIN_CITY = 'TAMPERE';
function isAdminCreds(nick, city) {
  return (nick || '').trim().toUpperCase() === ADMIN_NICK
      && (city || '').trim().toUpperCase() === ADMIN_CITY;
}

// ── helpers ───────────────────────────

const cls = (...xs) => xs.filter(Boolean).join(' ');
const initials = (s) => (s || '').trim().slice(0, 2).toUpperCase();
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function decoratePlayers(map) {
  // map -> array, sorted, with derived fields
  const arr = Object.entries(map).map(([key, p]) => ({ ...p, key }));
  arr.sort((a, b) => {
    if (b.buukit !== a.buukit) return b.buukit - a.buukit;
    if (b.streak !== a.streak) return b.streak - a.streak;
    return pct(b.buukit, b.vastatut) - pct(a.buukit, a.vastatut);
  });
  const eighth = arr[7]?.buukit ?? 0;
  const ninth  = arr[8]?.buukit ?? 0;
  return arr.map((p, i) => ({
    ...p,
    rank: i + 1,
    inPlayoff: i < 8,
    pointsToPlayoff: i >= 8 ? Math.max(0, eighth - p.buukit + 1) : 0,
    pointsAhead: i < 8 ? Math.max(0, p.buukit - ninth) : 0,
    vastausPct: pct(p.vastatut, p.luurit),
    buukkiPct: pct(p.buukit, p.vastatut),
  }));
}

// ── Password gate ───────────────────────────

function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (pw.trim().toUpperCase() === 'VENI') {
      sessionStorage.setItem('buukkikisa.pw', '1');
      onUnlock();
    } else {
      setErr(true);
      setPw('');
    }
  };
  return (
    <div className="pw-gate">
      <div className="pw-box">
        <div className="pw-logo display">Buukkaus<span className="accent">kisa</span></div>
        <div className="pw-sub">Kausi 1 · Vol. I</div>
        <form className="pw-form" onSubmit={handleSubmit}>
          <div className="pw-field-wrap">
            <input
              className={cls('pw-input', err && 'pw-err')}
              type="password"
              placeholder=""
              value={pw}
              autoFocus
              autoComplete="off"
              onChange={(e) => { setPw(e.target.value); setErr(false); }}
            />
            {err && <div className="pw-errmsg">Väärä salasana</div>}
          </div>
          <button className="pw-btn" type="submit">Kirjaudu sisään →</button>
        </form>
      </div>
    </div>
  );
}

// ── Login screen ───────────────────────────

function LoginScreen({ onLogin, existingPlayers }) {
  const [nick, setNick] = useState('');
  const [city, setCity] = useState('');
  const canSubmit = nick.trim().length >= 2 && city.trim().length >= 2;
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onLogin(nick.trim().toUpperCase(), city.trim());
  };

  const recent = useMemo(() => {
    return Object.values(existingPlayers || {})
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
      .slice(0, 6);
  }, [existingPlayers]);

  return (
    <div className="login-bg">
      <div className="login-grid" />
      <div className="login-wave">
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,100 L40,100 L60,40 L100,160 L140,40 L180,160 L220,100 L320,100 L340,60 L380,140 L420,100 L520,100 L540,30 L580,170 L620,100 L1200,100"
            fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      <div className="login-stage">
        <aside className="login-side">
          <div className="login-tag">
            <span className="bolt">⚡</span> MYYJÄTERMINAALI
            <span className="dot-live" /> ONLINE
          </div>

          <h1 className="login-headline">
            Buukkaus<span className="accent">kisa</span>
            <span className="sub">Kausi 1 · Vol. I</span>
          </h1>

          <div className="login-pitch">
            Soita. Vastaa. Buukkaa. Kausi käy kaksi viikkoa &mdash; jokainen buukattu tapaaminen vie sinua kohti playoffeja ja Yllätyskauppaa Antilta.
          </div>

          <div className="kpi-stripe">
            <div className="kpi">
              <div className="kpi-lbl">Kausi</div>
              <div className="kpi-val">25.5 → 5.6</div>
              <div className="kpi-sub">10 arkipäivää</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Playoff</div>
              <div className="kpi-val">TOP 8</div>
              <div className="kpi-sub">8.6 → 18.6</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Palkinnot</div>
              <div className="kpi-val">TOP 4</div>
              <div className="kpi-sub">Yllätyskauppa</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Pisteet</div>
              <div className="kpi-val">1 = 1</div>
              <div className="kpi-sub">Buukki = piste</div>
            </div>
          </div>

          <div className="login-flow">
            <div className="flow-step"><span className="n">01</span><span>Luurin nosto</span></div>
            <div className="flow-arr">→</div>
            <div className="flow-step"><span className="n">02</span><span>Vastattu</span></div>
            <div className="flow-arr">→</div>
            <div className="flow-step accent"><span className="n">03</span><span>Buukki</span></div>
          </div>
        </aside>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="card-head">
            <div className="card-head-lbl">Kirjautuminen</div>
            <div className="card-head-id">
              <span className="bolt">⚡</span> ASEMA #{(Math.floor(Math.random() * 90) + 10)}
            </div>
          </div>

          <div className="login-fields">
            <label>
              <span className="lbl">01 · Lempinimi</span>
              <div className="field-wrap">
                <span className="field-ico">⚡</span>
                <input
                  type="text"
                  placeholder="ESIM. SÄHKÖSAMPO"
                  value={nick}
                  maxLength={16}
                  onChange={(e) => setNick(e.target.value)}
                  autoFocus
                />
              </div>
            </label>
            <label>
              <span className="lbl">02 · Paikkakunta</span>
              <div className="field-wrap">
                <span className="field-ico">◉</span>
                <input
                  type="text"
                  placeholder="ESIM. HELSINKI"
                  value={city}
                  maxLength={24}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </label>
            <div className="login-hint">
              Sama lempinimi + paikkakunta jatkaa aiempia tilastoja. Eri yhdistelmä luo uuden myyjän.
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={!canSubmit}>
            <span>Aktivoi terminaali</span>
            <span className="arrow">→</span>
          </button>

          {recent.length > 0 && (
            <div className="login-recent">
              <div className="lbl">Tämän laitteen myyjät</div>
              <div className="recent-list">
                {recent.map((p) => (
                  <button
                    type="button"
                    key={playerKey(p.nick, p.city)}
                    className="recent-pill"
                    onClick={() => onLogin(p.nick, p.city)}
                    title={`Jatka myyjänä ${p.nick}`}
                  >
                    <span className="av">{p.init}</span>
                    <span className="nm">{p.nick}</span>
                    <span className="ci">· {p.city.toUpperCase()}</span>
                    <span className="bk">{p.buukit} pts</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card-foot">
            <span>● TIETOLIIKENNE OK</span>
            <span>● TIETOKANTA YHDISTETTY</span>
            <span>v26.1</span>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────

function Header({ me, onLogout, playerCount, isAdmin, today, dbBackend }) {
  return (
    <header className="hdr">
      <div className="hdr-logo" style={{display:'none'}}>
      </div>
      <div className="hdr-title">
        <div className="display competition">
          BUUKKAUS<span className="accent">KISA</span>
        </div>
        <div className="edition">Myynnin dashboard · {playerCount}&nbsp;pelaajaa</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className={cls('hdr-user', isAdmin && 'is-admin')}>
          <div className="av">{me.init}</div>
          <div>
            <div>
              {isAdmin ? 'ADMIN-NÄKYMÄ' : 'SISÄÄNKIRJAUTUNUT'}
              <span className={cls('db-status', dbBackend === 'supabase' && 'live')}>
                {dbBackend === 'supabase' ? '● LIVE' : '○ LOCAL'}
              </span>
            </div>
            <div className="nick">{me.nick} · {me.city.toUpperCase()}</div>
          </div>
          <button className="logout" onClick={onLogout} title="Kirjaudu ulos">ULOS</button>
        </div>
      </div>
    </header>
  );
}

// ── Ticker ───────────────────────────

function Ticker({ items, paused }) {
  const loop = useMemo(() => [...items, ...items], [items]);
  // ~6s per item, min 12s, max 90s
  const dur = Math.min(90, Math.max(12, items.length * 6));
  return (
    <div className="ticker">
      <div className="ticker-tag"><span className="dot" />LIVE</div>
      <div className="ticker-track">
        {items.length === 0 ? (
          <div style={{ color: 'rgba(245,243,238,.55)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em' }}>
            Ei vielä toimintaa — tiimin buukit ja kaupat näkyvät tässä
          </div>
        ) : (
          <div className={cls('ticker-content', paused && 'paused')} style={{ animationDuration: `${dur}s` }}>
            {loop.map((it, i) => (
              <div className="ticker-item" key={`${it.id}-${i}`}>
                <span className="t-time">{it.time}</span>
                <span className="t-nick">{it.nick}</span>
                <span className={cls('t-kind', it.accent && 't-acc')}>{it.note}</span>
                <span className="t-sep">◆</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Card (hero, actions) ───────────────────────────

function MyCard({ me, onAction }) {
  const vp = pct(me.vastatut, me.luurit);
  const bp = pct(me.buukit, me.vastatut);
  const tier = playerTier(me.buukit);
  return (
    <div className="my-card">
      <div className="mc-top">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div className="mc-tag">● SINÄ</div>
          <div className="mc-avatar">{me.init}</div>
          <div className="mc-id">
            <div className="nick">{me.nick} <span className={cls('mc-tier', 'bp-' + tier.tier.key)} title={`${tier.tier.name} · ${tier.total} buukkia`}>{tier.tier.icon} {tier.tier.name}</span></div>
            <div className="city">{me.city.toUpperCase()}{tier.next ? ` · ${tier.toNext} → ${tier.next.name}` : ' · huipputaso'}</div>
          </div>
        </div>
        <div />
        <div className={cls('mc-rank', !me.inPlayoff && 'out-playoff')}>
          <div className="lbl">Sija</div>
          <div className="num">{String(me.rank).padStart(2, '0')}</div>
          <div className={cls('gap', !me.inPlayoff && 'bad')}>
            {me.inPlayoff ? `+${me.pointsAhead} PLAYOFFEIHIN` : `−${me.pointsToPlayoff} PLAYOFFEIHIN`}
          </div>
        </div>
      </div>
      <div className="mc-stats">
        <div className="stat">
          <div className="lbl">Lähteneet</div>
          <div className="v">{me.luurit}</div>
        </div>
        <div className="stat">
          <div className="lbl">Vastatut</div>
          <div className="v">{me.vastatut}</div>
        </div>
        <div className="stat">
          <div className="lbl">Vastaus&nbsp;%</div>
          <div className="v">{vp}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>%</span></div>
        </div>
        <div className="stat highlight">
          <div className="lbl">Buukit</div>
          <div className="v" style={{ color: 'var(--accent)' }}>{me.buukit}</div>
        </div>
        <div className="stat highlight">
          <div className="lbl">Buukki&nbsp;%</div>
          <div className="v">{bp}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>%</span></div>
        </div>
        <div className="stat highlight">
          <div className="lbl">Pisteet</div>
          <div className="v" style={{ color: 'var(--accent)' }}>{me.buukit}</div>
        </div>
        <div className="stat">
          <div className="lbl">Tapaamiset</div>
          <div className="v">{me.tapaamiset || 0}</div>
        </div>
        <div className="stat">
          <div className="lbl">Kaupat</div>
          <div className="v">{me.dealsCount || 0}</div>
        </div>
        <div className="stat">
          <div className="lbl">Ø kauppa</div>
          <div className="v">{Math.round(me.avgMegis || 0)}<span style={{ fontSize: 12, color: 'var(--ink-3)' }}> Megis</span></div>
        </div>
        <div className="stat">
          <div className="lbl">Megis yht.</div>
          <div className="v">{Math.round(me.megisTotal || 0)}</div>
        </div>
        <div className="stat">
          <div className="lbl">Ø kaupan kesto</div>
          <div className="v">{Math.round(me.avgLeadDays || 0)}<span style={{ fontSize: 12, color: 'var(--ink-3)' }}> pv</span></div>
        </div>
        <div className="stat">
          <div className="lbl">Ø tapaamisia/kauppa</div>
          <div className="v">{(me.avgMeetings || 0).toFixed(1)}</div>
        </div>
      </div>
      <div className="mc-actions">
        <button className="btn" onClick={(e) => onAction('luuri', e.currentTarget.getBoundingClientRect())}>
          <span className="ico">+</span> LÄHTENYT PUHELU
        </button>
        <button
          className="btn"
          onClick={(e) => onAction('vastattu', e.currentTarget.getBoundingClientRect())}
          disabled={me.vastatut >= me.luurit}
          title={me.vastatut >= me.luurit ? 'Kirjaa ensin luurin nosto' : 'Kirjaa vastattu puhelu'}
        >
          <span className="ico">+</span> VASTATTU
        </button>
        <button
          className="btn primary"
          onClick={(e) => onAction('buukki', e.currentTarget.getBoundingClientRect())}
          disabled={me.buukit >= me.vastatut}
          title={me.buukit >= me.vastatut ? 'Tarvitset vastatun puhelun' : 'Kirjaa buukki (+1 piste)'}
        >
          <span className="ico">+</span> BUUKKI
        </button>
        <button
          className="btn"
          onClick={(e) => onAction('tapaaminen', e.currentTarget.getBoundingClientRect())}
          title="Kirjaa tapaaminen"
        >
          <span className="ico">+</span> TAPAAMINEN
        </button>
        <button
          className="btn danger"
          onClick={(e) => onAction('-buukki', e.currentTarget.getBoundingClientRect())}
          disabled={me.buukit <= 0}
          title="Peruuta viimeisin buukki"
        >
          <span className="ico">−</span> BUUKKI
        </button>
      </div>
    </div>
  );
}

// ── Row & friends ───────────────────────────

function StreakBar({ streak }) {
  const total = 5;
  return (
    <div className="streak">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cls('pellet', i < Math.min(streak, total) && 'on')} />
      ))}
      <span className="streak-num mono">{streak}</span>
    </div>
  );
}

function TrendCell({ n }) {
  if (n > 0) return <div className="trend up">▲ {n}</div>;
  if (n < 0) return <div className="trend dn">▼ {Math.abs(n)}</div>;
  return <div className="trend flat">– 0</div>;
}

function Row({ p, onClick, flash, isMe, hasEnoughForPlayoff, isAdmin, onDelete, isSakko, isExcluded, onToggleExclude }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete && onDelete(p.key, p.nick);
  };
  const handleToggleExclude = (e) => {
    e.stopPropagation();
    onToggleExclude && onToggleExclude(p.key);
  };
  return (
    <div
      className={cls(
        'row',
        `rank-${p.rank}`,
        hasEnoughForPlayoff && p.inPlayoff && 'in-playoff',
        flash && 'just-incremented',
        isMe && 'is-me',
        isExcluded && 'row-excluded'
      )}
      onClick={() => onClick(p)}
    >
      <div className="rank">{String(p.rank).padStart(2, '0')}</div>
      <div className="player">
        <div className={cls('avatar', isSakko && 'sakko-av')}>{p.init}</div>
        <div className="name-block">
          <div className="nick">{p.nick}{isSakko && <span className="sakko-inline">🚫 SAKKO</span>}</div>
          <div className="city">{p.city.toUpperCase()}</div>
        </div>
      </div>
      <div className="stat-cell col-luurit">
        <div className="v">{p.luurit}</div>
        <div className="pct">LÄHTENEET</div>
      </div>
      <div className="stat-cell col-vastatut">
        <div className="v">{p.vastatut}</div>
        <div className="pct">{p.vastausPct}% VAST.</div>
      </div>
      <div className="stat-cell points">
        <div className="v">{p.buukit}</div>
        <div className="pct">{p.buukkiPct}% BUUK.</div>
      </div>
      <div className="col-streak"><StreakBar streak={p.streak} /></div>
      <div className="col-trend" style={{ display: 'flex', justifyContent: 'center' }}>
        <TrendCell n={p.trendN} />
      </div>
      <div className={cls('gap-info col-gap', hasEnoughForPlayoff && (p.inPlayoff ? 'good' : 'bad'))}>
        {hasEnoughForPlayoff ? (
          p.inPlayoff ? (
            <>
              <div className="delta">+{p.pointsAhead}</div>
              <div>SAFE</div>
            </>
          ) : (
            <>
              <div className="delta">−{p.pointsToPlayoff}</div>
              <div>PLAYOFF</div>
            </>
          )
        ) : (
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>—</div>
        )}
      </div>
      {isAdmin && (
        <button
          className={cls('row-excl', isExcluded && 'row-excl-on')}
          onClick={handleToggleExclude}
          title={isExcluded ? `Näytä ${p.nick} kilpailussa` : `Piilota ${p.nick} kilpailusta`}
        >{isExcluded ? '👁' : '🚫'}</button>
      )}
      {isAdmin && (
        <button className="row-del" onClick={handleDelete} title={`Poista ${p.nick}`}>×</button>
      )}
    </div>
  );
}

// ── Table ───────────────────────────

function Table({ sorted, onSelect, flashKey, meKey, isAdmin, onDelete, sakkoKey, excludedKeys, onToggleExclude }) {
  const hasEnough = sorted.length >= 9;
  const isEmpty = sorted.length === 0;
  return (
    <div className="table-card">
      <div className="table-head">
        <div className="num">SIJA</div>
        <div>PELAAJA</div>
        <div className="num">LÄHTENEET</div>
        <div className="num">VASTATUT</div>
        <div className="num">BUUKIT · PTS</div>
        <div className="ctr">PUTKI</div>
        <div className="ctr">24H</div>
        <div className="num">ERO 8.</div>
      </div>
      {isEmpty && (
        <div className="empty-state">
          <div className="es-tag">ODOTETAAN PELAAJIA</div>
          <div className="es-body">Sarjataulukko täyttyy sitä mukaa kun pelaajat liittyvät kisaan.</div>
        </div>
      )}
      {sorted.slice(0, hasEnough ? 8 : sorted.length).map((p) => (
        <Row
          key={p.key}
          p={p}
          onClick={onSelect}
          flash={flashKey === p.key}
          isMe={p.key === meKey}
          hasEnoughForPlayoff={hasEnough}
          isAdmin={isAdmin}
          onDelete={onDelete}
          isSakko={sakkoKey === p.key}
          isExcluded={excludedKeys?.has(p.key)}
          onToggleExclude={onToggleExclude}
        />
      ))}
      {hasEnough && (
        <div className="playoff-divider">
          <div className="left">
            <div className="accent-bar" />
            PLAYOFF-RAJA
            <span style={{ opacity: .55, fontWeight: 500 }}>Top 8 jatkoon · 8.6 — 18.6</span>
          </div>
          <div className="right">— — — — — — — — — — — —</div>
        </div>
      )}
      {!hasEnough && sorted.length > 0 && sorted.length < 8 && (
        <div className="playoff-divider soft">
          <div className="left">
            <div className="accent-bar" />
            PLAYOFF-RAJA · TOP 8
            <span style={{ opacity: .55, fontWeight: 500 }}>
              Tarvitaan vielä {8 - sorted.length} pelaajaa kunnes pudotuspeli aktivoituu
            </span>
          </div>
          <div className="right">— — — — — — — — — — — —</div>
        </div>
      )}
      {hasEnough && sorted.slice(8).map((p) => (
        <Row
          key={p.key}
          p={p}
          onClick={onSelect}
          flash={flashKey === p.key}
          isMe={p.key === meKey}
          hasEnoughForPlayoff={hasEnough}
          isAdmin={isAdmin}
          onDelete={onDelete}
          isSakko={sakkoKey === p.key}
          isExcluded={excludedKeys?.has(p.key)}
          onToggleExclude={onToggleExclude}
        />
      ))}
    </div>
  );
}

// ── Podium ───────────────────────────

function PodiumStep({ p, place, klass, onSelect }) {
  if (!p) {
    return (
      <div className={cls('podium-step', klass, 'empty')}>
        <div className="place">{place}</div>
        <div className="avatar">—</div>
        <div className="pname" style={{ color: 'var(--ink-3)' }}>TBD</div>
        <div className="pcity">—</div>
        <div className="pts" style={{ color: 'var(--ink-3)' }}>0<span style={{ fontSize: '11px', color: 'var(--ink-3)', marginLeft: 4, fontFamily: 'JetBrains Mono, monospace' }}>PTS</span></div>
      </div>
    );
  }
  return (
    <div className={cls('podium-step', klass)} onClick={() => onSelect(p)}>
      <div className="place">{place}</div>
      <div className="avatar">{p.init}</div>
      <div className="pname">{p.nick}</div>
      <div className="pcity">{p.city}</div>
      <div className="pts">{p.buukit}<span style={{ fontSize: '11px', color: 'var(--ink-3)', marginLeft: 4, fontFamily: 'JetBrains Mono, monospace' }}>PTS</span></div>
    </div>
  );
}

function Podium({ sorted, onSelect }) {
  const [first, second, third] = sorted;
  return (
    <div className="side-card">
      <h3>
        TOP&nbsp;3 KÄRKI
        <span className="tag">PALKINTOPALLI</span>
      </h3>
      <div className="podium">
        <PodiumStep p={second} place={2} klass="silver" onSelect={onSelect} />
        <PodiumStep p={first} place={1} klass="gold" onSelect={onSelect} />
        <PodiumStep p={third} place={3} klass="bronze" onSelect={onSelect} />
      </div>
      <div className="podium-bars">
        <div className="podium-bar" />
        <div className="podium-bar gold" />
        <div className="podium-bar bronze" />
      </div>
    </div>
  );
}

// ── Bracket ───────────────────────────

// ── Bracket (Pudotuspeli) ───────────────────────────

function MatchCard({
  matchId, label, roundRange,
  match,                  // { homeKey, awayKey, winnerKey, seedH, seedA }
  playersMap,
  playoffPointsMap,
  isAdmin, started,
  onWin, onUndo, onSelect,
  highlight, bronze,
}) {
  const home = match.homeKey ? playersMap[match.homeKey] : null;
  const away = match.awayKey ? playersMap[match.awayKey] : null;
  const seedH = match.seedH ?? null;
  const seedA = match.seedA ?? null;
  const decided = !!match.winnerKey;
  const ready = started && !decided && match.homeKey && match.awayKey;
  const pending = started && !decided && (!match.homeKey || !match.awayKey);
  const status = decided ? 'done' : ready ? 'live' : pending ? 'pending' : 'preview';

  // Pisteet = vain playoff-kauden buukit (8.6→), ei koko kauden yhteensä
  const homePts = playoffPointsMap?.[match.homeKey] ?? 0;
  const awayPts = playoffPointsMap?.[match.awayKey] ?? 0;
  const homeLeading = !decided && home && away && homePts > awayPts;
  const awayLeading = !decided && home && away && awayPts > homePts;

  const SideRow = ({ side, player, seed, isWinner, isLoser }) => {
    const clickable = !!player && onSelect;
    const isLeading = side === 'home' ? homeLeading : awayLeading;
    const pts = side === 'home' ? homePts : awayPts;
    return (
      <div
        className={cls('m-side', isWinner && 'winner', isLoser && 'loser', isLeading && 'leading')}
        onClick={() => clickable && onSelect(player)}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        {/* Sarake 1: sijoitusnumero */}
        {seed != null
          ? <span className="m-seed">S{seed}</span>
          : <span className="m-seed" />
        }
        {/* Sarake 2: nimi + pisteet */}
        <div className="m-name-col">
          <span className="m-nick">{player ? player.nick : '—'}</span>
          {player && started && (
            <span className={cls('m-pts', isLeading && 'pts-lead')}>
              {pts} pts{isLeading && <span className="m-lead-ico"> ▲</span>}
            </span>
          )}
        </div>
        {/* Sarake 3: toiminto tai voittajamerkki */}
        <div className="m-action">
          {isAdmin && ready && player
            ? <button
                className="m-pick"
                onClick={(e) => { e.stopPropagation(); onWin(matchId, side); }}
                title={`Voittaja: ${player.nick} (${pts} pts)`}
              >✓</button>
            : isWinner
              ? <span className="m-ico">✓</span>
              : null
          }
        </div>
      </div>
    );
  };

  return (
    <div className={cls('m-card', `m-${status}`, highlight && 'm-final', bronze && 'm-bronze', decided && 'm-decided')}>
      <div className="m-head">
        <span className="m-id">{label || matchId}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {roundRange && <span className="m-range">{roundRange}</span>}
          <span className={cls('m-badge', `mb-${status}`)}>
            {status === 'preview' ? 'EI ALOITETTU' :
             status === 'pending' ? 'ODOTTAA' :
             status === 'live'    ? '● ELÄÄ' :
             '✓ RATKAISTU'}
          </span>
        </div>
      </div>
      <SideRow
        side="home" player={home} seed={seedH}
        isWinner={decided && match.winnerKey === match.homeKey}
        isLoser={decided && match.winnerKey !== match.homeKey}
      />
      <div className="m-vs"><span>VS</span></div>
      <SideRow
        side="away" player={away} seed={seedA}
        isWinner={decided && match.winnerKey === match.awayKey}
        isLoser={decided && match.winnerKey !== match.awayKey}
      />
      {isAdmin && decided && (
        <button className="m-undo" onClick={(e) => { e.stopPropagation(); onUndo(matchId); }}>
          ↺ Peru tulos
        </button>
      )}
    </div>
  );
}

function Bracket({ sorted, playersMap, playoff, playoffPointsMap, roundPointsMaps, isAdmin, onSelect, onWin, onUndo, onStart, onReset }) {
  const started = !!playoff?.started;

  let matches;
  if (started) {
    matches = playoff.matches;
  } else {
    const top8 = sorted.slice(0, 8);
    const seedKey = (i) => top8[i] ? top8[i].key : null;
    matches = {
      QF1: { ...EMPTY_PLAYOFF.matches.QF1, homeKey: seedKey(0), awayKey: seedKey(7) },
      QF2: { ...EMPTY_PLAYOFF.matches.QF2, homeKey: seedKey(3), awayKey: seedKey(4) },
      QF3: { ...EMPTY_PLAYOFF.matches.QF3, homeKey: seedKey(1), awayKey: seedKey(6) },
      QF4: { ...EMPTY_PLAYOFF.matches.QF4, homeKey: seedKey(2), awayKey: seedKey(5) },
      SF1: { ...EMPTY_PLAYOFF.matches.SF1 },
      SF2: { ...EMPTY_PLAYOFF.matches.SF2 },
      F:   { ...EMPTY_PLAYOFF.matches.F   },
    };
  }

  const canStart = !started && sorted.length >= 8;
  const champion = playoff?.championKey ? playersMap[playoff.championKey] : null;

  const QF_RANGE = COMPETITION.playoffRounds.QF.range;
  const SF_RANGE = COMPETITION.playoffRounds.SF.range;
  const F_RANGE  = COMPETITION.playoffRounds.F.range;

  return (
    <div className="side-card bracket-card">
      <h3>
        PLAYOFF-KAAVIO
        <span className="tag">
          {started ? (champion ? 'PÄÄTTYNYT' : 'KÄYNNISSÄ') : 'ENNAKKO'} · PUDOTUSPELI
        </span>
      </h3>

      {!started && (
        <div className="bracket-note">
          {sorted.length < 8
            ? `Tarvitaan ${8 - sorted.length} pelaajaa lisää ennen kuin playoff voidaan käynnistää`
            : 'Ennakkokaavio — pohjautuu nykyiseen sarjataulukkoon. Lukitse seedit kun runkosarja on ohi.'
          }
        </div>
      )}

      {champion && (
        <div className="champion-mini">
          <span className="lbl">🏆 MESTARI</span>
          <span className="nick">{champion.nick}</span>
          <span className="city">· {champion.city.toUpperCase()}</span>
        </div>
      )}

      <div className="bracket">
        <div className="col">
          <div className="col-label">
            <span>PUOLIVÄLIERÄT</span>
            <span className="col-date">{QF_RANGE}</span>
          </div>
          {['QF1', 'QF2', 'QF3', 'QF4'].map((id) => (
            <MatchCard
              key={id} matchId={id} label={id}
              match={matches[id]}
              playersMap={playersMap} playoffPointsMap={roundPointsMaps?.QF ?? playoffPointsMap}
              isAdmin={isAdmin} started={started}
              onWin={onWin} onUndo={onUndo} onSelect={onSelect}
            />
          ))}
        </div>
        <div className="sep" />
        <div className="col col-sf">
          <div className="col-label">
            <span>VÄLIERÄT</span>
            <span className="col-date">{SF_RANGE}</span>
          </div>
          <MatchCard
            matchId="SF1" label="VE 1"
            match={matches.SF1}
            playersMap={playersMap} playoffPointsMap={roundPointsMaps?.SF ?? playoffPointsMap}
            isAdmin={isAdmin} started={started}
            onWin={onWin} onUndo={onUndo} onSelect={onSelect}
          />
          <MatchCard
            matchId="SF2" label="VE 2"
            match={matches.SF2}
            playersMap={playersMap} playoffPointsMap={roundPointsMaps?.SF ?? playoffPointsMap}
            isAdmin={isAdmin} started={started}
            onWin={onWin} onUndo={onUndo} onSelect={onSelect}
          />
        </div>
        <div className="sep" />
        <div className="col col-final">
          <div className="col-label">
            <span>FINAALI</span>
            <span className="col-date">{F_RANGE}</span>
          </div>
          <MatchCard
            matchId="F" label="FINAALI"
            match={matches.F}
            playersMap={playersMap} playoffPointsMap={roundPointsMaps?.F ?? playoffPointsMap}
            isAdmin={isAdmin} started={started}
            onWin={onWin} onUndo={onUndo} onSelect={onSelect}
            highlight
          />
          <div className="bracket-final-meta">{COMPETITION.playoffRounds.F.range} · MESTARUUS</div>

          {/* Pronssiottelu — VE-häviäjät, samat päivät kuin finaali */}
          {started && matches.B && (
            <>
              <div className="bracket-bronze-label">🥉 PRONSSIOTTELU · 3. SIJA</div>
              <MatchCard
                matchId="B" label="3. SIJA"
                match={matches.B}
                playersMap={playersMap} playoffPointsMap={roundPointsMaps?.F ?? playoffPointsMap}
                isAdmin={isAdmin} started={started}
                onWin={onWin} onUndo={onUndo} onSelect={onSelect}
                bronze
              />
              <div className="bracket-final-meta" style={{opacity:.6}}>{COMPETITION.playoffRounds.F.range} · PRONSSI</div>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="bracket-tools">
          {!started ? (
            <button className="bt-btn primary" onClick={onStart} disabled={!canStart}>
              ⚡ LUKITSE SEEDIT & KÄYNNISTÄ PLAYOFFIT
            </button>
          ) : (
            <button className="bt-btn" onClick={onReset}>
              ↺ NOLLAA PLAYOFFIT
            </button>
          )}
          {started && !champion && (
            <div className="bt-hint">Yksi voitto = jatkoon. Klikkaa otteluvoittajaa nappi-painikkeesta.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Phase banner ───────────────────────────

function PhaseBanner({ phase, today, totalDays, playoff, champion }) {
  const map = {
    pre:      { label: 'EI ALKANUT', color: 'gray',   sub: `Alkaa MA 25.5.2026 — ${totalDays} arkipäivää` },
    regular:  { label: 'RUNKOSARJA', color: 'live',   sub: `Päivä ${today}/${totalDays} · runkosarja päättyy PE 5.6 · playoff alkaa MA 8.6` },
    lock:     { label: 'RUNKOSARJA OHI', color: 'amber', sub: 'Seedit lukittavissa · playoff alkaa MA 8.6 · finaali TO 18.6' },
    playoffs: { label: 'PLAYOFFIT KÄYNNISSÄ', color: 'live', sub: 'Pudotuspeli · QF 8.–9.6 · VE 10.–12.6 · F 15.–18.6' },
    finished: { label: 'KISA PÄÄTTYI', color: 'gold', sub: champion ? `Mestari · ${champion.nick}` : 'Loppu — 18.6.2026' },
  };
  const m = map[phase] || map.regular;
  const playoffActive = playoff?.started && !champion;
  return (
    <div className={cls('phase-banner', `pb-${m.color}`, playoffActive && 'pb-playoff-active')}>
      <div className="pb-left">
        <span className={cls('pb-dot', m.color === 'live' && 'live')} />
        <span className="pb-label">{m.label}</span>
        {playoffActive && phase !== 'playoffs' && <span className="pb-extra">· PLAYOFFIT KÄYNNISSÄ</span>}
      </div>
      <div className="pb-sub">{m.sub}</div>
      <div className="pb-end">
        <span className="pb-end-lbl">VIIMEINEN PÄIVÄ</span>
        <span className="pb-end-val">18.6.2026</span>
      </div>
    </div>
  );
}

// ── Prize ───────────────────────────

function PrizeBanner() {
  return (
    <div className="prize">
      <div>
        <div className="label">PALKINNOT — TOP 4</div>
        <div className="pname">YLLÄTYSKAUPPA ANTILTA</div>
        <div className="psub">4 PARASTA PELAAJAA PALKITAAN</div>
      </div>
      <div className="prize-pills">
        <div className="pill"><span className="ord">1.</span> ⌐ ⌐</div>
        <div className="pill"><span className="ord">2.</span> ⌐ ⌐</div>
        <div className="pill"><span className="ord">3.</span> ⌐ ⌐</div>
        <div className="pill"><span className="ord">4.</span> ⌐ ⌐</div>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────

function AdminPanel({ players, onDelete, onResetAll }) {
  const totalLuurit = players.reduce((s, p) => s + p.luurit, 0);
  const totalVastatut = players.reduce((s, p) => s + p.vastatut, 0);
  const totalBuukit = players.reduce((s, p) => s + p.buukit, 0);
  return (
    <div className="my-card admin-card">
      <div className="mc-top">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div className="mc-tag admin">● ADMIN</div>
          <div className="mc-avatar admin">AD</div>
          <div className="mc-id">
            <div className="nick">ADMIN-NÄKYMÄ</div>
            <div className="city">TAMPERE · EI MUKANA TILASTOISSA</div>
          </div>
        </div>
        <div />
        <div className="mc-rank">
          <div className="lbl">Pelaajia kisassa</div>
          <div className="num" style={{ color: 'var(--ink)' }}>{String(players.length).padStart(2, '0')}</div>
          <div className="gap" style={{ color: 'var(--ink-3)' }}>
            {players.length >= 8 ? 'PLAYOFF AKTIIVINEN' : `${8 - players.length} VIELÄ KUNNES PLAYOFF`}
          </div>
        </div>
      </div>
      <div className="mc-stats">
        <div className="stat">
          <div className="lbl">Pelaajat</div>
          <div className="v">{players.length}</div>
        </div>
        <div className="stat">
          <div className="lbl">Lähteneet (yht.)</div>
          <div className="v">{totalLuurit}</div>
        </div>
        <div className="stat">
          <div className="lbl">Vastatut (yht.)</div>
          <div className="v">{totalVastatut}</div>
        </div>
        <div className="stat highlight">
          <div className="lbl">Buukit (yht.)</div>
          <div className="v" style={{ color: 'var(--accent)' }}>{totalBuukit}</div>
        </div>
        <div className="stat highlight">
          <div className="lbl">Keskim. vast.&nbsp;%</div>
          <div className="v">{pct(totalVastatut, totalLuurit)}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>%</span></div>
        </div>
        <div className="stat highlight">
          <div className="lbl">Keskim. buuk.&nbsp;%</div>
          <div className="v">{pct(totalBuukit, totalVastatut)}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>%</span></div>
        </div>
      </div>
      <div className="admin-tools">
        <div className="tools-label">ADMIN-TYÖKALUT</div>
        <div className="tools-row">
          <button className="tool-btn" onClick={onResetAll}>
            <span className="ico">⟲</span> NOLLAA KAIKKI PELAAJAT
          </button>
          <div className="tool-hint">
            Poista pelaaja yksittäin sarjataulukon rivin <span className="kbd">×</span>-painikkeesta
            tai pelaajaprofiilin <span className="kbd">POISTA PELAAJA</span> -napista.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Player modal ───────────────────────────

// Badge- & tier-profiili (D2)
function BadgeProfile({ tier, badges }) {
  if (!tier) return null;
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);
  return (
    <div className="badge-profile">
      <div className={cls('bp-tier', 'bp-' + tier.tier.key)}>
        <span className="bp-tier-icon">{tier.tier.icon}</span>
        <div className="bp-tier-info">
          <div className="bp-tier-name">{tier.tier.name}</div>
          <div className="bp-tier-sub">
            {tier.total} buukkia{tier.next ? ` · ${tier.toNext} → ${tier.next.name}` : ' · huipputaso'}
          </div>
          <div className="bp-tier-track"><div className="bp-tier-fill" style={{ width: tier.progressPct + '%' }} /></div>
        </div>
      </div>
      <div className="bp-section-label">SAAVUTUKSET · {earned.length}/{badges.length}</div>
      <div className="bp-grid">
        {[...earned, ...locked].map(b => (
          <div key={b.id} className={cls('bp-badge', b.earned ? 'earned' : 'locked', 'bp-cat-' + b.cat)} title={b.desc}>
            <div className="bp-medal" style={{ '--pct': (b.earned ? 100 : (b.pct || 0)) + '%' }}>
              <div className="bp-medal-disc"><span className="bp-ico">{b.icon}</span></div>
              {b.earned && <span className="bp-check">✓</span>}
            </div>
            <span className="bp-name">{b.name}</span>
            {!b.earned && b.progress && <span className="bp-prog-txt">{b.progress.cur}/{b.progress.target}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerModal({ player, onClose, onAction, isMe, isAdmin, onDelete, tier, badges }) {
  if (!player) return null;
  const max = Math.max(...player.last5, 1);
  const peakIdx = player.last5.indexOf(max);
  const wkDays = currentWeekDays();
  const days  = wkDays.map(d => d.wd);
  const dates = wkDays.map(d => d.date);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>✕</button>
        <div className={cls('m-head', isMe && 'is-me')}>
          <div className="avatar">{player.init}</div>
          <div>
            <div className="name">{player.nick}</div>
            <div className="meta">
              {player.city.toUpperCase()}
              {isMe ? ' · SINÄ' : ''}
              {' · '}KAUSI 1
            </div>
          </div>
          <div className="rank-badge">
            <div className="label">Sija</div>
            <div className="rank">{String(player.rank).padStart(2, '0')}</div>
          </div>
        </div>
        <div className="m-stats">
          <div className="cell">
            <div className="label">Lähteneet</div>
            <div className="val">{player.luurit}</div>
          </div>
          <div className="cell">
            <div className="label">Vastatut</div>
            <div className="val">{player.vastatut}</div>
            <div className="sub">{player.vastausPct}% VAST.</div>
          </div>
          <div className="cell">
            <div className="label">Buukit</div>
            <div className="val" style={{ color: 'var(--accent)' }}>{player.buukit}</div>
            <div className="sub">{player.buukkiPct}% BUUK.</div>
          </div>
          <div className="cell">
            <div className="label">Putki</div>
            <div className="val">{player.streak}<span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>pv</span></div>
          </div>
          <div className="cell">
            <div className="label">Tapaamiset</div>
            <div className="val">{player.tapaamiset || 0}</div>
          </div>
          <div className="cell">
            <div className="label">Kaupat</div>
            <div className="val">{player.dealsCount || 0}</div>
            <div className="sub">Ø {Math.round(player.avgMegis || 0)} MEGIS</div>
          </div>
          <div className="cell">
            <div className="label">Ø kaupan kesto</div>
            <div className="val">{Math.round(player.avgLeadDays || 0)}<span style={{ fontSize: 12, color: 'var(--ink-3)' }}> pv</span></div>
            <div className="sub">Ø {(player.avgMeetings || 0).toFixed(1)} TAP./KAUPPA</div>
          </div>
          <div className="cell">
            <div className="label">{player.inPlayoff ? 'Ero 9. sijaan' : 'Ero playoffeihin'}</div>
            <div className="val" style={{ color: player.inPlayoff ? 'var(--green)' : 'var(--red)' }}>
              {player.inPlayoff ? `+${player.pointsAhead}` : `−${player.pointsToPlayoff}`}
            </div>
          </div>
        </div>
        <div className="chart">
          <div className="label">Buukit viim. 5&nbsp;arkipäivänä</div>
          <div className="bars">
            {player.last5.map((v, i) => (
              <div
                key={i}
                className={cls('b', i === peakIdx && v > 0 && 'peak')}
                style={{ height: `${(v / max) * 100}%` }}
              >
                <div className="v">{v}</div>
                <div className="d">{days[i]} {dates[i]}</div>
              </div>
            ))}
          </div>
        </div>
        <BadgeProfile tier={tier} badges={badges} />
        {isMe ? (
          <div className="m-foot">
            <button className="alt" onClick={onClose}>SULJE</button>
            <button onClick={() => { onAction('luuri'); onClose(); }}>+ LÄHTENYT PUHELU</button>
            <button onClick={() => { onAction('vastattu'); onClose(); }} disabled={player.vastatut >= player.luurit}>+ VASTATTU</button>
            <button onClick={() => { onAction('buukki'); onClose(); }} disabled={player.buukit >= player.vastatut}>+ BUUKKI</button>
            <button className="danger" onClick={() => { onAction('-buukki'); onClose(); }} disabled={player.buukit <= 0}>− BUUKKI</button>
          </div>
        ) : isAdmin ? (
          <div className="m-foot">
            <button className="alt" onClick={onClose}>SULJE</button>
            <button className="danger" onClick={() => onDelete(player.key, player.nick)}>POISTA PELAAJA</button>
          </div>
        ) : (
          <div className="m-foot">
            <button className="alt" onClick={onClose}>SULJE</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Float +/-  ───────────────────────────

function FloatPlus({ instances }) {
  return (
    <>
      {instances.map((i) => (
        <div
          key={i.id}
          className={cls('float-plus', i.minus && 'minus')}
          style={{ left: i.x, top: i.y }}
        >
          {i.minus ? '−1' : '+1'}
        </div>
      ))}
    </>
  );
}

// ── Confetti ───────────────────────────

function Confetti({ trigger }) {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const colors = ['#ff4a1a', '#ff7a52', '#1a1612', '#f5f3ee', '#c5972a', '#1c64f2'];
    const newBits = Array.from({ length: 80 }).map((_, i) => ({
      id: `${trigger}-${i}`,
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 200,
      rot: 360 + Math.random() * 720,
      dur: 1.8 + Math.random() * 1.4,
      bg: colors[Math.floor(Math.random() * colors.length)],
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 10,
      delay: Math.random() * 0.3,
    }));
    setBits(newBits);
    const t = setTimeout(() => setBits([]), 3500);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!bits.length) return null;
  return (
    <div className="confetti-layer">
      {bits.map((b) => (
        <div
          key={b.id}
          className="confetti-bit"
          style={{
            left: `${b.left}%`,
            background: b.bg,
            width: `${b.w}px`,
            height: `${b.h}px`,
            animationDelay: `${b.delay}s`,
            '--dx': `${b.dx}px`,
            '--rot': `${b.rot}deg`,
            '--dur': `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Tweaks ───────────────────────────

function TweaksUI({ t, setTweak, onResetAll, isAdmin }) {
  return (
    <TweaksPanel>
      <TweakSection label="Ulkoasu" />
      <TweakRadio label="Teema" value={t.theme} options={['light', 'dark']} onChange={(v) => setTweak('theme', v)} />
      <TweakRadio label="Tiheys" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
      <TweakColor label="Aksenttiväri" value={t.accent} options={ACCENT_OPTIONS} onChange={(v) => setTweak('accent', v)} />
      <TweakSection label="Näkymät" />
      <TweakToggle label="Top 3 palkintopalli" value={t.showPodium} onChange={(v) => setTweak('showPodium', v)} />
      <TweakToggle label="Playoff-kaavio" value={t.showBracket} onChange={(v) => setTweak('showBracket', v)} />
      <TweakToggle label="Live-tikkeri" value={t.showTicker} onChange={(v) => setTweak('showTicker', v)} />
      <TweakSection label="Animaatiot" />
      <TweakToggle label="Konfetti playoff-rajalla" value={t.confetti} onChange={(v) => setTweak('confetti', v)} />
      <TweakToggle label="Tikkerin animaatio" value={t.pulse} onChange={(v) => setTweak('pulse', v)} />
      {isAdmin && (
        <>
          <TweakSection label="Admin" />
          <TweakButton label="Nollaa kaikki pelaajat" onClick={onResetAll} />
        </>
      )}
    </TweaksPanel>
  );
}

// ── DailyReport ───────────────────────────

// Kaupan lisäys -modaali (etusivulta)
function DealModal({ onAdd, onClose }) {
  const today = localDateKey(new Date());
  const [toimiala, setToimiala] = useState('');
  const [megis, setMegis] = useState('');
  const [eurot, setEurot] = useState('');
  const [firstMeetingDate, setFirstMeetingDate] = useState('');
  const [signedDate, setSignedDate] = useState(today);
  const [meetingCount, setMeetingCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (saving) return; // estä tuplaklikkaus
    if (!megis && !eurot && !toimiala.trim()) return;
    setSaving(true);
    setError(null);
    let res;
    try {
      res = await onAdd({ toimiala, megis, eurot, firstMeetingDate, signedDate, meetingCount });
    } catch (e) {
      res = { ok: false, error: { message: (e && e.message) || 'Tallennus epäonnistui.' } };
    } finally {
      // AINA — muuten nappi jää ikuisesti tilaan "Tallennetaan…"
      setSaving(false);
    }
    if (res && res.ok === false) {
      setError((res.error && res.error.message) ? res.error.message : 'Tallennus epäonnistui. Yritä uudelleen.');
      return; // pidä modaali auki, älä hukkaa syötettä
    }
    onClose();
  };

  return (
    <div className="deal-modal-overlay" onClick={onClose}>
      <div className="deal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deal-modal-head">
          <span className="deal-modal-title">➕ LISÄÄ KAUPPA</span>
          <button className="deal-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="deal-form">
          <input className="deal-input" type="text" placeholder="Toimiala (vain toimiala, ei asiakkaan nimeä)"
                 value={toimiala} onChange={e => setToimiala(e.target.value)} autoFocus />
          <div className="deal-form-nums">
            <input className="deal-input" type="number" min="0" placeholder="Megis"
                   value={megis} onChange={e => setMegis(e.target.value)} />
            <input className="deal-input" type="number" min="0" placeholder="Eurot"
                   value={eurot} onChange={e => setEurot(e.target.value)} />
            <input className="deal-input" type="number" min="0" placeholder="Tapaamisia"
                   value={meetingCount} onChange={e => setMeetingCount(e.target.value)} />
          </div>
          <div className="deal-form-dates">
            <label className="deal-date-field"><span>1. tapaaminen</span>
              <input className="deal-input" type="date" value={firstMeetingDate} onChange={e => setFirstMeetingDate(e.target.value)} /></label>
            <label className="deal-date-field"><span>Allekirjoitettu</span>
              <input className="deal-input" type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} /></label>
          </div>
          {error && <div className="deal-error" role="alert">⚠️ {error}</div>}
          <div className="deal-form-actions">
            <button className="deal-save" disabled={saving} onClick={submit}>{saving ? 'Tallennetaan…' : 'Tallenna kauppa'}</button>
            <button className="deal-cancel" onClick={onClose}>Peruuta</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealEntry({ deals, onAdd, onDelete }) {
  const today = localDateKey(new Date());
  const [open, setOpen] = useState(false);
  const [toimiala, setToimiala] = useState('');
  const [megis, setMegis] = useState('');
  const [eurot, setEurot] = useState('');
  const [firstMeetingDate, setFirstMeetingDate] = useState('');
  const [signedDate, setSignedDate] = useState(today);
  const [meetingCount, setMeetingCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setToimiala(''); setMegis(''); setEurot('');
    setFirstMeetingDate(''); setSignedDate(today); setMeetingCount('');
  };
  const submit = async () => {
    if (saving) return; // estä tuplaklikkaus
    if (!megis && !eurot && !toimiala.trim()) return;
    setSaving(true);
    setError(null);
    let res;
    try {
      res = await onAdd({ toimiala, megis, eurot, firstMeetingDate, signedDate, meetingCount });
    } catch (e) {
      res = { ok: false, error: { message: (e && e.message) || 'Tallennus epäonnistui.' } };
    } finally {
      setSaving(false); // AINA
    }
    if (res && res.ok === false) {
      setError((res.error && res.error.message) ? res.error.message : 'Tallennus epäonnistui. Yritä uudelleen.');
      return; // pidä lomake auki
    }
    reset(); setOpen(false);
  };

  const sorted = [...deals].sort((a, b) =>
    (b.signed_date || b.date_key || '').localeCompare(a.signed_date || a.date_key || ''));

  return (
    <div className="deal-entry">
      <div className="deal-entry-head">
        <span className="deal-entry-title">KAUPAT</span>
        {!open && (
          <button className="deal-add-btn" onClick={() => setOpen(true)}>➕ Lisää kauppa</button>
        )}
      </div>

      {open && (
        <div className="deal-form">
          <input className="deal-input" type="text" placeholder="Toimiala (vain toimiala, ei asiakkaan nimeä)"
                 value={toimiala} onChange={e => setToimiala(e.target.value)} />
          <div className="deal-form-nums">
            <input className="deal-input" type="number" min="0" placeholder="Megis"
                   value={megis} onChange={e => setMegis(e.target.value)} />
            <input className="deal-input" type="number" min="0" placeholder="Eurot"
                   value={eurot} onChange={e => setEurot(e.target.value)} />
            <input className="deal-input" type="number" min="0" placeholder="Tapaamisia"
                   value={meetingCount} onChange={e => setMeetingCount(e.target.value)} />
          </div>
          <div className="deal-form-dates">
            <label className="deal-date-field">
              <span>1. tapaaminen</span>
              <input className="deal-input" type="date" value={firstMeetingDate}
                     onChange={e => setFirstMeetingDate(e.target.value)} />
            </label>
            <label className="deal-date-field">
              <span>Allekirjoitettu</span>
              <input className="deal-input" type="date" value={signedDate}
                     onChange={e => setSignedDate(e.target.value)} />
            </label>
          </div>
          {error && <div className="deal-error" role="alert">⚠️ {error}</div>}
          <div className="deal-form-actions">
            <button className="deal-save" disabled={saving} onClick={submit}>{saving ? 'Tallennetaan…' : 'Tallenna kauppa'}</button>
            <button className="deal-cancel" onClick={() => { reset(); setError(null); setOpen(false); }}>Peruuta</button>
          </div>
        </div>
      )}

      {sorted.length > 0 ? (
        <ul className="deal-list">
          {sorted.map(d => {
            const lt = dealLeadTimeDays(d);
            return (
              <li key={d.id} className="deal-row">
                <span className="deal-toimiala">{d.toimiala || '—'}</span>
                <span className="deal-megis">{d.megis} Megis</span>
                <span className="deal-eur">{Math.round(d.eurot)} €</span>
                <span className="deal-lead" title="Kaupan kesto">{lt != null ? lt + ' pv' : '—'}</span>
                <span className="deal-meet" title="Tapaamisia">{Number(d.meeting_count) > 0 ? d.meeting_count + ' tap.' : '—'}</span>
                <span className="deal-date" title="Allekirjoitettu">{d.signed_date || d.date_key || ''}</span>
                <button className="deal-del" title="Poista kauppa" onClick={() => onDelete(d.id)}>✕</button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="deal-empty">Ei kauppoja vielä.</div>
      )}
    </div>
  );
}

function DailyReport({ currentKey, isAdmin, dailyStats, players, onSaveDay, deals, onAddDeal, onDeleteDeal }) {
  // Combine regular season + playoff days for the selector
  const allDays = [
    ...COMPETITION.weekdays.map((d, i) => ({ ...d, idx: i })),
    ...COMPETITION.playoffWeekdays.map((d, i) => ({ ...d, idx: 10 + i })),
  ];
  const phase = competitionPhase();
  const days = (phase === 'playoffs' || phase === 'finished' || phase === 'lock')
    ? allDays
    : COMPETITION.weekdays.map((d, i) => ({ ...d, idx: i }));

  const rawIdx = currentWeekdayIndex();
  const todayIdx = rawIdx >= 0 ? Math.min(rawIdx, WEEKDAY_DATE_KEYS.length - 1) : 0;
  const [selIdx, setSelIdx] = useState(todayIdx);
  const [selDate, setSelDate] = useState(() => localDateKey(new Date())); // pelaajan valitsema pvm
  const [form, setForm] = useState({ luurit: 0, vastatut: 0, buukit: 0, tapaamiset: 0 });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Tiimiraportti (admin): aikajakso + laajennettava päiväerittely
  const [teamPeriod, setTeamPeriod] = useState('thisMonth');
  const [teamCStart, setTeamCStart] = useState(() => localDateKey(new Date()));
  const [teamCEnd, setTeamCEnd] = useState(() => localDateKey(new Date()));
  const [expandedKey, setExpandedKey] = useState(null);
  const teamRange = periodRange(teamPeriod, null, teamCStart, teamCEnd);

  // Pelaaja: vapaa päivämäärä
  const dateKey = selDate;

  // Admin: group daily_stats by date, then by player
  const allPlayers = players;

  // Load form when day changes (player view)
  useEffect(() => {
    if (isAdmin) return;
    const row = dailyStats.find(r => r.player_id === currentKey && r.date_key === dateKey);
    setForm(row ? { luurit: row.luurit||0, vastatut: row.vastatut||0, buukit: row.buukit||0, tapaamiset: row.tapaamiset||0 } : { luurit:0, vastatut:0, buukit:0, tapaamiset:0 });
  }, [selDate, dailyStats, currentKey, dateKey, isAdmin]);

  const adj = (field, delta) => setForm(prev => {
    const next = { ...prev, [field]: Math.max(0, (prev[field]||0) + delta) };
    if (field === 'buukit' && next.buukit > next.vastatut) next.buukit = next.vastatut;
    if (field === 'vastatut' && next.vastatut > next.luurit) next.vastatut = next.luurit;
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    await onSaveDay(dateKey, form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const vstPct = form.luurit > 0 ? Math.round(form.vastatut/form.luurit*100) : 0;
  const bkPct  = form.vastatut > 0 ? Math.round(form.buukit/form.vastatut*100) : 0;

  return (
    <div className="daily-report">
      <div className="dr-header">
        <div className="dr-title">PÄIVÄRAPORTTI</div>
        {isAdmin && <div className="dr-sub">Admin — kaikkien pelaajien päiväkohtaiset tilastot</div>}
        {!isAdmin && <div className="dr-sub">Syötä päivän tilastosi — tallennus päivittää sarjataulukon</div>}
      </div>

      {/* Aikajakso: admin = tiimiraportin jakso; pelaaja = päivämäärävalitsin */}
      {isAdmin ? (
        <PeriodBar periodKind={teamPeriod} onKind={setTeamPeriod} customStart={teamCStart} customEnd={teamCEnd} onCustomStart={setTeamCStart} onCustomEnd={setTeamCEnd} label={teamRange.label} />
      ) : (
        <div className="dr-datepick">
          <label>Päivä:</label>
          <input type="date" value={selDate} max={localDateKey(new Date())} onChange={(e) => setSelDate(e.target.value)} />
          <button className="dr-today-btn" onClick={() => setSelDate(localDateKey(new Date()))}>Tänään</button>
        </div>
      )}

      {isAdmin ? (
        /* Tiimiraportti: pelaajakohtaiset summat jaksolta + laajennettava päiväerittely */
        (() => {
          const inR = (dk) => dk >= teamRange.startKey && dk <= teamRange.endKey;
          const sum = (arr, f) => arr.reduce((a, r) => a + (Number(r[f]) || 0), 0);
          const teamRows = allPlayers.filter(p => p.key !== ADMIN_KEY && !p.is_admin).map(p => {
            const myDaily = dailyStats.filter(r => r.player_id === p.key && inR(r.date_key)).slice().sort((a, b) => a.date_key.localeCompare(b.date_key));
            const myDeals = (deals || []).filter(d => d.player_id === p.key && inR(d.date_key)).slice().sort((a, b) => (a.signed_date || a.date_key).localeCompare(b.signed_date || b.date_key));
            return {
              ...p,
              luurit: sum(myDaily, 'luurit'), vastatut: sum(myDaily, 'vastatut'), buukit: sum(myDaily, 'buukit'), tapaamiset: sum(myDaily, 'tapaamiset'),
              dealsCount: myDeals.length, megisTotal: sum(myDeals, 'megis'), eurTotal: sum(myDeals, 'eurot'),
              _daily: myDaily, _deals: myDeals,
            };
          }).sort((a, b) => b.buukit - a.buukit);
          return (
            <div className="dr-admin-table-wrap">
              <table className="dash-table team-table">
                <thead>
                  <tr>
                    <th className="dt-player">Pelaaja</th>
                    <th className="dt-num">Lähteneet</th><th className="dt-num">Vastatut</th><th className="dt-num">Buukit</th>
                    <th className="dt-num">Tapaamiset</th><th className="dt-num">Kaupat</th><th className="dt-num">Megis</th><th className="dt-num">€</th>
                    <th className="dt-num"></th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.length === 0 && <tr><td colSpan={9} className="dt-empty">Ei dataa tälle ajanjaksolle.</td></tr>}
                  {teamRows.map(p => (
                    <React.Fragment key={p.key}>
                      <tr className={cls(expandedKey === p.key && 'dt-me')}>
                        <td className="dt-player"><span className="dt-avatar">{p.init}</span><span className="dt-nick">{p.nick}</span><span className="dt-city">{(p.city || '').toUpperCase()}</span></td>
                        <td className="dt-num">{p.luurit}</td><td className="dt-num">{p.vastatut}</td><td className="dt-num">{p.buukit}</td>
                        <td className="dt-num">{p.tapaamiset}</td><td className="dt-num">{p.dealsCount}</td><td className="dt-num">{Math.round(p.megisTotal)}</td><td className="dt-num">{Math.round(p.eurTotal)}</td>
                        <td className="dt-num">
                          <button className="team-expand-btn" onClick={() => setExpandedKey(expandedKey === p.key ? null : p.key)}>
                            {expandedKey === p.key ? '▲ Sulje' : '▼ Päivät'}
                          </button>
                        </td>
                      </tr>
                      {expandedKey === p.key && (
                        <tr className="team-detail-row">
                          <td colSpan={9}>
                            <div className="team-detail">
                              <div className="team-detail-col">
                                <div className="team-detail-h">Päivät</div>
                                {p._daily.length === 0 ? <div className="team-detail-empty">—</div> : p._daily.map(r => (
                                  <div key={r.date_key} className="team-detail-row-item">
                                    <span>{r.date_key}</span>
                                    <span>L:{r.luurit || 0} · V:{r.vastatut || 0} · {r.buukit || 0}bk · T:{r.tapaamiset || 0}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="team-detail-col">
                                <div className="team-detail-h">Kaupat</div>
                                {p._deals.length === 0 ? <div className="team-detail-empty">—</div> : p._deals.map(d => (
                                  <div key={d.id} className="team-detail-row-item">
                                    <span>{d.signed_date || d.date_key} · {d.toimiala || '—'}</span>
                                    <span>{d.megis} Megis · {Math.round(d.eurot)} €</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()
      ) : (
        /* Player entry form */
        <div className="dr-form">
          <div className="dr-form-title">
            {selDate} — SYÖTÄ TILASTOT
          </div>
          {[
            { key: 'luurit',   label: 'LÄHTENEET PUHELUT', max: null },
            { key: 'vastatut', label: 'VASTATUT PUHELUT', max: form.luurit },
            { key: 'buukit',   label: 'BUUKIT',          max: form.vastatut },
            { key: 'tapaamiset', label: 'TAPAAMISET',    max: null },
          ].map(({ key, label, max }) => (
            <div className="dr-row" key={key}>
              <div className="dr-label">{label}</div>
              <div className="dr-ctrl">
                <button className="dr-btn minus" onClick={() => adj(key, -1)}>−</button>
                <span className="dr-val">{form[key]}</span>
                <button className="dr-btn plus" onClick={() => adj(key, 1)}>+</button>
              </div>
              {key === 'vastatut' && <div className="dr-pct">Vastaus % {vstPct}%</div>}
              {key === 'buukit'   && <div className="dr-pct">Buukki % {bkPct}%</div>}
            </div>
          ))}
          <button
            className={cls('dr-save-btn', saving && 'saving', saved && 'saved-ok')}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'TALLENNETAAN...' : saved ? '✓ TALLENNETTU' : 'TALLENNA PÄIVÄ'}
          </button>
          <div className="dr-hint">Sama yhdistelmä korvaa aiemman syötön. Sarjataulukko päivittyy heti.</div>
        </div>
      )}

      {/* Kaupat — vain pelaajanäkymä, kaikki omat kaupat allekirjoituspäivän mukaan */}
      {!isAdmin && (
        <DealEntry
          deals={(deals || []).filter(d => d.player_id === currentKey)}
          onAdd={onAddDeal}
          onDelete={onDeleteDeal}
        />
      )}

      {/* Own summary table for non-admin */}
      {!isAdmin && (
        <div className="dr-summary">
          <div className="dr-sum-title">OMA YHTEENVETO</div>
          <table className="dr-sum-table">
            <thead><tr><th>Päivä</th><th>Lähteneet</th><th>Vastatut</th><th>Buukit</th><th>Vast%</th><th>Buuk%</th></tr></thead>
            <tbody>
              {dailyStats.filter(r => r.player_id === currentKey)
                .slice().sort((a,b) => b.date_key.localeCompare(a.date_key)).slice(0, 30)
                .map((row) => {
                const l = row.luurit||0, v = row.vastatut||0, b = row.buukit||0;
                return (
                  <tr key={row.date_key} className={cls(row.date_key===selDate&&'sel-row')}>
                    <td>{row.date_key}</td>
                    <td>{l||'—'}</td>
                    <td>{v||'—'}</td>
                    <td style={{fontWeight:b>0?700:400,color:b>0?'var(--red)':'inherit'}}>{b||'—'}</td>
                    <td>{l>0?Math.round(v/l*100)+'%':'—'}</td>
                    <td>{v>0?Math.round(b/v*100)+'%':'—'}</td>
                  </tr>
                );
              })}
              <tr className="sum-total">
                <td>YHTEENSÄ</td>
                {['luurit','vastatut','buukit'].map(f => (
                  <td key={f}>{dailyStats.filter(r=>r.player_id===currentKey).reduce((acc,r)=>acc+(r[f]||0),0)}</td>
                ))}
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab nav ───────────────────────────

function TabNav({ active, onChange, isAdmin }) {
  return (
    <div className="tab-nav">
      <button className={cls('tab-btn', active === 'leaderboard' && 'active')} onClick={() => onChange('leaderboard')}>
        ⚡ SARJATAULUKKO
      </button>
      <button className={cls('tab-btn', active === 'teamreport' && 'active')} onClick={() => onChange('teamreport')}>
        📋 TIIMIRAPORTTI
      </button>
      <button className={cls('tab-btn', active === 'report' && 'active')} onClick={() => onChange('report')}>
        📊 {isAdmin ? 'PÄIVÄRAPORTTI' : 'OMA RAPORTTI'}
      </button>
      <button className={cls('tab-btn', active === 'hof' && 'active')} onClick={() => onChange('hof')}>
        🏛️ HALL OF FAME
      </button>
      <button className={cls('tab-btn', active === 'archive' && 'active')} onClick={() => onChange('archive')}>
        🏆 ARKISTO
      </button>
    </div>
  );
}

// ── App ───────────────────────────

// ── PlayoutPanel ───────────────────────────

function PlayoutPanel({ playout, sorted, playersMap, playoff, playoffPointsMap, isAdmin, onStart, onSetSakko, onClearSakko, onReset }) {
  // Käytä jäädytettyjä playoff-seedejä, ei nykyistä rankia
  const inPlayoffSet = playoff?.started
    ? new Set(Object.values(playoff.seeds || {}))
    : null;
  const nonPlayoff = sorted
    .filter(p => inPlayoffSet ? !inPlayoffSet.has(p.key) : !p.inPlayoff)
    .map(p => ({ ...p, playoffPts: playoffPointsMap?.[p.key] ?? 0 }))
    .sort((a, b) => b.playoffPts - a.playoffPts);
  const sakkoPlayer = playout?.sakkoKey ? playersMap[playout.sakkoKey] : null;

  return (
    <div className="side-card playout-card">
      <h3 className="display">
        PLAYOUT
        <span className="tag">RUNKOSARJAN ULKOPUOLISET</span>
      </h3>

      {playout?.sakkoKey && sakkoPlayer && (
        <div className="playout-sakko-banner">
          <span className="sakko-ico">🚫</span>
          <span><strong>{sakkoPlayer.nick}</strong> sai SAKON</span>
          {isAdmin && <button className="playout-undo-btn" onClick={onClearSakko}>↺ Peru</button>}
        </div>
      )}

      {nonPlayoff.length === 0 ? (
        <div className="bracket-note">Kaikki pelaajat pääsivät playoffeihin!</div>
      ) : (
        <div className="playout-list">
          {nonPlayoff.map(p => (
            <div key={p.key} className={cls('playout-row', playout?.sakkoKey === p.key && 'is-sakko')}>
              <span className="playout-rank">{String(nonPlayoff.indexOf(p)+1).padStart(2,'0')}</span>
              <span className={cls('playout-av', playout?.sakkoKey === p.key && 'sakko-av')}>{p.init}</span>
              <span className="playout-nick">{p.nick}</span>
              <span className="playout-pts">{p.playoffPts} pts</span>
              {playout?.sakkoKey === p.key
                ? <span className="sakko-badge">🚫 SAKKO</span>
                : isAdmin && playout?.started && !playout?.sakkoKey
                  ? <button className="playout-sakko-btn" onClick={() => onSetSakko(p.key)}>SAKKO</button>
                  : null
              }
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="bracket-tools" style={{marginTop:12}}>
          {!playout?.started ? (
            <button className="bt-btn primary" onClick={onStart} disabled={nonPlayoff.length === 0}>
              ⚡ KÄYNNISTÄ PLAYOUT
            </button>
          ) : !playout?.sakkoKey ? (
            <div className="bt-hint">Valitse sakonsaaja listalta → SAKKO-nappi</div>
          ) : (
            <button className="bt-btn" onClick={onReset}>↺ Nollaa playout</button>
          )}
        </div>
      )}
    </div>
  );
}

// Supabase/RPC-virheiden käännös suomeksi
function authErrorFi(err) {
  const m = ((err && err.message) || '').toLowerCase();
  if (m.includes('invalid login')) return 'Väärä sähköposti tai salasana';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Sähköposti on jo rekisteröity';
  if (m.includes('invite')) return 'Virheellinen kutsukoodi';
  if (m.includes('name taken')) return 'Nimi varattu — käytä linkitystä';
  if (m.includes('already has a player')) return 'Tällä tilillä on jo pelaaja';
  if (m.includes('already linked')) return 'Pelaaja on jo linkitetty toiselle tilille';
  if (m.includes('player not found')) return 'Pelaajaa ei löytynyt';
  if (m.includes('password')) return 'Salasana ei kelpaa (väh. 8 merkkiä)';
  return (err && err.message) || 'Tuntematon virhe';
}

// Oikea autentikointi (tuotanto). linkStep=true: sessio on, mutta pelaaja puuttuu.
// Näytetään kun sovellus on konfiguroitu Supabaseen mutta yhteyttä ei saatu
// (SDK:n CDN estetty/ei latautunut). Ilman tätä sovellus putosi hiljaa localStorageen:
// kirjaukset näyttivät tallentuvan ja säilyivät latauksesta toiseen, mutta mikään
// ei päätynyt kantaan — luvut eivät näkyneet kenellekään muulle.
// Näkyvä varoitus kun kirjaus EI tallentunut kantaan. Aiemmin tällainen virhe
// meni vain konsoliin ja optimistinen luku jäi ruudulle → käyttäjä luuli kirjanneensa.
function SaveErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="save-error-banner" role="alert">
      <span className="seb-icon">⚠️</span>
      <span className="seb-text">
        <strong>Kirjaus ei tallentunut.</strong> Luku palautettiin, koska sitä ei saatu talteen.
        Tarkista verkkoyhteys ja kirjaa uudelleen. <span className="seb-detail">({message} · v{DB.version})</span>
      </span>
      <button className="seb-reload" onClick={() => window.location.reload()}>Lataa uudelleen</button>
      <button className="seb-x" onClick={onDismiss} aria-label="Sulje">✕</button>
    </div>
  );
}

// Kirjaus MENI läpi, mutta jokin vaatii huomiota (esim. laitteen kello väärässä).
function SaveWarningBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="save-warn-banner" role="status">
      <span className="swb-icon">🕒</span>
      <span className="swb-text"><strong>Kirjaus tallentui.</strong> {message}</span>
      <button className="swb-x" onClick={onDismiss} aria-label="Sulje">✕</button>
    </div>
  );
}

function ConnectionErrorScreen() {
  return (
    <div className="conn-error-wrap">
      <div className="conn-error">
        <div className="conn-error-badge">YHTEYSVIRHE</div>
        <h1 className="conn-error-title">Tietokantayhteyttä ei saatu</h1>
        <p className="conn-error-lead">
          <strong>Älä kirjaa tuloksia nyt.</strong> Kirjaukset eivät tallentuisi mihinkään
          eivätkä näkyisi muille.
        </p>
        <ol className="conn-error-steps">
          <li>Lataa sivu uudelleen.</li>
          <li>Jos virhe toistuu, kokeile toista verkkoa (esim. mobiilidata) tai toista selainta.</li>
          <li>Mainosten- tai skriptinesto voi estää yhteyden — poista se tältä sivustolta käytöstä.</li>
        </ol>
        <button className="conn-error-btn" onClick={() => window.location.reload()}>Lataa uudelleen</button>
      </div>
    </div>
  );
}

function AuthScreen({ linkStep, onLinked }) {
  const [tab, setTab] = useState(linkStep ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('new');          // 'new' | 'link'
  const [nick, setNick] = useState('');
  const [city, setCity] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [unlinked, setUnlinked] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((tab === 'register' || linkStep) && mode === 'link') {
      DB.fetchUnlinkedPlayers().then(setUnlinked).catch(() => setUnlinked([]));
    }
  }, [tab, mode, linkStep]);

  const doLogin = async () => {
    setError(''); setBusy(true);
    const { error } = await DB.signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(authErrorFi(error));
    // onnistuessa onAuthChange hoitaa siirtymän
  };

  const doRegister = async () => {
    setError('');
    // Validointi
    if (linkStep) {
      if (!code.trim()) { setError('Kutsukoodi puuttuu'); return; }
      if (mode === 'link' && !playerId) { setError('Valitse linkitettävä pelaaja'); return; }
      if (mode === 'new' && (nick.trim().length < 2 || city.trim().length < 2)) { setError('Nimi ja paikkakunta väh. 2 merkkiä'); return; }
    } else {
      const v = validateRegForm({ email, password, code, mode, nick, city, playerId });
      if (!v.ok) { setError(v.error); return; }
    }
    setBusy(true);
    let uid = null;
    if (linkStep) {
      const s = await DB.getSession();
      uid = s ? s.user.id : null;
    } else {
      const { data, error } = await DB.signUp(email.trim(), password);
      if (error) { setBusy(false); setError(authErrorFi(error)); return; }
      uid = (data.user && data.user.id) || (data.session && data.session.user.id) || null;
      if (!uid) { setBusy(false); setError('Rekisteröinti ei palauttanut sessiota (onko sähköpostivahvistus päällä?)'); return; }
    }
    const res = mode === 'link'
      ? await DB.linkExistingPlayer(playerId, code.trim())
      : await DB.registerPlayer(nick.trim(), city.trim(), code.trim());
    if (res && res.error) { setBusy(false); setError(authErrorFi(res.error)); return; }
    const player = await DB.fetchMyPlayer(uid);
    setBusy(false);
    if (player) onLinked(player);
    else setError('Linkitys epäonnistui — yritä uudelleen');
  };

  const showRegister = tab === 'register' || linkStep;

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-bolt">⚡</span>
          <span className="auth-title">MYYNTITERMINAALI</span>
        </div>

        {!linkStep && (
          <div className="auth-tabs">
            <button className={cls('auth-tab', tab === 'login' && 'active')} onClick={() => { setTab('login'); setError(''); }}>Kirjaudu</button>
            <button className={cls('auth-tab', tab === 'register' && 'active')} onClick={() => { setTab('register'); setError(''); }}>Rekisteröidy</button>
          </div>
        )}
        {linkStep && <div className="auth-sub">Olet kirjautunut — luo pelaaja tai linkitä olemassa oleva</div>}

        {!linkStep && (
          <>
            <label className="auth-field"><span>Sähköposti</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
            <label className="auth-field"><span>Salasana</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={showRegister ? 'new-password' : 'current-password'} /></label>
          </>
        )}

        {showRegister && (
          <>
            <label className="auth-field"><span>Kutsukoodi</span>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} /></label>

            <div className="auth-mode">
              <button className={cls('auth-mode-btn', mode === 'new' && 'active')} onClick={() => { setMode('new'); setError(''); }}>Luo uusi pelaaja</button>
              <button className={cls('auth-mode-btn', mode === 'link' && 'active')} onClick={() => { setMode('link'); setError(''); }}>Linkitä olemassa oleva</button>
            </div>

            {mode === 'new' ? (
              <div className="auth-row2">
                <label className="auth-field"><span>Nimi</span>
                  <input type="text" value={nick} onChange={e => setNick(e.target.value)} placeholder="Lempinimi" /></label>
                <label className="auth-field"><span>Paikkakunta</span>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} /></label>
              </div>
            ) : (
              <label className="auth-field"><span>Valitse pelaaja</span>
                <select value={playerId} onChange={e => setPlayerId(e.target.value)}>
                  <option value="">— valitse linkittämätön pelaaja —</option>
                  {unlinked.map(p => <option key={p.id} value={p.id}>{p.nick} · {p.city}</option>)}
                </select>
                {unlinked.length === 0 && <span className="auth-hint">Ei linkittämättömiä pelaajia.</span>}
              </label>
            )}
          </>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit" disabled={busy} onClick={showRegister ? doRegister : doLogin}>
          {busy ? 'Hetki…' : (showRegister ? (linkStep ? 'Vahvista' : 'Rekisteröidy') : 'Kirjaudu')}
        </button>
      </div>
    </div>
  );
}

// ── Aikajakso- ja järjestyssegmentit + dashboard-taulu (C) ───────────
function PeriodBar({ periodKind, onKind, customStart, customEnd, onCustomStart, onCustomEnd, label }) {
  const opts = [
    { k: 'today', t: 'Tänään' }, { k: 'thisWeek', t: 'Viikko' }, { k: 'thisMonth', t: 'Kuukausi' },
    { k: 'lastMonth', t: 'Viime kk' }, { k: 'thisYear', t: 'Vuosi' }, { k: 'custom', t: 'Oma väli' },
  ];
  return (
    <div className="period-bar">
      <div className="seg">
        {opts.map(o => (
          <button key={o.k} className={cls('seg-btn', periodKind === o.k && 'active')} onClick={() => onKind(o.k)}>{o.t}</button>
        ))}
      </div>
      {periodKind === 'custom' && (
        <div className="period-custom">
          <input type="date" value={customStart} onChange={e => onCustomStart(e.target.value)} />
          <span>–</span>
          <input type="date" value={customEnd} onChange={e => onCustomEnd(e.target.value)} />
        </div>
      )}
      <div className="period-label">{label}</div>
    </div>
  );
}

function RankTabs({ rankBy, onRankBy }) {
  const opts = [
    { k: 'buukit', t: 'Buukit' }, { k: 'megis', t: 'Megis' }, { k: 'eurot', t: '€' }, { k: 'tapaamiset', t: 'Tapaamiset' },
  ];
  return (
    <div className="rank-tabs">
      <span className="rank-tabs-lbl">Järjestä:</span>
      <div className="seg">
        {opts.map(o => (
          <button key={o.k} className={cls('seg-btn', rankBy === o.k && 'active')} onClick={() => onRankBy(o.k)}>{o.t}</button>
        ))}
      </div>
    </div>
  );
}

function DashboardTable({ rows, rankBy, onSelect, meKey }) {
  const cols = [
    { k: 'luurit', t: 'Lähteneet' }, { k: 'vastatut', t: 'Vastatut' }, { k: 'buukit', t: 'Buukit' },
    { k: 'tapaamiset', t: 'Tapaamiset' }, { k: 'dealsCount', t: 'Kaupat' }, { k: 'megisTotal', t: 'Megis' }, { k: 'eurTotal', t: '€' },
  ];
  const activeCol = rankBy === 'megis' ? 'megisTotal' : rankBy === 'eurot' ? 'eurTotal' : rankBy;
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th className="dt-rank">#</th>
            <th className="dt-player">Pelaaja</th>
            {cols.map(c => <th key={c.k} className={cls('dt-num', c.k === activeCol && 'dt-active')}>{c.t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={9} className="dt-empty">Ei dataa tälle ajanjaksolle.</td></tr>
          )}
          {rows.map(p => (
            <tr key={p.key} className={cls(p.key === meKey && 'dt-me', p.rank <= 3 && 'dt-top')} onClick={() => onSelect && onSelect(p)}>
              <td className="dt-rank">{String(p.rank).padStart(2, '0')}</td>
              <td className="dt-player">
                <span className="dt-avatar">{p.init}</span>
                <span className="dt-nick">{p.nick}</span>
                <span className="dt-city">{(p.city || '').toUpperCase()}</span>
              </td>
              {cols.map(c => (
                <td key={c.k} className={cls('dt-num', c.k === activeCol && 'dt-active')}>
                  {c.k === 'megisTotal' || c.k === 'eurTotal' ? Math.round(p[c.k] || 0) : (p[c.k] || 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tiimitavoite — edistymispalkki (kaikille) (D1)
function GoalBar({ progress, label }) {
  if (!progress) return null;
  const unit = progress.metric === 'megis' ? 'Megis' : progress.metric === 'eurot' ? '€' : 'buukkia';
  return (
    <div className={cls('goal-bar', progress.hit && 'goal-hit')}>
      <div className="goal-bar-head">
        <span className="goal-bar-title">🎯 TIIMITAVOITE · {label}</span>
        <span className="goal-bar-nums">{Math.round(progress.current)} / {progress.target} {unit}</span>
      </div>
      <div className="goal-track"><div className="goal-fill" style={{ width: progress.pct + '%' }} /></div>
      <div className="goal-meta">
        {progress.hit ? (
          <span className="goal-done">🎉 TAVOITE SAAVUTETTU!</span>
        ) : (
          <>
            <span>{progress.pct}% suoritettu</span>
            <span>· {progress.daysLeft} pv jäljellä</span>
            <span>· tarvitaan +{progress.neededPerDay}/pv</span>
          </>
        )}
      </div>
    </div>
  );
}

// Admin: aseta kuluvan kuukauden tiimitavoite (D1)
function GoalAdmin({ current, label, onSave }) {
  const [metric, setMetric] = useState(current?.metric || 'buukit');
  const [target, setTarget] = useState(current?.target || '');
  useEffect(() => { setMetric(current?.metric || 'buukit'); setTarget(current?.target || ''); }, [current]);
  return (
    <div className="goal-admin">
      <div className="goal-admin-title">TIIMITAVOITE · {label}</div>
      <div className="goal-admin-row">
        <select value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="buukit">Buukit</option>
          <option value="megis">Megis</option>
          <option value="eurot">Eurot</option>
        </select>
        <input type="number" min="0" placeholder="Tavoite" value={target} onChange={e => setTarget(e.target.value)} />
        <button onClick={() => onSave(metric, target)}>Tallenna tavoite</button>
      </div>
    </div>
  );
}

// Hall of Fame (D4)
const HOF_MONTH_NAMES = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'];
function HallOfFame({ data, champion }) {
  const { records, monthlyMvps } = data;
  const monthLbl = (m) => { const [y, mo] = m.split('-'); return `${HOF_MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`; };
  return (
    <div className="hof">
      <div className="hof-title">🏛️ HALL OF FAME</div>
      {champion && (
        <div className="hof-champ">
          <span className="hof-champ-ico">🥇</span>
          <div>
            <div className="hof-champ-lbl">KAUSIVOITTAJA · KAUSI 1</div>
            <div className="hof-champ-nick">{champion}</div>
          </div>
        </div>
      )}
      <div className="hof-section-label">🏆 ENNÄTYKSET (ALL-TIME)</div>
      <div className="hof-records">
        {records.map(r => (
          <div key={r.id} className="hof-rec">
            <span className="hof-rec-ico">{r.icon}</span>
            <div className="hof-rec-body">
              <div className="hof-rec-label">{r.label}</div>
              <div className="hof-rec-holder"><strong>{r.nick}</strong>{r.value > 0 ? ` · ${r.value} ${r.sub}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="hof-section-label">👑 KUUKAUSI-MVP:T</div>
      {monthlyMvps.length === 0 ? (
        <div className="hof-empty">Ei vielä kuukausidataa.</div>
      ) : (
        <div className="hof-mvps">
          {monthlyMvps.map(m => (
            <div key={m.month} className="hof-mvp">
              <span className="hof-mvp-month">{monthLbl(m.month)}</span>
              <span className="hof-mvp-nick">👑 {m.nick}</span>
              <span className="hof-mvp-buukit">{m.buukit} bk</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// H2H-haaste — viikon duelli (D3)
function H2HCard({ stand }) {
  if (!stand) return null;
  const aLead = stand.leaderKey === stand.a.key;
  const bLead = stand.leaderKey === stand.b.key;
  return (
    <div className="h2h-card">
      <div className="h2h-tag">⚔️ VIIKON DUELI</div>
      <div className="h2h-players">
        <div className={cls('h2h-side', aLead && 'lead')}>
          <div className="h2h-nick">{stand.a.nick}</div>
          <div className="h2h-pts">{stand.a.buukit}</div>
        </div>
        <div className="h2h-vs">VS</div>
        <div className={cls('h2h-side', bLead && 'lead')}>
          <div className="h2h-nick">{stand.b.nick}</div>
          <div className="h2h-pts">{stand.b.buukit}</div>
        </div>
      </div>
      <div className="h2h-meta">
        {stand.tie ? 'Tasapeli' : `${(aLead ? stand.a : stand.b).nick} johtaa +${stand.diff}`} · buukit
      </div>
    </div>
  );
}

// Admin: aseta viikon duelli (D3)
function H2HAdmin({ players, current, onSave }) {
  const [a, setA] = useState(current?.a || '');
  const [b, setB] = useState(current?.b || '');
  useEffect(() => { setA(current?.a || ''); setB(current?.b || ''); }, [current]);
  const opts = (players || []).filter(p => p.key !== ADMIN_KEY && !p.is_admin);
  return (
    <div className="h2h-admin">
      <div className="h2h-admin-title">VIIKON DUELI (buukit)</div>
      <div className="h2h-admin-row">
        <select value={a} onChange={e => setA(e.target.value)}>
          <option value="">— pelaaja A —</option>
          {opts.map(p => <option key={p.key} value={p.key}>{p.nick} · {p.city}</option>)}
        </select>
        <span className="h2h-admin-vs">vs</span>
        <select value={b} onChange={e => setB(e.target.value)}>
          <option value="">— pelaaja B —</option>
          {opts.map(p => <option key={p.key} value={p.key}>{p.nick} · {p.city}</option>)}
        </select>
        <button disabled={!a || !b || a === b} onClick={() => onSave(a, b)}>Aseta duelli</button>
        {current && <button className="h2h-admin-clear" onClick={() => onSave(null, null)}>Poista</button>}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Auth (osaprojekti B). Tuotannossa (DB.hasAuth) käytetään Supabase Authia;
  // dev-localissa (ei Supabasea) säilyy yksinkertainen nimi-kirjautuminen.
  const [session, setSession] = useState(null);
  const [linkedPlayer, setLinkedPlayer] = useState(null);
  const [authReady, setAuthReady] = useState(() => !DB.hasAuth); // local: valmis heti

  // Persistent state — pelaajat tulee DB:stä (Supabase tai LS fallback)
  const [playersMap, setPlayersMap] = useState({});
  const [currentKey, setCurrentKey] = useState(() => (DB.hasAuth ? null : loadCurrentKey()));
  const [dbBackend, setDbBackend] = useState('local');

  // UI state
  const [selectedKey, setSelectedKey] = useState(null);
  const [tickerItems, setTickerItems] = useState([]); // (deprecated: korvattu johdetulla tickerFeed:llä; jätetään ettei rikota vanhoja kutsuja)
  const [confettiKey, setConfettiKey] = useState(0);
  const [flashKey, setFlashKey] = useState(null);
  const [floats, setFloats] = useState([]);
  const [today, setToday] = useState(() => currentDayNumber());
  const [phase, setPhase] = useState(() => competitionPhase());
  const [playoff, setPlayoff] = useState(() => EMPTY_PLAYOFF);
  const [playout, setPlayout] = useState(() => EMPTY_PLAYOUT);
  const [excludedKeys, setExcludedKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('buukkauskisa.excluded.v1') || '[]')); }
    catch { return new Set(); }
  });
  const excludedKeysRef = useRef(new Set());
  useEffect(() => { excludedKeysRef.current = excludedKeys; }, [excludedKeys]);
  const [dailyStats, setDailyStats] = useState([]);
  const [deals, setDeals] = useState([]);
  const [goals, setGoals] = useState({}); // { 'YYYY-MM': { metric, target } }
  const [h2h, setH2H] = useState(null); // { a, b }
  const [activeTab, setActiveTab] = useState('leaderboard');
  // Aikajaksot (C)
  const [periodKind, setPeriodKind] = useState('thisMonth');
  const [customStart, setCustomStart] = useState(() => localDateKey(new Date()));
  const [customEnd, setCustomEnd] = useState(() => localDateKey(new Date()));
  const [rankBy, setRankBy] = useState('buukit'); // buukit | megis | eurot | tapaamiset
  const [dealModalOpen, setDealModalOpen] = useState(false); // etusivun kauppamodaali
  const [saveError, setSaveError] = useState(null); // näkyvä virhe kun kirjaus ei tallennu
  const [saveWarning, setSaveWarning] = useState(null); // näkyvä varoitus (kirjaus tallentui, mutta jokin vaatii huomiota)

  // DB init + realtime subscribe
  const playersMapRef = useRef({});
  const playoffRef    = useRef(EMPTY_PLAYOFF);
  const playoutRef    = useRef(EMPTY_PLAYOUT);
  const dailyRef      = useRef([]);
  const dealsRef      = useRef([]);
  const goalsRef      = useRef({});
  const h2hRef        = useRef(null);
  const isAdminRef    = useRef(false); // vakaa admin-tarkistus callbackeille

  function applyDerivedToPlayers(rawMap, rows, dealRows) {
    // Jos daily/deals-haku epäonnistui, EI lasketa johdettuja arvoja vajaista
    // riveistä — silloin näytettäisiin (ja aiemmin myös tallennettiin) liian
    // pienet totaalit. Turvallinen degradaatio: näytä kannan omat luvut.
    const dailyOk = !DB.fetchHealth || DB.fetchHealth.daily !== false;
    const dealsOk = !DB.fetchHealth || DB.fetchHealth.deals !== false;
    if (!dailyOk && !dealsOk) return rawMap;
    // Ryhmittele kerran (oli O(pelaajat × rivit) per päivitys)
    const rowsBy = {}, dealsBy = {};
    if (dailyOk) rows.forEach(r => { (rowsBy[r.player_id] || (rowsBy[r.player_id] = [])).push(r); });
    if (dealsOk) dealRows.forEach(d => { (dealsBy[d.player_id] || (dealsBy[d.player_id] = [])).push(d); });
    const out = {};
    Object.entries(rawMap).forEach(([key, p]) => {
      const myRows  = rowsBy[key]  || [];
      const myDeals = dealsBy[key] || [];
      let np = myRows.length > 0 ? recalcPlayerFromDailyStats(p, myRows) : p;
      if (dealsOk) np = recalcPlayerFromDeals(np, myDeals);
      out[key] = np;
    });
    return out;
  }

  // Auth-alustus (tuotanto): sessio + kuuntelija. Hakee linkitetyn pelaajan.
  useEffect(() => {
    if (!DB.hasAuth) return;
    let unsub;
    (async () => {
      const s = await DB.getSession();
      setSession(s);
      if (s) { const p = await DB.fetchMyPlayer(s.user.id); setLinkedPlayer(p); }
      setAuthReady(true);
      unsub = DB.onAuthChange(async (ns) => {
        setSession(ns);
        if (ns) { const p = await DB.fetchMyPlayer(ns.user.id); setLinkedPlayer(p); }
        else { setLinkedPlayer(null); }
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  // Tuotannossa currentKey seuraa linkitettyä pelaajaa
  useEffect(() => {
    if (DB.hasAuth) setCurrentKey(linkedPlayer ? linkedPlayer.key : null);
  }, [linkedPlayer]);

  // Datalataus + realtime. Tuotannossa vasta kun pelaaja on linkitetty.
  useEffect(() => {
    if (DB.hasAuth && !linkedPlayer) return;
    let unsubP, unsubPO, unsubPout, unsubD, unsubDeals, unsubGoals, unsubH2H;
    (async () => {
      const initial = await DB.init();
      const rawPlayers = initial.players || {};
      const dailyRows  = initial.daily   || [];
      const dealRows   = initial.deals   || [];
      const goalsData  = initial.goals   || {};
      const h2hData    = initial.h2h     || null;
      const po         = migratePlayoff(initial.playoff || EMPTY_PLAYOFF);
      const pout       = initial.playout || EMPTY_PLAYOUT;

      // daily_stats + deals ovat totuuden lähde — aggregaatit lasketaan niistä
      const players = applyDerivedToPlayers(rawPlayers, dailyRows, dealRows);

      dailyRef.current      = dailyRows;
      dealsRef.current      = dealRows;
      goalsRef.current      = goalsData;
      h2hRef.current        = h2hData;
      playersMapRef.current = players;
      playoffRef.current    = po;
      playoutRef.current    = pout;
      setDailyStats(dailyRows);
      setDeals(dealRows);
      setGoals(goalsData);
      setH2H(h2hData);
      setPlayersMap(players);
      setPlayoff(po);
      setPlayout(pout);
      setDbBackend(DB.backend);

      // HUOM: ennen tässä kirjoitettiin KAIKKI pelaajarivit takaisin kantaan
      // jokaisella sivunlatauksella ("persist corrected totals"). Se oli sekä
      // tilastojen katoamisen syy (vajaasta daily-hausta lasketut totaalit
      // tallentuivat pysyvästi) että realtime-myrskyn lähde (N kirjoitusta →
      // N tapahtumaa → jokainen klientti haki koko taulun uudelleen N kertaa).
      // Totaalit lasketaan nyt näyttöä varten lennossa; kanta päivittyy vain
      // pelaajan omista kirjauksista.

      unsubP = DB.subscribe((freshMap) => {
        const recalced = applyDerivedToPlayers(freshMap, dailyRef.current, dealsRef.current);
        playersMapRef.current = recalced;
        setPlayersMap(recalced);
      });
      unsubPO = DB.subscribePlayoff((fresh) => {
        const next = migratePlayoff(fresh || EMPTY_PLAYOFF);
        playoffRef.current = next;
        setPlayoff(next);
      });
      unsubPout = DB.subscribePlayout((fresh) => {
        const next = fresh || EMPTY_PLAYOUT;
        playoutRef.current = next;
        setPlayout(next);
      });
      unsubD = DB.subscribeDaily((rows) => {
        dailyRef.current = rows;
        setDailyStats(rows);
        const recalced = applyDerivedToPlayers(playersMapRef.current, rows, dealsRef.current);
        playersMapRef.current = recalced;
        setPlayersMap(recalced);
      });
      unsubDeals = DB.subscribeDeals((rows) => {
        dealsRef.current = rows;
        setDeals(rows);
        const recalced = applyDerivedToPlayers(playersMapRef.current, dailyRef.current, rows);
        playersMapRef.current = recalced;
        setPlayersMap(recalced);
      });
      unsubGoals = DB.subscribeGoals((g) => {
        const next = g || {};
        goalsRef.current = next;
        setGoals(next);
      });
      unsubH2H = DB.subscribeH2H((x) => {
        h2hRef.current = x || null;
        setH2H(x || null);
      });
    })();
    return () => {
      if (unsubP) unsubP();
      if (unsubPO) unsubPO();
      if (unsubPout) unsubPout();
      if (unsubD) unsubD();
      if (unsubDeals) unsubDeals();
      if (unsubGoals) unsubGoals();
      if (unsubH2H) unsubH2H();
    };
  }, [DB.hasAuth ? !!linkedPlayer : true]);

  // Phase auto-päivitys (joka 5 min)
  useEffect(() => {
    const tick = () => setPhase(competitionPhase());
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Päivän auto-päivitys (joka 5 min)
  useEffect(() => {
    const tick = () => setToday(currentDayNumber());
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Persist currentKey (per-laitteen sessio)
  useEffect(() => { saveCurrentKey(currentKey); }, [currentKey]);

  // theme/accent/density
  useEffect(() => { document.documentElement.setAttribute('data-theme', t.theme); }, [t.theme]);
  useEffect(() => {
    const padMap = { compact: '9px', regular: '14px', comfy: '20px' };
    document.querySelectorAll('.row').forEach(el => {
      el.style.paddingTop = padMap[t.density];
      el.style.paddingBottom = padMap[t.density];
    });
  });
  useEffect(() => { document.documentElement.style.setProperty('--accent', t.accent); }, [t.accent]);

  const sorted = useMemo(() => decoratePlayers(playersMap), [playersMap]);

  // Julkinen lista — ilman adminia ja piilotetut pelaajat
  const sortedPublic = useMemo(() => {
    const filtered = Object.fromEntries(
      Object.entries(playersMap).filter(([k, p]) => k !== ADMIN_KEY && !p.is_admin && !excludedKeys.has(k))
    );
    return decoratePlayers(filtered);
  }, [playersMap, excludedKeys]);

  // Jaksorajattu, valitulla mittarilla järjestetty sarjataulukko (C)
  const periodInfo = useMemo(
    () => periodRange(periodKind, null, customStart, customEnd),
    [periodKind, customStart, customEnd]
  );
  const periodPlayers = useMemo(() => {
    const arr = aggregatePlayersForPeriod(playersMap, dailyStats, deals, periodInfo.startKey, periodInfo.endKey)
      .map(p => ({ ...p, vastausPct: pct(p.vastatut, p.luurit), buukkiPct: pct(p.buukit, p.vastatut) }));
    const metric = rankBy === 'megis' ? 'megisTotal' : rankBy === 'eurot' ? 'eurTotal' : rankBy;
    arr.sort((a, b) => ((b[metric] || 0) - (a[metric] || 0)) || ((b.buukit || 0) - (a.buukit || 0)));
    return arr.map((p, i) => ({ ...p, rank: i + 1 }));
  }, [playersMap, dailyStats, deals, periodInfo, rankBy]);

  // Live-syöte tickeriin: johdetaan jaetusta datasta (realtime), näkyy kaikille, säilyy latausten yli
  const tickerFeed = useMemo(
    () => buildTickerFeed(dailyStats, deals, playersMap, 20),
    [dailyStats, deals, playersMap]
  );

  // Tiimitavoite (D1): kuluvan kuukauden edistyminen
  const monthKey = localDateKey(new Date()).slice(0, 7);
  const monthLabel = new Date().toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' }).toUpperCase();
  const goalProgress = useMemo(() => {
    const g = goals[monthKey];
    if (!g || !g.target) return null;
    const r = periodRange('thisMonth');
    const rows = aggregatePlayersForPeriod(playersMap, dailyStats, deals, r.startKey, r.endKey);
    const field = g.metric === 'megis' ? 'megisTotal' : g.metric === 'eurot' ? 'eurTotal' : 'buukit';
    const teamTotal = rows.reduce((a, p) => a + (p[field] || 0), 0);
    return { ...monthProgress(g.target, teamTotal, new Date()), metric: g.metric };
  }, [goals, monthKey, playersMap, dailyStats, deals]);

  const handleSaveGoal = useCallback((metric, target) => {
    const mk = localDateKey(new Date()).slice(0, 7);
    const next = { ...goalsRef.current, [mk]: { metric, target: Math.max(0, Number(target) || 0) } };
    goalsRef.current = next;
    setGoals(next);
    DB.saveGoals(next);
  }, []);

  // H2H-haaste (D3)
  const h2hStand = useMemo(() => h2hStanding(h2h, dailyStats, playersMap), [h2h, dailyStats, playersMap]);

  // Hall of Fame (D4)
  const hofData = useMemo(() => hallOfFame(dailyStats, deals, playersMap), [dailyStats, deals, playersMap]);
  const handleSaveH2H = useCallback((a, b) => {
    const next = (a && b && a !== b) ? { a, b } : null;
    h2hRef.current = next;
    setH2H(next);
    DB.saveH2H(next);
  }, []);

  const goalCelebratedRef = useRef(false);
  useEffect(() => {
    if (goalProgress && goalProgress.hit && !goalCelebratedRef.current) {
      goalCelebratedRef.current = true;
      setConfettiKey(k => k + 1);
    }
    if (goalProgress && !goalProgress.hit) goalCelebratedRef.current = false;
  }, [goalProgress]);

  // Kierroskohtaiset pisteet — kukin kierros alkaa nollista
  // QF: indeksit 10–11 (8.–9.6), SF: 12–14 (10.–12.6), F: 15–18 (15.–18.6)
  const roundPointsMaps = useMemo(() => {
    const buildMap = (minIdx, maxIdx) => {
      const map = {};
      dailyStats.forEach(r => {
        const idx = dateKeyToWeekdayIndex(r.date_key);
        if (idx >= minIdx && idx <= maxIdx) {
          map[r.player_id] = (map[r.player_id] || 0) + (r.buukit || 0);
        }
      });
      return map;
    };
    return {
      QF: buildMap(10, 11),   // 8.–9.6
      SF: buildMap(12, 14),   // 10.–12.6
      F:  buildMap(15, 18),   // 15.–18.6
    };
  }, [dailyStats]);

  // Koko playoff-kauden pisteet playout-rankingiin
  const playoffPointsMap = useMemo(() => {
    const map = {};
    dailyStats.forEach(r => {
      if (dateKeyToWeekdayIndex(r.date_key) >= 10) {
        map[r.player_id] = (map[r.player_id] || 0) + (r.buukit || 0);
      }
    });
    return map;
  }, [dailyStats]);

  const toggleExcluded = useCallback((key) => {
    setExcludedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem('buukkauskisa.excluded.v1', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Admin: tuotannossa is_admin-lipusta, dev-localissa ADMIN_KEY-sentinel
  const isAdmin = DB.hasAuth
    ? (linkedPlayer ? linkedPlayer.is_admin === true : false)
    : (currentKey === ADMIN_KEY);
  const me = DB.hasAuth
    ? (currentKey ? sorted.find(p => p.key === currentKey) : null)
    : (isAdmin
        ? { key: ADMIN_KEY, nick: ADMIN_NICK, city: 'Tampere', init: 'AD', is_admin: true }
        : (currentKey ? sorted.find(p => p.key === currentKey) : null));
  isAdminRef.current = isAdmin;

  // ── Login / logout / reset ───────────────────
  const handleLogin = useCallback((nick, city) => {
    const cleanNick = nick.toUpperCase().trim();
    const cleanCity = city.trim();
    // Admin: kirjautuu erilliseen tilaan, ei lisätä pelaajalistaan
    if (isAdminCreds(cleanNick, cleanCity)) {
      setCurrentKey(ADMIN_KEY);
      return;
    }
    const key = playerKey(cleanNick, cleanCity);
    const existing = playersMapRef.current[key];
    const now = Date.now();
    const player = existing
      ? { ...existing, key, lastSeen: now }
      : {
          key,
          nick: cleanNick,
          city: cleanCity,
          init: initials(cleanNick),
          ...emptyStats(),
          createdAt: now,
          lastSeen: now,
        };
    const nextMap = { ...playersMapRef.current, [key]: player };
    playersMapRef.current = nextMap;
    setPlayersMap(nextMap);
    DB.upsertPlayer(player);
    setCurrentKey(key);
  }, []);

  const handleLogout = useCallback(() => {
    if (DB.hasAuth) {
      DB.signOut(); // onAuthChange nollaa session + linkedPlayer
    } else {
      setCurrentKey(null);
    }
  }, []);

  const handleResetAll = useCallback(() => {
    if (confirm('Haluatko poistaa KAIKKI pelaajat ja tilastot? (Vaikuttaa kaikkiin laitteisiin jos DB on jaettu)')) {
      playersMapRef.current = {};
      setPlayersMap({});
      setCurrentKey(null);
      setTickerItems([]);
      DB.deleteAllPlayers();
    }
  }, []);

  const handleDeletePlayer = useCallback((key, nickLabel) => {
    if (confirm(`Poistetaanko pelaaja "${nickLabel}" ja kaikki sen tilastot?`)) {
      const next = { ...playersMapRef.current };
      delete next[key];
      playersMapRef.current = next;
      setPlayersMap(next);
      setSelectedKey(null);
      DB.deletePlayer(key);
    }
  }, []);

  // ── Playoff handlers (admin) ───────────────────
  const persistPlayoff = useCallback((next) => {
    playoffRef.current = next;
    setPlayoff(next);
    DB.savePlayoff(next);
  }, []);

  const handleStartPlayoffs = useCallback(() => {
    const top8 = decoratePlayers(playersMapRef.current).slice(0, 8);
    if (top8.length < 8) {
      alert('Tarvitaan 8 pelaajaa. Tällä hetkellä rekisteröityneitä: ' + top8.length);
      return;
    }
    const namesPreview = top8.map((p, i) => `${i + 1}. ${p.nick} (${p.buukit} pts)`).join('\n');
    if (!confirm(`Lukitaanko seedit ja käynnistetään playoffit?\n\n${namesPreview}\n\nTämän jälkeen sarjataulukon pisteet eivät enää muuta bracketia.`)) return;
    const next = startPlayoffs(playoffRef.current, top8);
    persistPlayoff(next);
  }, [persistPlayoff]);

  const handleSetWinner = useCallback((matchId, side) => {
    persistPlayoff(setMatchWinner(playoffRef.current, matchId, side));
  }, [persistPlayoff]);

  const handleClearWinner = useCallback((matchId) => {
    persistPlayoff(clearMatchWinner(playoffRef.current, matchId));
  }, [persistPlayoff]);

  const handleResetPlayoffs = useCallback(() => {
    if (!confirm('Nollataanko playoffit? (Seeds, ottelut ja voittaja häviävät)')) return;
    persistPlayoff(resetPlayoffs());
  }, [persistPlayoff]);

  // ── Playout handlers ───────────────────
  const persistPlayout = useCallback((next) => {
    playoutRef.current = next;
    setPlayout(next);
    DB.savePlayout(next);
  }, []);

  const handleStartPlayout = useCallback(() => {
    // Käytä jäädytettyjä seedejä jos playoff on käynnissä
    const inPlayoffSet = playoffRef.current?.started
      ? new Set(Object.values(playoffRef.current.seeds || {}))
      : null;
    const candidates = decoratePlayers(
      Object.fromEntries(Object.entries(playersMapRef.current).filter(([k, p]) => k !== ADMIN_KEY && !p.is_admin && !excludedKeysRef.current.has(k)))
    );
    const nonPlayoff = inPlayoffSet
      ? candidates.filter(p => !inPlayoffSet.has(p.key))
      : candidates.filter(p => !p.inPlayoff);
    if (nonPlayoff.length === 0) { alert('Ei playout-pelaajia.'); return; }
    if (!confirm(`Käynnistetäänkö playout ${nonPlayoff.length} pelaajalle?\n\n${nonPlayoff.map(p => `${p.nick} (${p.city})`).join('\n')}`)) return;
    persistPlayout(startPlayout(nonPlayoff));
  }, [persistPlayout]);

  const handleSetSakko = useCallback((playerKey) => {
    if (!confirm('Asetetaanko tälle pelaajalle SAKKO?')) return;
    persistPlayout(setSakko(playoutRef.current, playerKey));
  }, [persistPlayout]);

  const handleClearSakko = useCallback(() => {
    if (!confirm('Poistetaanko SAKKO?')) return;
    persistPlayout(clearSakko(playoutRef.current));
  }, [persistPlayout]);

  const handleResetPlayout = useCallback(() => {
    if (!confirm('Nollataanko playout?')) return;
    persistPlayout(resetPlayout());
  }, [persistPlayout]);

  // ── Actions for current user ───────────────────
  const performAction = useCallback((kind, rect) => {
    if (!currentKey || currentKey === ADMIN_KEY || isAdminRef.current) return;
    const minus = kind === '-buukki';
    // Laske uusi tila SYNKRONISESTI (ei setState-updaterin sisällä), jotta
    // sivuvaikutukset (ticker, DB) näkevät oikeat arvot heti.
    const cur = playersMapRef.current[currentKey];
    if (!cur) return;
    const next = { ...cur, lastSeen: Date.now() };
    let resultingNote = null;

    if (kind === 'luuri') {
      next.luurit = cur.luurit + 1;
    } else if (kind === 'vastattu') {
      if (cur.vastatut >= cur.luurit) return;
      next.vastatut = cur.vastatut + 1;
    } else if (kind === 'buukki') {
      if (cur.buukit >= cur.vastatut) return;
      next.buukit = cur.buukit + 1;
      // Tämä päivä on aina last5:n viimeinen slotti (ks. recentDayKeys data.jsx:ssä)
      const newLast5 = [...cur.last5];
      newLast5[4] = (newLast5[4] || 0) + 1;
      next.last5 = newLast5;
      if ((cur.last5[4] || 0) === 0) next.streak = cur.streak + 1; // ensimmäinen buukki tänään jatkaa putkea
      next.trendN = newLast5[4] - (newLast5[3] || 0);
      resultingNote = `BUUKKI #${next.buukit}`;
    } else if (kind === '-buukki') {
      if (cur.buukit <= 0) return;
      next.buukit = cur.buukit - 1;
      const newLast5 = [...cur.last5];
      newLast5[4] = Math.max(0, (newLast5[4] || 0) - 1);
      next.last5 = newLast5;
      if (newLast5[4] === 0 && (cur.last5[4] || 0) === 1) next.streak = Math.max(0, cur.streak - 1);
      next.trendN = newLast5[4] - (newLast5[3] || 0);
      resultingNote = 'BUUKKI PERUTTU';
    } else if (kind === 'tapaaminen') {
      next.tapaamiset = (cur.tapaamiset || 0) + 1;
      resultingNote = `TAPAAMINEN #${next.tapaamiset}`;
    } else {
      return;
    }

    // Kenttä ja MUUTOS (ei absoluuttista arvoa). Palvelin kasvattaa lukua
    // atomisesti, joten vanhentunut paikallinen kopio ei voi enää ylikirjoittaa
    // tuoreempaa lukua — tämä oli kirjausten katoamisen pääsyy.
    const FIELD = { luuri: 'luurit', vastattu: 'vastatut', buukki: 'buukit', '-buukki': 'buukit', tapaaminen: 'tapaamiset' };
    const field = FIELD[kind];
    const delta = kind === '-buukki' ? -1 : 1;
    const dateKey2 = localDateKey(new Date());
    const prevDaily = dailyRef.current || [];

    // Optimistinen päivitys näytölle (palvelimen vastaus korjaa tämän hetkessä)
    playersMapRef.current = { ...playersMapRef.current, [currentKey]: next };
    setPlayersMap((prev) => ({ ...prev, [currentKey]: next }));

    (async () => {
      const res = await DB.bumpDailyStat(field, delta, dateKey2);
      if (res && res.ok === false) {
        // Peru optimistinen päivitys ja kerro käyttäjälle — ei haamulukuja
        playersMapRef.current = { ...playersMapRef.current, [currentKey]: cur };
        setPlayersMap((prev) => ({ ...prev, [currentKey]: cur }));
        setSaveError((res.error && res.error.message) || 'Kirjaus ei tallentunut.');
        return;
      }
      setSaveError(null);
      // Käytä PALVELIMEN palauttamaa riviä totuutena (ei clientin laskelmaa)
      const srv = res && res.row;
      if (srv && srv.date_key) {
        const merged = [
          ...(dailyRef.current || []).filter(r => !(r.player_id === (srv.player_id || currentKey) && r.date_key === srv.date_key)),
          { id: srv.id, player_id: srv.player_id || currentKey, date_key: srv.date_key,
            luurit: srv.luurit || 0, vastatut: srv.vastatut || 0, buukit: srv.buukit || 0, tapaamiset: srv.tapaamiset || 0 },
        ];
        dailyRef.current = merged;
        setDailyStats(merged);
        // Jos palvelimen päivä poikkeaa laitteen päivästä, laitteen kello on väärässä
        if (srv.date_key !== dateKey2) {
          setSaveWarning('Laitteesi päivämäärä on ' + dateKey2 + ', palvelimen ' + srv.date_key +
            '. Kirjaus tallennettiin oikein palvelimen päivälle, mutta korjaa laitteen kellonaika — muuten omat raporttinäkymäsi näyttävät väärää päivää.');
        } else {
          setSaveWarning(null);
        }
      }
    })();
    void prevDaily;

    setFlashKey(currentKey);
    setTimeout(() => setFlashKey(null), 900);

    if (rect) {
      const fId = `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFloats((f) => [...f, { id: fId, x: rect.left + rect.width / 2 - 12, y: rect.top - 4, minus }]);
      setTimeout(() => setFloats((f) => f.filter(x => x.id !== fId)), 1300);
    }

    if (resultingNote) {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setTickerItems((items) => [
        { id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nick: next.nick, time, note: resultingNote, accent: kind === 'buukki' },
        ...items.slice(0, 24),
      ]);
    }
  }, [currentKey]);

  // Tallenna päiväraportti-rivi ja päivitä pelaajan kokonaistilasto
  const handleAddDeal = useCallback(async ({ toimiala, megis, eurot, firstMeetingDate, signedDate, meetingCount }) => {
    if (!currentKey || currentKey === ADMIN_KEY || isAdminRef.current) return { ok: false, error: { message: 'admin ei kirjaa kauppoja' } };
    // Kauppa ankkuroidaan allekirjoituspäivään (oletus: tänään)
    const dateKey = (signedDate && signedDate.trim()) ? signedDate.trim() : localDateKey(new Date());
    // Uniikki id (ei sekvenssiä) → poiston jälkeinen uusi kauppa ei ylikirjoita aiempaa
    const id = newDealId(currentKey, dateKey);
    const deal = {
      id, player_id: currentKey, date_key: dateKey,
      toimiala: (toimiala || '').trim(),
      megis: Math.max(0, Number(megis) || 0),
      eurot: Math.max(0, Number(eurot) || 0),
      first_meeting_date: (firstMeetingDate && firstMeetingDate.trim()) ? firstMeetingDate.trim() : null,
      signed_date: dateKey,
      meeting_count: Math.max(0, Math.floor(Number(meetingCount) || 0)),
      created_at: new Date().toISOString(),
    };
    // Tallenna ensin DB:hen; jos se epäonnistuu, ÄLÄ näytä kauppaa optimistisesti
    // (aiemmin virhe niellattiin ja realtime-haku pyyhki kaupan → "katosi").
    let res;
    try {
      res = await DB.upsertDeal(deal);
    } catch (e) {
      return { ok: false, error: { message: (e && e.message) || 'Tallennus epäonnistui.' } };
    }
    if (res && res.ok === false) return { ok: false, error: res.error };
    const nextDeals = [...dealsRef.current.filter(d => d.id !== id), deal];
    dealsRef.current = nextDeals;
    setDeals(nextDeals);
    const base = playersMapRef.current[currentKey];
    if (base) {
      const recalced = recalcPlayerFromDeals(base, nextDeals.filter(d => d.player_id === currentKey));
      playersMapRef.current = { ...playersMapRef.current, [currentKey]: recalced };
      setPlayersMap(prev => ({ ...prev, [currentKey]: recalced }));
    }
    return { ok: true };
  }, [currentKey]);

  const handleDeleteDeal = useCallback(async (id) => {
    if (!currentKey || currentKey === ADMIN_KEY || isAdminRef.current) return;
    await DB.deleteDeal(id);
    const nextDeals = dealsRef.current.filter(d => d.id !== id);
    dealsRef.current = nextDeals;
    setDeals(nextDeals);
    const base = playersMapRef.current[currentKey];
    if (base) {
      const recalced = recalcPlayerFromDeals(base, nextDeals.filter(d => d.player_id === currentKey));
      playersMapRef.current = { ...playersMapRef.current, [currentKey]: recalced };
      setPlayersMap(prev => ({ ...prev, [currentKey]: recalced }));
    }
  }, [currentKey]);

  const handleSaveDay = useCallback(async (dateKey, stats) => {
    if (!currentKey || currentKey === ADMIN_KEY || isAdminRef.current) return;
    const saveRes = await DB.setDailyStatsRemote(dateKey, stats);
    if (saveRes && saveRes.ok === false) {
      setSaveError((saveRes.error && saveRes.error.message) || 'Päivän tallennus epäonnistui.');
      return;
    }
    setSaveError(null);
    const updatedDaily = [
      ...dailyStats.filter(r => !(r.player_id === currentKey && r.date_key === dateKey)),
      { id: currentKey+'_'+dateKey, player_id: currentKey, date_key: dateKey, ...stats },
    ];
    setDailyStats(updatedDaily);
    const myRows = updatedDaily.filter(r => r.player_id === currentKey);
    const base = playersMap[currentKey];
    if (!base) return;
    const recalced = recalcPlayerFromDailyStats(base, myRows);
    setPlayersMap(prev => ({ ...prev, [currentKey]: recalced }));
    DB.upsertPlayer(recalced);
    // Add ticker entries for saved buukkeja
    if (stats.buukit > 0) {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      setTickerItems(items => [
        { id: `tx-${Date.now()}`, nick: base.nick, time, note: `BUUKKI × ${stats.buukit} (PÄIVÄRAPORTTI)`, accent: true },
        ...items.slice(0, 24),
      ]);
    }
  }, [currentKey, dailyStats, playersMap]);

  // ── Yhteysvahti ─────────────────────────
  // Konfiguroitu Supabaseen mutta yhteyttä ei ole → estä kirjaaminen kokonaan.
  if (DB.offlineMisconfig) {
    return <ConnectionErrorScreen />;
  }

  // ── Auth gate ───────────────────────────
  if (DB.hasAuth) {
    if (!authReady) {
      return <div className="auth-loading">Ladataan…</div>;
    }
    const gate = resolveAuthGate(session, linkedPlayer);
    if (gate === 'auth' || gate === 'link') {
      return (
        <AuthScreen
          linkStep={gate === 'link'}
          onSignedIn={setSession}
          onLinked={setLinkedPlayer}
        />
      );
    }
    // gate === 'app' → data vielä latautumassa jos me puuttuu
    if (!me) {
      return <div className="auth-loading">Ladataan tietoja…</div>;
    }
  } else {
    // dev-local: yksinkertainen nimi-kirjautuminen (ei turvattu, vain kehitys)
    if (!me) {
      return <LoginScreen onLogin={handleLogin} existingPlayers={playersMap} />;
    }
  }

  const selected = selectedKey ? sorted.find(p => p.key === selectedKey) : null;
  const isMeSelected = selected && selected.key === currentKey;
  const champion = playoff?.championKey ? playersMap[playoff.championKey] : null;

  // Badget & tier valitulle pelaajalle (D2)
  const monthChampKey = (() => {
    const r = periodRange('thisMonth');
    const rows = aggregatePlayersForPeriod(playersMap, dailyStats, deals, r.startKey, r.endKey);
    if (!rows.length) return null;
    return rows.slice().sort((a, b) => (b.buukit || 0) - (a.buukit || 0))[0].key;
  })();
  const selectedTotalBuukit = selected ? dailyStats.filter(rr => rr.player_id === selected.key).reduce((a, rr) => a + (rr.buukit || 0), 0) : 0;
  const selectedTier = selected ? playerTier(selectedTotalBuukit) : null;
  const selectedBadges = selected ? computeBadges(selected.key, dailyStats, deals, { isMonthChampion: selected.key === monthChampKey }) : [];

  if (isAdmin) {
    return (
      <div className="app">
        <Header me={me} onLogout={handleLogout} playerCount={sorted.length} isAdmin today={today} dbBackend={dbBackend} />
        <SaveErrorBanner message={saveError} onDismiss={() => setSaveError(null)} />
        <SaveWarningBanner message={saveWarning} onDismiss={() => setSaveWarning(null)} />
        {t.showTicker && <Ticker items={tickerFeed} paused={!t.pulse} />}
        <TabNav active={activeTab} onChange={setActiveTab} isAdmin />
        {activeTab === 'report' || activeTab === 'teamreport' ? (
          <DailyReport currentKey={currentKey} isAdmin dailyStats={dailyStats} players={sorted.filter(p => p.key !== ADMIN_KEY)} onSaveDay={handleSaveDay} deals={deals} onAddDeal={handleAddDeal} onDeleteDeal={handleDeleteDeal} />
        ) : activeTab === 'hof' ? (
          <HallOfFame data={hofData} champion={champion ? champion.nick : null} />
        ) : activeTab === 'archive' ? (
          <div className="main">
            <div>
              <PhaseBanner phase={phase} today={today} totalDays={COMPETITION.totalDays} playoff={playoff} champion={champion} />
              {t.showBracket && (
                <Bracket
                  sorted={sortedPublic} playersMap={playersMap} playoff={playoff}
                  playoffPointsMap={playoffPointsMap} roundPointsMaps={roundPointsMaps} isAdmin={true}
                  onSelect={(p) => setSelectedKey(p.key)} onWin={handleSetWinner} onUndo={handleClearWinner}
                  onStart={handleStartPlayoffs} onReset={handleResetPlayoffs}
                />
              )}
            </div>
            <div className="side">
              <PlayoutPanel
                playout={playout} sorted={sortedPublic} playersMap={playersMap} playoff={playoff}
                playoffPointsMap={playoffPointsMap} isAdmin={true}
                onStart={handleStartPlayout} onSetSakko={handleSetSakko} onClearSakko={handleClearSakko} onReset={handleResetPlayout}
              />
              <PrizeBanner />
            </div>
          </div>
        ) : (
        <div className="main">
          <div>
            <AdminPanel players={sorted} onDelete={handleDeletePlayer} onResetAll={handleResetAll} />
            <GoalAdmin current={goals[monthKey]} label={monthLabel} onSave={handleSaveGoal} />
            <H2HAdmin players={sorted} current={h2h} onSave={handleSaveH2H} />
            <GoalBar progress={goalProgress} label={monthLabel} />
            <PeriodBar periodKind={periodKind} onKind={setPeriodKind} customStart={customStart} customEnd={customEnd} onCustomStart={setCustomStart} onCustomEnd={setCustomEnd} label={periodInfo.label} />
            <RankTabs rankBy={rankBy} onRankBy={setRankBy} />
            <DashboardTable rows={periodPlayers} rankBy={rankBy} onSelect={(p) => setSelectedKey(p.key)} meKey={null} />
          </div>
          <div className="side">
            <H2HCard stand={h2hStand} />
            {t.showPodium && <Podium sorted={periodPlayers} onSelect={(p) => setSelectedKey(p.key)} />}
          </div>
        </div>
        )}
        <div className="footer-stripe">
          <div>MYYNNIN DASHBOARD · {sorted.length}&nbsp;PELAAJAA · ADMIN-NÄKYMÄ · v{DB.version}</div>
          <div>POISTA PELAAJA → ROSKAKORI-IKONI &nbsp;|&nbsp; ADMIN EI NÄY TILASTOISSA</div>
        </div>
        <PlayerModal
          player={selected}
          isMe={false}
          isAdmin
          onClose={() => setSelectedKey(null)}
          onAction={performAction}
          onDelete={handleDeletePlayer}
          tier={selectedTier}
          badges={selectedBadges}
        />
        <TweaksUI t={t} setTweak={setTweak} onResetAll={handleResetAll} isAdmin />
      </div>
    );
  }

  return (
    <div className="app">
      <Header me={me} onLogout={handleLogout} playerCount={sortedPublic.length} today={today} dbBackend={dbBackend} />
      <SaveErrorBanner message={saveError} onDismiss={() => setSaveError(null)} />
      <SaveWarningBanner message={saveWarning} onDismiss={() => setSaveWarning(null)} />
      {t.showTicker && <Ticker items={tickerFeed} paused={!t.pulse} />}
      <TabNav active={activeTab} onChange={setActiveTab} isAdmin={false} />
      {activeTab === 'teamreport' ? (
        <DailyReport currentKey={currentKey} isAdmin dailyStats={dailyStats} players={sortedPublic} onSaveDay={handleSaveDay} deals={deals} onAddDeal={handleAddDeal} onDeleteDeal={handleDeleteDeal} />
      ) : activeTab === 'report' ? (
        <DailyReport currentKey={currentKey} isAdmin={false} dailyStats={dailyStats} players={sorted} onSaveDay={handleSaveDay} deals={deals} onAddDeal={handleAddDeal} onDeleteDeal={handleDeleteDeal} />
      ) : activeTab === 'hof' ? (
        <HallOfFame data={hofData} champion={champion ? champion.nick : null} />
      ) : activeTab === 'archive' ? (
        <div className="main">
          <div>
            <PhaseBanner phase={phase} today={today} totalDays={COMPETITION.totalDays} playoff={playoff} champion={champion} />
            {t.showBracket && (
              <Bracket
                sorted={sortedPublic} playersMap={playersMap} playoff={playoff}
                playoffPointsMap={playoffPointsMap} roundPointsMaps={roundPointsMaps} isAdmin={false}
                onSelect={(p) => setSelectedKey(p.key)}
              />
            )}
          </div>
          <div className="side">
            {playout?.started && (
              <PlayoutPanel
                playout={playout} sorted={sortedPublic} playersMap={playersMap} playoff={playoff}
                playoffPointsMap={playoffPointsMap} isAdmin={false}
              />
            )}
            <PrizeBanner />
          </div>
        </div>
      ) : (
      <div className="main">
        <div>
          <MyCard me={me} onAction={performAction} />
          <GoalBar progress={goalProgress} label={monthLabel} />
          <div className="lb-toolbar">
            <PeriodBar periodKind={periodKind} onKind={setPeriodKind} customStart={customStart} customEnd={customEnd} onCustomStart={setCustomStart} onCustomEnd={setCustomEnd} label={periodInfo.label} />
            <button className="add-deal-cta" onClick={() => setDealModalOpen(true)}>➕ Lisää kauppa</button>
          </div>
          <RankTabs rankBy={rankBy} onRankBy={setRankBy} />
          <DashboardTable rows={periodPlayers} rankBy={rankBy} onSelect={(p) => setSelectedKey(p.key)} meKey={currentKey} />
        </div>
        <div className="side">
          <H2HCard stand={h2hStand} />
          {t.showPodium && <Podium sorted={periodPlayers} onSelect={(p) => setSelectedKey(p.key)} />}
        </div>
      </div>
      )}
      <div className="footer-stripe">
        <div>MYYNNIN DASHBOARD · {sortedPublic.length}&nbsp;PELAAJAA · v{DB.version}</div>
        <div>KLIKKAA RIVIÄ → PELAAJAPROFIILI &nbsp;|&nbsp; TIER, BADGET & ENNÄTYKSET</div>
      </div>
      <PlayerModal
        player={selected}
        isMe={isMeSelected}
        onClose={() => setSelectedKey(null)}
        onAction={performAction}
        tier={selectedTier}
        badges={selectedBadges}
      />
      {dealModalOpen && <DealModal onAdd={handleAddDeal} onClose={() => setDealModalOpen(false)} />}
      <FloatPlus instances={floats} />
      <Confetti trigger={confettiKey} />
      <TweaksUI t={t} setTweak={setTweak} onResetAll={handleResetAll} isAdmin={false} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
