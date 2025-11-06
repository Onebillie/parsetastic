import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blocks, tables, metadata } = await req.json();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are a utility bill classification expert for Irish utility companies.

CLASSIFICATION RULES:
1. Document Classes:
   - utility_bill: Bills with charges, usage, and payment details
   - meter_reading_photo: Photos of physical meters
   - smart_meter_csv: CSV files with timestamped usage data
   - letter: Correspondence, notifications, tariff changes
   - other: Unknown or unclassifiable

2. Subclasses for utility_bill:
   - electricity: Look for kWh, MPRN, MCC codes, day/night rates
   - gas: Look for m³, GPRN, conversion factors, Carbon Tax
   - broadband_phone_tv: Look for broadband, phone, TV packages

3. Electricity subtypes:
   - smart: MCC12, peak/off-peak/day/night rates
   - day_night: MCC02, day/night split only
   - single_register: MCC01, 24-hour rate
   - export_credit: Microgen, CEG export, self-billing

4. Supplier Identification:
   Look for: Electric Ireland, SSE Airtricity, Bord Gáis Energy, Energia, Flogas, PrePayPower, 
   Pinergy, Panda Power, Virgin Media, Vodafone, Sky, Eir, Pure Telecom

5. Key Indicators:
   - VAT rates: 9% (electricity domestic), 13.5% (gas), 23% (commercial/telecom)
   - PSO Levy (electricity only)
   - Carbon Tax (gas only)
   - MPRN format: 10 digits starting with 10
   - GPRN format: 7 digits`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Classify this document based on the extracted text blocks and tables.

Text blocks: ${JSON.stringify(blocks)}
Tables: ${JSON.stringify(tables)}
Metadata: ${JSON.stringify(metadata)}

Return JSON with:
{
  "document_class": "utility_bill|meter_reading_photo|smart_meter_csv|letter|other",
  "document_subclass": "electricity|gas|broadband_phone_tv|export_credit|other",
  "electricity_subtype": "smart|day_night|single_register|export_credit|null",
  "supplier_name": "Supplier Name",
  "supplier_brand": "Brand Name or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification decision"
}`
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI classification error:', aiResponse.status, errorText);
      throw new Error(`AI classification failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const classification = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MCP Classify error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
