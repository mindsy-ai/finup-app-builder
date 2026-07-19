import { createContext, useContext, useMemo, useState } from "react";

type NavContextValue = {
  navOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
};

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const value = useMemo<NavContextValue>(
    () => ({
      navOpen,
      openNav: () => setNavOpen(true),
      closeNav: () => setNavOpen(false),
    }),
    [navOpen],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav deve ser usado dentro de NavProvider");
  return ctx;
}
