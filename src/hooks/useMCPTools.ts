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

  const classify = async (blocks: any[], tables: any[], metadata: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('mcp-classify', {
        body: { blocks, tables, metadata }
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Classification failed", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const extract = async (blocks: any[], tables: any[], classification: any, template_hint?: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('mcp-extract', {
        body: { blocks, tables, classification, template_hint }
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({ title: "Extraction failed", description: error.message, variant: "destructive" });
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
      // Step 1: Parse
      const parsed = await parse(file_url, file_type);
      
      // Step 2: Classify
      const classification = await classify(parsed.blocks, parsed.tables, parsed.metadata);
      
      // Step 3: Extract
      const extracted = await extract(
        parsed.blocks,
        parsed.tables,
        classification,
        { supplier_name: classification.supplier_name }
      );
      
      // Step 4: Validate
      const validation = await validate(extracted, classification);
      
      return {
        parsed,
        classification,
        extracted,
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
    classify,
    extract,
    validate,
    learn,
    runFullPipeline,
  };
};
