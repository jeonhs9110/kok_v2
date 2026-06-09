'use client';

import { useRef, useState, useCallback } from 'react';
import type { PositionAnchor } from '@/lib/typography/options';

/**
 * Drop-in replacement for the 9-cell PositionPicker. Admin clicks (or
 * drags the marker) anywhere inside the box to pinpoint a position;
 * value is stored as { x: 0-100, y: 0-100 } percentages. The optional
 * `backgroundImage` prop puts the actual slide artwork inside the picker
 * so the admin can aim relative to the photo instead of a blank
 * rectangle.
 *
 * Pointer events (not separate mouse + touch handlers) so the same
 * implementation works on a desktop trackpad and an iPad admin session.
 */
interface Props {
  value: PositionAnchor;
  onChange: (next: PositionAnchor) => void;
  /** Tailwind aspect-ratio class, e.g. 'aspect-[16/7]' for the carousel. */
  aspectRatio?: string;
  /** Optional preview image rendered inside the box for spatial context. */
  backgroundImage?: string;
  /** Short text shown above the picker. */
  label?: string;
  /** Marker fill — defaults to white with a subtle ring so it reads on any photo. */
  markerColor?: string;
}

export default function ContinuousPositionPicker({
  value,
  onChange,
  aspectRatio = 'aspect-[16/7]',
  backgroundImage,
  label,
  markerColor = '#fff',
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const positionFromEvent = useCallback((e: { clientX: number; clientY: number }): PositionAnchor => {
    const box = boxRef.current;
    if (!box) return value;
    const rect = box.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, Math.round(x))),
      y: Math.max(0, Math.min(100, Math.round(y))),
    };
  }, [value]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    boxRef.current?.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onChange(positionFromEvent(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    onChange(positionFromEvent(e));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (boxRef.current?.hasPointerCapture(e.pointerId)) {
      boxRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
            {label}
          </label>
          <span className="text-[10px] font-mono text-gray-400">
            x {value.x}% · y {value.y}%
          </span>
        </div>
      )}

      <div
        ref={boxRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full ${aspectRatio} rounded-lg overflow-hidden border border-gray-300 bg-gradient-to-br from-neutral-100 to-neutral-200 cursor-crosshair select-none ${
          isDragging ? 'ring-2 ring-brand-primary/50' : ''
        }`}
        style={{ touchAction: 'none' }}
        /* No ARIA role declared — neither slider (which demands a 1D
           aria-valuenow) nor application (which doesn't accept
           aria-valuetext) cleanly models this 2D positioning control.
           The aria-label conveys the picker's purpose; the snap-preset
           chips below give keyboard-only users a 9-cell escape hatch
           if they can't use pointer events. */
        aria-label={`${label || 'Position picker'} (x ${value.x}, y ${value.y})`}
        tabIndex={0}
      >
        {backgroundImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundImage}
            alt=""
            /* object-contain instead of object-cover so the full source
               image is visible in both PC (16:7) and 모바일 (9:14) picker
               boxes — 송이's first round of testing pointed out that
               object-cover on a wide source in a tall mobile box hid
               most of the artwork, making it impossible to aim at
               content that exists in the source. With object-contain
               the marker can target every pixel of the actual image. */
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        )}

        {/* Crosshair grid lines so the admin has visual reference. */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
        </div>

        {/* Marker — animated translate so dragging feels live. */}
        <div
          className="absolute pointer-events-none transition-transform duration-75 ease-out"
          style={{
            left: `${value.x}%`,
            top: `${value.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="w-5 h-5 rounded-full shadow-lg ring-2 ring-black/20"
            style={{ background: markerColor }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', transform: 'translate(-50%, -50%)' }}
          />
        </div>
      </div>

      {/* Quick presets — 9 snap cells.
          Anchors land at the CENTER of each 3x3 grid cell (≈ 16.67 /
          50 / 83.33%) rather than the extreme edges. 송이's 2026-06-10
          feedback: clicking "top-left" used to pin text to the very
          corner — that was the box's edge, not the box's center. Now
          each snap reads as the center of the third the admin clicked. */}
      <div className="grid grid-cols-3 gap-1 max-w-[160px]">
        {([
          { x: 17, y: 17 }, { x: 50, y: 17 }, { x: 83, y: 17 },
          { x: 17, y: 50 }, { x: 50, y: 50 }, { x: 83, y: 50 },
          { x: 17, y: 83 }, { x: 50, y: 83 }, { x: 83, y: 83 },
        ] as const).map((preset, i) => {
          const active = value.x === preset.x && value.y === preset.y;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(preset)}
              className={`h-6 border text-[9px] font-bold transition-colors ${
                active
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
              }`}
              aria-label={`Snap to ${preset.x},${preset.y}`}
            >
              ·
            </button>
          );
        })}
      </div>
    </div>
  );
}
