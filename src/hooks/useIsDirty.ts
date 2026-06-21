import { useMemo } from 'react';

/**
 * Cheap "is the current value different from the last saved snapshot"
 * detector for hooks that previously did:
 *
 *   const isDirty = JSON.stringify(current) !== JSON.stringify(saved);
 *
 * That pattern reserializes both sides every render. For useTheme /
 * useTopStripe / useLogo (each re-render every keystroke), a 30+-key
 * tokens object generates ~90 KB/s of allocation while the operator
 * drags a color picker.
 *
 * This memoizes each side independently — string compare per render is
 * cheap; reserialize only when the input identity changes.
 *
 * Audit 2026-06-21.
 */
export function useIsDirty<T>(current: T, saved: T): boolean {
  const currentSerialized = useMemo(() => JSON.stringify(current), [current]);
  const savedSerialized = useMemo(() => JSON.stringify(saved), [saved]);
  return currentSerialized !== savedSerialized;
}
