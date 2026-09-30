CREATE TABLE IF NOT EXISTS public.buymeacoffee_products (
  extra_id text PRIMARY KEY,
  file_id text NOT NULL UNIQUE,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.buymeacoffee_orders (
  transaction_id text NOT NULL,
  extra_id text NOT NULL,
  file_id text NOT NULL,
  email text,
  status text NOT NULL,
  amount numeric,
  currency text,
  quantity integer NOT NULL DEFAULT 1,
  raw jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, extra_id)
);

CREATE INDEX IF NOT EXISTS idx_buymeacoffee_orders_access
  ON public.buymeacoffee_orders(email, file_id, status);