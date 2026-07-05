### Employee Checkout Step Flow

File: src/components/employee/employee-check-out-client.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, tone borders such as `border-warning/30` |
| Border radius    | `rounded-lg` for cards, `rounded-md` for nested items, buttons, badges, and step numbers |
| Text primary     | `text-foreground`, `text-primary`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-4`, `gap-3`, `p-4 sm:p-5`, nested `px-3 py-3` |
| Hover state      | `hover:bg-primary-hover`, `hover:bg-surface-subtle`, `hover:text-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | `bg-primary-soft text-primary-dark`, status tones `success`, `warning`, `danger`, `info` |

**Pattern notes:**
Employee action flows use a mobile-first grid of bordered cards with compact 8px-radius inner panels. Step cards show a numbered `bg-primary-soft` marker, a neutral badge for step state, and full-width primary buttons on mobile that shrink to fit on larger screens. GPS/result data uses `dl` grids with `min-w-0` and `break-words` so coordinates, device IDs, and localized labels do not overflow in English or Arabic.
