'use client';

import { useState } from 'react';
import { Save, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();
import { SUPPORTED_LANGS, type WorldwideLang } from '@/lib/worldwide/defaults';
import { useToast } from '@/components/admin/Toast';
import {
  LANG_LABEL,
  LABEL_SECTION_TITLE,
  type LabelRow,
} from '../_lib';

interface Props {
  initialLabels: LabelRow[];
}

export default function LabelsEditor({ initialLabels }: Props) {
  const toast = useToast();
  const [labels, setLabels] = useState<LabelRow[]>(initialLabels);
  const [editLang, setEditLang] = useState<WorldwideLang>('kr');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [openLabel, setOpenLabel] = useState<string>('');

  function updateLabel(key: string, lang: WorldwideLang, value: string) {
    setLabels(prev => prev.map(r => (r.label_key === key ? { ...r, [lang]: value } : r)));
  }

  async function saveLabel(row: LabelRow) {
    if (!supabase) {
      toast.show('Supabase가 설정되지 않았습니다. 환경변수를 확인하세요.', 'error');
      return;
    }
    setSavingKey(row.label_key);
    const { error } = await supabase.from('worldwide_labels').upsert({
      label_key: row.label_key,
      kr: row.kr,
      en: row.en,
      cn: row.cn,
      jp: row.jp,
      vn: row.vn,
      th: row.th,
      updated_at: new Date().toISOString(),
    });
    setSavingKey(null);
    if (error) {
      toast.show(`저장 실패: ${error.message}`, 'error');
      return;
    }
    setSavedKey(row.label_key);
    setTimeout(() => setSavedKey(null), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">편집 언어</p>
        <div className="flex flex-wrap gap-1">
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setEditLang(l)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                editLang === l ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {labels.map(row => {
        const isOpen = openLabel === row.label_key;
        const title = LABEL_SECTION_TITLE[row.label_key] ?? row.label_key;
        return (
          <div key={row.label_key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setOpenLabel(isOpen ? '' : row.label_key)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xl">
                    {row[editLang] || <span className="italic">(비어 있음)</span>}
                  </p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            {isOpen && (
              <div className="p-4 pt-0 space-y-3">
                {SUPPORTED_LANGS.map(l => (
                  <div key={l}>
                    <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-2">
                      {LANG_LABEL[l]}
                      {l === editLang && (
                        <span className="text-[9px] bg-black text-white px-1.5 py-0.5 rounded">현재</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={row[l] ?? ''}
                      onChange={e => updateLabel(row.label_key, l, e.target.value)}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
                <button
                  onClick={() => saveLabel(row)}
                  disabled={savingKey === row.label_key}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${
                    savedKey === row.label_key ? 'bg-green-500 text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                  } disabled:opacity-50`}
                >
                  <Save className="w-4 h-4" />
                  {savingKey === row.label_key
                    ? '저장 중...'
                    : savedKey === row.label_key
                    ? '✓ 저장 완료'
                    : '저장'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
