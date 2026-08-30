import { DashboardLayout } from "@/components/DashboardLayout";
import { RoleGuard } from "@/components/RoleGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
