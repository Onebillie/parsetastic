import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/FileUpload";
import { useDocumentIngest } from "@/hooks/useDocumentIngest";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Ingest = () => {
  const [phone, setPhone] = useState("");
  const [autopilot, setAutopilot] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploading, result, ingestDocument } = useDocumentIngest();
  const navigate = useNavigate();

  const handleIngest = async () => {
    if (!selectedFile || !phone) return;
    
    const ingestResult = await ingestDocument(selectedFile, phone, autopilot);
    
    if (ingestResult.requires_review) {
      // Navigate to review page
      setTimeout(() => {
        navigate(`/review/${ingestResult.document_id}`);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">AI Document Ingestion</h1>
          <p className="text-muted-foreground">
            Upload bills, meter readings, and documents for automated processing
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Supports PDF, PNG, JPG, HEIC, and video files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                placeholder="+353 XX XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={uploading}
              />
            </div>

            <FileUpload
              onFileSelect={setSelectedFile}
              disabled={uploading}
              currentFile={selectedFile}
              isUploading={uploading}
            />

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="autopilot" className="font-semibold">
                  Autopilot Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Auto-approve documents with confidence ≥ 85%
                </p>
              </div>
              <Switch
                id="autopilot"
                checked={autopilot}
                onCheckedChange={setAutopilot}
                disabled={uploading}
              />
            </div>

            <Button
              onClick={handleIngest}
              disabled={!selectedFile || !phone || uploading}
              className="w-full"
            >
              {uploading ? "Processing..." : "Ingest Document"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classification Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Document Type:</span>
                <Badge variant="outline">{result.classification.type}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence:</span>
                <Badge 
                  variant={result.classification.confidence >= 0.85 ? "default" : "secondary"}
                >
                  {Math.round(result.classification.confidence * 100)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Review Required:</span>
                <Badge variant={result.requires_review ? "destructive" : "default"}>
                  {result.requires_review ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Ingest;
