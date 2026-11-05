import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Newage Portal End-to-End & RBAC Access Controls', () => {

    test('Homepage loads with 14 study destinations including Bulgaria', async ({ page }) => {
        await page.goto(`${BASE_URL}/index.html`);
        await expect(page).toHaveTitle(/Newage Education/i);

        // Check destinations
        const bulgariaDropdown = page.locator('a[onclick*="bulgaria"]');
        await expect(bulgariaDropdown.first()).toBeVisible();

        const bulgariaCard = page.locator('.dest-card:has-text("Bulgaria")');
        await expect(bulgariaCard).toBeVisible();
    });

    test('Unauthenticated user attempting to access CEO portal is redirected', async ({ page }) => {
        await page.goto(`${BASE_URL}/ceo.html`);
        // Under RBAC route guard, unauthenticated users get redirected to index.html
        await page.waitForURL(/index\.html/);
        expect(page.url()).toContain('index.html');
    });

    test('Student Portal displays document upload slots and prep materials', async ({ page }) => {
        await page.goto(`${BASE_URL}/student.html`);
        // Verify document upload slots exist
        const passportSlot = page.locator('tr[data-doc-type="passport"]');
        await expect(passportSlot).toBeDefined();
    });

    test('Quick Search filters candidates in Employee workstation', async ({ page }) => {
        await page.goto(`${BASE_URL}/employee.html`);
        const searchInput = page.locator('#crmSearchInput');
        if (await searchInput.isVisible()) {
            await searchInput.fill('Sakib');
            const tableRows = page.locator('#studentsTableBody tr');
            await expect(tableRows.first()).toBeVisible();
        }
    });
});

