'use client';

import { useState, createContext, useContext, useCallback } from 'react';
import { CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';

/**
 * Cafe24-style toast notification. Replaces the alert() popups scattered
 * across the admin (save, delete, upload failure, etc.) with a passive
 * corner pill so operator's flow isn't interrupted by a modal.
 *
 * Usage:
 *   const { show } = useToast();
 *   show('저장되었습니다', 'success');
 *
 * Tone matches Cafe24's signal palette: 녹색 (success), 황색 (warning),
 * 빨강 (error). Auto-dismisses after 2.5s; tapping the X closes early.
 */

type Tone = 'success' | 'warning' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++counter;
    setItems(prev => [...prev, { id, message, tone }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {items.map(item => (
          <ToastChip key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Allow components to mount before the provider is ready — return a
    // no-op so a stray show() call doesn't crash the page. Real toast
    // wires up once the provider mounts.
    return {
      show: () => {
        if (typeof window !== 'undefined') {
          console.warn('[Toast] called outside ToastProvider');
        }
      },
    } as ToastContextValue;
  }
  return ctx;
}

function ToastChip({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  // CSS-only slide-in animation — replaces the previous useState +
  // useEffect pattern that tripped React 19's set-state-in-effect
  // rule. animate-in / fade-in / slide-in-from-right utilities are
  // already in the Tailwind 4 keyframe pack used elsewhere in the app.
  const palette: Record<Tone, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
    success: { bg: 'bg-white', border: 'border-l-4 border-[#22c55e]', icon: <CheckCircle className="w-4 h-4 text-[#22c55e]" />, text: 'text-[#1f2937]' },
    warning: { bg: 'bg-white', border: 'border-l-4 border-[#f59e0b]', icon: <AlertCircle className="w-4 h-4 text-[#f59e0b]" />, text: 'text-[#1f2937]' },
    error:   { bg: 'bg-white', border: 'border-l-4 border-[#ef4444]', icon: <XCircle className="w-4 h-4 text-[#ef4444]" />,    text: 'text-[#1f2937]' },
    info:    { bg: 'bg-white', border: 'border-l-4 border-[#3b82f6]', icon: <CheckCircle className="w-4 h-4 text-[#3b82f6]" />, text: 'text-[#1f2937]' },
  };
  const p = palette[item.tone];
  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-3 py-2.5 rounded shadow-md border border-[#e5e7eb] animate-in fade-in slide-in-from-right-4 duration-200 ${p.bg} ${p.border}`}
    >
      {p.icon}
      <span className={`text-[12px] font-medium ${p.text} flex-1 whitespace-pre-wrap break-words`}>{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[#9ca3af] hover:text-[#1f2937] transition-colors"
        aria-label="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
