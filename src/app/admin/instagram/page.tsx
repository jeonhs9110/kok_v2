'use client';

import { PageHeader, LoadingState } from '@/components/admin/CafeWidgets';
import SectionBgCard from '@/components/admin/SectionBgCard';
import InstagramConfigCard from './_components/InstagramConfigCard';
import InstagramHeaderStyleCard from './_components/InstagramHeaderStyleCard';
import InstagramRssCard from './_components/InstagramRssCard';
import InstagramPostsGrid from './_components/InstagramPostsGrid';
import { useInstagram } from './_components/useInstagram';

export default function InstagramAdminPage() {
  const ig = useInstagram();

  if (ig.isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="인스타그램"
        description="@핸들 · 자동 RSS 새로고침 · 홈 메인에 노출되는 포스트를 관리합니다"
      />

      <InstagramConfigCard
        handle={ig.handle}
        description={ig.description}
        isSaving={ig.isSavingConfig}
        onHandleChange={ig.setHandle}
        onDescriptionChange={ig.setDescription}
        onSave={ig.saveConfig}
      />

      <InstagramHeaderStyleCard
        handle={ig.handle}
        fontSize={ig.headerFontSize}
        textColor={ig.headerTextColor}
        bgEnabled={ig.headerBgEnabled}
        bgColor={ig.headerBgColor}
        isSaving={ig.savingHeader}
        showSavedFlash={ig.headerSaved}
        onFontSizeChange={ig.setHeaderFontSize}
        onTextColorChange={ig.setHeaderTextColor}
        onBgEnabledChange={ig.setHeaderBgEnabled}
        onBgColorChange={ig.setHeaderBgColor}
        onSave={ig.saveHeader}
      />

      <SectionBgCard
        value={ig.bg}
        onChange={ig.setBg}
        defaultColor="#ffffff"
        uploadPathPrefix="instagram-bg"
        isSaving={ig.savingBg}
        showSavedFlash={ig.bgSaved}
        onSave={ig.saveBg}
        hint="기본값은 페이지 배경(투명)입니다."
      />

      <InstagramRssCard
        handle={ig.handle}
        rssFeedUrl={ig.rssFeedUrl}
        isRefreshing={ig.isRefreshing}
        refreshMessage={ig.refreshMessage}
        onRssFeedUrlChange={ig.setRssFeedUrl}
        onRefresh={ig.handleRefresh}
      />

      <InstagramPostsGrid
        handle={ig.handle}
        posts={ig.posts}
        uploadingSlot={ig.uploadingSlot}
        savingSlot={ig.savingSlot}
        onUpdatePost={(slot, patch) =>
          ig.setPosts(prev => prev.map((p, i) => (i === slot ? { ...p, ...patch } : p)))
        }
        onSavePost={ig.savePost}
        onDeletePost={ig.deletePost}
        onImageFilePicked={ig.uploadImage}
      />
    </div>
  );
}
