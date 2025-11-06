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
    
    console.log(`[${new Date().toISOString()}] Starting optimized extraction pipeline for file: ${fileName}`);
    
    // STEP 1: Direct extraction with GPT-5 (replaces parse + classify + extract)
    console.log('Calling mcp-parse...');
    const parseStart = Date.now();
    const parsed = await supabase.functions.invoke('mcp-parse', {
      body: { file_url: fileUrl, file_type: file.type }
    });
    console.log(`Parse completed in ${Date.now() - parseStart}ms`);
    
    if (parsed.error) {
      console.error('Parse failed:', parsed.error);
      throw new Error(`Parse failed: ${parsed.error.message || 'Unknown error'}`);
    }
    
    if (!parsed.data?.extracted_data) {
      console.error('Parse returned no data:', parsed);
      throw new Error('Parse returned no extracted data');
    }
    
    const extractedData = parsed.data.extracted_data;
    const classification = {
      document_class: parsed.data.document_class || 'unknown',
      document_subclass: parsed.data.document_subclass || 'unknown',
      supplier_name: parsed.data.supplier_name || 'Unknown',
      confidence: extractedData.classification?.confidence || 0.0
    };
    
    console.log('Extraction results:', {
      docClass: classification.document_class,
      supplier: classification.supplier_name,
      customer: extractedData.customer_details?.customer_name,
      totalDue: extractedData.payment_details?.total_amount_due,
      processingTime: parsed.data.processing_time_ms
    });
    
    // STEP 2: Validate extracted data
    console.log('Calling mcp-validate...');
    const validateStart = Date.now();
    const validated = await supabase.functions.invoke('mcp-validate', {
      body: {
        extracted_data: extractedData,
        classification: classification
      }
    });
    console.log(`Validation completed in ${Date.now() - validateStart}ms`);
    
    // Don't fail ingestion if validation has issues - flag for review instead
    if (validated.error) {
      console.error('Validation error (continuing with fallback):', validated.error);
    }
    
    const validationData = validated.data || {
      status: 'warning',
      overall_confidence: 0.5,
      issues: [{ 
        field: 'validation', 
        code: 'VALIDATION_ERROR', 
        message: 'Validation service unavailable',
        severity: 'warning'
      }],
      hitl_required: true,
      hitl_reasons: ['Validation error - manual review required']
    };
    
    console.log('Validation results:', {
      status: validationData.status,
      confidence: validationData.overall_confidence,
      issuesCount: validationData.issues?.length || 0,
      hitlRequired: validationData.hitl_required
    });
    
    // Calculate overall confidence as MINIMUM of all field confidences
    const overallConfidence = calculateOverallConfidence(extractedData);
    console.log(`Overall confidence: ${overallConfidence.toFixed(3)}`);
    
    // Strict HITL thresholds
    const CRITICAL_THRESHOLD = 0.995;
    const IMPORTANT_THRESHOLD = 0.98;
    const OVERALL_THRESHOLD = 0.90;
    
    // Check critical fields
    const criticalFields = [
      { name: 'total_amount_due', conf: extractedData.payment_details?.total_amount_due_conf },
      { name: 'due_date', conf: extractedData.supplier_details?.due_date_conf },
      { name: 'account_number', conf: extractedData.customer_details?.account_number_conf },
      { name: 'mprn', conf: extractedData.electricity_bill?.mprn_conf },
      { name: 'gprn', conf: extractedData.gas_bill?.gprn_conf },
    ].filter(c => c.conf !== undefined && c.conf !== null);
    
    const criticalFieldsLow = criticalFields.filter(c => c.conf! < CRITICAL_THRESHOLD);
    
    if (criticalFieldsLow.length > 0) {
      console.log('Low confidence critical fields:', criticalFieldsLow.map(c => `${c.name}:${c.conf?.toFixed(3)}`));
    }
    
    // Determine if review is needed
    const requiresReview = 
      criticalFieldsLow.length > 0 ||
      overallConfidence < OVERALL_THRESHOLD || 
      !autopilot || 
      validationData.hitl_required ||
      validationData.status === 'failed';
    
    const hitlReasons = [];
    if (criticalFieldsLow.length > 0) hitlReasons.push(`Critical fields low confidence: ${criticalFieldsLow.map(c => c.name).join(', ')}`);
    if (overallConfidence < OVERALL_THRESHOLD) hitlReasons.push(`Overall confidence ${overallConfidence.toFixed(3)} < ${OVERALL_THRESHOLD}`);
    if (!autopilot) hitlReasons.push('Autopilot disabled');
    if (validationData.hitl_required) hitlReasons.push('Validation flagged for review');
    if (validationData.status === 'failed') hitlReasons.push('Validation failed');
    
    console.log('HITL Decision:', {
      requiresReview,
      reasons: hitlReasons,
      criticalFieldsCount: criticalFields.length,
      lowConfidenceCount: criticalFieldsLow.length
    });
    
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
          validation: validationData,
        },
        confidence_scores: { 
          overall: overallConfidence,
          critical_fields_ok: criticalFieldsLow.length === 0,
          hitl_reasons: hitlReasons
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
        validation_issues: validationData.issues || [],
        hitl_reasons: hitlReasons,
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
      validation: validationData,
      file_url: fileUrl,
      extracted_data: extractedData,
      hitl_reasons: hitlReasons,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error in ingest-document:`, error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error during document ingestion',
      details: 'Failed to process document. Please try again or contact support.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
