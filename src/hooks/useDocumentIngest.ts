import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface IngestResult {
  success: boolean;
  document_id: string;
  requires_review: boolean;
  classification: {
    type: string;
    confidence: number;
  };
  confidence_scores: any;
}

export const useDocumentIngest = () => {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const { toast } = useToast();

  const ingestDocument = async (file: File, phone: string, autopilot: boolean = false) => {
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('phone', phone);
      formData.append('autopilot', autopilot.toString());

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ingestion failed');
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: data.requires_review ? "Review Required" : "Document Processed",
        description: data.requires_review 
          ? `Document classified as ${data.classification.type} (${Math.round(data.classification.confidence * 100)}% confidence). Please review.`
          : `Document auto-approved with ${Math.round(data.classification.confidence * 100)}% confidence.`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Ingestion Failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    result,
    ingestDocument,
  };
};
