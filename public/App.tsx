import React, { useState, useRef } from 'react';
import { evolveImage } from './services/geminiService';
import { GenerationStatus, GeneratedImage } from './types';

const App: React.FC = () => {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('Cinematic tech lab workspace, moody Louisiana sunset light through a window, professional engineering desk, SB logo on the main 5K display.');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBaseImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const generate = async () => {
    if (status === GenerationStatus.LOADING) return;
    setStatus(GenerationStatus.LOADING);
    setError(null);
    try {
      const imageUrl = await evolveImage(baseImage, prompt);
      setResults(prev => [{ url: imageUrl, prompt, timestamp: Date.now() }, ...prev]);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || 'Evolution failed.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-gray-200 selection:bg-[#f97316]/30">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 border-b border-gray-900 pb-8 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 bg-[#f97316] rounded-full animate-pulse"></span>
              <p className="text-[#f97316] font-black text-[10px] tracking-[0.2em] uppercase">Internal Ops // Studio v1.0</p>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter italic">TECH LAB STUDIO<span className="text-[#f97316] not-italic">.</span></h1>
          </div>
          <div className="flex gap-4">
            <a href="/techlabs/index.html" className="text-[10px] font-black border border-gray-800 px-6 py-3 rounded-full hover:bg-gray-900 hover:border-[#f97316] transition-all uppercase tracking-widest">
              Public Page
            </a>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Controls */}
          <aside className="lg:col-span-4 space-y-8">
            <div className="bg-[#030a1f] border border-white/5 rounded-[2rem] p-8 shadow-3xl">
              <div className="mb-8">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-4">01. Source Material</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-gray-800 rounded-2xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:border-[#f97316] transition-all overflow-hidden bg-black/40"
                >
                  {baseImage ? (
                    <img src={baseImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Source" />
                  ) : (
                    <div className="text-center p-6">
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest group-hover:text-[#f97316] transition-colors">Drop Reference Photo</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
              </div>

              <div className="mb-8">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-4">02. Design Intent</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-[#020617] border border-gray-800 rounded-2xl p-5 text-sm font-medium focus:ring-1 focus:ring-[#f97316] focus:border-[#f97316] outline-none h-32 resize-none transition-all text-gray-300"
                  placeholder="Describe the evolution..."
                />
              </div>

              <button 
                onClick={generate}
                disabled={status === GenerationStatus.LOADING}
                className="w-full bg-gradient-to-r from-[#f97316] to-[#fb923c] text-black font-black py-5 rounded-2xl uppercase tracking-[0.15em] text-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
              >
                {status === GenerationStatus.LOADING ? 'Processing...' : 'Evolve Brand Asset'}
              </button>
              
              {error && <p className="text-red-500 text-[10px] mt-4 font-black text-center uppercase tracking-widest">{error}</p>}
            </div>

            <div className="p-6 border border-gray-900 rounded-3xl bg-black/20">
              <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
                <strong className="text-gray-400 block mb-1">PRO TIP:</strong>
                For best results, upload a photo of your actual desk or workshop. Gemini will keep your layout but swap the "vibe" for the official Lab aesthetic.
              </p>
            </div>
          </aside>

          {/* Output */}
          <section className="lg:col-span-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">03. Output Gallery</h2>
              <span className="text-[10px] font-bold text-[#f97316]">{results.length} Versions Generated</span>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 gap-12">
                {results.map((res, i) => (
                  <div key={i} className="group bg-[#030a1f] p-4 rounded-[2.5rem] border border-white/5 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="aspect-[1.91/1] rounded-[2rem] overflow-hidden border border-gray-900 shadow-4xl mb-6 relative">
                      <img src={res.url} className="w-full h-full object-cover" alt="Result" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                         <p className="text-[10px] text-gray-300 font-medium italic">"{res.prompt}"</p>
                      </div>
                    </div>
                    <div className="px-4 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Revision {results.length - i}</span>
                        <span className="w-1 h-1 bg-gray-800 rounded-full"></span>
                        <span className="text-[10px] font-bold text-gray-700 uppercase">{new Date(res.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = res.url;
                          link.download = `SB_TechLab_OG_${Date.now()}.png`;
                          link.click();
                        }}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                      >
                        Export HQ Asset
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[500px] border border-gray-900 rounded-[3rem] border-dashed flex flex-col items-center justify-center text-gray-700">
                 <div className="w-20 h-20 mb-6 relative">
                    <div className="absolute inset-0 border-2 border-gray-800 rounded-full animate-ping opacity-20"></div>
                    <div className="absolute inset-4 border-2 border-gray-800 rounded-full"></div>
                 </div>
                 <p className="text-xs font-black uppercase tracking-[0.2em]">System Idle</p>
                 <p className="text-[10px] mt-2 font-medium">Awaiting source photo and evolution instructions...</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
