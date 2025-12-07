import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { DocumentInput as DocInputType } from '../types';

interface DocumentInputProps {
  onInputChanged: (input: DocInputType | null) => void;
}

export const DocumentInput: React.FC<DocumentInputProps> = ({ onInputChanged }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
      setFileName(file.name);
      onInputChanged({
        type: 'file',
        file: file,
        base64: base64Data,
        mimeType: file.type,
        text: ''
      });
    };
    reader.readAsDataURL(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
    onInputChanged({
      type: 'text',
      text: e.target.value,
      file: null
    });
  };

  const clearFile = () => {
    setFileName(null);
    onInputChanged(null);
    // Reset file input value manually if needed, but for now simple clear is fine
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'upload' 
              ? 'bg-blue-600 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Upload size={16} />
            <span>Upload Document</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'text' 
              ? 'bg-blue-600 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <FileText size={16} />
            <span>Paste Text</span>
          </div>
        </button>
      </div>

      <div className="min-h-[200px] flex flex-col justify-center">
        {activeTab === 'upload' ? (
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors bg-slate-800/50">
            {fileName ? (
              <div className="flex items-center justify-center space-x-3 bg-slate-700 p-4 rounded-lg inline-flex">
                <FileText className="text-blue-400" />
                <span className="text-slate-200">{fileName}</span>
                <button onClick={clearFile} className="text-slate-400 hover:text-red-400">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-slate-500 mb-4" />
                <p className="text-slate-300 font-medium">Click to upload or drag and drop</p>
                <p className="text-slate-500 text-sm mt-1">PDF, PNG, JPG supported</p>
                <input 
                  type="file" 
                  accept="application/pdf,image/*" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                />
              </>
            )}
          </div>
        ) : (
          <textarea
            value={textInput}
            onChange={handleTextChange}
            placeholder="Paste your business document text here..."
            className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
          />
        )}
      </div>
    </div>
  );
};
