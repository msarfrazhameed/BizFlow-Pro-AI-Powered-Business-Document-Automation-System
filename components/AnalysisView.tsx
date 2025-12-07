import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import { 
  CheckCircle, 
  FileCheck, 
  BarChart3, 
  Mail,
  Workflow,
  Volume2,
  Play,
  Square,
  ArrowRight,
  AlertTriangle,
  Receipt,
  FileText,
  Calendar,
  ShieldAlert,
  Briefcase
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { generateVoiceSummary } from '../services/gemini';

interface AnalysisViewProps {
  result: AnalysisResult;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result }) => {
  const { classification, extraction, actions, summary } = result;
  const [isPlaying, setIsPlaying] = useState<'summary' | 'action' | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // --- Visual Helpers ---
  const getUrgencyColor = (level: number) => {
    const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
    return colors[level - 1] || '#3b82f6';
  };
  
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('invoice') || cat.includes('finance')) return Receipt;
    if (cat.includes('email') || cat.includes('communication')) return Mail;
    if (cat.includes('complaint')) return AlertTriangle;
    if (cat.includes('legal')) return ShieldAlert;
    if (cat.includes('request') || cat.includes('leave')) return Calendar;
    return FileText;
  };

  const CategoryIcon = getCategoryIcon(classification.category);
  const urgencyColor = getUrgencyColor(classification.urgency);

  const extractionData = extraction.map(e => ({
    name: e.field,
    confidence: e.confidence * 100
  }));

  // --- Audio Logic ---
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const handlePlayAudio = async (text: string, type: 'summary' | 'action') => {
    if (isPlaying) {
      if (audioContext) {
        audioContext.close();
        setAudioContext(null);
      }
      setIsPlaying(null);
      // If clicking the same button, stop. If different, start new.
      if (isPlaying === type) return;
    }

    try {
      setIsPlaying(type);
      const base64Audio = await generateVoiceSummary(text);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      setAudioContext(ctx);

      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      source.onended = () => {
        setIsPlaying(null);
        ctx.close();
        setAudioContext(null);
      };

    } catch (err) {
      console.error("Failed to play audio", err);
      setIsPlaying(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* --- Top Dashboard: Classification --- */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="bg-slate-800/80 p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl bg-blue-500/10 border border-blue-500/20`}>
              <CategoryIcon className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold text-white capitalize">{classification.category}</h2>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600">
                  {classification.domain}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">{classification.reason}</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-900/50 rounded-lg p-3 border border-slate-700">
            <div className="mr-4 text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Priority Level</p>
              <p className="text-lg font-bold" style={{ color: urgencyColor }}>
                {classification.urgency >= 5 ? 'Critical' : classification.urgency >= 3 ? 'Moderate' : 'Routine'}
              </p>
            </div>
            <div className="relative w-12 h-12 flex-shrink-0">
               <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" stroke="#1e293b" strokeWidth="4" fill="none" />
                    <circle cx="24" cy="24" r="20" stroke={urgencyColor} strokeWidth="4" fill="none" 
                        strokeDasharray={125} 
                        strokeDashoffset={125 - (125 * classification.urgency) / 5} 
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-300">
                  {classification.urgency}
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* --- Left Col: Extracted Data (Agent 3) --- */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
               <h3 className="font-semibold text-white flex items-center">
                  <BarChart3 className="mr-2 text-purple-400" size={18} />
                  Structured Data Extraction
               </h3>
               <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">JSON Ready</span>
            </div>
            <div className="p-4 flex-grow space-y-3">
               {extraction.map((item, idx) => (
                  <div key={idx} className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/30 border border-transparent hover:border-slate-700 transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                          <p className="text-xs text-slate-500 uppercase font-semibold mb-0.5">{item.field}</p>
                          <p className="text-slate-200 font-mono text-sm truncate" title={item.value}>{item.value}</p>
                      </div>
                      <div className="flex flex-col items-end min-w-[60px]">
                          <div className="flex items-center space-x-1 mb-1">
                             <div className={`w-1.5 h-1.5 rounded-full ${item.confidence > 0.8 ? 'bg-emerald-500' : item.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                             <span className="text-xs text-slate-400">{(item.confidence * 100).toFixed(0)}%</span>
                          </div>
                          {/* Mini Bar */}
                          <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                             <div className="h-full bg-purple-500/50" style={{ width: `${item.confidence * 100}%` }} />
                          </div>
                      </div>
                  </div>
               ))}
               
               {/* Simplified Chart Visual */}
               <div className="mt-6 pt-4 border-t border-slate-700">
                  <h4 className="text-xs text-slate-500 uppercase mb-2">Confidence Overview</h4>
                  <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={extractionData}>
                              <Bar dataKey="confidence" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.6} />
                              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* --- Right Col: Action Plan (Agent 4) --- */}
        <div className="space-y-6">
          
          {/* Primary Action Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-blue-500/30 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-3xl transform translate-x-16 -translate-y-16 group-hover:bg-blue-500/20 transition-all duration-700"></div>
            
            <div className="p-6 relative z-10">
              <div className="flex justify-between items-start mb-4">
                 <h3 className="font-semibold text-blue-400 flex items-center uppercase tracking-wider text-xs">
                    <CheckCircle className="mr-2" size={14} />
                    Primary Recommendation
                 </h3>
                 <button
                    onClick={() => handlePlayAudio(actions.primary, 'action')}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        isPlaying === 'action'
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white'
                    }`}
                 >
                    {isPlaying === 'action' ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                    <span>{isPlaying === 'action' ? 'Stop' : 'Listen'}</span>
                 </button>
              </div>
              <p className="text-xl text-white font-medium leading-relaxed">
                {actions.primary}
              </p>
            </div>
            
            <div className="px-6 pb-6 relative z-10">
               <h4 className="text-xs text-slate-500 uppercase mb-2">Secondary Actions</h4>
               <ul className="space-y-2">
                  {actions.secondary.map((act, i) => (
                      <li key={i} className="flex items-start text-sm text-slate-300">
                          <span className="w-1.5 h-1.5 bg-slate-600 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                          {act}
                      </li>
                  ))}
               </ul>
            </div>
          </div>

          {/* Workflow Visualization */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
             <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center">
                    <Workflow className="mr-2 text-cyan-400" size={18} />
                    Execution Workflow
                </h3>
             </div>
             <div className="p-6 overflow-x-auto">
                <div className="flex items-center space-x-4 min-w-max pb-2">
                   {actions.workflow.map((step, idx) => (
                       <div key={idx} className="flex items-center">
                          <div className="relative group">
                             <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-500 flex items-center justify-center text-cyan-500 font-bold text-sm z-10 relative group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                                 {idx + 1}
                             </div>
                             {/* Content Card */}
                             <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-48 bg-slate-700 p-3 rounded-lg border border-slate-600 shadow-xl opacity-100 transition-all">
                                 <p className="text-xs text-slate-200 text-center">{step}</p>
                                 <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-700 rotate-45 border-t border-l border-slate-600"></div>
                             </div>
                          </div>
                          
                          {/* Connector Line */}
                          {idx < actions.workflow.length - 1 && (
                              <div className="w-16 h-0.5 bg-slate-700 mx-2 flex items-center justify-center">
                                  <ArrowRight size={14} className="text-slate-600" />
                              </div>
                          )}
                       </div>
                   ))}
                </div>
                {/* Spacer to accommodate absolute cards */}
                <div className="h-16"></div> 
             </div>
          </div>
        </div>
      </div>

      {/* --- Email Draft --- */}
      {actions.emailDraft && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500"></div>
                </div>
                <div className="text-xs text-slate-500 font-mono">Draft Message</div>
                <Mail size={14} className="text-slate-500" />
            </div>
            <div className="p-6 bg-slate-800/50">
                <div className="mb-4 space-y-2">
                    <div className="flex border-b border-slate-700/50 pb-2">
                        <span className="text-sm text-slate-400 w-16">To:</span>
                        <span className="text-sm text-slate-200">Recipient associated with {classification.domain}</span>
                    </div>
                    <div className="flex border-b border-slate-700/50 pb-2">
                        <span className="text-sm text-slate-400 w-16">Subject:</span>
                        <span className="text-sm text-slate-200">Action Required: {classification.category} - {classification.domain}</span>
                    </div>
                </div>
                <div className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {actions.emailDraft}
                </div>
                <div className="mt-4 flex justify-end">
                    <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors border border-slate-600">
                        Copy to Clipboard
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- Floating / Fixed Voice Summary --- */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-sm sticky bottom-4 shadow-2xl z-10">
          <div className="flex items-center space-x-3">
             <div className="bg-indigo-500/20 p-2 rounded-full">
                <Volume2 className="text-indigo-400" size={20} />
             </div>
             <div>
                <h4 className="text-sm font-semibold text-white">Audio Executive Summary</h4>
                <p className="text-xs text-slate-400">Listen to the complete analysis and next steps.</p>
             </div>
          </div>
          
          <div className="flex items-center space-x-3 w-full sm:w-auto">
             <button
                onClick={() => handlePlayAudio(summary, 'summary')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all shadow-lg ${
                    isPlaying === 'summary' 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25'
                }`}
             >
                {isPlaying === 'summary' ? (
                    <>
                        <Square size={16} fill="currentColor" />
                        <span>Stop Playback</span>
                    </>
                ) : (
                    <>
                        <Play size={16} fill="currentColor" />
                        <span>Play Full Summary</span>
                    </>
                )}
             </button>
          </div>
      </div>

    </div>
  );
};