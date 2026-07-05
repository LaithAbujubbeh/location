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

### Admin Event Management

File: src/components/admin/admin-events-client.tsx, src/components/admin/admin-create-event-client.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, `border-input`, tone borders such as `border-danger/25` |
| Border radius    | `rounded-lg` for cards, `rounded-md` for tables, fields, nested sections, buttons, and notices |
| Text primary     | `text-foreground`, `text-primary`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-4`, `gap-3`, `p-4 sm:p-5`, field padding `px-3 py-2`, nested panel padding `px-3 py-3` |
| Hover state      | `hover:bg-primary-hover`, `hover:bg-surface-subtle`, `hover:text-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | Primary create/submit actions use `bg-primary`; status and validation use semantic `success`, `warning`, `danger`, and `info` tones |

**Pattern notes:**
Admin list pages use mobile cards below `lg` and a contained `overflow-x-auto` table at desktop. Admin forms use stacked cards, single-column mobile sections, `md:grid-cols-2` only when fields have enough room, and full-width mobile buttons. Temporary operational constraints should appear as semantic notice boxes rather than inline helper text alone.

### Admin Location Picker Map

File: src/components/admin/location-picker-map.tsx, src/components/admin/admin-create-event-client.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-subtle`, Leaflet controls using `--surface-elevated` |
| Border           | `border border-border` |
| Border radius    | `rounded-md` for the map frame and controls |
| Text primary     | `text-foreground` |
| Text secondary   | `text-text-muted` |
| Spacing          | `gap-3`, search form `sm:grid-cols-[minmax(0,1fr)_auto]`, map section `md:col-span-2` |
| Height           | `h-[300px] sm:h-[360px] lg:h-[420px]` |
| Accent usage     | Marker and radius circle use `--primary`; errors use `text-danger` |

**Pattern notes:**
Admin map inputs sit inside the existing form card rather than becoming a separate page surface. The map loads client-only, imports Leaflet CSS beside the map component, keeps OSM attribution visible, uses scoped token-based marker/control styling for light and dark themes, and pairs full-width mobile search/location buttons with compact helper text that wraps safely in LTR and RTL layouts. Search results use a bounded, scrollable list so long place names do not stretch the form.

### Admin Event Details

File: src/components/admin/admin-event-detail-client.tsx, src/components/admin/admin-event-location-map.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, tone borders such as `border-danger/25` |
| Border radius    | `rounded-lg` for cards and stat cards, `rounded-md` for tables, info items, notices, and map frame |
| Text primary     | `text-foreground`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-4`, `gap-3`, `p-4 sm:p-5`, stat padding `px-4 py-4`, info item padding `px-3 py-3` |
| Hover state      | `hover:bg-surface-subtle`, `hover:bg-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | Status badges use semantic tones; map marker and radius circle use `--primary` |

**Pattern notes:**
Admin detail pages compose compact dashboard cards with `dl` info grids so localized labels and coordinates wrap without overflow. Employee status uses mobile cards below `lg` and a contained desktop table with `min-w` inside `overflow-x-auto`. The location map is read-only, client-only, and visually matches the editable map without search/current-location controls.

### Admin Timeline

File: src/components/admin/admin-event-timeline-client.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, tone borders such as `border-danger/25` |
| Border radius    | `rounded-lg` for employee timeline cards, `rounded-md` for proof/recheck records, filters, and notices |
| Text primary     | `text-foreground`, `text-primary`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-4`, `gap-3`, card `p-4 sm:p-5`, record padding `px-3 py-3` |
| Hover state      | `hover:bg-surface-subtle`, `hover:bg-primary-hover`, `hover:text-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | Proof and recheck status badges use semantic tones; photo links use `text-primary` |

**Pattern notes:**
Admin timeline pages group private proof and recheck records by employee in stacked cards instead of dense tables. Each proof/recheck record uses the same compact `dl` info grid as event details, so GPS values, reasons, and photo URLs wrap safely on mobile and in RTL layouts. Filters stack on mobile and expand into one row on desktop without replacing the entire page during refetches.

### Admin Devices

File: src/components/admin/admin-devices-client.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, tone borders such as `border-danger/25` |
| Border radius    | `rounded-lg` for device cards, `rounded-md` for filters, table frame, info items, buttons, and notices |
| Text primary     | `text-foreground`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-4`, `gap-3`, card `p-4 sm:p-5`, info item padding `px-3 py-3` |
| Hover state      | `hover:bg-surface-subtle`, `hover:bg-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | Device status badges use semantic tones; approve uses primary and reject uses danger |

**Pattern notes:**
Admin device review follows the admin list pattern: cards below `lg`, a contained desktop table above `lg`, and client-side status filtering with TanStack Query refetches instead of a full navigation refresh. Long device IDs wrap with `break-all`, user agents truncate in the table, and action buttons are full-width on mobile while shrinking on desktop.
