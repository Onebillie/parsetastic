import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Edit2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
      if (data.parsed_data?.bills?.cus_details?.[0]?.details?.customer_name) sections['customer'] = true;
      if (data.parsed_data?.bills?.electricity?.[0]) sections['electricity'] = true;
      if (data.parsed_data?.bills?.gas?.[0]) sections['gas'] = true;
      if (data.parsed_data?.bills?.broadband?.[0]) sections['broadband'] = true;
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

      toast({
        title: "Document Approved",
        description: corrections.length > 0 
          ? `${corrections.length} corrections saved for training`
          : "Document approved successfully",
      });

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
  const cusDetails = bills.cus_details?.[0];
  const electricity = bills.electricity?.[0];
  const gas = bills.gas?.[0];
  const broadband = bills.broadband?.[0];
  const scores = document.confidence_scores || {};

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
          <div className="bg-muted rounded-lg aspect-[3/4] flex items-center justify-center">
            <img
              src={document.file_url}
              alt="Document"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </CardContent>
      </Card>

      {/* Fields Editor */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Extracted Fields</CardTitle>
          <div className="flex gap-2">
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
                {renderField("Name", cusDetails?.details?.customer_name, "bills.cus_details.0.details.customer_name", scores.customer?.customer_name || 0.3)}
                {renderField("Address Line 1", cusDetails?.details?.address?.line_1, "bills.cus_details.0.details.address.line_1", scores.customer?.address_line_1 || 0.3)}
                {renderField("Address Line 2", cusDetails?.details?.address?.line_2, "bills.cus_details.0.details.address.line_2", scores.customer?.address_line_2 || 0.3)}
                {renderField("City", cusDetails?.details?.address?.city, "bills.cus_details.0.details.address.city", scores.customer?.city || 0.3)}
                {renderField("County", cusDetails?.details?.address?.county, "bills.cus_details.0.details.address.county", scores.customer?.county || 0.3)}
                {renderField("Eircode", cusDetails?.details?.address?.eircode, "bills.cus_details.0.details.address.eircode", scores.customer?.eircode || 0.3)}
              </>,
              !!cusDetails?.details?.customer_name
            )}

            {/* Electricity */}
            {renderSection(
              "Electricity Bill",
              "electricity",
              <>
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Account & Supplier</h4>
                  {renderField("Invoice Number", electricity?.electricity_details?.invoice_number, "bills.electricity.0.electricity_details.invoice_number", scores.electricity?.invoice_number || 0.3)}
                  {renderField("Account Number", electricity?.electricity_details?.account_number, "bills.electricity.0.electricity_details.account_number", scores.electricity?.account_number || 0.3)}
                  {renderField("Contract End Date", electricity?.electricity_details?.contract_end_date, "bills.electricity.0.electricity_details.contract_end_date", scores.electricity?.contract_end_date || 0.3)}
                  {renderField("Supplier Name", electricity?.supplier_details?.name, "bills.electricity.0.supplier_details.name", scores.electricity?.supplier_name || 0.3)}
                  {renderField("Tariff Name", electricity?.supplier_details?.tariff_name, "bills.electricity.0.supplier_details.tariff_name", scores.electricity?.tariff_name || 0.3)}
                  {renderField("Issue Date", electricity?.supplier_details?.issue_date, "bills.electricity.0.supplier_details.issue_date", scores.electricity?.issue_date || 0.3)}
                  {renderField("Billing Period", electricity?.supplier_details?.billing_period, "bills.electricity.0.supplier_details.billing_period", scores.electricity?.billing_period || 0.3)}
                </div>
                
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Meter Details</h4>
                  {renderField("MPRN", electricity?.electricity_details?.meter_details?.mprn, "bills.electricity.0.electricity_details.meter_details.mprn", scores.electricity?.mprn || 0.3)}
                  {renderField("DG", electricity?.electricity_details?.meter_details?.dg, "bills.electricity.0.electricity_details.meter_details.dg", scores.electricity?.dg || 0.3)}
                  {renderField("MCC", electricity?.electricity_details?.meter_details?.mcc, "bills.electricity.0.electricity_details.meter_details.mcc", scores.electricity?.mcc || 0.3)}
                  {renderField("Profile", electricity?.electricity_details?.meter_details?.profile, "bills.electricity.0.electricity_details.meter_details.profile", scores.electricity?.profile || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Unit Rates (c/kWh)</h4>
                  {renderField("24 Hour Rate", electricity?.charges_and_usage?.unit_rates?.["24_hour_rate"], "bills.electricity.0.charges_and_usage.unit_rates.24_hour_rate", scores.electricity?.unit_rate_24h || 0.3)}
                  {renderField("Day Rate", electricity?.charges_and_usage?.unit_rates?.day, "bills.electricity.0.charges_and_usage.unit_rates.day", scores.electricity?.unit_rate_day || 0.3)}
                  {renderField("Night Rate", electricity?.charges_and_usage?.unit_rates?.night, "bills.electricity.0.charges_and_usage.unit_rates.night", scores.electricity?.unit_rate_night || 0.3)}
                  {renderField("Peak Rate", electricity?.charges_and_usage?.unit_rates?.peak, "bills.electricity.0.charges_and_usage.unit_rates.peak", scores.electricity?.unit_rate_peak || 0.3)}
                  {renderField("EV Rate", electricity?.charges_and_usage?.unit_rates?.ev, "bills.electricity.0.charges_and_usage.unit_rates.ev", scores.electricity?.unit_rate_ev || 0.3)}
                  {renderField("NSH Rate", electricity?.charges_and_usage?.unit_rates?.nsh, "bills.electricity.0.charges_and_usage.unit_rates.nsh", scores.electricity?.unit_rate_nsh || 0.3)}
                  {renderField("Rate Discount %", electricity?.charges_and_usage?.unit_rates?.rate_discount_percentage, "bills.electricity.0.charges_and_usage.unit_rates.rate_discount_percentage", scores.electricity?.rate_discount || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Charges & Levies</h4>
                  {renderField("Standing Charge", electricity?.charges_and_usage?.standing_charge, "bills.electricity.0.charges_and_usage.standing_charge", scores.electricity?.standing_charge || 0.3)}
                  {renderField("NSH Standing Charge", electricity?.charges_and_usage?.nsh_standing_charge, "bills.electricity.0.charges_and_usage.nsh_standing_charge", scores.electricity?.nsh_standing_charge || 0.3)}
                  {renderField("PSO Levy", electricity?.charges_and_usage?.pso_levy, "bills.electricity.0.charges_and_usage.pso_levy", scores.electricity?.pso_levy || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Financial Summary</h4>
                  {renderField("Total Due (€)", electricity?.financial_information?.total_due, "bills.electricity.0.financial_information.total_due", scores.electricity?.total_due || 0.3)}
                  {renderField("Amount Due (€)", electricity?.financial_information?.amount_due, "bills.electricity.0.financial_information.amount_due", scores.electricity?.amount_due || 0.3)}
                  {renderField("Due Date", electricity?.financial_information?.due_date, "bills.electricity.0.financial_information.due_date", scores.electricity?.due_date || 0.3)}
                  {renderField("Payment Due Date", electricity?.financial_information?.payment_due_date, "bills.electricity.0.financial_information.payment_due_date", scores.electricity?.payment_due_date || 0.3)}
                </div>

                {/* Meter Readings */}
                {electricity?.charges_and_usage?.meter_readings?.map((reading: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Reading {idx + 1}</h4>
                    {renderField("Type", reading.reading_type, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.reading_type`, scores.electricity?.[`reading_${idx}_type`] || 0.3)}
                    {renderField("Date", reading.date, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.date`, scores.electricity?.[`reading_${idx}_date`] || 0.3)}
                    {renderField("NSH Reading", reading.nsh_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.nsh_reading`, scores.electricity?.[`reading_${idx}_nsh`] || 0.3)}
                    {renderField("Day Reading", reading.day_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.day_reading`, scores.electricity?.[`reading_${idx}_day`] || 0.3)}
                    {renderField("Night Reading", reading.night_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.night_reading`, scores.electricity?.[`reading_${idx}_night`] || 0.3)}
                    {renderField("Peak Reading", reading.peak_reading, `bills.electricity.0.charges_and_usage.meter_readings.${idx}.peak_reading`, scores.electricity?.[`reading_${idx}_peak`] || 0.3)}
                  </div>
                ))}

                {/* Usage */}
                {electricity?.charges_and_usage?.detailed_kWh_usage?.map((usage: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Usage Period {idx + 1}</h4>
                    {renderField("Start Date", usage.start_read_date, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.start_read_date`, scores.electricity?.[`usage_${idx}_start`] || 0.3)}
                    {renderField("End Date", usage.end_read_date, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.end_read_date`, scores.electricity?.[`usage_${idx}_end`] || 0.3)}
                    {renderField("Day kWh", usage.day_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.day_kWh`, scores.electricity?.[`usage_${idx}_day_kwh`] || 0.3)}
                    {renderField("Night kWh", usage.night_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.night_kWh`, scores.electricity?.[`usage_${idx}_night_kwh`] || 0.3)}
                    {renderField("Peak kWh", usage.peak_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.peak_kWh`, scores.electricity?.[`usage_${idx}_peak_kwh`] || 0.3)}
                    {renderField("EV kWh", usage.ev_kWh, `bills.electricity.0.charges_and_usage.detailed_kWh_usage.${idx}.ev_kWh`, scores.electricity?.[`usage_${idx}_ev_kwh`] || 0.3)}
                  </div>
                ))}
              </>,
              !!electricity
            )}

            {/* Gas */}
            {renderSection(
              "Gas Bill",
              "gas",
              <>
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Account & Supplier</h4>
                  {renderField("Invoice Number", gas?.gas_details?.invoice_number, "bills.gas.0.gas_details.invoice_number", scores.gas?.invoice_number || 0.3)}
                  {renderField("Account Number", gas?.gas_details?.account_number, "bills.gas.0.gas_details.account_number", scores.gas?.account_number || 0.3)}
                  {renderField("Contract End Date", gas?.gas_details?.contract_end_date, "bills.gas.0.gas_details.contract_end_date", scores.gas?.contract_end_date || 0.3)}
                  {renderField("GPRN", gas?.gas_details?.meter_details?.gprn, "bills.gas.0.gas_details.meter_details.gprn", scores.gas?.gprn || 0.3)}
                  {renderField("Supplier Name", gas?.supplier_details?.name, "bills.gas.0.supplier_details.name", scores.gas?.supplier_name || 0.3)}
                  {renderField("Tariff Name", gas?.supplier_details?.tariff_name, "bills.gas.0.supplier_details.tariff_name", scores.gas?.tariff_name || 0.3)}
                  {renderField("Issue Date", gas?.supplier_details?.issue_date, "bills.gas.0.supplier_details.issue_date", scores.gas?.issue_date || 0.3)}
                  {renderField("Billing Period", gas?.supplier_details?.billing_period, "bills.gas.0.supplier_details.billing_period", scores.gas?.billing_period || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Charges</h4>
                  {renderField("Unit Rate", gas?.charges_and_usage?.unit_rates?.rate, "bills.gas.0.charges_and_usage.unit_rates.rate", scores.gas?.unit_rate || 0.3)}
                  {renderField("Standing Charge", gas?.charges_and_usage?.standing_charge, "bills.gas.0.charges_and_usage.standing_charge", scores.gas?.standing_charge || 0.3)}
                  {renderField("Carbon Tax", gas?.charges_and_usage?.carbon_tax, "bills.gas.0.charges_and_usage.carbon_tax", scores.gas?.carbon_tax || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Financial Summary</h4>
                  {renderField("Total Due (€)", gas?.financial_information?.total_due, "bills.gas.0.financial_information.total_due", scores.gas?.total_due || 0.3)}
                  {renderField("Amount Due (€)", gas?.financial_information?.amount_due, "bills.gas.0.financial_information.amount_due", scores.gas?.amount_due || 0.3)}
                  {renderField("Due Date", gas?.financial_information?.due_date, "bills.gas.0.financial_information.due_date", scores.gas?.due_date || 0.3)}
                  {renderField("Payment Due Date", gas?.financial_information?.payment_due_date, "bills.gas.0.financial_information.payment_due_date", scores.gas?.payment_due_date || 0.3)}
                </div>

                {/* Gas Readings */}
                {gas?.charges_and_usage?.meter_readings?.map((reading: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Reading {idx + 1}</h4>
                    {renderField("Meter Type", reading.meter_type, `bills.gas.0.charges_and_usage.meter_readings.${idx}.meter_type`, scores.gas?.[`reading_${idx}_type`] || 0.3)}
                    {renderField("Date", reading.date, `bills.gas.0.charges_and_usage.meter_readings.${idx}.date`, scores.gas?.[`reading_${idx}_date`] || 0.3)}
                    {renderField("Reading", reading.reading, `bills.gas.0.charges_and_usage.meter_readings.${idx}.reading`, scores.gas?.[`reading_${idx}_value`] || 0.3)}
                  </div>
                ))}
              </>,
              !!gas
            )}

            {/* Broadband */}
            {renderSection(
              "Broadband Bill",
              "broadband",
              <>
                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Account & Supplier</h4>
                  {renderField("Account Number", broadband?.broadband_details?.account_number, "bills.broadband.0.broadband_details.account_number", scores.broadband?.account_number || 0.3)}
                  {renderField("Broadband Number", broadband?.service_details?.broadband_number, "bills.broadband.0.service_details.broadband_number", scores.broadband?.broadband_number || 0.3)}
                  {renderField("Supplier Name", broadband?.supplier_details?.name, "bills.broadband.0.supplier_details.name", scores.broadband?.supplier_name || 0.3)}
                  {renderField("Tariff Name", broadband?.supplier_details?.tariff_name, "bills.broadband.0.supplier_details.tariff_name", scores.broadband?.tariff_name || 0.3)}
                  {renderField("Issue Date", broadband?.supplier_details?.issue_date, "bills.broadband.0.supplier_details.issue_date", scores.broadband?.issue_date || 0.3)}
                  {renderField("Billing Period", broadband?.supplier_details?.billing_period, "bills.broadband.0.supplier_details.billing_period", scores.broadband?.billing_period || 0.3)}
                </div>

                <div className="mb-3">
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Financial Summary</h4>
                  {renderField("Total Due (€)", broadband?.financial_information?.total_due, "bills.broadband.0.financial_information.total_due", scores.broadband?.total_due || 0.3)}
                  {renderField("Amount Due (€)", broadband?.financial_information?.amount_due, "bills.broadband.0.financial_information.amount_due", scores.broadband?.amount_due || 0.3)}
                  {renderField("Due Date", broadband?.financial_information?.due_date, "bills.broadband.0.financial_information.due_date", scores.broadband?.due_date || 0.3)}
                  {renderField("Payment Due Date", broadband?.financial_information?.payment_due_date, "bills.broadband.0.financial_information.payment_due_date", scores.broadband?.payment_due_date || 0.3)}
                </div>

                {/* Phone Numbers */}
                {broadband?.broadband_details?.phone_numbers?.map((phone: string, idx: number) => (
                  <div key={idx}>
                    {renderField(`Phone ${idx + 1}`, phone, `bills.broadband.0.broadband_details.phone_numbers.${idx}`, scores.broadband?.[`phone_${idx}`] || 0.3)}
                  </div>
                ))}

                {/* Additional Charges */}
                {broadband?.additional_charges?.map((charge: any, idx: number) => (
                  <div key={idx} className="mb-3 p-2 bg-accent/20 rounded">
                    <h4 className="font-medium text-sm mb-2">Additional Charge {idx + 1}</h4>
                    {renderField("Description", charge.description, `bills.broadband.0.additional_charges.${idx}.description`, scores.broadband?.[`charge_${idx}_description`] || 0.3)}
                    {renderField("Amount", charge.amount, `bills.broadband.0.additional_charges.${idx}.amount`, scores.broadband?.[`charge_${idx}_amount`] || 0.3)}
                  </div>
                ))}
              </>,
              !!broadband
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
