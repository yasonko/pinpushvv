import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  Check, 
  Sliders, 
  Info, 
  ExternalLink 
} from 'lucide-react';
import { Pin, Board } from '../../types';
import { buildUtmUrl, UtmConfig } from '../../services/utmBuilder';

interface UtmBuilderModalProps {
  pins: Pin[];
  boards: Board[];
  isOpen: boolean;
  onClose: () => void;
  onApplyUtm: (updatedPins: Pin[]) => void;
}

export const UtmBuilderModal: React.FC<UtmBuilderModalProps> = ({
  pins,
  boards,
  isOpen,
  onClose,
  onApplyUtm,
}) => {
  const [source, setSource] = useState('pinterest');
  const [medium, setMedium] = useState('social');
  const [campaign, setCampaign] = useState('{board}');
  const [content, setContent] = useState('{title}');
  const [term, setTerm] = useState('');

  const previewPin = pins[0];
  const previewBoard = boards.find(b => b.id === previewPin?.boardId) || boards[0];
  const sampleBaseUrl = previewPin?.destinationUrl || 'https://myblog.com/top-10-ideas';

  const previewGeneratedUrl = buildUtmUrl(
    sampleBaseUrl,
    { source, medium, campaign, content, term },
    previewPin,
    previewBoard
  );

  const handleApply = () => {
    const boardMap = new Map<string, Board>(boards.map(b => [b.id, b]));
    const now = new Date().toISOString();

    const updated = pins.map(pin => {
      if (!pin.destinationUrl) return pin;
      const b = pin.boardId ? boardMap.get(pin.boardId) : undefined;
      const taggedUrl = buildUtmUrl(pin.destinationUrl, { source, medium, campaign, content, term }, pin, b);
      return {
        ...pin,
        destinationUrl: taggedUrl,
        updatedAt: now,
      };
    });

    onApplyUtm(updated);
    onClose();
  };

  if (!isOpen || pins.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#F7F7F9]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E60023] text-white flex items-center justify-center shadow-xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Bulk UTM Campaign Tag Builder</h2>
              <p className="text-xs text-slate-500 font-medium">
                Track Pinterest clicks in Google Analytics 4 & Shopify for {pins.length} Pins
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">utm_source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="pinterest"
                className="w-full text-xs font-mono p-2.5 bg-[#F7F7F9] border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">utm_medium</label>
              <input
                type="text"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="social"
                className="w-full text-xs font-mono p-2.5 bg-[#F7F7F9] border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                utm_campaign <span className="text-[10px] text-slate-400 font-normal">({'{board}'} supported)</span>
              </label>
              <input
                type="text"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="{board}"
                className="w-full text-xs font-mono p-2.5 bg-[#F7F7F9] border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                utm_content <span className="text-[10px] text-slate-400 font-normal">({'{title}'} supported)</span>
              </label>
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="{title}"
                className="w-full text-xs font-mono p-2.5 bg-[#F7F7F9] border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1.5 font-mono text-[11px]">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              Live Parameter Preview:
            </span>
            <p className="break-all text-emerald-400 leading-relaxed">
              {previewGeneratedUrl}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-[#F7F7F9] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-4 py-2 rounded-xl cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply UTM to {pins.length} Pins</span>
          </button>
        </div>
      </div>
    </div>
  );
};
