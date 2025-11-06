import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { document_id, edited_data, corrections } = await req.json();
    
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "Document ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get original document
    const { data: originalDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();
    
    if (!originalDoc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update document with edited data
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        parsed_data: edited_data || originalDoc.parsed_data,
        approved: true,
        approved_at: new Date().toISOString(),
        status: 'approved',
        requires_review: false,
      })
      .eq('id', document_id);
    
    if (updateError) throw updateError;
    
    // Store corrections as training data
    if (corrections && Array.isArray(corrections)) {
      for (const correction of corrections) {
        await supabase.from('document_corrections').insert({
          document_id,
          field_path: correction.field_path,
          original_value: correction.original_value,
          corrected_value: correction.corrected_value,
          confidence_before: correction.confidence_before,
        });
      }
      
      // Store as training example
      await supabase.from('training_examples').insert({
        document_type: originalDoc.document_type,
        example_data: edited_data || originalDoc.parsed_data,
        notes: `Corrections applied: ${corrections.length} fields`,
      });
    }
    
    // Trigger webhook
    await triggerWebhook(supabase, 'document.approved', {
      document_id,
      corrections_count: corrections?.length || 0,
      auto_approved: false,
    });
    
    return new Response(JSON.stringify({
      success: true,
      document_id,
      corrections_saved: corrections?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Error in approve-document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
