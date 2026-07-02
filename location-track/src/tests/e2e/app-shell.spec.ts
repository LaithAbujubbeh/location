import { expect, test } from "@playwright/test";

test.use({
  geolocation: {
    latitude: 31.9711,
    longitude: 35.9078,
  },
  permissions: ["geolocation"],
});

test("localized app shell supports theme, RTL switching, and mocked geolocation", async ({
  page,
}) => {
  await page.goto("/en");

  await expect(page).toHaveTitle(/Location Attendance/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("heading", { name: "Location Attendance" }),
  ).toBeVisible();

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
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
