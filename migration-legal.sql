-- ============================================================
-- KOKKOK GARDEN V2 — Legal, Business Info, Cookie Consent
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Legal pages content (admin-editable terms, privacy, etc.)
CREATE TABLE IF NOT EXISTS public.legal_pages (
  id serial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title_kr text DEFAULT '',
  title_en text DEFAULT '',
  content_kr text DEFAULT '',
  content_en text DEFAULT '',
  is_published boolean DEFAULT true,
  updated_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read legal_pages" ON public.legal_pages FOR SELECT USING (true);
CREATE POLICY "Admin write legal_pages" ON public.legal_pages
  FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Seed default legal pages with Korean law-compliant content
INSERT INTO public.legal_pages (slug, title_kr, title_en, content_kr, content_en) VALUES
('terms', '이용약관', 'Terms of Service',
'제 1 조 (목적)
이 약관은 콕콕가든(이하 "회사")이 운영하는 인터넷 쇼핑몰(이하 "몰")에서 제공하는 인터넷 관련 서비스를 이용함에 있어 사이버몰과 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제 2 조 (정의)
① "몰"이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 또는 용역을 거래할 수 있도록 설정한 가상의 영업장을 말합니다.
② "이용자"란 "몰"에 접속하여 이 약관에 따라 "몰"이 제공하는 서비스를 받는 회원 및 비회원을 말합니다.
③ "회원"이라 함은 "몰"에 개인정보를 제공하여 회원등록을 한 자로서 "몰"의 정보를 지속적으로 제공받으며, "몰"이 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.

제 3 조 (약관의 명시와 설명 및 개정)
① "몰"은 이 약관의 내용과 상호 및 대표자 성명, 영업소 소재지 주소, 전화번호, 전자우편주소, 사업자등록번호, 통신판매업 신고번호 등을 이용자가 쉽게 알 수 있도록 "몰"의 초기 서비스화면에 게시합니다.
② "몰"은 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」, 「전자문서 및 전자거래기본법」, 「전자금융거래법」, 「전자서명법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「소비자기본법」 등 관련법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.

제 4 조 (서비스의 제공 및 변경)
① "몰"은 다음과 같은 업무를 수행합니다.
  1. 재화 또는 용역에 대한 정보 제공 및 구매계약의 체결
  2. 구매계약이 체결된 재화 또는 용역의 배송
  3. 기타 "몰"이 정하는 업무

제 5 조 (서비스의 중단)
① "몰"은 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.

제 6 조 (회원가입)
① 이용자는 "몰"이 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.
② "몰"은 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각호에 해당하지 않는 한 회원으로 등록합니다.

제 7 조 (회원 탈퇴 및 자격 상실 등)
① 회원은 "몰"에 언제든지 탈퇴를 요청할 수 있으며 "몰"은 즉시 회원탈퇴를 처리합니다.
② 회원이 다음 각호의 사유에 해당하는 경우, "몰"은 회원자격을 제한 및 정지시킬 수 있습니다.

제 8 조 (구매신청)
"몰" 이용자는 "몰"상에서 다음 또는 이와 유사한 방법에 의하여 구매를 신청하며, "몰"은 이용자가 구매신청을 함에 있어서 다음의 각 내용을 알기 쉽게 제공하여야 합니다.

제 9 조 (청약철회 등)
① "몰"과 재화 등의 구매에 관한 계약을 체결한 이용자는 수신확인의 통지를 받은 날부터 7일 이내에는 청약의 철회를 할 수 있습니다.
② 이용자는 재화 등을 배송받은 경우 다음 각호의 1에 해당하는 경우에는 반품 및 교환을 할 수 없습니다.
  1. 이용자에게 책임있는 사유로 재화 등이 멸실 또는 훼손된 경우
  2. 이용자의 사용 또는 일부 소비에 의하여 재화 등의 가치가 현저히 감소한 경우

제 10 조 (개인정보보호)
① "몰"은 이용자의 정보수집시 구매계약 이행에 필요한 최소한의 정보를 수집합니다.
② "몰"은 이용자의 개인정보를 수집·이용하는 때에는 당해 이용자에게 그 목적을 고지하고 동의를 받습니다.

부칙
이 약관은 2026년 4월 1일부터 시행합니다.',

'Article 1 (Purpose)
These Terms of Service govern the rights, obligations, and responsibilities between KOKKOK Garden (hereinafter "Company") and users in relation to the use of internet-related services provided by the Company''s online store.

Article 2 (Definitions)
① "Store" refers to the virtual marketplace established by the Company using information and communication facilities to enable transactions of goods or services.
② "User" refers to members and non-members who access the Store and receive services provided by the Store in accordance with these Terms.
③ "Member" refers to a person who has registered as a member by providing personal information to the Store.

Article 3 (Posting, Explanation, and Amendment of Terms)
① The Store shall post the contents of these Terms, company name, representative''s name, business address, phone number, email address, business registration number, and mail-order business registration number in a manner easily accessible to users.

Article 4 (Provision and Modification of Services)
① The Store performs the following tasks:
  1. Providing information about goods or services and concluding purchase contracts
  2. Delivering goods or services for which purchase contracts have been concluded
  3. Other tasks determined by the Store

Article 5 (Withdrawal of Subscription)
① Users who have concluded a purchase contract may withdraw their subscription within 7 days from the date of receiving confirmation of receipt.
② Users cannot return or exchange goods in the following cases:
  1. When goods are lost or damaged due to reasons attributable to the user
  2. When the value of goods has significantly decreased due to use or partial consumption by the user

Article 6 (Privacy Protection)
① The Store collects the minimum information necessary for the performance of purchase contracts.
② The Store notifies users of the purpose and obtains consent when collecting and using personal information.

Supplementary Provisions
These Terms shall be effective from April 1, 2026.'),

('privacy', '개인정보처리방침', 'Privacy Policy',
'콕콕가든(이하 "회사")은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.

제 1 조 (개인정보의 처리 목적)
회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
① 회원 가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지
② 재화 또는 서비스 제공: 물품배송, 서비스 제공, 계약서·청구서 발송, 콘텐츠 제공, 맞춤서비스 제공
③ 마케팅 및 광고에의 활용: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공

제 2 조 (개인정보의 처리 및 보유기간)
① 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.
  - 회원가입 정보: 회원 탈퇴 시까지 (탈퇴 후 5일 이내 파기)
  - 전자상거래 거래기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)
  - 소비자 불만 또는 분쟁처리에 관한 기록: 3년

제 3 조 (처리하는 개인정보의 항목)
회사는 다음의 개인정보 항목을 처리하고 있습니다.
① 필수항목: 이메일, 비밀번호, 이름, 전화번호, 성별, 생년월일, 국가
② 선택항목: 피부 타입, 마케팅 수신 동의
③ 자동수집항목: IP주소, 쿠키, 방문일시, 서비스 이용기록

제 4 조 (개인정보의 제3자 제공)
회사는 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.

제 5 조 (개인정보의 파기)
① 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
② 파기의 절차 및 방법은 다음과 같습니다.
  - 전자적 파일: 복원이 불가능한 방법으로 영구 삭제
  - 기록물, 인쇄물: 분쇄기로 분쇄하거나 소각

제 6 조 (정보주체의 권리·의무)
① 정보주체는 회사에 대해 언제든지 다음의 권리를 행사할 수 있습니다.
  1. 개인정보 열람 요구
  2. 오류 등이 있을 경우 정정 요구
  3. 삭제 요구
  4. 처리정지 요구
② 권리 행사는 회사에 서면, 전자우편 등을 통하여 할 수 있으며, 회사는 이에 대해 지체없이 조치하겠습니다.

제 7 조 (개인정보의 안전성 확보조치)
회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
① 관리적 조치: 내부관리계획 수립·시행, 개인정보 취급 직원의 최소화
② 기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 개인정보의 암호화, 보안프로그램 설치
③ 물리적 조치: 전산실, 자료보관실 등의 접근통제

제 8 조 (쿠키의 운영)
① 회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 쿠키(cookie)를 사용합니다.
② 이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.

제 9 조 (개인정보 보호책임자)
회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
  - 개인정보 보호책임자: [관리자 페이지에서 설정]
  - 연락처: [관리자 페이지에서 설정]
  - 이메일: [관리자 페이지에서 설정]

제 10 조 (개인정보 처리방침 변경)
이 개인정보 처리방침은 2026년 4월 1일부터 적용됩니다.
변경 사항이 있는 경우 시행일 7일 전부터 홈페이지를 통해 공지하겠습니다.',

'KOKKOK Garden (hereinafter "Company") establishes and discloses this Privacy Policy in accordance with Article 30 of the Personal Information Protection Act to protect the personal information of data subjects and to handle related complaints promptly.

Article 1 (Purpose of Processing Personal Information)
The Company processes personal information for the following purposes:
① Member registration and management: Confirming membership intention, identification and authentication, maintaining membership, preventing fraudulent use
② Providing goods or services: Product delivery, service provision, sending contracts and invoices, providing customized services
③ Marketing: Developing new services, providing event and promotional information

Article 2 (Processing and Retention Period)
① The Company processes and retains personal information within the retention period consented to by the data subject or as required by law.
② Retention periods:
  - Membership information: Until membership withdrawal (destroyed within 5 days after withdrawal)
  - E-commerce transaction records: 5 years (Consumer Protection Act)
  - Consumer complaint records: 3 years

Article 3 (Personal Information Items Processed)
① Required: Email, password, name, phone number, gender, date of birth, country
② Optional: Skin type, marketing consent
③ Automatically collected: IP address, cookies, visit history, service usage records

Article 4 (Provision to Third Parties)
The Company only provides personal information to third parties in cases specified under Articles 17 and 18 of the Personal Information Protection Act, such as with consent from the data subject or as required by law.

Article 5 (Destruction of Personal Information)
① The Company destroys personal information without delay when it becomes unnecessary.
② Methods: Electronic files are permanently deleted; printed materials are shredded or incinerated.

Article 6 (Rights of Data Subjects)
① Data subjects may exercise the following rights at any time:
  1. Request to view personal information
  2. Request correction of errors
  3. Request deletion
  4. Request to suspend processing
② Rights may be exercised via written request or email.

Article 7 (Security Measures)
The Company takes the following measures to ensure the safety of personal information:
① Administrative: Establishing and implementing internal management plans
② Technical: Access control systems, encryption of personal information, security software
③ Physical: Access control to server rooms and data storage facilities

Article 8 (Cookies)
① The Company uses cookies to provide personalized services.
② Users can refuse cookie storage through web browser settings.

Article 9 (Data Protection Officer)
The Company designates a Data Protection Officer for handling complaints related to personal information processing.
  - Contact: [Set in Admin Page]
  - Email: [Set in Admin Page]

Article 10 (Changes to Privacy Policy)
This Privacy Policy is effective from April 1, 2026.
Any changes will be announced on the website at least 7 days before implementation.

GDPR Notice (for EU/EEA Users):
If you are located in the European Economic Area, you have additional rights including:
- Right to data portability
- Right to be forgotten
- Right to lodge a complaint with a supervisory authority
To exercise these rights, contact us at the email provided above.
We only use this information to assist with your inquiry and send relevant updates. You can opt out anytime.')
ON CONFLICT (slug) DO NOTHING;

-- 2. Business info config (admin-editable footer info)
CREATE TABLE IF NOT EXISTS public.business_info (
  id integer PRIMARY KEY DEFAULT 1,
  company_name_kr text DEFAULT '콕콕가든',
  company_name_en text DEFAULT 'Kokkok Garden',
  ceo_name text DEFAULT '',
  business_reg_number text DEFAULT '',
  mail_order_number text DEFAULT '',
  address_kr text DEFAULT '',
  address_en text DEFAULT '',
  phone text DEFAULT '1688-9407',
  email text DEFAULT '',
  bank_name text DEFAULT '',
  bank_account text DEFAULT '',
  bank_holder text DEFAULT '',
  instagram_url text DEFAULT '',
  youtube_url text DEFAULT '',
  cs_hours_kr text DEFAULT '평일 10:00 - 17:00',
  cs_hours_en text DEFAULT 'Weekdays 10:00 - 17:00',
  cs_lunch_kr text DEFAULT '점심 12:00 - 13:00',
  cs_lunch_en text DEFAULT 'Lunch 12:00 - 13:00',
  cs_holiday_kr text DEFAULT '주말 및 공휴일 휴무',
  cs_holiday_en text DEFAULT 'Closed on weekends & holidays',
  privacy_officer_name text DEFAULT '',
  privacy_officer_email text DEFAULT '',
  updated_at timestamptz DEFAULT timezone('utc', now()),
  CONSTRAINT single_business CHECK (id = 1)
);
INSERT INTO public.business_info (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read business_info" ON public.business_info FOR SELECT USING (true);
CREATE POLICY "Admin write business_info" ON public.business_info
  FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
