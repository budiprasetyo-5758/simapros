
-- Add Gmail verification columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS gmail_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_verification_code text,
  ADD COLUMN IF NOT EXISTS gmail_verification_expires_at timestamptz;
