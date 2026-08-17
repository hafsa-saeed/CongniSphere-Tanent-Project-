const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Instructor = require('../models/instructor.model');
const Course = require('../models/course.model');

/**
 * @desc    Create an instructor profile.
 * @route   POST /api/v1/instructors
 * @access  Private (hr_admin, tenant-scoped)
 */
const createInstructor = asyncHandler(async (req, res) => {
  const { fullName, title, avatarUrl, bio, academicBackground, industryExperience, missionStatement, successStories, skills } = req.body;

  if (!fullName) throw new ApiError(400, 'fullName is required.');

  const instructor = await Instructor.create({
    tenantId: req.tenantId,
    fullName,
    title,
    avatarUrl,
    bio,
    academicBackground,
    industryExperience,
    missionStatement,
    successStories: successStories || [],
    skills: skills || [],
    createdBy: req.user._id,
  });

  return res.status(201).json(new ApiResponse(201, instructor, 'Instructor created.'));
});

/**
 * @desc    Update an instructor profile.
 * @route   PATCH /api/v1/instructors/:id
 * @access  Private (hr_admin, tenant-scoped)
 */
const updateInstructor = asyncHandler(async (req, res) => {
  const allowedFields = ['fullName', 'title', 'avatarUrl', 'bio', 'academicBackground', 'industryExperience', 'missionStatement', 'successStories', 'skills'];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const instructor = await Instructor.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { $set: updates }, { new: true });
  if (!instructor) throw new ApiError(404, 'Instructor not found.');

  return res.status(200).json(new ApiResponse(200, instructor, 'Instructor updated.'));
});

/**
 * @desc    List every instructor in the tenant, each with their taught
 *          published courses attached — powers the Instructor Directory.
 * @route   GET /api/v1/instructors
 * @access  Private (any authenticated tenant user)
 */
const listInstructors = asyncHandler(async (req, res) => {
  const instructors = await Instructor.find({ tenantId: req.tenantId }).sort({ fullName: 1 });

  const courses = await Course.find({ tenantId: req.tenantId, status: 'published', instructorId: { $ne: null } }).select(
    'title instructorId category'
  );

  const withCourses = instructors.map((inst) => ({
    ...inst.toObject(),
    coursesTaught: courses
      .filter((c) => c.instructorId?.toString() === inst._id.toString())
      .map((c) => ({ _id: c._id, title: c.title, category: c.category })),
  }));

  return res.status(200).json(new ApiResponse(200, withCourses));
});

/**
 * @desc    Get a single instructor's full profile + taught courses.
 * @route   GET /api/v1/instructors/:id
 * @access  Private
 */
const getInstructorById = asyncHandler(async (req, res) => {
  const instructor = await Instructor.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!instructor) throw new ApiError(404, 'Instructor not found.');

  const courses = await Course.find({ tenantId: req.tenantId, instructorId: instructor._id, status: 'published' }).select('title category');

  return res.status(200).json(new ApiResponse(200, { ...instructor.toObject(), coursesTaught: courses }));
});

/**
 * @desc    Delete an instructor (only if not currently assigned to a course).
 * @route   DELETE /api/v1/instructors/:id
 * @access  Private (hr_admin, tenant-scoped)
 */
const deleteInstructor = asyncHandler(async (req, res) => {
  const assignedCourse = await Course.findOne({ tenantId: req.tenantId, instructorId: req.params.id });
  if (assignedCourse) {
    throw new ApiError(409, 'Unassign this instructor from all courses before deleting.');
  }

  const instructor = await Instructor.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  if (!instructor) throw new ApiError(404, 'Instructor not found.');

  return res.status(200).json(new ApiResponse(200, null, 'Instructor deleted.'));
});

module.exports = { createInstructor, updateInstructor, listInstructors, getInstructorById, deleteInstructor };
