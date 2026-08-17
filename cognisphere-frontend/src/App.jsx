import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import LandingPage from './pages/LandingPage';
import OrgPublicProfile from './pages/OrgPublicProfile';
import Login from './pages/auth/Login';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import ImpersonatePage from './pages/ImpersonatePage';

import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import TenantManagement from './pages/superadmin/TenantManagement';
import BillingPlans from './pages/superadmin/BillingPlans';
import Broadcasts from './pages/superadmin/Broadcasts';
import SupportDesk from './pages/superadmin/SupportDesk';
import SystemSettings from './pages/superadmin/SystemSettings';
import AuditLogs from './pages/superadmin/AuditLogs';
import SuperAdminContactManager from './pages/superadmin/SuperAdminContactManager';

import HrOverview from './pages/hr/HrOverview';
import OrganizationProfile from './pages/hr/OrganizationProfile';
import CourseList from './pages/hr/CourseList';
import CourseManager from './pages/hr/CourseManager';
import QuizArchitect from './pages/hr/QuizArchitect';
import LearnerResultsVault from './pages/hr/LearnerResultsVault';
import CertificateEngine from './pages/hr/CertificateEngine';
import LearnerDeptDirectory from './pages/hr/LearnerDeptDirectory';
import HrInstructorsManager from './pages/hr/HrInstructorsManager';
import HrBroadcastManager from './pages/hr/HrBroadcastManager';
import HelpSupport from './pages/hr/HelpSupport';
import HrPublicProfileManager from './pages/hr/HrPublicProfileManager';

import LearnerDashboard from './pages/learner/LearnerDashboard';
import LearnerProfile from './pages/learner/LearnerProfile';
import MyCoursesCatalog from './pages/learner/MyCoursesCatalog';
import ResourceHub from './pages/learner/ResourceHub';
import InstructorDirectory from './pages/learner/InstructorDirectory';
import LearnerBroadcastBoard from './pages/learner/LearnerBroadcastBoard';
import LearnerPerformance from './pages/learner/LearnerPerformance';
import CoursePlayer from './pages/learner/CoursePlayer';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <TenantProvider>
          <AuthProvider>
            <Toaster position="top-right" />
            <Routes>
              {/* ---------- Public ---------- */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/org/:slug" element={<OrgPublicProfile />} />
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/impersonate" element={<ImpersonatePage />} />

              <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
                <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
                <Route path="/superadmin/tenants" element={<TenantManagement />} />
                <Route path="/superadmin/billing" element={<BillingPlans />} />
                <Route path="/superadmin/broadcasts" element={<Broadcasts />} />
                <Route path="/superadmin/support" element={<SupportDesk />} />
                <Route path="/superadmin/contact" element={<SuperAdminContactManager />} />
                <Route path="/superadmin/settings" element={<SystemSettings />} />
                <Route path="/superadmin/audit-logs" element={<AuditLogs />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['hr_admin']} />}>
                <Route path="/hr/dashboard" element={<HrOverview />} />
                <Route path="/hr/organization" element={<OrganizationProfile />} />
                <Route path="/hr/profile" element={<HrPublicProfileManager />} />
                <Route path="/hr/courses" element={<CourseList />} />
                <Route path="/hr/courses/new" element={<CourseManager />} />
                <Route path="/hr/quiz-architect" element={<QuizArchitect />} />
                <Route path="/hr/results" element={<LearnerResultsVault />} />
                <Route path="/hr/certificates" element={<CertificateEngine />} />
                <Route path="/hr/directory" element={<LearnerDeptDirectory />} />
                <Route path="/hr/instructors" element={<HrInstructorsManager />} />
                <Route path="/hr/broadcasts" element={<HrBroadcastManager />} />
                <Route path="/hr/help" element={<HelpSupport />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['learner']} />}>
                <Route path="/learner/dashboard" element={<LearnerDashboard />} />
                <Route path="/learner/profile" element={<LearnerProfile />} />
                <Route path="/learner/courses" element={<MyCoursesCatalog />} />
                <Route path="/learner/resources" element={<ResourceHub />} />
                <Route path="/learner/instructors" element={<InstructorDirectory />} />
                <Route path="/learner/broadcasts" element={<LearnerBroadcastBoard />} />
                <Route path="/learner/performance" element={<LearnerPerformance />} />
                <Route path="/learner/courses/:courseId" element={<CoursePlayer />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </TenantProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
