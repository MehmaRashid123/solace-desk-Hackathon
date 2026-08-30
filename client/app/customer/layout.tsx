import { DashboardLayout } from "@/components/DashboardLayout";
import { RoleGuard } from "@/components/RoleGuard";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["CUSTOMER"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleGuard>
  );
}
