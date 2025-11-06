import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertCircle, Edit2, Save } from "lucide-react";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchDocument();
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
        ...corrections,
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
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[lastKey] = value;
    return { ...obj };
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) return <Badge className="bg-green-500">High</Badge>;
    if (confidence >= 0.70) return <Badge className="bg-yellow-500">Medium</Badge>;
    return <Badge className="bg-red-500">Low</Badge>;
  };

  const renderField = (label: string, value: any, fieldPath: string, confidence: number = 0.9) => {
    const isEditing = editing === fieldPath;
    const displayValue = value ?? "Not available";

    return (
      <div className="space-y-1 py-2 border-b border-border last:border-0">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <div className="flex items-center gap-2">
            {getConfidenceBadge(confidence)}
            {!isEditing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(fieldPath)}
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
            >
              <Save className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{displayValue}</div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (!document) {
    return <div className="flex items-center justify-center p-8">Document not found</div>;
  }

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
          <CardContent className="space-y-4">
            {document.parsed_data?.bills?.cus_details?.[0] && (
              <div>
                <h3 className="font-semibold mb-2">Customer Details</h3>
                {renderField(
                  "Name",
                  document.parsed_data.bills.cus_details[0].details?.customer_name,
                  "bills.cus_details.0.details.customer_name",
                  0.9
                )}
                {renderField(
                  "Address",
                  document.parsed_data.bills.cus_details[0].details?.address?.line_1,
                  "bills.cus_details.0.details.address.line_1",
                  0.85
                )}
              </div>
            )}

            {document.parsed_data?.bills?.electricity?.[0] && (
              <div>
                <h3 className="font-semibold mb-2">Electricity</h3>
                {renderField(
                  "Account Number",
                  document.parsed_data.bills.electricity[0].electricity_details?.account_number,
                  "bills.electricity.0.electricity_details.account_number",
                  document.confidence_scores?.electricity?.account_number || 0.7
                )}
                {renderField(
                  "MPRN",
                  document.parsed_data.bills.electricity[0].electricity_details?.meter_details?.mprn,
                  "bills.electricity.0.electricity_details.meter_details.mprn",
                  document.confidence_scores?.electricity?.mprn || 0.7
                )}
                {renderField(
                  "Total Due",
                  document.parsed_data.bills.electricity[0].financial_information?.total_due,
                  "bills.electricity.0.financial_information.total_due",
                  document.confidence_scores?.electricity?.total_due || 0.7
                )}
              </div>
            )}

            {document.parsed_data?.bills?.gas?.[0] && (
              <div>
                <h3 className="font-semibold mb-2">Gas</h3>
                {renderField(
                  "Account Number",
                  document.parsed_data.bills.gas[0].gas_details?.account_number,
                  "bills.gas.0.gas_details.account_number",
                  document.confidence_scores?.gas?.account_number || 0.7
                )}
                {renderField(
                  "GPRN",
                  document.parsed_data.bills.gas[0].gas_details?.meter_details?.gprn,
                  "bills.gas.0.gas_details.meter_details.gprn",
                  document.confidence_scores?.gas?.gprn || 0.7
                )}
              </div>
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
