import React, { useState } from 'react';
import { 
  X, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  RotateCw,
  Code,
  Sparkles,
  Layers
} from 'lucide-react';
import { runMetadataCleanerTestSuite, TestSuiteSummary } from '../../services/metadataCleanerTests';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<TestSuiteSummary | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await runMetadataCleanerTestSuite();
      setSummary(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-white/95 dark:bg-black/90 dark:backdrop-blur-2xl w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-white/[0.04] border border-indigo-200 dark:border-white/[0.08] flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Metadata Engine Regression Test Suite
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated 18-stage regression test suite for Privacy Classification, Binary Stripping & Independent Re-Parse Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08]">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Verify Pipeline Integrity & Privacy Rules
              </div>
              <div className="text-xs text-slate-500">
                Validates Date/Time, Camera, MakerNotes, Unique IDs, Thumbnails, Orientation, Regions, Software History, Copyright, ICC, Container, and Real End-to-End Binary Re-Parse.
              </div>
            </div>
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {isRunning ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Running Tests...' : 'Run All 18 Tests'}</span>
            </button>
          </div>

          {/* Test Results */}
          {summary && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08]">
                  <div className="text-[11px] text-slate-500 font-semibold">Total Cases</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{summary.total}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Passed</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{summary.passed} / {summary.total}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08]">
                  <div className="text-[11px] text-slate-500 font-semibold">Duration</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{summary.durationMs}ms</div>
                </div>
              </div>

              {/* Individual Case Cards */}
              <div className="space-y-3">
                {summary.results.map((t) => (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border transition-all ${
                      t.passed
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {t.passed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {t.name}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {t.description}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono border ${
                        t.passed
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                      }`}>
                        {t.passed ? 'PASSED ✓' : 'FAILED ✗'}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-white/60 dark:bg-black/60 border border-slate-200/50 dark:border-white/[0.06]">
                        <span className="text-[10px] text-slate-400 uppercase block">Expected</span>
                        <span className="text-slate-700 dark:text-slate-300">{t.expected}</span>
                      </div>
                      <div className="p-2 rounded bg-white/60 dark:bg-black/60 border border-slate-200/50 dark:border-white/[0.06]">
                        <span className="text-[10px] text-slate-400 uppercase block">Actual Result</span>
                        <span className={t.passed ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                          {t.actual}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!summary && (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
              <ShieldCheck className="w-10 h-10 text-indigo-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Ready to execute regression verification tests
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click the button above to run the automated regression test cases validating ICC isolation, EXIF camera separation, GPS parsing, and object formatting.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Automated verification engine
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/[0.06] hover:bg-slate-300 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
