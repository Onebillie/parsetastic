import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useMCPTools = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const parse = async (file_url: string, file_type: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('mcp-parse', {
        body: { file_url, file_type }
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Parse failed", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const validate = async (extracted_data: any, classification: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('mcp-validate', {
        body: { extracted_data, classification }
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Validation failed", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const learn = async (document_id: string, corrections: any[], context: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('mcp-learn', {
        body: { document_id, corrections, context }
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Learning failed", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const runFullPipeline = async (file_url: string, file_type: string) => {
    setLoading(true);
    try {
      // Step 1: Direct extraction with GPT-5
      const parsed = await parse(file_url, file_type);
      
      const extractedData = parsed.extracted_data;
      const classification = {
        document_class: parsed.document_class,
        document_subclass: parsed.document_subclass,
        supplier_name: parsed.supplier_name,
      };
      
      // Step 2: Validate
      const validation = await validate(extractedData, classification);
      
      return {
        classification,
        extracted: extractedData,
        validation,
      };
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    parse,
    validate,
    learn,
    runFullPipeline,
  };
};
