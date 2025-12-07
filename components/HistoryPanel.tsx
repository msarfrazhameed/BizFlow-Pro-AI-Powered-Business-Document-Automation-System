import React from 'react';
import { AnalysisResult } from '../types';
import { X, Clock, FileText, ChevronRight, Receipt, Mail, AlertTriangle, ShieldAlert, Calendar } from 'lucide-react';

interface HistoryPanelProps {
  history: AnalysisResult[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: AnalysisResult) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, isOpen, onClose, onSelect }) => {
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('invoice') || cat.includes('finance')) return Receipt;
    if (cat.includes('email') || cat.includes('communication')) return Mail;
    if (cat.includes('complaint')) return AlertTriangle;
    if (cat.includes('legal')) return ShieldAlert;
    if (cat.includes('request') || cat.includes('leave')) return Calendar;
    return FileText;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Slide-over Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Clock className="mr-2 text-blue-500" size={20} />
              Recent Analysis
            </h2>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>No recent analysis found.</p>
                <p className="text-sm mt-1">Processed documents will appear here.</p>
              </div>
            ) : (
              history.map((item) => {
                const Icon = getCategoryIcon(item.classification.category);
                return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-blue-400 transition-colors">
                          <Icon size={16} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-200 text-sm">{item.classification.category}</h3>
                          <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                        item.classification.urgency >= 4 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                        item.classification.urgency >= 3 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        Priority {item.classification.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 pl-11">
                      {item.actions.primary}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="p-4 border-t border-slate-800 bg-slate-900">
             <p className="text-xs text-center text-slate-500">
               History is stored locally on this device.
             </p>
          </div>
        </div>
      </div>
    </>
  );
};