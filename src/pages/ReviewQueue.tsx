import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, FileText, Clock } from "lucide-react";

const ReviewQueue = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, total: 0 });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-documents?status=pending_review&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const data = await response.json();
      setDocuments(data.documents || []);
      setStats({ pending: data.documents?.length || 0, total: data.total || 0 });
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load review queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.90) return <Badge className="bg-green-600">High ({Math.round(confidence * 100)}%)</Badge>;
    if (confidence >= 0.75) return <Badge className="bg-yellow-600">Medium ({Math.round(confidence * 100)}%)</Badge>;
    return <Badge variant="destructive">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p>Loading review queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Document Review Queue</h1>
        <p className="text-muted-foreground">
          {stats.pending} documents awaiting review
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No documents pending review</h3>
            <p className="text-muted-foreground">All documents have been processed!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{doc.file_name}</CardTitle>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Type: {doc.document_type}</span>
                      <span>•</span>
                      <span>Phone: {doc.phone_number}</span>
                      <span>•</span>
                      <span>{new Date(doc.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {getConfidenceBadge(doc.classification_confidence)}
                    <Badge variant="outline">{doc.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate(`/review/${doc.id}`)}
                    className="flex-1"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Review Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewQueue;
