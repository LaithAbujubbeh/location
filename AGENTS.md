# AGENTS.md — Location Attendance App

## Purpose

This repository contains a scalable location-based attendance and verification app.

Admins create location-based events. Employees see assigned events, check in at the event location, receive random recheck links by SMS/email/WhatsApp, prove they are still at the location, and check out before leaving.

This file contains global project instructions. Detailed implementation workflows should live in project Skills under:

```txt
.agents/skills/<skill-name>/SKILL.md
```

Use Skills whenever a task matches a specialized workflow.

---

## Required Stack

Use:

- Next.js App Router
- TypeScript everywhere
- Better Auth for authentication and sessions
- Prisma + PostgreSQL
- Tailwind CSS
- Design tokens for light/dark themes
- English/Arabic internationalization
- LTR layout for English
- RTL layout for Arabic
- Zod for request validation
- Optional: Resend for email notifications
- Optional: Twilio/WhatsApp/SMS for recheck notifications
- Optional: Redis/Upstash for rate limiting, caching, and cron locks

---

## Core Product Flow

### Admin Flow

Admins can:

- log in
- create events
- define event location, latitude, longitude, radius, start/end time
- assign employees to events
- configure random rechecks
- choose whether photo proof is required
- choose whether checkout is required
- review employee attendance timelines
- review suspicious activity
- approve or reject employee devices

### Employee Flow

Employees can:

- log in
- view only assigned active/upcoming events
- open event details
- check in with fresh GPS, GPS accuracy, optional live photo, and device ID
- receive random recheck links
- submit rechecks with fresh GPS, optional live photo, and device ID
- check out before leaving
- view their own event status

---

## Non-Negotiable Security Rules

Do not trust the frontend for security decisions.

The frontend may collect GPS, photo, and device ID, but the backend must verify:

- active user session
- user role
- event assignment
- event time window
- device trust
- GPS freshness
- GPS accuracy
- distance from target location
- photo requirement
- duplicate submissions
- recheck token validity
- rate limits

Never mark attendance as valid just because the frontend says it is valid.

Never accept `employeeId` from employee-facing requests. For employee actions, always get the employee ID from the current session.

Raw recheck tokens must never be stored in the database. Store only token hashes.

Recheck tokens must be:

- one-time use
- expiring
- hard to guess
- validated server-side

Use HTTPS and secure cookies in production.

---

## Global Architecture Rules

Keep route handlers thin.

Route handlers should only:

1. authenticate
2. authorize
3. validate input
4. rate limit
5. call a service function
6. return a response

Business logic belongs in `src/services/`, not in page components and not directly inside route handlers.

Use Zod before database writes.

Use Prisma transactions for multi-step writes, especially:

- create event + assignments
- check-in + proof creation + assignment status update + recheck creation
- recheck submit + proof creation + recheck status update
- checkout + proof creation + assignment finalization

Use `select` where possible instead of loading full models.

Use pagination for admin lists.

Never load all events, assignments, proofs, or rechecks without pagination.

---

## Recommended Folder Structure

Use this as the target structure unless the existing repository already has a clean equivalent:

```txt
src/
  app/
    [locale]/
      (auth)/
        login/
          page.tsx

      (employee)/
        employee/
          events/
            page.tsx
            [eventId]/
              page.tsx
              check-in/
                page.tsx
              check-out/
                page.tsx
        recheck/
          [token]/
            page.tsx

      (admin)/
        admin/
          events/
            page.tsx
            create/
              page.tsx
            [eventId]/
              page.tsx
              employees/
                page.tsx
              timeline/
                page.tsx
          devices/
            page.tsx

    api/
      auth/
        [...all]/
          route.ts

      admin/
        events/
          route.ts
          [eventId]/
            route.ts
            employees/
              route.ts
            timeline/
              route.ts
        devices/
          route.ts
          [deviceId]/
            approve/
              route.ts
            reject/
              route.ts

      employee/
        events/
          route.ts
          [eventId]/
            route.ts
            check-in/
              route.ts
            check-out/
              route.ts

      rechecks/
        [token]/
          route.ts
        [token]/
          submit/
            route.ts

      cron/
        rechecks/
          route.ts

  components/
    admin/
    employee/
    layout/
    shared/
    theme/
    ui/

  lib/
    auth.ts
    auth-client.ts
    permissions.ts
    prisma.ts
    rate-limit.ts
    cache.ts
    geo.ts
    browser-location.ts
    device.ts
    tokens.ts
    upload.ts
    notifications.ts
    validators.ts
    i18n.ts
    errors.ts

  services/
    event.service.ts
    check-in.service.ts
    recheck.service.ts
    device.service.ts
    notification.service.ts

  tests/
    unit/
    integration/
    e2e/

messages/
  en.json
  ar.json

prisma/
  schema.prisma
```

---

## Skills Usage

This project should use Skills for focused implementation workflows.

Project Skills should live here:

```txt
.agents/skills/
```

Recommended Skills:

```txt
.agents/skills/project-setup/SKILL.md
.agents/skills/design-system-setup/SKILL.md
.agents/skills/i18n-setup/SKILL.md
.agents/skills/prisma-models/SKILL.md
.agents/skills/better-auth-setup/SKILL.md
.agents/skills/permissions/SKILL.md
.agents/skills/api-route-service/SKILL.md
.agents/skills/location-verification/SKILL.md
.agents/skills/device-binding/SKILL.md
.agents/skills/recheck-flow/SKILL.md
.agents/skills/rate-limit-cache/SKILL.md
.agents/skills/testing/SKILL.md
.agents/skills/performance-security-review/SKILL.md
```

When a user asks for a task that matches a Skill, use that Skill before editing files.

Examples:

- Use `design-system-setup` for Tailwind tokens, UI components, theme provider, and theme toggle.
- Use `i18n-setup` for English/Arabic routing, translation files, language toggle, and RTL behavior.
- Use `better-auth-setup` for Better Auth, sessions, auth route, and login/logout behavior.
- Use `permissions` for role checks and protected admin/employee routes.
- Use `prisma-models` for schema design, migrations, indexes, and relations.
- Use `api-route-service` for route handlers, service functions, validation, and API responses.
- Use `location-verification` for GPS freshness, GPS accuracy, distance checks, proof status, and geofence logic.
- Use `device-binding` for browser device IDs, trusted devices, and admin approval.
- Use `recheck-flow` for random recheck scheduling, token hashing, notifications, expiry, and submit flow.
- Use `rate-limit-cache` for rate limits, private cache rules, and invalidation.
- Use `testing` for unit, integration, E2E, and security tests.
- Use `performance-security-review` before final polish or production readiness.

Do not duplicate large Skill instructions inside this file. Keep detailed step-by-step workflows inside each Skill.

---

## Design System Rules

Build the design system before implementing main pages.

The app must support:

- light theme
- dark theme
- system theme preference
- English
- Arabic
- LTR for English
- RTL for Arabic
- mobile-first employee screens
- responsive admin dashboards
- accessible colors and components

Use semantic design tokens instead of hardcoded colors inside components.

Required base palette:

```txt
Primary:        #2563EB
Primary Hover:  #1D4ED8
Primary Soft:   #DBEAFE
Primary Dark:   #1E3A8A
Success:        #16A34A
Warning:        #F59E0B
Danger:         #DC2626
Info:           #0EA5E9
```

Use consistent status labels and colors:

```txt
PENDING      -> gray / Pending
IN_PROGRESS  -> blue / In Progress
COMPLETED    -> green / Completed
SUSPICIOUS   -> amber / Suspicious
FAILED       -> red / Failed
MISSED       -> red / Missed
ACCEPTED     -> green / Accepted
REJECTED     -> red / Rejected
```

Status labels must come from translation files.

Do not hardcode user-facing text inside components.

---

## Internationalization Rules

Use locale-based routing:

```txt
/en/login
/ar/login
/en/employee/events
/ar/employee/events
/en/admin/events
/ar/admin/events
```

Supported locales:

```txt
en -> English -> LTR
ar -> Arabic  -> RTL
```

Requirements:

- switching language keeps the user on the same logical page
- store preferred locale in a cookie or local storage
- set `lang` on the `html` element
- set `dir="ltr"` for English
- set `dir="rtl"` for Arabic
- Arabic mode must mirror layout direction, not only translate text
- sidebar moves to the right in Arabic
- back icons flip in Arabic
- forms align correctly in RTL
- use logical Tailwind utilities when possible: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`
- avoid hardcoded `left`, `right`, `ml`, `mr`, `pl`, and `pr` unless needed

Use natural Arabic, not literal machine-style translation.

---

## Authentication Rules

Use Better Auth for:

- login
- logout
- session management
- current user session
- cookie-based sessions

Better Auth should own auth endpoints.

Create:

```txt
src/app/api/auth/[...all]/route.ts
src/lib/auth.ts
src/lib/auth-client.ts
src/lib/permissions.ts
```

Required roles:

```txt
ADMIN
EMPLOYEE
```

Admin pages and admin route handlers must require `ADMIN`.

Employee pages and employee route handlers must require authenticated users and must only operate on the current user from the session.

---

## Permission Rules

Admins can:

- create events
- update events
- assign employees
- view all check-ins and rechecks
- approve/reject devices
- review attendance

Employees can:

- view only assigned events
- check in only to assigned events
- submit only their own rechecks
- check out only from their own assignment
- view their own attendance history

Employee-facing requests must never trust client-submitted `employeeId`.

---

## Rate Limiting Rules

Rate limit sensitive endpoints:

- auth/login if Better Auth config does not already cover it
- check-in submit
- recheck submit
- checkout submit
- admin create event
- notification resend
- device registration

Recommended policies:

```txt
Login: 5 attempts / 10 minutes / IP
Check-in submit: 5 attempts / 5 minutes / user
Recheck submit: 5 attempts / 5 minutes / user
Checkout submit: 5 attempts / 5 minutes / user
Notification resend: 3 attempts / 15 minutes / assignment
Admin create event: 20 attempts / hour / admin
```

Use Redis/Upstash in production.

Use in-memory fallback only in development.

---

## Caching Rules

Be careful with caching because most data is private and user-specific.

Never globally cache:

- current session
- employee assigned events
- check-in status
- recheck token responses
- admin timeline with private employee data
- device approval status

For private route handlers, use dynamic/no-store behavior.

Safe caching candidates:

- static UI data
- public configuration
- non-sensitive lookup lists
- short-lived admin aggregate stats if correctly scoped

Use one consistent invalidation strategy.

Do not mix random caching approaches.

---

## Location Verification Rules

For check-in, recheck, and checkout, verify:

- GPS timestamp freshness
- GPS accuracy
- distance from target location
- event assignment
- event time window
- device trust
- duplicate submissions

Typical rules:

```txt
GPS timestamp should usually be <= 30 seconds old
GPS accuracy should usually be <= 100 meters
Distance from target must be <= event.radiusMeters
Poor accuracy should mark result as SUSPICIOUS, not always rejected
Far outside radius should be REJECTED or FAILED
```

Use the Haversine formula for distance calculation.

Do not trust GPS alone. Use GPS + photo + device + time window.

---

## Device Binding Rules

Device binding is required to reduce account sharing.

Frontend:

- generate a browser device ID
- store it in local storage
- send it with check-in, recheck, and checkout

Backend:

- first device for employee may be trusted automatically
- new device should be blocked or marked suspicious until admin approval
- admin dashboard should show pending device requests

---

## Recheck Rules

Random rechecks must:

- be generated after check-in
- have hashed tokens only
- have start and expiry times
- be one-time use
- expire if missed
- avoid revealing future random recheck times to employees

Do not run long background loops inside Next.js serverless functions.

Use a cron route:

```txt
/api/cron/rechecks
```

The cron route should:

1. activate scheduled rechecks
2. send notifications
3. mark expired rechecks as missed
4. avoid double-processing with a Redis or database lock

---

## Photo Upload Rules

Do not store photos directly in PostgreSQL.

Use one of:

- S3-compatible storage
- Cloudinary
- UploadThing
- local storage only for development

Store only the photo URL/path in the database.

Validate image uploads:

```txt
Allowed: jpg, jpeg, png, webp
Max size: 5MB
```

---

## Testing Rules

Add tests from the beginning.

Unit tests should cover:

- distance calculation
- GPS freshness
- attendance status calculation
- token hashing/comparison
- random recheck time generation
- validation schemas

Integration tests should cover:

- admin creates event
- employee sees assigned event
- employee cannot see unassigned event
- employee check-in accepted inside radius
- employee check-in rejected outside radius
- recheck token expires
- recheck cannot be submitted twice
- checkout updates assignment status
- untrusted device blocked
- employee cannot submit for another employee
- non-admin cannot create event

E2E tests should cover:

1. admin login
2. admin creates event and assigns employee
3. employee login
4. employee sees event
5. employee checks in
6. employee submits recheck
7. employee checks out
8. admin sees timeline

Use Playwright for E2E tests.

Mock geolocation in Playwright tests.

---

## Implementation Order

Build in this order:

1. Project setup
2. Design system setup
3. English/Arabic i18n setup
4. Prisma setup
5. Better Auth setup
6. Role field and permission helpers
7. Admin create event
8. Employee event list
9. Device binding
10. Check-in with GPS/photo
11. Recheck scheduling logic
12. Recheck token page
13. Cron route for rechecks
14. Notification provider
15. Checkout
16. Admin timeline
17. Rate limiting
18. Caching/invalidation
19. Tests
20. Performance pass
21. Security review
22. UI/UX polish in both themes and both languages

Do not skip earlier foundation steps unless the user explicitly says they are already complete.

---

## Agent Workflow Rules

When implementing, do not dump all code at once.

Work step by step:

1. Read the relevant files.
2. Use the matching Skill if one exists.
3. Explain the files you will create or edit.
4. Implement the smallest complete feature.
5. Keep code typed and clean.
6. Avoid unnecessary abstractions.
7. Keep business logic in services.
8. Keep route handlers thin.
9. Add validation before database writes.
10. Add tests for important rules.
11. Optimize queries using indexes, select, pagination, and transactions.
12. Prioritize security over convenience.
13. Summarize what changed.
14. Explain how to test the change.

If the requested task is too large, split it into small safe phases and complete only the first useful phase.

Do not continue into unrelated features without user approval.

---

## Definition of Done

The project is complete only when:

- light theme works across the app
- dark theme works across the app
- theme preference persists
- English language works
- Arabic language works
- Arabic RTL layout works correctly
- admin sidebar mirrors correctly in Arabic
- no user-facing text is hardcoded in components
- admin can create events and assign employees
- employee can only see assigned events
- employee can check in only when inside geofence
- device binding works
- random rechecks are generated
- recheck links expire and are one-time use
- recheck submissions verify GPS/photo/device
- checkout works
- admin timeline shows all proof records
- rate limits exist on sensitive endpoints
- private data is not globally cached
- critical queries have indexes
- unit tests cover location/status/token logic
- integration tests cover auth, permissions, check-in, recheck, and checkout
- E2E test covers the full admin + employee flow
