import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract key frames from video using ffmpeg
async function extractVideoFrames(videoUrl: string): Promise<string[]> {
  console.log("Extracting key frames from video:", videoUrl);
  // For demo purposes, return single frame. In production, use ffmpeg or video processing service
  return [videoUrl];
}

// Classify document type with confidence
function classifyDocument(parsedData: any): { type: string, confidence: number } {
  const bills = parsedData?.bills || {};
  
  // Check for electricity indicators
  if (bills.electricity && bills.electricity.length > 0) {
    const elec = bills.electricity[0];
    const hasMprn = elec?.electricity_details?.meter_details?.mprn;
    return { type: 'electricity', confidence: hasMprn ? 0.95 : 0.75 };
  }
  
  // Check for gas indicators
  if (bills.gas && bills.gas.length > 0) {
    const gas = bills.gas[0];
    const hasGprn = gas?.gas_details?.meter_details?.gprn;
    return { type: 'gas', confidence: hasGprn ? 0.95 : 0.75 };
  }
  
  // Check for broadband
  if (bills.broadband && bills.broadband.length > 0) {
    return { type: 'broadband', confidence: 0.85 };
  }
  
  // Check customer details
  if (bills.cus_details && bills.cus_details.length > 0) {
    const services = bills.cus_details[0]?.services;
    if (services) {
      if (services.electricity) return { type: 'electricity', confidence: 0.70 };
      if (services.gas) return { type: 'gas', confidence: 0.70 };
      if (services.broadband) return { type: 'broadband', confidence: 0.70 };
    }
  }
  
  return { type: 'other', confidence: 0.50 };
}

// Calculate confidence scores for extracted fields
function calculateFieldConfidence(parsedData: any): any {
  const scores: any = {};
  
  if (!parsedData?.bills) return scores;
  
  const bills = parsedData.bills;
  
  // Electricity confidence
  if (bills.electricity && bills.electricity[0]) {
    const elec = bills.electricity[0];
    scores.electricity = {
      account_number: elec.electricity_details?.account_number ? 0.9 : 0.3,
      mprn: elec.electricity_details?.meter_details?.mprn ? 0.95 : 0.3,
      invoice_number: elec.electricity_details?.invoice_number ? 0.85 : 0.3,
      total_due: elec.financial_information?.total_due ? 0.9 : 0.4,
    };
  }
  
  // Gas confidence
  if (bills.gas && bills.gas[0]) {
    const gas = bills.gas[0];
    scores.gas = {
      account_number: gas.gas_details?.account_number ? 0.9 : 0.3,
      gprn: gas.gas_details?.meter_details?.gprn ? 0.95 : 0.3,
      total_due: gas.financial_information?.total_due ? 0.9 : 0.4,
    };
  }
  
  // Broadband confidence
  if (bills.broadband && bills.broadband[0]) {
    scores.broadband = {
      account_number: bills.broadband[0].broadband_details?.account_number ? 0.85 : 0.3,
    };
  }
  
  return scores;
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
    
    // Handle video files - extract key frames
    let frameUrls: string[] = [];
    if (file.type.startsWith('video/')) {
      frameUrls = await extractVideoFrames(fileUrl);
    }
    
    // Parse document using existing vision parse endpoint
    const parseResponse = await fetch(
      `${supabaseUrl}/functions/v1/onebill-vision-parse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({ phone, file_path: fileName })
      }
    );
    
    const parseResult = await parseResponse.json();
    
    // Classify document
    const classification = classifyDocument(parseResult.parsed_data);
    
    // Calculate confidence scores
    const confidenceScores = calculateFieldConfidence(parseResult.parsed_data);
    
    // Determine if review is needed
    const requiresReview = classification.confidence < 0.85 || !autopilot;
    
    // Create document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        file_type: file.type,
        file_url: fileUrl,
        phone_number: phone,
        status: requiresReview ? 'pending_review' : 'processing',
        document_type: classification.type,
        classification_confidence: classification.confidence,
        parsed_data: parseResult.parsed_data,
        confidence_scores: confidenceScores,
        requires_review: requiresReview,
      })
      .select()
      .single();
    
    if (docError) throw docError;
    
    // Store video frames if any
    if (frameUrls.length > 0) {
      for (let i = 0; i < frameUrls.length; i++) {
        await supabase.from('document_frames').insert({
          document_id: document.id,
          frame_number: i,
          frame_url: frameUrls[i],
        });
      }
    }
    
    // Trigger webhooks
    await triggerWebhook(supabase, 'document.created', {
      document_id: document.id,
      file_name: file.name,
      document_type: classification.type,
      requires_review: requiresReview,
    });
    
    if (requiresReview) {
      await triggerWebhook(supabase, 'document.review_needed', {
        document_id: document.id,
        classification_confidence: classification.confidence,
      });
    }
    
    // If autopilot and high confidence, auto-approve
    if (!requiresReview && autopilot) {
      const { error: approveError } = await supabase
        .from('documents')
        .update({
          status: 'approved',
          approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', document.id);
      
      if (!approveError) {
        await triggerWebhook(supabase, 'document.approved', {
          document_id: document.id,
          auto_approved: true,
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      document_id: document.id,
      requires_review: requiresReview,
      classification: classification,
      confidence_scores: confidenceScores,
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
