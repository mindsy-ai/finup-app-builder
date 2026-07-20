import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Wallet, Receipt, LineChart, Users } from "lucide-react";

const NAV = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/lancamentos", label: "Entradas", icon: Receipt },
  { to: "/relatorios", label: "Relatórios", icon: LineChart },
  { to: "/clientes", label: "Clientes", icon: Users },
] as const;

/**
 * Navegação principal no mobile.
 *
 * Substitui o menu lateral: com cinco destinos fixos, a barra inferior deixa
 * tudo a um toque na zona do polegar, sem gastar um passo para abrir a gaveta.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border-default)] bg-[color:var(--bg-nav)]/95 backdrop-blur-lg lg:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex h-[58px] flex-col items-center justify-center gap-1 text-[color:var(--text-secondary)] transition-colors"
                activeProps={{
                  className:
                    "flex h-[58px] flex-col items-center justify-center gap-1 text-white transition-colors",
                }}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                        isActive ? "gradient-brand" : ""
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
