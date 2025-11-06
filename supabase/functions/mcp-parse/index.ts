import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OneBill-style structured parsing prompt for Irish utility bills
const ONEBILL_PARSE_PROMPT = `Parse a single Irish customer bill from the page images provided. Bills may bundle utilities (electricity and gas). Detect which utilities are present and disaggregate them. Return ONE JSON object only. No prose or notes.

Rules:
- Dates: "YYYY-MM-DD"; unknown → "0000-00-00".
- Numbers (rates/amounts/readings): numeric; unknown → 0.
- Booleans: true/false (not strings).
- Currencies: "cent" or "euro".
- Standing charge period: "daily" or "annual".
- Always include all top-level sections; if a utility is not present, return its array as [].
- Detect utilities using strong signals (MPRN/MCC/DG ⇒ electricity; GPRN/carbon tax ⇒ gas; broadband cues for broadband).
- Do not rename, add, or remove keys.`;

// Convert structured OneBill data to blocks/tables format for MCP pipeline
function convertToBlocksFormat(structuredData: any): { blocks: any[], tables: any[], metadata: any } {
  const blocks: any[] = [];
  const tables: any[] = [];
  let blockId = 0;

  function addBlock(label: string, text: string, page = 1) {
    if (text && text !== "" && text !== "0" && text !== "0000-00-00") {
      blocks.push({
        page,
        label,
        text: String(text),
        bbox: null
      });
      blockId++;
    }
  }

  const bills = structuredData?.bills || {};

  // Customer details
  if (bills.cus_details?.[0]) {
    const cus = bills.cus_details[0];
    addBlock("customer_name", cus.details?.customer_name);
    addBlock("address_line_1", cus.details?.address?.line_1);
    addBlock("address_line_2", cus.details?.address?.line_2);
    addBlock("city", cus.details?.address?.city);
    addBlock("county", cus.details?.address?.county);
    addBlock("eircode", cus.details?.address?.eircode);
  }

  // Electricity
  if (bills.electricity?.[0]) {
    const elec = bills.electricity[0];
    addBlock("electricity_supplier", elec.supplier_details?.name);
    addBlock("electricity_invoice", elec.electricity_details?.invoice_number);
    addBlock("electricity_account", elec.electricity_details?.account_number);
    addBlock("mprn", elec.electricity_details?.meter_details?.mprn);
    addBlock("mcc", elec.electricity_details?.meter_details?.mcc);
    addBlock("electricity_total_due", elec.financial_information?.total_due);
    addBlock("electricity_due_date", elec.financial_information?.due_date);

    // Meter readings as table
    if (elec.charges_and_usage?.meter_readings?.length > 0) {
      const rows = [["Reading Type", "Date", "Day", "Night", "Peak"]];
      elec.charges_and_usage.meter_readings.forEach((r: any) => {
        rows.push([
          r.reading_type || "",
          r.date || "",
          String(r.day_reading || ""),
          String(r.night_reading || ""),
          String(r.peak_reading || "")
        ]);
      });
      tables.push({ page: 1, rows, caption: "Electricity Meter Readings" });
    }

    // Usage as table
    if (elec.charges_and_usage?.detailed_kWh_usage?.length > 0) {
      const rows = [["Start Date", "End Date", "Day kWh", "Night kWh", "Peak kWh"]];
      elec.charges_and_usage.detailed_kWh_usage.forEach((u: any) => {
        rows.push([
          u.start_read_date || "",
          u.end_read_date || "",
          String(u.day_kWh || ""),
          String(u.night_kWh || ""),
          String(u.peak_kWh || "")
        ]);
      });
      tables.push({ page: 1, rows, caption: "Electricity Usage" });
    }
  }

  // Gas
  if (bills.gas?.[0]) {
    const gas = bills.gas[0];
    addBlock("gas_supplier", gas.supplier_details?.name);
    addBlock("gas_invoice", gas.gas_details?.invoice_number);
    addBlock("gas_account", gas.gas_details?.account_number);
    addBlock("gprn", gas.gas_details?.meter_details?.gprn);
    addBlock("gas_total_due", gas.financial_information?.total_due);
    addBlock("gas_due_date", gas.financial_information?.due_date);

    // Gas readings as table
    if (gas.charges_and_usage?.meter_readings?.length > 0) {
      const rows = [["Meter Type", "Date", "Reading"]];
      gas.charges_and_usage.meter_readings.forEach((r: any) => {
        rows.push([
          r.meter_type || "",
          r.date || "",
          String(r.reading || "")
        ]);
      });
      tables.push({ page: 1, rows, caption: "Gas Meter Readings" });
    }
  }

  // Broadband
  if (bills.broadband?.[0]) {
    const bb = bills.broadband[0];
    addBlock("broadband_supplier", bb.supplier_details?.name);
    addBlock("broadband_account", bb.broadband_details?.account_number);
    addBlock("broadband_total_due", bb.financial_information?.total_due);
    addBlock("broadband_due_date", bb.financial_information?.due_date);
  }

  const metadata = {
    page_count: 1,
    has_tables: tables.length > 0,
    has_images: false,
    quality_score: 0.95,
    structured_data: structuredData // Keep original structured data
  };

  return { blocks, tables, metadata };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, file_type } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    // Detect file type
    const isPdf = file_url.toLowerCase().endsWith('.pdf');
    const isVideo = file_type?.startsWith('video/');

    console.log(`Parsing ${isPdf ? 'PDF' : isVideo ? 'video' : 'image'}: ${file_url}`);

    // For videos, we'll just extract first frame for now (stub)
    let imageUrls = [file_url];
    if (isVideo) {
      console.log("Video detected - using first frame (stub implementation)");
      // TODO: Implement actual video frame extraction
    }

    // Build content for AI vision model
    const content: any[] = [{ type: "text", text: ONEBILL_PARSE_PROMPT }];
    
    if (isPdf) {
      content.push({ type: "document", document_url: { url: file_url } });
    } else {
      for (const imgUrl of imageUrls.slice(0, 3)) {
        content.push({ type: "image_url", image_url: { url: imgUrl } });
      }
    }

    // Call Lovable AI with OneBill-style structured tool calling
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content }],
        temperature: 0,
        tools: [{
          type: "function",
          function: {
            name: "parse_irish_bill",
            description: "Parse Irish utility bill and return structured data",
            parameters: {
              type: "object",
              properties: {
                bills: {
                  type: "object",
                  properties: {
                    cus_details: { 
                      type: "array", 
                      items: { 
                        type: "object",
                        properties: {
                          details: {
                            type: "object",
                            properties: {
                              customer_name: { type: "string" },
                              address: {
                                type: "object",
                                properties: {
                                  line_1: { type: "string" },
                                  line_2: { type: "string" },
                                  city: { type: "string" },
                                  county: { type: "string" },
                                  eircode: { type: "string" }
                                }
                              }
                            }
                          },
                          services: {
                            type: "object",
                            properties: {
                              gas: { type: "boolean" },
                              broadband: { type: "boolean" },
                              electricity: { type: "boolean" }
                            }
                          }
                        }
                      }
                    },
                    electricity: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          electricity_details: {
                            type: "object",
                            properties: {
                              invoice_number: { type: "string" },
                              account_number: { type: "string" },
                              contract_end_date: { type: "string" },
                              meter_details: {
                                type: "object",
                                properties: {
                                  mprn: { type: "string" },
                                  dg: { type: "string" },
                                  mcc: { type: "string" },
                                  profile: { type: "string" }
                                }
                              }
                            }
                          },
                          supplier_details: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              tariff_name: { type: "string" },
                              issue_date: { type: "string" },
                              billing_period: { type: "string" }
                            }
                          },
                          charges_and_usage: {
                            type: "object",
                            properties: {
                              meter_readings: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    reading_type: { type: "string" },
                                    date: { type: "string" },
                                    nsh_reading: { type: "number" },
                                    day_reading: { type: "number" },
                                    night_reading: { type: "number" },
                                    peak_reading: { type: "number" }
                                  }
                                }
                              },
                              detailed_kWh_usage: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    start_read_date: { type: "string" },
                                    end_read_date: { type: "string" },
                                    day_kWh: { type: "number" },
                                    night_kWh: { type: "number" },
                                    peak_kWh: { type: "number" },
                                    ev_kWh: { type: "number" }
                                  }
                                }
                              },
                              unit_rates: {
                                type: "object",
                                properties: {
                                  "24_hour_rate": { type: "number" },
                                  day: { type: "number" },
                                  night: { type: "number" },
                                  peak: { type: "number" },
                                  ev: { type: "number" },
                                  nsh: { type: "number" },
                                  rate_currency: { type: "string", enum: ["cent", "euro"] },
                                  rate_discount_percentage: { type: "number" }
                                }
                              },
                              standing_charge: { type: "number" },
                              standing_charge_currency: { type: "string", enum: ["cent", "euro"] },
                              standing_charge_period: { type: "string", enum: ["daily", "annual"] },
                              nsh_standing_charge: { type: "number" },
                              nsh_standing_charge_currency: { type: "string", enum: ["cent", "euro"] },
                              nsh_standing_charge_period: { type: "string", enum: ["daily", "annual"] },
                              pso_levy: { type: "number" }
                            }
                          },
                          financial_information: {
                            type: "object",
                            properties: {
                              total_due: { type: "number" },
                              amount_due: { type: "number" },
                              due_date: { type: "string" },
                              payment_due_date: { type: "string" }
                            }
                          }
                        }
                      }
                    },
                    gas: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          gas_details: {
                            type: "object",
                            properties: {
                              invoice_number: { type: "string" },
                              account_number: { type: "string" },
                              contract_end_date: { type: "string" },
                              meter_details: {
                                type: "object",
                                properties: {
                                  gprn: { type: "string" }
                                }
                              }
                            }
                          },
                          supplier_details: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              tariff_name: { type: "string" },
                              issue_date: { type: "string" },
                              billing_period: { type: "string" }
                            }
                          },
                          charges_and_usage: {
                            type: "object",
                            properties: {
                              meter_readings: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    meter_type: { type: "string" },
                                    date: { type: "string" },
                                    reading: { type: "number" }
                                  }
                                }
                              },
                              unit_rates: {
                                type: "object",
                                properties: {
                                  rate: { type: "number" },
                                  rate_currency: { type: "string", enum: ["cent", "euro"] }
                                }
                              },
                              standing_charge: { type: "number" },
                              standing_charge_currency: { type: "string", enum: ["cent", "euro"] },
                              standing_charge_period: { type: "string", enum: ["daily", "annual"] },
                              carbon_tax: { type: "number" }
                            }
                          },
                          financial_information: {
                            type: "object",
                            properties: {
                              total_due: { type: "number" },
                              amount_due: { type: "number" },
                              due_date: { type: "string" },
                              payment_due_date: { type: "string" }
                            }
                          }
                        }
                      }
                    },
                    broadband: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          broadband_details: {
                            type: "object",
                            properties: {
                              account_number: { type: "string" },
                              phone_numbers: {
                                type: "array",
                                items: { type: "string" }
                              }
                            }
                          },
                          supplier_details: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              tariff_name: { type: "string" },
                              issue_date: { type: "string" },
                              billing_period: { type: "string" }
                            }
                          },
                          service_details: {
                            type: "object",
                            properties: {
                              broadband_number: { type: "string" }
                            }
                          },
                          additional_charges: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                description: { type: "string" },
                                amount: { type: "number" }
                              }
                            }
                          },
                          financial_information: {
                            type: "object",
                            properties: {
                              total_due: { type: "number" },
                              amount_due: { type: "number" },
                              due_date: { type: "string" },
                              payment_due_date: { type: "string" },
                              payment_method: { type: "string" },
                              payments_received: { type: "string" },
                              bank_details: {
                                type: "object",
                                properties: {
                                  iban: { type: "string" },
                                  bic: { type: "string" }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  required: ["cus_details", "electricity", "gas", "broadband"]
                }
              },
              required: ["bills"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "parse_irish_bill" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI parsing error:', aiResponse.status, errorText);
      throw new Error(`AI parsing failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const structuredData = JSON.parse(toolCall.function.arguments);
    
    // Validate structured data
    if (!structuredData.bills) {
      structuredData.bills = { cus_details: [], electricity: [], gas: [], broadband: [] };
    }

    console.log('Structured parsing complete');

    // Convert to blocks/tables format for MCP pipeline
    const { blocks, tables, metadata } = convertToBlocksFormat(structuredData);

    console.log(`Converted to ${blocks.length} blocks, ${tables.length} tables`);

    return new Response(JSON.stringify({
      blocks,
      tables,
      ocr_boxes: [],
      images: [],
      metadata,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MCP Parse error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
