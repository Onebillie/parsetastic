import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Edit2, Save, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MultiBillReview } from "./MultiBillReview";

interface DocumentReviewProps {
  documentId: string;
  onApprove?: () => void;
}

export const DocumentReview = ({ documentId, onApprove }: DocumentReviewProps) => {
  const [document, setDocument] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (documentId && documentId !== ':documentId') {
      fetchDocument();
    }
  }, [documentId]);

  const fetchDocument = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-document/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      setDocument(data);
      setEditedData(data.parsed_data);
      
      // Auto-expand sections with data
      const sections: Record<string, boolean> = {};
      const ext = data.parsed_data?.extracted || {};
      // Check both old and new format
      if (ext.customer_details?.customer_name || data.parsed_data?.bills?.[0]?.account?.account_holder_name) sections['customer'] = true;
      if (ext.electricity_bill?.mprn || data.parsed_data?.services_details?.electricity) sections['electricity'] = true;
      if (ext.gas_bill?.gprn || data.parsed_data?.services_details?.gas) sections['gas'] = true;
      if (ext.broadband_bill?.account_number || data.parsed_data?.services_details?.broadband) sections['broadband'] = true;
      setExpandedSections(sections);
    } catch (error) {
      console.error('Error fetching document:', error);
      toast({
        title: "Error",
        description: "Failed to load document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldEdit = (fieldPath: string, value: any, confidence: number) => {
    const original = getNestedValue(document.parsed_data, fieldPath);
    
    if (original !== value) {
      setCorrections([
        ...corrections.filter(c => c.field_path !== fieldPath),
        {
          field_path: fieldPath,
          original_value: String(original),
          corrected_value: String(value),
          confidence_before: confidence,
        },
      ]);
    }
    
    setEditedData((prev: any) => setNestedValue(prev, fieldPath, value));
    setEditing(null);
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/approve-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            document_id: documentId,
            edited_data: editedData,
            corrections,
          }),
        }
      );

      if (!response.ok) throw new Error('Approval failed');

      const result = await response.json();
      
      // Show result with OneBill status
      let description = corrections.length > 0 
        ? `${corrections.length} corrections saved for training. `
        : "Document approved successfully. ";
      
      if (result.onebill_sent) {
        description += "✓ Sent to OneBill API";
      } else if (result.onebill_error) {
        description += `⚠️ OneBill API error: ${result.onebill_error}`;
      }

      toast({
        title: result.onebill_sent ? "Document Approved & Sent to OneBill" : "Document Approved",
        description,
        variant: result.onebill_error ? "destructive" : "default",
      });

      // Refresh document to show OneBill response
      await fetchDocument();
      
      onApprove?.();
    } catch (error) {
      console.error('Error approving document:', error);
      toast({
        title: "Error",
        description: "Failed to approve document",
        variant: "destructive",
      });
    }
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  };

  const setNestedValue = (obj: any, path: string, value: any): any => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const newObj = JSON.parse(JSON.stringify(obj));
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, newObj);
    target[lastKey] = value;
    return newObj;
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) return <Badge variant="default" className="bg-green-600">High ({Math.round(confidence * 100)}%)</Badge>;
    if (confidence >= 0.70) return <Badge variant="secondary" className="bg-yellow-600">Med ({Math.round(confidence * 100)}%)</Badge>;
    return <Badge variant="destructive">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const renderField = (label: string, value: any, fieldPath: string, confidence: number = 0.9) => {
    const isEditing = editing === fieldPath;
    const displayValue = value ?? "";
    const hasValue = value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0000-00-00";

    return (
      <div className="space-y-1 py-2 border-b border-border last:border-0">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium flex-1">{label}</Label>
          <div className="flex items-center gap-2">
            {getConfidenceBadge(confidence)}
            {!isEditing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(fieldPath)}
                className="h-7 w-7 p-0"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              defaultValue={displayValue}
              onBlur={(e) => handleFieldEdit(fieldPath, e.target.value, confidence)}
              autoFocus
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                const input = document.querySelector('input:focus') as HTMLInputElement;
                if (input) handleFieldEdit(fieldPath, input.value, confidence);
              }}
              className="h-9"
            >
              <Save className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className={`text-sm ${hasValue ? 'text-foreground' : 'text-muted-foreground italic'}`}>
            {hasValue ? String(displayValue) : "Not extracted"}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, sectionKey: string, content: React.ReactNode, hasData: boolean) => {
    return (
      <Collapsible
        open={expandedSections[sectionKey]}
        onOpenChange={() => toggleSection(sectionKey)}
        className="border border-border rounded-lg mb-3"
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors">
            <h3 className="font-semibold text-base flex items-center gap-2">
              {title}
              {!hasData && <Badge variant="secondary" className="text-xs">No data</Badge>}
            </h3>
            {expandedSections[sectionKey] ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {content}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (!document) {
    return <div className="flex items-center justify-center p-8">Document not found</div>;
  }

  const bills = document.parsed_data?.bills || {};
  const extracted = document.parsed_data?.extracted || {};
  const classification = document.parsed_data?.classification || {};
  const validation = document.parsed_data?.validation || {};
  
  // Support both old and new structure
  const customerDetails = extracted.customer_details || bills.cus_details?.[0]?.details;
  const supplierDetails = extracted.supplier_details || {};
  const electricityBill = extracted.electricity_bill || bills.electricity?.[0];
  const gasBill = extracted.gas_bill || bills.gas?.[0];
  const broadbandBill = extracted.broadband_bill || bills.broadband?.[0];
  const paymentDetails = extracted.payment_details || {};

  // Detect if this is new multi-bill format
  const isMultiBillFormat = document.parsed_data?.bills && Array.isArray(document.parsed_data.bills);

  return (
    <div className="grid grid-cols-3 gap-4 h-screen p-4">
      {/* Document Viewer */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Document</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{document.document_type}</span>
            {getConfidenceBadge(document.classification_confidence)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="bg-muted rounded-lg aspect-[3/4] flex items-center justify-center overflow-hidden">
              {document.frames && document.frames.length > 0 ? (
                <img
                  src={document.frames[pageIndex]?.frame_url || document.file_url}
                  alt={`Page ${pageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : document.file_url?.toLowerCase().endsWith('.pdf') ? (
                <object 
                  data={document.file_url} 
                  type="application/pdf" 
                  className="w-full h-[70vh] rounded"
                >
                  <p className="text-sm text-muted-foreground">PDF preview not available</p>
                </object>
              ) : (
                <img
                  src={document.file_url}
                  alt="Document"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
            {document.frames && document.frames.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => setPageIndex(i => Math.max(0, i - 1))} 
                  disabled={pageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  Page {pageIndex + 1} of {document.frames.length}
                </span>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => setPageIndex(i => Math.min(document.frames.length - 1, i + 1))} 
                  disabled={pageIndex === document.frames.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fields Editor */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Extracted Fields</CardTitle>
          <div className="flex gap-2">
            {corrections.length > 0 && (
              <Badge variant="secondary">{corrections.length} edited</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-200px)]">
            {isMultiBillFormat ? (
              <MultiBillReview
                parsedData={document.parsed_data}
                onEdit={(path, value) => {
                  setEditedData((prev: any) => setNestedValue(prev, path, value));
                  setCorrections([...corrections, { field_path: path, original_value: getNestedValue(document.parsed_data, path), corrected_value: value, confidence_before: 0 }]);
                }}
                editedData={editedData}
                isEditing={(path) => editing === path}
              />
            ) : (
              <div className="space-y-2">
                {/* Old format rendering - keep existing code */}
            <Button onClick={handleApprove} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <CardContent className="space-y-2">
            {/* Customer Details */}
            {renderSection(
              "Customer Details",
              "customer",
              <>
                {renderField("Name", customerDetails?.customer_name, "extracted.customer_details.customer_name", customerDetails?.customer_name_conf || 0.3)}
                {renderField("Account Number", customerDetails?.account_number, "extracted.customer_details.account_number", customerDetails?.account_number_conf || 0.3)}
                {renderField("Address Line 1", customerDetails?.billing_address?.line1, "extracted.customer_details.billing_address.line1", customerDetails?.billing_address?.line1_conf || 0.3)}
                {renderField("Address Line 2", customerDetails?.billing_address?.line2, "extracted.customer_details.billing_address.line2", customerDetails?.billing_address?.line2_conf || 0.3)}
                {renderField("City", customerDetails?.billing_address?.city, "extracted.customer_details.billing_address.city", customerDetails?.billing_address?.city_conf || 0.3)}
                {renderField("County", customerDetails?.billing_address?.county, "extracted.customer_details.billing_address.county", customerDetails?.billing_address?.county_conf || 0.3)}
                {renderField("Eircode", customerDetails?.billing_address?.eircode, "extracted.customer_details.billing_address.eircode", customerDetails?.billing_address?.eircode_conf || 0.3)}
              </>,
              !!customerDetails?.customer_name
            )}

            {/* Electricity */}
            {renderSection(
              "Electricity Bill",
              "electricity",
              <>
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Account & Supplier</h4>
                  {renderField("Invoice Number", electricityBill?.electricity_details?.invoice_number, "bills.electricity.0.electricity_details.invoice_number", 0.3)}
                  {renderField("Account Number", electricityBill?.electricity_details?.account_number, "bills.electricity.0.electricity_details.account_number", 0.3)}
                  {renderField("Contract End Date", electricityBill?.electricity_details?.contract_end_date, "bills.electricity.0.electricity_details.contract_end_date", 0.3)}
                  {renderField("Supplier Name", electricityBill?.supplier_details?.name, "bills.electricity.0.supplier_details.name", 0.3)}
                  {renderField("Tariff Name", electricityBill?.supplier_details?.tariff_name, "bills.electricity.0.supplier_details.tariff_name", 0.3)}
                  {renderField("Issue Date", electricityBill?.supplier_details?.issue_date, "bills.electricity.0.supplier_details.issue_date", 0.3)}
                  {renderField("Billing Period", electricityBill?.supplier_details?.billing_period, "bills.electricity.0.supplier_details.billing_period", 0.3)}
                </div>
                
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Meter Details</h4>
                  {renderField("MPRN", electricityBill?.electricity_details?.meter_details?.mprn, "bills.electricity.0.electricity_details.meter_details.mprn", 0.3)}
                  {renderField("DG", electricityBill?.electricity_details?.meter_details?.dg, "bills.electricity.0.electricity_details.meter_details.dg", 0.3)}
                  {renderField("MCC", electricityBill?.electricity_details?.meter_details?.mcc, "bills.electricity.0.electricity_details.meter_details.mcc", 0.3)}
                  {renderField("Profile", electricityBill?.electricity_details?.meter_details?.profile, "bills.electricity.0.electricity_details.meter_details.profile", 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Unit Rates (c/kWh)</h4>
                  {renderField("24 Hour Rate", electricityBill?.charges_and_usage?.unit_rates?.["24_hour_rate"], "bills.electricity.0.charges_and_usage.unit_rates.24_hour_rate", 0.3)}
                  {renderField("Day Rate", electricityBill?.charges_and_usage?.unit_rates?.day, "bills.electricity.0.charges_and_usage.unit_rates.day", 0.3)}
                  {renderField("Night Rate", electricityBill?.charges_and_usage?.unit_rates?.night, "bills.electricity.0.charges_and_usage.unit_rates.night", 0.3)}
                  {renderField("Peak Rate", electricityBill?.charges_and_usage?.unit_rates?.peak, "bills.electricity.0.charges_and_usage.unit_rates.peak", 0.3)}
                  {renderField("EV Rate", electricityBill?.charges_and_usage?.unit_rates?.ev, "bills.electricity.0.charges_and_usage.unit_rates.ev", 0.3)}
                  {renderField("NSH Rate", electricityBill?.charges_and_usage?.unit_rates?.nsh, "bills.electricity.0.charges_and_usage.unit_rates.nsh", 0.3)}
                  {renderField("Rate Discount %", electricityBill?.charges_and_usage?.unit_rates?.rate_discount_percentage, "bills.electricity.0.charges_and_usage.unit_rates.rate_discount_percentage", 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Charges & Levies</h4>
                  {renderField("Standing Charge", electricityBill?.charges_and_usage?.standing_charge, "bills.electricity.0.charges_and_usage.standing_charge", 0.3)}
                  {renderField("NSH Standing Charge", electricityBill?.charges_and_usage?.nsh_standing_charge, "bills.electricity.0.charges_and_usage.nsh_standing_charge", 0.3)}
                  {renderField("PSO Levy", electricityBill?.charges_and_usage?.pso_levy, "bills.electricity.0.charges_and_usage.pso_levy", 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Financial Summary</h4>
                  {renderField("Total Due (€)", electricityBill?.financial_information?.total_due, "bills.electricity.0.financial_information.total_due", 0.3)}
                  {renderField("Amount Due (€)", electricityBill?.financial_information?.amount_due, "bills.electricity.0.financial_information.amount_due", 0.3)}
                  {renderField("Due Date", electricityBill?.financial_information?.due_date, "bills.electricity.0.financial_information.due_date", 0.3)}
                  {renderField("Payment Due Date", electricityBill?.financial_information?.payment_due_date, "bills.electricity.0.financial_information.payment_due_date", 0.3)}
                </div>

                {/* Meter Readings */}
                {electricityBill?.charges_and_usage?.meter_readings?.map((reading: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Reading {idx + 1}</h4>
                    {renderField("Type", reading.reading_type, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.reading_type`, 0.3)}
                    {renderField("Date", reading.date, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.date`, 0.3)}
                    {renderField("NSH Reading", reading.nsh_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.nsh_reading`, 0.3)}
                    {renderField("Day Reading", reading.day_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.day_reading`, 0.3)}
                    {renderField("Night Reading", reading.night_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.night_reading`, 0.3)}
                    {renderField("Peak Reading", reading.peak_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.peak_reading`, 0.3)}
                  </div>
                ))}

                {/* Usage */}
                {electricityBill?.charges_and_usage?.detailed_kWh_usage?.map((usage: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Usage Period {idx + 1}</h4>
                    {renderField("Start Date", usage.start_read_date, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.start_read_date`, 0.3)}
                    {renderField("End Date", usage.end_read_date, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.end_read_date`, 0.3)}
                    {renderField("Day kWh", usage.day_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.day_kWh`, 0.3)}
                    {renderField("Night kWh", usage.night_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.night_kWh`, 0.3)}
                    {renderField("Peak kWh", usage.peak_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.peak_kWh`, 0.3)}
                    {renderField("EV kWh", usage.ev_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.ev_kWh`, 0.3)}
                  </div>
                ))}
              </>,
              !!electricityBill
            )}

            {/* Gas */}
            {renderSection(
              "Gas Bill",
              "gas",
              <>
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Account & Supplier</h4>
                  {renderField("Invoice Number", supplierDetails?.invoice_number, "extracted.supplier_details.invoice_number", supplierDetails?.invoice_number_conf || 0.3)}
                  {renderField("Account Number", customerDetails?.account_number, "extracted.customer_details.account_number", customerDetails?.account_number_conf || 0.3)}
                  {renderField("Contract End Date", supplierDetails?.billing_period_end, "extracted.supplier_details.billing_period_end", supplierDetails?.billing_period_end_conf || 0.3)}
                  {renderField("GPRN", gasBill?.gprn, "extracted.gas_bill.gprn", gasBill?.gprn_conf || 0.3)}
                  {renderField("Supplier Name", supplierDetails?.supplier_name, "extracted.supplier_details.supplier_name", supplierDetails?.supplier_name_conf || 0.3)}
                  {renderField("Tariff Name", gasBill?.tariff_name, "extracted.gas_bill.tariff_name", gasBill?.tariff_name_conf || 0.3)}
                  {renderField("Issue Date", supplierDetails?.issue_date, "extracted.supplier_details.issue_date", supplierDetails?.issue_date_conf || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Usage & Charges</h4>
                  {renderField("Current Reading", gasBill?.current_reading, "extracted.gas_bill.current_reading", gasBill?.current_reading_conf || 0.3)}
                  {renderField("Previous Reading", gasBill?.previous_reading, "extracted.gas_bill.previous_reading", gasBill?.previous_reading_conf || 0.3)}
                  {renderField("Units Used (m³)", gasBill?.units_used_m3, "extracted.gas_bill.units_used_m3", gasBill?.units_used_m3_conf || 0.3)}
                  {renderField("Units Used (kWh)", gasBill?.units_used_kwh, "extracted.gas_bill.units_used_kwh", gasBill?.units_used_kwh_conf || 0.3)}
                  {renderField("Unit Rate (c/kWh)", gasBill?.unit_rate, "extracted.gas_bill.unit_rate", gasBill?.unit_rate_conf || 0.3)}
                  {renderField("Standing Charge (€)", gasBill?.standing_charge, "extracted.gas_bill.standing_charge", gasBill?.standing_charge_conf || 0.3)}
                  {renderField("Carbon Tax (€)", gasBill?.carbon_tax, "extracted.gas_bill.carbon_tax", gasBill?.carbon_tax_conf || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Financial Summary</h4>
                  {renderField("VAT Amount (€)", gasBill?.vat_amount, "extracted.gas_bill.vat_amount", gasBill?.vat_amount_conf || 0.3)}
                  {renderField("Total Charges (€)", gasBill?.total_charges, "extracted.gas_bill.total_charges", gasBill?.total_charges_conf || 0.3)}
                  {renderField("Total Amount Due (€)", paymentDetails?.total_amount_due, "extracted.payment_details.total_amount_due", paymentDetails?.total_amount_due_conf || 0.3)}
                  {renderField("Due Date", supplierDetails?.due_date, "extracted.supplier_details.due_date", supplierDetails?.due_date_conf || 0.3)}
                </div>
              </>,
              !!(gasBill?.gprn || supplierDetails?.invoice_number)
            )}

            {/* Broadband */}
            {renderSection(
              "Broadband Bill",
              "broadband",
              <>
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Account & Supplier</h4>
                  {renderField("Account Number", broadbandBill?.broadband_details?.account_number, "bills.broadband.0.broadband_details.account_number", 0.3)}
                  {renderField("Broadband Number", broadbandBill?.service_details?.broadband_number, "bills.broadband.0.service_details.broadband_number", 0.3)}
                  {renderField("Supplier Name", broadbandBill?.supplier_details?.name, "bills.broadband.0.supplier_details.name", 0.3)}
                  {renderField("Tariff Name", broadbandBill?.supplier_details?.tariff_name, "bills.broadband.0.supplier_details.tariff_name", 0.3)}
                  {renderField("Issue Date", broadbandBill?.supplier_details?.issue_date, "bills.broadband.0.supplier_details.issue_date", 0.3)}
                  {renderField("Billing Period", broadbandBill?.supplier_details?.billing_period, "bills.broadband.0.supplier_details.billing_period", 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Financial Summary</h4>
                  {renderField("Total Due (€)", broadbandBill?.financial_information?.total_due, "bills.broadband.0.financial_information.total_due", 0.3)}
                  {renderField("Amount Due (€)", broadbandBill?.financial_information?.amount_due, "bills.broadband.0.financial_information.amount_due", 0.3)}
                  {renderField("Due Date", broadbandBill?.financial_information?.due_date, "bills.broadband.0.financial_information.due_date", 0.3)}
                  {renderField("Payment Due Date", broadbandBill?.financial_information?.payment_due_date, "bills.broadband.0.financial_information.payment_due_date", 0.3)}
                </div>

                {/* Phone Numbers */}
                {broadbandBill?.broadband_details?.phone_numbers?.map((phone: string, idx: number) => (
                  <div key={idx}>
                    {renderField(`Phone ${idx + 1}`, phone, `bills.broadband.0.broadband_details.phone_numbers.${idx}`, 0.3)}
                  </div>
                ))}

                {/* Additional Charges */}
                {broadbandBill?.additional_charges?.map((charge: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Additional Charge {idx + 1}</h4>
                    {renderField("Description", charge.description, `bills.broadband.0.additional_charges.${idx}.description`, 0.3)}
                    {renderField("Amount", charge.amount, `bills.broadband.0.additional_charges.${idx}.amount`, 0.3)}
                  </div>
                ))}
              </>,
              !!broadbandBill
            )}

            {corrections.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-900 dark:text-amber-100">
                    {corrections.length} field{corrections.length !== 1 ? 's' : ''} edited
                  </span>
                </div>
              </div>
            )}
            
            {/* OneBill API Status */}
            {document.parsed_data?.onebill_response && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-900 dark:text-green-100 font-medium">
                    Sent to OneBill API
                  </span>
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 font-mono">
                  {document.parsed_data.onebill_sent_at && (
                    <div>Sent: {new Date(document.parsed_data.onebill_sent_at).toLocaleString()}</div>
                  )}
                </div>
              </div>
            )}
            
            {document.parsed_data?.onebill_error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-900 dark:text-red-100 font-medium">
                    OneBill API Error
                  </span>
                </div>
                <div className="text-xs text-red-700 dark:text-red-300">
                  {document.parsed_data.onebill_error}
                </div>
                {document.parsed_data.onebill_attempted_at && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Attempted: {new Date(document.parsed_data.onebill_attempted_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* JSON View */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-base">JSON Output</CardTitle>
        </CardHeader>
        <ScrollArea className="h-[calc(100vh-160px)]">
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(editedData, null, 2)}
            </pre>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
};
