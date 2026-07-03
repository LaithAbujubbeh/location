# Location Attendance

Location-based attendance and recheck verification built with Next.js App Router, TypeScript, Better Auth, Prisma, PostgreSQL, Tailwind CSS, and English/Arabic i18n.

## Local Development

```bash
npm install
npm run dev
```

Use `.env.example` as the template for local environment variables. Real `.env*` files are ignored by git and must not be committed.

## Required Environment Variables

- `DATABASE_URL`: pooled Neon/PostgreSQL runtime connection string.
- `DIRECT_URL`: direct Neon/PostgreSQL connection for Prisma CLI and migrations.
- `BETTER_AUTH_SECRET`: strong random secret for Better Auth.
- `BETTER_AUTH_URL`: canonical app URL used by Better Auth.
- `APP_URL`: canonical app URL used to generate recheck links.
- `CRON_SECRET`: strong random secret required by `/api/cron/rechecks`.
- `RESEND_API_KEY`: optional, enables email notifications when present.
- `RESEND_FROM_EMAIL`: optional, must be a verified Resend sender when email is enabled.

## Production Security Notes

- Deploy behind HTTPS only. Session cookies must only travel over HTTPS in production.
- Configure all required variables in Vercel Project Settings, not in committed files.
- Set `BETTER_AUTH_URL` and `APP_URL` to the same production HTTPS origin, for example `https://attendance.example.com`.
- Use `next build` and `next start` or Vercel-managed production builds. Do not expose `next dev` publicly.
- Keep `CRON_SECRET` private and send it as `Authorization: Bearer <secret>` when calling `/api/cron/rechecks`.
- Rotate secrets immediately if any `.env` file or token is exposed.
- Optional Resend settings may be absent; cron still creates in-app notifications and skips email safely.

## Verification

```bash
npm run lint
npm run typecheck
npm test
```
