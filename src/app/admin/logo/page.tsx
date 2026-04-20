'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Check } from 'lucide-react';
import { supabase } from '@/lib/api/products';
import { getSiteSetting, setSiteSetting } from '@/lib/api/site-settings';

const BUCKET = 'site-assets';

export default function LogoAdminPage() {
  const [logoUrl, setLogoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const current = await getSiteSetting('logo_url');
      setLogoUrl(current);
      setPreviewUrl(current);
      setIsLoading(false);
    })();
  }, []);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const uploadAndSave = async () => {
    if (!pendingFile || !supabase) return;
    setIsSaving(true);
    try {
      const ext = pendingFile.name.split('.').pop() ?? 'png';
      const path = `logo/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pendingFile, { upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const ok = await setSiteSetting('logo_url', publicUrl);
      if (!ok) throw new Error('저장 실패');
      setLogoUrl(publicUrl);
      setPreviewUrl(publicUrl);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3500);
    } catch (err) {
      console.error(err);
      alert('로고 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!confirm('로고를 삭제하고 기본 텍스트(KOKKOK GARDEN)로 돌아가시겠습니까?')) return;
    setIsSaving(true);
    const ok = await setSiteSetting('logo_url', '');
    if (ok) {
      setLogoUrl('');
      setPreviewUrl('');
      setPendingFile(null);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3500);
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">사이트 로고</h2>
        <p className="text-sm text-gray-500 mb-6">
          상단 좌측에 노출되는 로고 이미지입니다. 업로드하지 않으면 기본 텍스트 &ldquo;KOKKOK GARDEN&rdquo;이 표시됩니다.
        </p>

        <div className="flex items-start gap-6 pb-6 border-b border-gray-100">
          <div className="flex-shrink-0 w-48 h-24 bg-[#111111] rounded flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="logo preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-white text-[18px] font-black tracking-[0.12em] uppercase">KOKKOK<br />GARDEN</span>
            )}
          </div>
          <div className="flex-1 text-sm text-gray-600 space-y-1.5">
            <p><strong className="text-gray-800">권장 규격</strong></p>
            <p>• 가로형 이미지 (예: 600×160px, 투명 배경 PNG 또는 SVG 권장)</p>
            <p>• 최대 2MB · PNG / SVG / WEBP / JPG</p>
            <p>• 어두운 배경 위에 올라가므로 밝은 색상의 로고를 권장합니다.</p>
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFilePick}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />

          <div className="flex gap-3 flex-wrap">
            <button
              disabled={!pendingFile || isSaving}
              onClick={uploadAndSave}
              className="inline-flex items-center gap-2 bg-[#111111] text-white px-6 py-2.5 rounded text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              {isSaving ? '업로드 중...' : '로고 업로드 및 저장'}
            </button>

            {logoUrl && (
              <button
                disabled={isSaving}
                onClick={removeLogo}
                className="inline-flex items-center gap-2 bg-white text-red-600 border border-red-200 px-6 py-2.5 rounded text-sm font-bold tracking-wider hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                로고 삭제 (기본 텍스트로 복구)
              </button>
            )}

            {justSaved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                <Check className="w-4 h-4" /> 저장되었습니다
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 변경 후 반영</p>
        <p>업로드 후 메인 페이지를 새로고침(F5)하면 새로운 로고가 노출됩니다. 문제가 있으면 &ldquo;로고 삭제&rdquo; 버튼으로 언제든 기본 텍스트로 돌아갈 수 있습니다.</p>
      </div>
    </div>
  );
}
