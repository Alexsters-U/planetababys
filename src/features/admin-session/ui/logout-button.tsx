"use client";

import { useRouter } from "next/navigation";
import {useAdminSession} from "@/features/admin-session/model/store";
import BrandIcon from "@/shared/ui/brand-icon";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    useAdminSession.getState().clear();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-brand-line px-4 py-2 text-sm font-semibold text-brand-muted transition hover:bg-brand-lilac"
    >
      <BrandIcon name="logout" size={18}/>Cerrar sesión
    </button>
  );
}
