CREATE TYPE public.client_status AS ENUM ('ativo', 'em_negociacao', 'cancelado');
CREATE TYPE public.client_stage AS ENUM ('prospeccao', 'proposta_enviada', 'negociacao', 'ativo', 'cancelado');
CREATE TYPE public.entry_type AS ENUM ('recorrente', 'servico', 'venda', 'comissao');

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nicho TEXT NOT NULL DEFAULT '',
  status public.client_status NOT NULL DEFAULT 'em_negociacao',
  stage public.client_stage NOT NULL DEFAULT 'prospeccao',
  probability SMALLINT NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  owner TEXT NOT NULL DEFAULT '',
  since DATE,
  monthly_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_user ON public.clients (user_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
  ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN entry_type public.entry_type,
  ADD COLUMN due_date DATE,
  ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_transactions_client ON public.transactions (client_id);

CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL DEFAULT 'Mensal',
  next_due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Outros',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_expenses_user ON public.recurring_expenses (user_id, next_due_date);
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring expenses" ON public.recurring_expenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
