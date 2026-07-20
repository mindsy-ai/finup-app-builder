import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Wallet, Receipt, LineChart, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { FinUpLogo } from "./FinUpLogo";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/lancamentos", label: "Lançamentos", icon: Receipt },
  { to: "/relatorios", label: "Relatórios", icon: LineChart },
  { to: "/clientes", label: "Clientes", icon: Users },
] as const;

export function Sidebar() {
  const [initials, setInitials] = useState("JM");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const fullName = (data.user?.user_metadata?.name as string) ?? email;
      const parts = fullName.split(/[\s@.]+/).filter(Boolean);
      const first = parts[0]?.[0] ?? "U";
      const second = parts[1]?.[0] ?? "";
      setInitials((first + second).toUpperCase() || "U");
      setName(fullName);
    });
  }, []);

  // No mobile a navegação é a barra inferior; este menu é só do desktop.
  return (
    <aside className="sticky top-0 z-auto hidden h-screen w-[238px] flex-shrink-0 flex-col border-r border-[color:var(--border-default)] bg-[color:var(--bg-nav)] p-3.5 lg:flex print:hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 pb-6">
        <FinUpLogo />
      </div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.09em] text-[color:var(--text-muted)]">
        Navegação
      </p>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-white/5"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] font-bold text-white gradient-brand",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-[color:var(--border-default)] px-1.5 pt-3.5">
        <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white gradient-brand">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-white">{name || "Minha conta"}</p>
          <p className="text-[11px] text-[color:var(--text-secondary)]">FinUp</p>
        </div>
      </div>
    </aside>
  );
}
