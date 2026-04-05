'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';

export default function Footer() {
  const { t, lang } = useI18n();

  return (
    <footer className="bg-white border-t border-neutral-200 py-16 text-[#333]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row justify-between lg:space-x-12 space-y-12 lg:space-y-0">
          
          {/* Company Info */}
          <div className="flex-1 max-w-sm">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6">KOKKOK GARDEN</h2>
            <div className="space-y-2 text-[13px] text-neutral-500 leading-relaxed break-keep">
              <p>{t('footer.company')}</p>
              <p>{t('footer.rep')}</p>
              <p>{t('footer.bizNum')}</p>
              <p>{t('footer.mailOrder')}</p>
              <p className="mt-4 pt-4 border-t border-neutral-100">{t('footer.copyright')}</p>
            </div>
            <div className="flex space-x-4 mt-6 text-[12px] font-semibold flex-wrap gap-y-2">
              <Link href={`/${lang}/about`} className="hover:underline">{t('footer.about')}</Link>
              <Link href={`/${lang}/terms`} className="hover:underline">{t('footer.terms')}</Link>
              <Link href={`/${lang}/privacy`} className="hover:underline text-black font-bold">{t('footer.privacy')}</Link>
            </div>
          </div>

          {/* Customer Center */}
          <div className="flex-1 lg:pl-12">
            <h3 className="text-[13px] font-bold tracking-widest mb-6">{t('footer.ccTitle')}</h3>
            <div className="text-3xl font-extrabold tracking-tighter mb-4 text-[#111]">1688-9407</div>
            <div className="text-[13px] text-neutral-500 space-y-1">
              <p>{t('footer.ccHours')}</p>
              <p>{t('footer.ccLunch')}</p>
              <p>{t('footer.ccHoliday')}</p>
            </div>
          </div>

          {/* Bank Info */}
          <div className="flex-1 lg:pl-12">
            <h3 className="text-[13px] font-bold tracking-widest mb-6">{t('footer.bankTitle')}</h3>
            <div className="text-[13px] text-neutral-500 space-y-1">
              <p>{t('footer.bankAcc')}</p>
              <p className="mt-4">{t('footer.bankHolder')}</p>
            </div>
            <div className="flex items-center space-x-3 mt-8">
              <a href="#" className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
                <span className="text-[10px] font-bold text-neutral-600">IG</span>
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
                <span className="text-[10px] font-bold text-neutral-600">YT</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
