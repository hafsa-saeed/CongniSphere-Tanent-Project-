/**
 * Seed script — populates MongoDB with a minimal, realistic sample dataset
 * so the frontend / Postman collection has something real to hit right away.
 *
 * Usage:
 *   npm run seed          # populate
 *   npm run seed:destroy  # wipe all collections used by this seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const Tenant = require('./models/tenant.model');
const User = require('./models/user.model');
const Course = require('./models/course.model');
const Quiz = require('./models/quiz.model');
const LearnerProgress = require('./models/learnerProgress.model');
const GlobalSettings = require('./models/globalSettings.model');
const Broadcast = require('./models/broadcast.model');
const SupportTicket = require('./models/supportTicket.model');
const AuditLog = require('./models/auditLog.model');
const Instructor = require('./models/instructor.model');

const DESTROY = process.argv.includes('--destroy');

async function destroy() {
  await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Course.deleteMany({}),
    Quiz.deleteMany({}),
    LearnerProgress.deleteMany({}),
    GlobalSettings.deleteMany({}),
    Broadcast.deleteMany({}),
    SupportTicket.deleteMany({}),
    AuditLog.deleteMany({}),
    Instructor.deleteMany({}),
  ]);
  console.log('[SEED] All collections cleared.');
}

async function seed() {
  await destroy(); // always start from a clean slate for repeatable seeding

  // ---------- Global settings singleton ----------
  await GlobalSettings.create({ singletonKey: 'GLOBAL_SETTINGS', platformName: 'CogniSphere' });
  console.log('[SEED] Global settings created.');

  // ---------- Super Admin ----------
  const superAdmin = await User.create({
    tenantId: null,
    role: 'super_admin',
    fullName: 'Platform Owner',
    email: 'superadmin@cognisphere.com',
    password: 'SuperAdmin123!',
    emailVerified: true,
  });
  console.log(`[SEED] Super Admin created: ${superAdmin.email} / SuperAdmin123!`);

  // ---------- Tenant: Acme Corp ----------
  const tenant = await Tenant.create({
    companyName: 'Acme Corp',
    subdomain: 'acme',
    industry: 'Manufacturing',
    companySize: '201-500',
    primaryContact: { name: 'Jane HR', email: 'hr@acme.com', phone: '0300-1234567' },
    subscription: { tier: 'professional', status: 'active', billingCycle: 'monthly', startDate: new Date() },
    branding: { primaryColor: '#4F46E5', secondaryColor: '#818CF8' },
    onboardedBy: superAdmin._id,
  });
  console.log(`[SEED] Tenant created: ${tenant.companyName} (${tenant.subdomain})`);

  // ---------- HR Admin ----------
  const hrAdmin = await User.create({
    tenantId: tenant._id,
    role: 'hr_admin',
    fullName: 'Jane HR',
    email: 'hr@acme.com',
    password: 'HrPass123!',
    department: 'Human Resources',
    jobTitle: 'HR Manager',
    emailVerified: true,
  });
  console.log(`[SEED] HR Admin created: ${hrAdmin.email} / HrPass123!`);

  // ---------- Learner ----------
  const learner = await User.create({
    tenantId: tenant._id,
    role: 'learner',
    fullName: 'Leo Learner',
    email: 'learner@acme.com',
    password: 'LearnerPass123!',
    department: 'Sales',
    jobTitle: 'Sales Associate',
    cnic: '42101-1234567-1',
    phone: '0301-1234567',
    address: '221B Baker Street, Springfield',
    emailVerified: true,
  });
  console.log(`[SEED] Learner created: ${learner.email} / LearnerPass123!`);

  tenant.usage.currentUserCount = 3;
  await tenant.save();

  // ---------- Course: 2 modules (1 unlocked, 1 locked) ----------
  const course = new Course({
    tenantId: tenant._id,
    title: 'Employee Onboarding Essentials',
    description: 'Everything a new Acme employee needs to know in their first week.',
    shortDescription: 'New hire onboarding basics',
    category: 'Onboarding',
    tags: ['onboarding', 'compliance'],
    targetDepartments: ['Sales', 'Human Resources'],
    isMandatory: true,
    status: 'published',
    createdBy: hrAdmin._id,
    modules: [
      {
        title: 'Module 1: Welcome to Acme',
        order: 0,
        lockSettings: { isLockedByDefault: false, requireQuizPassToUnlockNext: true },
        lessons: [
          {
            title: 'Welcome Video',
            order: 0,
            contentType: 'video',
            video: { url: 'https://example-cdn.com/videos/welcome.mp4', durationSeconds: 300 },
            estimatedMinutes: 5,
          },
          {
            title: 'Company Handbook (PDF)',
            order: 1,
            contentType: 'pdf',
            pdf: { url: 'https://example-cdn.com/pdfs/handbook.pdf', pageCount: 12 },
            estimatedMinutes: 10,
          },
        ],
      },
      {
        title: 'Module 2: Sales Systems & Tools',
        order: 1,
        lockSettings: { isLockedByDefault: true, requireQuizPassToUnlockNext: true },
        lessons: [
          {
            title: 'CRM Walkthrough',
            order: 0,
            contentType: 'video',
            video: { url: 'https://example-cdn.com/videos/crm-walkthrough.mp4', durationSeconds: 600 },
            estimatedMinutes: 10,
          },
        ],
      },
    ],
  });

  course.stats.totalModules = course.modules.length;
  course.stats.totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  course.stats.totalDurationMinutes = 25;

  await course.save();
  console.log(`[SEED] Course created: "${course.title}" with ${course.modules.length} modules.`);

  const module1Id = course.modules[0]._id;
  const module2Id = course.modules[1]._id;

  // ---------- Quiz for Module 1 (80% passing threshold, gates Module 2) ----------
  const quiz = await Quiz.create({
    tenantId: tenant._id,
    courseId: course._id,
    moduleId: module1Id,
    title: 'Module 1 Knowledge Check',
    description: 'Quick check on the welcome materials.',
    passingThresholdPercent: 80,
    timeLimitMinutes: 10,
    isTimed: true,
    maxAttempts: 3,
    createdBy: hrAdmin._id,
    questions: [
      {
        questionText: 'What is Acme Corp\'s primary industry?',
        questionType: 'single_choice',
        order: 0,
        points: 5,
        options: [
          { text: 'Manufacturing', isCorrect: true },
          { text: 'Retail', isCorrect: false },
          { text: 'Finance', isCorrect: false },
        ],
      },
      {
        questionText: 'Where can you find the employee handbook?',
        questionType: 'single_choice',
        order: 1,
        points: 5,
        options: [
          { text: 'In Module 1, as a PDF', isCorrect: true },
          { text: 'It is emailed weekly', isCorrect: false },
          { text: 'There is no handbook', isCorrect: false },
        ],
      },
    ],
  });

  course.modules.id(module1Id).quizId = quiz._id;
  await course.save();
  console.log(`[SEED] Quiz created: "${quiz.title}" (passing threshold ${quiz.passingThresholdPercent}%)`);

  // ---------- Learner progress: Module 1 in_progress, Module 2 locked ----------
  await LearnerProgress.create({
    tenantId: tenant._id,
    userId: learner._id,
    courseId: course._id,
    status: 'in_progress',
    startedAt: new Date(),
    modulesProgress: [
      {
        moduleId: module1Id,
        status: 'in_progress',
        unlockedAt: new Date(),
        lessonsProgress: course.modules.id(module1Id).lessons.map((l) => ({
          lessonId: l._id,
          status: 'not_started',
        })),
        quizAttempts: [],
      },
      {
        moduleId: module2Id,
        status: 'locked',
        lessonsProgress: course.modules.id(module2Id).lessons.map((l) => ({
          lessonId: l._id,
          status: 'locked',
        })),
        quizAttempts: [],
      },
    ],
  });
  console.log('[SEED] Learner progress bootstrapped: Module 1 unlocked, Module 2 locked.');

  // ---------- A second tenant so Super Admin screens (charts, tables) have more than one row ----------
  const secondTenant = await Tenant.create({
    companyName: 'Globex Industries',
    subdomain: 'globex',
    industry: 'Logistics',
    companySize: '501-1000',
    primaryContact: { name: 'Sam Ops', email: 'hr@globex.com', phone: '0321-9876543' },
    subscription: {
      tier: 'enterprise',
      status: 'active',
      billingCycle: 'yearly',
      pricePerSeat: 12,
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    usage: { currentUserCount: 1, currentCourseCount: 0, currentStorageUsedMB: 0 },
    branding: { primaryColor: '#059669', secondaryColor: '#34D399' },
    onboardedBy: superAdmin._id,
  });
  await User.create({
    tenantId: secondTenant._id,
    role: 'hr_admin',
    fullName: 'Sam Ops',
    email: 'hr@globex.com',
    password: 'HrPass123!',
    department: 'Operations',
    jobTitle: 'Ops Manager',
    emailVerified: true,
  });
  console.log(`[SEED] Second tenant created: ${secondTenant.companyName} (${secondTenant.subdomain})`);

  // ---------- Demo broadcasts (new 3-tier schema) ----------
  await Broadcast.create({
    sender: 'superadmin',
    tenantId: null,
    targetAudience: 'all',
    title: 'Scheduled Maintenance',
    message: 'CogniSphere will be briefly unavailable this Saturday at midnight UTC for scheduled maintenance.',
    priority: 'info',
    createdBy: superAdmin._id,
  });
  await Broadcast.create({
    sender: 'hr',
    tenantId: tenant._id,
    targetAudience: 'learners_only',
    title: 'New Onboarding Course Released',
    message: 'The updated Employee Onboarding Essentials course is now live — please complete it by end of month.',
    priority: 'urgent',
    createdBy: hrAdmin._id,
  });
  console.log('[SEED] Demo broadcasts created (1 global, 1 HR-authored).');

  // ---------- Demo instructor, assigned to the seeded course ----------
  const instructor = await Instructor.create({
    tenantId: tenant._id,
    fullName: 'Dr. Amina Farooq',
    title: 'Head of Learning & Development',
    bio: 'Amina has spent over a decade designing corporate training programs for Fortune 500 companies.',
    academicBackground: 'PhD in Organizational Psychology, University of Manchester',
    industryExperience: '12+ years in enterprise L&D across manufacturing and logistics',
    missionStatement: 'Training should be practical, respectful of people\'s time, and genuinely useful on day one of the job.',
    successStories: ['Reduced onboarding time by 40% at a previous Fortune 500 employer.'],
    createdBy: hrAdmin._id,
  });
  course.instructorId = instructor._id;
  await course.save();
  console.log(`[SEED] Instructor created and assigned to course: ${instructor.fullName}`);

  // ---------- Demo support ticket ----------
  await SupportTicket.create({
    tenantId: tenant._id,
    submittedBy: hrAdmin._id,
    submitterName: hrAdmin.fullName,
    submitterEmail: hrAdmin.email,
    subject: 'Cannot upload video larger than 500MB',
    message: 'We tried uploading a 700MB onboarding video and got an error. Can the limit be raised for our plan?',
    status: 'pending',
    priority: 'normal',
  });
  console.log('[SEED] Demo support ticket created.');

  console.log('\n[SEED] ✅ Done. Summary:');
  console.log(`  Super Admin : superadmin@cognisphere.com / SuperAdmin123!  (login on root domain)`);
  console.log(`  HR Admin    : hr@acme.com / HrPass123!  (login on acme.<ROOT_DOMAIN> or with x-tenant-id header)`);
  console.log(`  Learner     : learner@acme.com / LearnerPass123!`);
  console.log(`  2nd HR Admin: hr@globex.com / HrPass123!  (login on globex.<ROOT_DOMAIN>)`);
  console.log(`  Tenant ID   : ${tenant._id}`);
  console.log(`  Course ID   : ${course._id}`);
  console.log(`  Quiz ID     : ${quiz._id}`);
}

(async () => {
  await connectDB();

  try {
    if (DESTROY) {
      await destroy();
    } else {
      await seed();
    }
  } catch (err) {
    console.error('[SEED] Failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
