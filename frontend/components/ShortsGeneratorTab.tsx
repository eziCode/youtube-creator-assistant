import React, { useState } from 'react';
import { ShortClip } from '../types';
import { findShortsHighlights, exportShort } from '../services/geminiService';
import Card from './Card';

const ShortsGeneratorTab: React.FC = () => {
  const [shorts, setShorts] = useState<ShortClip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setShorts([]);
      setNotification(null);
    }
  };

  const handleGenerateShorts = async () => {
    if (!selectedFile) {
        setNotification("Please select a video file first.");
        return;
    }
    setIsLoading(true);
    setNotification("Analyzing video... this may take a moment (simulated).");
    const generatedClips = await findShortsHighlights(selectedFile);
    setShorts(generatedClips);
    setNotification("Suggested clips are ready!");
    setIsLoading(false);
  };
  
  const handleExportShort = async (clipIndex: number) => {
    setIsExporting(clipIndex);
    setNotification(`Exporting short #${clipIndex + 1}... (simulated FFmpeg job)`);
    const resultMessage = await exportShort(clipIndex);
    setNotification(resultMessage);
    setIsExporting(null);
  }
  
  const handleClear = () => {
      setShorts([]);
      setSelectedFile(null);
      setNotification('Cleared suggestions.');
      const fileInput = document.getElementById('video-upload') as HTMLInputElement;
      if(fileInput) fileInput.value = '';
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Shorts Generator</h2>
      </div>

      {notification && (
        <div className="mb-4 p-3 text-sm bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-md" role="alert">
          {notification}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="1. Upload Video">
          <p className="text-xs text-slate-600 mb-4">
            We’ll transcribe and find high-energy hooks with our model (Gemini). For this demo, the process is simulated.
          </p>
          <input 
            type="file"
            id="video-upload"
            accept="video/mp4,video/quicktime" 
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
          />
          <div className="mt-4 flex gap-2">
            <button 
                onClick={handleGenerateShorts} 
                disabled={isLoading || !selectedFile}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-wait"
            >
              {isLoading ? 'Analyzing...' : 'Generate Clips'}
            </button>
            <button onClick={handleClear} className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-100">
              Clear
            </button>
          </div>
        </Card>

        <Card title="2. Review & Export Clips">
          {shorts.length === 0 && !isLoading && (
            <div className="text-sm text-slate-500 h-full flex items-center justify-center">
                Your suggested clips will appear here.
            </div>
          )}
          {isLoading && (
            <div className="text-sm text-slate-500 h-full flex items-center justify-center">
                Finding the best moments...
            </div>
          )}
          <ul className="space-y-3 mt-2">
            {shorts.map((s, i) => (
              <li key={i} className="p-3 bg-white rounded-md shadow-sm flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{s.start}s — {s.end}s</div>
                  <div className="text-xs text-slate-500 mt-1">{s.reason}</div>
                </div>
                <button 
                    onClick={() => handleExportShort(i)} 
                    disabled={isExporting === i}
                    className="text-xs py-1.5 px-3 border border-slate-300 rounded-md font-semibold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isExporting === i ? 'Exporting...' : 'Export Short'}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
};

export default ShortsGeneratorTab;
