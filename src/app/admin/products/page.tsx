'use client';

import { Plus, Trash2, Upload, X, ImageIcon, Pencil } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Product, supabase, MOCK_PRODUCTS } from '@/lib/api/products';
import type { Category } from '@/lib/api/categories';
import { getAllTags, getProductTags, setProductTags, TAG_CATEGORIES, type IngredientTag } from '@/lib/api/ingredient-tags';
import RichEditor from '@/components/admin/RichEditor';

const BUCKET = 'product-images';

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<IngredientTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    summary: '',
    ingredient: '',
    price: '',
    originalPrice: '',
    imageUrl: '',       // final URL after upload or manual entry
    imageFile: null as File | null,
    description: '',
    detailBody: '',
    naverStoreUrl: '',
    categoryId: '',
    subcategoryId: '',
    isBestSeller: false,
    showCartButton: false,
    showBuyButton: false,
  });

  const fetchCategories = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
    if (data) setCategories(data);
  }, []);

  useEffect(() => {
    fetchAll();
    fetchCategories();
    getAllTags().then(setAllTags).catch(() => {});
  }, [fetchCategories]);

  async function fetchAll() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('클라이언트 없음');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data.map(d => ({
        id: d.id,
        name: d.name,
        summary: d.summary || '',
        ingredient: d.ingredient || '',
        description: d.description || '',
        detailBody: d.detail_body || '',
        price: Number(d.price),
        originalPrice: Number(d.original_price || d.price),
        imageUrl: (d.images && d.images.length > 0) ? d.images[0] : '',
        is_active: d.is_active,
        is_best_seller: d.is_best_seller ?? false,
        naver_store_url: d.naver_store_url || '',
        category_id: d.category_id || undefined,
        subcategory_id: d.subcategory_id || undefined,
        show_cart_button: d.show_cart_button ?? false,
        show_buy_button: d.show_buy_button ?? false,
      })));
    } catch {
      console.warn('DB 연결 실패. 목업 데이터로 전환.');
      setProducts(MOCK_PRODUCTS);
    } finally {
      setIsLoading(false);
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setFormData(prev => ({ ...prev, imageFile: file, imageUrl: '' }));
    setUploadProgress('idle');
  };

  const uploadImageToSupabase = async (file: File): Promise<string> => {
    if (!supabase) throw new Error('Supabase 클라이언트 없음');
    setUploadProgress('uploading');

    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setUploadProgress('error');
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    setUploadProgress('done');
    return urlData.publicUrl;
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    try {
      if (!supabase) throw new Error('클라이언트 없음');
      await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
    } catch {
      console.warn('토글 DB 동기화 실패');
    }
  };

  const handleDelete = async (id: string) => {
    setProducts(products.filter(p => p.id !== id));
    try {
      if (!supabase) throw new Error('클라이언트 없음');
      await supabase.from('products').delete().eq('id', id);
    } catch {
      console.warn('삭제 DB 동기화 실패');
    }
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', summary: '', ingredient: '', price: '', originalPrice: '', imageUrl: '', imageFile: null, description: '', detailBody: '', naverStoreUrl: '', categoryId: '', subcategoryId: '', isBestSeller: false, showCartButton: false, showBuyButton: false });
    setSelectedTagIds([]);
    setPreviewUrl('');
    setUploadProgress('idle');
    setIsSubmitting(false);
  };

  const openEdit = async (item: Product) => {
    setEditingId(item.id);
    try {
      const tags = await getProductTags(item.id);
      setSelectedTagIds(tags);
    } catch {
      setSelectedTagIds([]);
    }
    setFormData({
      name: item.name,
      summary: item.summary,
      ingredient: item.ingredient,
      price: String(item.price),
      originalPrice: String(item.originalPrice),
      imageUrl: item.imageUrl,
      imageFile: null,
      description: item.description,
      detailBody: item.detailBody || '',
      naverStoreUrl: item.naver_store_url || '',
      categoryId: item.category_id || '',
      subcategoryId: item.subcategory_id || '',
      isBestSeller: item.is_best_seller ?? false,
      showCartButton: item.show_cart_button ?? false,
      showBuyButton: item.show_buy_button ?? false,
    });
    setPreviewUrl(item.imageUrl);
    setIsModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let finalImageUrl = formData.imageUrl;

      // If a file was selected, try to upload (skip on failure)
      if (formData.imageFile) {
        try {
          finalImageUrl = await uploadImageToSupabase(formData.imageFile);
        } catch (uploadErr) {
          console.warn('이미지 업로드 실패, 상품은 이미지 없이 저장합니다:', uploadErr);
          finalImageUrl = '';
        }
      }

      const newProduct: Product = {
        id: Date.now().toString(),
        name: formData.name,
        summary: formData.summary,
        ingredient: formData.ingredient,
        price: Number(formData.price),
        originalPrice: Number(formData.originalPrice || formData.price),
        imageUrl: finalImageUrl,
        description: formData.description,
        detailBody: formData.detailBody,
        is_active: true,
        is_best_seller: formData.isBestSeller,
        naver_store_url: formData.naverStoreUrl || undefined,
        show_cart_button: formData.showCartButton,
        show_buy_button: formData.showBuyButton,
      };

      const dbPayload = {
        name: formData.name,
        summary: formData.summary,
        ingredient: formData.ingredient,
        price: Number(formData.price),
        original_price: Number(formData.originalPrice || formData.price),
        description: formData.description,
        detail_body: formData.detailBody,
        images: finalImageUrl ? [finalImageUrl] : [],
        naver_store_url: formData.naverStoreUrl || null,
        category_id: formData.categoryId || null,
        subcategory_id: formData.subcategoryId || null,
        is_best_seller: formData.isBestSeller,
        show_cart_button: formData.showCartButton,
        show_buy_button: formData.showBuyButton,
      };

      let persistedId = editingId;
      if (editingId) {
        // UPDATE existing product
        setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...newProduct } : p));
        if (supabase) {
          const { error } = await supabase.from('products').update(dbPayload).eq('id', editingId);
          if (error) throw error;
        }
      } else {
        // INSERT new product
        setProducts(prev => [newProduct, ...prev]);
        if (supabase) {
          const { data, error } = await supabase
            .from('products')
            .insert([{ ...dbPayload, is_active: true }])
            .select('id')
            .single();
          if (error) throw error;
          persistedId = (data as { id: string } | null)?.id ?? null;
        }
      }

      // Persist ingredient-tag associations
      if (persistedId) {
        try {
          await setProductTags(persistedId, selectedTagIds);
        } catch (tagErr) {
          console.warn('태그 저장 실패 (상품은 저장됨):', tagErr);
        }
      }

      if (supabase) await fetchAll();

      resetModal();
    } catch (err) {
      console.error('상품 저장 실패:', err);
      alert('상품 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">상품 재고</h2>
          <p className="text-sm text-gray-500 mt-1">스토어 상품 및 카탈로그를 관리하세요</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#111111] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 상품 추가
        </button>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 font-bold tracking-widest">불러오는 중...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">등록된 상품이 없습니다</p>
            <p className="text-xs mt-1">상단의 상품 추가 버튼을 눌러 첫 상품을 등록하세요</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6 w-16">ID</th>
                <th className="p-4">상품 개요</th>
                <th className="p-4">가격</th>
                <th className="p-4">성분</th>
                <th className="p-4">구매 링크</th>
                <th className="p-4">상태</th>
                <th className="p-4 pr-6 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="p-4 pl-6 text-gray-400 text-xs truncate max-w-[80px]" title={item.id}>...{item.id.slice(-6)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                        {item.imageUrl
                          ? <img src={item.imageUrl} className="w-full h-full object-cover mix-blend-multiply" alt="" />
                          : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                          {item.is_best_seller && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded tracking-wide uppercase">Best</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.summary}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 text-sm font-bold">{item.price.toLocaleString()}원</td>
                  <td className="p-4 text-gray-600 font-mono text-[11px]">{item.ingredient}</td>
                  <td className="p-4">
                    {item.naver_store_url ? (
                      <a href={item.naver_store_url} target="_blank" rel="noopener noreferrer" className="inline-flex px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded tracking-wide hover:bg-green-100 transition-colors">
                        네이버
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300">미설정</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggle(item.id, item.is_active)}
                      className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                        item.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                    >
                      {item.is_active ? '게시중' : '숨김'}
                    </button>
                  </td>
                  <td className="p-4 pr-6 text-right flex gap-1.5 justify-end">
                    <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100">
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 상품 추가 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">{editingId ? '상품 수정' : '새 상품 추가'}</h3>
              <button onClick={resetModal} className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 overflow-y-auto space-y-5">

              {/* Image upload zone */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상품 이미지</label>
                
                <div
                  className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
                    previewUrl ? 'border-gray-200' : 'border-gray-200 hover:border-gray-400'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <div className="relative">
                      <img
                        src={previewUrl}
                        alt="미리보기"
                        className="w-full h-52 object-contain rounded-xl bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewUrl('');
                          setFormData(prev => ({ ...prev, imageFile: null, imageUrl: '' }));
                          setUploadProgress('idle');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {uploadProgress === 'uploading' && (
                        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                          <div className="text-sm text-gray-700 font-semibold animate-pulse">업로드 중...</div>
                        </div>
                      )}
                      {uploadProgress === 'done' && (
                        <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                          ✓ 업로드 완료
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                      <Upload className="w-8 h-8 mb-2" />
                      <p className="text-sm font-semibold">클릭하여 이미지 업로드</p>
                      <p className="text-xs mt-1">JPG, PNG, WEBP — 최대 10MB</p>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Fallback: manual URL entry */}
                {!formData.imageFile && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[10px] text-gray-400 font-semibold">또는 URL 직접 입력</span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                )}
                {!formData.imageFile && (
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
                      setPreviewUrl(e.target.value);
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                  />
                )}
              </div>

              {/* Product Name + Ingredient */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상품명 *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                    placeholder="예: 레티놀 바운스 세럼"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">성분 태그</label>
                  <input
                    type="text"
                    value={formData.ingredient}
                    onChange={e => setFormData(prev => ({ ...prev, ingredient: e.target.value }))}
                    className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                    placeholder="예: CICA"
                  />
                </div>
              </div>

              {/* Category + Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">카테고리</label>
                  <select
                    value={formData.categoryId}
                    onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value, subcategoryId: '' }))}
                    className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                  >
                    <option value="">선택 안 함</option>
                    {categories.filter(c => !c.parent_id).map(c => (
                      <option key={c.id} value={c.id}>{c.name?.kr || c.slug}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">서브카테고리</label>
                  <select
                    value={formData.subcategoryId}
                    onChange={e => setFormData(prev => ({ ...prev, subcategoryId: e.target.value }))}
                    disabled={!formData.categoryId}
                    className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none disabled:opacity-40"
                  >
                    <option value="">선택 안 함</option>
                    {categories.filter(c => c.parent_id === formData.categoryId).map(c => (
                      <option key={c.id} value={c.id}>{c.name?.kr || c.slug}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">한 줄 요약 *</label>
                <input
                  required
                  type="text"
                  value={formData.summary}
                  onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                  placeholder="끈적임없이 촉촉한 기능성 세럼"
                />
              </div>

              {/* Price */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">현재 판매가 (원) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.price}
                      onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                      placeholder="23400"
                    />
                    <p className="text-[10px] text-gray-400 leading-snug">실제로 결제되는 가격입니다.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">할인 전 가격 (취소선)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.originalPrice}
                      onChange={e => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                      className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                      placeholder="예: 26000 (판매가보다 높게)"
                    />
                    <p className="text-[10px] text-gray-400 leading-snug">
                      <strong className="text-gray-600">현재 판매가보다 높을 때만</strong> 취소선으로 표시됩니다. 할인 없으면 비워두세요.
                    </p>
                  </div>
                </div>

                {formData.price && (() => {
                  const p = Number(formData.price) || 0;
                  const op = Number(formData.originalPrice) || 0;
                  const hasDiscount = op > p;
                  const hasBackwardsInput = op > 0 && op <= p;
                  const discountPct = hasDiscount ? Math.round(((op - p) / op) * 100) : 0;
                  return (
                    <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4">
                      <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2.5">
                        사이트 미리보기
                      </p>
                      <div className="flex items-end gap-3 flex-wrap">
                        {hasDiscount && (
                          <span className="text-[#f15a24] font-bold text-base mb-0.5 tracking-tight">{discountPct}%</span>
                        )}
                        <span className="text-2xl font-extrabold tracking-tight text-[#111]">
                          {p.toLocaleString()}<span className="text-base font-bold ml-0.5">원</span>
                        </span>
                        {hasDiscount && (
                          <span className="text-neutral-400 line-through text-sm font-medium mb-1">
                            {op.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      {hasBackwardsInput && (
                        <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-2 leading-relaxed">
                          <span className="font-bold shrink-0">⚠</span>
                          <span>
                            할인 전 가격({op.toLocaleString()}원)이 현재 판매가({p.toLocaleString()}원)보다 높지 않아 취소선이 표시되지 않습니다.
                            두 값을 바꾸셨거나, 할인이 없는 경우 할인 전 가격을 비워두세요.
                          </span>
                        </div>
                      )}
                      {!hasDiscount && !hasBackwardsInput && (
                        <p className="text-[10px] text-gray-400 mt-2">할인 표시 없이 판매가만 노출됩니다.</p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">한 줄 설명</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none resize-none"
                  placeholder="상품의 주요 특징과 성분을 설명해주세요..."
                />
              </div>

              {/* Detail body (rich content for the product detail page) */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상세페이지 콘텐츠</label>
                  <span className="text-[10px] text-gray-400">이미지 · 텍스트 섞어서 작성 (붙여넣기 / 드래그 지원)</span>
                </div>
                <RichEditor
                  content={formData.detailBody}
                  onChange={html => setFormData(prev => ({ ...prev, detailBody: html }))}
                  uploadPath="product-detail"
                  minHeight={320}
                />
                <p className="text-[10px] text-gray-400 mt-1">상세페이지 하단에 렌더링됩니다. 긴 이미지 한 장만 올리셔도 되고, 중간에 설명 글을 섞어 작성해도 됩니다.</p>
              </div>

              {/* Naver Store URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">네이버 스토어 URL</label>
                <input
                  type="url"
                  value={formData.naverStoreUrl}
                  onChange={e => setFormData(prev => ({ ...prev, naverStoreUrl: e.target.value }))}
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                  placeholder="https://smartstore.naver.com/kokkok-garden/products/..."
                />
                <p className="text-[10px] text-gray-400 mt-1">입력하면 고객이 구매하기 클릭 시 네이버 스토어로 이동합니다. 비워두면 자체 결제(추후 KCP)로 연결됩니다.</p>
              </div>

              {/* Best Seller toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isBestSeller"
                  checked={formData.isBestSeller}
                  onChange={e => setFormData(prev => ({ ...prev, isBestSeller: e.target.checked }))}
                  className="w-4 h-4 accent-[#00693A] cursor-pointer"
                />
                <label htmlFor="isBestSeller" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  Best Seller로 홈페이지에 노출 (최대 3개)
                </label>
              </div>

              {/* Ingredient tag picker */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">성분 태그</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    상품 상세 페이지에 표시됩니다. 관리 → &ldquo;성분 태그&rdquo;에서 태그를 먼저 추가하세요.
                  </p>
                </div>
                {allTags.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">등록된 태그가 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {TAG_CATEGORIES.map(cat => {
                      const catTags = allTags.filter(t => t.category === cat.value && t.is_active);
                      if (catTags.length === 0) return null;
                      return (
                        <div key={cat.value} className="bg-gray-50/50 rounded p-3">
                          <p className="text-[10px] font-bold tracking-wider text-gray-600 mb-2">{cat.label_kr}</p>
                          <div className="flex flex-wrap gap-2">
                            {catTags.map(t => {
                              const checked = selectedTagIds.includes(t.id);
                              return (
                                <button
                                  type="button"
                                  key={t.id}
                                  onClick={() => setSelectedTagIds(prev => checked ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                                    checked
                                      ? 'bg-[#111] text-white border-[#111]'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {t.name.kr || t.name.en || '—'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Purchase button visibility toggles */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">구매 버튼 노출 설정</p>
                <p className="text-[11px] text-gray-400">기본값: 네이버 스토어 버튼만 노출됩니다. 아래를 켜면 추가로 노출됩니다.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showCartButton"
                    checked={formData.showCartButton}
                    onChange={e => setFormData(prev => ({ ...prev, showCartButton: e.target.checked }))}
                    className="w-4 h-4 accent-[#00693A] cursor-pointer"
                  />
                  <label htmlFor="showCartButton" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                    장바구니 버튼 노출
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showBuyButton"
                    checked={formData.showBuyButton}
                    onChange={e => setFormData(prev => ({ ...prev, showBuyButton: e.target.checked }))}
                    className="w-4 h-4 accent-[#00693A] cursor-pointer"
                  />
                  <label htmlFor="showBuyButton" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                    구매하기 버튼 노출
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#111111] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : editingId ? '수정 저장' : '상품 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
