import { redirect } from 'next/navigation';

/**
 * /admin/media used to render a placeholder "Media & Story Manager"
 * page — hardcoded dark-themed JSX with non-functional Upload Asset /
 * Edit / Delete buttons and a sample card titled "Placeholder Story
 * Segment 1." There were no internal links to it, no DB integration,
 * and no operator workflow connected to it.
 *
 * Surfaced by the admin audit on 2026-06-29. Replaced with a redirect
 * to /admin/assets, which is the real, working asset library. Any
 * external bookmark or stale link to /admin/media now lands on the
 * page operators actually use.
 */
export default function MediaRedirect() {
  redirect('/admin/assets');
}
