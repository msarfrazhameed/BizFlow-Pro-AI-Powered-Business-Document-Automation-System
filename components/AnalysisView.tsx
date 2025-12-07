import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, GeneratedAction } from '../types';
import { 
  CheckCircle, 
  BarChart3, 
  Mail,
  Workflow,
  Play,
  Square,
  AlertTriangle,
  Receipt,
  FileText,
  Calendar,
  ShieldAlert,
  Table,
  MessageSquare,
  Copy,
  Check,
  FileDown,
  Send,
  Share2,
  Volume2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { generateVoiceSummary } from '../services/gemini';

interface AnalysisViewProps {
  result: AnalysisResult;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result }) => {
  const { classification, extraction, actions, summary } = result;
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState<'summary' | 'action' | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{[key: string]: 'idle' | 'sending' | 'sent'}>({});

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
       // We don't necessarily close context to keep it reused, but we stop playback
       audioContextRef.current.close();
       audioContextRef.current = null;
    }
    setIsPlaying(null);
  };

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
    if (isPlaying === type) {
      stopAudio();
      return;
    }

    // Stop any current audio before starting new
    stopAudio();
    setIsPlaying(type);

    try {
      const base64Audio = await generateVoiceSummary(text);
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);

      const source = ctx.createBufferSource();
      audioSourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      source.onended = () => {
        setIsPlaying(null);
        audioSourceRef.current = null;
      };

    } catch (err) {
      console.error("Failed to play audio", err);
      setIsPlaying(null);
    }
  };

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

  // --- Helper Actions ---
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulateSend = (id: string) => {
    setActionStatus(prev => ({ ...prev, [id]: 'sending' }));
    setTimeout(() => {
        setActionStatus(prev => ({ ...prev, [id]: 'sent' }));
        setTimeout(() => setActionStatus(prev => ({ ...prev, [id]: 'idle' })), 3000);
    }, 1500);
  };

  const handleDownloadReport = () => {
    const report = `
BIZFLOW PRO - EXECUTIVE REPORT
================================
Date: ${new Date(result.timestamp).toLocaleDateString()}
Category: ${classification.category}
Domain: ${classification.domain}
Priority Level: ${classification.urgency}/5 (${classification.urgency >= 5 ? 'Critical' : classification.urgency >= 3 ? 'Moderate' : 'Routine'})

EXECUTIVE SUMMARY
--------------------------------
${summary}

PRIMARY RECOMMENDATION
--------------------------------
${actions.primary}

KEY DATA EXTRACTED
--------------------------------
${extraction.map(e => `- ${e.field}: ${e.value} (Confidence: ${(e.confidence * 100).toFixed(0)}%)`).join('\n')}

ACTION PLAN / WORKFLOW
--------------------------------
${actions.workflow.map((step, i) => `${i+1}. ${step}`).join('\n')}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BizFlow_Report_${result.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmailSummary = () => {
    const subject = encodeURIComponent(`BizFlow Analysis: ${classification.category} - ${classification.domain}`);
    const body = encodeURIComponent(`${summary}\n\nKey Action:\n${actions.primary}\n\n[Generated by BizFlow Pro]`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const renderActionCard = (action: GeneratedAction, index: number) => {
    const id = `action-${index}`;
    const status = actionStatus[id] || 'idle';
    
    if (action.action_type === 'email') {
      return (
        <div key={index} className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden h-full flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-500 hover:shadow-xl hover:border-slate-600 transition-all">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500"></div>
              </div>
              <div className="text-xs text-slate-500 font-mono flex items-center">
                  Draft Email
                  <span className="ml-2 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              </div>
              <Mail size={14} className="text-slate-500" />
          </div>
          <div className="p-6 bg-slate-800/50 flex-grow flex flex-col">
              <div className="mb-4 space-y-2">
                  <div className="flex border-b border-slate-700/50 pb-2">
                      <span className="text-sm text-slate-400 w-16">To:</span>
                      <span className="text-sm text-slate-200">{action.content.to || '[Recipient]'}</span>
                  </div>
                  <div className="flex border-b border-slate-700/50 pb-2">
                      <span className="text-sm text-slate-400 w-16">Subject:</span>
                      <span className="text-sm text-slate-200">{action.content.subject}</span>
                  </div>
              </div>
              <div className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed flex-grow">
                  {action.content.body}
              </div>
          </div>
          {/* Footer with Action Button */}
          <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between gap-3">
              <button 
                onClick={() => handleCopy(`${action.content.subject}\n\n${action.content.body}`, id)}
                className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors"
                title="Copy to Clipboard"
              >
                  {copiedId === id ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <button 
                onClick={() => handleSimulateSend(id)}
                disabled={status !== 'idle'}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-bold transition-all ${
                    status === 'sent' 
                    ? 'bg-green-600 text-white' 
                    : status === 'sending'
                    ? 'bg-blue-800 text-blue-200'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                }`}
              >
                  {status === 'sent' ? (
                      <>
                        <Check size={18} />
                        <span>Sent Successfully</span>
                      </>
                  ) : status === 'sending' ? (
                      <span>Sending...</span>
                  ) : (
                      <>
                        <Send size={18} />
                        <span>Send Email</span>
                      </>
                  )}
              </button>
          </div>
        </div>
      );
    }

    if (action.action_type === 'sheet') {
      return (
        <div key={index} className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75 hover:shadow-xl hover:border-slate-600 transition-all">
           <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
               <h4 className="text-sm font-semibold text-white flex items-center">
                   <Table className="mr-2 text-green-400" size={16} />
                   Google Sheet Row
               </h4>
               <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Spreadsheet Ready</span>
           </div>
           <div className="p-4 overflow-x-auto flex-grow flex flex-col justify-between">
               <table className="w-full text-left border-collapse mb-4">
                   <thead>
                       <tr>
                           {action.content.headers?.map((h, i) => (
                               <th key={i} className="px-3 py-2 text-xs font-medium text-slate-400 border-b border-slate-700 bg-slate-900/30 whitespace-nowrap">{h}</th>
                           ))}
                       </tr>
                   </thead>
                   <tbody>
                       <tr>
                           {action.content.row?.map((c, i) => (
                               <td key={i} className="px-3 py-2 text-sm text-slate-200 border-b border-slate-700/50 font-mono whitespace-nowrap">{c}</td>
                           ))}
                       </tr>
                   </tbody>
               </table>
           </div>
           {/* Footer */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
                <button 
                onClick={() => handleCopy(action.content.row?.join('\t') || '', id)}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-green-600/20"
                >
                    {copiedId === id ? <Check size={18} /> : <Copy size={18} />}
                    <span>{copiedId === id ? 'Copied to Clipboard' : 'Copy Row (TSV)'}</span>
                </button>
            </div>
        </div>
      );
    }

    if (action.action_type === 'slack_message') {
      return (
        <div key={index} className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 hover:shadow-xl hover:border-slate-600 transition-all">
           <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
               <h4 className="text-sm font-semibold text-white flex items-center">
                   <MessageSquare className="mr-2 text-purple-400" size={16} />
                   Slack Notification
               </h4>
               <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">Team Alert</span>
           </div>
           <div className="p-4 bg-slate-800/30 flex-grow flex flex-col justify-between">
               <div className="flex items-start space-x-3 mb-4">
                   <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">AI</div>
                   <div className="flex-1 min-w-0">
                       <div className="flex items-baseline space-x-2 mb-1">
                           <span className="font-bold text-slate-200 text-sm">BizFlow Bot</span>
                           <span className="text-xs text-slate-500">APP</span>
                       </div>
                       <p className="text-sm text-slate-300 leading-relaxed break-words">{action.content.message || action.content.body}</p>
                   </div>
               </div>
           </div>
            {/* Footer */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between gap-3">
                <button 
                    onClick={() => handleCopy(action.content.message || action.content.body || '', id)}
                    className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors"
                    title="Copy Text"
                >
                    {copiedId === id ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <button 
                    onClick={() => handleSimulateSend(id)}
                    disabled={status !== 'idle'}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-bold transition-all ${
                        status === 'sent' 
                        ? 'bg-purple-600 text-white' 
                        : status === 'sending'
                        ? 'bg-purple-800 text-purple-200'
                        : 'bg-[#4A154B] hover:bg-[#611f69] text-white border border-purple-500/30'
                    }`}
                >
                     {status === 'sent' ? (
                      <>
                        <Check size={18} />
                        <span>Posted!</span>
                      </>
                  ) : status === 'sending' ? (
                      <span>Posting...</span>
                  ) : (
                      <>
                        <MessageSquare size={18} />
                        <span>Post to Slack</span>
                      </>
                  )}
                </button>
            </div>
        </div>
      );
    }

    // Save PDF / Download Report Action
    if (action.action_type === 'save_pdf') {
      return (
        <div key={index} className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 hover:shadow-xl hover:border-slate-600 transition-all">
           <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
               <h4 className="text-sm font-semibold text-white flex items-center">
                   <FileText className="mr-2 text-orange-400" size={16} />
                   Download Report
               </h4>
               <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30">Text Summary</span>
           </div>
           <div className="p-4 bg-slate-800/30 flex-grow flex flex-col justify-between">
               <div className="flex items-start space-x-3 mb-4">
                   <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-white flex-shrink-0 border border-slate-600">
                      <FileDown size={16} className="text-slate-300" />
                   </div>
                   <div className="flex-1 min-w-0">
                       <p className="text-sm text-slate-300 leading-relaxed">
                         Download a readable text summary of this analysis, including all extraction data and the recommended action plan.
                       </p>
                   </div>
               </div>
           </div>
           {/* Footer */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
                <button 
                onClick={() => {
                    handleDownloadReport();
                    setCopiedId(id);
                    setTimeout(() => setCopiedId(null), 2000);
                }}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors border border-slate-600"
                >
                    {copiedId === id ? <Check size={18} /> : <FileDown size={18} />}
                    <span>{copiedId === id ? 'Downloaded' : 'Download Text Report'}</span>
                </button>
            </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* --- Executive Brief (Sticky) --- */}
      <div className="sticky top-20 z-30 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700 p-6 shadow-2xl flex flex-col md:flex-row gap-6 overflow-hidden transition-all duration-300">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full filter blur-3xl transform translate-x-20 -translate-y-20 pointer-events-none"></div>
         <div className="flex-1 z-10">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                <Volume2 className="mr-2 text-blue-400" size={20} />
                Executive Brief
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
                {summary}
            </p>
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => handlePlayAudio(summary, 'summary')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        isPlaying === 'summary'
                        ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    }`}
                >
                    {isPlaying === 'summary' ? (
                       <>
                         <Square size={16} fill="currentColor" />
                         <span className="animate-pulse">Playing...</span>
                       </>
                    ) : (
                       <>
                         <Play size={16} fill="currentColor" />
                         <span>Listen to Brief</span>
                       </>
                    )}
                </button>
                <button
                    onClick={handleEmailSummary}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors border border-slate-700"
                >
                    <Share2 size={16} />
                    <span>Email Brief</span>
                </button>
            </div>
         </div>
      </div>

      {/* --- Top Dashboard --- */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-500">
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

        {/* --- Left: Extracted Data --- */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full animate-in slide-in-from-left-4 fade-in duration-500 delay-100">
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
                          <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                             <div className="h-full bg-purple-500/50" style={{ width: `${item.confidence * 100}%` }} />
                          </div>
                      </div>
                  </div>
               ))}
               <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs text-slate-500 uppercase">Confidence Overview</h4>
                    <span className="text-[10px] text-slate-600">AI Certainty Score</span>
                  </div>
                  <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={extractionData} margin={{ top: 5, right: 5, bottom: 20, left: -20 }}>
                              <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" />
                              <YAxis domain={[0, 100]} hide />
                              <Bar dataKey="confidence" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.6} />
                              <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                                contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px'}}
                                itemStyle={{color: '#8b5cf6'}}
                                formatter={(value: number) => [`${value.toFixed(0)}%`, 'Confidence']}
                                labelStyle={{color: '#94a3b8', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 600}}
                              />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* --- Right: Actions & Workflow --- */}
        <div className="space-y-6">
          
          {/* Primary + Secondary Actions */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-blue-500/30 shadow-lg relative overflow-hidden group animate-in slide-in-from-right-4 fade-in duration-500 delay-100">
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

          {/* Workflow */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg animate-in slide-in-from-right-4 fade-in duration-500 delay-200">
             <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center">
                    <Workflow className="mr-2 text-cyan-400" size={18} />
                    Execution Workflow
                </h3>
             </div>
             <div className="p-6 relative">
                <div className="space-y-0 relative">
                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-700"></div>
                    {actions.workflow.map((step, idx) => (
                        <div key={idx} className="relative pl-12 pb-8 last:pb-0">
                            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-500 flex items-center justify-center text-cyan-500 font-bold text-sm z-10 shadow-lg shadow-cyan-500/20">
                                {idx + 1}
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-cyan-500/50 transition-colors">
                                <p className="text-sm text-slate-200 leading-relaxed">{step}</p>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* --- Generated "Ready-to-Execute" Actions --- */}
      {actions.generatedActions && actions.generatedActions.length > 0 && (
        <div className="mt-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <CheckCircle className="mr-2 text-green-400" size={20} />
                One-Click Actions
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {actions.generatedActions.map((action, idx) => renderActionCard(action, idx))}
            </div>
        </div>
      )}

    </div>
  );
};