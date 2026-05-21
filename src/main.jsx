import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./lib/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./routes/Login";
import Signup from "./routes/Signup";
import ForgotPassword from "./routes/ForgotPassword";
import ResetPassword from "./routes/ResetPassword";
import AuthCallback from "./routes/AuthCallback";
import Dashboard from "./routes/Dashboard";
import ProjectView from "./routes/ProjectView";
import ProjectSettings from "./routes/ProjectSettings";
import ScenarioEditor from "./routes/ScenarioEditor";
import AcceptInvite from "./routes/AcceptInvite";
import AccountPage from "./routes/AccountPage";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/settings"
              element={
                <ProtectedRoute>
                  <ProjectSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/scenarios/:scenarioId"
              element={
                <ProtectedRoute>
                  <ScenarioEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
