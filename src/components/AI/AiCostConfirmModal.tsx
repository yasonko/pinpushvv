import React from 'react';
import { Sparkles, X, Info, Clock, ShieldCheck } from 'lucide-react';
import { Pin } from '../../types';

interface AiCostConfirmModalProps {
  pins: Pin[];
  language: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customPrompt?: string, provider?: string) => void;
  minDelay?: number;
  maxDelay?: number;
  initialCustomPrompt?: string;
  currentProvider?: string;
}

export const AiCostConfirmModal: React.FC<AiCostConfirmModalProps> = ({
  pins,
  language,
  isOpen,
  onClose,
  onConfirm,
  minDelay = 1,
  maxDelay = 1,
  initialCustomPrompt = '',
  currentProvider = 'groq',
}) => {
  const [customPrompt, setCustomPrompt] = React.useState(initialCustomPrompt);
  const [selectedProvider, setSelectedProvider] = React.useState(currentProvider);

  React.useEffect(() => {
    setCustomPrompt(initialCustomPrompt);
    setSelectedProvider(currentProvider);
  }, [initialCustomPrompt, currentProvider, isOpen]);

  if (!isOpen || pins.length === 0) return null;

  // Approximate time calculation with 1s delay
  const avgDelaySeconds = 1;
  const totalEstimatedSeconds = pins.length * (avgDelaySeconds + 2); // ~2s processing
  const estMinutes = Math.max(1, Math.round(totalEstimatedSeconds / 60));

  const promptSuggestions = [
    'Focus on DIY home improvement & budget tips',
    'Modern aesthetic decor & cozy room styling',
    'Trendy outfit inspiration & seasonal fashion',
    'Step-by-step tutorial & actionable advice',
    'Product review & gift guide inspiration',
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col transition-colors max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#F7F7F9] dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E60023] text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Start AI Analysis</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Batch Confirmation & Model Selection</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-white dark:bg-slate-900 overflow-y-auto">
          <div className="text-center space-y-1.5">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Analyze {pins.length} Pin{pins.length > 1 ? 's' : ''}?
            </h4>
          </div>
          
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Select AI Model</label>
            <select 
              value={selectedProvider} 
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="groq">Groq AI (Ultra Fast)</option>
              <option value="openrouter">OpenRouter (Multi-Model Gateway)</option>
              <option value="gemini">Google Gemini</option>
              <option value="pollinations">Pollinations AI</option>
              <option value="custom">Custom AI Endpoint</option>
            </select>
          </div>

          {/* Custom AI Prompt & Topic Field */}
          <div className="p-4 bg-red-50/40 dark:bg-red-950/20 rounded-2xl border border-red-200/80 dark:border-red-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
                <span>AI Topic & Prompt Guidance</span>
              </label>
            </div>

            <textarea
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Focus on decor..."
              className="w-full text-xs font-normal p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 resize-y leading-relaxed"
            />
          </div>

          {/* Stats */}
          <div className="bg-[#F7F7F9] dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Est. Time:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">~{estMinutes} min</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(customPrompt.trim() || undefined, selectedProvider);
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Start Batch ({pins.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
