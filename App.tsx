import React, { useState, useEffect } from 'react';
import { Zap, Layout, FileText, Mic, Sparkles, CheckCircle2, Loader2, AlertCircle, ArrowDown, Clock, User } from 'lucide-react';
import { DocumentInput } from './components/DocumentInput';
import { AnalysisView } from './components/AnalysisView';
import { LiveSession } from './components/LiveSession';
import { HistoryPanel } from './components/HistoryPanel';
import { analyzeDocument } from './services/gemini';
import { DocumentInput as DocInputType, AnalysisResult, AppMode, AgentStage } from './types';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.DOCUMENT);
  const [input, setInput] = useState<DocInputType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentStage, setAgentStage] = useState<AgentStage>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showLiveModal, setShowLiveModal] = useState(false);
  
  // History State
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load History from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('bizflow_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = (newResult: AnalysisResult) => {
    const newHistory = [newResult, ...history].slice(0, 10); // Keep last 10
    setHistory(newHistory);
    localStorage.setItem('bizflow_history', JSON.stringify(newHistory));
  };

  const handleAnalyze = async () => {
    if (!input) return;

    setIsAnalyzing(true);
    setAgentStage('ingestion');
    setResult(null);

    try {
      const payload = input.type === 'file' && input.base64 && input.mimeType 
        ? { base64: input.base64, mimeType: input.mimeType }
        : input.text;
      
      const data = await analyzeDocument(payload, (stage) => setAgentStage(stage));
      setResult(data);
      saveToHistory(data);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to analyze document. Please check your API key and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStageStatus = (stage: AgentStage, target: AgentStage) => {
    const stages: AgentStage[] = ['ingestion', 'classification', 'extraction', 'action', 'complete'];
    const currentIndex = stages.indexOf(stage === 'error' || stage === 'idle' ? 'ingestion' : stage);
    const targetIndex = stages.indexOf(target);
    
    if (stage === 'complete') return 'completed';
    if (stage === 'error') return 'error';
    if (currentIndex > targetIndex) return 'completed';
    if (currentIndex === targetIndex) return 'active';
    return 'pending';
  };

  // Pipeline Step Component
  const PipelineStep = ({ label, description, status, isLast }: { label: string, description: string, status: 'pending' | 'active' | 'completed' | 'error', isLast?: boolean }) => {
    let circleClass = "bg-slate-800 border-slate-600 text-slate-500";
    let lineClass = "bg-slate-700";
    let textClass = "text-slate-500";
    let icon = <div className="w-2 h-2 bg-slate-500 rounded-full" />;

    if (status === 'active') {
      circleClass = "bg-blue-900 border-blue-500 text-blue-400 ring-4 ring-blue-500/20";
      lineClass = "bg-gradient-to-b from-blue-500 to-slate-700";
      textClass = "text-blue-400";
      icon = <Loader2 size={16} className="animate-spin" />;
    } else if (status === 'completed') {
      circleClass = "bg-emerald-900 border-emerald-500 text-emerald-400";
      lineClass = "bg-emerald-500";
      textClass = "text-emerald-400";
      icon = <CheckCircle2 size={16} />;
    } else if (status === 'error') {
      circleClass = "bg-red-900 border-red-500 text-red-400";
      textClass = "text-red-400";
      icon = <AlertCircle size={16} />;
    }

    return (
      <div className="relative flex group">
        {!isLast && (
           <div className={`absolute left-4 top-8 bottom-[-8px] w-0.5 ${lineClass} transition-colors duration-500`}></div>
        )}
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 ${circleClass} z-10 transition-all duration-300`}>
          {icon}
        </div>
        <div className="ml-4 mb-8">
           <h4 className={`text-sm font-bold ${status === 'pending' ? 'text-slate-500' : 'text-slate-200'}`}>{label}</h4>
           <p className={`text-xs mt-0.5 ${status === 'active' ? 'text-blue-300 animate-pulse' : 'text-slate-500'}`}>{description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans">
      {/* SaaS Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setResult(null); setInput(null); }}>
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                <Zap className="text-white h-5 w-5" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                BizFlow<span className="text-blue-400">Pro</span>
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
               {/* History Button */}
               <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2 text-slate-400 hover:text-white transition-colors relative"
                  title="Analysis History"
               >
                  <Clock size={20} />
                  {history.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border border-slate-900"></span>
                  )}
               </button>

               {/* Live Assistant */}
               <button 
                  onClick={() => setShowLiveModal(true)}
                  className="hidden md:flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-full border border-slate-700 transition-all hover:border-blue-500/50 group"
               >
                  <div className="relative flex items-center justify-center">
                     <Mic size={18} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
                     <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse ring-2 ring-slate-800"></span>
                  </div>
                  <span className="text-sm font-medium">Live Assistant</span>
               </button>
               
               {/* Mock Profile */}
               <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white border border-slate-600 cursor-pointer hover:bg-slate-600">
                  <User size={16} />
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar: Input & Pipeline */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* Input Card */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden sticky top-24 z-20">
                    <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
                        <h2 className="font-semibold text-white flex items-center text-sm uppercase tracking-wider">
                            <Layout className="mr-2 text-blue-500" size={16} />
                            Document Input
                        </h2>
                    </div>
                    <div className="p-6">
                        <DocumentInput onInputChanged={setInput} />
                        
                        <button
                            onClick={handleAnalyze}
                            disabled={!input || isAnalyzing}
                            className={`w-full mt-6 py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center space-x-2 transition-all transform active:scale-95 shadow-lg ${
                                !input || isAnalyzing
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                                : 'bg-blue-600 hover:bg-blue-500 border border-blue-500 shadow-blue-600/20'
                            }`}
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={18} />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 fill-current" size={18} />
                                    <span>Run Analysis</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Pipeline Status */}
                <div className={`bg-slate-900 rounded-xl border border-slate-800 p-6 transition-all duration-500 ${isAnalyzing || agentStage !== 'idle' ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 grayscale'}`}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Automation Pipeline</h3>
                    <div className="pl-2">
                        <PipelineStep 
                            label="Ingestion Agent" 
                            description="OCR & Text Normalization"
                            status={getStageStatus(agentStage, 'ingestion')} 
                        />
                        <PipelineStep 
                            label="Classification Agent" 
                            description="Domain & Urgency Prediction"
                            status={getStageStatus(agentStage, 'classification')} 
                        />
                        <PipelineStep 
                            label="Extraction Agent" 
                            description="Structured Field Retrieval"
                            status={getStageStatus(agentStage, 'extraction')} 
                        />
                        <PipelineStep 
                            label="Action Agent" 
                            description="Workflow & Draft Generation"
                            status={getStageStatus(agentStage, 'action')} 
                            isLast
                        />
                    </div>
                </div>
            </div>

            {/* Right Column: Dashboard */}
            <div className="lg:col-span-8">
                {result ? (
                    <AnalysisView result={result} />
                ) : (
                    <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-800 text-slate-500 p-8 text-center animate-in fade-in duration-700">
                        <div className="bg-slate-800 p-6 rounded-full mb-6 ring-1 ring-slate-700">
                            <FileText size={48} className="text-slate-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-300 mb-2">Ready to Analyze</h3>
                        <p className="text-slate-500 max-w-sm">
                            Upload a business document (Invoice, Contract, Email) to see the multi-agent system in action.
                        </p>
                    </div>
                )}
            </div>

          </div>
      </main>
      
      {/* Live Session Modal */}
      {showLiveModal && (
        <LiveSession onClose={() => setShowLiveModal(false)} />
      )}

      {/* History Panel */}
      <HistoryPanel 
        history={history}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelect={(item) => { setResult(item); setAgentStage('complete'); }}
      />
    </div>
  );
}

export default App;