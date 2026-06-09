-- Migration: add_pic_to_projects
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pic text DEFAULT NULL;
