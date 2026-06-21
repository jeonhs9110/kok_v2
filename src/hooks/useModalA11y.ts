import { useEffect, useRef } from 'react';

/**
 * Wires up the three accessibility behaviors every dialog should have:
 *
 *   1. Esc key closes the dialog (call onClose)
 *   2. Focus is moved into the dialog on open (first focusable element)
 *   3. Tab-key focus trap keeps focus inside the dialog while it's open
 *
 * Returns a ref to attach to the dialog container. The container should
 * also receive `role="dialog"` and `aria-modal="true"` at the call site
 * so screen readers announce it as a modal — these can't be added by the
 * hook itself because React doesn't let us mutate non-managed attributes.
 *
 * Audit 2026-06-21: ProductDetailModal, CarouselSlideModal, MenuModal,
 * CategoryModal were missing all three; this hook closes the gap.
 */
export function useModalA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  // Esc → close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus the first focusable element when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
  }, [open]);

  // Focus trap — Tab from last → first, Shift+Tab from first → last.
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const nodes = root!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [open]);

  return ref;
}
