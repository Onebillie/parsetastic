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

    const systemPrompt = `You are an expert at extracting structured data from Irish utility bills.

CRITICAL RULES:
1. Extract ALL fields defined in the JSON schema
2. For EVERY field, provide a confidence score (0.0-1.0)
3. If a field is not found or unclear, set value=null and confidence=0.0
4. NEVER guess - low confidence is better than wrong data
5. For money values: use EUR with 2 decimal places
6. For dates: use ISO-8601 (YYYY-MM-DD)
7. Canonical time bands: standard, day, night, peak, ev, nightboost, export, other

${templateData ? `SUPPLIER TEMPLATE (use as extraction hints):\n${JSON.stringify(templateData, null, 2)}\n` : ''}

SCHEMA TO EXTRACT:
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
            content: `Extract all fields from this ${classification.document_class} (${classification.document_subclass}) from ${classification.supplier_name}.

Text blocks: ${JSON.stringify(blocks)}
Tables: ${JSON.stringify(tables)}

Return the complete JSON structure with ALL fields populated (use null for missing) and include confidence scores for each field.`
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
