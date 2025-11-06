-- Create documents table for storing all ingested documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  document_type TEXT,
  classification_confidence NUMERIC(3,2),
  parsed_data JSONB,
  confidence_scores JSONB,
  requires_review BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create document_corrections table for training data
CREATE TABLE public.document_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT NOT NULL,
  confidence_before NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create document_frames table for video key frames
CREATE TABLE public.document_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  frame_url TEXT NOT NULL,
  timestamp_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create training_examples table for RAG
CREATE TABLE public.training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  example_data JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhooks table for webhook management
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  secret TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_phone ON public.documents(phone_number);
CREATE INDEX idx_documents_type ON public.documents(document_type);
CREATE INDEX idx_documents_requires_review ON public.documents(requires_review);
CREATE INDEX idx_document_corrections_document_id ON public.document_corrections(document_id);
CREATE INDEX idx_document_frames_document_id ON public.document_frames(document_id);
CREATE INDEX idx_training_examples_type ON public.training_examples(document_type);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies (public access for now - adjust based on auth requirements)
CREATE POLICY "Allow all access to documents" ON public.documents FOR ALL USING (true);
CREATE POLICY "Allow all access to document_corrections" ON public.document_corrections FOR ALL USING (true);
CREATE POLICY "Allow all access to document_frames" ON public.document_frames FOR ALL USING (true);
CREATE POLICY "Allow all access to training_examples" ON public.training_examples FOR ALL USING (true);
CREATE POLICY "Allow all access to webhooks" ON public.webhooks FOR ALL USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();