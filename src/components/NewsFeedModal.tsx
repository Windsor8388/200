import React, { useState } from 'react';
import { Globe, Search, ExternalLink, RefreshCw, Sparkles, Newspaper } from 'lucide-react';

interface NewsFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewsFeedModal: React.FC<NewsFeedModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('أحدث أخبار العملات الرقمية وتأثيرها على البيتكوين ومنصة BingX');
  const [loading, setLoading] = useState(false);
  const [newsContent, setNewsContent] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/search-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.success) {
        setNewsContent(data.news);
        setSources(data.groundingChunks || []);
      }
    } catch (e) {
      console.error('Failed to search news:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="news-grounding-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-2xl shadow-2xl flex flex-col gap-4 text-right max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">
              أخبار السوق والسيولة المباشرة (Search Grounding)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg">
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          <input
            id="news-query-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchNews()}
            placeholder="ابحث عن خبر عملة معينة أو حدث اقتصادي..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-hidden focus:border-cyan-500"
          />
          <button
            id="btn-search-crypto-news"
            disabled={loading}
            onClick={fetchNews}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>بحث مباشر</span>
          </button>
        </div>

        {newsContent ? (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 text-xs leading-relaxed text-slate-300">
            <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-slate-850 pb-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>تحليل الأخبار الفوري المدعوم بـ Google Search و Gemini 3.5 Flash:</span>
            </div>
            <div className="whitespace-pre-line text-slate-200">
              {newsContent}
            </div>

            {sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-850">
                <span className="text-[11px] text-slate-400 font-bold block mb-1.5">المصادر الموثقة:</span>
                <div className="flex flex-wrap gap-2">
                  {sources.slice(0, 5).map((chunk, i) => (
                    chunk?.web?.uri ? (
                      <a
                        key={i}
                        href={chunk.web.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-slate-900 hover:bg-slate-850 text-cyan-400 border border-slate-800 px-2 py-1 rounded flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">{chunk.web.title || chunk.web.uri}</span>
                      </a>
                    ) : null
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <Newspaper className="w-8 h-8 text-slate-600" />
            <span>اضغط على زر "بحث مباشر" لجلب آخر تحركات السوق والأخبار المؤثرة في الشارت.</span>
          </div>
        )}
      </div>
    </div>
  );
};
