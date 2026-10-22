import React, { useState, useRef } from 'react';
import { 
  X, 
  Stamp, 
  Type, 
  Image as ImageIcon, 
  Upload, 
  Check, 
  Sparkles, 
  Sliders, 
  Eye, 
  Layers
} from 'lucide-react';
import { Pin } from '../../types';
import { applyWatermarkToImage, WatermarkOptions } from '../../services/imageTransform';

interface WatermarkModalProps {
  pins: Pin[];
  isOpen: boolean;
  onClose: () => void;
  onApplyWatermark: (updatedPins: Pin[]) => void;
}

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  pins,
  isOpen,
  onClose,
  onApplyWatermark,
}) => {
  const [type, setType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('© myblog.com');
  const [watermarkLogoData, setWatermarkLogoData] = useState<string | null>(null);
  const [position, setPosition] = useState<WatermarkOptions['position']>('bottom-right');
  const [opacity, setOpacity] = useState(0.85);
  const [useBgPill, setUseBgPill] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewPin = pins[0];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setWatermarkLogoData(result);
    };
    reader.readAsDataURL(file);
  };

  // Generate live preview for first pin
  const generatePreview = async () => {
    if (!previewPin) return;
    try {
      const res = await applyWatermarkToImage(previewPin.imageUrl, {
        type,
        text,
        watermarkDataUrl: watermarkLogoData || undefined,
        position,
        opacity,
        bgColor: useBgPill ? 'rgba(0, 0, 0, 0.45)' : undefined,
      });
      setPreviewDataUrl(res);
    } catch (err) {
      console.error('Preview error:', err);
    }
  };

  const handleApplyToAll = async () => {
    setIsProcessing(true);
    const updated: Pin[] = [];
    const now = new Date().toISOString();

    for (const pin of pins) {
      try {
        const transformedUrl = await applyWatermarkToImage(pin.imageUrl, {
          type,
          text,
          watermarkDataUrl: watermarkLogoData || undefined,
          position,
          opacity,
          bgColor: useBgPill ? 'rgba(0, 0, 0, 0.45)' : undefined,
        });

        updated.push({
          ...pin,
          imageUrl: transformedUrl,
          thumbnailUrl: transformedUrl,
          updatedAt: now,
        });
      } catch (err) {
        console.error(`Failed to watermark ${pin.filename}:`, err);
        updated.push(pin);
      }
    }

    setIsProcessing(false);
    onApplyWatermark(updated);
    onClose();
  };

  if (!isOpen || pins.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#F7F7F9]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E60023] text-white flex items-center justify-center shadow-xs">
              <Stamp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Batch Watermark & Branding</h2>
              <p className="text-xs text-slate-500 font-medium">
                Apply copyright, branding logo, or website tag onto {pins.length} Pin{pins.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-y-auto">
          {/* Controls (7 Cols) */}
          <div className="md:col-span-7 space-y-4">
            {/* Watermark Type Selector */}
            <div className="flex bg-[#F7F7F9] p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setType('text')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  type === 'text' ? 'bg-white text-[#E60023] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Type className="w-3.5 h-3.5" /> Text / Domain Watermark
              </button>
              <button
                type="button"
                onClick={() => setType('image')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  type === 'image' ? 'bg-white text-[#E60023] shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Logo Stamp
              </button>
            </div>

            {type === 'text' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Watermark Text</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. @pinteresthandle or myblog.com"
                  className="w-full text-xs font-semibold p-3 bg-[#F7F7F9] border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Upload Transparent Logo (PNG)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#E60023] rounded-xl p-4 text-center cursor-pointer bg-[#F7F7F9] transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  {watermarkLogoData ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600">
                      <Check className="w-4 h-4" /> Logo loaded successfully
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
                      <Upload className="w-4 h-4 text-[#E60023]" /> Choose PNG Logo
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Position Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Stamp Position</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                {[
                  { id: 'top-left', label: 'Top Left' },
                  { id: 'top-right', label: 'Top Right' },
                  { id: 'center', label: 'Center' },
                  { id: 'bottom-left', label: 'Bottom Left' },
                  { id: 'bottom-center', label: 'Bottom Center' },
                  { id: 'bottom-right', label: 'Bottom Right' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setPosition(pos.id as any)}
                    className={`py-2 px-2 rounded-xl border transition-all cursor-pointer ${
                      position === pos.id
                        ? 'bg-red-50 border-red-200 text-[#E60023] font-bold'
                        : 'bg-[#F7F7F9] border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Opacity</span>
                <span className="font-mono">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-[#E60023] cursor-pointer"
              />
            </div>

            {type === 'text' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="usePill"
                  checked={useBgPill}
                  onChange={(e) => setUseBgPill(e.target.checked)}
                  className="w-4 h-4 text-[#E60023] rounded border-slate-300 focus:ring-[#E60023]"
                />
                <label htmlFor="usePill" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Add high-contrast background pill
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={generatePreview}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Update Preview</span>
            </button>
          </div>

          {/* Live Preview Column (5 Cols) */}
          <div className="md:col-span-5 bg-[#F7F7F9] rounded-2xl p-4 border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Preview on Sample Pin
            </span>
            <div className="w-44 aspect-[2/3] bg-white rounded-xl overflow-hidden shadow-md border border-slate-200 relative">
              <img
                src={previewDataUrl || previewPin?.imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">
              Will be applied across {pins.length} pins
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
            onClick={handleApplyToAll}
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] disabled:opacity-50 px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Watermarking...' : `Apply to ${pins.length} Pins`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
