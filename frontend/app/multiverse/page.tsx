'use client';

import { useState, useRef } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { api, RoastAnalyzeResponse } from '@/lib/api';
import { motion } from 'motion/react';

const SAMPLE_IMAGES = ['/sample1.jpg', '/sample2.jpg'] as const;

export default function RoastAIPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'truth' | 'roast'>('truth');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoastAnalyzeResponse | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    setResult(null);
    setSampleError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) {
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setFile(null);
      setPreviewUrl(null);
    }
  };

  const loadSample = async (path: (typeof SAMPLE_IMAGES)[number]) => {
    setError(null);
    setResult(null);
    setSampleError(null);
    try {
      const res = await fetch(path);
      if (!res.ok) {
        setSampleError(`Sample not found. Add ${path.replace('/', '')} to the public folder for demo.`);
        return;
      }
      const blob = await res.blob();
      const f = new File([blob], path.replace('/', ''), { type: blob.type || 'image/jpeg' });
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
    } catch {
      setSampleError(`Could not load ${path}. Add it to the public folder.`);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Select or upload an image first.');
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadingStep('truth');
    const stepTimer = setTimeout(() => setLoadingStep('roast'), 2000);
    try {
      const data = await api.analyzeRoast(file);
      clearTimeout(stepTimer);
      setResult(data);
    } catch (e: unknown) {
      clearTimeout(stepTimer);
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Confidently Wrong Roast AI</h1>
        <p className="text-gray-400 mb-6">
          Sube una imagen. La IA entiende la escena y suelta un roast corto y gracioso en estilo stand-up.
        </p>

        {/* Upload + Sample */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-6">
          <div
            className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center mb-4 cursor-pointer hover:border-[#4F8CFF]/40 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <p className="text-gray-500">Arrastra una imagen o haz clic para seleccionar</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => loadSample('/sample1.jpg')}
              className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 text-sm"
            >
              Use sample image 1
            </button>
            <button
              type="button"
              onClick={() => loadSample('/sample2.jpg')}
              className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 text-sm"
            >
              Use sample image 2
            </button>
          </div>
          {sampleError && <p className="text-amber-400 text-sm mb-2">{sampleError}</p>}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !file}
            className="w-full py-3 bg-[#4F8CFF] hover:bg-[#5A96FF] text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (loadingStep === 'truth' ? 'Processing truth…' : 'Generating roast…') : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {result && (
          <>
            {/* Reality Check */}
            <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Reality Check</h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    result.truth_source === 'local'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-[#4F8CFF]/20 text-[#6BA0FF] border border-[#4F8CFF]/30'
                  }`}
                >
                  {result.truth_source === 'local' ? 'LOCAL ✅' : 'CLOUD ☁️'}
                </span>
              </div>
              <p className="text-gray-300 mb-2"><strong className="text-gray-200">Caption:</strong> {result.truth.truth_caption}</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-gray-200">Objects:</strong> {result.truth.truth_objects?.length ? result.truth.truth_objects.join(', ') : '—'}
              </p>
              <p className="text-gray-300 mb-2"><strong className="text-gray-200">Scene:</strong> {result.truth.scene_type}</p>
              {result.truth.truth_ocr && (
                <p className="text-gray-300 mb-2"><strong className="text-gray-200">OCR:</strong> {result.truth.truth_ocr}</p>
              )}
              <p className="text-gray-300"><strong className="text-gray-200">Confidence:</strong> {result.truth.confidence}</p>
              <p className="text-xs text-gray-500 mt-2">
                Truth: {result.latency_ms_truth}ms · Roast: {result.latency_ms_roast}ms
              </p>
            </section>

            {/* Roast AI */}
            <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Roast AI</h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    result.roast_source === 'local'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-[#4F8CFF]/20 text-[#6BA0FF] border border-[#4F8CFF]/30'
                  }`}
                >
                  {result.roast_source === 'local' ? 'LOCAL ✅' : 'CLOUD ☁️'}
                </span>
              </div>
              <blockquote className="text-lg text-gray-200 italic border-l-4 border-[#4F8CFF] pl-4 py-2">
                &ldquo;{result.roast}&rdquo;
              </blockquote>
            </section>
          </>
        )}
      </motion.div>
    </DashboardShell>
  );
}
