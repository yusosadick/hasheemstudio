import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import Landing from "./pages/Landing";
import UploadWizardPrototype from "./pages/UploadWizardPrototype";
import JobResultPrototype from "./pages/JobResultPrototype";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Upload from "./pages/Upload";
import JobResult from "./pages/JobResult";
import { RequireAuth } from "./components/RequireAuth";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/prototypes/upload" element={<UploadWizardPrototype />} />
          <Route path="/prototypes/job-result" element={<JobResultPrototype />} />
          <Route element={<RequireAuth />}>
            <Route path="/app/upload" element={<Upload />} />
            <Route path="/app/jobs/:id" element={<JobResult />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
