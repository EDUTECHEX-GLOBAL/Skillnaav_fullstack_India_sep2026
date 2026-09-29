import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import PageLoader from "./components/PageLoader";
import FeedbackModal from "./components/FeedbackModal/FeedbackModal";
import FeedbackProvider from "./context/FeedbackContext";
import GlobalSkillnaavFavicon from "./components/GlobalSkillnaavFavicon";
import SkillnaavTabBrandingLayout from "./components/SkillnaavTabBrandingLayout";

// ---------- LAZY IMPORTS ----------
const Home = lazy(() => import("./pages/Home/Home"));
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Admin/Login"));

const PricingPage = lazy(() => import("./pages/PricingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const VisionPage = lazy(() => import("./pages/VisionPage"));
const VerifyCertificate = lazy(() => import("./WebApp/MainPage/VerifyCertificate"));

const UserCreateAccount = lazy(() => import("./WebApp/Flows/UserFlow/SignUpLogin/UserCreateAccount"));
const UserLogin = lazy(() => import("./WebApp/Flows/UserFlow/SignUpLogin/UserLogin"));
const UserFlow = lazy(() => import("./WebApp/Flows/UserFlow/UserFlow"));
const UserMainPage = lazy(() => import("./WebApp/Flows/UserFlow/MainPage/UserMainPage"));
const UserSupportPage = lazy(() => import("./WebApp/Flows/UserFlow/MainPage/support/UserSupportPage"));
const UserforgotPassword = lazy(() => import("./WebApp/Flows/UserFlow/SignUpLogin/UserforgotPassword"));

const SkillnaavAnalysis = lazy(() => import("./WebApp/Flows/UserFlow/MainPage/SkillnaavAnalysis"));

const PartnerFlow = lazy(() => import("./WebApp/Flows/PartnerFlow/PartnerFlow"));
const PartnerCreateAccount = lazy(() => import("./WebApp/Flows/PartnerFlow/SignUpLogin/PartnerCreateAccount"));
const PartnerLogin = lazy(() => import("./WebApp/Flows/PartnerFlow/SignUpLogin/PartnerLogin"));
const PartnerProfilePicture = lazy(() => import("./WebApp/Flows/PartnerFlow/SignUpLogin/UserProfileBuilding/PartnerProfilePicture"));
const PartnerMainPage = lazy(() => import("./WebApp/Flows/PartnerFlow/MainPage/PartnerMainPage"));
const PartnerSupportPage = lazy(() => import("./WebApp/Flows/PartnerFlow/MainPage/PartnerSupportPage"));
const PartnerforgotPassword = lazy(() => import("./WebApp/Flows/PartnerFlow/SignUpLogin/PartnerforgotPassword"));

const AdminCreateAccount = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminCreateAccount"));
const AdminLogin = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminLogin"));
const AdminLoginOtp = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminLoginOtp"));
const AdminForgotPassword = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminForgotPassword"));
const AdminResetPassword = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminResetPassword"));
const AdminProfileForm = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminProfileBuilding/AdminProfileForm"));
const AdminProfilePicture = lazy(() => import("./WebApp/Flows/AdminFlow/SignUpLogin/AdminProfileBuilding/AdminProfilePicture"));
const AdminMainPage = lazy(() => import("./WebApp/Flows/AdminFlow/MainPage/AdminMainPage"));

const TryforFree = lazy(() => import("./WebApp/TryforFree"));

const SchoolAdminFlow = lazy(() => import("./WebApp/Flows/SchoolAdminFlow/SchoolAdminFlow"));
const SchoolAdminResetPassword = lazy(() => import("./WebApp/Flows/SchoolAdminFlow/SignUpLogin/SchoolAdminResetPassword"));
const SchoolAdminForgotPassword = lazy(() => import("./WebApp/Flows/SchoolAdminFlow/SignUpLogin/SchoolAdminForgotPassword"));
const SchoolAdminSupportPage = lazy(() => import("./WebApp/Flows/SchoolAdminFlow/MainPage/pages/SchoolAdminSupportPage"));

function App() {
  return (
    <FeedbackProvider>
     <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GlobalSkillnaavFavicon />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Website */}
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/faqs" element={<FaqPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/vision" element={<VisionPage />} />
            <Route path="/verify/:certificateId" element={<VerifyCertificate />} />

            {/* User */}
            <Route path="/user" element={<UserFlow />} />
            <Route path="/user-create-account" element={<UserCreateAccount />} />
            <Route path="/user/login" element={<UserLogin />} />

            <Route path="/user-main-page/*" element={<UserMainPage />} />
            <Route path="/user-support" element={<UserSupportPage />} />
            <Route path="/user-forgot-password" element={<UserforgotPassword />} />
           

            <Route path="/skillnaav-analysis" element={<SkillnaavAnalysis />} />

            {/* Partner */}
            <Route path="/partner" element={<PartnerFlow />} />
            <Route path="/partner-create-account" element={<PartnerCreateAccount />} />
            <Route path="/partner/login" element={<PartnerLogin />} />
            <Route path="/partner-profile-picture" element={<PartnerProfilePicture />} />
            <Route path="/partner-main-page/*" element={<PartnerMainPage />} />
            <Route path="/partner-support" element={<PartnerSupportPage />} />
            <Route path="/partner-forgot-password" element={<PartnerforgotPassword />} />

            <Route element={<SkillnaavTabBrandingLayout />}>
              {/* Admin */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin-login" element={<Login />} />
              <Route path="/admin-create-account" element={<AdminCreateAccount />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/login-otp" element={<AdminLoginOtp />} />
              <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
              <Route path="/admin/reset-password" element={<AdminResetPassword />} />
              <Route path="/admin-profile-form" element={<AdminProfileForm />} />
              <Route path="/admin-profile-picture" element={<AdminProfilePicture />} />
              <Route path="/admin-main-page/*" element={<AdminMainPage />} />

              {/* School */}
              <Route path="/schooladmin/*" element={<SchoolAdminFlow />} />
              <Route path="/schooladmin-support" element={<SchoolAdminSupportPage />} />
              <Route path="/schooladmin/reset-password/:token" element={<SchoolAdminResetPassword />} />
              <Route path="/schooladmin/forgot-password" element={<SchoolAdminForgotPassword />} />
            </Route>

            <Route path="/choose-role" element={<TryforFree />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <FeedbackModal />
      </BrowserRouter>
    </FeedbackProvider>
  );
}

export default App;
