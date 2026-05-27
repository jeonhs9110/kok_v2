-- Adds per-section visibility flags to business_info so the admin can hide
-- entire groups of footer content (e.g., bank info) without losing the data.
--
-- Semantic groups (any string in this array hides the corresponding block):
--   'company'   — 상호 / 대표 / 사업자등록번호 / 통신판매업신고번호
--   'address'   — 주소 line
--   'email'     — 이메일 line
--   'phone'     — 큰 전화번호 in CS column
--   'cs_hours'  — 운영시간 / 점심시간 / 휴무일 block
--   'bank'      — 계좌정보 column (bank_name / account / holder)
--   'social'    — Instagram / YouTube icons

ALTER TABLE public.business_info
  ADD COLUMN IF NOT EXISTS hidden_fields text[] DEFAULT '{}';
