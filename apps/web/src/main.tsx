import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import ServiceInformation from "./pages/ServiceInformation";
import App from "./App";
import Landing from "./pages/Landing";
import Login from "./pages/auth/LoginPage";
import Signup from "./pages/auth/RegisterPage";
import ForgotPassword from "./pages/auth/ForgotPasswordPage";
import ResetPassword from "./pages/auth/ResetPasswordPage";
import VerifyEmail from "./pages/auth/VerifyEmailPage";
import AuthCallback from "./pages/auth/AuthCallbackPage";
import { MotionConfig } from "framer-motion";
import Upload from "./pages/Upload";
import JobResult from "./pages/JobResult";
import AccountPage from "./pages/AccountPage";
import NotFound from "./pages/NotFound";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user"><BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<ServiceInformation kind="privacy" />} />
          <Route path="/terms" element={<ServiceInformation kind="terms" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/register" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/app/upload" element={<Upload />} />
            <Route path="/app/jobs/:id" element={<JobResult />} />
            <Route path="/app/:section" element={<AccountPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter></MotionConfig>
  </React.StrictMode>,
);
