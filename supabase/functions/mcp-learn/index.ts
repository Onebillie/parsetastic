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
    const { document_id, corrections, context } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch document details
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (!doc) throw new Error('Document not found');

    const supplier = context.supplier_name || doc.parsed_data?.classification?.supplier_name;
    const docType = context.document_type || doc.document_type;

    // Store corrections as training examples
    for (const correction of corrections) {
      await supabase.from('document_corrections').insert({
        document_id,
        field_path: correction.field_path,
        original_value: correction.original_value,
        corrected_value: correction.corrected_value,
        confidence_before: correction.confidence_before,
      });
    }

    // Fetch or create supplier template
    const { data: existingTemplate } = await supabase
      .from('supplier_templates')
      .select('*')
      .eq('supplier_name', supplier)
      .eq('document_type', docType)
      .maybeSingle();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    // Use AI to generate/update template based on corrections
    const systemPrompt = `You are a template learning expert. Based on human corrections, generate extraction hints and patterns.

Create a supplier template with:
1. Field locations and patterns (regex, keywords, anchors)
2. Common field values and formats
3. Extraction hints for future documents
4. Layout markers and section identifiers

${existingTemplate ? `EXISTING TEMPLATE:\n${JSON.stringify(existingTemplate.template_data, null, 2)}\n` : ''}`;

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
            content: `Update the supplier template for ${supplier} (${docType}) based on these corrections:

Corrections: ${JSON.stringify(corrections, null, 2)}
Context: ${JSON.stringify(context, null, 2)}
Document data: ${JSON.stringify(doc.parsed_data, null, 2)}

Return a JSON template with:
{
  "field_patterns": { "field_name": { "regex": "...", "keywords": [...], "anchors": [...] } },
  "layout_hints": { "sections": [...], "table_positions": [...] },
  "common_values": { "field_name": ["value1", "value2"] },
  "extraction_rules": { "field_name": "rule description" },
  "confidence_adjustments": { "field_name": 0.05 }
}`
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI learning error:', aiResponse.status, errorText);
      throw new Error(`AI learning failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const updatedTemplate = JSON.parse(aiData.choices[0].message.content);

    // Calculate accuracy stats
    const totalCorrections = corrections.length;
    const avgConfidenceBefore = corrections.reduce((sum: number, c: any) => sum + (c.confidence_before || 0), 0) / totalCorrections;
    
    const accuracyStats = {
      total_corrections: totalCorrections,
      avg_confidence_before: avgConfidenceBefore,
      last_updated: new Date().toISOString(),
      correction_frequency: existingTemplate?.accuracy_stats?.correction_frequency || {},
    };

    // Update frequency counters
    corrections.forEach((c: any) => {
      const field = c.field_path;
      accuracyStats.correction_frequency[field] = (accuracyStats.correction_frequency[field] || 0) + 1;
    });

    // Upsert supplier template
    if (existingTemplate) {
      await supabase
        .from('supplier_templates')
        .update({
          template_data: updatedTemplate,
          accuracy_stats: accuracyStats,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existingTemplate.id);
    } else {
      await supabase
        .from('supplier_templates')
        .insert({
          supplier_name: supplier,
          document_type: docType,
          template_data: updatedTemplate,
          accuracy_stats: accuracyStats,
        });
    }

    return new Response(JSON.stringify({
      success: true,
      template_updated: true,
      corrections_processed: totalCorrections,
      template_data: updatedTemplate,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MCP Learn error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
