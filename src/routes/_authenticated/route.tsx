import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { PeriodProvider } from "@/lib/period";
import { NavProvider } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <NavProvider>
      <PeriodProvider>
        <div className="flex min-h-screen bg-[color:var(--bg-primary)] text-white">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 md:py-7">
              <Outlet />
            </main>
          </div>
        </div>
      </PeriodProvider>
    </NavProvider>
  );
}
