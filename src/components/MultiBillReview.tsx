import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceBadges } from "./ServiceBadges";

interface MultiBillReviewProps {
  parsedData: any;
  onEdit: (path: string, value: any) => void;
  editedData: any;
  isEditing: (path: string) => boolean;
}

export const MultiBillReview = ({ parsedData, onEdit, editedData, isEditing }: MultiBillReviewProps) => {
  if (!parsedData?.bills || !Array.isArray(parsedData.bills)) {
    return <div className="p-4 text-muted-foreground">No bill data found</div>;
  }

  const services = parsedData.services_details || {};
  const bills = parsedData.bills;

  const renderField = (label: string, value: any, path: string) => {
    const displayValue = value === "N/A" || !value ? <span className="text-muted-foreground italic">Not found</span> : String(value);
    const isCurrentlyEditing = isEditing(path);

    return (
      <div className="flex justify-between items-center py-2 border-b border-border/50">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {isCurrentlyEditing ? (
            <input
              type="text"
              className="px-2 py-1 text-sm border rounded"
              defaultValue={value}
              onBlur={(e) => onEdit(path, e.target.value)}
              autoFocus
            />
          ) : (
            <span className="text-sm text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => onEdit(path, value)}>
              {displayValue}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderBill = (bill: any, index: number) => {
    const billType = (bill.bill_type || "Unknown").toLowerCase();
    const supplier = bill.supplier || {};
    const account = bill.account || {};
    const billing = bill.billing || {};
    const totals = bill.totals || {};
    const extractionNotes = bill.extraction_notes || {};

    return (
      <div key={index} className="space-y-4">
        {/* Service Type Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg">
            {bill.bill_type}
          </Badge>
          {supplier.name !== "N/A" && (
            <span className="text-sm text-muted-foreground">from {supplier.name}</span>
          )}
        </div>

        {/* Extraction Quality */}
        {extractionNotes.confidence_overall && extractionNotes.confidence_overall !== "N/A" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Extraction Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={parseFloat(extractionNotes.confidence_overall) > 0.8 ? "default" : "destructive"}>
                  {(parseFloat(extractionNotes.confidence_overall) * 100).toFixed(1)}% confidence
                </Badge>
              </div>
              {extractionNotes.fields_missing && extractionNotes.fields_missing.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Missing fields: {extractionNotes.fields_missing.join(", ")}
                </div>
              )}
              {extractionNotes.anomalies_detected && extractionNotes.anomalies_detected.length > 0 && (
                <div className="mt-2 text-sm text-destructive">
                  Anomalies: {extractionNotes.anomalies_detected.join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {renderField("Account Holder", account.account_holder_name, `bills[${index}].account.account_holder_name`)}
            {renderField("Account Number", account.account_number, `bills[${index}].account.account_number`)}
            {renderField("Account Address", account.account_address, `bills[${index}].account.account_address`)}
            {renderField("Premises Address", account.premises_address, `bills[${index}].account.premises_address`)}
            {account.mprn !== "N/A" && renderField("MPRN", account.mprn, `bills[${index}].account.mprn`)}
            {account.gprn !== "N/A" && renderField("GPRN", account.gprn, `bills[${index}].account.gprn`)}
            {account.dg !== "N/A" && renderField("DG Code", `${account.dg} (${account.dg_profile})`, `bills[${index}].account.dg`)}
            {account.mcc !== "N/A" && renderField("MCC Code", account.mcc, `bills[${index}].account.mcc`)}
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Billing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {renderField("Invoice Number", billing.invoice_number, `bills[${index}].billing.invoice_number`)}
            {renderField("Bill Issue Date", billing.bill_issue_date, `bills[${index}].billing.bill_issue_date`)}
            {renderField("Billing Period", `${billing.billing_period_start} to ${billing.billing_period_end}`, `bills[${index}].billing.billing_period_start`)}
            {renderField("Payment Due Date", billing.payment_due_date, `bills[${index}].billing.payment_due_date`)}
            {renderField("Plan Name", billing.plan_name, `bills[${index}].billing.plan_name`)}
            {renderField("Contract End Date", billing.contract_end_date, `bills[${index}].billing.contract_end_date`)}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {renderField("Total Due", `€${totals.total_due}`, `bills[${index}].totals.total_due`)}
            {renderField("VAT Amount", `€${totals.vat_amount}`, `bills[${index}].totals.vat_amount`)}
            {renderField("VAT Rate", `${totals.vat_rate_percent}%`, `bills[${index}].totals.vat_rate_percent`)}
            {totals.pso_levy_total !== "N/A" && renderField("PSO Levy", `€${totals.pso_levy_total}`, `bills[${index}].totals.pso_levy_total`)}
            {totals.carbon_tax_total !== "N/A" && renderField("Carbon Tax", `€${totals.carbon_tax_total}`, `bills[${index}].totals.carbon_tax_total`)}
            {totals.standing_charges_total !== "N/A" && renderField("Standing Charge", `€${totals.standing_charges_total}`, `bills[${index}].totals.standing_charges_total`)}
          </CardContent>
        </Card>

        {/* Service-Specific Details */}
        {billType.includes("electric") && bill.electricity_specific && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Electricity Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bill.electricity_specific.usage_summary && (
                <div>
                  <div className="font-medium text-sm mb-1">Usage Summary</div>
                  {renderField("Total kWh", bill.electricity_specific.usage_summary.total_kwh, `bills[${index}].electricity_specific.usage_summary.total_kwh`)}
                  {renderField("Total Cost (ex VAT)", `€${bill.electricity_specific.usage_summary.total_cost_ex_vat}`, `bills[${index}].electricity_specific.usage_summary.total_cost_ex_vat`)}
                </div>
              )}
              {bill.electricity_specific.meter_reads && Array.isArray(bill.electricity_specific.meter_reads) && (
                <div>
                  <div className="font-medium text-sm mb-1">Meter Readings</div>
                  {bill.electricity_specific.meter_reads.map((read: any, idx: number) => (
                    <div key={idx} className="pl-4 space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">{read.band}</div>
                      {renderField("Previous", read.previous_read, `bills[${index}].electricity_specific.meter_reads[${idx}].previous_read`)}
                      {renderField("Current", read.current_read, `bills[${index}].electricity_specific.meter_reads[${idx}].current_read`)}
                      {renderField("Units Used", read.units_used, `bills[${index}].electricity_specific.meter_reads[${idx}].units_used`)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {billType.includes("gas") && bill.gas_specific && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Gas Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {bill.gas_specific.meter_reads && (
                <>
                  {renderField("Previous Read", bill.gas_specific.meter_reads.previous_read, `bills[${index}].gas_specific.meter_reads.previous_read`)}
                  {renderField("Current Read", bill.gas_specific.meter_reads.current_read, `bills[${index}].gas_specific.meter_reads.current_read`)}
                  {renderField("Volume (m³)", bill.gas_specific.meter_reads.volume_m3, `bills[${index}].gas_specific.meter_reads.volume_m3`)}
                  {renderField("kWh Used", bill.gas_specific.meter_reads.kwh_used, `bills[${index}].gas_specific.meter_reads.kwh_used`)}
                </>
              )}
              {renderField("Conversion Factor", bill.gas_specific.conversion_factor, `bills[${index}].gas_specific.conversion_factor`)}
              {renderField("Calorific Value", bill.gas_specific.calorific_value, `bills[${index}].gas_specific.calorific_value`)}
              {renderField("Unit Rate per kWh", `€${bill.gas_specific.unit_rate_per_kwh}`, `bills[${index}].gas_specific.unit_rate_per_kwh`)}
            </CardContent>
          </Card>
        )}

        {(billType.includes("broadband") || billType.includes("internet")) && bill.broadband_specific && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Broadband Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {bill.broadband_specific.service_numbers && (
                <>
                  {renderField("Account/Billing Number", bill.broadband_specific.service_numbers.account_or_billing_account, `bills[${index}].broadband_specific.service_numbers.account_or_billing_account`)}
                  {renderField("UAN", bill.broadband_specific.service_numbers.uan, `bills[${index}].broadband_specific.service_numbers.uan`)}
                  {renderField("Landline", bill.broadband_specific.service_numbers.landline_number, `bills[${index}].broadband_specific.service_numbers.landline_number`)}
                </>
              )}
              {bill.broadband_specific.speed && (
                <>
                  {renderField("Download Speed", `${bill.broadband_specific.speed.down_mbps} Mbps`, `bills[${index}].broadband_specific.speed.down_mbps`)}
                  {renderField("Upload Speed", `${bill.broadband_specific.speed.up_mbps} Mbps`, `bills[${index}].broadband_specific.speed.up_mbps`)}
                  {renderField("Technology", bill.broadband_specific.speed.technology, `bills[${index}].broadband_specific.speed.technology`)}
                </>
              )}
              {bill.broadband_specific.plan && (
                <>
                  {renderField("Plan Name", bill.broadband_specific.plan.name, `bills[${index}].broadband_specific.plan.name`)}
                  {renderField("Contract End", bill.broadband_specific.plan.contract_end_date, `bills[${index}].broadband_specific.plan.contract_end_date`)}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Slip */}
        {bill.payment_slip && bill.payment_slip.payment_reference !== "N/A" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {renderField("Payment Reference", bill.payment_slip.payment_reference, `bills[${index}].payment_slip.payment_reference`)}
              {renderField("Barcode", bill.payment_slip.barcode_string, `bills[${index}].payment_slip.barcode_string`)}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Services Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Services Detected</CardTitle>
          <CardDescription>This document contains {bills.length} bill(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceBadges
            electricity={services.electricity === "true" || services.electricity === true}
            gas={services.gas === "true" || services.gas === true}
            broadband={services.broadband === "true" || services.broadband === true}
          />
        </CardContent>
      </Card>

      {/* Bills Tabs */}
      {bills.length === 1 ? (
        renderBill(bills[0], 0)
      ) : (
        <Tabs defaultValue="0" className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${bills.length}, 1fr)` }}>
            {bills.map((bill, idx) => (
              <TabsTrigger key={idx} value={String(idx)}>
                {bill.bill_type || `Bill ${idx + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
          {bills.map((bill, idx) => (
            <TabsContent key={idx} value={String(idx)}>
              {renderBill(bill, idx)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};
