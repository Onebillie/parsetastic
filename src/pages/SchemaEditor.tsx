import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Code, Eye } from "lucide-react";

const SchemaEditor = () => {
  const [schemas, setSchemas] = useState<any[]>([]);
  const [activeSchema, setActiveSchema] = useState<any>(null);
  const [schemaText, setSchemaText] = useState("");
  const [isValid, setIsValid] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    const { data } = await supabase
      .from('json_schema_versions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setSchemas(data);
      const active = data.find(s => s.is_active);
      if (active) {
        setActiveSchema(active);
        setSchemaText(JSON.stringify(active.schema_definition, null, 2));
      }
    }
  };

  const validateSchema = (text: string) => {
    try {
      JSON.parse(text);
      setIsValid(true);
      return true;
    } catch {
      setIsValid(false);
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateSchema(schemaText)) {
      toast({
        title: "Invalid JSON",
        description: "Please fix the JSON syntax errors",
        variant: "destructive",
      });
      return;
    }

    try {
      const newVersion = `1.0.${schemas.length}`;
      const { error } = await supabase
        .from('json_schema_versions')
        .insert({
          version: newVersion,
          schema_definition: JSON.parse(schemaText),
          is_active: true,
          created_by: 'user',
        });

      if (error) throw error;

      // Deactivate old versions
      await supabase
        .from('json_schema_versions')
        .update({ is_active: false })
        .neq('version', newVersion);

      toast({
        title: "Schema saved",
        description: `Version ${newVersion} is now active`,
      });

      loadSchemas();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">JSON Schema Editor</h1>
        <p className="text-muted-foreground">
          Define and version the strict document parsing schema
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Schema Definition</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={isValid ? "default" : "destructive"}>
                    {isValid ? "Valid JSON" : "Invalid JSON"}
                  </Badge>
                  <Button onClick={handleSave} disabled={!isValid}>
                    <Save className="mr-2 h-4 w-4" />
                    Save New Version
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={schemaText}
                onChange={(e) => {
                  setSchemaText(e.target.value);
                  validateSchema(e.target.value);
                }}
                className="font-mono text-sm h-[600px]"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schema Versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {schemas.map((schema) => (
                <div
                  key={schema.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                    schema.id === activeSchema?.id ? 'border-primary' : ''
                  }`}
                  onClick={() => {
                    setActiveSchema(schema);
                    setSchemaText(JSON.stringify(schema.schema_definition, null, 2));
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">v{schema.version}</p>
                    {schema.is_active && <Badge>Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(schema.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schema Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">document_id</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">classification</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">account</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">tariff</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">metering</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">charges</span>
                </div>
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-mono">confidence</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SchemaEditor;
