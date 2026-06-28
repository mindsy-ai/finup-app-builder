import { Link } from "@tanstack/react-router";
import { FinUpLogo } from "./FinUpLogo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/relatorios", label: "Relatórios" },
  { to: "/clientes", label: "Clientes" },
  { to: "/cobrancas", label: "Cobranças" },
] as const;

export function Topbar() {
  const [initials, setInitials] = useState("JM");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const name = (data.user?.user_metadata?.name as string) ?? email;
      const parts = name.split(/[\s@.]+/).filter(Boolean);
      const first = parts[0]?.[0] ?? "U";
      const second = parts[1]?.[0] ?? "";
      setInitials((first + second).toUpperCase() || "U");
    });
  }, []);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-[color:var(--border-default)] bg-[color:var(--bg-nav)]">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-8">
          <FinUpLogo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="relative px-3 py-4 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-white"
                activeProps={{
                  className:
                    "relative px-3 py-4 text-sm font-semibold text-[color:var(--brand-purple)] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-[color:var(--brand-purple)]",
                }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-[color:var(--border-default)] bg-transparent px-3 py-1.5 text-sm font-medium text-white"
          >
            Jun 2026 ▾
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white gradient-brand">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
