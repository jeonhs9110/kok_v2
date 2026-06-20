/**
 * Asset library shared types — extracted so child components can
 * import them without round-tripping through the parent page.
 */

export type BucketId = 'site-assets' | 'product-images';

export interface BucketInfo {
  id: BucketId;
  label: string;
  description: string;
}

export interface Asset {
  bucket: BucketId;
  /** Full object key within the bucket (e.g. "carousel/1234-abc.png") */
  key: string;
  name: string;
  /** Bytes. May be 0 for legacy uploads where metadata wasn't tracked. */
  size: number;
  /** ISO timestamp from object metadata. */
  updatedAt: string;
  /** Inferred from extension. */
  kind: 'image' | 'video' | 'other';
  publicUrl: string;
}
