import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Send, Clock, CheckCircle, XCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ApiTester = () => {
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("/documents");
  const [headers, setHeaders] = useState("{}");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(0);
  const { toast } = useToast();

  const apiEndpoints = [
    { path: "/documents", method: "GET", desc: "List all documents" },
    { path: "/documents/{id}", method: "GET", desc: "Get document by ID" },
    { path: "/documents/{id}/approve", method: "POST", desc: "Approve document with edits" },
    { path: "/documents/{id}/reparse", method: "POST", desc: "Reparse document" },
    { path: "/ingest", method: "POST", desc: "Ingest new document" },
    { path: "/schemas/current", method: "GET", desc: "Get current JSON schema" },
    { path: "/search", method: "GET", desc: "Search documents" },
  ];

  const handleSendRequest = async () => {
    setLoading(true);
    const startTime = Date.now();

    try {
      // Parse endpoint to actual Supabase function URL
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      let actualUrl = endpoint;
      
      if (endpoint.startsWith("/documents/") && endpoint.includes("/approve")) {
        actualUrl = `${baseUrl}/functions/v1/approve-document`;
      } else if (endpoint.startsWith("/documents/") && !endpoint.includes("/")) {
        actualUrl = `${baseUrl}/functions/v1/get-document/${endpoint.split("/")[2]}`;
      } else if (endpoint === "/ingest") {
        actualUrl = `${baseUrl}/functions/v1/ingest-document`;
      }

      const parsedHeaders = JSON.parse(headers);
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          ...parsedHeaders,
        },
      };

      if (method !== "GET" && body) {
        requestOptions.body = body;
      }

      const res = await fetch(actualUrl, requestOptions);
      const endTime = Date.now();
      setResponseTime(endTime - startTime);

      const data = await res.json();
      setResponse({
        status: res.status,
        statusText: res.ok ? "OK" : "Error",
        headers: Object.fromEntries(res.headers.entries()),
        body: data,
      });

      // Save to history
      await supabase.from('api_test_requests').insert({
        endpoint,
        method,
        headers: parsedHeaders,
        request_body: method !== "GET" ? JSON.parse(body) : null,
        response_status: res.status,
        response_body: data,
        response_time_ms: endTime - startTime,
      });

      toast({
        title: "Request sent",
        description: `${method} ${endpoint} - ${res.status}`,
      });
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: "Error",
        body: { error: error.message },
      });
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response?.body, null, 2));
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">API Testing Console</h1>
        <p className="text-muted-foreground">
          Test and debug your document ingestion API endpoints
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Request Builder */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/documents/{id}"
                  className="flex-1"
                />

                <Button onClick={handleSendRequest} disabled={loading}>
                  <Send className="mr-2 h-4 w-4" />
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>

              <Tabs defaultValue="body">
                <TabsList>
                  <TabsTrigger value="body">Body</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                </TabsList>

                <TabsContent value="body">
                  <div className="space-y-2">
                    <Label>Request Body (JSON)</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="font-mono text-sm h-64"
                      placeholder='{"document_id": "...", "edited_data": {...}}'
                    />
                  </div>
                </TabsContent>

                <TabsContent value="headers">
                  <div className="space-y-2">
                    <Label>Custom Headers (JSON)</Label>
                    <Textarea
                      value={headers}
                      onChange={(e) => setHeaders(e.target.value)}
                      className="font-mono text-sm h-64"
                      placeholder='{"X-Custom-Header": "value"}'
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Response */}
          {response && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Response</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">{responseTime}ms</span>
                    </div>
                    <Badge
                      variant={response.status >= 200 && response.status < 300 ? "default" : "destructive"}
                    >
                      {response.status >= 200 && response.status < 300 ? (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {response.status} {response.statusText}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={copyResponse}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs max-h-96">
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {apiEndpoints.map((ep) => (
                <Button
                  key={ep.path}
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    setMethod(ep.method);
                    setEndpoint(ep.path);
                    if (ep.method === "POST") {
                      setBody(ep.path.includes("approve") 
                        ? '{"document_id": "...", "edited_data": {}, "corrections": []}'
                        : '{}');
                    }
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{ep.method}</Badge>
                      <span className="text-sm font-mono">{ep.path}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ep.desc}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Base URL</Label>
                <p className="text-sm font-mono break-all">
                  {import.meta.env.VITE_SUPABASE_URL}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Auth</Label>
                <p className="text-sm">Bearer Token (Auto)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApiTester;
