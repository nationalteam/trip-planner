import { expect, test } from '@playwright/test';

test.describe('Auth smoke', () => {
  test('loads auth page and shows login/register actions', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: '登入' })).toBeVisible();
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible();
    await expect(page.getByRole('button', { name: '註冊' })).toBeVisible();
  });
});
