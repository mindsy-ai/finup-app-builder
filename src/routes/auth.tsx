import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { FinUpLogo } from "@/components/FinUpLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · FinUp" },
      { name: "description", content: "Acesse sua conta FinUp." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Detect session after OAuth roundtrip
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail se exigido.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Falha ao entrar com Google");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // Session was set inline (iframe preview); navigate.
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <FinUpLogo size={36} />
        </div>
        <div className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-card)] p-6">
          <h1 className="text-xl font-bold text-white">
            {mode === "signin" ? "Entrar na sua conta" : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            Gestão financeira para pequenos negócios.
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--border-default)] bg-transparent px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50"
          >
            <GoogleIcon /> Continuar com Google
          </button>

          <div className="my-4 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
            <span className="h-px flex-1 bg-[color:var(--border-default)]" />
            ou
            <span className="h-px flex-1 bg-[color:var(--border-default)]" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <Field label="E-mail">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="voce@empresa.com"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white gradient-brand disabled:opacity-50"
            >
              {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-[color:var(--text-secondary)] hover:text-white"
          >
            {mode === "signin" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-white placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--brand-purple)] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.23c0-.78-.07-1.53-.2-2.25H12v4.26h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 3-4.33 3-7.54z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.23-2.5c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22z" fill="#34A853"/>
      <path d="M6.39 13.9A6 6 0 0 1 6.07 12c0-.66.12-1.3.32-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.49l3.35-2.59z" fill="#FBBC05"/>
      <path d="M12 6.04c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.97 3.1 14.7 2.2 12 2.2A10 10 0 0 0 3.04 7.51l3.35 2.59C7.18 7.8 9.39 6.04 12 6.04z" fill="#EA4335"/>
    </svg>
  );
}
