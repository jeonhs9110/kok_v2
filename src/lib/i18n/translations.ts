import type { Lang } from './types';

export type TranslationKey =
  | 'nav.type'
  | 'nav.concern'
  | 'nav.hotdeal'
  | 'nav.review'
  | 'nav.event'
  | 'nav.brand'
  | 'nav.support'
  | 'nav.login'
  | 'nav.cart'
  | 'hero.badge1'
  | 'hero.title1'
  | 'hero.sub1'
  | 'hero.badge2'
  | 'hero.title2'
  | 'hero.sub2'
  | 'section.weeklyBest'
  | 'section.newArrivals'
  | 'section.shorts'
  | 'footer.about'
  | 'footer.terms'
  | 'footer.privacy'
  | 'footer.ccTitle'
  | 'footer.bankTitle'
  | 'product.addToCart'
  | 'product.buyNow'
  | 'product.unavailable'
  | 'chatbot.title'
  | 'chatbot.placeholder'
  | 'chatbot.send'
  | 'chatbot.greeting';

type Translations = Record<TranslationKey, string>;

export const translations: Record<Lang, Translations> = {
  kr: {
    'nav.type': '유형별',
    'nav.concern': '고민별',
    'nav.hotdeal': '핫딜',
    'nav.review': '리뷰',
    'nav.event': '이벤트',
    'nav.brand': '브랜드',
    'nav.support': '고객지원',
    'nav.login': '로그인',
    'nav.cart': '장바구니',
    'hero.badge1': '수분천재 크림',
    'hero.title1': '강력한 고보습 케어\nPDRN 속광 수분 크림',
    'hero.sub1': '사계절 + 속수분 + 수분광 + 모공쫀쫀',
    'hero.badge2': '뷰티 유튜버 PICK',
    'hero.title2': '빛나는 결 보습\n비타민 글로우 세럼',
    'hero.sub2': '미백 + 매끈결 + 투명광채 + 생기충전',
    'section.weeklyBest': '이번주 베스트',
    'section.newArrivals': '신상품',
    'section.shorts': '숏츠',
    'footer.about': '회사소개',
    'footer.terms': '이용약관',
    'footer.privacy': '개인정보처리방침',
    'footer.ccTitle': '고객센터',
    'footer.bankTitle': '계좌정보',
    'product.addToCart': '장바구니',
    'product.buyNow': '구매하기',
    'product.unavailable': '해외 구매 불가',
    'chatbot.title': 'AI 어시스턴트',
    'chatbot.placeholder': '무엇이든 물어보세요...',
    'chatbot.send': '전송',
    'chatbot.greeting': '안녕하세요! 콕콕가든 AI 어시스턴트입니다. 무엇을 도와드릴까요?',
  },
  en: {
    'nav.type': 'By Type',
    'nav.concern': 'By Concern',
    'nav.hotdeal': 'Hot Deals',
    'nav.review': 'Reviews',
    'nav.event': 'Events',
    'nav.brand': 'Brand',
    'nav.support': 'Support',
    'nav.login': 'Login',
    'nav.cart': 'Cart',
    'hero.badge1': 'Hydration Genius Cream',
    'hero.title1': 'Intense Moisture Care\nPDRN Glow Hydration Cream',
    'hero.sub1': 'All-Season + Deep Moisture + Glow + Pore Care',
    'hero.badge2': 'Beauty Youtuber PICK',
    'hero.title2': 'Luminous Skin Moisture\nVitamin Glow Serum',
    'hero.sub2': 'Brightening + Smooth Texture + Clear Radiance + Vitality',
    'section.weeklyBest': 'WEEKLY BEST',
    'section.newArrivals': 'NEW ARRIVALS',
    'section.shorts': 'SHORTS',
    'footer.about': 'About Us',
    'footer.terms': 'Terms of Use',
    'footer.privacy': 'Privacy Policy',
    'footer.ccTitle': 'CUSTOMER CENTER',
    'footer.bankTitle': 'BANK INFO',
    'product.addToCart': 'Add to Cart',
    'product.buyNow': 'Buy Now',
    'product.unavailable': 'Not available in your region',
    'chatbot.title': 'AI Assistant',
    'chatbot.placeholder': 'Ask anything...',
    'chatbot.send': 'Send',
    'chatbot.greeting': 'Hello! I\'m the Kokkok Garden AI Assistant. How can I help you today?',
  },
};

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations['en'][key] ?? key;
}
