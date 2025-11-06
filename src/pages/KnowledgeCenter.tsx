import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const KnowledgeCenter = () => {
  const [category, setCategory] = useState("suppliers");
  const [subcategory, setSubcategory] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file || !title) {
      toast({
        title: "Missing information",
        description: "Please provide a title and file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileName = `knowledge/${category}/${subcategory || 'general'}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('bills')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/bills/${fileName}`;

      // Create knowledge document record
      const { error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
          category,
          subcategory: subcategory || null,
          title,
          file_url: fileUrl,
          file_type: file.type,
          metadata: {
            original_filename: file.name,
            size_bytes: file.size,
          },
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Knowledge document uploaded successfully",
      });

      // Reset form
      setFile(null);
      setTitle("");
      loadDocuments();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const loadDocuments = async () => {
    const { data } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });
    
    if (data) setDocuments(data);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Knowledge Center</h1>
        <p className="text-muted-foreground">
          Upload and manage supplier layouts, meter manuals, glossaries, and training materials
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="browse">
            <FileText className="mr-2 h-4 w-4" />
            Browse Knowledge
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Knowledge Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suppliers">Supplier Layouts</SelectItem>
                      <SelectItem value="meters">Meter Manuals</SelectItem>
                      <SelectItem value="glossary">Glossary & Rules</SelectItem>
                      <SelectItem value="training">Training Materials</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subcategory (e.g., Supplier Name)</Label>
                  <Input
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="Electric Ireland, SSE, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Document Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Layout Guide Q4 2024"
                />
              </div>

              <div className="space-y-2">
                <Label>File</Label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>

              <Button onClick={handleUpload} disabled={uploading}>
                <Plus className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Document"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="browse">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Select value={category} onValueChange={(val) => { setCategory(val); loadDocuments(); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suppliers">Supplier Layouts</SelectItem>
                    <SelectItem value="meters">Meter Manuals</SelectItem>
                    <SelectItem value="glossary">Glossary & Rules</SelectItem>
                    <SelectItem value="training">Training Materials</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {documents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No documents in this category yet
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.subcategory && `${doc.subcategory} • `}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>Search Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input placeholder="Search by title, supplier, or content..." />
                <Button>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeCenter;
