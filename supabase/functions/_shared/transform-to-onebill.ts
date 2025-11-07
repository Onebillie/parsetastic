// Shared transformation function for converting multi-bill parsed data to OneBill API format
export function transformToOneBillFormat(parsedData: any, phoneNumber: string): any {
  const result: any = {
    bills: {
      cus_details: [],
      electricity: [],
      gas: [],
      broadband: []
    }
  };

  // Handle new multi-bill format
  if (parsedData?.bills && Array.isArray(parsedData.bills)) {
    // Extract customer details from first bill (should be same across all)
    const firstBill = parsedData.bills[0];
    if (firstBill) {
      const account = firstBill.account || {};
      const billing = firstBill.billing || {};
      
      result.bills.cus_details.push({
        details: {
          customer_name: account.account_holder_name || "N/A",
          address: {
            line_1: account.account_address?.split(',')[0]?.trim() || "N/A",
            line_2: account.account_address?.split(',')[1]?.trim() || "",
            city: account.account_address?.split(',')[2]?.trim() || "",
            county: account.account_address?.split(',')[3]?.trim() || "",
            eircode: account.account_address?.match(/[A-Z]\d{2}\s?[A-Z0-9]{4}/i)?.[0] || ""
          }
        },
        services: {
          gas: parsedData.services_details?.gas === "true" || parsedData.services_details?.gas === true,
          broadband: parsedData.services_details?.broadband === "true" || parsedData.services_details?.broadband === true,
          electricity: parsedData.services_details?.electricity === "true" || parsedData.services_details?.electricity === true
        }
      });
    }

    // Process each bill in the array
    for (const bill of parsedData.bills) {
      const billType = (bill.bill_type || "").toLowerCase();
      const supplier = bill.supplier || {};
      const account = bill.account || {};
      const billing = bill.billing || {};
      const totals = bill.totals || {};
      const elecSpec = bill.electricity_specific || {};
      const gasSpec = bill.gas_specific || {};
      const bbSpec = bill.broadband_specific || {};

      // Electricity bill
      if (billType.includes("electric") || account.mprn !== "N/A") {
        const meterReadings: any[] = [];
        if (elecSpec.meter_reads && Array.isArray(elecSpec.meter_reads)) {
          const reading: any = {
            reading_type: elecSpec.meter_reads[0]?.current_read_type || "Actual",
            date: billing.billing_period_end || "0000-00-00",
            nsh_reading: 0,
            day_reading: 0,
            night_reading: 0,
            peak_reading: 0
          };
          
          elecSpec.meter_reads.forEach((read: any) => {
            const band = (read.band || "").toLowerCase();
            const currentRead = parseFloat(read.current_read) || 0;
            if (band.includes("day")) reading.day_reading = currentRead;
            else if (band.includes("night")) reading.night_reading = currentRead;
            else if (band.includes("peak")) reading.peak_reading = currentRead;
            else reading.nsh_reading = currentRead;
          });
          
          meterReadings.push(reading);
        }

        const detailedUsage: any[] = [];
        if (elecSpec.meter_reads && Array.isArray(elecSpec.meter_reads)) {
          const usage: any = {
            start_read_date: billing.billing_period_start || "0000-00-00",
            end_read_date: billing.billing_period_end || "0000-00-00",
            day_kWh: 0,
            night_kWh: 0,
            peak_kWh: 0,
            ev_kWh: 0
          };
          
          elecSpec.meter_reads.forEach((read: any) => {
            const band = (read.band || "").toLowerCase();
            const unitsUsed = parseFloat(read.units_used) || 0;
            if (band.includes("day")) usage.day_kWh = unitsUsed;
            else if (band.includes("night")) usage.night_kWh = unitsUsed;
            else if (band.includes("peak")) usage.peak_kWh = unitsUsed;
            else if (band.includes("ev")) usage.ev_kWh = unitsUsed;
          });
          
          detailedUsage.push(usage);
        }

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
        
        if (elecSpec.unit_rates && Array.isArray(elecSpec.unit_rates)) {
          elecSpec.unit_rates.forEach((rate: any) => {
            const band = (rate.band || "").toLowerCase();
            const rateValue = parseFloat(rate.rate_per_kwh) || 0;
            if (band.includes("day")) unitRates.day = rateValue;
            else if (band.includes("night")) unitRates.night = rateValue;
            else if (band.includes("peak")) unitRates.peak = rateValue;
            else if (band.includes("ev")) unitRates.ev = rateValue;
            else {
              unitRates["24_hour_rate"] = rateValue;
              unitRates.nsh = rateValue;
            }
          });
        }

        result.bills.electricity.push({
          electricity_details: {
            invoice_number: billing.invoice_number || "",
            account_number: account.account_number || "",
            contract_end_date: billing.contract_end_date || "0000-00-00",
            meter_details: {
              mprn: account.mprn || "",
              dg: account.dg || account.dg_mapped_value || "",
              mcc: account.mcc || "",
              profile: account.profile_class || ""
            }
          },
          supplier_details: {
            name: supplier.name || "",
            tariff_name: billing.plan_name || "",
            issue_date: billing.bill_issue_date || "0000-00-00",
            billing_period: billing.billing_period_start && billing.billing_period_end
              ? `${billing.billing_period_start} to ${billing.billing_period_end}`
              : ""
          },
          charges_and_usage: {
            meter_readings: meterReadings,
            detailed_kWh_usage: detailedUsage,
            unit_rates: unitRates,
            standing_charge: parseFloat(elecSpec.standing_charge_per_day) || 0,
            standing_charge_currency: "euro",
            standing_charge_period: billing.billing_period_start && billing.billing_period_end
              ? `${billing.billing_period_start} to ${billing.billing_period_end}`
              : "",
            nsh_standing_charge: 0,
            nsh_standing_charge_currency: "euro",
            nsh_standing_charge_period: "",
            pso_levy: parseFloat(totals.pso_levy_total) || 0
          },
          financial_information: {
            total_due: parseFloat(totals.total_due) || 0,
            amount_due: parseFloat(totals.total_due) || 0,
            due_date: billing.payment_due_date || "0000-00-00",
            payment_due_date: billing.payment_due_date || "0000-00-00"
          }
        });
      }

      // Gas bill
      if (billType.includes("gas") || account.gprn !== "N/A") {
        const meterReadings: any[] = [];
        if (gasSpec.meter_reads) {
          meterReadings.push({
            meter_type: "m3",
            date: billing.billing_period_end || "0000-00-00",
            reading: parseFloat(gasSpec.meter_reads.current_read) || 0
          });
        }
        
        result.bills.gas.push({
          gas_details: {
            invoice_number: billing.invoice_number || "",
            account_number: account.account_number || "",
            contract_end_date: billing.contract_end_date || "0000-00-00",
            meter_details: {
              gprn: account.gprn || ""
            }
          },
          supplier_details: {
            name: supplier.name || "",
            tariff_name: billing.plan_name || "",
            issue_date: billing.bill_issue_date || "0000-00-00",
            billing_period: billing.billing_period_start && billing.billing_period_end
              ? `${billing.billing_period_start} to ${billing.billing_period_end}`
              : ""
          },
          charges_and_usage: {
            meter_readings: meterReadings,
            unit_rates: {
              rate: parseFloat(gasSpec.unit_rate_per_kwh) || 0,
              rate_currency: "euro"
            },
            standing_charge: parseFloat(gasSpec.standing_charge_per_day) || 0,
            standing_charge_currency: "euro",
            standing_charge_period: billing.billing_period_start && billing.billing_period_end
              ? `${billing.billing_period_start} to ${billing.billing_period_end}`
              : "",
            carbon_tax: parseFloat(totals.carbon_tax_total) || 0
          },
          financial_information: {
            total_due: parseFloat(totals.total_due) || 0,
            amount_due: parseFloat(totals.total_due) || 0,
            due_date: billing.payment_due_date || "0000-00-00",
            payment_due_date: billing.payment_due_date || "0000-00-00"
          }
        });
      }

      // Broadband bill
      if (billType.includes("broadband") || billType.includes("internet") || bbSpec.service_numbers) {
        result.bills.broadband.push({
          broadband_details: {
            account_number: account.account_number || "",
            phone_numbers: bbSpec.service_numbers?.landline_number !== "N/A" 
              ? [bbSpec.service_numbers.landline_number]
              : []
          },
          supplier_details: {
            name: supplier.name || "",
            tariff_name: bbSpec.plan?.name || billing.plan_name || "",
            issue_date: billing.bill_issue_date || "0000-00-00",
            billing_period: billing.billing_period_start && billing.billing_period_end
              ? `${billing.billing_period_start} to ${billing.billing_period_end}`
              : ""
          },
          service_details: {
            broadband_number: bbSpec.service_numbers?.broadband_service_number || "",
            uan_number: bbSpec.service_numbers?.uan || "",
            connection_type: bbSpec.speed?.technology || "",
            home_phone_number: bbSpec.service_numbers?.landline_number || "",
            mobile_phone_numbers: [],
            utility_types: []
          },
          package_information: {
            package_name: bbSpec.plan?.name || "",
            contract_changes: "",
            contract_end_date: bbSpec.plan?.contract_end_date || billing.contract_end_date || "0000-00-00",
            what_s_included: {
              calls: "",
              usage: "",
              bandwidth: bbSpec.speed ? `${bbSpec.speed.down_mbps} Mbps down / ${bbSpec.speed.up_mbps} Mbps up` : "",
              usage_minutes: "",
              int_call_packages: "",
              local_national_calls: ""
            }
          },
          financial_information: {
            previous_bill_amount: parseFloat(totals.previous_bill_amount) || 0,
            total_due: parseFloat(totals.total_due) || 0,
            amount_due: parseFloat(totals.total_due) || 0,
            due_date: billing.payment_due_date || "0000-00-00",
            payment_due_date: billing.payment_due_date || "0000-00-00",
            payment_method: billing.payment_method || "",
            payments_received: "",
            bank_details: {
              iban: bbSpec.bank_transfer?.iban || "",
              bic: bbSpec.bank_transfer?.bic || ""
            }
          }
        });
      }
    }
  } else {
    // Fallback for old format (backwards compatibility)
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

    // Process old format electricity
    if (parsedData?.electricity_bill) {
      const elec = parsedData.electricity_bill;
      const supplier = parsedData?.supplier_details || {};
      
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

    // Process old format gas
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

    // Process old format broadband
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
  }

  return result;
}
