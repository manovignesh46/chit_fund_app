# Performance notes

How the app keeps pages fast, and what to keep doing when adding features.
(Rewritten in the UI-standard cleanup: the old guide described a SQLite database,
an `apiCache` wrapper for API routes and `lib/hooks.ts`, none of which the app uses.)

## Database and API

- PostgreSQL through Prisma (`lib/prisma`). Handlers run independent queries in
  parallel with `Promise.all`.
- List endpoints paginate in the database. `lib/list/server.ts` `parseListParams`
  reads `page`, `pageSize`, `q`, `sort`, `order` and named filters; sorting only goes
  through each handler's whitelist, with `id` as the tiebreaker. `pageSize` is capped at
  `MAX_PAGE_SIZE` (100, `lib/list/types.ts`) here and in the handlers that parse it by
  hand. A screen that needs every row uses the endpoint's explicit all-rows request
  (e.g. chit fund members `all=1`) or searches on the server (`EntityCombobox`); it never
  asks for `pageSize=1000`.
- Responses carry `meta` next to the legacy keys; rows are not duplicated under `items`.

## Client

- Data goes through SWR (`app/providers.tsx`, `lib/query/*`): request keys
  `[resource, action, id, params]`, 5 s dedupe, `keepPreviousData`, focus revalidation
  throttled to 60 s, a capped cache. Writes invalidate by tag (`lib/query/invalidate.ts`)
  instead of reloading the page.
- Refetches keep the rows on screen (dimmed, `aria-busy`, a thin progress bar after
  150 ms); skeletons only on the very first load.
- Preloads: list rows prefetch their detail when the pointer rests on them
  (`onRowIntent`), the next page loads when the browser is idle (`whenIdle`), and the
  dashboard starts its first requests while its code loads.
- Heavy or rarely opened parts (charts, dialogs, export modals) load with
  `next/dynamic`; toasts load sonner lazily (`lib/toast`).
- One stylesheet of design tokens and Tailwind utilities (`styles/globals.css`,
  `styles/theme/*`); components come from `components/ui` and `components/kit`.
  `node scripts/check-ui-conventions.js` keeps raw palette colours, legacy classes,
  page reloads and oversized page requests out.

## Checking

- Bundle sizes: `npm run analyze` (the `next build` table also lists first-load JS per route).
