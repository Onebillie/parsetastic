import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate overall document confidence as MINIMUM of all field confidences
function calculateOverallConfidence(extracted: any): number {
  const confidences: number[] = [];
  
  function extractConfidences(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith('_conf') && typeof value === 'number') {
        confidences.push(value);
      } else if (typeof value === 'object') {
        extractConfidences(value, `${path}.${key}`);
      }
    }
  }
  
  extractConfidences(extracted);
  
  if (confidences.length === 0) return 0.0;
  
  // Return MINIMUM confidence - document is only as good as its weakest field
  return Math.min(...confidences);
}

// Trigger webhooks
async function triggerWebhook(supabase: any, eventType: string, payload: any) {
  try {
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('event_type', eventType)
      .eq('active', true);
    
    if (!webhooks || webhooks.length === 0) return;
    
    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhook.secret || '',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('Webhook delivery failed:', webhook.url, error);
      }
    }
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const phone = formData.get('phone') as string;
    const autopilot = formData.get('autopilot') === 'true';
    
    if (!file || !phone) {
      return new Response(
        JSON.stringify({ error: "File and phone number are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Upload file
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('bills')
      .upload(fileName, file, { contentType: file.type, upsert: true });
    
    if (uploadError) throw uploadError;
    
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/bills/${fileName}`;
    
    console.log(`Starting optimized extraction pipeline for file: ${fileName}`);
    
    // STEP 1: Direct extraction with GPT-5 (replaces parse + classify + extract)
    const parsed = await supabase.functions.invoke('mcp-parse', {
      body: { file_url: fileUrl, file_type: file.type }
    });
    
    if (parsed.error) {
      console.error('Parse failed:', parsed.error);
      throw new Error(`Parse failed: ${parsed.error.message}`);
    }
    
    const extractedData = parsed.data.extracted_data;
    const classification = {
      document_class: parsed.data.document_class,
      document_subclass: parsed.data.document_subclass,
      supplier_name: parsed.data.supplier_name,
      confidence: extractedData.classification?.confidence || 1.0
    };
    
    console.log('Direct extraction complete:', classification.document_subclass);
    
    // STEP 2: Validate extracted data
    const validated = await supabase.functions.invoke('mcp-validate', {
      body: {
        extracted_data: extractedData,
        classification: classification
      }
    });
    
    if (validated.error) {
      console.error('Validation failed:', validated.error);
      throw new Error(`Validation failed: ${validated.error.message}`);
    }
    
    console.log('Validation complete');
    
    // Calculate overall confidence as MINIMUM of all field confidences
    const overallConfidence = calculateOverallConfidence(extractedData);
    
    // Strict HITL thresholds
    const CRITICAL_THRESHOLD = 0.995;
    const IMPORTANT_THRESHOLD = 0.98;
    const OVERALL_THRESHOLD = 0.90;
    
    // Check critical fields
    const criticalFields = [
      extractedData.payment_details?.total_amount_due_conf,
      extractedData.supplier_details?.due_date_conf,
      extractedData.customer_details?.account_number_conf,
      extractedData.electricity_bill?.mprn_conf,
      extractedData.gas_bill?.gprn_conf,
    ].filter(c => c !== undefined && c !== null);
    
    const criticalFieldsLow = criticalFields.some(c => c < CRITICAL_THRESHOLD);
    
    // Determine if review is needed
    const requiresReview = 
      criticalFieldsLow ||
      overallConfidence < OVERALL_THRESHOLD || 
      !autopilot || 
      validated.data.hitl_required ||
      validated.data.status === 'failed';
    
    console.log(`Confidence: ${overallConfidence}, Threshold: ${OVERALL_THRESHOLD}, Requires Review: ${requiresReview}`);
    
    // Create document record with optimized pipeline results
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        file_type: file.type,
        file_url: fileUrl,
        phone_number: phone,
        status: requiresReview ? 'pending_review' : 'approved',
        document_type: classification.document_subclass || classification.document_class,
        classification_confidence: overallConfidence,
        parsed_data: {
          classification: classification,
          extracted: extractedData,
          validation: validated.data,
        },
        confidence_scores: { 
          overall: overallConfidence,
          critical_fields_ok: !criticalFieldsLow 
        },
        requires_review: requiresReview,
        approved: !requiresReview && autopilot,
        approved_at: !requiresReview && autopilot ? new Date().toISOString() : null,
      })
      .select()
      .single();
    
    if (docError) throw docError;
    
    console.log(`Document created: ${document.id}, status: ${document.status}`);
    
    // Trigger webhooks
    await triggerWebhook(supabase, 'document.created', {
      document_id: document.id,
      file_name: file.name,
      document_type: classification.document_subclass,
      supplier: classification.supplier_name,
      requires_review: requiresReview,
      overall_confidence: overallConfidence,
    });
    
    if (requiresReview) {
      await triggerWebhook(supabase, 'document.review_needed', {
        document_id: document.id,
        overall_confidence: overallConfidence,
        validation_issues: validated.data.issues || [],
      });
    } else if (autopilot) {
      await triggerWebhook(supabase, 'document.approved', {
        document_id: document.id,
        auto_approved: true,
        overall_confidence: overallConfidence,
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      document_id: document.id,
      requires_review: requiresReview,
      classification: classification,
      overall_confidence: overallConfidence,
      validation: validated.data,
      file_url: fileUrl,
      extracted_data: extractedData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Error in ingest-document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
