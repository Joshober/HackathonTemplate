'use client';

import { useCallback, useRef, useState } from 'react';
import { api, type ParsedTripDocument } from '@/lib/api';
import { extractTextFromFile } from '@/lib/extractTravelFileText';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

interface Props {
  onParsed?: (doc: ParsedTripDocument, documentType: string) => void;
  className?: string;
}

const STORAGE_KEY = 'tripready_parsed_doc';

type UploadStatus = 'idle' | 'extracting' | 'parsing' | 'done' | 'error';

export default function DocumentUploadPanel({ onParsed, className = '' }: Props) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedTripDocument | null>(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
    }
    return null;
  });
  const [fileName, setFileName] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setStatus('extracting');

    let text = '';
    try {
      text = await extractTextFromFile(file);
    } catch {
      setError('Could not read file. Please try a PDF, DOCX, or TXT file.');
      setStatus('error');
      return;
    }

    if (!text.trim()) {
      setError('The file appears to be empty or unreadable.');
      setStatus('error');
      return;
    }

    setStatus('parsing');

    const ext = file.name.split('.').pop()?.toLowerCase();
    const documentType = ext === 'pdf' || ext === 'docx' || ext === 'txt' ? 'itinerary' : 'other';

    try {
      const result = await api.parseDocument({
        text,
        documentName: file.name,
        documentType,
      });

      setParsed(result.extracted);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.extracted));
      }
      setStatus('done');
      onParsed?.(result.extracted, result.documentType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document.');
      setStatus('error');
    }
  }, [onParsed]);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void processFile(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearDoc = () => {
    setParsed(null);
    setStatus('idle');
    setError(null);
    setFileName('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  if (status === 'done' && parsed) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 ${className}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Document understood</p>
              {fileName && <p className="text-xs text-emerald-700">{fileName}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={clearDoc}
            className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600"
            title="Remove document"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {parsed.tripSummary && (
          <p className="text-sm text-emerald-800 font-medium">{parsed.tripSummary}</p>
        )}
        {parsed.destinations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {parsed.destinations.map((d) => (
              <span key={d} className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                {d}
              </span>
            ))}
          </div>
        )}
        {parsed.visaRequirements.length > 0 && (
          <div className="space-y-1">
            {parsed.visaRequirements.map((v, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span><span className="font-medium">{v.country}:</span> {v.requirement}</span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setStatus('idle'); setFileName(''); }}
          className="text-xs text-emerald-700 hover:underline mt-1"
        >
          Upload a different document
        </button>
      </div>
    );
  }

  if (status === 'extracting' || status === 'parsing') {
    return (
      <div className={`rounded-2xl border border-blue-200 bg-blue-50 p-5 flex items-center gap-3 ${className}`}>
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900">
            {status === 'extracting' ? 'Reading document…' : 'Analyzing with AI…'}
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            {status === 'extracting'
              ? 'Extracting text from your file'
              : 'Extracting destinations, dates, visa requirements, and flights'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`
          relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer
          transition-colors select-none
          ${dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <Upload className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Upload your travel itinerary</p>
            <p className="text-xs text-gray-500 mt-0.5">PDF, DOCX, or TXT — drag & drop or click</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Itinerary</span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Booking confirmation</span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Travel policy</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        Documents are processed securely and used only to personalize your copilot experience.
      </p>
    </div>
  );
}
