import { expect, test } from "@playwright/test";

test.use({
  geolocation: {
    latitude: 31.9711,
    longitude: 35.9078,
  },
  permissions: ["geolocation"],
});

test("localized login shell supports theme, RTL switching, and mocked geolocation", async ({
  page,
}) => {
  await page.goto("/en/login");

  await expect(page).toHaveTitle(/Location Attendance/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    "dark",
  );

  const geolocation = await page.evaluate(
    () =>
      new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          reject,
        );
      }),
  );

  expect(geolocation.latitude).toBeCloseTo(31.9711, 5);
  expect(geolocation.longitude).toBeCloseTo(35.9078, 5);

  await page.getByRole("button", { name: "Arabic" }).click();
  await expect(page).toHaveURL(/\/ar\/login$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("protected areas redirect anonymous users to localized login", async ({
  page,
}) => {
  await page.goto("/en/admin/events");

  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fadmin%2Fevents$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goto("/ar/employee/events");

  await expect(page).toHaveURL(
    /\/ar\/login\?next=%2Far%2Femployee%2Fevents$/,
  );
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "تسجيل الدخول" }),
  ).toBeVisible();
});

test("login shell has no horizontal overflow on phone, tablet, and desktop", async ({
  page,
}) => {
  const viewports = [
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}/login`);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );

      expect(hasHorizontalOverflow).toBe(false);
    }
  }
});
