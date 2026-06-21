'use client';

import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save, UserPlus } from 'lucide-react';
import SectionHeader from './SectionHeader';
import type { RegField } from './types';

interface Props {
  fields: RegField[];
  newField: { key: string; label_kr: string; label_en: string; type: string };
  marketingConsent: boolean;
  privacyConsent: boolean;
  openSection: string;
  isSaving: boolean;
  isSaved: boolean;
  onMoveField: (index: number, dir: -1 | 1) => void;
  onToggleField: (key: string) => void;
  onToggleRequired: (key: string) => void;
  onRemoveField: (key: string) => void;
  onChangeNewField: (next: { key: string; label_kr: string; label_en: string; type: string }) => void;
  onAddField: () => void;
  onPrivacyConsentChange: (v: boolean) => void;
  onMarketingConsentChange: (v: boolean) => void;
  onSetOpenSection: (v: string) => void;
  onSave: () => void;
}

export default function RegistrationFieldsSection({
  fields,
  newField,
  marketingConsent,
  privacyConsent,
  openSection,
  isSaving,
  isSaved,
  onMoveField,
  onToggleField,
  onToggleRequired,
  onRemoveField,
  onChangeNewField,
  onAddField,
  onPrivacyConsentChange,
  onMarketingConsentChange,
  onSetOpenSection,
  onSave,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
      <SectionHeader id="fields" title="회원가입 항목 관리" icon={UserPlus} openSection={openSection} setOpenSection={onSetOpenSection} />
      {openSection === 'fields' && (
        <div className="p-5 pt-0 space-y-4">
          <p className="text-sm text-gray-500">고객 회원가입 시 수집할 항목을 관리합니다. 드래그하여 순서를 변경하거나, 토글로 활성/비활성 할 수 있습니다.</p>

          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.key} className={`flex items-center gap-3 p-3 rounded-lg border ${f.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => onMoveField(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onMoveField(i, 1)} disabled={i === fields.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <GripVertical className="w-4 h-4 text-gray-300" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{f.label_kr}</span>
                    <span className="text-[10px] text-gray-400">{f.label_en}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{f.type}</span>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={f.required} onChange={() => onToggleRequired(f.key)} className="w-3.5 h-3.5 rounded" />
                  필수
                </label>
                <button
                  onClick={() => onToggleField(f.key)}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${f.enabled ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}
                >
                  <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
                {f.removable && (
                  <button onClick={() => onRemoveField(f.key)} className="text-gray-300 hover:text-[#ef4444] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border border-dashed border-[#d1d5db] rounded-lg p-4">
            <p className="text-xs text-gray-500 font-semibold mb-3">+ 커스텀 항목 추가</p>
            <div className="grid grid-cols-4 gap-2">
              <input type="text" placeholder="key (영문)" value={newField.key} onChange={e => onChangeNewField({ ...newField, key: e.target.value.replace(/\s/g, '_').toLowerCase() })} className="rounded-lg px-3 py-2 text-xs" />
              <input type="text" placeholder="라벨 (한국어)" value={newField.label_kr} onChange={e => onChangeNewField({ ...newField, label_kr: e.target.value })} className="rounded-lg px-3 py-2 text-xs" />
              <input type="text" placeholder="라벨 (영어)" value={newField.label_en} onChange={e => onChangeNewField({ ...newField, label_en: e.target.value })} className="rounded-lg px-3 py-2 text-xs" />
              <div className="flex gap-2">
                <select value={newField.type} onChange={e => onChangeNewField({ ...newField, type: e.target.value })} className="flex-1 rounded-lg px-2 py-2 text-xs">
                  <option value="text">텍스트</option>
                  <option value="email">이메일</option>
                  <option value="tel">전화번호</option>
                  <option value="date">날짜</option>
                  <option value="select">선택</option>
                  <option value="textarea">장문</option>
                </select>
                <button onClick={onAddField} disabled={!newField.key || !newField.label_kr} className="bg-[#3b82f6] text-white px-3 rounded-lg text-xs font-semibold disabled:opacity-30 hover:bg-[#2563eb] transition">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-[#f3f4f6] pt-4 space-y-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">법적 동의 항목</p>
            <label className="flex items-center justify-between p-3 rounded-lg border border-[#e5e7eb]">
              <div>
                <p className="text-sm font-semibold text-gray-800">개인정보 처리 동의</p>
                <p className="text-[11px] text-[#9ca3af]">개인정보보호법 제15조에 따른 필수 동의</p>
              </div>
              <input type="checkbox" checked={privacyConsent} onChange={() => onPrivacyConsentChange(!privacyConsent)} className="w-4 h-4 rounded" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border border-[#e5e7eb]">
              <div>
                <p className="text-sm font-semibold text-gray-800">마케팅 수신 동의</p>
                <p className="text-[11px] text-[#9ca3af]">이메일, SMS 등 마케팅 정보 수신 (선택)</p>
              </div>
              <input type="checkbox" checked={marketingConsent} onChange={() => onMarketingConsentChange(!marketingConsent)} className="w-4 h-4 rounded" />
            </label>
          </div>

          <button onClick={onSave} disabled={isSaving} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${isSaved ? 'bg-[#16a34a] text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'} disabled:opacity-50`}>
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : isSaved ? '✓ 저장 완료' : '항목 설정 저장'}
          </button>
        </div>
      )}
    </div>
  );
}
