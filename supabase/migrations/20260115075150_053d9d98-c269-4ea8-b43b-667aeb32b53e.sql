-- Migration 1: Add enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'pending_creation';