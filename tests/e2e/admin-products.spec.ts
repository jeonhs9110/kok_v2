import { test, expect } from '@playwright/test';

/**
 * Admin products page test — verifies the Phase 2 refactor (1019 LOC →
 * Page + List + DetailModal) didn't regress the operator's ability to
 * open the add-product modal.
 *
 * Skipped by default because it needs admin credentials (the only way to
 * reach /admin/* after the JWT-verified middleware). Enable by setting
 * E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD in `.env.test.local`:
 *
 *   E2E_ADMIN_EMAIL=admin@kokkok.com
 *   E2E_ADMIN_PASSWORD=<the shared admin password>
 *
 * Read-only: opens the modal, asserts on its fields, then closes. Never
 * submits the form.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin products', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'admin credentials not configured');

  test('admin can open the add-product modal and see the form fields', async ({ page }) => {
    // Sign in
    await page.goto('/login');
    await page.getByPlaceholder(/이메일 주소|email/i).fill(ADMIN_EMAIL!);
    await page.getByPlaceholder(/비밀번호|password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /sign in|로그인/i }).click();

    // Land on /admin
    await page.waitForURL(/\/admin/, { timeout: 15_000 });

    // Navigate to products (sidebar link). The admin sidebar link text is
    // "상품 관리".
    await page.getByRole('link', { name: /상품 관리/i }).click();
    await page.waitForURL(/\/admin\/products/, { timeout: 10_000 });

    // The Page header. Catches a Phase 2 regression where the container
    // file failed to render the header bar.
    await expect(page.getByRole('heading', { name: /상품 재고/i })).toBeVisible();

    // Open the add modal
    await page.getByRole('button', { name: /상품 추가/i }).click();

    // ProductDetailModal title in create mode
    await expect(page.getByRole('heading', { name: /새 상품 추가/i })).toBeVisible();

    // Form fields that must exist in every release
    await expect(page.getByText(/상품 이미지/i)).toBeVisible();
    await expect(page.getByText(/상품명/i)).toBeVisible();
    await expect(page.getByText(/현재 판매가/i)).toBeVisible();

    // Close without saving
    await page.getByRole('button', { name: /닫기|취소/i }).first().click();
    await expect(page.getByRole('heading', { name: /새 상품 추가/i })).not.toBeVisible();
  });
});
