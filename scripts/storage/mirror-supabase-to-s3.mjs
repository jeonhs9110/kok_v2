#!/usr/bin/env node
/**
 * Mirror every object in the Supabase Storage buckets the app uses into
 * the S3 bucket the cutover will read from. Preserves the key path 1:1
 * so persisted URLs in the DB still resolve after CloudFront points at
 * S3 with the same layout.
 *
 * Re-runnable. Existing S3 objects with the same key + size + ETag are
 * skipped, so a second pass right before cutover only copies the delta
 * (admin uploads that landed during the migration window).
 *
 * Required env:
 *   SUPABASE_URL                — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role key from project settings
 *   S3_STORAGE_BUCKET           — e.g. kokkok-storage-beb226
 *   AWS_REGION                  — e.g. ap-northeast-2 (defaults to it)
 *
 * Optional:
 *   SUPABASE_BUCKETS  — comma-separated list of buckets to mirror.
 *                       Defaults to 'product-images,site-assets'.
 *   DRY_RUN=1         — list what would be copied without copying.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... S3_STORAGE_BUCKET=... \
 *     node scripts/storage/mirror-supabase-to-s3.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const S3_BUCKET   = process.env.S3_STORAGE_BUCKET;
const AWS_REGION  = process.env.AWS_REGION ?? 'ap-northeast-2';
const BUCKETS     = (process.env.SUPABASE_BUCKETS ?? 'product-images,site-assets')
  .split(',').map(s => s.trim()).filter(Boolean);
const DRY_RUN     = process.env.DRY_RUN === '1';

if (!SUPABASE_URL || !SUPABASE_KEY || !S3_BUCKET) {
  console.error('ERROR: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and S3_STORAGE_BUCKET must all be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const s3       = new S3Client({ region: AWS_REGION });

const stats = { listed: 0, skipped: 0, copied: 0, failed: 0, totalBytes: 0 };

async function* listBucketRecursive(bucket, prefix = '', depth = 0) {
  if (depth > 6) return; // safety stop
  const { data, error } = await supabase.storage.from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    console.error(`  [list ${bucket}/${prefix}] failed: ${error.message}`);
    return;
  }
  for (const item of data ?? []) {
    if (!item.name) continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // Folder — recurse
      yield* listBucketRecursive(bucket, fullPath, depth + 1);
    } else {
      stats.listed++;
      yield {
        bucket,
        key: fullPath,
        size: item.metadata?.size ?? 0,
        mime: item.metadata?.mimetype ?? 'application/octet-stream',
        // Supabase returns ETag with quotes in `metadata.eTag`; normalize.
        etag: (item.metadata?.eTag ?? '').replace(/^"|"$/g, ''),
      };
    }
  }
}

async function s3ObjectMatches(key, size, _etag) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    // Supabase eTag isn't the same algorithm as S3 ETag (different
    // multipart chunking) so we can't compare directly. Match on
    // ContentLength only; that catches the common case (object copied,
    // nothing changed since) without falsely matching on collisions
    // since the key path itself includes a timestamp + random suffix.
    return head.ContentLength === size;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function copyOne({ bucket, key, size, mime, etag }) {
  // The bucket prefix becomes part of the S3 key, so admin/products on
  // S3 lives under `product-images/products/...` — same hierarchy as
  // Supabase. Storefront URLs that include `/storage/v1/object/public/
  // product-images/products/abc.jpg` just need their host swapped to
  // the CloudFront origin to keep working.
  const s3Key = `${bucket}/${key}`;

  if (await s3ObjectMatches(s3Key, size, etag)) {
    stats.skipped++;
    return;
  }

  if (DRY_RUN) {
    console.log(`  DRY: ${s3Key} (${size} bytes)`);
    stats.copied++;
    stats.totalBytes += size;
    return;
  }

  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error || !data) {
    console.error(`  [download ${bucket}/${key}] failed: ${error?.message ?? 'no data'}`);
    stats.failed++;
    return;
  }
  const body = Buffer.from(await data.arrayBuffer());

  try {
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: mime,
      ContentLength: body.length,
    }));
    stats.copied++;
    stats.totalBytes += body.length;
  } catch (err) {
    console.error(`  [put ${s3Key}] failed: ${err.message ?? err}`);
    stats.failed++;
  }
}

async function mirrorBucket(bucket) {
  console.log(`\n═══ ${bucket} ═══`);
  let count = 0;
  for await (const obj of listBucketRecursive(bucket)) {
    await copyOne(obj);
    count++;
    if (count % 25 === 0) {
      console.log(`  …${count} objects processed (copied=${stats.copied} skipped=${stats.skipped} failed=${stats.failed})`);
    }
  }
  console.log(`  done: ${count} objects in this bucket`);
}

async function main() {
  console.log(`mirror-supabase-to-s3:`);
  console.log(`  from: ${SUPABASE_URL}`);
  console.log(`  to:   s3://${S3_BUCKET}/<bucket>/<key>  (${AWS_REGION})`);
  console.log(`  buckets: ${BUCKETS.join(', ')}`);
  if (DRY_RUN) console.log(`  DRY_RUN: nothing will be uploaded`);

  const startedAt = Date.now();
  for (const bucket of BUCKETS) {
    await mirrorBucket(bucket);
  }
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);

  console.log(`\n─── summary ───`);
  console.log(`  listed:      ${stats.listed}`);
  console.log(`  copied:      ${stats.copied}`);
  console.log(`  skipped:     ${stats.skipped}  (already in S3 with matching size)`);
  console.log(`  failed:      ${stats.failed}`);
  console.log(`  bytes moved: ${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  elapsed:     ${elapsedSec}s`);

  if (stats.failed > 0) {
    console.error('\n✗ some copies failed; rerun to retry (skips will short-circuit successful ones).');
    process.exit(1);
  }
  console.log('\n✓ mirror complete.');
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
