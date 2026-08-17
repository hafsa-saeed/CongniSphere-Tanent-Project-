# CogniSphere — Frontend (Phase 3)

React (Vite) + Tailwind CSS. Multi-tenant, RBAC-protected dashboard for
Super Admin, HR/Tenant Admin, and Learner roles.

## Folder structure

```
cognisphere-frontend/
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                        # all routes, grouped by role
    ├── index.css                      # Tailwind + default brand CSS variables
    │
    ├── api/
    │   ├── subdomain.js                # extracts tenant subdomain from window.location
    │   └── axios.js                    # axios instance: dynamic tenant baseURL + JWT + auto-refresh
    │
    ├── context/
    │   ├── TenantContext.jsx           # fetches branding, injects CSS vars (dynamic white-labeling)
    │   └── AuthContext.jsx             # login/register/logout, session hydration via /auth/me
    │
    ├── components/
    │   ├── ProtectedRoute.jsx          # auth + RBAC route guard
    │   ├── layout/
    │   │   ├── DashboardLayout.jsx     # shared shell: sidebar + topbar
    │   │   └── Sidebar.jsx             # nav items, switches by role
    │   └── ui/
    │       ├── StatCard.jsx
    │       ├── ProgressBar.jsx
    │       └── Badge.jsx               # + LockIcon
    │
    └── pages/
        ├── auth/
        │   ├── LoginPage.jsx
        │   └── UnauthorizedPage.jsx
        ├── superadmin/
        │   ├── SuperAdminDashboard.jsx  # dark theme: MRR, tenant count, tenant table
        │   └── TenantManagement.jsx     # onboarding form + full tenant list
        ├── hr/
        │   ├── HrDashboard.jsx          # summary cards + department heatmap + activity table
        │   ├── CourseBuilder.jsx        # drag-and-drop module/lesson builder + file upload
        │   └── QuizCreator.jsx          # question builder + passing threshold setting
        └── learner/
            ├── LearnerDashboard.jsx     # enrolled courses, progress bars, catalog + enroll
            └── CoursePlayer.jsx         # video/PDF viewer, lock states, quiz-taking flow
```

## How dynamic branding + multi-tenancy work here

The API base URL is **not fixed** — `src/api/axios.js` rebuilds it from the browser's current
subdomain on load:

```
Frontend at acme.localhost:3000   ->  API calls go to http://acme.localhost:5000/api/v1
Frontend at localhost:3000        ->  API calls go to http://localhost:5000/api/v1 (Super Admin / root)
```

This matters because the backend's `tenant.middleware.js` resolves the tenant from the **Host
header of the actual API request** — so the API request itself must be made against the tenant's
subdomain, not just the frontend page. `TenantContext.jsx` then calls `GET /tenants/branding`
(automatically tenant-scoped via that same subdomain-aware axios instance) and writes the
returned colors onto `:root` as CSS custom properties (`--color-primary`, `--color-secondary`).
`tailwind.config.js` maps `primary` / `secondary` to those variables, so every `bg-primary`,
`text-primary`, etc. class across the whole app re-themes instantly per tenant with zero
per-component logic.

## Setup

```bash
cp .env.example .env      # set VITE_API_HOST and VITE_ROOT_DOMAIN
npm install
npm run dev                 # starts Vite on port 3000
```

### Local subdomain testing

Add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1   acme.localhost
127.0.0.1   app.localhost
```

Then visit `http://acme.localhost:3000` for the HR/Learner login, or `http://localhost:3000`
(no subdomain) for the Super Admin login. Make sure the backend's `.env` has
`ROOT_DOMAIN=localhost` so its own subdomain resolution matches.

## Super Admin Control Center (latest overhaul)

The Super Admin experience was rebuilt into a dark, glassmorphism-styled SaaS control center:

```
src/
├── lib/
│   └── toast.js                       # react-hot-toast wrapper, dark-themed
├── api/
│   └── superadminApi.js               # every Super Admin endpoint in one place
├── components/ui/
│   ├── Skeleton.jsx                    # SkeletonStatCard / SkeletonChart / SkeletonTable / SkeletonList
│   ├── GlassCard.jsx                   # frosted-glass panel
│   ├── Modal.jsx                       # confirm dialogs (danger tone for destructive actions)
│   ├── Drawer.jsx                      # slide-out panel (Organization Profile)
│   ├── Dropdown.jsx                    # 3-dot quick-actions menu
│   ├── Tabs.jsx                        # tabbed interface (Settings page)
│   └── EmptyState.jsx
└── pages/
    ├── ImpersonatePage.jsx              # NEW — lands an impersonation token, hands off to AuthContext
    └── superadmin/
        ├── SuperAdminDashboard.jsx      # REWRITTEN — trend stat cards, Recharts (MRR line, plan pie, storage bar)
        ├── TenantManagement.jsx         # REWRITTEN — Organizations: searchable/filterable/paginated table,
        │                                  profile drawer, suspend/activate + impersonate + plan-change actions
        ├── BillingPlans.jsx             # NEW — tier quotas + per-organization revenue table
        ├── Broadcasts.jsx               # NEW — create/target/deactivate global announcement banners
        ├── SupportDesk.jsx              # NEW — Kanban-style ticket inbox with reply/status modal
        ├── SystemSettings.jsx           # NEW — tabbed SMTP / Storage / Tier Quotas / Branding config
        └── AuditLogs.jsx                # NEW — paginated platform activity/security history
```

### Impersonation flow ("Login as tenant")

1. Super Admin clicks the quick-actions menu → "Login as tenant" on an organization.
2. `POST /tenants/:id/impersonate` issues a 30-minute JWT scoped to that tenant's first HR admin
   (and logs the action to the audit trail).
3. The frontend opens a new tab at `http://<subdomain>.<ROOT_DOMAIN>:3000/impersonate?token=<jwt>`.
4. `ImpersonatePage.jsx` stores that token exactly like a normal login and hands off to
   `AuthContext.refreshSession()`, landing on the HR dashboard for that tenant.

This only works when `VITE_ROOT_DOMAIN` matches the backend's `ROOT_DOMAIN` and both dev servers
are reachable at `<subdomain>.<root>:5000` / `:3000` — see the hosts-file setup above.

### New backend endpoints this overhaul depends on

All added in this pass, documented in the backend README:
`/tenants/:id/suspend`, `/tenants/:id/activate`, `/tenants/:id/impersonate`, `/tenants/analytics/overview`,
`/broadcasts`, `/support-tickets`, `/settings`, `/audit-logs`.

## HR Admin Dashboard (Tenant Control Center)

The HR side was rebuilt to match the Super Admin's dark theme, reusing the same `GlassCard` /
`Modal` / `Drawer` / `Skeleton` / toast kit:

```
src/
├── api/
│   └── hrApi.js                        # every HR endpoint in one place
├── components/
│   └── CogniCopilot.jsx                # floating AI chat widget (framer-motion), HR-only
└── pages/hr/
    ├── HrOverview.jsx                   # Overview & Analytics — gauges, monthly line chart, pass/fail donut
    ├── OrganizationProfile.jsx          # branding, subdomain, seat/storage usage gauges
    ├── CourseList.jsx + CourseManager.jsx  # course catalog + drag-and-drop video/PDF builder
    │                                       with a Draft/Published toggle
    ├── QuizArchitect.jsx                # AI Quiz Architect — simulated draft generation +
    │                                       full human-in-the-loop question editor
    ├── LearnerResultsVault.jsx          # per-course results table, per-learner answer-breakdown
    │                                       drawer, CSV export (client-side, no backend round trip)
    ├── CertificateEngine.jsx            # dynamic-token template config + live preview + signature
    ├── LearnerDeptDirectory.jsx         # add/import (CSV) learners, department grouping, assign course
    └── HelpSupport.jsx                  # contact form → Super Admin Support Desk
```

### AI features are explicitly simulated, by design

`QuizArchitect.jsx`'s "Generate Quiz with AI" and `CogniCopilot.jsx`'s chat replies both run
entirely client-side with template-based canned generation — there is no LLM call. Both are
commented at the simulation site explaining what a real integration would look like: a backend
endpoint that calls the Anthropic API server-side (an API key must never be shipped to the
frontend) and returns structured JSON. The human-in-the-loop editor in Quiz Architect is real and
fully functional regardless — every AI-drafted question is a normal editable question the moment
it lands, saved through the same `POST /quizzes` endpoint as a manually authored one.

### What's genuinely wired to the backend here (not simulated)

Course Manager, course listing, quiz saving, the Results Vault (real per-learner quiz attempt
history), Certificate Engine settings, the learner directory (add/import/assign), and Help &
Support ticket submission all call real endpoints — see `src/api/hrApi.js`.

## Phase 6: Learner Portal, Multi-Tier Broadcasts, Advanced Media Player

```
src/
├── api/
│   └── learnerApi.js                    # every Learner endpoint in one place
├── components/
│   └── AnnouncementCarousel.jsx         # auto-rotating broadcast ticker (Learner Dashboard)
└── pages/learner/
    ├── LearnerDashboard.jsx              # REWRITTEN — carousel, metrics bar, course cards, catalog
    ├── LearnerProfile.jsx                 # NEW — CNIC (auto-formatted), phone, address, avatar,
    │                                        password change, Certificates Vault with PDF preview modal
    ├── MyCoursesCatalog.jsx               # NEW — Enrolled / Catalog tabs with category filter chips
    ├── ResourceHub.jsx                    # NEW — flattened PDF library + built-in iframe viewer
    ├── InstructorDirectory.jsx            # NEW — cards + full profile drawer (bio, background, success stories)
    ├── LearnerBroadcastBoard.jsx          # NEW — aggregated notice board (global + org announcements)
    └── CoursePlayer.jsx                   # REWRITTEN — playback speed (0.5x-2x), ±10s skip, fullscreen,
                                              YouTube/Vimeo embed detection, collapsible playlist sidebar
```

HR side additions: `HrBroadcastManager.jsx` (Create Announcement + System Broadcasts tabs), `LearnerDeptDirectory.jsx`
rewritten with CNIC/phone/address columns and a full Learner Inspector Drawer (progress + quiz stats across
every course), `QuizArchitect.jsx` upgraded with a 5–30 question-count selector and per-question explanations,
`CogniCopilot.jsx` upgraded with a clear-chat button and `localStorage`-persisted conversation history.
Super Admin's `Broadcasts.jsx` was also updated to match the new 3-tier `targetAudience` schema — the old
`audience` object shape it used to send no longer exists on the backend.

**Multi-tenant security**: every learner-facing list (courses, instructors, resources, broadcasts) is
scoped through the same subdomain-derived `req.tenantId` used everywhere else in the app — a learner can
never see another organization's data because the axios instance's base URL is tied to the browser's
current subdomain, and every backend query filters by that tenant.

## What's intentionally simplified

- Course Builder's drag-and-drop uses `@hello-pangea/dnd` with two nested `DragDropContext`
  levels (modules, then lessons-within-a-module) — functional, but does not yet support
  cross-module lesson dragging.
- Quiz Creator only supports `single_choice` question authoring in the UI (the backend model
  supports `multiple_choice`, `true_false`, `short_answer` too — extending the form is
  straightforward, same shape).
- Toasts now use `react-hot-toast` (see `src/lib/toast.js`) for Super Admin actions; HR/Learner
  pages still use inline error text — swap those calls over to `notify.*` the same way.
- PDF viewer uses a plain `<iframe>` — fine for same-origin/CORS-friendly URLs (including local
  disk uploads served by the backend); a dedicated viewer (e.g. `react-pdf`) would be needed for
  stricter S3 bucket policies that block iframe embedding.
- MRR trend on the dashboard is approximated from current tenant records (no historical billing
  ledger yet) — see the backend README's note on `getTenantAnalyticsOverview`.

## Public Landing Page, Organization Showcase, Contact Manager

```
src/
├── api/
│   └── publicApi.js                       # NEW — separate axios instance for unauthenticated pages
│                                             (always hits the root API host, no interceptors, no token)
├── components/
│   └── PageTransition.jsx                 # NEW — reusable fade-in/slide-up wrapper
└── pages/
    ├── LandingPage.jsx                     # NEW — public "/" : hero, role breakdown, org showcase,
    │                                          onboarding-request modal
    ├── OrgPublicProfile.jsx                # NEW — public "/org/:slug"
    ├── hr/HrPublicProfileManager.jsx        # NEW — "/hr/profile", edits the same Tenant.publicProfile
    │                                          fields the public pages read, so saves reflect immediately
    └── superadmin/SuperAdminContactManager.jsx  # NEW — "/superadmin/contact", 2 tabs (Existing Tenants
                                                   reuses the Support Desk ticket data; Onboarding
                                                   Requests has a 1-click Approve & Onboard action)
```

**`/` is no longer an auth redirect.** It used to send authenticated users straight to their
dashboard and everyone else to `/login`. Now it's always the public Landing Page — a logged-in
user landing on `/` sees the marketing page, same as anyone else; there's no automatic bounce.
Post-login navigation is unaffected (login still redirects straight to the right dashboard).

### Framer Motion pass — one real bug found while wiring it up

`GlassCard.jsx` was a plain function component being used with `ref={modProvided.innerRef}` for
`@hello-pangea/dnd`'s drag-and-drop in Course Manager. React silently drops a `ref` prop on a
non-`forwardRef` function component — so the drag library never actually got the real DOM node it
needs to compute drag positioning. Converting `GlassCard` to `motion.div` also required wrapping it
in `forwardRef`, which fixes this at the same time as adding the hover-glow effect.

`Modal.jsx` previously did `if (!open) return null`, which unmounts instantly with no chance for
an exit animation to play. It's now wrapped in `AnimatePresence` with the conditional render moved
inside, so closing a modal actually animates out instead of vanishing.

`DashboardLayout.jsx`'s `<main>` now keys its content by `location.pathname` inside
`AnimatePresence`, giving every authenticated page a fade-in/slide-up on route change for free —
individual pages don't need to add their own transition wrapper.
