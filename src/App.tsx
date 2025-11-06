import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Ingest from "./pages/Ingest";
import Review from "./pages/Review";
import KnowledgeCenter from "./pages/KnowledgeCenter";
import Training from "./pages/Training";
import ApiTester from "./pages/ApiTester";
import SchemaEditor from "./pages/SchemaEditor";
import ReviewQueue from "./pages/ReviewQueue";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/legacy" element={<Index />} />
          <Route path="/ingest" element={<Ingest />} />
          <Route path="/review/:documentId" element={<Review />} />
          <Route path="/knowledge" element={<KnowledgeCenter />} />
          <Route path="/training" element={<Training />} />
          <Route path="/api-tester" element={<ApiTester />} />
          <Route path="/schema" element={<SchemaEditor />} />
          <Route path="/queue" element={<ReviewQueue />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
