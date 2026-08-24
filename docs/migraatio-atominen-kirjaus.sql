-- ============================================================================
-- Buukkikisa — kirjausten eheysmigraatio
-- Poistaa "lost update" -luokan: client ei enää laske absoluuttisia lukuja
-- omasta (mahdollisesti vanhentuneesta) kopiostaan, vaan palvelin kasvattaa
-- lukua atomisesti. Lisäksi append-only tapahtumaloki: mikään kirjaus ei voi
-- kadota jäljettömiin, vaan päivätilastot voidaan aina koota uudelleen.
-- ============================================================================

-- ── 1. Tapahtumaloki (append-only) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stat_events (
  id          bigserial PRIMARY KEY,
  player_id   text        NOT NULL,
  date_key    text        NOT NULL,
  field       text        NOT NULL,
  delta       int         NOT NULL,
  source      text        NOT NULL DEFAULT 'quick',
  client_date text,                      -- laitteen käsitys päivästä (kelloskew-diagnostiikka)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stat_events_player_date ON stat_events (player_id, date_key);

ALTER TABLE stat_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS se_select ON stat_events;
CREATE POLICY se_select ON stat_events FOR SELECT USING (has_linked_player());
DROP POLICY IF EXISTS se_insert ON stat_events;
CREATE POLICY se_insert ON stat_events FOR INSERT WITH CHECK (owns_player(player_id) OR is_admin());
-- Ei UPDATE/DELETE-politiikkaa → loki on muuttumaton.

-- ── 2. Atominen kasvatus (pikavalinnat) ─────────────────────────────────────
-- SECURITY INVOKER → RLS on voimassa. Pelaaja johdetaan auth.uid():sta, joten
-- kukaan ei voi kirjata toisen piikkiin. Päivä tulee PALVELIMEN kellosta, joten
-- laitteen väärä päivämäärä ei enää arkistoi kirjausta väärälle päivälle.
CREATE OR REPLACE FUNCTION bump_daily_stat(p_field text, p_delta int, p_client_date text DEFAULT NULL)
RETURNS daily_stats
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_pid  text;
  v_date text := to_char((now() AT TIME ZONE 'Europe/Helsinki')::date, 'YYYY-MM-DD');
  v_row  daily_stats;
BEGIN
  SELECT id INTO v_pid FROM players WHERE auth_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Kirjautunutta pelaajaa ei löytynyt' USING ERRCODE = '28000';
  END IF;
  IF p_field NOT IN ('luurit','vastatut','buukit','tapaamiset') THEN
    RAISE EXCEPTION 'Tuntematon kenttä: %', p_field USING ERRCODE = '22023';
  END IF;
  IF p_delta IS NULL OR p_delta < -100 OR p_delta > 100 OR p_delta = 0 THEN
    RAISE EXCEPTION 'Kelvoton muutos: %', p_delta USING ERRCODE = '22023';
  END IF;

  INSERT INTO daily_stats AS ds (id, player_id, date_key, luurit, vastatut, buukit, tapaamiset, updated_at)
  VALUES (
    v_pid || '_' || v_date, v_pid, v_date,
    GREATEST(0, CASE WHEN p_field='luurit'     THEN p_delta ELSE 0 END),
    GREATEST(0, CASE WHEN p_field='vastatut'   THEN p_delta ELSE 0 END),
    GREATEST(0, CASE WHEN p_field='buukit'     THEN p_delta ELSE 0 END),
    GREATEST(0, CASE WHEN p_field='tapaamiset' THEN p_delta ELSE 0 END),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    luurit     = GREATEST(0, ds.luurit     + CASE WHEN p_field='luurit'     THEN p_delta ELSE 0 END),
    vastatut   = GREATEST(0, ds.vastatut   + CASE WHEN p_field='vastatut'   THEN p_delta ELSE 0 END),
    buukit     = GREATEST(0, ds.buukit     + CASE WHEN p_field='buukit'     THEN p_delta ELSE 0 END),
    tapaamiset = GREATEST(0, ds.tapaamiset + CASE WHEN p_field='tapaamiset' THEN p_delta ELSE 0 END),
    updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO stat_events (player_id, date_key, field, delta, source, client_date)
  VALUES (v_pid, v_date, p_field, p_delta, 'quick', p_client_date);

  RETURN v_row;
END; $$;

GRANT EXECUTE ON FUNCTION bump_daily_stat(text,int,text) TO authenticated;

-- ── 3. Päiväraportin tallennus (absoluuttinen, mutta lokitettu) ─────────────
-- Käyttäjä asettaa päivän luvut tietoisesti. Kirjataan lokiin myös EDELLINEN
-- tila, jotta vahingossa tapahtunut ylikirjoitus on aina palautettavissa.
CREATE OR REPLACE FUNCTION set_daily_stats(
  p_date_key text, p_luurit int, p_vastatut int, p_buukit int, p_tapaamiset int
) RETURNS daily_stats
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_pid text;
  v_old daily_stats;
  v_row daily_stats;
BEGIN
  SELECT id INTO v_pid FROM players WHERE auth_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Kirjautunutta pelaajaa ei löytynyt' USING ERRCODE = '28000';
  END IF;
  IF p_date_key !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Kelvoton päivämäärä: %', p_date_key USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM daily_stats WHERE id = v_pid || '_' || p_date_key;

  INSERT INTO daily_stats AS ds (id, player_id, date_key, luurit, vastatut, buukit, tapaamiset, updated_at)
  VALUES (v_pid || '_' || p_date_key, v_pid, p_date_key,
          GREATEST(0,COALESCE(p_luurit,0)), GREATEST(0,COALESCE(p_vastatut,0)),
          GREATEST(0,COALESCE(p_buukit,0)), GREATEST(0,COALESCE(p_tapaamiset,0)), now())
  ON CONFLICT (id) DO UPDATE SET
    luurit=GREATEST(0,COALESCE(p_luurit,0)), vastatut=GREATEST(0,COALESCE(p_vastatut,0)),
    buukit=GREATEST(0,COALESCE(p_buukit,0)), tapaamiset=GREATEST(0,COALESCE(p_tapaamiset,0)),
    updated_at=now()
  RETURNING * INTO v_row;

  -- Loki: erotus edelliseen (tai koko arvo jos rivi oli uusi)
  INSERT INTO stat_events (player_id, date_key, field, delta, source, client_date)
  SELECT v_pid, p_date_key, f, d, 'report', NULL FROM (VALUES
    ('luurit',     GREATEST(0,COALESCE(p_luurit,0))     - COALESCE(v_old.luurit,0)),
    ('vastatut',   GREATEST(0,COALESCE(p_vastatut,0))   - COALESCE(v_old.vastatut,0)),
    ('buukit',     GREATEST(0,COALESCE(p_buukit,0))     - COALESCE(v_old.buukit,0)),
    ('tapaamiset', GREATEST(0,COALESCE(p_tapaamiset,0)) - COALESCE(v_old.tapaamiset,0))
  ) AS t(f,d) WHERE d <> 0;

  RETURN v_row;
END; $$;

GRANT EXECUTE ON FUNCTION set_daily_stats(text,int,int,int,int) TO authenticated;

-- ── 4. Tarkistus ────────────────────────────────────────────────────────────
SELECT 'migraatio ok' AS status,
       (SELECT count(*) FROM stat_events) AS lokirivit,
       (SELECT count(*) FROM pg_proc WHERE proname IN ('bump_daily_stat','set_daily_stats')) AS funktiot;
