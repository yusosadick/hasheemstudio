import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import Landing from "./pages/Landing";
import UploadWizardPrototype from "./pages/UploadWizardPrototype";
import JobResultPrototype from "./pages/JobResultPrototype";
import Login from "./pages/auth/LoginPage";
import Signup from "./pages/auth/RegisterPage";
import ForgotPassword from "./pages/auth/ForgotPasswordPage";
import ResetPassword from "./pages/auth/ResetPasswordPage";
import VerifyEmail from "./pages/auth/VerifyEmailPage";
import AuthCallback from "./pages/auth/AuthCallbackPage";
import { MotionConfig } from "framer-motion";
import Upload from "./pages/Upload";
import JobResult from "./pages/JobResult";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user"><BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/register" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/prototypes/upload" element={<UploadWizardPrototype />} />
          <Route path="/prototypes/job-result" element={<JobResultPrototype />} />
            <Route path="/app/upload" element={<Upload />} />
            <Route path="/app/jobs/:id" element={<JobResult />} />
        </Route>
      </Routes>
    </BrowserRouter></MotionConfig>
  </React.StrictMode>,
);
