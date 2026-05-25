# Buukkauskisa — Supabase-asennus (5–10 min)

Tämä saa kaikki pelaajat näkemään saman taulukon reaaliajassa.

## 1. Luo Supabase-projekti (ilmainen)
1. Mene https://supabase.com → **Start your project** → kirjaudu GitHubilla
2. **New project** → anna nimi (esim. `buukkauskisa`), valitse Free-tier, valitse alue (esim. EU West) → Create
3. Odota n. 1 min kunnes projekti on käynnissä

## 2. Luo `players`-taulu (SQL Editor)
Avaa **SQL Editor** vasemmasta valikosta → **New query** → liitä alla oleva ja paina **Run**:

```sql
create table public.players (
  id          text primary key,
  nick        text not null,
  city        text not null,
  init        text not null,
  luurit      int  not null default 0,
  vastatut    int  not null default 0,
  buukit      int  not null default 0,
  streak      int  not null default 0,
  trend_n     int  not null default 0,
  last5       jsonb not null default '[0,0,0,0,0]'::jsonb,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- Playoff-tila tallennetaan yhteen JSON-riviin meta-tauluun (id='playoffs')
create table public.meta (
  id          text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.meta    enable row level security;

-- Pieni tiimi, ei autentikointia — kaikki saavat lukea/kirjoittaa
create policy "public read"   on public.players for select using (true);
create policy "public insert" on public.players for insert with check (true);
create policy "public update" on public.players for update using (true);
create policy "public delete" on public.players for delete using (true);

create policy "meta read"     on public.meta    for select using (true);
create policy "meta write"    on public.meta    for insert with check (true);
create policy "meta update"   on public.meta    for update using (true);
create policy "meta delete"   on public.meta    for delete using (true);

-- Realtime: lisätään julkaisuun
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.meta;
```

## 3. Hae projektin URL ja anon-key
1. Vasemmalla **Project Settings** (rattaan kuva) → **API**
2. Kopioi **Project URL** ja **anon public**-avain
3. Avaa projektista `config.js` ja täytä:

```js
window.SUPABASE_CONFIG = {
  url:     'https://xxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```

## 4. Julkaise Vercelissä
- Importtaa projekti Vercelille (GitHub tai drag-and-drop)
- Tarkista että `config.js` on mukana (sen ei tarvitse olla salainen — anon-key on tarkoitettu selaimille käytettäväksi RLS:n suojaamana)
- Done — sama URL kaikille, reaaliaikainen liiga

## Tarkistus
- Jos selaimen konsolissa näkyy `DB.backend === 'supabase'` → OK
- Jos näkyy `'local'` → config ei ole täytetty oikein, tai Supabase ei vastaa
- Kirjaudu pelaajaksi → mene Supabasen **Table Editor → players** → rivin pitäisi näkyä

## Pelaajien resetointi kauden lopuksi
Joko admin-paneelista "Nollaa kaikki pelaajat", tai suoraan SQL-editorissa:
```sql
delete from public.players;
```

## Turvallisuusnotaatti
RLS-politiikka on auki ("public update"). Tiimin sisäisesti tämä on ok — kuka tahansa, jolla on linkki ja anon-key, voi muokata. Jos haluat tiukempaa, lisää tunnistus tai kirjautumiseen oma session-token-logiikka.
