# CLAUDE.md — Scalable Location Attendance App

## Project Context

Build a scalable, optimized full-stack attendance/location verification app using:

- **Next.js App Router** for frontend and backend route handlers
- **TypeScript** everywhere
- **Better Auth** for authentication and sessions
- **Prisma + PostgreSQL** for database access
- **Tailwind CSS** for UI
- **Design tokens** for scalable light/dark themes
- **English/Arabic internationalization** with LTR/RTL layout support
- **Zod** for validation
- Optional: **Resend** for email, **Twilio/WhatsApp/SMS** for recheck notifications
- Optional: **Redis/Upstash** for rate limiting, caching, and scheduled-job locks

The app allows admins to create location-based events. Employees see assigned available events, check in at the event location, receive random rechecks by SMS/email/WhatsApp, prove they are still there, and check out before leaving.

---

## Main Product Flow

### Admin Flow

1. Admin logs in.
2. Admin creates an event:
   - name
   - location name
   - latitude / longitude
   - allowed radius in meters
   - start time / end time
   - assigned employees
   - number of random rechecks
   - recheck window duration
   - whether photo is required
   - whether checkout is required
3. Admin views event dashboard:
   - total assigned employees
   - checked in
   - in progress
   - completed
   - suspicious
   - missed / failed
4. Admin reviews each employee timeline:
   - check-in
   - rechecks
   - checkout
   - GPS accuracy
   - distance from target
   - photo proof
   - final status

### Employee Flow

1. Employee logs in.
2. Employee sees assigned active/upcoming events.
3. Employee opens event details.
4. Employee checks in with:
   - fresh GPS location
   - GPS accuracy
   - live photo/selfie if required
   - device ID
5. Backend verifies employee is inside the event geofence.
6. Backend schedules random rechecks.
7. Employee receives SMS/email/WhatsApp recheck link.
8. Employee opens recheck link and submits:
   - fresh GPS
   - live photo/selfie
   - device ID
9. Employee checks out before leaving with GPS and optional photo.
10. Admin sees the full proof timeline.

---

## Core Rules

Do not trust the frontend for security decisions.

The frontend may collect GPS, photo, and device ID, but the backend must verify:

- user session
- user role
- event assignment
- event time window
- device trust
- GPS freshness
- GPS accuracy
- distance from event location
- photo requirement
- duplicate submissions
- token validity for rechecks
- rate limits

Never mark an attendance as valid just because the frontend says it is valid.

---

## Recommended Folder Structure

```txt
src/
  app/
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
    theme/
    i18n/
    shared/
    ui/

  messages/
    en.json
    ar.json

  lib/
    auth.ts
    auth-client.ts
    prisma.ts
    permissions.ts
    rate-limit.ts
    cache.ts
    geo.ts
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
```

---

## Authentication Requirements

Use **Better Auth** for login, logout, session management, and current user session.

### Required Auth Features

- Email/password login
- Cookie-based session
- Server-side session checks
- Role field on user:
  - `ADMIN`
  - `EMPLOYEE`
- Protected admin pages
- Protected employee pages
- Protected route handlers

### Auth Route

Create:

```txt
src/app/api/auth/[...all]/route.ts
```

Better Auth should own auth endpoints. Do not manually implement login/logout unless necessary.

### Server Auth Helper

Create:

```ts
// src/lib/permissions.ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getCurrentSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
}

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function requireEmployeeOrAdmin() {
  const user = await requireUser();

  if (user.role !== "EMPLOYEE" && user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return user;
}
```

All protected route handlers must call one of these helpers.

---

## Permission Requirements

### Admin Can

- Create events
- Update events
- Assign employees
- View all check-ins and rechecks
- Approve/reject devices
- Mark attendance as reviewed
- Export reports later if needed

### Employee Can

- View only assigned events
- Check in only to assigned events
- Submit only their own rechecks
- Check out only from their own assignment
- View their own attendance history

### Permission Rules

Never accept `employeeId` from the client for employee actions.

For employee routes, always get `employeeId` from the session:

```ts
const user = await requireEmployeeOrAdmin();
const employeeId = user.id;
```

For admin routes, validate that the admin has permission before mutating anything.

---

## Rate Limiting Requirements

Add rate limiting to protect important endpoints.

### Endpoints to Rate Limit

- Auth/login endpoints if Better Auth config does not already cover the required rule
- Check-in submit
- Recheck submit
- Checkout submit
- Admin create event
- Notification resend
- Device registration

### Recommended Rate Limit Strategy

Use Redis/Upstash in production. Use in-memory fallback only in development.

Create:

```txt
src/lib/rate-limit.ts
```

Support keys like:

```txt
ip:{ip}:auth
user:{userId}:checkin
user:{userId}:recheck
user:{userId}:checkout
device:{deviceId}:submit
```

Example policy:

```txt
Login: 5 attempts / 10 minutes / IP
Check-in submit: 5 attempts / 5 minutes / user
Recheck submit: 5 attempts / 5 minutes / user
Checkout submit: 5 attempts / 5 minutes / user
Notification resend: 3 attempts / 15 minutes / assignment
Admin create event: 20 attempts / hour / admin
```

On rate limit failure, return:

```ts
return Response.json(
  { message: "Too many requests. Please try again later." },
  { status: 429 }
);
```

---

## Device Binding Requirements

Device binding is required to reduce account sharing.

### Frontend Device ID

Create a browser-generated device ID:

```ts
// src/lib/device.ts
export function getDeviceId() {
  if (typeof window === "undefined") return null;

  let deviceId = localStorage.getItem("deviceId");

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }

  return deviceId;
}
```

Send `deviceId` with:

- check-in
- recheck
- checkout

### Backend Device Rule

- First device for employee may be trusted automatically.
- New device should be blocked or marked suspicious until admin approval.
- Admin dashboard should show pending device requests.

---

## Location Verification Requirements

Create:

```txt
src/lib/geo.ts
```

Implement Haversine distance calculation:

```ts
export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
```

### Verification Rules

For check-in, recheck, and checkout:

```txt
GPS timestamp must be fresh, usually <= 30 seconds old
GPS accuracy should usually be <= 100 meters
Distance from target must be <= event.radiusMeters
Poor accuracy should mark result as SUSPICIOUS, not always rejected
Far outside radius should be REJECTED or FAILED
```

---

## Caching Requirements

Use caching carefully because most data is user-specific.

### Do Not Cache

Never cache these globally:

- current session
- employee assigned events
- check-in status
- recheck token responses
- admin timeline with private employee data
- device approval status

For private route handlers, use:

```ts
export const dynamic = "force-dynamic";
```

or return appropriate no-store headers.

### Safe Caching Candidates

You may cache:

- static UI data
- public configuration
- non-sensitive lookup lists
- admin aggregate stats for short periods, if correctly scoped

### Client Caching

If using TanStack Query, use short stale times for employee pages:

```ts
staleTime: 10_000
refetchOnWindowFocus: true
```

For admin dashboards, use polling or manual refresh.

### Cache Invalidation

After mutations, invalidate or revalidate:

- employee event list
- event details
- admin event dashboard
- admin timeline

Use one consistent strategy:

- TanStack Query invalidation on the client, or
- Next.js cache tags and `revalidateTag` for server-rendered data

Do not mix strategies randomly.

---

## Performance Requirements

### Database

Use indexes for frequent queries:

```prisma
@@index([employeeId])
@@index([eventId])
@@index([status])
@@index([startsAt, endsAt])
@@index([assignmentId])
@@index([tokenHash])
@@index([userId, deviceId])
```

Use pagination for admin lists.

Never load all events/check-ins/rechecks without pagination.

Use `select` instead of loading full models when possible.

Use transactions for multi-step writes:

- create event + assignments
- check-in + assignment status update + recheck creation
- recheck submit + proof creation + recheck update
- checkout + assignment finalization

### API

Keep route handlers thin.

Route handler responsibilities:

1. authenticate
2. authorize
3. validate input
4. rate limit
5. call service function
6. return response

Business logic should live in `services/`.

### Images

Photo uploads should not be stored directly in PostgreSQL.

Use one of:

- S3-compatible storage
- Cloudinary
- UploadThing
- local storage only for development

Store only the photo URL/path in the database.

Add image size/type validation:

```txt
Allowed: jpg, jpeg, png, webp
Max size: 5MB
```

### Rechecks

Do not run long background loops inside Next.js serverless functions.

Use a cron route:

```txt
/api/cron/rechecks
```

The cron route should:

1. activate scheduled rechecks
2. send notifications
3. mark expired rechecks as missed
4. avoid double-processing with a lock

Use Redis or a database lock to avoid duplicate cron processing.

---

## Testing Requirements

Add tests from the beginning.

### Unit Tests

Test pure functions:

- distance calculation
- GPS freshness check
- attendance status calculation
- token hashing/comparison
- random recheck time generation
- validation schemas

Example files:

```txt
src/tests/unit/geo.test.ts
src/tests/unit/recheck-scheduler.test.ts
src/tests/unit/status.test.ts
```

### Integration Tests

Test route handlers/services with database test setup:

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

### E2E Tests

Use Playwright for main user flows:

1. Admin login → create event → assign employee
2. Employee login → see event → check in
3. Recheck link opens → submit recheck
4. Employee checkout
5. Admin sees timeline

Mock geolocation in Playwright tests.

### Security Tests

Include tests for:

- missing session returns 401
- wrong role returns 403
- invalid recheck token returns 404 or 400
- expired token fails
- reused token fails
- rate-limited request returns 429
- direct employeeId spoofing does not work

---

## Validation Requirements

Use Zod for all request bodies.

Create:

```txt
src/lib/validators.ts
```

Example schemas:

```ts
import { z } from "zod";

export const locationPayloadSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(5000),
  gpsTimestamp: z.coerce.date(),
  deviceId: z.string().uuid(),
});

export const createEventSchema = z.object({
  name: z.string().min(2).max(100),
  locationName: z.string().min(2).max(150),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(20).max(1000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  employeeIds: z.array(z.string()).min(1),
  recheckCount: z.number().int().min(0).max(5),
  recheckWindowMin: z.number().int().min(5).max(30),
  requirePhoto: z.boolean(),
  requireCheckout: z.boolean(),
});
```

---

## Prisma Models

Add app-specific models beside Better Auth models.

Prefer enums instead of raw strings.

```prisma
enum UserRole {
  ADMIN
  EMPLOYEE
}

enum AssignmentStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SUSPICIOUS
  FAILED
  MISSED
}

enum ProofType {
  CHECK_IN
  RECHECK
  CHECK_OUT
}

enum ProofStatus {
  ACCEPTED
  SUSPICIOUS
  REJECTED
}

enum RecheckStatus {
  SCHEDULED
  PENDING
  PASSED
  MISSED
  SUSPICIOUS
  FAILED
}

model Event {
  id               String   @id @default(uuid())
  name             String
  locationName     String
  latitude         Float
  longitude        Float
  radiusMeters     Int      @default(100)
  startsAt         DateTime
  endsAt           DateTime
  recheckCount     Int      @default(2)
  recheckWindowMin Int      @default(10)
  requirePhoto     Boolean  @default(true)
  requireCheckout  Boolean  @default(true)
  createdById      String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  assignments      EventAssignment[]

  @@index([startsAt, endsAt])
}

model EventAssignment {
  id           String           @id @default(uuid())
  eventId      String
  employeeId   String
  status       AssignmentStatus @default(PENDING)
  checkedInAt  DateTime?
  checkedOutAt DateTime?
  finalReason  String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  event         Event            @relation(fields: [eventId], references: [id], onDelete: Cascade)
  proofs        EventProof[]
  rechecks      EventRecheck[]

  @@unique([eventId, employeeId])
  @@index([employeeId])
  @@index([eventId])
  @@index([status])
}

model EventProof {
  id              String      @id @default(uuid())
  assignmentId    String
  employeeId      String
  type            ProofType
  latitude        Float
  longitude       Float
  accuracyMeters  Float
  distanceMeters  Float
  gpsTimestamp    DateTime
  photoUrl        String?
  status          ProofStatus
  reason          String?
  createdAt       DateTime    @default(now())

  assignment      EventAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@index([assignmentId])
  @@index([employeeId])
  @@index([type])
  @@index([status])
}

model EventRecheck {
  id              String        @id @default(uuid())
  assignmentId    String
  employeeId      String
  tokenHash       String        @unique
  startsAt        DateTime
  expiresAt       DateTime
  notificationSentAt DateTime?
  submittedAt     DateTime?
  status          RecheckStatus @default(SCHEDULED)
  reason          String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  assignment      EventAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@index([assignmentId])
  @@index([employeeId])
  @@index([startsAt, expiresAt])
  @@index([status])
}

model UserDevice {
  id         String   @id @default(uuid())
  userId     String
  deviceId   String
  userAgent  String?
  isTrusted  Boolean  @default(false)
  approvedAt DateTime?
  rejectedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, deviceId])
  @@index([userId])
  @@index([isTrusted])
}
```

If Better Auth user model already exists, add `role` to the user model or create a separate profile table that links to Better Auth user ID.

---

## API Contract

### Admin

```txt
POST   /api/admin/events
GET    /api/admin/events
GET    /api/admin/events/:eventId
PATCH  /api/admin/events/:eventId
GET    /api/admin/events/:eventId/employees
GET    /api/admin/events/:eventId/timeline
GET    /api/admin/devices
POST   /api/admin/devices/:deviceId/approve
POST   /api/admin/devices/:deviceId/reject
```

### Employee

```txt
GET    /api/employee/events
GET    /api/employee/events/:eventId
POST   /api/employee/events/:eventId/check-in
POST   /api/employee/events/:eventId/check-out
```

### Rechecks

```txt
GET    /api/rechecks/:token
POST   /api/rechecks/:token/submit
```

### Cron

```txt
GET    /api/cron/rechecks
```

---


## Design System Requirements

Build a polished, scalable design system before implementing the main pages. The app must support:

- light theme
- dark theme
- English language
- Arabic language
- LTR layout for English
- RTL layout for Arabic
- mobile-first employee screens
- responsive admin dashboard screens
- accessible colors and components

Use semantic design tokens instead of hardcoded colors inside components.

---

### Design Direction

The product should feel:

```txt
Professional
Trustworthy
Clean
Government/enterprise-friendly
Mobile-first for employees
Dashboard-focused for admins
```

Avoid flashy colors. The UI is for attendance verification, field employees, and admins, so clarity is more important than decoration.

---

### Color Palette

Use this palette as the base design system.

#### Brand Colors

```txt
Primary:        #2563EB  // blue-600
Primary Hover:  #1D4ED8  // blue-700
Primary Soft:   #DBEAFE  // blue-100
Primary Dark:   #1E3A8A  // blue-900
```

#### Neutral Colors

```txt
White:          #FFFFFF
Gray 50:        #F9FAFB
Gray 100:       #F3F4F6
Gray 200:       #E5E7EB
Gray 300:       #D1D5DB
Gray 400:       #9CA3AF
Gray 500:       #6B7280
Gray 600:       #4B5563
Gray 700:       #374151
Gray 800:       #1F2937
Gray 900:       #111827
Black:          #020617
```

#### Status Colors

```txt
Success:        #16A34A  // accepted, completed, passed
Warning:        #F59E0B  // suspicious, low accuracy, needs review
Danger:         #DC2626  // failed, rejected, missed
Info:           #0EA5E9  // active, pending, in progress
```

#### Location/Verification Colors

```txt
GPS Active:     #2563EB
Inside Radius:  #16A34A
Low Accuracy:   #F59E0B
Outside Radius: #DC2626
Device Trusted: #16A34A
Device Pending: #F59E0B
```

---

### Light Theme Tokens

Use CSS variables for theme tokens.

```css
:root {
  --background: #f9fafb;
  --foreground: #111827;

  --card: #ffffff;
  --card-foreground: #111827;

  --popover: #ffffff;
  --popover-foreground: #111827;

  --primary: #2563eb;
  --primary-foreground: #ffffff;

  --secondary: #f3f4f6;
  --secondary-foreground: #1f2937;

  --muted: #f3f4f6;
  --muted-foreground: #6b7280;

  --accent: #dbeafe;
  --accent-foreground: #1e3a8a;

  --success: #16a34a;
  --success-foreground: #ffffff;

  --warning: #f59e0b;
  --warning-foreground: #111827;

  --danger: #dc2626;
  --danger-foreground: #ffffff;

  --border: #e5e7eb;
  --input: #e5e7eb;
  --ring: #2563eb;

  --radius: 0.75rem;
}
```

---

### Dark Theme Tokens

```css
.dark {
  --background: #020617;
  --foreground: #f9fafb;

  --card: #0f172a;
  --card-foreground: #f9fafb;

  --popover: #0f172a;
  --popover-foreground: #f9fafb;

  --primary: #3b82f6;
  --primary-foreground: #ffffff;

  --secondary: #1e293b;
  --secondary-foreground: #e5e7eb;

  --muted: #1e293b;
  --muted-foreground: #94a3b8;

  --accent: #1e3a8a;
  --accent-foreground: #dbeafe;

  --success: #22c55e;
  --success-foreground: #052e16;

  --warning: #fbbf24;
  --warning-foreground: #422006;

  --danger: #ef4444;
  --danger-foreground: #ffffff;

  --border: #1e293b;
  --input: #334155;
  --ring: #3b82f6;
}
```

---

### Tailwind Theme Mapping

Map Tailwind colors to CSS variables. Components should use semantic classes like `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, and `border-border`.

Example Tailwind config direction:

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
```

If using raw hex CSS variables instead of HSL values, either convert the token values to HSL components or use direct CSS variables like `rgb(var(--background))`. Keep the implementation consistent.

---

### Theme Toggle

Add a theme toggle with three modes:

```txt
Light
Dark
System
```

Store the selected theme in local storage.

Recommended package:

```txt
next-themes
```

Theme toggle behavior:

```txt
Light  -> force light theme
Dark   -> force dark theme
System -> follow device preference
```

Create:

```txt
src/components/theme/theme-provider.tsx
src/components/theme/theme-toggle.tsx
```

The theme toggle should be available in:

```txt
Admin topbar
Employee profile/settings menu
Login page footer or corner
```

---

### English / Arabic Internationalization

The app must support:

```txt
English: en, LTR
Arabic: ar, RTL
```

Use a locale-based route structure:

```txt
src/app/[locale]/...
```

Recommended routes:

```txt
/en/login
/ar/login
/en/employee/events
/ar/employee/events
/en/admin/events
/ar/admin/events
```

Recommended translation files:

```txt
messages/
  en.json
  ar.json
```

Do not hardcode user-facing text inside components. Use translation keys.

Example keys:

```json
{
  "common": {
    "login": "Login",
    "logout": "Logout",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "loading": "Loading...",
    "language": "Language",
    "theme": "Theme"
  },
  "employee": {
    "myEvents": "My Events",
    "activeEvents": "Active Events",
    "checkIn": "Check In",
    "checkOut": "Check Out",
    "recheckRequired": "Recheck Required",
    "getLocation": "Get My Location",
    "takePhoto": "Take Photo",
    "submitCheckIn": "Submit Check-in",
    "submitRecheck": "Submit Recheck",
    "submitCheckout": "Submit Checkout"
  },
  "admin": {
    "dashboard": "Dashboard",
    "events": "Events",
    "createEvent": "Create Event",
    "employees": "Employees",
    "timeline": "Timeline",
    "devices": "Devices"
  }
}
```

Arabic file should use natural Arabic, not literal machine-style translation.

Example Arabic keys:

```json
{
  "common": {
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "save": "حفظ",
    "cancel": "إلغاء",
    "submit": "إرسال",
    "loading": "جاري التحميل...",
    "language": "اللغة",
    "theme": "المظهر"
  },
  "employee": {
    "myEvents": "فعالياتي",
    "activeEvents": "الفعاليات المتاحة",
    "checkIn": "تسجيل الحضور",
    "checkOut": "تسجيل المغادرة",
    "recheckRequired": "مطلوب تأكيد التواجد",
    "getLocation": "تحديد موقعي الحالي",
    "takePhoto": "التقاط صورة",
    "submitCheckIn": "إرسال تسجيل الحضور",
    "submitRecheck": "إرسال تأكيد التواجد",
    "submitCheckout": "إرسال تسجيل المغادرة"
  },
  "admin": {
    "dashboard": "لوحة التحكم",
    "events": "الفعاليات",
    "createEvent": "إنشاء فعالية",
    "employees": "الموظفون",
    "timeline": "السجل الزمني",
    "devices": "الأجهزة"
  }
}
```

---

### Language Toggle

Add a language toggle:

```txt
English | العربية
```

Requirements:

- Switching language keeps the user on the same logical page.
- `/en/employee/events` should switch to `/ar/employee/events`.
- `/ar/admin/events/create` should switch to `/en/admin/events/create`.
- Store preferred locale in a cookie or local storage.
- Set the document `lang` attribute.
- Set the document `dir` attribute:
  - `dir="ltr"` for English
  - `dir="rtl"` for Arabic

Create:

```txt
src/components/i18n/language-toggle.tsx
src/lib/i18n.ts
messages/en.json
messages/ar.json
```

Root layout should apply locale direction:

```tsx
export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: "en" | "ar" };
}) {
  const dir = params.locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={params.locale} dir={dir} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

---

### RTL / Arabic UI Rules

Arabic mode must not just translate text. It must also mirror layout direction.

Requirements:

```txt
Sidebar moves to the right in Arabic
Back icons flip direction in Arabic
Breadcrumb separators support RTL
Tables remain readable
Forms align labels correctly
Input text direction follows language unless field is numeric/email/password
Status badges remain visually consistent
Map coordinates and numbers can remain LTR for readability
```

Use logical CSS properties when possible:

```txt
ms-* instead of ml-*
me-* instead of mr-*
ps-* instead of pl-*
pe-* instead of pr-*
start-* instead of left-*
end-* instead of right-*
```

Avoid hardcoding `left`, `right`, `ml`, `mr`, `pl`, and `pr` unless there is a strong reason.

For icons that indicate direction, use a helper:

```ts
const isRtl = locale === "ar";
```

Then rotate/replace icons where needed.

---

### Typography

Use fonts that support English and Arabic well.

Recommended:

```txt
English/UI: Inter
Arabic/UI: Noto Sans Arabic or IBM Plex Sans Arabic
```

If using `next/font`, configure separate font variables:

```txt
--font-sans
--font-arabic
```

Apply Arabic font when locale is `ar`.

Text sizes:

```txt
Page title:      text-2xl / font-semibold
Section title:   text-lg / font-semibold
Card title:      text-base / font-semibold
Body text:       text-sm or text-base
Help text:       text-sm / text-muted-foreground
Badge text:      text-xs / font-medium
```

---

### Component System

Create reusable UI components instead of styling every page manually.

Required components:

```txt
Button
Input
Textarea
Select
Checkbox
Label
Card
Badge
Alert
Dialog/Modal
Dropdown Menu
Tabs
Table
Pagination
Skeleton
Empty State
Loading Spinner
Toast
Theme Toggle
Language Toggle
Status Badge
Event Card
Proof Timeline
Location Capture Card
Photo Capture Card
Countdown Timer
```

Recommended structure:

```txt
src/components/ui/
  button.tsx
  input.tsx
  card.tsx
  badge.tsx
  alert.tsx
  dialog.tsx
  table.tsx
  skeleton.tsx
  empty-state.tsx

src/components/shared/
  status-badge.tsx
  theme-toggle.tsx
  language-toggle.tsx
  countdown-timer.tsx

src/components/employee/
  event-card.tsx
  location-capture-card.tsx
  photo-capture-card.tsx

src/components/admin/
  event-stats-cards.tsx
  proof-timeline.tsx
  employee-status-table.tsx
```

Use one consistent component style. Shadcn/ui is acceptable, but customize it through design tokens and keep components accessible.

---

### Status Badge Design

Use consistent labels and colors.

```txt
PENDING      -> gray / Pending
IN_PROGRESS  -> blue / In Progress
COMPLETED    -> green / Completed
SUSPICIOUS   -> amber / Suspicious
FAILED       -> red / Failed
MISSED       -> red / Missed
```

For proof statuses:

```txt
ACCEPTED     -> green / Accepted
SUSPICIOUS   -> amber / Needs Review
REJECTED     -> red / Rejected
```

Arabic labels:

```txt
PENDING      -> قيد الانتظار
IN_PROGRESS  -> قيد التنفيذ
COMPLETED    -> مكتمل
SUSPICIOUS   -> يحتاج مراجعة
FAILED       -> فشل
MISSED       -> فائت
ACCEPTED     -> مقبول
REJECTED     -> مرفوض
```

Status labels must come from translation files.

---

### Employee Mobile UX

Employee screens must be optimized for mobile first.

Main employee UI principles:

```txt
One primary action per screen
Large touch targets
Clear step-by-step instructions
Minimal dashboard complexity
Visible success/error feedback
No hidden important state
```

Employee event card example:

```txt
City Mall Event
10:00 AM - 2:00 PM
City Mall, Amman
Status: Not Checked In

[Open Event]
```

Check-in/recheck screens should use a step card pattern:

```txt
Step 1: Capture location
Step 2: Take photo
Step 3: Submit
```

---

### Admin Dashboard UX

Admin screens can be denser but must stay readable.

Admin dashboard should include:

```txt
Stats cards
Event table
Employee status table
Timeline view
Device approval queue
Filters by status/date/event
Search by employee name
Pagination
```

Admin event details should show:

```txt
Assigned count
Checked-in count
Completed count
Suspicious count
Missed/failed count
Map/location summary
Timeline table
```

---

### Accessibility Requirements

Design system must follow accessibility basics:

```txt
Keyboard navigable components
Visible focus states
Sufficient color contrast
Buttons have accessible labels
Inputs have labels
Errors are announced clearly
Language is set on html element
Direction is set on html element
Do not rely on color alone for status
```

For buttons, always show text or `aria-label`.

For status badges, include both color and text.

---

### Design System Definition of Done

The design system is complete only when:

- Light theme works.
- Dark theme works.
- Theme preference persists.
- English language works.
- Arabic language works.
- Language preference persists.
- RTL layout works for Arabic.
- Admin sidebar mirrors correctly in Arabic.
- Employee mobile pages are readable in both languages.
- No user-facing text is hardcoded in components.
- Status badges use semantic colors and translated labels.
- Forms, tables, cards, and timelines work in light/dark and LTR/RTL.

---

## Frontend UX Requirements

### Employee Pages

Employee should see a simple mobile-first UI.

Required pages:

```txt
/login
/employee/events
/employee/events/[eventId]
/employee/events/[eventId]/check-in
/recheck/[token]
/employee/events/[eventId]/check-out
```

### Employee Event Card

Show:

```txt
Event name
Location name
Start/end time
Current status
Main action button
```

### Employee Event Details

Show:

```txt
Status
Check-in time if available
Recheck summary
Checkout status
Instructions
```

Do not show future random recheck times.

### Check-in Page

Show steps:

```txt
1. Get current location
2. Take photo
3. Submit check-in
```

### Recheck Page

Show:

```txt
Event name
Countdown timer
Get current location
Take photo
Submit recheck
```

### Checkout Page

Show:

```txt
Get current location
Optional photo
Submit checkout
```

---

## Frontend Geolocation Helper

Create:

```ts
// src/lib/browser-location.ts
export function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}
```

Use `maximumAge: 0` so the browser attempts to provide a fresh location.

---

## Security Requirements

- Never expose raw recheck tokens in the database.
- Store only token hashes.
- Recheck token must be one-time use.
- Recheck token must expire.
- Do not accept employee IDs from employee-facing requests.
- Validate all request bodies with Zod.
- Rate limit sensitive endpoints.
- Use HTTPS in production.
- Use secure cookies in production.
- Use CSRF-safe patterns for mutations.
- Keep route handlers private by default.
- Do not cache private responses globally.
- Log suspicious events.
- Do not store photos in the database.
- Do not trust GPS alone; use GPS + photo + device + time window.

---

## Error Handling

Create consistent API response helpers:

```ts
export function apiError(message: string, status = 400) {
  return Response.json({ message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
```

Use standard status codes:

```txt
400 validation error
401 unauthenticated
403 forbidden
404 not found
409 conflict / duplicate action
429 rate limited
500 unexpected server error
```

---

## Implementation Order

Build in this order:

1. Project setup
2. Design system setup: tokens, light/dark theme, shared UI components
3. English/Arabic i18n setup with LTR/RTL routing
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

---

## Definition of Done

The feature is complete only when:

- Light and dark themes work across the app.
- English and Arabic language toggle works.
- Arabic RTL layout works correctly.
- Admin can create event and assign employees.
- Employee can only see assigned events.
- Employee can check in only when inside geofence.
- Device binding works.
- Rechecks are generated randomly.
- Recheck link expires and is one-time use.
- Recheck submission verifies GPS/photo/device.
- Checkout works.
- Admin timeline shows all proof records.
- Rate limits exist on sensitive endpoints.
- Private data is not globally cached.
- Critical queries have indexes.
- Unit tests cover location/status/token logic.
- Integration tests cover auth, permissions, check-in, recheck, and checkout.
- E2E test covers the full admin + employee flow.

---

## Important Notes for Claude

When implementing, do not dump all code at once.

Work step by step:

1. Explain the files you will create or edit.
2. Implement the smallest complete feature.
3. Keep code typed and clean.
4. Avoid unnecessary abstractions.
5. Keep business logic in services, not page components.
6. Keep route handlers thin.
7. Add validation before database writes.
8. Add tests for every important rule.
9. Optimize queries using indexes, select, pagination, and transactions.
10. Prioritize security over convenience.

