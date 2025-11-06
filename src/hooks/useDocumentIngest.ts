import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderPdfFirstPageToBlob } from "@/lib/pdf-to-image";

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
      // Convert PDF to high-res image for better OCR accuracy
      let fileToUpload: File | Blob = file;
      let uploadFileName = file.name;
      
      if (file.type === 'application/pdf') {
        console.log('Converting PDF to high-resolution image...');
        toast({
          title: "Processing PDF",
          description: "Converting to high-resolution image for better accuracy...",
        });
        
        try {
          const imageBlob = await renderPdfFirstPageToBlob(file, 2048); // High resolution
          uploadFileName = file.name.replace('.pdf', '.png');
          fileToUpload = new File(
            [imageBlob], 
            uploadFileName,
            { type: 'image/png' }
          );
          console.log('PDF converted successfully:', uploadFileName);
        } catch (conversionError) {
          console.warn('PDF conversion failed, using original:', conversionError);
          // Continue with original PDF if conversion fails
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload, uploadFileName);
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
