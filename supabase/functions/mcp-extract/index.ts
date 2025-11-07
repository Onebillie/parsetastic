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

CRITICAL EXTRACTION RULES:
1. Extract ALL fields defined in the JSON schema - scan the entire document thoroughly
2. For EVERY field, provide a confidence score (0.0-1.0) based on clarity and certainty
3. If a field is not found or unclear, set value=null and confidence=0.0
4. NEVER guess - low confidence is better than wrong data
5. For money values: always use EUR with exactly 2 decimal places (e.g., 123.45)
6. For dates: always use ISO-8601 format (YYYY-MM-DD)
7. Canonical time bands for electricity: standard, day, night, peak, ev, nightboost, export, other

IRISH UTILITY BILL SPECIFICS:
- MPRN (electricity): 11-digit number, often near meter details
- GPRN (gas): 7-digit number, often labeled "Gas Point Reference"
- Eircode: Irish postcode format (e.g., D02 XY45, A94 K6P2)
- VAT rate: typically 13.5% for energy, 23% for broadband in Ireland
- PSO Levy: electricity-specific charge (look for "PSO" or "Public Service Obligation")
- Carbon Tax: gas-specific charge
- Common suppliers: Electric Ireland, Bord Gáis, SSE Airtricity, Energia, PrePayPower, Flogas, Virgin Media, Eir, Sky
- Reading types: "Actual" (meter read), "Estimated" (calculated), "Customer" (self-submitted)
- Tariffs: 24hr (single rate), Day/Night (dual rate), Smart tariff, PAYG (prepay)

EXTRACTION STRATEGY:
1. Start with customer & supplier details (usually at top of bill)
2. Identify document type from headers, logos, and MPRN/GPRN presence
3. For electricity: look for meter register tables showing Day/Night/Peak readings
4. For gas: find m³ to kWh conversion details and carbon tax line items
5. Scan for all charges: unit charges, standing charges, discounts, levies, taxes
6. Calculate totals from itemized charges if "Total" is unclear
7. Look for payment reference numbers near payment instructions
8. Check for contract end dates, discount expiry dates in fine print

${templateData ? `SUPPLIER-SPECIFIC TEMPLATE (use these patterns as hints for field locations):\n${JSON.stringify(templateData, null, 2)}\n` : ''}

COMPLETE SCHEMA TO EXTRACT:
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
            content: `Extract ALL fields from this ${classification.document_class} (${classification.document_subclass}) from ${classification.supplier_name}.

DOCUMENT CONTENT:

Text blocks (contains headers, labels, values):
${JSON.stringify(blocks, null, 2)}

Tables (structured data like meter readings, charges):
${JSON.stringify(tables, null, 2)}

EXTRACTION REQUIREMENTS:
- Return the complete JSON structure matching the schema exactly
- Populate ALL fields defined in the schema (use null for missing data)
- Include confidence scores (0.0-1.0) for EVERY field with a "_conf" suffix
- Scan all text blocks and tables methodically - don't miss fields
- For registers/arrays, include all rows found (e.g., all meter readings for Day/Night tariffs)
- Confidence scoring guide:
  * 1.0 = clearly labeled and unambiguous (e.g., "MPRN: 10123456789")
  * 0.8-0.9 = very likely correct but not perfectly labeled
  * 0.5-0.7 = reasonable inference from context
  * 0.3-0.4 = weak inference or unclear
  * 0.0-0.2 = not found or pure guess
- Double-check: totals, dates, meter numbers, account numbers, MPRNs/GPRNs, charges`
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
