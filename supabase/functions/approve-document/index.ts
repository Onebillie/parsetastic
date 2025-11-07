import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Transform our parsed data to OneBill API format
function transformToOneBillFormat(parsedData: any, phoneNumber: string): any {
  const result: any = {
    bills: {
      cus_details: [],
      electricity: [],
      gas: [],
      broadband: []
    }
  };

  // Customer details
  const customer = parsedData?.customer_details || {};
  const address = customer.billing_address || {};
  
  result.bills.cus_details.push({
    details: {
      customer_name: customer.customer_name || "",
      address: {
        line_1: address.line1 || "",
        line_2: address.line2 || "",
        city: address.city || "",
        county: address.county || "",
        eircode: address.eircode || ""
      }
    },
    services: {
      gas: !!parsedData?.gas_bill,
      broadband: !!parsedData?.broadband_bill,
      electricity: !!parsedData?.electricity_bill
    }
  });

  // Electricity bill
  if (parsedData?.electricity_bill) {
    const elec = parsedData.electricity_bill;
    const supplier = parsedData?.supplier_details || {};
    
    // Build meter readings
    const meterReadings: any[] = [];
    if (elec.registers && Array.isArray(elec.registers)) {
      const latestDate = supplier.billing_period_end || "0000-00-00";
      const reading: any = {
        reading_type: elec.reading_type || "nsh",
        date: latestDate,
        nsh_reading: 0,
        day_reading: 0,
        night_reading: 0,
        peak_reading: 0
      };
      
      elec.registers.forEach((reg: any) => {
        if (reg.time_band === "day") reading.day_reading = reg.current_reading || 0;
        if (reg.time_band === "night") reading.night_reading = reg.current_reading || 0;
        if (reg.time_band === "peak") reading.peak_reading = reg.current_reading || 0;
        if (reg.time_band === "24hour" || reg.time_band === "nsh") reading.nsh_reading = reg.current_reading || 0;
      });
      
      meterReadings.push(reading);
    }
    
    // Build detailed kWh usage
    const detailedUsage: any[] = [];
    if (elec.registers && Array.isArray(elec.registers)) {
      const usage: any = {
        start_read_date: supplier.billing_period_start || "0000-00-00",
        end_read_date: supplier.billing_period_end || "0000-00-00",
        day_kWh: 0,
        night_kWh: 0,
        peak_kWh: 0,
        ev_kWh: 0
      };
      
      elec.registers.forEach((reg: any) => {
        if (reg.time_band === "day") usage.day_kWh = reg.units_used || 0;
        if (reg.time_band === "night") usage.night_kWh = reg.units_used || 0;
        if (reg.time_band === "peak") usage.peak_kWh = reg.units_used || 0;
      });
      
      detailedUsage.push(usage);
    }
    
    // Build unit rates
    const unitRates: any = {
      "24_hour_rate": 0,
      day: 0,
      night: 0,
      peak: 0,
      ev: 0,
      nsh: 0,
      rate_currency: "euro",
      rate_discount_percentage: 0
    };
    
    if (elec.registers && Array.isArray(elec.registers)) {
      elec.registers.forEach((reg: any) => {
        if (reg.time_band === "day") unitRates.day = reg.unit_rate || 0;
        if (reg.time_band === "night") unitRates.night = reg.unit_rate || 0;
        if (reg.time_band === "peak") unitRates.peak = reg.unit_rate || 0;
        if (reg.time_band === "24hour" || reg.time_band === "nsh") {
          unitRates["24_hour_rate"] = reg.unit_rate || 0;
          unitRates.nsh = reg.unit_rate || 0;
        }
      });
    }
    
    result.bills.electricity.push({
      electricity_details: {
        invoice_number: supplier.invoice_number || "",
        account_number: customer.account_number || "",
        contract_end_date: elec.contract_end_date || "0000-00-00",
        meter_details: {
          mprn: elec.mprn || "",
          dg: elec.dg_code || "",
          mcc: elec.mcc_code || "",
          profile: elec.profile_code || ""
        }
      },
      supplier_details: {
        name: supplier.supplier_name || "",
        tariff_name: elec.tariff_name || "",
        issue_date: supplier.issue_date || "0000-00-00",
        billing_period: supplier.billing_period_start && supplier.billing_period_end 
          ? `${supplier.billing_period_start} to ${supplier.billing_period_end}`
          : ""
      },
      charges_and_usage: {
        meter_readings: meterReadings,
        detailed_kWh_usage: detailedUsage,
        unit_rates: unitRates,
        standing_charge: elec.standing_charge || 0,
        standing_charge_currency: "euro",
        standing_charge_period: supplier.billing_period_start && supplier.billing_period_end
          ? `${supplier.billing_period_start} to ${supplier.billing_period_end}`
          : "",
        nsh_standing_charge: 0,
        nsh_standing_charge_currency: "euro",
        nsh_standing_charge_period: "",
        pso_levy: elec.pso_levy || 0
      },
      financial_information: {
        total_due: elec.total_charges || 0,
        amount_due: elec.total_charges || 0,
        due_date: supplier.due_date || "0000-00-00",
        payment_due_date: supplier.due_date || "0000-00-00"
      }
    });
  }

  // Gas bill
  if (parsedData?.gas_bill) {
    const gas = parsedData.gas_bill;
    const supplier = parsedData?.supplier_details || {};
    
    const meterReadings: any[] = [];
    if (gas.current_reading !== undefined) {
      meterReadings.push({
        meter_type: "m3",
        date: supplier.billing_period_end || "0000-00-00",
        reading: gas.current_reading || 0
      });
    }
    
    result.bills.gas.push({
      gas_details: {
        invoice_number: supplier.invoice_number || "",
        account_number: parsedData?.customer_details?.account_number || "",
        contract_end_date: gas.contract_end_date || "0000-00-00",
        meter_details: {
          gprn: gas.gprn || ""
        }
      },
      supplier_details: {
        name: supplier.supplier_name || "",
        tariff_name: gas.tariff_name || "",
        issue_date: supplier.issue_date || "0000-00-00",
        billing_period: supplier.billing_period_start && supplier.billing_period_end
          ? `${supplier.billing_period_start} to ${supplier.billing_period_end}`
          : ""
      },
      charges_and_usage: {
        meter_readings: meterReadings,
        unit_rates: {
          rate: gas.unit_rate || 0,
          rate_currency: "euro"
        },
        standing_charge: gas.standing_charge || 0,
        standing_charge_currency: "euro",
        standing_charge_period: supplier.billing_period_start && supplier.billing_period_end
          ? `${supplier.billing_period_start} to ${supplier.billing_period_end}`
          : "",
        carbon_tax: gas.carbon_tax || 0
      },
      financial_information: {
        total_due: gas.total_charges || 0,
        amount_due: gas.total_charges || 0,
        due_date: supplier.due_date || "0000-00-00",
        payment_due_date: supplier.due_date || "0000-00-00"
      }
    });
  }

  // Broadband bill
  if (parsedData?.broadband_bill) {
    const bb = parsedData.broadband_bill;
    const supplier = parsedData?.supplier_details || {};
    
    result.bills.broadband.push({
      broadband_details: {
        account_number: parsedData?.customer_details?.account_number || "",
        phone_numbers: bb.phone_number ? [bb.phone_number] : []
      },
      supplier_details: {
        name: supplier.supplier_name || "",
        tariff_name: bb.package_name || "",
        issue_date: supplier.issue_date || "0000-00-00",
        billing_period: supplier.billing_period_start && supplier.billing_period_end
          ? `${supplier.billing_period_start} to ${supplier.billing_period_end}`
          : ""
      },
      service_details: {
        broadband_number: bb.account_number || "",
        uan_number: "",
        connection_type: bb.connection_type || "",
        home_phone_number: bb.phone_number || "",
        mobile_phone_numbers: [],
        utility_types: []
      },
      package_information: {
        package_name: bb.package_name || "",
        contract_changes: "",
        contract_end_date: bb.contract_end_date || "0000-00-00",
        what_s_included: {
          calls: "",
          usage: bb.data_usage ? `${bb.data_usage}` : "",
          bandwidth: "",
          usage_minutes: "",
          int_call_packages: "",
          local_national_calls: ""
        }
      },
      financial_information: {
        previous_bill_amount: 0,
        total_due: bb.total_charges || 0,
        amount_due: bb.total_charges || 0,
        due_date: supplier.due_date || "0000-00-00",
        payment_due_date: supplier.due_date || "0000-00-00",
        payment_method: supplier.payment_method || "",
        payments_received: "",
        bank_details: {
          iban: "",
          bic: ""
        }
      }
    });
  }

  return result;
}

// Call OneBill API
async function callOneBillAPI(transformedData: any, phoneNumber: string): Promise<any> {
  const onebillApiKey = Deno.env.get('ONEBILL_API_KEY');
  
  if (!onebillApiKey) {
    throw new Error('ONEBILL_API_KEY not configured');
  }

  console.log('Calling OneBill API with data:', JSON.stringify(transformedData, null, 2));

  const response = await fetch('https://api.onebill.ie/api/v2/bills', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${onebillApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: phoneNumber,
      ...transformedData
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OneBill API error:', response.status, errorText);
    throw new Error(`OneBill API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('OneBill API response:', result);
  
  return result;
}

// Trigger webhooks
async function triggerWebhook(supabase: any, eventType: string, payload: any) {
  try {
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('event_type', eventType)
      .eq('active', true);
    
    if (!webhooks || webhooks.length === 0) return;
    
    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhook.secret || '',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('Webhook delivery failed:', webhook.url, error);
      }
    }
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, edited_data, corrections } = await req.json();
    
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "Document ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get original document
    const { data: originalDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();
    
    if (!originalDoc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update document with edited data
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        parsed_data: edited_data || originalDoc.parsed_data,
        approved: true,
        approved_at: new Date().toISOString(),
        status: 'approved',
        requires_review: false,
      })
      .eq('id', document_id);
    
    if (updateError) throw updateError;
    
    // Store corrections as training data
    if (corrections && Array.isArray(corrections)) {
      for (const correction of corrections) {
        await supabase.from('document_corrections').insert({
          document_id,
          field_path: correction.field_path,
          original_value: correction.original_value,
          corrected_value: correction.corrected_value,
          confidence_before: correction.confidence_before,
        });
      }
      
      // Store as training example
      await supabase.from('training_examples').insert({
        document_type: originalDoc.document_type,
        example_data: edited_data || originalDoc.parsed_data,
        notes: `Corrections applied: ${corrections.length} fields`,
      });
    }
    
    // Transform and send to OneBill API
    let onebillResult = null;
    let onebillError = null;
    
    try {
      const finalData = edited_data || originalDoc.parsed_data;
      const transformedData = transformToOneBillFormat(finalData, originalDoc.phone_number);
      
      console.log('Sending to OneBill API...');
      onebillResult = await callOneBillAPI(transformedData, originalDoc.phone_number);
      console.log('OneBill API success:', onebillResult);
      
      // Update document with OneBill response
      await supabase
        .from('documents')
        .update({
          parsed_data: {
            ...finalData,
            onebill_response: onebillResult,
            onebill_sent_at: new Date().toISOString()
          }
        })
        .eq('id', document_id);
        
    } catch (error: any) {
      console.error('OneBill API error:', error);
      onebillError = error.message;
      
      // Store error in document
      await supabase
        .from('documents')
        .update({
          parsed_data: {
            ...(edited_data || originalDoc.parsed_data),
            onebill_error: onebillError,
            onebill_attempted_at: new Date().toISOString()
          }
        })
        .eq('id', document_id);
    }
    
    // Trigger webhook
    await triggerWebhook(supabase, 'document.approved', {
      document_id,
      corrections_count: corrections?.length || 0,
      auto_approved: false,
      onebill_success: !!onebillResult,
      onebill_error: onebillError,
    });
    
    return new Response(JSON.stringify({
      success: true,
      document_id,
      corrections_saved: corrections?.length || 0,
      onebill_sent: !!onebillResult,
      onebill_response: onebillResult,
      onebill_error: onebillError,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Error in approve-document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
