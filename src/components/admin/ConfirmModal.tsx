'use client';

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Cafe24-style confirm dialog. Replaces window.confirm() across admin so
 * destructive prompts (삭제 / 초기화 / 게시 중단) match the Cafe24 visual
 * language — no more native browser dialogs breaking the chrome.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ message: '정말 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
 *   if (!ok) return;
 *
 * Or the short form for simple yes/no:
 *   const ok = await confirm('정말 삭제하시겠습니까?');
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'normal' | 'danger';
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  // Remember which element had focus when the dialog opened so we
  // can restore it on close — WCAG 2.4.3 Focus Order requires the
  // trigger regain focus after the modal dismisses. Without this,
  // Tab drops back to <body> and the operator has to Tab through
  // half the page to get back where they were.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback<ConfirmFn>((arg) => {
    const opts: ConfirmOptions = typeof arg === 'string' ? { message: arg } : arg;
    if (typeof document !== 'undefined') {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    }
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setPending(current => {
      if (!current) return null;
      current.resolve(result);
      return null;
    });
    // Restore focus after the state flush completes so the closing
    // animation doesn't yank focus while the dialog is still visible.
    // requestAnimationFrame is enough to let React commit; the null
    // guard covers cases where the trigger was itself unmounted.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const target = previouslyFocusedRef.current;
        if (target && typeof target.focus === 'function' && document.contains(target)) {
          target.focus();
        }
        previouslyFocusedRef.current = null;
      });
    }
  }, []);

  // Escape + Tab-trap. Escape closes as "cancel" (WCAG 2.1.1 keyboard).
  // Tab / Shift+Tab wrap inside the dialog so keyboard users can't
  // escape it into the background page while it's modal (WCAG 2.4.3
  // Focus Order + 2.4.11 Focus Not Obscured, new in WCAG 2.2).
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  const isDanger = pending?.opts.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => close(false)}
        >
          <div
            ref={dialogRef}
            className="bg-white rounded shadow-2xl w-full max-w-sm border border-[#e5e7eb] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
              {isDanger && <AlertTriangle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />}
              <h3 className="text-[13px] font-bold text-[#1f2937]">
                {pending.opts.title ?? (isDanger ? '삭제 확인' : '확인')}
              </h3>
            </div>
            <div className="px-5 py-4 text-[13px] text-[#374151] whitespace-pre-line leading-relaxed">
              {pending.opts.message}
            </div>
            <div className="px-5 py-3 bg-[#fafbfc] border-t border-[#f3f4f6] flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="px-3 py-1.5 text-[12px] font-semibold text-[#374151] border border-[#d1d5db] rounded bg-white hover:bg-[#f9fafb] transition-colors"
                autoFocus
              >
                {pending.opts.cancelText ?? '취소'}
              </button>
              <button
                onClick={() => close(true)}
                className={`px-3 py-1.5 text-[12px] font-semibold text-white rounded transition-colors ${
                  isDanger
                    ? 'bg-[#ef4444] hover:bg-[#dc2626]'
                    : 'bg-[#3b82f6] hover:bg-[#2563eb]'
                }`}
              >
                {pending.opts.confirmText ?? '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return async (arg) => {
      const message = typeof arg === 'string' ? arg : arg.message;
      if (typeof window !== 'undefined') {
        console.warn('[Confirm] useConfirm called outside <ConfirmProvider>, falling back to native confirm');
        return window.confirm(message);
      }
      return false;
    };
  }
  return ctx;
}
