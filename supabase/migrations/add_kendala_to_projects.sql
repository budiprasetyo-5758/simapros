-- Add kendala (obstacle) fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS obstacle_notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_obstacle boolean DEFAULT false;
