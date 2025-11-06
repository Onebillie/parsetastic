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

// Helper to check if value exists and calculate confidence
function getFieldConfidence(value: any, baseConfidence: number = 0.9): number {
  if (value === null || value === undefined || value === "" || value === 0) return 0.3;
  if (typeof value === "string" && value === "0000-00-00") return 0.3;
  return baseConfidence;
}

// Calculate comprehensive confidence scores for ALL fields
function calculateFieldConfidence(parsedData: any): any {
  const scores: any = {};
  
  if (!parsedData?.bills) return scores;
  
  const bills = parsedData.bills;
  
  // Customer details confidence
  if (bills.cus_details && bills.cus_details[0]) {
    const cus = bills.cus_details[0];
    scores.customer = {
      customer_name: getFieldConfidence(cus.details?.customer_name),
      address_line_1: getFieldConfidence(cus.details?.address?.line_1),
      address_line_2: getFieldConfidence(cus.details?.address?.line_2, 0.85),
      city: getFieldConfidence(cus.details?.address?.city),
      county: getFieldConfidence(cus.details?.address?.county),
      eircode: getFieldConfidence(cus.details?.address?.eircode, 0.95),
    };
  }
  
  // Electricity confidence - ALL fields
  if (bills.electricity && bills.electricity[0]) {
    const elec = bills.electricity[0];
    scores.electricity = {
      invoice_number: getFieldConfidence(elec.electricity_details?.invoice_number, 0.85),
      account_number: getFieldConfidence(elec.electricity_details?.account_number, 0.9),
      contract_end_date: getFieldConfidence(elec.electricity_details?.contract_end_date, 0.85),
      mprn: getFieldConfidence(elec.electricity_details?.meter_details?.mprn, 0.95),
      dg: getFieldConfidence(elec.electricity_details?.meter_details?.dg, 0.85),
      mcc: getFieldConfidence(elec.electricity_details?.meter_details?.mcc, 0.85),
      profile: getFieldConfidence(elec.electricity_details?.meter_details?.profile, 0.8),
      supplier_name: getFieldConfidence(elec.supplier_details?.name, 0.9),
      tariff_name: getFieldConfidence(elec.supplier_details?.tariff_name, 0.85),
      issue_date: getFieldConfidence(elec.supplier_details?.issue_date, 0.9),
      billing_period: getFieldConfidence(elec.supplier_details?.billing_period, 0.85),
      unit_rate_24h: getFieldConfidence(elec.charges_and_usage?.unit_rates?.["24_hour_rate"], 0.9),
      unit_rate_day: getFieldConfidence(elec.charges_and_usage?.unit_rates?.day, 0.9),
      unit_rate_night: getFieldConfidence(elec.charges_and_usage?.unit_rates?.night, 0.9),
      unit_rate_peak: getFieldConfidence(elec.charges_and_usage?.unit_rates?.peak, 0.85),
      unit_rate_ev: getFieldConfidence(elec.charges_and_usage?.unit_rates?.ev, 0.85),
      unit_rate_nsh: getFieldConfidence(elec.charges_and_usage?.unit_rates?.nsh, 0.85),
      rate_discount: getFieldConfidence(elec.charges_and_usage?.unit_rates?.rate_discount_percentage, 0.8),
      standing_charge: getFieldConfidence(elec.charges_and_usage?.standing_charge, 0.9),
      nsh_standing_charge: getFieldConfidence(elec.charges_and_usage?.nsh_standing_charge, 0.85),
      pso_levy: getFieldConfidence(elec.charges_and_usage?.pso_levy, 0.9),
      total_due: getFieldConfidence(elec.financial_information?.total_due, 0.95),
      amount_due: getFieldConfidence(elec.financial_information?.amount_due, 0.9),
      due_date: getFieldConfidence(elec.financial_information?.due_date, 0.9),
      payment_due_date: getFieldConfidence(elec.financial_information?.payment_due_date, 0.9),
    };
    
    // Meter readings confidence
    if (elec.charges_and_usage?.meter_readings) {
      elec.charges_and_usage.meter_readings.forEach((reading: any, idx: number) => {
        scores.electricity[`reading_${idx}_type`] = getFieldConfidence(reading.reading_type, 0.85);
        scores.electricity[`reading_${idx}_date`] = getFieldConfidence(reading.date, 0.9);
        scores.electricity[`reading_${idx}_nsh`] = getFieldConfidence(reading.nsh_reading, 0.85);
        scores.electricity[`reading_${idx}_day`] = getFieldConfidence(reading.day_reading, 0.85);
        scores.electricity[`reading_${idx}_night`] = getFieldConfidence(reading.night_reading, 0.85);
        scores.electricity[`reading_${idx}_peak`] = getFieldConfidence(reading.peak_reading, 0.85);
      });
    }
    
    // Usage confidence
    if (elec.charges_and_usage?.detailed_kWh_usage) {
      elec.charges_and_usage.detailed_kWh_usage.forEach((usage: any, idx: number) => {
        scores.electricity[`usage_${idx}_start`] = getFieldConfidence(usage.start_read_date, 0.85);
        scores.electricity[`usage_${idx}_end`] = getFieldConfidence(usage.end_read_date, 0.85);
        scores.electricity[`usage_${idx}_day_kwh`] = getFieldConfidence(usage.day_kWh, 0.9);
        scores.electricity[`usage_${idx}_night_kwh`] = getFieldConfidence(usage.night_kWh, 0.9);
        scores.electricity[`usage_${idx}_peak_kwh`] = getFieldConfidence(usage.peak_kWh, 0.85);
        scores.electricity[`usage_${idx}_ev_kwh`] = getFieldConfidence(usage.ev_kWh, 0.85);
      });
    }
  }
  
  // Gas confidence - ALL fields
  if (bills.gas && bills.gas[0]) {
    const gas = bills.gas[0];
    scores.gas = {
      invoice_number: getFieldConfidence(gas.gas_details?.invoice_number, 0.85),
      account_number: getFieldConfidence(gas.gas_details?.account_number, 0.9),
      contract_end_date: getFieldConfidence(gas.gas_details?.contract_end_date, 0.85),
      gprn: getFieldConfidence(gas.gas_details?.meter_details?.gprn, 0.95),
      supplier_name: getFieldConfidence(gas.supplier_details?.name, 0.9),
      tariff_name: getFieldConfidence(gas.supplier_details?.tariff_name, 0.85),
      issue_date: getFieldConfidence(gas.supplier_details?.issue_date, 0.9),
      billing_period: getFieldConfidence(gas.supplier_details?.billing_period, 0.85),
      unit_rate: getFieldConfidence(gas.charges_and_usage?.unit_rates?.rate, 0.9),
      standing_charge: getFieldConfidence(gas.charges_and_usage?.standing_charge, 0.9),
      carbon_tax: getFieldConfidence(gas.charges_and_usage?.carbon_tax, 0.9),
      total_due: getFieldConfidence(gas.financial_information?.total_due, 0.95),
      amount_due: getFieldConfidence(gas.financial_information?.amount_due, 0.9),
      due_date: getFieldConfidence(gas.financial_information?.due_date, 0.9),
      payment_due_date: getFieldConfidence(gas.financial_information?.payment_due_date, 0.9),
    };
    
    // Gas meter readings
    if (gas.charges_and_usage?.meter_readings) {
      gas.charges_and_usage.meter_readings.forEach((reading: any, idx: number) => {
        scores.gas[`reading_${idx}_type`] = getFieldConfidence(reading.meter_type, 0.85);
        scores.gas[`reading_${idx}_date`] = getFieldConfidence(reading.date, 0.9);
        scores.gas[`reading_${idx}_value`] = getFieldConfidence(reading.reading, 0.85);
      });
    }
  }
  
  // Broadband confidence - ALL fields
  if (bills.broadband && bills.broadband[0]) {
    const bb = bills.broadband[0];
    scores.broadband = {
      account_number: getFieldConfidence(bb.broadband_details?.account_number, 0.85),
      broadband_number: getFieldConfidence(bb.service_details?.broadband_number, 0.85),
      supplier_name: getFieldConfidence(bb.supplier_details?.name, 0.9),
      tariff_name: getFieldConfidence(bb.supplier_details?.tariff_name, 0.85),
      issue_date: getFieldConfidence(bb.supplier_details?.issue_date, 0.9),
      billing_period: getFieldConfidence(bb.supplier_details?.billing_period, 0.85),
      total_due: getFieldConfidence(bb.financial_information?.total_due, 0.95),
      amount_due: getFieldConfidence(bb.financial_information?.amount_due, 0.9),
      due_date: getFieldConfidence(bb.financial_information?.due_date, 0.9),
      payment_due_date: getFieldConfidence(bb.financial_information?.payment_due_date, 0.9),
    };
    
    // Phone numbers
    if (bb.broadband_details?.phone_numbers) {
      bb.broadband_details.phone_numbers.forEach((phone: string, idx: number) => {
        scores.broadband[`phone_${idx}`] = getFieldConfidence(phone, 0.85);
      });
    }
    
    // Additional charges
    if (bb.additional_charges) {
      bb.additional_charges.forEach((charge: any, idx: number) => {
        scores.broadband[`charge_${idx}_description`] = getFieldConfidence(charge.description, 0.8);
        scores.broadband[`charge_${idx}_amount`] = getFieldConfidence(charge.amount, 0.85);
      });
    }
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
