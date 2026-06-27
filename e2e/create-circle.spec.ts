import { test, expect } from "@playwright/test";
import { mockAuthSession } from "./helpers/auth";

test.describe("Create Circle", () => {
  test.beforeEach(async ({ page, context }) => {
    await mockAuthSession(context, page);
  });

  test("create circle form renders required fields", async ({ page }) => {
    await page.goto("/circles/create");
    await expect(page.getByLabel(/circle name/i)).toBeVisible();
    await expect(page.getByLabel(/contribution/i)).toBeVisible();
    await expect(page.getByLabel(/max members/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create circle/i })).toBeVisible();
  });

  test("submits form and redirects on success", async ({ page }) => {
    await page.route("/api/circles", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { id: "circle-abc" } }),
      })
    );

    await page.goto("/circles/create");
    await page.getByLabel(/circle name/i).fill("Test Ajo Circle");
    await page.getByLabel(/contribution/i).fill("5000");
    await page.getByLabel(/max members/i).fill("5");
    await page.getByRole("button", { name: /create circle/i }).click();

    await expect(page).toHaveURL(/\/circles\/circle-abc/);
  });

  test("shows validation error for missing fields", async ({ page }) => {
    await page.goto("/circles/create");
    await page.getByRole("button", { name: /create circle/i }).click();
    const nameInput = page.getByLabel(/circle name/i);
    await expect(nameInput).toBeFocused();
  });

  test("shows error toast when API fails", async ({ page }) => {
    await page.route("/api/circles", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Name already taken" }),
      })
    );

    await page.goto("/circles/create");
    await page.getByLabel(/circle name/i).fill("Duplicate Circle");
    await page.getByLabel(/contribution/i).fill("5000");
    await page.getByLabel(/max members/i).fill("5");
    await page.getByRole("button", { name: /create circle/i }).click();

    await expect(page.getByText(/name already taken/i)).toBeVisible();
  });
});
