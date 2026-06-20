export interface RegField {
  key: string;
  label_kr: string;
  label_en: string;
  type: string;
  required: boolean;
  enabled: boolean;
  removable: boolean;
  options_kr?: string[];
  options_en?: string[];
}

export interface AuthProvider {
  id: number;
  provider: string;
  is_enabled: boolean;
  client_id: string;
  client_secret: string;
  help_url: string;
  description_kr: string;
}

export interface VerificationConfig {
  is_enabled: boolean;
  provider: string;
  api_key: string;
  secret_key: string;
  merchant_id: string;
  help_url: string;
  description_kr: string;
}

export interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  gender: string;
  country: string;
  skin_type: string;
  marketing_consent: boolean;
  auth_provider: string;
  created_at: string;
}

export const PROVIDER_LOGOS: Record<string, { name: string; color: string; fields: string[] }> = {
  google: { name: 'Google', color: 'bg-red-50 text-red-700 border-red-200', fields: ['Client ID', 'Client Secret'] },
  kakao: { name: 'Kakao', color: 'bg-yellow-50 text-yellow-800 border-yellow-200', fields: ['REST API Key', 'Client Secret'] },
  naver: { name: 'Naver', color: 'bg-green-50 text-green-700 border-green-200', fields: ['Client ID', 'Client Secret'] },
  apple: { name: 'Apple', color: 'bg-gray-50 text-gray-700 border-gray-200', fields: ['Service ID', 'Key ID / Secret'] },
};

export const VERIFICATION_PROVIDERS = [
  { value: 'nice', label: 'NICE 본인인증', url: 'https://www.niceapi.co.kr/' },
  { value: 'kcp', label: 'NHN KCP', url: 'https://admin8.kcp.co.kr/' },
  { value: 'pass', label: 'PASS 인증', url: 'https://www.passauth.co.kr/' },
];
