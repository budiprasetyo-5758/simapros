import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SubmitProject from "./pages/SubmitProject";
import EditProject from "./pages/EditProject";
import ApprovalQueue from "./pages/ApprovalQueue";
import ManageProjects from "./pages/ManageProjects";
import ProjectDetail from "./pages/ProjectDetail";
import GanttFullscreen from "./pages/GanttFullscreen";
import UserManagement from "./pages/UserManagement";
import EditProfile from "./pages/EditProfile";
import EditRequestsQueue from "./pages/EditRequestsQueue";
import AdminSubmitProject from "./pages/AdminSubmitProject";
import WeeklyReport from "./pages/WeeklyReport";
import NotificationSettings from "./pages/NotificationSettings";
import MasterKategoriProyek from "./pages/MasterKategoriProyek";
import MasterUnitKerja from "./pages/MasterUnitKerja";
import UnitKerjaRequests from "./pages/UnitKerjaRequests";
import VerificationPending from "./pages/VerificationPending";
import Timeline from "./pages/Timeline";
import FollowUp from "./pages/FollowUp";
import FollowUpCategory from "./pages/FollowUpCategory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/verification-pending" element={<VerificationPending />} />
            <Route path="/submit" element={<SubmitProject />} />
            <Route path="/edit/:id" element={<EditProject />} />
            <Route path="/approval" element={<ApprovalQueue />} />
            <Route path="/manage" element={<ManageProjects />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="/project/:id/gantt" element={<GanttFullscreen />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/profile" element={<EditProfile />} />
            <Route path="/edit-requests" element={<EditRequestsQueue />} />
            <Route path="/admin-submit" element={<AdminSubmitProject />} />
            <Route path="/weekly-report" element={<WeeklyReport />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/master-kategori" element={<MasterKategoriProyek />} />
            <Route path="/master-unit-kerja" element={<MasterUnitKerja />} />
            <Route path="/unit-kerja-requests" element={<UnitKerjaRequests />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/follow-up" element={<FollowUp />} />
            <Route path="/follow-up/:category" element={<FollowUpCategory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
