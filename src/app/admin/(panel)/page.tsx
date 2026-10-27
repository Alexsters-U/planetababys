import {cookies} from "next/headers";
import {serverApi} from "@/shared/api/server";
import {DASHBOARD_DAYS,type DashboardDays,type DashboardSummary} from "@/shared/analytics";
import Dashboard from "@/features/admin-metrics/ui/dashboard";
export const dynamic="force-dynamic";
export default async function AdminDashboardPage({searchParams}:{searchParams:Promise<{days?:string}>}){
  const query=await searchParams;
  const days=DASHBOARD_DAYS.includes(Number(query.days) as DashboardDays)?Number(query.days):30;
  const summary=await serverApi<DashboardSummary>("/admin/summary?days="+days,(await cookies()).toString());
  return <Dashboard initial={summary}/>;
}
