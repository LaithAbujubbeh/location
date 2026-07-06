# Manual QA Checklist

Run the flow in English and Arabic, then repeat a smoke pass in light and dark themes.

## Viewports

- 360px mobile
- 390px mobile
- 768px tablet
- 1024px laptop
- 1440px desktop

Confirm there is no page-level horizontal scrolling. Tables may use their own contained horizontal scroll only on desktop table layouts.

## Full App Flow

1. Sign in as an admin.
2. Create an employee user and a second admin user.
3. Create an event with a map-selected location, radius, assigned employees, and fixed recheck slots.
4. Sign in as the employee.
5. Confirm the assigned event appears in the employee event list.
6. Open event details and confirm fixed recheck slots are readable.
7. Attempt check-in from a new browser/device ID.
8. Confirm the employee sees a clear pending-device backend error.
9. Sign in as admin and confirm the pending device notification appears.
10. Open Devices and approve the pending device.
11. Sign in as employee and confirm the device-approved notification appears.
12. Retry check-in and confirm it succeeds inside the geofence.
13. Run `/api/cron/rechecks` with the configured cron secret when a slot is due.
14. Confirm the active recheck notification appears for the employee.
15. Submit the active recheck.
16. Submit checkout.
17. As admin, review event details, employee status, timeline records, devices, and users.
18. Mark individual notifications as read and use Mark all read.

## UI/UX Checks

- All forms fit narrow mobile widths.
- Admin topbar controls wrap cleanly on 360px and 390px.
- Arabic pages use RTL layout and logical navigation.
- Notification links open the matching locale without duplicated locale segments.
- Notification badge refreshes after waiting briefly or focusing the tab.
- Device IDs, user agents, coordinates, and long emails wrap or truncate safely.
- Map picker remains inside its card and resizes after layout changes.
- Backend errors appear inline near the relevant form/action.
- Buttons are not shown for impossible assignment statuses such as missed or failed.
