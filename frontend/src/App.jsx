import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import LegalPage from "@/pages/LegalPage";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import DocumentDetail from "@/pages/DocumentDetail";
import CreateDocument from "@/pages/CreateDocument";
import AuditTrail from "@/pages/AuditTrail";
import Settings from "@/pages/Settings";
import TrainingMatrix from "@/pages/TrainingMatrix";
import MyTraining from "@/pages/MyTraining";
import AssetManagement from "@/pages/AssetManagement";
import DocumentSettings from "@/pages/DocumentSettings";
import Library from "@/pages/Library";
import SuperAdmin from "@/pages/SuperAdmin";
import "@/App.css";

function ProtectedRoute({ children, roles }) {
  const { user, hasRole } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/dashboard" replace />;

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/forgot-password" element={
        user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />
      } />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<LegalPage type="privacy" />} />
      <Route path="/terms" element={<LegalPage type="terms" />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/documents" element={
        <ProtectedRoute><Documents /></ProtectedRoute>
      } />
      <Route path="/documents/create" element={
        <ProtectedRoute roles={["admin", "author"]}><CreateDocument /></ProtectedRoute>
      } />
      <Route path="/documents/:id" element={
        <ProtectedRoute><DocumentDetail /></ProtectedRoute>
      } />
      <Route path="/documents/:id/edit" element={
        <ProtectedRoute roles={["admin", "author"]}><CreateDocument /></ProtectedRoute>
      } />
      <Route path="/audit" element={
        <ProtectedRoute roles={["admin"]}><AuditTrail /></ProtectedRoute>
      } />
      <Route path="/users" element={<Navigate to="/settings" replace />} />
      <Route path="/settings" element={
        <ProtectedRoute roles={["admin"]}><Settings /></ProtectedRoute>
      } />
      <Route path="/training-matrix" element={
        <ProtectedRoute roles={["admin", "training_coordinator"]}><TrainingMatrix /></ProtectedRoute>
      } />
      <Route path="/my-training" element={
        <ProtectedRoute><MyTraining /></ProtectedRoute>
      } />
      <Route path="/library" element={
        <ProtectedRoute><Library /></ProtectedRoute>
      } />
      <Route path="/assets" element={
        <ProtectedRoute roles={["admin"]}><AssetManagement /></ProtectedRoute>
      } />
      <Route path="/documents/settings" element={
        <ProtectedRoute roles={["admin"]}><DocumentSettings /></ProtectedRoute>
      } />
      <Route path="/superadmin" element={
        <ProtectedRoute roles={["super_admin"]}><SuperAdmin /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
