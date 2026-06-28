import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: () => (
    <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-10 text-center">
      <h1 className="text-2xl font-bold text-white">Clientes</h1>
      <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Em breve nesta fase do projeto.</p>
    </div>
  ),
});
