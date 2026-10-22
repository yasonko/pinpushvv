import React, { useState } from 'react';
import { 
  X, 
  Crop, 
  Check, 
  Maximize2, 
  Sparkles, 
  Layers, 
  Info 
} from 'lucide-react';
import { Pin } from '../../types';
import { convertAspectRatio, TargetAspectRatio } from '../../services/imageTransform';

interface AspectRatioModalProps {
  pins: Pin[];
  isOpen: boolean;
  onClose: () => void;
  onApplyRatio: (updatedPins: Pin[]) => void;
}

export const AspectRatioModal: React.FC<AspectRatioModalProps> = ({
  pins,
  isOpen,
  onClose,
  onApplyRatio,
}) => {
  const [ratio, setRatio] = useState<TargetAspectRatio>('2:3');
  const [fitMode, setFitMode] = useState<'crop' | 'pad'>('crop');
  const [padColor, setPadColor] = useState('#ffffff');
  const [isProcessing, setIsProcessing] = useState(false);

  const ratios: { id: TargetAspectRatio; label: string; desc: string; pRatio: string }[] = [
    { id: '2:3', label: '2:3 Standard Pin (Recommended)', desc: '1000 × 1500 px • Optimal for Pinterest feed algorithm', pRatio: '2/3' },
    { id: '9:16', label: '9:16 Full Screen / Idea Pin', desc: '1080 × 1920 px • Mobile vertical video & story pins', pRatio: '9/16' },
    { id: '1:1', label: '1:1 Square Pin', desc: '1200 × 1200 px • Product catalog & multi-platform', pRatio: '1/1' },
    { id: '4:5', label: '4:5 Social Portrait', desc: '1080 × 1350 px • Compact feed portrait', pRatio: '4/5' },
  ];

  const handleApply = async () => {
    setIsProcessing(true);
    const updated: Pin[] = [];
    const now = new Date().toISOString();

    for (const pin of pins) {
      try {
        const transformedUrl = await convertAspectRatio(pin.imageUrl, ratio, fitMode, padColor);
        updated.push({
          ...pin,
          imageUrl: transformedUrl,
          thumbnailUrl: transformedUrl,
          aspectRatio: ratio,
          updatedAt: now,
        });
      } catch (err) {
        console.error(`Failed to resize ${pin.filename}:`, err);
        updated.push(pin);
      }
    }

    setIsProcessing(false);
    onApplyRatio(updated);
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
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pinterest Aspect Ratio Optimizer</h2>
              <p className="text-xs text-slate-500 font-medium">
                Standardize {pins.length} Pin{pins.length > 1 ? 's' : ''} to Pinterest recommended dimensions
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Target Ratio Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">Target Aspect Ratio</label>
            <div className="space-y-2">
              {ratios.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setRatio(r.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    ratio === r.id
                      ? 'bg-red-50/50 border-[#E60023] ring-2 ring-[#E60023]/15'
                      : 'bg-[#F7F7F9] border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{r.label}</span>
                      {r.id === '2:3' && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-[#E60023] text-white">
                          Best SEO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">{r.desc}</p>
                  </div>
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center border-slate-300">
                    {ratio === r.id && <div className="w-2 h-2 rounded-full bg-[#E60023]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mode (Smart Center Crop vs Pad) */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-slate-700 block">Transformation Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFitMode('crop')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                  fitMode === 'crop'
                    ? 'bg-red-50 border-red-200 text-[#E60023]'
                    : 'bg-[#F7F7F9] border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>Smart Center Crop</div>
                <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                  Crops edges to fill exact vertical canvas
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFitMode('pad')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                  fitMode === 'pad'
                    ? 'bg-red-50 border-red-200 text-[#E60023]'
                    : 'bg-[#F7F7F9] border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>Canvas Padding (Fit)</div>
                <span className="text-[10px] font-normal text-slate-500 block mt-0.5">
                  Keeps 100% of image with background border
                </span>
              </button>
            </div>
          </div>

          {/* Info pill */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              Pinterest feeds deliver up to <strong>60% more saves</strong> to standard 2:3 vertical images.
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
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] disabled:opacity-50 px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Optimizing Images...' : `Optimize ${pins.length} Pins`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
