import { useParams, useNavigate } from "react-router-dom";
import { DocumentReview } from "@/components/DocumentReview";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Review = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  if (!documentId) {
    return <div className="p-8 text-center">Document ID not found</div>;
  }

  return (
    <div className="h-screen bg-background">
      <div className="p-4 border-b border-border flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/ingest')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-xl font-bold">Document Review</h1>
      </div>
      <DocumentReview 
        documentId={documentId} 
        onApprove={() => navigate('/ingest')}
      />
    </div>
  );
};

export default Review;
