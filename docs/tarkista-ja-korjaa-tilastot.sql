-- ============================================================
-- Buukkikisa — tilastojen eheystarkistus ja korjaus
-- Aja Supabasen SQL-editorissa: https://supabase.com/dashboard/project/ideliyndsmylmarsqixr/sql
-- ============================================================

-- ── VAIHE 1: TARKISTUS (turvallinen, ei muuta mitään) ──────────
-- Kertoo (a) onko daily_stats ylittänyt 1000 rivin rajan (jonka jälkeen
-- selaimen haku katkesi ja totaalit laskettiin vajaista riveistä), ja
-- (b) täsmääkö jokaisen pelaajan players-rivin totaali daily_stats-summaan.
-- daily_stats on totuuden lähde: sinne kirjoitetaan rivi kerrallaan,
-- eikä sitä ole koskaan ylikirjoitettu vajailla luvuilla.

select json_build_object(
  'daily_rows',        (select count(*) from daily_stats),
  'yli_1000_rajan',    (select count(*) > 1000 from daily_stats),
  'deals_rows',        (select count(*) from deals),
  'players_rows',      (select count(*) from players),
  'eroavat_pelaajat',  (
    select coalesce(json_agg(row_to_json(x)), '[]'::json) from (
      select p.id, p.nick,
             p.buukit   as rivi_buukit,   coalesce(s.b,0) as oikea_buukit,
             p.vastatut as rivi_vastatut, coalesce(s.v,0) as oikea_vastatut,
             p.luurit   as rivi_luurit,   coalesce(s.l,0) as oikea_luurit
      from players p
      left join (
        select player_id, sum(buukit) b, sum(vastatut) v, sum(luurit) l
        from daily_stats group by player_id
      ) s on s.player_id = p.id
      where (p.buukit, p.vastatut, p.luurit)
            is distinct from (coalesce(s.b,0), coalesce(s.v,0), coalesce(s.l,0))
    ) x
  )
) as tarkistus;

-- TULKINTA:
--   'eroavat_pelaajat': []   → kaikki kunnossa, ÄLÄ aja vaihetta 2.
--   listassa pelaajia, joilla rivi_* < oikea_*  → totaalit on ylikirjoitettu
--   vajailla luvuilla. Aja vaihe 2, se palauttaa oikeat summat.
--   (Jos rivi_* > oikea_*, kyse on kisa-ajan luvuista joita ei ole
--   daily_stats-riveinä — ÄLÄ aja vaihetta 2, kysy ensin.)


-- ── VAIHE 2: KORJAUS (aja vain jos vaihe 1 näytti eroja, joissa rivi < oikea) ──
-- Laskee totaalit uudelleen palvelinpuolella koko daily_stats-datasta
-- (ei 1000 rivin rajaa). Idempotentti: voi ajaa turvallisesti uudelleen.

-- BEGIN;
-- UPDATE players p
--    SET luurit   = coalesce(s.l, 0),
--        vastatut = coalesce(s.v, 0),
--        buukit   = coalesce(s.b, 0)
--   FROM (
--        select player_id, sum(buukit) b, sum(vastatut) v, sum(luurit) l
--          from daily_stats group by player_id
--   ) s
--  WHERE p.id = s.player_id
--    AND (p.luurit, p.vastatut, p.buukit) IS DISTINCT FROM (s.l, s.v, s.b);
-- COMMIT;

-- Korjauksen jälkeen aja vaihe 1 uudelleen → 'eroavat_pelaajat' pitäisi olla [].
