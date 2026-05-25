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
        <div className="pw-sub">Kausi 26 · Vol. I</div>
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
          <div className="login-logo">
            <image-slot id="login-logo" shape="rect" radius="0" placeholder="Logoslot"></image-slot>
          </div>

          <div className="login-tag">
            <span className="bolt">⚡</span> MYYJÄTERMINAALI
            <span className="dot-live" /> ONLINE
          </div>

          <h1 className="login-headline">
            Buukkaus<span className="accent">kisa</span>
            <span className="sub">Kausi 26 · Vol. I</span>
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
              <div className="kpi-sub">8.6 → 11.6</div>
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
  const total = COMPETITION.totalDays;
  return (
    <header className="hdr">
      <div className="hdr-logo">
        <image-slot id="logo-main" shape="rect" radius="0" placeholder="Logoslot"></image-slot>
      </div>
      <div className="hdr-title">
        <div className="display competition">
          BUUKKAUS<span className="accent">KISA</span>
        </div>
        <div className="edition">— Kausi&nbsp;26 · Vol&nbsp;I · {playerCount}&nbsp;pelaajaa</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="hdr-meta">
          <div>
            <div className="label">Kausi</div>
            <div className="date">
              25.5<span className="sep">→</span>5.6
              <span className="sub">10 arkipäivää · ei viikonloppuja</span>
            </div>
            <div className="progress">
              {Array.from({ length: total }).map((_, i) => {
                const n = i + 1;
                const klass = n < today ? 'done' : n === today ? 'today' : '';
                return <div key={i} className={cls('day-pip', klass)} />;
              })}
            </div>
          </div>
          <div>
            <div className="label">Päivä</div>
            <div className="day-info">
              {String(today).padStart(2, '0')}<span className="total"> / {total}</span>
            </div>
          </div>
        </div>
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
  const loop = useMemo(() => [...items, ...items, ...items], [items]);
  return (
    <div className="ticker">
      <div className="ticker-tag"><span className="dot" />LIVE</div>
      <div className="ticker-track">
        {items.length === 0 ? (
          <div style={{ color: 'rgba(245,243,238,.55)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em' }}>
            Ei vielä toimintaa — kirjaa ensimmäinen buukki kortistasi
          </div>
        ) : (
          <div className={cls('ticker-content', paused && 'paused')}>
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
  return (
    <div className="my-card">
      <div className="mc-top">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div className="mc-tag">● SINÄ</div>
          <div className="mc-avatar">{me.init}</div>
          <div className="mc-id">
            <div className="nick">{me.nick}</div>
            <div className="city">{me.city.toUpperCase()} · KAUSI 26</div>
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
          <div className="lbl">Luurit</div>
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
      </div>
      <div className="mc-actions">
        <button className="btn" onClick={(e) => onAction('luuri', e.currentTarget.getBoundingClientRect())}>
          <span className="ico">+</span> LUURIN NOSTO
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

function Row({ p, onClick, flash, isMe, hasEnoughForPlayoff, isAdmin, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete && onDelete(p.key, p.nick);
  };
  return (
    <div
      className={cls(
        'row',
        `rank-${p.rank}`,
        hasEnoughForPlayoff && p.inPlayoff && 'in-playoff',
        flash && 'just-incremented',
        isMe && 'is-me'
      )}
      onClick={() => onClick(p)}
    >
      <div className="rank">{String(p.rank).padStart(2, '0')}</div>
      <div className="player">
        <div className="avatar">{p.init}</div>
        <div className="name-block">
          <div className="nick">{p.nick}</div>
          <div className="city">{p.city.toUpperCase()}</div>
        </div>
      </div>
      <div className="stat-cell col-luurit">
        <div className="v">{p.luurit}</div>
        <div className="pct">LUURIT</div>
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
        <button className="row-del" onClick={handleDelete} title={`Poista ${p.nick}`}>×</button>
      )}
    </div>
  );
}

// ── Table ───────────────────────────

function Table({ sorted, onSelect, flashKey, meKey, isAdmin, onDelete }) {
  const hasEnough = sorted.length >= 9;
  const isEmpty = sorted.length === 0;
  return (
    <div className="table-card">
      <div className="table-head">
        <div className="num">SIJA</div>
        <div>PELAAJA</div>
        <div className="num">LUURIT</div>
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
        />
      ))}
      {hasEnough && (
        <div className="playoff-divider">
          <div className="left">
            <div className="accent-bar" />
            PLAYOFF-RAJA
            <span style={{ opacity: .55, fontWeight: 500 }}>Top 8 jatkoon · 8.6 — 11.6</span>
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
  isAdmin, started,
  onWin, onUndo, onSelect,
  highlight,
}) {
  const home = match.homeKey ? playersMap[match.homeKey] : null;
  const away = match.awayKey ? playersMap[match.awayKey] : null;
  const seedH = match.seedH ?? null;
  const seedA = match.seedA ?? null;
  const decided = !!match.winnerKey;
  const ready = started && !decided && match.homeKey && match.awayKey;
  const pending = started && !decided && (!match.homeKey || !match.awayKey);
  const status = decided ? 'done' : ready ? 'live' : pending ? 'pending' : 'preview';

  const SideRow = ({ side, player, seed, isWinner, isLoser }) => {
    const placeholder = side === 'home' ? `${matchId} kotijoukkue` : `${matchId} vierasjoukkue`;
    const clickable = !!player && onSelect;
    return (
      <div
        className={cls('m-side', isWinner && 'winner', isLoser && 'loser')}
        onClick={() => clickable && onSelect(player)}
        style={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        {seed != null && <span className="m-seed">S{seed}</span>}
        <span className="m-nick">
          {player ? player.nick : (started ? '—' : placeholder)}
        </span>
        <span className="m-ico">{isWinner ? '✓' : ''}</span>
        {isAdmin && ready && player && (
          <button
            className="m-pick"
            onClick={(e) => { e.stopPropagation(); onWin(matchId, side); }}
            title={`Aseta voittajaksi: ${player.nick}`}
          >
            VOITTAJA
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={cls('m-card', `m-${status}`, highlight && 'm-final', decided && 'm-decided')}>
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

function Bracket({ sorted, playersMap, playoff, isAdmin, onSelect, onWin, onUndo, onStart, onReset }) {
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
              playersMap={playersMap}
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
            playersMap={playersMap}
            isAdmin={isAdmin} started={started}
            onWin={onWin} onUndo={onUndo} onSelect={onSelect}
          />
          <MatchCard
            matchId="SF2" label="VE 2"
            match={matches.SF2}
            playersMap={playersMap}
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
            playersMap={playersMap}
            isAdmin={isAdmin} started={started}
            onWin={onWin} onUndo={onUndo} onSelect={onSelect}
            highlight
          />
          <div className="bracket-final-meta">MA 15.6 · MESTARUUS</div>
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
    lock:     { label: 'RUNKOSARJA OHI', color: 'amber', sub: 'Seedit lukittavissa · playoff alkaa MA 8.6 · finaali MA 15.6' },
    playoffs: { label: 'PLAYOFFIT KÄYNNISSÄ', color: 'live', sub: 'Pudotuspeli · QF 8.6–11.6 · VE 12.6–13.6 · F 14.6–15.6' },
    finished: { label: 'KISA PÄÄTTYI', color: 'gold', sub: champion ? `Mestari · ${champion.nick}` : 'Loppu — 15.6.2026' },
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
        <span className="pb-end-val">15.6.2026</span>
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
          <div className="lbl">Luurit (yht.)</div>
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

function PlayerModal({ player, onClose, onAction, isMe, isAdmin, onDelete }) {
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
              {' · '}KAUSI 26
            </div>
          </div>
          <div className="rank-badge">
            <div className="label">Sija</div>
            <div className="rank">{String(player.rank).padStart(2, '0')}</div>
          </div>
        </div>
        <div className="m-stats">
          <div className="cell">
            <div className="label">Luurit</div>
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
        {isMe ? (
          <div className="m-foot">
            <button className="alt" onClick={onClose}>SULJE</button>
            <button onClick={() => { onAction('luuri'); onClose(); }}>+ LUURI</button>
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

function DailyReport({ currentKey, isAdmin, dailyStats, players, onSaveDay }) {
  const days = COMPETITION.weekdays;
  const todayIdx = Math.max(0, currentWeekdayIndex() >= 0 ? currentWeekdayIndex() : 0);
  const [selIdx, setSelIdx] = useState(todayIdx);
  const [form, setForm] = useState({ luurit: 0, vastatut: 0, buukit: 0 });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const dateKey = weekdayIndexToDateKey(selIdx);

  // Admin: group daily_stats by date, then by player
  const allPlayers = players;

  // Load form when day changes (player view)
  useEffect(() => {
    if (isAdmin) return;
    const row = dailyStats.find(r => r.player_id === currentKey && r.date_key === dateKey);
    setForm(row ? { luurit: row.luurit||0, vastatut: row.vastatut||0, buukit: row.buukit||0 } : { luurit:0, vastatut:0, buukit:0 });
  }, [selIdx, dailyStats, currentKey, dateKey, isAdmin]);

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

      {/* Day selector */}
      <div className="dr-days">
        {days.map((d, i) => (
          <button
            key={i}
            className={cls('dr-day-btn', i === selIdx && 'active', i === todayIdx && 'today-mark')}
            onClick={() => setSelIdx(i)}
          >
            <span className="wd">{d.wd}</span>
            <span className="dt">{d.date}</span>
          </button>
        ))}
      </div>

      {isAdmin ? (
        /* Admin table */
        <div className="dr-admin-table-wrap">
          <table className="dr-admin-table">
            <thead>
              <tr>
                <th>PELAAJA</th>
                {days.map((d,i) => <th key={i} className={i===selIdx?'sel-col':''}>{d.wd}<br/><span style={{fontSize:10,fontWeight:400}}>{d.date}</span></th>)}
                <th>YHT.</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers.map(p => {
                const myRows = dailyStats.filter(r => r.player_id === p.key);
                const total = myRows.reduce((acc,r) => acc+r.buukit,0);
                return (
                  <tr key={p.key}>
                    <td className="player-cell">
                      <span className="init-badge" style={{background:'var(--red)',color:'#fff',padding:'1px 5px',fontSize:11,fontWeight:700,borderRadius:2,marginRight:5}}>{p.init}</span>
                      {p.nick}<span style={{color:'var(--ink-3)',fontSize:11,marginLeft:4}}>{p.city}</span>
                    </td>
                    {days.map((d,i) => {
                      const dk = weekdayIndexToDateKey(i);
                      const row = myRows.find(r => r.date_key === dk);
                      const b = row ? row.buukit : 0;
                      const l = row ? row.luurit : 0;
                      const v = row ? row.vastatut : 0;
                      return (
                        <td key={i} className={cls('stat-cell', i===selIdx&&'sel-col', b>0&&'has-data')}>
                          {l>0||v>0||b>0 ? (
                            <div className="day-cell-data">
                              <div className="day-luuri">L:{l}</div>
                              <div className="day-vast">V:{v}</div>
                              <div className="day-book">{b}bk</div>
                            </div>
                          ) : <span style={{color:'var(--ink-4)'}}>—</span>}
                        </td>
                      );
                    })}
                    <td className="total-cell">{total}</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="totals-row">
                <td>YHTEENSÄ</td>
                {days.map((d,i) => {
                  const dk = weekdayIndexToDateKey(i);
                  const total = dailyStats.filter(r=>r.date_key===dk).reduce((acc,r)=>acc+r.buukit,0);
                  return <td key={i} className={cls(i===selIdx&&'sel-col')}>{total>0?total:'—'}</td>;
                })}
                <td>{dailyStats.reduce((acc,r)=>acc+r.buukit,0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        /* Player entry form */
        <div className="dr-form">
          <div className="dr-form-title">
            {days[selIdx]?.wd} {days[selIdx]?.date} — SYÖTÄ TILASTOT
          </div>
          {[
            { key: 'luurit',   label: 'LUURIN NOSTOT',  max: null },
            { key: 'vastatut', label: 'VASTATUT PUHELUT', max: form.luurit },
            { key: 'buukit',   label: 'BUUKIT',          max: form.vastatut },
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

      {/* Own summary table for non-admin */}
      {!isAdmin && (
        <div className="dr-summary">
          <div className="dr-sum-title">OMA YHTEENVETO</div>
          <table className="dr-sum-table">
            <thead><tr><th>Päivä</th><th>Luurit</th><th>Vastatut</th><th>Buukit</th><th>Vast%</th><th>Buuk%</th></tr></thead>
            <tbody>
              {days.map((d, i) => {
                const dk = weekdayIndexToDateKey(i);
                const row = dailyStats.find(r => r.player_id === currentKey && r.date_key === dk);
                if (!row && i > todayIdx) return null;
                const l = row?.luurit||0, v = row?.vastatut||0, b = row?.buukit||0;
                return (
                  <tr key={i} className={cls(i===selIdx&&'sel-row', i===todayIdx&&'today-row')}>
                    <td>{d.wd} {d.date}</td>
                    <td>{l||'—'}</td>
                    <td>{v||'—'}</td>
                    <td style={{fontWeight:b>0?700:400,color:b>0?'var(--red)':'inherit'}}>{b||'—'}</td>
                    <td>{l>0?Math.round(v/l*100)+'%':'—'}</td>
                    <td>{v>0?Math.round(b/v*100)+'%':'—'}</td>
                  </tr>
                );
              }).filter(Boolean)}
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

function TabNav({ active, onChange }) {
  return (
    <div className="tab-nav">
      <button className={cls('tab-btn', active === 'leaderboard' && 'active')} onClick={() => onChange('leaderboard')}>
        ⚡ SARJATAULUKKO
      </button>
      <button className={cls('tab-btn', active === 'report' && 'active')} onClick={() => onChange('report')}>
        📊 PÄIVÄRAPORTTI
      </button>
    </div>
  );
}

// ── App ───────────────────────────

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('buukkikisa.pw') === '1');

  // Persistent state — pelaajat tulee DB:stä (Supabase tai LS fallback)
  const [playersMap, setPlayersMap] = useState({});
  const [currentKey, setCurrentKey] = useState(() => loadCurrentKey());
  const [dbBackend, setDbBackend] = useState('local');

  // UI state
  const [selectedKey, setSelectedKey] = useState(null);
  const [tickerItems, setTickerItems] = useState([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [flashKey, setFlashKey] = useState(null);
  const [floats, setFloats] = useState([]);
  const [today, setToday] = useState(() => currentDayNumber());
  const [phase, setPhase] = useState(() => competitionPhase());
  const [playoff, setPlayoff] = useState(() => EMPTY_PLAYOFF);
  const [dailyStats, setDailyStats] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');

  // DB init + realtime subscribe
  const playersMapRef = useRef({});
  const playoffRef = useRef(EMPTY_PLAYOFF);
  useEffect(() => {
    let unsubP, unsubPO, unsubD;
    (async () => {
      const initial = await DB.init();
      const players = initial.players || {};
      const po = initial.playoff || EMPTY_PLAYOFF;
      setDailyStats(initial.daily || []);
      playersMapRef.current = players;
      playoffRef.current = po;
      setPlayersMap(players);
      setPlayoff(po);
      setDbBackend(DB.backend);
      unsubP = DB.subscribe((freshMap) => {
        playersMapRef.current = freshMap;
        setPlayersMap(freshMap);
      });
      unsubPO = DB.subscribePlayoff((fresh) => {
        const next = fresh || EMPTY_PLAYOFF;
        playoffRef.current = next;
        setPlayoff(next);
      });
      unsubD = DB.subscribeDaily((rows) => setDailyStats(rows));
    })();
    return () => { if (unsubP) unsubP(); if (unsubPO) unsubPO(); if (unsubD) unsubD(); };
  }, []);

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
  const isAdmin = currentKey === ADMIN_KEY;
  const me = isAdmin
    ? { key: ADMIN_KEY, nick: ADMIN_NICK, city: 'Tampere', init: 'AD', isAdmin: true }
    : (currentKey ? sorted.find(p => p.key === currentKey) : null);

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
    sessionStorage.removeItem('buukkikisa.pw');
    setUnlocked(false);
    setCurrentKey(null);
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

  // ── Actions for current user ───────────────────
  const performAction = useCallback((kind, rect) => {
    if (!currentKey || currentKey === ADMIN_KEY) return;
    let minus = kind === '-buukki';
    let resultingNote = null;
    let didCrossPlayoff = false;
    let updatedPlayer = null;

    setPlayersMap((prev) => {
      const cur = prev[currentKey];
      if (!cur) return prev;
      const next = { ...cur, lastSeen: Date.now() };

      if (kind === 'luuri') {
        next.luurit = cur.luurit + 1;
      } else if (kind === 'vastattu') {
        if (cur.vastatut >= cur.luurit) return prev;
        next.vastatut = cur.vastatut + 1;
      } else if (kind === 'buukki') {
        if (cur.buukit >= cur.vastatut) return prev;
        next.buukit = cur.buukit + 1;
        const slot = Math.max(0, Math.min(4, currentWeekdayIndex() % 5));
        const newLast5 = [...cur.last5];
        newLast5[slot] = (newLast5[slot] || 0) + 1;
        next.last5 = newLast5;
        if ((cur.last5[slot] || 0) === 0) next.streak = cur.streak + 1;
        next.trendN = Math.max(cur.trendN, 0) + 1;
        resultingNote = `BUUKKI #${next.buukit}`;
      } else if (kind === '-buukki') {
        if (cur.buukit <= 0) return prev;
        next.buukit = cur.buukit - 1;
        const slot = Math.max(0, Math.min(4, currentWeekdayIndex() % 5));
        const newLast5 = [...cur.last5];
        newLast5[slot] = Math.max(0, (newLast5[slot] || 0) - 1);
        next.last5 = newLast5;
        if (newLast5[slot] === 0 && (cur.last5[slot] || 0) === 1) {
          next.streak = Math.max(0, cur.streak - 1);
        }
        next.trendN = Math.min(cur.trendN, 0) - 1;
        resultingNote = 'BUUKKI PERUTTU';
      }

      // Detect playoff crossing
      const allArr = Object.values(prev);
      const newAllArr = allArr.filter(p => p !== cur).concat([next]);
      const before = [...allArr].sort((a,b) => b.buukit - a.buukit);
      const after  = [...newAllArr].sort((a,b) => b.buukit - a.buukit);
      const beforeRank = before.findIndex(p => p === cur) + 1 || before.findIndex(p => p.nick === cur.nick && p.city === cur.city) + 1;
      const afterRank  = after.findIndex(p => p === next) + 1;
      if (allArr.length >= 9 && beforeRank > 8 && afterRank <= 8 && kind === 'buukki') {
        didCrossPlayoff = true;
      }

      updatedPlayer = next;
      return { ...prev, [currentKey]: next };
    });

    // Sync to DB (fire-and-forget)
    if (updatedPlayer) DB.upsertPlayer(updatedPlayer);

    // Also update daily_stats for today (fire-and-forget)
    const dayIdx2 = currentWeekdayIndex();
    const dateKey2 = weekdayIndexToDateKey(dayIdx2);
    if (dateKey2 && dayIdx2 >= 0 && (kind === 'luuri' || kind === 'vastattu' || kind === 'buukki' || kind === '-buukki')) {
      setDailyStats(prev => {
        const existing = prev.find(r => r.player_id === currentKey && r.date_key === dateKey2);
        const ds = existing
          ? { luurit: existing.luurit, vastatut: existing.vastatut, buukit: existing.buukit }
          : { luurit: 0, vastatut: 0, buukit: 0 };
        if (kind === 'luuri')     ds.luurit++;
        else if (kind === 'vastattu') ds.vastatut++;
        else if (kind === 'buukki')   ds.buukit++;
        else if (kind === '-buukki')  ds.buukit = Math.max(0, ds.buukit - 1);
        const updated = { id: currentKey+'_'+dateKey2, player_id: currentKey, date_key: dateKey2, ...ds };
        DB.upsertDailyStats(currentKey, dateKey2, ds);
        return [...prev.filter(r => !(r.player_id === currentKey && r.date_key === dateKey2)), updated];
      });
    }

    setFlashKey(currentKey);
    setTimeout(() => setFlashKey(null), 900);

    if (rect) {
      const fId = `f-${Date.now()}`;
      setFloats((f) => [...f, { id: fId, x: rect.left + rect.width / 2 - 12, y: rect.top - 4, minus }]);
      setTimeout(() => setFloats((f) => f.filter(x => x.id !== fId)), 1300);
    }

    if (resultingNote) {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const meNow = playersMap[currentKey];
      const nick = meNow ? meNow.nick : 'PELAAJA';
      setTickerItems((items) => [
        { id: `tx-${Date.now()}`, nick, time, note: resultingNote, accent: kind === 'buukki' },
        ...items.slice(0, 24),
      ]);
    }

    if (didCrossPlayoff && t.confetti) {
      setConfettiKey((k) => k + 1);
    }
  }, [currentKey, playersMap, t.confetti]);

  // Tallenna päiväraportti-rivi ja päivitä pelaajan kokonaistilasto
  const handleSaveDay = useCallback(async (dateKey, stats) => {
    if (!currentKey || currentKey === ADMIN_KEY) return;
    await DB.upsertDailyStats(currentKey, dateKey, stats);
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
  }, [currentKey, dailyStats, playersMap]);

  // Password gate
  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  // Login gate
  if (!me) {
    return <LoginScreen onLogin={handleLogin} existingPlayers={playersMap} />;
  }

  const selected = selectedKey ? sorted.find(p => p.key === selectedKey) : null;
  const isMeSelected = selected && selected.key === currentKey;
  const champion = playoff?.championKey ? playersMap[playoff.championKey] : null;

  if (isAdmin) {
    return (
      <div className="app">
        <Header me={me} onLogout={handleLogout} playerCount={sorted.length} isAdmin today={today} dbBackend={dbBackend} />
        {t.showTicker && <Ticker items={tickerItems} paused={!t.pulse} />}
        <PhaseBanner phase={phase} today={today} totalDays={COMPETITION.totalDays} playoff={playoff} champion={champion} />
        <TabNav active={activeTab} onChange={setActiveTab} />
        {activeTab === 'report' ? (
          <DailyReport currentKey={currentKey} isAdmin dailyStats={dailyStats} players={sorted} onSaveDay={handleSaveDay} />
        ) : (
        <div className="main">
          <div>
            <AdminPanel players={sorted} onDelete={handleDeletePlayer} onResetAll={handleResetAll} />
            <Table sorted={sorted} onSelect={(p) => setSelectedKey(p.key)} flashKey={flashKey} meKey={null} isAdmin onDelete={handleDeletePlayer} />
          </div>
          <div className="side">
            {t.showPodium && <Podium sorted={sorted} onSelect={(p) => setSelectedKey(p.key)} />}
            {t.showBracket && (
              <Bracket
                sorted={sorted}
                playersMap={playersMap}
                playoff={playoff}
                isAdmin={true}
                onSelect={(p) => setSelectedKey(p.key)}
                onWin={handleSetWinner}
                onUndo={handleClearWinner}
                onStart={handleStartPlayoffs}
                onReset={handleResetPlayoffs}
              />
            )}
            <PrizeBanner />
          </div>
        </div>
        )}
        <div className="footer-stripe">
          <div>BUUKKAUSKISA · KAUSI 26 · VOL.&nbsp;I · {sorted.length}&nbsp;PELAAJAA · ADMIN-NÄKYMÄ</div>
          <div>POISTA PELAAJA → ROSKAKORI-IKONI &nbsp;|&nbsp; ADMIN EI NÄY TILASTOISSA</div>
        </div>
        <PlayerModal
          player={selected}
          isMe={false}
          isAdmin
          onClose={() => setSelectedKey(null)}
          onAction={performAction}
          onDelete={handleDeletePlayer}
        />
        <TweaksUI t={t} setTweak={setTweak} onResetAll={handleResetAll} isAdmin />
      </div>
    );
  }

  return (
    <div className="app">
      <Header me={me} onLogout={handleLogout} playerCount={sorted.length} today={today} dbBackend={dbBackend} />
      {t.showTicker && <Ticker items={tickerItems} paused={!t.pulse} />}
      <PhaseBanner phase={phase} today={today} totalDays={COMPETITION.totalDays} playoff={playoff} champion={champion} />
      <TabNav active={activeTab} onChange={setActiveTab} />
      {activeTab === 'report' ? (
        <DailyReport currentKey={currentKey} isAdmin={false} dailyStats={dailyStats} players={sorted} onSaveDay={handleSaveDay} />
      ) : (
      <div className="main">
        <div>
          <MyCard me={me} onAction={performAction} />
          <Table sorted={sorted} onSelect={(p) => setSelectedKey(p.key)} flashKey={flashKey} meKey={currentKey} />
        </div>
        <div className="side">
          {t.showPodium && <Podium sorted={sorted} onSelect={(p) => setSelectedKey(p.key)} />}
          {t.showBracket && (
            <Bracket
              sorted={sorted}
              playersMap={playersMap}
              playoff={playoff}
              isAdmin={false}
              onSelect={(p) => setSelectedKey(p.key)}
            />
          )}
          <PrizeBanner />
        </div>
      </div>
      )}
      <div className="footer-stripe">
        <div>BUUKKAUSKISA · KAUSI 26 · VOL.&nbsp;I · {sorted.length}&nbsp;PELAAJAA</div>
        <div>KLIKKAA RIVIÄ → PELAAJAPROFIILI &nbsp;|&nbsp; PELATAAN VAIN ARKIPÄIVISIN</div>
      </div>
      <PlayerModal
        player={selected}
        isMe={isMeSelected}
        onClose={() => setSelectedKey(null)}
        onAction={performAction}
      />
      <FloatPlus instances={floats} />
      <Confetti trigger={confettiKey} />
      <TweaksUI t={t} setTweak={setTweak} onResetAll={handleResetAll} isAdmin={false} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
