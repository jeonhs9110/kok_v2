import { cookies, headers } from 'next/headers';
import { isValidLang, type Lang } from './types';

/**
 * Server-side language detection for routes outside the `[lang]/` segment
 * (login, register, cart, forgot-password, auth/reset-password). Mirrors
 * the client-side detector those pages used before they were lifted to
 * server components.
 *
 * Priority:
 *   1. `kokkok_lang` cookie — set whenever a visitor lands on a `[lang]/`
 *      route, so anyone bouncing into /login from /kr/* etc. gets their
 *      previous choice.
 *   2. `accept-language` header — first visit from an English browser
 *      should not get the Korean default.
 *   3. Fallback to `'kr'` — KOKKOK's primary market.
 */
export async function detectLangServer(): Promise<Lang> {
  const cookieLang = (await cookies()).get('kokkok_lang')?.value;
  if (cookieLang && isValidLang(cookieLang)) return cookieLang;

  const accept = (await headers()).get('accept-language') ?? '';
  if (!accept.toLowerCase().startsWith('ko') && accept.length > 0) {
    return 'en';
  }
  return 'kr';
}
