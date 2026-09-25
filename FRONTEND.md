# PLEDGR frontend

## Where to work

```text
app/
  (auth)/                 Login/register routes and their shared auth design
  (dashboard)/            Small route entry files, layout, loading and error boundaries
  api/                    Existing backend endpoints
  globals.css             Shared PLEDGR colors, typography and reusable CSS classes
features/
  dashboard/              Organization discovery screen and its components
  history/                Activity history screen
  profile/                Profile screen, components and shared profile query
  organization/           Organization screen, components and data hook
  group/                  Group screen, components and data hook
  proposal/               Proposal screen and proposal dialogs/cards
components/
  layout/                 Persistent sidebar, header and dashboard providers
  ui/                     Shared heading, loading/error/empty states and native dialog
context/WalletContext.tsx Wallet connection state backed by the shared profile query
lib/api-client.ts         Authenticated fetch helper and HTTP errors
lib/blockchain.ts         Existing signing/contract logic, loaded on contribution
types/                   Shared domain types; no imports from page files
```

The public URLs have not changed. A route's `page.tsx` points to its feature screen. Edit `features/<feature>/` for UI and behavior, and keep unrelated features out of that screen's imports. The auth pages remain together under their route group.

## Design

Cream surfaces, black borders, hard shadows, lime highlights and purple actions match the auth pages. The shared tokens live in `app/globals.css`; shell positioning lives in `components/layout/DashboardShell.module.css`. Reuse `shared panel`, `shared button`, `PageHeading`, `ContentState` and `Modal`. The native dialog traps focus and supports Escape. Wallet labels use BOT, matching the existing BOT Chain configuration; the contribution amount and contract call are unchanged.

## Loading and data

- `DashboardProviders` owns one TanStack Query client per dashboard mount. It is not mounted on login/register, and unmounting the dashboard drops the private query cache.
- Queries are fresh for 30 seconds. Returning to a recently visited screen uses cached data; stale data can refresh in the background. Active queries also refresh on window focus when stale. Do not change this to indefinite caching for financial data.
- Sidebar, wallet and profile consume the same `profile` query. Concurrent requests are deduplicated. Wallet save updates that query directly, without a full reload.
- Create/join dialogs are dynamically imported and mounted only while open. Cancelling a dashboard dialog does not refresh organizations; successful changes invalidate the relevant query.
- The blockchain library is imported inside the contribution action. Merely opening login, dashboard or a proposal does not import that library through the wallet provider.
- The backend and contract remain authoritative. These client-side roles, routes and disabled states are not security checks.

## Development and verification

Use `npm run dev` while working. Development mode compiles routes on first visit, so first navigation is not a production performance benchmark. Run `npm run build` and `npm start` for representative performance, after configuring the project's real environment variables.

The existing backend requires `MONGODB_URI`; the build can compile the frontend successfully yet fail when collecting API route data if that value is missing. Do not commit secrets or use fake production credentials to hide that issue. Database workflows and wallet transactions must be verified against the team's configured test environment.

No new packages are required. Folder moves improve maintainability; the actual loading changes come from query reuse, deferred imports and removal of full-page refreshes. No measured latency or bundle-size improvement is claimed without a production baseline.
