# Supabase Storage → S3 Mirror

Phase F prep. Copies every object in the Supabase Storage buckets the
app uses into the production S3 bucket, preserving the key path 1:1
so persisted URLs in the DB still resolve after the cutover swaps the
CDN host.

## Buckets covered

| Supabase | What lives there |
|---|---|
| `product-images` | Products, carousel, promo banners, sub-hero, instagram, reviews, detail components |
| `site-assets` | Logo, site backgrounds, worldwide vendor logos / country images |

Both land under their bucket name as a prefix in S3:
```
s3://kokkok-storage-beb226/product-images/products/<timestamp>-<rand>.jpg
s3://kokkok-storage-beb226/site-assets/logo/<timestamp>-<rand>.png
```

So a Supabase URL like
`https://<ref>.supabase.co/storage/v1/object/public/product-images/products/abc.jpg`
becomes, after cutover,
`https://<cdn-host>/product-images/products/abc.jpg`. Same key.

## Run

```bash
export SUPABASE_URL='https://<ref>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='eyJ...'           # service-role, NOT anon
export S3_STORAGE_BUCKET='kokkok-storage-beb226'
export AWS_PROFILE=kokkokgarden                     # whichever profile has S3 write

# Dry run first — lists what would be copied without uploading.
DRY_RUN=1 node scripts/storage/mirror-supabase-to-s3.mjs

# Real run.
node scripts/storage/mirror-supabase-to-s3.mjs
```

## Re-runs are safe

The script skips any S3 object that already exists with the same byte
count. Run it once 24h before cutover to move the bulk; run it again
in the cutover window to catch admin uploads that landed during the
intervening window. Only the delta moves the second time.

## What it does NOT do

- **Delete objects** removed from Supabase. The bucket-level filter
  on Supabase Storage's `list()` paginates by prefix and won't tell
  us what's gone. Acceptable for our case: a missing object on S3 is
  a UI fallback; an orphaned object is wasted ~KB. The Phase F
  rollback escape valve depends on Supabase staying live, so we don't
  want to delete from it either.
- **Validate URLs in the DB.** The mirror copies whatever the source
  has. If a row in the DB points at a key that doesn't exist on
  Supabase, the mirror won't fix that.
- **Cross-region copies.** Both endpoints are accessed from wherever
  the script runs. Run it from a machine with low-latency paths to
  both clouds for best throughput.
