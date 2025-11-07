import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blocks, tables, classification, template_hint } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch supplier template if available
    let templateData = null;
    if (template_hint?.supplier_name) {
      const { data } = await supabase
        .from('supplier_templates')
        .select('template_data')
        .eq('supplier_name', template_hint.supplier_name)
        .eq('document_type', classification.document_class)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      templateData = data?.template_data;
    }

    // Fetch active JSON schema
    const { data: schemaData } = await supabase
      .from('json_schema_versions')
      .select('schema_definition')
      .eq('is_active', true)
      .maybeSingle();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are an expert at extracting structured data from Irish utility bills (electricity, gas, broadband).

CRITICAL: Documents may contain MULTIPLE bills (e.g., dual fuel = electricity + gas). Extract each service separately.

MULTI-BILL DETECTION:
- Scan for service indicators: MPRN (electricity), GPRN (gas), UAN/phone numbers (broadband), MSISDN (phone)
- Set services_details flags: electricity, gas, broadband, phone to true/false
- Create separate bill entries in the bills array for EACH service found
- Each bill gets its own complete extraction with all nested fields

SUPPLIER MAPPING (use EXACT names from these lists):
Electricity suppliers: Bord Gáis Energy, Community Power, Electric Ireland, Energia, Flogas, SSE Airtricity, Waterpower, Ecopower, Yuno energy
Gas suppliers: Bord Gáis Energy, Community Power, Electric Ireland, Energia, Flogas, Pinergy, SSE Airtricity, Waterpower, Ecopower, Yuno energy
Broadband suppliers: Pinergy, Pure Telecom, Eir - Broadband, Vodafone, Digiweb, Three, Cellnet, IFA Telecom, Rural Wifi, Sky Broadband, Virgin Media

DG CODE MAPPING (for electricity):
- If you see "DG1" anywhere → set account.dg: "132", account.dg_mapped_value: "132", account.dg_profile: "DG1"
- If you see "DG2" anywhere → set account.dg: "131", account.dg_mapped_value: "131", account.dg_profile: "DG2"
- Store raw text in electricity.dg_raw

MCC CODE (for electricity): Look for MCC01, MCC02, or MCC12 - store in account.mcc

EXTRACTION RULES:
1. ALL fields default to "N/A" if not found (NOT null, NOT empty string - use "N/A")
2. Money values: numeric strings with 2 decimals (e.g., "123.45")
3. Dates: ISO-8601 (YYYY-MM-DD)
4. Currency: always "EUR"
5. Booleans: "true" or "false" as strings
6. Arrays: populate all items found, empty array [] if none

BARCODES & PAYMENT REFERENCES:
- Look in payment slips, bottom of page, near "Pay by" sections
- Extract IBAN, BIC from bank details or barcodes
- Payment reference is critical - often on tear-off slip

IRISH SPECIFICS:
- MPRN: 11 digits (electricity meter)
- GPRN: 7 digits (gas meter)
- Eircode: format like D02 XY45, A94 K6P2
- VAT: 13.5% energy, 23% broadband
- PSO Levy: electricity only (look for "PSO" or "Public Service Obligation")
- Carbon Tax: gas only
- Reading types: Actual, Estimated, Customer

EXTRACTION STRATEGY:
1. Scan ENTIRE document first to detect all bill types present
2. Set services_details flags based on keywords: MPRN/DG/MCC (electricity), GPRN/carbon_tax (gas), UAN/broadband (broadband)
3. For each service found, create a complete bill object in bills array
4. Extract supplier details from headers/logos - map to exact supplier names
5. Extract account holder name and addresses (billing vs premises)
6. Find meter details: MPRN, GPRN, meter numbers, profile codes
7. Extract billing period, invoice number, due dates
8. Parse meter readings tables (registers for electricity, m³ for gas)
9. Extract all charges: unit rates, standing charges, levies, taxes, discounts
10. Calculate or extract totals - verify they match itemized charges
11. Look for contract end dates, payment methods, barcodes
12. Fill extraction_notes with any missing fields or anomalies detected

${templateData ? `SUPPLIER-SPECIFIC TEMPLATE (use these patterns as hints):\n${JSON.stringify(templateData, null, 2)}\n` : ''}

OUTPUT SCHEMA (return JSON matching this EXACTLY, all fields required):
${JSON.stringify(schemaData?.schema_definition || {}, null, 2)}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Extract ALL fields from this document. Detected as ${classification.document_class} from ${classification.supplier_name}.

CRITICAL INSTRUCTIONS:
- This document may contain MULTIPLE bill types (electricity, gas, broadband, phone)
- Scan the ENTIRE document and create separate bill entries for EACH service found
- Use "N/A" for ALL missing fields (not null, not empty string)
- Map supplier names to EXACT values from the predefined lists
- For electricity: map DG codes correctly (DG1→132, DG2→131)
- Extract MCC codes (MCC01, MCC02, MCC12) for electricity
- Extract barcodes and payment references from payment slips

DOCUMENT CONTENT:

Text blocks (headers, labels, values, everything readable):
${JSON.stringify(blocks, null, 2)}

Tables (structured data - meter readings, charges breakdown):
${JSON.stringify(tables, null, 2)}

RETURN FORMAT:
- Complete JSON matching the schema EXACTLY
- ALL fields present with "N/A" for missing data
- services_details: set true/false for each service type found
- bills array: one complete bill object per service detected
- Each bill includes: supplier, document, account, billing, totals, charges_breakdown, discounts, taxes_and_levies, and service-specific sections
- extraction_notes: list any fields_missing or anomalies_detected`
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI extraction error:', aiResponse.status, errorText);
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extracted = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MCP Extract error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
