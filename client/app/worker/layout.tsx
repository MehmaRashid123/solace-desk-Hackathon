import { DashboardLayout } from "@/components/DashboardLayout";
import { RoleGuard } from "@/components/RoleGuard";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["AGENT"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
