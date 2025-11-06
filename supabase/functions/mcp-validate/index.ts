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
    const { extracted_data, classification } = await req.json();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You are a validation expert for utility bill data.

VALIDATION RULES:
1. Arithmetic checks:
   - unit_charges + standing_charges + levies - discounts - credits + VAT = total_amount (±€0.01)
   - For each register: (curr_read - prev_read) × multiplier = units_used
   
2. Date validations:
   - bill_due_date >= bill_issue_date
   - billing_period.end >= billing_period.start
   - contract_end_date >= billing_period.end (if present)
   
3. Identifier validations:
   - MPRN: 10 digits, starts with "10"
   - GPRN: 7 digits
   - IBAN: valid checksum (Ireland IE format)
   - VAT rate: 9%, 13.5%, or 23%
   
4. MCC consistency:
   - MCC01: only "standard" register, no day/night/peak
   - MCC02: must have "day" and "night", no peak/ev
   - MCC12: can have day/night/peak/ev
   
5. Confidence thresholds:
   - Critical fields (total_amount, due_date, account_number, MPRN/GPRN): >= 0.995
   - Important fields (usage, rates): >= 0.98
   - Overall document: >= 0.99 for auto-approve

Return JSON:
{
  "status": "passed|failed|warning",
  "overall_confidence": 0.0-1.0,
  "issues": [
    {
      "field": "jsonpath to field",
      "code": "error_code",
      "message": "Human readable message",
      "severity": "error|warning",
      "current_value": "value",
      "expected": "expected value or rule"
    }
  ],
  "reconciliation": {
    "arithmetics_ok": true|false,
    "details": "explanation"
  },
  "hitl_required": true|false,
  "hitl_reasons": ["reason1", "reason2"]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Validate this extracted ${classification.document_class} data:

${JSON.stringify(extracted_data, null, 2)}

Check all arithmetic, date logic, identifier formats, and confidence thresholds. Flag any issues.`
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI validation error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI validation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const validation = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(validation), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MCP Validate error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
