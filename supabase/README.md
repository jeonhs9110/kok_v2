# Supabase migrations

This directory is the source of truth for **future** database schema changes.
The Supabase CLI manages versioned, ordered, repeatable migrations here —
replacing the previous workflow of one-off `.sql` files dropped at the repo
root and manually run through the dashboard SQL editor.

## What's in `migrations/`

Two kinds of files, distinguishable by timestamp prefix:

| Prefix range          | Origin                                       |
|-----------------------|----------------------------------------------|
| `00000000000001_*`–`00000000000016_*` | Historical migrations applied via the dashboard before this scaffold existed. Renamed from `migration-*.sql` at the repo root. **Already applied to production.** Don't re-apply. |
| `2026MMDDHHMMSS_*`    | New migrations created with `supabase migration new <name>`. Applied via `supabase db push`. |

## Common workflow

```bash
# One-time: link this repo to the remote Supabase project.
supabase link --project-ref auxfxdttbhhnmnutbemn

# Create a new migration:
supabase migration new add_user_preferences
# → generates supabase/migrations/<timestamp>_add_user_preferences.sql

# Edit the file with your DDL, then:
supabase db push        # applies pending migrations to the remote DB

# After pulling someone else's migration:
supabase db push        # same command; idempotent
```

## Local development (optional)

If you want a local Postgres for offline dev:

```bash
supabase start          # spins up local Postgres + Auth + Studio
supabase db reset       # rebuilds local DB from migrations/ + seed.sql
```

The remote DB is unaffected by anything you do locally until you
`supabase db push`.

## Recovery / repair

If a migration was applied manually (outside the CLI) on production and
the CLI's migration history is out of sync:

```bash
supabase migration repair --status applied <timestamp>
```

This marks the migration as already-applied without re-running it.
Useful for the legacy `00000000000001_*`–`16_*` files which were applied
through the dashboard.

## What about the old `migration-*.sql` files at repo root?

They've been moved into `migrations/` with sequential timestamps
preserving their original order. The root copies are deleted to avoid
confusion. The DB state is what matters; these files are now historical
reference / future replay material.
