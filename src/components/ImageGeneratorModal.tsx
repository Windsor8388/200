import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, Download, RefreshCw, ZoomIn } from 'lucide-react';

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair: string;
}

export const ImageGeneratorModal: React.FC<ImageGeneratorModalProps> = ({
  isOpen,
  onClose,
  pair,
}) => {
  const [prompt, setPrompt] = useState(
    `Modern technical cryptocurrency chart setup for ${pair} showing bullish Fibonacci retracement, key liquidity order block zones, glowing green breakout targets, and futuristic dark neon HUD overlay.`
  );
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorNotice(null);
    try {
      const res = await fetch('/api/ai/generate-chart-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          resolution,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل توليد صورة الشارت');
      }
      setGeneratedImg(data.imageUrl);
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'حدث خطأ أثناء التوليد');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="image-generator-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-xl shadow-2xl flex flex-col gap-4 text-right max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">
              توليد مخططات وصور فنية للشارت (Gemini Image 1K/2K/4K)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">وصف المخطط المطلوب (Prompt)</label>
            <textarea
              id="image-prompt-input"
              rows={3}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">دقة الصورة (Resolution)</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['1K', '2K', '4K'] as const).map(res => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={`py-1 rounded font-bold transition-colors ${
                      resolution === res ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">نسبة الأبعاد (Aspect Ratio)</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['1:1', '16:9', '4:3'] as const).map(ratio => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-1 rounded font-bold transition-colors ${
                      aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            id="btn-generate-chart-image"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 shadow-md"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري إنشاء المخطط بدقة {resolution}...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>توليد صورة الشارت الآن</span>
              </>
            )}
          </button>

          {errorNotice && (
            <div className="p-2.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300">
              {errorNotice}
            </div>
          )}

          {generatedImg && (
            <div className="mt-3 flex flex-col gap-2 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
              <img
                src={generatedImg}
                alt="Generated Chart Setup"
                className="w-full max-h-[320px] object-contain rounded-lg border border-slate-700"
              />
              <div className="flex items-center justify-between w-full pt-1">
                <span className="text-[11px] text-slate-400 font-mono">الدقة: {resolution} ({aspectRatio})</span>
                <a
                  href={generatedImg}
                  download={`trading-setup-${pair}.png`}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>تحميل الصورة</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
