-- Add field_mappings column to json_schema_versions table
ALTER TABLE json_schema_versions 
ADD COLUMN IF NOT EXISTS field_mappings jsonb DEFAULT '{}'::jsonb;