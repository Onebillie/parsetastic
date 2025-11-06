-- Create knowledge_documents table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create json_schema_versions table
CREATE TABLE IF NOT EXISTS public.json_schema_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  schema_definition JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create api_test_requests table
CREATE TABLE IF NOT EXISTS public.api_test_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB,
  response_body JSONB,
  status_code INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create supplier_templates table
CREATE TABLE IF NOT EXISTS public.supplier_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  template_data JSONB NOT NULL,
  accuracy_stats JSONB DEFAULT '{}'::jsonb,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.json_schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_test_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now)
CREATE POLICY "Allow all access to knowledge_documents" ON public.knowledge_documents FOR ALL USING (true);
CREATE POLICY "Allow all access to json_schema_versions" ON public.json_schema_versions FOR ALL USING (true);
CREATE POLICY "Allow all access to api_test_requests" ON public.api_test_requests FOR ALL USING (true);
CREATE POLICY "Allow all access to supplier_templates" ON public.supplier_templates FOR ALL USING (true);

-- Create update trigger for knowledge_documents
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();