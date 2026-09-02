import { sql } from '@vercel/postgres';

// Idempotent schema bring-up. Runs once per lambda cold start; the `movie`
// type was added after v1 shipped, so the check constraint is rebuilt here.
let migrated;
export function migrate() {
  if (!migrated) {
    migrated = (async () => {
      await sql`create extension if not exists pgcrypto`;
      await sql`create table if not exists items(
        id uuid primary key default gen_random_uuid(),
        type text not null,
        state text not null default 'queued' check(state in('queued','tried','loved','dropped')),
        title text not null,
        creator text,
        external_url text,
        external_id text,
        image_url text,
        metadata jsonb not null default '{}',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now())`;
      await sql`alter table items drop constraint if exists items_type_check`;
      await sql`alter table items add constraint items_type_check check(type in('album','book','movie','article','product'))`;
      await sql`create unique index if not exists items_type_external_id on items(type,external_id) where external_id is not null`;
    })().catch((e) => { migrated = undefined; throw e; });
  }
  return migrated;
}
export { sql };
