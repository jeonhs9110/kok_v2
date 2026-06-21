'use client';

import SiteLogoCard from './_components/SiteLogoCard';
import LogoSizeCard from './_components/LogoSizeCard';
import BackgroundMediaCard from './_components/BackgroundMediaCard';
import LogoPreviewPane from './_components/LogoPreviewPane';
import { useLogo } from './_components/useLogo';

export default function LogoAdminPage() {
  const l = useLogo();

  if (l.isLoading) {
    return <div className="p-8 text-sm text-[#6b7280]">불러오는 중...</div>;
  }

  return (
    <div className={l.isEmbedded ? 'block' : 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6'}>
      {/* Controls pane (left) */}
      <div className="space-y-6 min-w-0">
        <SiteLogoCard
          logoPreview={l.logoPreview}
          logoUrl={l.logoUrl}
          hasPending={!!l.logoPending}
          isSaving={l.logoSaving}
          showSavedFlash={l.logoSavedFlash}
          onPickFile={l.handleLogoPick}
          onUpload={l.uploadLogo}
          onDelete={l.removeLogo}
        />

        <LogoSizeCard
          tokens={l.tokens}
          setTokens={l.setTokens}
          savedTokens={l.savedTokens}
          isDirty={l.tokensDirty}
          isSaving={l.tokensSaving}
          onSave={l.handleTokensSave}
        />

        <BackgroundMediaCard
          backgrounds={l.bg.backgrounds}
          bgPending={l.bg.bgPending}
          bgUploading={l.bg.bgUploading}
          bgBusyId={l.bg.bgBusyId}
          accept={l.bg.accept}
          onPickFile={l.bg.handleBgPick}
          onUpload={l.bg.uploadBackground}
          onActivate={l.bg.activateBackground}
          onDeactivate={l.bg.deactivateBackground}
          onToggleScrollDriven={l.bg.toggleScrollDriven}
          onDelete={l.bg.deleteBackground}
        />
      </div>

      {/* Live preview pane (right) — hidden in embedded mode. The hub
          shows the live preview in its central iframe instead, fed by
          the bubbled-up postMessage tokens above. */}
      {!l.isEmbedded && (
        <LogoPreviewPane
          iframeKey={l.iframeKey}
          iframeRef={l.iframeRef}
          onReload={l.reloadIframe}
        />
      )}
    </div>
  );
}
