import React, { useState } from 'react';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Check, 
  X,
  Layers
} from 'lucide-react';
import { Website, Pin } from '../../types';

interface WebsitesViewProps {
  websites: Website[];
  pins: Pin[];
  onSaveWebsite: (website: Website) => void;
  onDeleteWebsite: (id: string) => void;
}

export const WebsitesView: React.FC<WebsitesViewProps> = ({
  websites,
  pins,
  onSaveWebsite,
  onDeleteWebsite,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const startAdd = () => {
    setName('');
    setUrl('');
    setIsAdding(true);
    setEditingId(null);
  };

  const startEdit = (w: Website) => {
    setName(w.name);
    setUrl(w.url);
    setEditingId(w.id);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const website: Website = {
      id: editingId || `web_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      url: normalizedUrl,
      createdAt: new Date().toISOString(),
    };

    onSaveWebsite(website);
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Bento Tile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs transition-colors amoled-card">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#E60023] dark:text-red-400" />
            Destination Websites & Stores
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Manage websites, blogs, Shopify stores, and Etsy shops for rapid Pin destination URL assignment.
          </p>
        </div>

        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Website</span>
        </button>
      </div>

      {/* Add / Edit Form Drawer */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          className="bg-white/90 dark:bg-black/80 dark:backdrop-blur-2xl p-6 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-xs space-y-4 animate-in fade-in duration-150 amoled-card"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {editingId ? 'Edit Website' : 'Add New Destination Website'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Website Name</label>
              <input
                type="text"
                placeholder="e.g. My Lifestyle Blog"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full text-xs p-3 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Base URL</label>
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="w-full text-xs font-mono p-3 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#E60023] hover:bg-[#ad001a] text-white cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Website</span>
            </button>
          </div>
        </form>
      )}

      {/* Websites Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {websites.map((web) => {
          const pinCount = pins.filter(p => p.websiteId === web.id || p.destinationUrl.startsWith(web.url)).length;

          return (
            <div
              key={web.id}
              className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] shadow-xs flex flex-col justify-between space-y-3 transition-colors amoled-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#E60023] dark:text-red-400 flex items-center justify-center font-bold">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{web.name}</h3>
                    <a
                      href={web.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-slate-500 dark:text-slate-400 hover:text-[#E60023] dark:hover:text-red-400 flex items-center gap-1 transition-colors truncate max-w-[220px]"
                    >
                      <span>{web.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(web)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-lg cursor-pointer transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteWebsite(web.id)}
                    className="p-1.5 text-slate-400 hover:text-[#E60023] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="font-mono">{pinCount} Pins linked</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Added {new Date(web.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
