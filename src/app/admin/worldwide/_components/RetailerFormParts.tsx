'use client';

/** Cafe24 form field with the standard 11px semibold uppercase label. */
export function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Compact file-picker row used by both store-logo + country-image fields. */
export function FileUpload({
  previewUrl,
  previewClass,
  accept,
  onPick,
  onClear,
  isUploading,
}: {
  previewUrl: string;
  previewClass: string;
  accept: string;
  onPick: (file: File) => void;
  onClear: () => void;
  isUploading: boolean;
}) {
  return (
    <>
      <div className="flex gap-2 items-center">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className={previewClass} />
        )}
        <input
          type="file"
          accept={accept}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
          className="flex-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#f3f4f6] file:text-[#374151] hover:file:bg-[#e5e7eb]"
        />
        {previewUrl && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[#ef4444] hover:underline px-2"
          >
            제거
          </button>
        )}
      </div>
      {isUploading && (
        <p className="text-[10px] text-[#3b82f6] mt-1">업로드 중...</p>
      )}
    </>
  );
}
