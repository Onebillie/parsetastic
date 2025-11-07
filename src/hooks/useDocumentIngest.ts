import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderAllPdfPagesToBlobs } from "@/lib/pdf-to-image";

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
      
      // Convert PDF to high-res image for better OCR accuracy
      let fileToUpload: File | Blob = file;
      let uploadFileName = file.name;
      
      if (file.type === 'application/pdf') {
        console.log('Converting PDF to high-resolution images...');
        toast({
          title: "Processing PDF",
          description: "Converting all pages to high-resolution images...",
        });
        
        try {
          const imageBlobs = await renderAllPdfPagesToBlobs(file, 2048);
          console.log(`Converted ${imageBlobs.length} pages`);
          
          toast({
            title: "Uploading Pages",
            description: `Uploading ${imageBlobs.length} pages to storage...`,
          });
          
          const uploadedUrls: string[] = [];
          
          for (let i = 0; i < imageBlobs.length; i++) {
            const pageFileName = file.name.replace('.pdf', `-page-${i + 1}.png`);
            const pageFile = new File([imageBlobs[i]], pageFileName, { type: 'image/png' });
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('bills-converted')
              .upload(`${Date.now()}-${pageFileName}`, pageFile);
            
            if (uploadError) throw uploadError;
            
            const { data: urlData } = supabase.storage
              .from('bills-converted')
              .getPublicUrl(uploadData.path);
            
            uploadedUrls.push(urlData.publicUrl);
          }
          
          formData.append('page_urls', JSON.stringify(uploadedUrls));
          formData.append('is_multipage', 'true');
          
          console.log('All pages uploaded successfully');
        } catch (conversionError) {
          console.warn('PDF conversion failed, using original:', conversionError);
          // Continue with original PDF if conversion fails
        }
      }

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
