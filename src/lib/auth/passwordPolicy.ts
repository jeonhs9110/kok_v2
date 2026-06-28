/**
 * Shared password policy used by the register form, the password-reset
 * form, and any future password change UI. Mirrors the server-side
 * Cognito policy in infrastructure/cognito.tf so the inline checklist
 * and Cognito's eventual rejection message agree.
 */

export interface PasswordCheck {
  key: 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol';
  label: { kr: string; en: string };
  ok: boolean;
}

export interface PasswordPolicyResult {
  checks: PasswordCheck[];
  allValid: boolean;
}

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const checks: PasswordCheck[] = [
    {
      key: 'length',
      label: { kr: '8자 이상', en: 'At least 8 characters' },
      ok: password.length >= 8,
    },
    {
      key: 'uppercase',
      label: { kr: '대문자 포함 (A–Z)', en: 'One uppercase letter' },
      ok: /[A-Z]/.test(password),
    },
    {
      key: 'lowercase',
      label: { kr: '소문자 포함 (a–z)', en: 'One lowercase letter' },
      ok: /[a-z]/.test(password),
    },
    {
      key: 'number',
      label: { kr: '숫자 포함 (0–9)', en: 'One number' },
      ok: /[0-9]/.test(password),
    },
    {
      key: 'symbol',
      // Cognito's accepted symbol set per AWS docs.
      label: { kr: '특수문자 포함 (! @ # $ % & * 등)', en: 'One symbol (! @ # $ % & * …)' },
      ok: /[\^\$\*\.\[\]\{\}\(\)\?\-"!@#%&\/\\,><':;|_~`+=]/.test(password),
    },
  ];
  return { checks, allValid: checks.every(c => c.ok) };
}
