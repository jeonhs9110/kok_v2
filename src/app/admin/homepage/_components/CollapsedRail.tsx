'use client';

import type { SectionDef } from './SectionCard';

/**
 * Icon-only navigation that replaces the full section list when an
 * editor is open. Same selection state as the full rail (active section
 * gets a blue tint + left-border accent); clicking a different icon
 * swaps the editor to that section. Keeps the operator oriented while
 * reclaiming 256px of horizontal space for the editor + preview combo.
 *
 * Extracted from /admin/homepage/page.tsx at 2026-06-21.
 */
export default function CollapsedRail({
  grouped,
  editingKey,
  onEdit,
}: {
  grouped: Array<{ title: string; sections: SectionDef[] }>;
  editingKey: string;
  onEdit: (key: string) => void;
}) {
  return (
    <aside className="w-[64px] bg-white border-r border-[#e5e7eb] flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {grouped.map((group, gi) => (
          <div key={group.title}>
            {/* Thin divider between groups so the operator still gets the
                same visual grouping as the full rail. No labels — those
                live as hover tooltips on each icon button below. */}
            {gi > 0 && <div className="mx-3 my-1 border-t border-[#f3f4f6]" />}
            {group.sections.map(section => {
              const Icon = section.icon;
              const active = editingKey === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => onEdit(section.key)}
                  className={`w-full h-11 flex items-center justify-center transition-colors relative ${
                    active
                      ? 'bg-[#eff6ff] text-[#3b82f6]'
                      : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#1f2937]'
                  }`}
                  title={section.name}
                  aria-label={section.name}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-[#3b82f6]" />
                  )}
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
