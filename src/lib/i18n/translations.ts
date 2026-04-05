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
  | 'footer.company'
  | 'footer.rep'
  | 'footer.bizNum'
  | 'footer.mailOrder'
  | 'footer.copyright'
  | 'footer.about'
  | 'footer.terms'
  | 'footer.privacy'
  | 'footer.ccTitle'
  | 'footer.ccHours'
  | 'footer.ccLunch'
  | 'footer.ccHoliday'
  | 'footer.bankTitle'
  | 'footer.bankAcc'
  | 'footer.bankHolder'
  | 'product.addToCart'
  | 'product.buyNow'
  | 'product.unavailable'
  | 'coupon.newMember'
  | 'chatbot.title'
  | 'chatbot.placeholder'
  | 'chatbot.send'
  | 'chatbot.greeting'
  | 'promo.message'
  | 'promo.hideToday';

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
    'footer.company': '상호: 콕콕가든',
    'footer.rep': '대표: 관리자 | 전화: 1688-9407',
    'footer.bizNum': '사업자등록번호: 123-45-67890',
    'footer.mailOrder': '통신판매업신고번호: 제 2026-서울강남-1234 호',
    'footer.copyright': '© KOKKOK GARDEN All Rights Reserved.',
    'footer.about': '회사소개',
    'footer.terms': '이용약관',
    'footer.privacy': '개인정보처리방침',
    'footer.ccTitle': '고객센터',
    'footer.ccHours': '평일 10:00 - 17:00',
    'footer.ccLunch': '점심 12:00 - 13:00',
    'footer.ccHoliday': '주말 및 공휴일 휴무',
    'footer.bankTitle': '계좌정보',
    'footer.bankAcc': '국민은행 123456-78-901234',
    'footer.bankHolder': '예금주: 콕콕가든',
    'product.addToCart': '장바구니',
    'product.buyNow': '구매하기',
    'product.unavailable': '해외 구매 불가',
    'coupon.newMember': '신규회원 5,000원 쿠폰',
    'chatbot.title': 'AI 어시스턴트',
    'chatbot.placeholder': '무엇이든 물어보세요...',
    'chatbot.send': '전송',
    'chatbot.greeting': '안녕하세요! 콕콕가든 AI 어시스턴트입니다. 무엇을 도와드릴까요?',
    'promo.message': '지금 가입하고 첫구매 혜택 받아가세요!',
    'promo.hideToday': '오늘 하루 보지 않기',
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
    'footer.company': 'Company: Kokkok Garden',
    'footer.rep': 'CEO: Admin | Tel: 1688-9407',
    'footer.bizNum': 'Business Reg. No.: 123-45-67890',
    'footer.mailOrder': 'Mail-Order Reg.: 2026-Seoul Gangnam-1234',
    'footer.copyright': '© KOKKOK GARDEN All Rights Reserved.',
    'footer.about': 'About Us',
    'footer.terms': 'Terms of Use',
    'footer.privacy': 'Privacy Policy',
    'footer.ccTitle': 'CUSTOMER CENTER',
    'footer.ccHours': 'Weekdays 10:00 - 17:00',
    'footer.ccLunch': 'Lunch 12:00 - 13:00',
    'footer.ccHoliday': 'Closed on weekends & holidays',
    'footer.bankTitle': 'BANK INFO',
    'footer.bankAcc': 'Kookmin Bank 123456-78-901234',
    'footer.bankHolder': 'Account Holder: Kokkok Garden',
    'product.addToCart': 'Add to Cart',
    'product.buyNow': 'Buy Now',
    'product.unavailable': 'Not available in your region',
    'coupon.newMember': 'New Member 5,000 KRW Coupon',
    'chatbot.title': 'AI Assistant',
    'chatbot.placeholder': 'Ask anything...',
    'chatbot.send': 'Send',
    'chatbot.greeting': 'Hello! I\'m the Kokkok Garden AI Assistant. How can I help you today?',
    'promo.message': 'Sign up now and get your first purchase benefit!',
    'promo.hideToday': 'Don\'t show today',
  },
};

export function t(lang: Lang, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations['en'][key] ?? key;
}
