import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, FileCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Training = () => {
  const [stats, setStats] = useState<any>({
    totalCorrections: 0,
    avgConfidenceImprovement: 0,
    supplierAccuracy: [],
    recentCorrections: [],
  });

  useEffect(() => {
    loadTrainingStats();
  }, []);

  const loadTrainingStats = async () => {
    // Load correction stats
    const { data: corrections } = await supabase
      .from('document_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Load training examples
    const { data: examples } = await supabase
      .from('training_examples')
      .select('*')
      .order('created_at', { ascending: false });

    // Calculate stats
    if (corrections && examples) {
      const supplierStats = examples.reduce((acc: any, ex: any) => {
        const key = ex.supplier || 'Unknown';
        if (!acc[key]) acc[key] = { count: 0, confidence: [] };
        acc[key].count++;
        if (ex.confidence_after) acc[key].confidence.push(ex.confidence_after);
        return acc;
      }, {});

      setStats({
        totalCorrections: corrections.length,
        avgConfidenceImprovement: examples.reduce((sum: number, ex: any) => 
          sum + (ex.confidence_after - ex.confidence_before || 0), 0) / (examples.length || 1),
        supplierAccuracy: Object.entries(supplierStats).map(([name, data]: [string, any]) => ({
          name,
          count: data.count,
          avgConfidence: data.confidence.reduce((a: number, b: number) => a + b, 0) / data.confidence.length,
        })),
        recentCorrections: corrections,
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Training & Continuous Improvement</h1>
        <p className="text-muted-foreground">
          Monitor learning progress, correction patterns, and model accuracy
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Corrections</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCorrections}</div>
            <p className="text-xs text-muted-foreground">Human-in-the-loop edits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence Gain</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              +{(stats.avgConfidenceImprovement * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">After corrections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Suppliers Learned</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.supplierAccuracy.length}</div>
            <p className="text-xs text-muted-foreground">Templates created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Low confidence docs</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="corrections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="corrections">Recent Corrections</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Accuracy</TabsTrigger>
          <TabsTrigger value="fields">Field Performance</TabsTrigger>
          <TabsTrigger value="trends">Learning Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="corrections">
          <Card>
            <CardHeader>
              <CardTitle>Recent HITL Corrections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentCorrections.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No corrections yet
                  </p>
                ) : (
                  stats.recentCorrections.map((correction: any) => (
                    <div key={correction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{correction.field_path}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground line-through">
                            {correction.original_value}
                          </span>
                          <span className="text-xs">→</span>
                          <span className="text-xs font-medium text-green-600">
                            {correction.corrected_value}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {(correction.confidence_before * 100).toFixed(0)}% conf
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Accuracy by Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.supplierAccuracy.map((supplier: any) => (
                  <div key={supplier.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{supplier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {supplier.count} documents processed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {(supplier.avgConfidence * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Avg confidence</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Field-Level Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Field accuracy analysis coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Learning Trends Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Trend visualization coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Training;
