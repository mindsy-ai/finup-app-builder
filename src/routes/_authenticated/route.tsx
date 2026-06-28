import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Topbar } from "@/components/Topbar";

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
    <div className="min-h-screen bg-[color:var(--bg-primary)] text-white">
      <Topbar />
      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
