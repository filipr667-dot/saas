import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import DocumentDetail from "@/pages/DocumentDetail";
import CreateDocument from "@/pages/CreateDocument";
import AuditTrail from "@/pages/AuditTrail";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import TrainingMatrix from "@/pages/TrainingMatrix";
import MyTraining from "@/pages/MyTraining";
import "@/App.css";

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
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
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <Login />
      } />
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
      <Route path="/users" element={
        <ProtectedRoute roles={["admin"]}><UserManagement /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute roles={["admin"]}><Settings /></ProtectedRoute>
      } />
      <Route path="/training-matrix" element={
        <ProtectedRoute roles={["admin"]}><TrainingMatrix /></ProtectedRoute>
      } />
      <Route path="/my-training" element={
        <ProtectedRoute><MyTraining /></ProtectedRoute>
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
