import api from './axios';

// ---------- Courses & Enrollment ----------
export const listCourses = (params) => api.get('/courses', { params });
export const getCourse = (id) => api.get(`/courses/${id}`);
export const enrollInCourse = (courseId) => api.post(`/progress/enroll/${courseId}`);

// ---------- Progress ----------
export const getMyProgressSummary = () => api.get('/progress/me/summary');
export const getMyCourseProgress = (courseId) => api.get(`/progress/${courseId}`);
export const markLessonProgress = (courseId, lessonId, payload) => api.patch(`/progress/${courseId}/lessons/${lessonId}`, payload);
export const getMyCertificates = () => api.get('/progress/me/certificates');

// ---------- Quizzes ----------
export const getQuizForLearner = (quizId) => api.get(`/quizzes/${quizId}/take`);
export const submitQuiz = (quizId, payload) => api.post(`/quizzes/${quizId}/submit`, payload);

// ---------- Resources ----------
export const getResourceLibrary = () => api.get('/courses/resources/pdfs');

// ---------- Instructors ----------
export const listInstructors = () => api.get('/instructors');
export const getInstructor = (id) => api.get(`/instructors/${id}`);

// ---------- Broadcasts / Notice Board ----------
export const getActiveBroadcasts = () => api.get('/broadcasts/active');

// ---------- Profile ----------
export const updateMyProfile = (payload) => api.patch('/auth/me', payload);
export const changeMyPassword = (payload) => api.patch('/auth/change-password', payload);
export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('image', file);
  return api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
