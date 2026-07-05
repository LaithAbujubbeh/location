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
Admin map inputs sit inside the existing form card rather than becoming a separate page surface. The map loads client-only, imports Leaflet CSS beside the map component, keeps OSM attribution visible, uses scoped token-based marker/control styling for light and dark themes, and pairs full-width mobile search/location buttons with compact helper text that wraps safely in LTR and RTL layouts. Leaflet map internals are forced to LTR inside the scoped map frame and use a shared size-sync helper so Arabic pages do not offset or leave blank tile areas. Search results use a bounded, scrollable list so long place names do not stretch the form.

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
Admin detail pages compose compact dashboard cards with `dl` info grids so localized labels and coordinates wrap without overflow. Employee status uses mobile cards below `lg` and a contained desktop table with `min-w` inside `overflow-x-auto`. The location map is read-only, client-only, visually matches the editable map without search/current-location controls, and keeps Leaflet internals LTR even on Arabic pages so map tiles fill the frame correctly.

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
Admin timeline pages group private proof and recheck records by employee in stacked cards instead of dense tables. Each proof/recheck record uses the same compact `dl` info grid as event details, so GPS values, reasons, and photo URLs wrap safely on mobile and in RTL layouts. Proof records include a read-only Leaflet map in a `rounded-md border border-border bg-surface-subtle` frame, with the event marker/radius in primary and the submitted proof marker/accuracy circle in warning. Filters stack on mobile and expand into one row on desktop without replacing the entire page during refetches.

### Admin Timeline Proof Map

File: src/components/admin/admin-proof-location-map.tsx, src/components/admin/admin-event-timeline-client.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-subtle` map frame |
| Border           | `border border-border` |
| Border radius    | `rounded-md` |
| Text primary     | none inside map |
| Text secondary   | legend uses `text-text-muted` |
| Spacing          | map block `gap-2`, legend `min-[390px]:grid-cols-2` |
| Hover state      | none |
| Shadow           | marker dots use existing map marker shadow |
| Accent usage     | Event marker/radius use `--primary`; submitted proof marker/accuracy use `--warning` |

**Pattern notes:**
Timeline proof maps are read-only and embedded inside proof records, not separate cards. They fit bounds around the event center and submitted proof point, disable dragging/scroll zoom to avoid trapping mobile scroll, and keep OSM attribution visible. The shared map frame keeps Leaflet internals LTR and invalidates size after mount/resizes to prevent blank tile bands in RTL layouts. The legend stays short, wraps safely in RTL, and uses text rather than extra custom icons so the map itself remains the primary visual.

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

### Admin Users

File: src/components/admin/admin-users-client.tsx, src/components/admin/admin-user-form.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, `border-input`, tone borders such as `border-danger/25` |
| Border radius    | `rounded-lg` for cards, `rounded-md` for tables, fields, filters, buttons, and notices |
| Text primary     | `text-foreground`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-4`, `gap-3`, `p-4 sm:p-5`, table/filter padding `px-3 py-3` |
| Hover state      | `hover:bg-surface-subtle`, `hover:bg-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | Admin role uses primary badges; employee role uses neutral badges; active status uses success/danger badges; errors use danger notices |

**Pattern notes:**
Admin user management follows the private admin dashboard pattern: responsive mobile cards below `lg`, a contained desktop table, and form cards with single-column mobile layout. User creation/editing keeps email read-only during edit, shows backend validation directly, and uses full-width mobile actions that collapse to compact desktop controls. Active/inactive state is shown as a semantic badge and managed from the same edit form. Create-event employee assignment reuses the user list endpoint as a bounded, searchable checkbox list inside the existing event form.

### Notifications

File: src/components/shared/notification-bell.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, `bg-surface`, `bg-surface-subtle` |
| Border           | `border border-border`, `border-border-strong`, tone borders such as `border-danger/25` |
| Border radius    | `rounded-lg` for dropdown panel, `rounded-md` for notification previews, controls, buttons, and notices |
| Text primary     | `text-foreground`, `text-on-primary` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | `gap-3`, dropdown `p-3`, preview `px-3 py-3`, shell control padding `px-3 py-2` |
| Hover state      | `hover:bg-surface-subtle`, `hover:bg-primary-hover` |
| Shadow           | `shadow-[var(--shadow-sm)]` |
| Accent usage     | Unread count badge uses `bg-danger text-on-primary`; type badges use semantic tones |

**Pattern notes:**
Notifications live in a topbar bell dropdown rather than a standalone page. The bell is an icon-only `rounded-md border border-border bg-surface` button with an absolute danger unread badge. The dropdown renders through a body portal as a `fixed z-[1300]` panel, calculating its viewport position from the bell button so it stays anchored to the trigger and above Leaflet map panes in both LTR and RTL layouts. On narrow screens it uses 16px side insets; on larger screens it keeps a 384px panel width. Notification previews use compact bordered rows, wrapped message text, full-width mobile actions, localized open actions that mark the item read before navigation, and danger delete actions for one item or all current-user notifications.

### Admin Mobile Sidebar

File: src/components/layout/admin-mobile-sidebar.tsx, src/components/layout/admin-shell.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated`, backdrop `bg-foreground/15` |
| Border           | `border-e border-border`, `border-b border-border`, `border-t border-border` |
| Border radius    | `rounded-md` for nav links and controls |
| Text primary     | `text-foreground` |
| Text secondary   | `text-text-muted`, `text-text-subtle` |
| Spacing          | header `p-4 sm:p-5`, nav `p-3`, footer `p-5`, `gap-3`, `gap-4` |
| Hover state      | `hover:bg-surface-subtle`, `hover:text-foreground` |
| Shadow           | `shadow-[var(--shadow-md)]` |
| Accent usage     | none |

**Pattern notes:**
The admin mobile drawer and backdrop render through a body portal so the outside-click layer covers the full viewport instead of being trapped by the header stacking context. The portaled backdrop/drawer use explicit overlay `zIndex` values to sit above the sticky header. It uses a light touch outside backdrop (`bg-foreground/15`) and closes on outside pointer down, Escape, nav link selection, or the close control. Header controls like notifications remain part of the topbar stacking flow; only opened overlay panels should portal above page content.

### App Shell Stacking

File: src/components/layout/admin-shell.tsx, src/components/layout/employee-shell.tsx
Last updated: 2026-07-05

| Property         | Class           |
| ---------------- | --------------- |
| Background       | `bg-surface-elevated/95`, desktop admin `lg:bg-transparent` |
| Border           | `border-b border-border`, employee bottom nav `border-t border-border` |
| Border radius    | none at shell level |
| Text primary     | `text-foreground` |
| Text secondary   | `text-text-muted` |
| Spacing          | header `px-4 py-3`, mobile `gap-3`, desktop admin `lg:px-6` |
| Hover state      | inherited from controls |
| Shadow           | `shadow-[var(--shadow-sm)]`, employee bottom nav `shadow-[var(--shadow-md)]` |
| Accent usage     | none |

**Pattern notes:**
Sticky mobile app chrome uses `z-[900]` so it stays above Leaflet panes and controls (`z-index: 800`) while remaining below notification dropdown portals (`z-[1300]`) and mobile sidebar overlays (`zIndex: 2000+`). Keep map layering contained below shell chrome rather than raising individual map panes.
