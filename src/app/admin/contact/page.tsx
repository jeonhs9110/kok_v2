'use client';

import { useEffect, useState } from 'react';
import { Save, Check } from 'lucide-react';
import { getSiteSettings, setSiteSettings, type SiteSettingKey } from '@/lib/api/site-settings';

interface ContactForm {
  contact_hours: string;
  contact_address: string;
  contact_phone: string;
  contact_email: string;
  contact_overseas_email: string;
}

const KEYS: SiteSettingKey[] = [
  'contact_hours',
  'contact_address',
  'contact_phone',
  'contact_email',
  'contact_overseas_email',
];

const FIELD_META: { key: keyof ContactForm; label: string; placeholder: string; type?: string; multiline?: boolean }[] = [
  { key: 'contact_hours',          label: '운영 시간',           placeholder: '예: 평일 08:00–18:00 / 점심시간 12:30–13:30', multiline: true },
  { key: 'contact_address',        label: '주소',                placeholder: '예: 서울특별시 강남구 연주로 538 5F',              multiline: true },
  { key: 'contact_phone',          label: '대표 번호',           placeholder: '예: 070-4131-5906' },
  { key: 'contact_email',          label: '대표 이메일',         placeholder: '예: abib@fourco.co.kr', type: 'email' },
  { key: 'contact_overseas_email', label: '해외 문의 (이메일)',  placeholder: '예: global@kokkok.garden', type: 'email' },
];

export default function ContactAdminPage() {
  const [form, setForm] = useState<ContactForm>({
    contact_hours: '', contact_address: '', contact_phone: '', contact_email: '', contact_overseas_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const values = await getSiteSettings(KEYS);
      setForm({
        contact_hours: values.contact_hours ?? '',
        contact_address: values.contact_address ?? '',
        contact_phone: values.contact_phone ?? '',
        contact_email: values.contact_email ?? '',
        contact_overseas_email: values.contact_overseas_email ?? '',
      });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const ok = await setSiteSettings({ ...form });
    setSaving(false);
    if (!ok) {
      alert('저장에 실패했습니다. site_settings 테이블 마이그레이션이 실행되었는지 확인해주세요.');
      return;
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3500);
  };

  if (loading) return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">고객센터 정보</h2>
          <p className="text-sm text-gray-500 mt-1">
            Contact 페이지와 푸터 등에 노출되는 회사 연락처 정보입니다. 비워두면 해당 항목은 표시되지 않습니다.
          </p>
        </div>

        <div className="space-y-4">
          {FIELD_META.map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase block mb-1.5">
                {f.label}
              </label>
              {f.multiline ? (
                <textarea
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-y"
                />
              ) : (
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#111111] text-white px-6 py-2.5 rounded text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
          {justSaved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold">
              <Check className="w-4 h-4" /> 저장되었습니다
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">💡 다국어 안내</p>
        <p>
          연락처 항목 값(예: 주소, 운영시간)은 단일 값으로 저장되며 모든 언어에서 동일하게 노출됩니다.
          각 항목의 <strong>레이블</strong>(&ldquo;Operating Hours&rdquo;, &ldquo;Address&rdquo; 등)은 페이지에서 자동 번역됩니다.
        </p>
      </div>
    </div>
  );
}
