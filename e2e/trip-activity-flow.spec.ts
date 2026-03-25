import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function registerAndOpenTrip(page: Page, testInfo: TestInfo): Promise<{ tripName: string }> {
  const seed = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `e2e-${seed}@example.com`;
  const password = 'password123';
  const tripName = `E2E Activity Flow ${seed}`;

  await page.goto('/auth');
  await page.getByRole('button', { name: '註冊' }).first().click();
  await page.locator('input[type="text"]').first().fill(`E2E User ${seed}`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form').getByRole('button', { name: '註冊' }).click();

  await expect(page.getByRole('heading', { name: 'My Trips' })).toBeVisible();

  await page.getByRole('button', { name: '+ New Trip' }).click();
  if (!(await page.getByPlaceholder('e.g. European Summer 2024').isVisible({ timeout: 1000 }).catch(() => false))) {
    await page.getByRole('button', { name: 'Create Your First Trip' }).click();
  }
  await page.getByPlaceholder('e.g. European Summer 2024').fill(tripName);
  await page.getByPlaceholder('e.g. Paris, Rome, Barcelona').fill('Tokyo');
  await page.getByRole('button', { name: 'Create Trip' }).click();

  await page.getByRole('link', { name: new RegExp(tripName) }).click();
  await expect(page.getByRole('heading', { name: tripName })).toBeVisible();

  return { tripName };
}

async function addManualActivity(page: Page, title: string, city: string, description: string): Promise<void> {
  await page.getByRole('button', { name: /Add activity manually/ }).click();
  await page.getByPlaceholder('Title').fill(title);
  await page.getByPlaceholder('City').fill(city);
  await page.getByPlaceholder('Description').fill(description);
  await page.getByRole('button', { name: 'Add Manual Activity' }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test.describe('Trip activity flow', () => {
  test('owner can approve/reject manual activities and itinerary reflects approved only', async ({ page }, testInfo) => {
    const { tripName } = await registerAndOpenTrip(page, testInfo);
    await expect(page.getByRole('heading', { name: tripName })).toBeVisible();

    const approvedTitle = `Approved Spot ${Date.now()}`;
    const rejectedTitle = `Rejected Spot ${Date.now()}`;

    await addManualActivity(page, approvedTitle, 'Tokyo', 'A place to approve');
    await addManualActivity(page, rejectedTitle, 'Tokyo', 'A place to reject');

    const approvedCard = page.locator('div.rounded-xl.border.p-5', { hasText: approvedTitle }).first();
    await approvedCard.getByRole('button', { name: /Approve/ }).click();
    await expect(approvedCard.getByText('approved')).toBeVisible();

    const rejectedCard = page.locator('div.rounded-xl.border.p-5', { hasText: rejectedTitle }).first();
    await rejectedCard.getByRole('button', { name: /Reject/ }).click();
    await expect(rejectedCard.getByText('rejected')).toBeVisible();

    await page.getByRole('button', { name: /Itinerary/ }).click();
    await expect(page.getByText(approvedTitle)).toBeVisible();
    await expect(page.getByText(rejectedTitle)).not.toBeVisible();
  });
});
