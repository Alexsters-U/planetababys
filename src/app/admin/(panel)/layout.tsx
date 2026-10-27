import {Suspense} from "react";
import AdminNavigation from "@/features/admin-session/ui/admin-navigation";
import LogoutButton from "@/features/admin-session/ui/logout-button";
import SessionInfo from "@/features/admin-session/ui/session-info";

export default function AdminPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="container-page py-8">
      <nav className="card mb-7 flex flex-wrap items-center gap-3 p-3" aria-label="Panel admin">
        <AdminNavigation/>
        <span className="flex-1" />
        <SessionInfo/>
        <LogoutButton />
      </nav>
      <Suspense fallback={<p role="status" className="card p-8">Preparando tu centro de cuidado…</p>}>{children}</Suspense>
    </div>
  );
}
