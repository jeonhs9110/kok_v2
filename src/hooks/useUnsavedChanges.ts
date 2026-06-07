'use client';

/**
 * Warn the admin before they navigate away with unsaved form changes.
 *
 * - `beforeunload` covers tab close / reload / cross-origin navigation.
 *   The browser shows its native "Leave site?" prompt; the message string
 *   is ignored by modern browsers but must be set for the prompt to fire.
 * - In-app navigation (Next.js Link clicks) is intercepted via a click
 *   listener on the document. We catch the click in the capture phase so
 *   we beat Next.js's own handler; if the admin confirms, we re-trigger
 *   the navigation programmatically.
 *
 * Drop into any client-side admin form that exposes a dirty boolean:
 *   const isDirty = JSON.stringify(form) !== JSON.stringify(saved);
 *   useUnsavedChanges(isDirty);
 *
 * Cleanup wires both listeners off on unmount, so a saved-and-navigated
 * form doesn't leak handlers between page mounts.
 */

import { useEffect } from 'react';

const PROMPT = '저장하지 않은 변경 사항이 있습니다. 정말 떠나시겠습니까?';

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Set returnValue for legacy browsers; modern Chrome/Safari/Firefox
      // ignore the string but require the assignment for the prompt to fire.
      e.returnValue = PROMPT;
      return PROMPT;
    }

    function onAnchorClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      // Skip new-tab / download / external — the current page isn't going
      // anywhere so the form data survives.
      if (anchor.target === '_blank') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      // Allow modifier-click (open in new tab / window) — same reason.
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      if (!window.confirm(PROMPT)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onAnchorClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onAnchorClick, true);
    };
  }, [isDirty]);
}
