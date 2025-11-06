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
    console.log('Starting validation for:', classification?.document_class || 'unknown');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const validationSchema = {
      type: "object",
      properties: {
        status: { type: "string", enum: ["passed", "failed", "warning"] },
        overall_confidence: { type: "number", minimum: 0, maximum: 1 },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              code: { type: "string" },
              message: { type: "string" },
              severity: { type: "string", enum: ["error", "warning"] },
              current_value: { type: "string" },
              expected: { type: "string" }
            },
            required: ["field", "code", "message", "severity"]
          }
        },
        reconciliation: {
          type: "object",
          properties: {
            arithmetics_ok: { type: "boolean" },
            details: { type: "string" }
          },
          required: ["arithmetics_ok", "details"]
        },
        hitl_required: { type: "boolean" },
        hitl_reasons: { type: "array", items: { type: "string" } }
      },
      required: ["status", "overall_confidence", "issues", "hitl_required"]
    };

    const systemPrompt = `You are a validation expert for Irish utility bills. Perform comprehensive validation checks.

VALIDATION RULES:
1. Arithmetic checks:
   - unit_charges + standing_charges + levies - discounts - credits + VAT = total_amount (±€0.01)
   - For electricity: (current_reading - previous_reading) × multiplier = units_used
   
2. Date validations:
   - bill_due_date >= bill_issue_date
   - billing_period.end >= billing_period.start
   - contract_end_date >= billing_period.end (if present)
   
3. Identifier validations:
   - MPRN: 10 digits, starts with "10"
   - GPRN: 7 digits
   - IBAN: valid format (Ireland IE)
   - VAT rate: 9%, 13.5%, or 23%
   
4. MCC consistency (electricity):
   - MCC01: only "standard" register
   - MCC02: must have "day" and "night"
   - MCC12: can have day/night/peak/ev
   
5. Confidence thresholds:
   - Critical fields (total_amount, due_date, account_number, MPRN/GPRN): >= 0.995
   - Important fields (usage, rates): >= 0.98
   - Overall document: >= 0.99 for auto-approve

Return detailed validation results.`;

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
            content: `Validate this extracted ${classification?.document_class || 'utility bill'} data:\n\n${JSON.stringify(extracted_data, null, 2)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'validate_utility_bill',
              description: 'Return validation results for utility bill data',
              parameters: validationSchema
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'validate_utility_bill' } }
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
      
      // Return fallback validation on AI error
      console.log('Returning fallback validation due to AI error');
      return new Response(JSON.stringify({
        status: 'warning',
        overall_confidence: 0.5,
        issues: [{ 
          field: 'validation', 
          code: 'AI_VALIDATION_FAILED', 
          message: 'AI validation service unavailable',
          severity: 'warning'
        }],
        hitl_required: true,
        hitl_reasons: ['AI validation failed, manual review required']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    console.log('AI response structure:', {
      hasChoices: !!aiData.choices,
      choicesLength: aiData.choices?.length,
      hasToolCalls: !!aiData.choices?.[0]?.message?.tool_calls
    });

    // Extract validation from function call
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.error('No tool calls in AI response:', JSON.stringify(aiData, null, 2).slice(0, 500));
      
      // Return fallback validation
      return new Response(JSON.stringify({
        status: 'warning',
        overall_confidence: 0.7,
        issues: [{ 
          field: 'validation', 
          code: 'INCOMPLETE_VALIDATION', 
          message: 'AI did not return structured validation',
          severity: 'warning'
        }],
        hitl_required: true,
        hitl_reasons: ['Incomplete validation, manual review required']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validation = JSON.parse(toolCalls[0].function.arguments);
    console.log('Validation complete:', {
      status: validation.status,
      confidence: validation.overall_confidence,
      issuesCount: validation.issues?.length || 0,
      hitlRequired: validation.hitl_required
    });

    return new Response(JSON.stringify(validation), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MCP Validate error:', error);
    console.error('Error stack:', error.stack);
    
    // Return fallback validation on critical error
    return new Response(JSON.stringify({
      status: 'failed',
      overall_confidence: 0.0,
      issues: [{ 
        field: 'system', 
        code: 'VALIDATION_ERROR', 
        message: error.message || 'Unknown validation error',
        severity: 'error'
      }],
      hitl_required: true,
      hitl_reasons: ['System error during validation']
    }), {
      status: 200, // Return 200 so ingestion can continue
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
