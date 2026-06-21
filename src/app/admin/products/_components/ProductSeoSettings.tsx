'use client';

import type { FormState } from './useProductForm';

/**
 * SEO 설정 section for ProductDetailModal — mirrors Cafe24's product
 * SEO tab field-for-field:
 *   - 검색 엔진 노출 설정 (Radio: 노출함 / 노출안함)
 *   - 브라우저 타이틀 (Title)
 *   - 메타태그1 : Author
 *   - 메타태그2 : Description
 *   - 메타태그3 : Keywords
 *   - 상품 이미지 Alt 텍스트
 *
 * All optional. When the operator leaves a field blank, the storefront
 * generateMetadata at /[lang]/products/[id] falls back to the existing
 * defaults (product.name / product.summary), so unmigrated rows render
 * the same as before.
 */
interface Props {
  value: Pick<
    FormState,
    'seoIndexable' | 'seoTitle' | 'seoAuthor' | 'seoDescription' | 'seoKeywords' | 'seoImageAlt'
  >;
  onChange: (p: Partial<FormState>) => void;
}

export default function ProductSeoSettings({ value, onChange }: Props) {
  return (
    <section className="border border-[#e5e7eb] rounded">
      <header className="px-4 py-2.5 bg-[#fafbfc] border-b border-[#e5e7eb] flex items-center justify-between">
        <h4 className="text-[12.5px] font-bold text-[#1f2937]">검색엔진 최적화(SEO)</h4>
        <span className="text-[10px] text-[#9ca3af]">선택 입력 · 비워두면 기본값 사용</span>
      </header>

      <div className="divide-y divide-[#f3f4f6]">
        <Row label="검색엔진 노출">
          <div className="flex items-center gap-4">
            <RadioOption
              checked={value.seoIndexable}
              onChange={() => onChange({ seoIndexable: true })}
              label="노출함"
            />
            <RadioOption
              checked={!value.seoIndexable}
              onChange={() => onChange({ seoIndexable: false })}
              label="노출안함"
            />
          </div>
        </Row>

        <Row label="브라우저 타이틀" hint="비우면 상품명을 사용합니다.">
          <input
            type="text"
            value={value.seoTitle}
            onChange={e => onChange({ seoTitle: e.target.value })}
            placeholder={'예) ' + '레티놀 바운스 세럼 — KOKKOK GARDEN'}
            className="w-full px-2.5 py-1.5 text-[12.5px] border border-[#e5e7eb] rounded focus:outline-none focus:border-[#3b82f6]"
          />
        </Row>

        <Row label="메타 Author">
          <input
            type="text"
            value={value.seoAuthor}
            onChange={e => onChange({ seoAuthor: e.target.value })}
            placeholder="예) KOKKOK GARDEN"
            className="w-full px-2.5 py-1.5 text-[12.5px] border border-[#e5e7eb] rounded focus:outline-none focus:border-[#3b82f6]"
          />
        </Row>

        <Row label="메타 Description" hint="검색 결과 미리보기에 노출되는 짧은 설명. 비우면 상품 요약을 사용합니다.">
          <textarea
            value={value.seoDescription}
            onChange={e => onChange({ seoDescription: e.target.value })}
            rows={2}
            maxLength={160}
            placeholder="160자 이내 권장"
            className="w-full px-2.5 py-1.5 text-[12.5px] border border-[#e5e7eb] rounded focus:outline-none focus:border-[#3b82f6] resize-none"
          />
        </Row>

        <Row label="메타 Keywords" hint="쉼표로 구분. 예) 세럼, 레티놀, 보습">
          <input
            type="text"
            value={value.seoKeywords}
            onChange={e => onChange({ seoKeywords: e.target.value })}
            placeholder="세럼, 레티놀, 보습"
            className="w-full px-2.5 py-1.5 text-[12.5px] border border-[#e5e7eb] rounded focus:outline-none focus:border-[#3b82f6]"
          />
        </Row>

        <Row label="이미지 Alt 텍스트" hint="시각장애인 + 검색엔진용 대체 설명. 비우면 상품명을 사용합니다.">
          <input
            type="text"
            value={value.seoImageAlt}
            onChange={e => onChange({ seoImageAlt: e.target.value })}
            placeholder="예) 레티놀 바운스 세럼 30ml"
            className="w-full px-2.5 py-1.5 text-[12.5px] border border-[#e5e7eb] rounded focus:outline-none focus:border-[#3b82f6]"
          />
        </Row>
      </div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-32 flex-shrink-0 pt-1.5">
        <div className="text-[11.5px] font-semibold text-[#374151]">{label}</div>
        {hint && <div className="text-[10px] text-[#9ca3af] mt-0.5 leading-snug">{hint}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function RadioOption({
  checked, onChange, label,
}: {
  checked: boolean; onChange: () => void; label: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 accent-[#3b82f6]"
      />
      <span className="text-[12px] text-[#1f2937]">{label}</span>
    </label>
  );
}
