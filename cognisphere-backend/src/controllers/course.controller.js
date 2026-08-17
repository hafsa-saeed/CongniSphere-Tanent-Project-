const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Course = require('../models/course.model');
const Tenant = require('../models/tenant.model');

/**
 * Recalculates the denormalized `stats` block on a course document
 * from its current modules/lessons array. Called after any structural edit.
 */
function recalculateCourseStats(course) {
  let totalLessons = 0;
  let totalDurationMinutes = 0;

  for (const mod of course.modules) {
    totalLessons += mod.lessons.length;
    for (const lesson of mod.lessons) {
      if (lesson.contentType === 'video') {
        totalDurationMinutes += Math.round((lesson.video?.durationSeconds || 0) / 60);
      } else {
        totalDurationMinutes += lesson.estimatedMinutes || 0;
      }
    }
  }

  course.stats.totalModules = course.modules.length;
  course.stats.totalLessons = totalLessons;
  course.stats.totalDurationMinutes = totalDurationMinutes;
}

/**
 * @desc    Create a new course (Course Builder "save" action)
 * @route   POST /api/v1/courses
 * @access  Private (hr_admin, scoped to req.tenantId)
 */
const createCourse = asyncHandler(async (req, res) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'A company context is required to create a course.');
  }

  // ---------- Enforce plan limits ----------
  const tenant = await Tenant.findById(req.tenantId);
  if (tenant.limits.maxCourses !== -1) {
    const currentCount = await Course.countDocuments({ tenantId: req.tenantId });
    if (currentCount >= tenant.limits.maxCourses) {
      throw new ApiError(
        403,
        `Course limit reached (${tenant.limits.maxCourses}) for your current plan. Please upgrade to add more courses.`
      );
    }
  }

  const {
    title,
    description,
    shortDescription,
    thumbnailUrl,
    category,
    tags,
    targetDepartments,
    isMandatory,
    modules = [],
    certificate,
    instructorId,
  } = req.body;

  if (!title) {
    throw new ApiError(400, 'Course title is required.');
  }

  // Assign order + normalize incoming module/lesson structure from the drag-and-drop builder
  const normalizedModules = modules.map((mod, mIndex) => ({
    ...mod,
    order: mod.order ?? mIndex,
    lessons: (mod.lessons || []).map((lesson, lIndex) => ({
      ...lesson,
      order: lesson.order ?? lIndex,
    })),
  }));

  const course = new Course({
    tenantId: req.tenantId, // ALWAYS derived from the authenticated request context, never trusted from client body
    title,
    description,
    shortDescription,
    thumbnailUrl,
    category,
    tags,
    targetDepartments,
    isMandatory,
    modules: normalizedModules,
    certificate,
    instructorId: instructorId || null,
    createdBy: req.user._id,
  });

  recalculateCourseStats(course);
  await course.save();

  tenant.usage.currentCourseCount += 1;
  await tenant.save();

  return res.status(201).json(new ApiResponse(201, course, 'Course created successfully.'));
});

/**
 * @desc    Get all courses for the current tenant (with optional filters)
 * @route   GET /api/v1/courses
 * @access  Private (hr_admin sees all; learner sees only published)
 */
const getCourses = asyncHandler(async (req, res) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'A company context is required.');
  }

  const { status, category, search, page = 1, limit = 20 } = req.query;

  // CRITICAL: every query is scoped by tenantId to guarantee strict tenant isolation.
  const filter = { tenantId: req.tenantId };

  // Learners may only ever see published courses, regardless of query params.
  if (req.user.role === 'learner') {
    filter.status = 'published';
  } else if (status) {
    filter.status = status;
  }

  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select('-modules.lessons.textContent') // keep list payload light
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Course.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      courses,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    })
  );
});

/**
 * @desc    Get a single course's full detail (Course Player / Course Builder edit view)
 * @route   GET /api/v1/courses/:id
 * @access  Private
 */
const getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate(
    'instructorId',
    'fullName title avatarUrl'
  );

  if (!course) {
    // Deliberately generic message — never confirm whether a course ID exists
    // in another tenant, that would leak cross-tenant information.
    throw new ApiError(404, 'Course not found.');
  }

  if (req.user.role === 'learner' && course.status !== 'published') {
    throw new ApiError(404, 'Course not found.');
  }

  return res.status(200).json(new ApiResponse(200, course));
});

/**
 * @desc    Update a course (title, modules, lessons, lock settings, publish state)
 * @route   PATCH /api/v1/courses/:id
 * @access  Private (hr_admin, scoped to req.tenantId)
 */
const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!course) {
    throw new ApiError(404, 'Course not found.');
  }

  const allowedFields = [
    'title',
    'description',
    'shortDescription',
    'thumbnailUrl',
    'category',
    'tags',
    'targetDepartments',
    'isMandatory',
    'modules',
    'certificate',
    'status',
    'instructorId',
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      course[field] = req.body[field];
    }
  }

  course.lastEditedBy = req.user._id;
  recalculateCourseStats(course);
  await course.save();

  return res.status(200).json(new ApiResponse(200, course, 'Course updated successfully.'));
});

/**
 * @desc    Delete (archive) a course
 * @route   DELETE /api/v1/courses/:id
 * @access  Private (hr_admin, scoped to req.tenantId)
 */
const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { $set: { status: 'archived' } },
    { new: true }
  );

  if (!course) {
    throw new ApiError(404, 'Course not found.');
  }

  return res.status(200).json(new ApiResponse(200, course, 'Course archived successfully.'));
});

/**
 * @desc    Flattened library of every PDF lesson across every published
 *          course in the tenant — powers the Learner Resource & PDF Hub.
 * @route   GET /api/v1/courses/resources/pdfs
 * @access  Private (learner, tenant-scoped)
 */
const getResourceLibrary = asyncHandler(async (req, res) => {
  const courses = await Course.find({ tenantId: req.tenantId, status: 'published' }).select('title category modules');

  const resources = [];
  for (const course of courses) {
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.pdf?.url) {
          resources.push({
            courseId: course._id,
            courseTitle: course.title,
            category: course.category,
            moduleTitle: mod.title,
            lessonTitle: lesson.title,
            url: lesson.pdf.url,
            pageCount: lesson.pdf.pageCount || null,
          });
        }
      }
    }
  }

  return res.status(200).json(new ApiResponse(200, resources));
});

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getResourceLibrary,
};
