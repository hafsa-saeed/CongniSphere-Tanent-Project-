# CogniSphere — Backend (Phase 1: Foundation & Architecture)

B2B Multi-Tenant Enterprise Learning SaaS. Node.js + Express + MongoDB (Mongoose).

## 1. Folder Structure

```
cognisphere-backend/
├── .env.example
├── package.json
└── src/
    ├── server.js                    # entrypoint: loads env, connects DB, starts listener
    ├── app.js                       # Express app: middleware pipeline + route mounting
    │
    ├── config/
    │   └── db.js                    # MongoDB connection
    │
    ├── models/
    │   ├── tenant.model.js          # Company: subdomain, branding, subscription, limits, feature flags
    │   ├── user.model.js            # super_admin / hr_admin / learner, tenant-scoped
    │   ├── course.model.js          # Course -> Modules -> Lessons (video/pdf), lock settings
    │   ├── quiz.model.js            # Questions, passing threshold, timing, retake policy
    │   ├── learnerProgress.model.js # Per-learner lock state, quiz attempts, certificates
    │   └── globalSettings.model.js  # Super Admin singleton: SMTP, payments, tier defaults
    │
    ├── middleware/
    │   ├── tenant.middleware.js     # resolveTenant + requireTenant (subdomain -> tenantId)
    │   ├── auth.middleware.js       # verifyJWT + authorizeRoles (RBAC)
    │   └── error.middleware.js      # centralized error handler
    │
    ├── controllers/
    │   ├── tenant.controller.js     # onboarding, branding fetch, plan/limit updates
    │   └── course.controller.js     # tenant-isolated course CRUD
    │
    ├── routes/
    │   ├── tenant.routes.js
    │   └── course.routes.js
    │
    └── utils/
        ├── ApiError.js
        ├── ApiResponse.js
        └── asyncHandler.js
```

Naming convention used throughout: `<domain>.<layer>.js` (e.g. `tenant.middleware.js`,
`course.controller.js`, `quiz.model.js`) so the folder alone tells you what a file does.

## 2. Multi-Tenancy Strategy (why it's built this way)

- **Single shared database, tenant-scoped collections** (not one DB per tenant). Every
  tenant-owned document (`User`, `Course`, `Quiz`, `LearnerProgress`) carries a `tenantId`
  field. This is the standard, cost-effective pattern for mid-market B2B SaaS and scales to
  thousands of tenants without the operational overhead of provisioning a database per
  customer. If a specific enterprise customer later requires physical data isolation, that
  tenant can be migrated to a dedicated database/cluster without changing the schema.
- **Two layers of isolation**:
  1. _Query level_: `tenant.middleware.js` resolves `req.tenantId` from the subdomain (or
     `x-tenant-id` header / custom domain) on every request. Controllers are written to
     always filter by `{ tenantId: req.tenantId }` — see `course.controller.js`.
  2. _Auth level_: `auth.middleware.js` cross-checks the logged-in user's own `tenantId`
     against `req.tenantId`. Even a stolen/valid JWT for a Company A user is rejected on
     Company B's subdomain.
- **Subdomain resolution** (`extractSubdomain`) supports production (`acme.cognisphere.com`),
  local dev (`acme.localhost:5000`), and a future custom-domain path (`learning.acme.com`)
  for enterprise-tier white-labeling.

## 3. Setup

```bash
cp .env.example .env      # fill in MONGO_URI, JWT secrets, ROOT_DOMAIN
npm install
npm run dev                # nodemon, requires devDependency install
```

For local multi-tenant testing without real DNS, add to `/etc/hosts`:

```
127.0.0.1   acme.localhost
127.0.0.1   app.localhost
```

then hit `http://acme.localhost:5000/api/v1/tenants/branding`.

## 4. What's intentionally NOT in Phase 1

To keep this phase focused on foundation/architecture, the following are stubbed out or
left for later phases and are the natural next build steps:

- `auth.controller.js` / `auth.routes.js` (login, refresh token, password reset) — the
  middleware that _consumes_ these tokens is done; issuing them is next.
- `quiz.controller.js`, `learnerProgress.controller.js` — the lock/unlock evaluation
  logic (checking `bestQuizScorePercent >= passingThresholdPercent` to flip a module from
  `locked` to `in_progress`) belongs here.
- File upload handling (`multer` + S3/GCS) for video/PDF lesson content.
- `settings.controller.js` for the Super Admin Settings & Integrations panel.
- Seed script / sample data.

## 5. Phase 2 additions (Operational Controllers & Business Logic)

```
src/
├── controllers/
│   ├── auth.controller.js            # NEW — login, register, /me, refresh, logout
│   ├── quiz.controller.js            # NEW — HR quiz CRUD + learner submit/unlock engine
│   ├── learnerProgress.controller.js # NEW — lesson completion, dashboards, HR analytics
│   └── upload.controller.js          # NEW — Multer video/PDF/image upload (local disk, S3-ready)
├── routes/
│   ├── auth.routes.js                # NEW
│   ├── quiz.routes.js                # NEW
│   ├── learnerProgress.routes.js     # NEW
│   └── upload.routes.js              # NEW
├── seed.js                           # NEW — CLI seed script
├── app.js                            # UPDATED — mounts 4 new route groups + static /uploads
└── (models/middleware/utils unchanged from Phase 1)

package.json                          # UPDATED — added "seed" / "seed:destroy" scripts
```

### Unlock logic, in one place

`quiz.controller.js#submitQuiz` grades the attempt, records it on
`LearnerProgress.modulesProgress[].quizAttempts`, and if
`scorePercent >= quiz.passingThresholdPercent`: flips the current module to
`completed` and the **next module by `order`** from `locked` to `in_progress`
(bootstrapping its lessons to `not_started`). `learnerProgress.controller.js#markLessonProgress`
independently refuses to touch any lesson inside a module still `locked` — so
both halves of the gate (lessons and quizzes) are enforced server-side, not
just hidden in the UI.

## 7. Phase 3 additions: Certificate generator + S3/R2 storage adapter

```
src/
├── config/
│   └── storage.js                    # NEW — unified saveFile() adapter: S3/R2 or local disk, picked by env vars
├── controllers/
│   ├── upload.controller.js          # UPDATED — now uses storage.js via multer.memoryStorage()
│   └── learnerProgress.controller.js # UPDATED — added getCourseCertificate
├── routes/
│   └── learnerProgress.routes.js     # UPDATED — added GET /certificate/:courseId
├── utils/
│   └── certificateGenerator.js       # NEW — renders the certificate PDF in memory via pdfkit
```

**Storage adapter**: set `S3_BUCKET_NAME` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` in `.env` to
switch every upload (videos, PDFs, images, certificates) to S3 or Cloudflare R2 (via `S3_ENDPOINT`).
Leave them unset and everything falls back to local disk under `/public/uploads` — no code change
either way, since every controller calls the same `saveFile()` function.

**Certificates**: `GET /api/v1/progress/certificate/:courseId` — 403s unless the learner's
`LearnerProgress.status === 'completed'`. First call renders + persists the PDF and stamps
`progress.certificate`; later calls re-render the same data on the fly. Streams
`Content-Type: application/pdf` by default; add `?format=json` to get `{ certificateUrl, certificateCode }` instead.

## 9. Super Admin Control Center backend additions

```
src/
├── models/
│   ├── broadcast.model.js        # NEW — global/targeted announcement banners
│   ├── supportTicket.model.js    # NEW — HR-submitted queries + reply thread
│   └── auditLog.model.js         # NEW — immutable Super Admin action trail
├── utils/
│   └── auditLogger.js            # NEW — fire-and-forget logAction() helper
├── controllers/ + routes/
│   ├── broadcast.*                # POST/GET/PATCH /broadcasts, GET /broadcasts/active (tenant-facing)
│   ├── supportTicket.*            # POST /support-tickets (HR), GET/PATCH (Super Admin)
│   ├── settings.*                 # GET/PATCH /settings (singleton GlobalSettings doc)
│   └── auditLog.*                 # GET /audit-logs
├── controllers/tenant.controller.js   # UPDATED — suspendTenant, activateTenant, impersonateTenant,
│                                         getTenantAnalyticsOverview (MRR trend, storage, plan distribution)
└── app.js                             # UPDATED — mounts all four new route groups
```

**Impersonation** issues a **30-minute** JWT for the tenant's first active HR admin, embedding
`impersonatedBy` in the token payload for traceability, and writes a `tenant.impersonate` audit
log entry. It reuses the exact same `auth.middleware.js` verification path as a normal login —
no special-casing needed on the request side.

**Audit logging** is best-effort and non-blocking (`utils/auditLogger.js` swallows its own
errors) — a logging failure must never break the action it's recording. Currently wired into:
tenant onboarding, suspend/activate, impersonation, broadcast create/deactivate, settings
updates, and support ticket replies.

**Settings** is a singleton document (`GlobalSettings`), auto-created with defaults on first
`GET /settings`. `PATCH /settings` shallow-merges each top-level section you send (e.g. just
`{ smtp: {...} }`) so the frontend's tabbed UI can save one tab without touching the others.

## 11. HR Admin Dashboard (Tenant Control Center) backend additions

```
src/
├── controllers/ + routes/user.*        # NEW — GET /users (tenant directory), PATCH /users/:id/status
├── controllers/tenant.controller.js    # UPDATED — getMyTenant (GET /tenants/me, HR-scoped own profile)
├── controllers/learnerProgress.controller.js  # UPDATED —
│   • enrollInCourse now accepts hr_admin + { userId } to assign a course to a specific learner
│   • getLearnerCourseDetail (GET /progress/learner/:userId/course/:courseId) — full quiz-attempt
│     and per-question answer detail for the Results Vault drawer
│   • getTenantAnalyticsOverview enriched with monthlyProgress (6-month completion trend),
│     passFailRatio (tenant-wide quiz pass/fail counts), seatUsage, storageUsage
├── models/course.model.js              # UPDATED — certificate.signatureName/signatureTitle/signatureImageUrl
└── utils/certificateGenerator.js       # UPDATED — renders an optional signature line on the PDF
```

All monthly-trend and pass/fail figures are computed from real `LearnerProgress` documents at
request time (not mocked) — see the query in `getTenantAnalyticsOverview` for the exact aggregation.

## 12. Phase 6: Learner Portal, Multi-Tier Broadcasts, Instructors

```
src/
├── models/
│   ├── broadcast.model.js       # REWRITTEN — 3-tier sender/targetAudience routing (see model comments)
│   └── instructor.model.js      # NEW — tenant-scoped instructor/trainer profiles
├── models/user.model.js         # UPDATED — cnic (validated), address fields
├── models/course.model.js       # UPDATED — instructorId reference
├── controllers/
│   ├── broadcast.controller.js  # REWRITTEN — createBroadcast (role-aware routing), listBroadcastsForHr,
│   │                               getActiveBroadcastsForUser (learner notice board + HR banner)
│   ├── instructor.controller.js # NEW — full CRUD + taught-courses aggregation
│   ├── auth.controller.js       # UPDATED — updateMyProfile, changePassword; register accepts cnic/phone/address
│   ├── course.controller.js     # UPDATED — getResourceLibrary (flattened PDF library), instructorId support
│   ├── user.controller.js       # UPDATED — getUserSummary (full learner profile + progress + quiz stats)
│   └── learnerProgress.controller.js  # UPDATED — getMyCertificates, progress summary enriched with
│                                         certificatesEarned/totalHoursSpent
└── routes/                      # instructor.routes.js NEW; auth/broadcast/course/user/learnerProgress routes UPDATED
```

**Broadcast routing matrix** (enforced server-side, not just in the UI):

- Super Admin, `targetAudience: 'all'` → visible to HR admins AND learners, every tenant or one if scoped
- Super Admin, `targetAudience: 'hr_only'` → visible only inside HR dashboards
- HR, `targetAudience: 'learners_only'` → visible only to that HR's own tenant's learners; `tenantId` is
  always the author's own tenant and is never accepted from the request body — this is what prevents an
  HR admin from ever broadcasting into another company.

## 13. Final Audit: Progress Engine Fix, Signup, Localization

```
src/
├── utils/progressEngine.js       # NEW — recalculateOverallProgress, checkLessonOnlyModuleCompletion,
│                                    issueCertificateIfNeeded, shared by quiz.controller.js and
│                                    learnerProgress.controller.js (previously duplicated/incomplete)
├── controllers/quiz.controller.js            # UPDATED — uses shared engine, auto-issues certificate
├── controllers/learnerProgress.controller.js # UPDATED — markLessonProgress now recalculates progress
│                                                and unlocks quiz-less modules (see bug note below)
├── controllers/auth.controller.js            # UPDATED — Pakistani phone validation (register + updateMyProfile)
├── models/user.model.js                      # UPDATED — phone field format-validated
├── middleware/tenant.middleware.js           # UPDATED (prior pass) — x-tenant-slug header, used by
│                                                the unified Login/Sign Up portal for root-domain access
└── seed.js                                   # UPDATED — Pakistani-format phone numbers in seed data
```

**Real bug found and fixed**: `markLessonProgress` never recalculated `overallProgressPercent` or
`progress.status`, and had no logic to complete a module that has no quiz attached to it. A course made
entirely of lesson content (no quizzes anywhere) could **never** reach `'completed'` status, and its
certificate would never issue. `checkLessonOnlyModuleCompletion` in `progressEngine.js` fixes this by
completing and unlocking quiz-less modules the same way `submitQuiz` already did for quiz-gated ones.

**Certificates now auto-issue** the instant a course completes — via either path (final quiz pass or
final lesson mark-complete) — instead of only lazily generating on the first `GET /certificate` request.

**Localization**: `User.phone` is now format-validated (`^(\+92|0)[\s-]?3\d{2}[\s-]?\d{7}$`) at both the
schema and controller level, matching the existing CNIC validation pattern.

## 14. Screens → Schema Coverage Map

| Screen (from mockups)                 | Backed by                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| SaaS Super-Admin Dashboard            | `Tenant` (list/analytics), `GlobalSettings.analyticsSnapshot`                     |
| Company (HR) Dashboard                | `Course.stats`, `LearnerProgress` aggregates, `User` (department)                 |
| Learner/Customer Dashboard            | `User.enrolledCourseIds`, `LearnerProgress`                                       |
| Course Player / Video Experience      | `Course.modules.lessons.video`, `LearnerProgress.modulesProgress.lessonsProgress` |
| Course Builder (drag & drop)          | `Course.modules` (ordered), `lesson.contentType` (video/pdf)                      |
| Quiz Creator & Threshold Setting      | `Quiz.passingThresholdPercent`, `questions`, `timeLimitMinutes`, `maxAttempts`    |
| Progress Reports & Analytics          | `LearnerProgress` indexes on `(tenantId, courseId, status)` for heatmaps          |
| Settings & Integrations (Super Admin) | `GlobalSettings` (SMTP, payment gateway, tier defaults)                           |

## 15. Public Landing Page, Organization Showcase, Contact Manager

```
src/
├── models/
│   ├── tenant.model.js               # UPDATED — publicProfile block (aboutUs, missionStatement,
│   │                                    featuredPrograms, primaryContactEmail/Phone, portalGuidelines,
│   │                                    isPubliclyListed)
│   └── onboardingRequest.model.js    # NEW — public "Request Organization Onboarding" submissions
├── controllers/
│   ├── tenant.controller.js          # UPDATED — updateMyPublicProfile (HR), listPublicTenants (public
│   │                                    showcase directory), getPublicTenantBySlug (public /org/:slug data)
│   └── onboardingRequest.controller.js  # NEW — public submission, Super Admin list/approve/reject
└── routes/
    ├── tenant.routes.js               # UPDATED — GET /public, GET /public/:slug (registered BEFORE
    │                                     /:id so the literal "/public" path isn't swallowed by the
    │                                     Super Admin single-segment :id route), PATCH /me/public-profile
    └── onboardingRequest.routes.js    # NEW — mounted at /api/v1/onboarding-requests
```

**Approve & Onboard** reuses the exact tenant + first-HR-admin creation logic from
`tenant.controller.js#createTenant`, so a request approved via the Contact Manager produces an
identical result to a Super Admin manually onboarding a company — same audit log entry shape,
same temporary-password flow.

**Public endpoints deliberately return a narrow field set** — no billing, no user counts, no
internal usage data — even though the underlying `Tenant` document has all of that. `listPublicTenants`
and `getPublicTenantBySlug` both filter on `isActive` and `publicProfile.isPubliclyListed`, so a
suspended tenant or one that opted out never appears in the public directory or at `/org/:slug`.
