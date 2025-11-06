import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete schema for direct extraction with GPT-5
const FULL_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    customer_details: {
      type: "object",
      properties: {
        account_number: { type: ["string", "null"] },
        account_number_conf: { type: "number" },
        customer_name: { type: ["string", "null"] },
        customer_name_conf: { type: "number" },
        billing_address: {
          type: "object",
          properties: {
            line1: { type: ["string", "null"] },
            line1_conf: { type: "number" },
            line2: { type: ["string", "null"] },
            line2_conf: { type: "number" },
            city: { type: ["string", "null"] },
            city_conf: { type: "number" },
            county: { type: ["string", "null"] },
            county_conf: { type: "number" },
            eircode: { type: ["string", "null"] },
            eircode_conf: { type: "number" },
          }
        },
      }
    },
    supplier_details: {
      type: "object",
      properties: {
        supplier_name: { type: ["string", "null"] },
        supplier_name_conf: { type: "number" },
        invoice_number: { type: ["string", "null"] },
        invoice_number_conf: { type: "number" },
        issue_date: { type: ["string", "null"] },
        issue_date_conf: { type: "number" },
        due_date: { type: ["string", "null"] },
        due_date_conf: { type: "number" },
        billing_period_start: { type: ["string", "null"] },
        billing_period_start_conf: { type: "number" },
        billing_period_end: { type: ["string", "null"] },
        billing_period_end_conf: { type: "number" },
      }
    },
    classification: {
      type: "object",
      properties: {
        document_class: { type: "string" },
        document_subclass: { type: "string" },
        confidence: { type: "number" },
      }
    },
    electricity_bill: {
      type: ["object", "null"],
      properties: {
        mprn: { type: ["string", "null"] },
        mprn_conf: { type: "number" },
        mcc_code: { type: ["string", "null"] },
        mcc_code_conf: { type: "number" },
        registers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              time_band: { type: "string" },
              current_reading: { type: ["number", "null"] },
              current_reading_conf: { type: "number" },
              previous_reading: { type: ["number", "null"] },
              previous_reading_conf: { type: "number" },
              units_used: { type: ["number", "null"] },
              units_used_conf: { type: "number" },
              unit_rate: { type: ["number", "null"] },
              unit_rate_conf: { type: "number" },
              unit_charge: { type: ["number", "null"] },
              unit_charge_conf: { type: "number" },
            }
          }
        },
        standing_charge: { type: ["number", "null"] },
        standing_charge_conf: { type: "number" },
        pso_levy: { type: ["number", "null"] },
        pso_levy_conf: { type: "number" },
        vat_rate: { type: ["number", "null"] },
        vat_rate_conf: { type: "number" },
        vat_amount: { type: ["number", "null"] },
        vat_amount_conf: { type: "number" },
        total_charges: { type: ["number", "null"] },
        total_charges_conf: { type: "number" },
      }
    },
    gas_bill: {
      type: ["object", "null"],
      properties: {
        gprn: { type: ["string", "null"] },
        gprn_conf: { type: "number" },
        current_reading: { type: ["number", "null"] },
        current_reading_conf: { type: "number" },
        previous_reading: { type: ["number", "null"] },
        previous_reading_conf: { type: "number" },
        units_used_m3: { type: ["number", "null"] },
        units_used_m3_conf: { type: "number" },
        units_used_kwh: { type: ["number", "null"] },
        units_used_kwh_conf: { type: "number" },
        unit_rate: { type: ["number", "null"] },
        unit_rate_conf: { type: "number" },
        standing_charge: { type: ["number", "null"] },
        standing_charge_conf: { type: "number" },
        carbon_tax: { type: ["number", "null"] },
        carbon_tax_conf: { type: "number" },
        vat_rate: { type: ["number", "null"] },
        vat_rate_conf: { type: "number" },
        vat_amount: { type: ["number", "null"] },
        vat_amount_conf: { type: "number" },
        total_charges: { type: ["number", "null"] },
        total_charges_conf: { type: "number" },
      }
    },
    broadband_bill: {
      type: ["object", "null"],
      properties: {
        monthly_charge: { type: ["number", "null"] },
        monthly_charge_conf: { type: "number" },
        vat_amount: { type: ["number", "null"] },
        vat_amount_conf: { type: "number" },
        total_charges: { type: ["number", "null"] },
        total_charges_conf: { type: "number" },
      }
    },
    payment_details: {
      type: "object",
      properties: {
        total_amount_due: { type: ["number", "null"] },
        total_amount_due_conf: { type: "number" },
        previous_balance: { type: ["number", "null"] },
        previous_balance_conf: { type: "number" },
        current_charges: { type: ["number", "null"] },
        current_charges_conf: { type: "number" },
      }
    },
  },
  required: ["customer_details", "supplier_details", "classification", "payment_details"],
};

const PARSE_PROMPT = `Extract ALL fields from this Irish utility bill with maximum accuracy. Provide confidence scores (0.0-1.0) for EVERY field.

CONFIDENCE RULES:
- 0.95-1.00: Clear text, perfect OCR
- 0.85-0.94: Readable but slightly unclear
- 0.70-0.84: Inferred from context
- 0.00-0.69: Missing or very uncertain (use null)

FIELD RULES:
- Dates: ISO format (YYYY-MM-DD)
- Money: EUR with 2 decimals
- MPRN: 10 digits starting with "10"
- GPRN: 7 digits
- Time bands: standard, day, night, peak, ev, nightboost, export
- Extract EVERY field, use null if not found

CRITICAL: Be meticulous with numbers, dates, and identifiers. These are financial documents.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { file_url, file_type } = await req.json();
    console.log(`[${new Date().toISOString()}] Starting parse:`, { file_type, url_length: file_url?.length });

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isPdf = file_type?.includes('pdf');
    const isImage = file_type?.includes('image') || file_type?.includes('png') || file_type?.includes('jpg') || file_type?.includes('jpeg');
    
    console.log(`Processing as ${isPdf ? 'PDF' : isImage ? 'Image' : 'Unknown'}`);
    
    // Note: GPT-5 API doesn't support direct PDF URL processing
    // PDFs should be converted to images on client-side before upload
    if (isPdf) {
      console.warn('PDF received - GPT-5 requires file_id for PDFs. Client should convert to image first.');
      throw new Error('PDF files must be converted to images before processing. Please convert PDF to high-resolution image on client-side.');
    }
    
    // Prepare message content with high-detail image processing
    const contentPart = { type: 'image_url', image_url: { url: file_url, detail: 'high' } };
    
    const messages: any[] = [
      {
        role: 'system',
        content: PARSE_PROMPT
      },
      {
        role: 'user',
        content: [
          contentPart,
          { type: 'text', text: 'Extract all fields with confidence scores using extract_utility_bill function.' }
        ]
      }
    ];

    console.log('Calling GPT-5 for extraction...');
    const aiStart = Date.now();

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        tools: [{
          type: 'function',
          function: {
            name: 'extract_utility_bill',
            description: 'Extract Irish utility bill data with confidence scores',
            parameters: FULL_EXTRACTION_SCHEMA
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_utility_bill' } },
        max_completion_tokens: 16000
      }),
    });

    const aiDuration = Date.now() - aiStart;
    console.log(`GPT-5 responded in ${aiDuration}ms`);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('GPT-5 error:', aiResponse.status, errorText.slice(0, 500));
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          details: 'Too many requests to AI service'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Payment required. Please add credits to your Lovable AI workspace.',
          details: 'AI service credits exhausted'
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`GPT-5 failed: ${aiResponse.status} - ${errorText.slice(0, 200)}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response structure:', {
      hasChoices: !!aiData.choices,
      choicesLength: aiData.choices?.length,
      hasToolCalls: !!aiData.choices?.[0]?.message?.tool_calls,
      toolCallsCount: aiData.choices?.[0]?.message?.tool_calls?.length
    });

    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    
    if (!toolCalls?.[0]) {
      console.error('No tool calls in response:', JSON.stringify(aiData, null, 2).slice(0, 1000));
      throw new Error('AI did not return structured extraction data');
    }
    
    const extractedData = JSON.parse(toolCalls[0].function.arguments);
    
    console.log('Extraction complete:', {
      supplier: extractedData.supplier_details?.supplier_name || 'Unknown',
      docClass: extractedData.classification?.document_class || 'unknown',
      customer: extractedData.customer_details?.customer_name || 'Unknown',
      totalDue: extractedData.payment_details?.total_amount_due
    });

    const totalDuration = Date.now() - startTime;
    console.log(`Total parse duration: ${totalDuration}ms`);
    
    return new Response(JSON.stringify({
      extracted_data: extractedData,
      supplier_name: extractedData.supplier_details?.supplier_name,
      document_class: extractedData.classification?.document_class,
      document_subclass: extractedData.classification?.document_subclass,
      processing_time_ms: totalDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Parse error after ${totalDuration}ms:`, error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown parsing error',
      details: 'Failed to extract data from document',
      processing_time_ms: totalDuration
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
