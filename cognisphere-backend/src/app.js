const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { resolveTenant } = require('./middleware/tenant.middleware');
const errorMiddleware = require('./middleware/error.middleware');

const tenantRoutes = require('./routes/tenant.routes');
const courseRoutes = require('./routes/course.routes');
const authRoutes = require('./routes/auth.routes');
const quizRoutes = require('./routes/quiz.routes');
const learnerProgressRoutes = require('./routes/learnerProgress.routes');
const uploadRoutes = require('./routes/upload.routes');
const broadcastRoutes = require('./routes/broadcast.routes');
const supportTicketRoutes = require('./routes/supportTicket.routes');
const settingsRoutes = require('./routes/settings.routes');
const auditLogRoutes = require('./routes/auditLog.routes');
const userRoutes = require('./routes/user.routes');
const instructorRoutes = require('./routes/instructor.routes');
const onboardingRequestRoutes = require('./routes/onboardingRequest.routes');

const app = express();

// ---------- Security & parsing ----------
// Three helmet defaults are relaxed here, each for a distinct reason tied
// to how this app actually serves files — this is an API + static-file
// server with no server-rendered HTML pages of its own, so helmet's
// browser-page-hardening defaults mostly just get in the way of our own
// legitimate cross-subdomain file loading:
//
//   - crossOriginResourcePolicy ('same-origin' by default) blocks direct
//     resource loads — <video src>, <img src> — across origins. Every
//     tenant subdomain is a different origin by design here, so this
//     silently broke lesson videos loading on any subdomain other than
//     the one they were uploaded from.
//   - frameguard (X-Frame-Options: SAMEORIGIN by default) blocks a
//     resource from being embedded in an <iframe> from a different
//     origin. PDFs are rendered via <iframe src>, so — unlike videos —
//     they stayed broken even after the CORP fix above; this is what
//     actually fixes PDF rendering across subdomains.
//   - contentSecurityPolicy's default frame-ancestors 'self' directive
//     enforces the same iframe restriction as frameguard, redundantly;
//     left at its default it would re-block PDFs even with frameguard
//     disabled. Disabling it here is safe: CSP mainly hardens
//     server-rendered HTML with inline scripts, which this app has none
//     of (it's a JSON API + static uploads only).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: true, // reflects request origin — needed since every tenant subdomain is a valid origin
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ---------- Rate limiting (basic protection; tune per route in production) ----------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ---------- Static file serving (local-disk upload storage, Phase 2) ----------
// NOTE: swap/remove this when migrating upload.controller.js to S3/R2 — files
// would then be served directly from the CDN/bucket instead of this app.
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// ---------- Multi-tenancy resolution ----------
// Runs on EVERY request so req.tenant / req.tenantId are always available downstream,
// whether the request lands on the root domain (Super Admin) or a company subdomain.
app.use(resolveTenant);

// ---------- Health check ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', tenant: req.tenant?.subdomain || null });
});

// ---------- Routes ----------
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/progress', learnerProgressRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/broadcasts', broadcastRoutes);
app.use('/api/v1/support-tickets', supportTicketRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/instructors', instructorRoutes);
app.use('/api/v1/onboarding-requests', onboardingRequestRoutes);

// ---------- 404 fallback ----------
app.use((req, res) => {
  res.status(404).json({ success: false, statusCode: 404, message: 'Route not found.' });
});

// ---------- Centralized error handler (must be last) ----------
app.use(errorMiddleware);

module.exports = app;
