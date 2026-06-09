CREATE TABLE public.pic_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pic_options ENABLE ROW LEVEL SECURITY;

-- Read: semua user bisa baca (untuk dropdown)
CREATE POLICY "pic_options_select" ON public.pic_options
  FOR SELECT USING (true);

-- Insert/Update/Delete: hanya super_admin
CREATE POLICY "pic_options_admin_insert" ON public.pic_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "pic_options_admin_update" ON public.pic_options
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "pic_options_admin_delete" ON public.pic_options
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Seed data dari hardcode yang ada
INSERT INTO public.pic_options (name, sort_order) VALUES
  ('Dr Ihza', 1),
  ('Dr Qonita', 2),
  ('Bg Salman', 3),
  ('Aqila', 4);
