import api from "./axios";

// ---------- Organization Profile ----------
export const getMyTenant = () => api.get("/tenants/me");

// ---------- Overview & Analytics ----------
export const getAnalyticsOverview = () =>
  api.get("/progress/analytics/overview");
export const getCourseAnalytics = (courseId) =>
  api.get(`/progress/analytics/course/${courseId}`);

// ---------- Courses ----------
export const listCourses = (params) => api.get("/courses", { params });
export const getCourse = (id) => api.get(`/courses/${id}`);
export const createCourse = (payload) => api.post("/courses", payload);
export const updateCourse = (id, payload) =>
  api.patch(`/courses/${id}`, payload);

// ---------- Quizzes ----------
export const listQuizzesForCourse = (courseId) =>
  api.get("/quizzes", { params: { courseId } });
export const generateQuizDraft = (payload) =>
  api.post("/quizzes/generate-draft", payload);
export const createQuiz = (payload) => api.post("/quizzes", payload);
export const chatWithCopilot = (payload) => api.post("/copilot/chat", payload);
export const updateQuiz = (id, payload) => api.patch(`/quizzes/${id}`, payload);

// ---------- Uploads ----------
export const uploadFile = (kind, file) => {
  const formData = new FormData();
  formData.append(kind, file);
  return api.post(`/uploads/${kind}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ---------- Learner Results Vault ----------
export const getLearnerCourseDetail = (userId, courseId) =>
  api.get(`/progress/learner/${userId}/course/${courseId}`);

// ---------- Directory ----------
export const listTenantUsers = (params) => api.get("/users", { params });
export const updateUserStatus = (id, isActive) =>
  api.patch(`/users/${id}/status`, { isActive });
export const registerUser = (payload) => api.post("/auth/register", payload);
export const assignCourse = (courseId, userId) =>
  api.post(`/progress/enroll/${courseId}`, { userId });

// ---------- Help & Support ----------
export const submitSupportTicket = (payload) =>
  api.post("/support-tickets", payload);

// ---------- Broadcast Manager ----------
export const listBroadcastsForHr = () => api.get("/broadcasts/hr");
export const createHrBroadcast = (payload) => api.post("/broadcasts", payload);
export const deactivateHrBroadcast = (id) =>
  api.patch(`/broadcasts/${id}/deactivate`);
export const getHrBroadcastBanner = () => api.get("/broadcasts/active");

// ---------- Instructors ----------
export const listInstructors = () => api.get("/instructors");
export const createInstructor = (payload) => api.post("/instructors", payload);
export const updateInstructor = (id, payload) =>
  api.patch(`/instructors/${id}`, payload);
export const deleteInstructor = (id) => api.delete(`/instructors/${id}`);

// ---------- Learner Inspector ----------
export const getUserSummary = (id) => api.get(`/users/${id}/summary`);

// ---------- My Account (personal profile, not the org-level profile above) ----------
export const changeMyPassword = (payload) =>
  api.patch("/auth/change-password", payload);
export const updateMyAccount = (payload) => api.patch("/auth/me", payload);

// ---------- Issued Certificates (Certificate Engine) ----------
export const getIssuedCertificates = (courseId) =>
  api.get(`/progress/course/${courseId}/certificates`);

// ---------- Public Profile Customizer ----------
export const updateMyPublicProfile = (payload) =>
  api.patch("/tenants/me/public-profile", payload);
