"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {useAdminSession} from "@/features/admin-session/model/store";
import {toast} from "sonner";
import { spanishValidation } from "@/shared/forms/spanish-validation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No pudimos iniciar sesión");
        setLoading(false);
        return;
      }
      await useAdminSession.getState().refresh();
      toast.success("Bienvenida al panel");
      const requested = new URLSearchParams(window.location.search).get("next");
      const next = requested && requested.startsWith("/admin") ? requested : "/admin";
      router.replace(next);
      router.refresh();
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  }

  return (
    <div className="container-page flex min-h-[70vh] max-w-md items-center py-16">
      <form
        {...spanishValidation}
        onSubmit={handleSubmit}
        className="card w-full space-y-5 p-8"
        data-testid="admin-login-form"
      >
        <div className="text-center">
          <p className="text-4xl" aria-hidden>
            🔐
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-gray-900">
            Panel administrativo
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Acceso restringido a Planeta Baby&apos;s
          </p>
        </div>

        <div>
          <label htmlFor="email" className="label">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            data-testid="admin-email"
            className="input"
            placeholder="test@admin.com"
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            data-testid="admin-password"
            className="input"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert" data-testid="admin-login-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
          data-testid="admin-login-submit"
        >
          {loading ? "Verificando..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
