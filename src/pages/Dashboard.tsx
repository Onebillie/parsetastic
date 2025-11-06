import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Brain, TestTube, BookOpen, Code, Eye } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();

  const modules = [
    { title: "Document Ingestion", desc: "Upload and process documents", icon: Upload, path: "/ingest" },
    { title: "Review Queue", desc: "Approve pending documents", icon: Eye, path: "/queue" },
    { title: "Knowledge Center", desc: "Manage training materials", icon: BookOpen, path: "/knowledge" },
    { title: "Training & Learning", desc: "Monitor AI improvements", icon: Brain, path: "/training" },
    { title: "API Testing", desc: "Test and debug endpoints", icon: TestTube, path: "/api-tester" },
    { title: "Schema Editor", desc: "Configure JSON structure", icon: Code, path: "/schema" },
    { title: "Legacy Parser", desc: "Old OneBill parser", icon: FileText, path: "/legacy" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            AI Document Ingestion System
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            End-to-end intelligent document processing with classification, extraction, validation, and continuous learning
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto">
          {modules.map((module) => (
            <Card
              key={module.path}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(module.path)}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <module.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{module.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {module.desc}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
