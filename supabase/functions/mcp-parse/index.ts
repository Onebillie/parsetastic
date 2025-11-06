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
- Extract EVERY field, use null if not found`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, file_type } = await req.json();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Direct extraction with GPT-5: ${file_url}`);

    const isPdf = file_type?.includes('pdf');
    
    const messages: any[] = [
      {
        role: 'system',
        content: PARSE_PROMPT
      },
      {
        role: 'user',
        content: [
          isPdf 
            ? { type: 'document', document: { url: file_url } }
            : { type: 'image_url', image_url: { url: file_url, detail: 'high' } },
          { type: 'text', text: 'Extract all fields with confidence scores using extract_utility_bill function.' }
        ]
      }
    ];

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('GPT-5 error:', aiResponse.status, errorText);
      throw new Error(`GPT-5 failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    
    if (!toolCalls?.[0]) throw new Error('No extraction result');
    
    const extractedData = JSON.parse(toolCalls[0].function.arguments);
    
    console.log('GPT-5 extraction complete');
    
    return new Response(JSON.stringify({
      extracted_data: extractedData,
      supplier_name: extractedData.supplier_details?.supplier_name,
      document_class: extractedData.classification?.document_class,
      document_subclass: extractedData.classification?.document_subclass,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Parse error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
