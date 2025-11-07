import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Function to fetch active schema from database
const getActiveSchema = async (supabaseClient: any) => {
  const { data, error } = await supabaseClient
    .from('json_schema_versions')
    .select('schema_definition')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.log('Using default schema (no active schema found in DB)');
    return getDefaultSchema();
  }

  console.log('Loaded active schema from database');
  return data.schema_definition;
};

const getDefaultSchema = () => ({
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
        vat_number: { type: ["string", "null"] },
        vat_number_conf: { type: "number" },
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
        payment_method: { type: ["string", "null"] },
        payment_method_conf: { type: "number" },
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
        dg_code: { type: ["string", "null"] },
        dg_code_conf: { type: "number" },
        profile_code: { type: ["string", "null"] },
        profile_code_conf: { type: "number" },
        tariff_name: { type: ["string", "null"] },
        tariff_name_conf: { type: "number" },
        contract_end_date: { type: ["string", "null"] },
        contract_end_date_conf: { type: "number" },
        meter_number: { type: ["string", "null"] },
        meter_number_conf: { type: "number" },
        multiplier: { type: ["number", "null"] },
        multiplier_conf: { type: "number" },
        reading_type: { type: ["string", "null"] },
        reading_type_conf: { type: "number" },
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
        discount_description: { type: ["string", "null"] },
        discount_description_conf: { type: "number" },
        discount_amount: { type: ["number", "null"] },
        discount_amount_conf: { type: "number" },
        discount_end_date: { type: ["string", "null"] },
        discount_end_date_conf: { type: "number" },
        microgen_credit: { type: ["number", "null"] },
        microgen_credit_conf: { type: "number" },
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
        phone_number: { type: ["string", "null"] },
        phone_number_conf: { type: "number" },
        account_holder_name: { type: ["string", "null"] },
        account_holder_name_conf: { type: "number" },
        service_description: { type: ["string", "null"] },
        service_description_conf: { type: "number" },
        monthly_charge: { type: ["number", "null"] },
        monthly_charge_conf: { type: "number" },
        vat_rate: { type: ["number", "null"] },
        vat_rate_conf: { type: "number" },
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
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


const PARSE_PROMPT = `Extract ALL fields from this Irish utility bill with maximum accuracy. Provide confidence scores (0.0-1.0) for EVERY field.

CONFIDENCE RULES:
- 0.95-1.00: Clear text, perfect OCR
- 0.85-0.94: Readable but slightly unclear
- 0.70-0.84: Inferred from context
- 0.00-0.69: Missing or very uncertain (use null)

FIELD RULES:
- Dates: ISO format (YYYY-MM-DD). Examples: "29 Jul 26" → "2026-07-29", "31 March 2026" → "2026-03-31"
- Money: EUR with 2 decimals. Credits shown as negative (e.g., -56.06)
- MPRN: 11 digits with spaces, extract as digits only (e.g., "10 009 543 173" → "10009543173")
- GPRN: 7 digits
- Time bands: standard, day, night, peak, ev, nightboost, export
- Meter numbers: Include any suffix (e.g., "_6608", "6858")
- DG codes: Extract from "DG1", "DG2", etc.
- MCC codes: Extract from patterns like "MCC12"
- Profile codes: Extract numeric profile (e.g., "MCC12 1" → "1", "MCC12 27" → "27")
- VAT numbers: Include full format (e.g., "IE 8F 52100V", "IE 3234061GH")
- Address: Parse multi-line addresses into line1, line2, city, county, eircode. Example:
  "MR FASI ULLAH / 15 DROMIN COURT / NENAGH / CO. TIPPERARY / E45 NW99"
  → line1: "15 DROMIN COURT", line2: null, city: "NENAGH", county: "CO. TIPPERARY", eircode: "E45 NW99"
- Tariff names: e.g., "EV Smart", "Home Electric + Saver", "1Yr Fixed Elec V4 Smart"
- Discounts: Extract percentage and description (e.g., "Your Savings (30%)" → "Your Savings", amount: -71.75, end_date if available)
- Microgen credit: Solar export credit shown on bill (negative value)
- Payment method: "Direct Debit", "Cash", "Card", etc.
- Reading type: "A" (Actual), "E" (Estimated), "C" (Customer)
- Extract EVERY field, use null if not found

CRITICAL: Be meticulous with numbers, dates, and identifiers. These are financial documents.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { file_url, file_type } = await req.json();
    const pageUrlsParam = req.headers.get('x-page-urls');
    
    console.log(`[${new Date().toISOString()}] Starting parse:`, { 
      file_type, 
      url_length: file_url?.length,
      has_page_urls: !!pageUrlsParam
    });

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch the active schema from database
    const FULL_EXTRACTION_SCHEMA = await getActiveSchema(supabase);

    let imageUrls: string[] = [];
    
    if (pageUrlsParam) {
      // Multiple pages uploaded
      imageUrls = JSON.parse(pageUrlsParam);
      console.log(`Processing ${imageUrls.length} pages together as one document`);
    } else {
      // Single image
      const isPdf = file_type?.includes('pdf');
      
      if (isPdf) {
        console.warn('PDF received - should be converted to images on client-side.');
        throw new Error('PDF files must be converted to images before processing.');
      }
      
      imageUrls = [file_url];
    }
    
    // Build content array with ALL images
    const contentParts: any[] = imageUrls.map(url => ({
      type: 'image_url',
      image_url: { url, detail: 'high' }
    }));
    
    // Add text instruction at the end
    contentParts.push({
      type: 'text',
      text: `Extract all fields from this ${imageUrls.length}-page document with confidence scores using extract_utility_bill function. Treat all pages as a single document.`
    });
    
    const messages: any[] = [
      {
        role: 'system',
        content: PARSE_PROMPT
      },
      {
        role: 'user',
        content: contentParts
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
