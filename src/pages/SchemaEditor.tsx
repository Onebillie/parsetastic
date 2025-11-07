import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Code, Eye, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SchemaEditor = () => {
  const [schemas, setSchemas] = useState<any[]>([]);
  const [activeSchema, setActiveSchema] = useState<any>(null);
  const [schemaText, setSchemaText] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    const { data } = await supabase
      .from('json_schema_versions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      setSchemas(data);
      const active = data.find(s => s.is_active);
      if (active) {
        setActiveSchema(active);
        setSchemaText(JSON.stringify(active.schema_definition, null, 2));
        const mappings = active.field_mappings;
        setFieldMappings(
          mappings && typeof mappings === 'object' && !Array.isArray(mappings) 
            ? mappings as Record<string, string>
            : {}
        );
      }
    } else {
      // Initialize with default schema if none exists
      await initializeDefaultSchema();
    }
  };

  const initializeDefaultSchema = async () => {
    const defaultSchema = {
      type: "object",
      required: ["customer_details", "supplier_details", "classification"],
      properties: {
        customer_details: {
          type: "object",
          properties: {
            customer_name: { type: ["string", "null"] },
            customer_name_conf: { type: "number" },
            account_number: { type: ["string", "null"] },
            account_number_conf: { type: "number" },
          }
        },
        supplier_details: {
          type: "object",
          properties: {
            supplier_name: { type: ["string", "null"] },
            invoice_number: { type: ["string", "null"] },
          }
        },
        classification: {
          type: "object",
          properties: {
            document_type: { type: "string" },
          }
        }
      }
    };

    try {
      const { error } = await supabase
        .from('json_schema_versions')
        .insert({
          version: '1.0.0',
          schema_definition: defaultSchema,
          is_active: true,
          created_by: 'system',
        });

      if (!error) {
        loadSchemas();
      }
    } catch (error) {
      console.error('Failed to initialize schema:', error);
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
      
      // Deactivate old versions first
      await supabase
        .from('json_schema_versions')
        .update({ is_active: false })
        .eq('is_active', true);

      const { error } = await supabase
        .from('json_schema_versions')
        .insert({
          version: newVersion,
          schema_definition: JSON.parse(schemaText),
          field_mappings: fieldMappings,
          is_active: true,
          created_by: 'user',
        });

      if (error) throw error;

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

  const extractFields = (obj: any, prefix = ''): string[] => {
    const fields: string[] = [];
    
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (key.endsWith('_conf')) return; // Skip confidence fields
        
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key]?.properties) {
          fields.push(...extractFields(obj[key].properties, path));
        } else if (obj[key]?.items?.properties) {
          fields.push(...extractFields(obj[key].items.properties, `${path}[]`));
        } else {
          fields.push(path);
        }
      });
    }
    
    return fields;
  };

  const schemaFields = schemaText ? (() => {
    try {
      const parsed = JSON.parse(schemaText);
      return extractFields(parsed.properties || {});
    } catch {
      return [];
    }
  })() : [];

  const addFieldMapping = () => {
    const newKey = `field_${Object.keys(fieldMappings).length + 1}`;
    setFieldMappings({ ...fieldMappings, [newKey]: '' });
  };

  const updateFieldMapping = (oldKey: string, newKey: string, value: string) => {
    const updated = { ...fieldMappings };
    delete updated[oldKey];
    updated[newKey] = value;
    setFieldMappings(updated);
  };

  const removeFieldMapping = (key: string) => {
    const updated = { ...fieldMappings };
    delete updated[key];
    setFieldMappings(updated);
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
          <Tabs defaultValue="schema" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schema">
                <Code className="mr-2 h-4 w-4" />
                Schema Definition
              </TabsTrigger>
              <TabsTrigger value="mapping">
                <Eye className="mr-2 h-4 w-4" />
                Field Mapping
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="schema">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>JSON Schema</CardTitle>
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
            </TabsContent>

            <TabsContent value="mapping">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Master Database Field Mapping</CardTitle>
                    <Button onClick={addFieldMapping} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Mapping
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Map extracted fields to your master database fields
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[550px] overflow-y-auto">
                    {Object.entries(fieldMappings).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[1fr,1fr,auto] gap-3 items-end">
                        <div className="space-y-2">
                          <Label>Extracted Field</Label>
                          <Input
                            value={key}
                            onChange={(e) => updateFieldMapping(key, e.target.value, value)}
                            placeholder="e.g., customer_details.customer_name"
                            list="schema-fields"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Master DB Field</Label>
                          <Input
                            value={value}
                            onChange={(e) => updateFieldMapping(key, key, e.target.value)}
                            placeholder="e.g., customer_full_name"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFieldMapping(key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {Object.keys(fieldMappings).length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No field mappings defined. Click "Add Mapping" to start.
                      </div>
                    )}
                  </div>
                  <datalist id="schema-fields">
                    {schemaFields.map(field => (
                      <option key={field} value={field} />
                    ))}
                  </datalist>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
