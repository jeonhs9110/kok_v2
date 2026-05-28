'use client';

import { useEffect } from 'react';

/**
 * Last-resort error boundary. Catches errors thrown by the root layout
 * itself (`app/layout.tsx`) — usually the I18n provider failing to mount,
 * a bad fonts/CSS import, or a corrupt environment variable. Anything
 * else gets caught by `app/error.tsx` (or a closer route error.tsx).
 *
 * Per Next.js docs, this file replaces the root layout when it activates,
 * so it must define its own `<html>` and `<body>`. No tailwind/global
 * styles are guaranteed to be loaded — keep it inline.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error('[global-error]', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '20px', color: '#111', marginBottom: '12px' }}>
            사이트에 일시적인 문제가 발생했습니다
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '420px', lineHeight: 1.6 }}>
            잠시 후 다시 접속해주세요. 문제가 계속되면 새로고침을 해주세요.
          </p>
          {/* Plain <a> on purpose: global-error replaces the root layout,
              so the Next.js Router context isn't available — next/link's
              client-side navigation would silently no-op. A hard nav
              (full page reload) is the right recovery here anyway. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              marginTop: '20px',
              background: '#111',
              color: '#fff',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            홈으로
          </a>
          {error.digest && (
            <p style={{ marginTop: '16px', fontSize: '10px', color: '#d1d5db', fontFamily: 'monospace' }}>
              error id: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
