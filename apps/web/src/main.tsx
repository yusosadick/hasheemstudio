import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import Landing from "./pages/Landing";
import UploadWizardPrototype from "./pages/UploadWizardPrototype";
import JobResultPrototype from "./pages/JobResultPrototype";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Landing />} />
          <Route path="/prototypes/upload" element={<UploadWizardPrototype />} />
          <Route path="/prototypes/job-result" element={<JobResultPrototype />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
