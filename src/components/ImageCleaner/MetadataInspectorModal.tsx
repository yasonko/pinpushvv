import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  MapPin, 
  Camera, 
  FileText, 
  Calendar, 
  User, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Info,
  Palette,
  Layers,
  Code
} from 'lucide-react';
import { CleanedImageItem, NormalizedMetadataEntry } from '../../types/imageCleaner';

interface MetadataInspectorModalProps {
  item: CleanedImageItem | null;
  onClose: () => void;
}

export const MetadataInspectorModal: React.FC<MetadataInspectorModalProps> = ({ item, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'camera' | 'gps' | 'iptc' | 'xmp' | 'icc' | 'container' | 'all' | 'debug'>('overview');

  if (!item) return null;

  const before = item.metadataBefore;
  const after = item.metadataAfter;
  const diff = item.metadataDiff;
  const verification = item.verification;

  const getEntriesByCategory = (category: string): NormalizedMetadataEntry[] => {
    if (!before?.normalizedEntries) return [];
    if (category === 'camera') {
      return before.normalizedEntries.filter(e => e.category === 'EXIF_CAMERA');
    }
    if (category === 'gps') {
      return before.normalizedEntries.filter(e => e.category === 'EXIF_GPS');
    }
    if (category === 'iptc') {
      return before.normalizedEntries.filter(e => e.category === 'IPTC');
    }
    if (category === 'xmp') {
      return before.normalizedEntries.filter(e => e.category === 'XMP' || e.category === 'XMP_PROVENANCE');
    }
    if (category === 'icc') {
      return before.normalizedEntries.filter(e => e.category === 'ICC_COLOR_PROFILE');
    }
    if (category === 'container') {
      return before.normalizedEntries.filter(e => e.category === 'CONTAINER_STRUCTURE');
    }
    return before.normalizedEntries.filter(e => e.category !== 'INTERNAL_RAW');
  };

  const isProcessed = item.status === 'success' || item.status === 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-white/95 dark:bg-black/90 dark:backdrop-blur-2xl w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-white/[0.04] border border-indigo-200 dark:border-white/[0.08] flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Metadata Inspector & Privacy Audit
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-mono">
                  {item.originalFile.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Strict classification: Camera, GPS, IPTC, XMP, ICC Color Profile, and Container Structure
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 border-b border-slate-200 dark:border-white/[0.08] bg-white/50 dark:bg-transparent overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Audit', count: before?.totalFieldCount || 0 },
            { id: 'camera', label: 'Camera & Lens', count: getEntriesByCategory('camera').length },
            { id: 'gps', label: 'GPS / Location', count: getEntriesByCategory('gps').length },
            { id: 'iptc', label: 'IPTC Personal', count: before?.iptcCount || 0 },
            { id: 'xmp', label: 'XMP Schema', count: before?.xmpCount || 0 },
            { id: 'icc', label: 'ICC Color Profile', count: before?.iccCount || 0 },
            { id: 'container', label: 'Container Structure', count: before?.containerCount || 0 },
            { id: 'all', label: 'All Normalized Entries', count: before?.normalizedEntries?.length || 0 },
            { id: 'debug', label: 'Debug Inspector', count: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && tab.id !== 'debug' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-mono">
                  {tab.count}
                </span>
              )}
              {tab.id === 'debug' && (
                <Code className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Diff Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08]">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Original Metadata
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {before?.totalFieldCount || 0}
                    <span className="text-xs font-normal text-slate-500 ml-1">total fields</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-0.5 font-mono">
                    <div>Camera: {before?.hasCameraInfo ? `${before.cameraFields.length} tags` : 'None'}</div>
                    <div>GPS: {before?.hasGps ? 'Present ⚠️' : 'None'}</div>
                    <div>IPTC: {before?.iptcCount || 0} | XMP: {before?.xmpCount || 0}</div>
                    <div>ICC Profile: {before?.hasIccProfile ? 'Present' : 'None'}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
                  <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                    Cleaned & Stripped
                  </div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {diff ? diff.fieldsRemovedList.length : 0}
                    <span className="text-xs font-normal text-indigo-600/70 ml-1">fields stripped</span>
                  </div>
                  <div className="mt-2 text-xs text-indigo-700 dark:text-indigo-300 space-y-0.5 font-mono">
                    <div>EXIF / Camera: {diff ? `${diff.exifRemoved} stripped` : '0'}</div>
                    <div>IPTC / XMP: {diff ? `${diff.iptcRemoved + diff.xmpRemoved} stripped` : '0'}</div>
                    <div>GPS: {diff?.gpsRemoved ? 'Stripped ✓' : 'Clean'}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                    Output Verification
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {isProcessed ? (item.status === 'success' ? '✓ Requested Cleanup Verified' : '⚠ Processed with warnings') : 'Pending'}
                  </div>
                  <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300 space-y-0.5 font-mono">
                    <div>Camera Verified: {verification?.cameraCleanupVerified ? 'Clean ✓' : 'Retained ⚠️'}</div>
                    <div>GPS Verified: {verification?.gpsCleanupVerified ? 'Clean ✓' : 'Retained ⚠️'}</div>
                    <div>ICC Profile: {verification?.iccStatus === 'preserved' ? 'Preserved (Expected)' : verification?.iccStatus === 'removed' ? 'Removed ✓' : 'None'}</div>
                  </div>
                </div>
              </div>

              {/* Before vs After Comparison Table */}
              <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Category Audit Delta (Before → After)
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {diff?.fieldsRemovedList.length || 0} Total Changes
                  </span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/[0.06] text-xs">
                  {/* Camera Make/Model/Lens */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <Camera className="w-4 h-4 text-blue-500" />
                      <span>Camera Make, Model, Lens & Hardware</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-transparent dark:border-white/[0.06]">
                        {before?.cameraFields && before.cameraFields.length > 0
                          ? `${before.cameraFields.length} field${before.cameraFields.length > 1 ? 's' : ''}`
                          : 'None'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className={`px-2 py-0.5 rounded font-bold border ${
                        isProcessed && after?.cameraFields && after.cameraFields.length > 0
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : isProcessed
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                          : 'bg-slate-100 dark:bg-white/[0.04] text-slate-500 border-transparent'
                      }`}>
                        {isProcessed
                          ? after?.cameraFields && after.cameraFields.length > 0
                            ? `Retained ⚠️ (${after.cameraFields.length})`
                            : 'Removed ✓'
                          : 'Removed (target)'}
                      </span>
                    </div>
                  </div>

                  {/* GPS Coordinates */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span>GPS Coordinates & Altitude</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className={`px-2 py-0.5 rounded border ${before?.hasGps ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold' : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-transparent'}`}>
                        {before?.hasGps ? 'Present ⚠️' : 'None'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">
                        {isProcessed ? (after?.hasGps ? 'Retained ⚠️' : 'Removed ✓') : 'Removed (target)'}
                      </span>
                    </div>
                  </div>

                  {/* IPTC Creator & Byline */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <User className="w-4 h-4 text-indigo-500" />
                      <span>IPTC Creator, Contact & Byline</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-transparent dark:border-white/[0.06]">
                        {before?.iptcCount || 0} fields
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">
                        {isProcessed ? (after?.iptcCount || 0) : '0'} fields
                      </span>
                    </div>
                  </div>

                  {/* XMP Schema */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span>XMP Schema & Editing History</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-transparent dark:border-white/[0.06]">
                        {before?.xmpCount || 0} fields
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">
                        {isProcessed ? (after?.xmpCount || 0) : '0'} fields
                      </span>
                    </div>
                  </div>

                  {/* ICC Color Profile */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <Palette className="w-4 h-4 text-purple-500" />
                      <span>Color Profile / ICC</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-transparent dark:border-white/[0.06]">
                        {before?.hasIccProfile ? (before.iccProfileDescription || `${before.iccCount} tags`) : 'None'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 font-semibold border border-transparent dark:border-white/[0.06]">
                        {isProcessed
                          ? verification?.iccStatus === 'preserved'
                            ? 'Preserved (Remove ICC disabled)'
                            : verification?.iccStatus === 'removed'
                            ? 'Removed ✓'
                            : 'None'
                          : 'Preserved (default)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Exact Retained Camera / Sensitive Alert in Modal */}
              {isProcessed && diff?.retainedCameraDescriptions && diff.retainedCameraDescriptions.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Retained Camera Metadata Post-Export ({diff.retainedCameraDescriptions.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {diff.retainedCameraDescriptions.map((desc, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 text-xs font-mono border border-amber-300 dark:border-amber-700"
                      >
                        {desc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific Extracted Values Box */}
              {before?.hasMetadata && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Detected Metadata Values in Original Image:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                    {before.cameraMake && <div>• Camera Make: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.cameraMake}</span></div>}
                    {before.cameraModel && <div>• Camera Model: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.cameraModel}</span></div>}
                    {before.lensInfo && <div>• Lens: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.lensInfo}</span></div>}
                    {before.software && <div>• Software: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.software}</span></div>}
                    {before.dateTime && <div>• Date/Time: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.dateTime}</span></div>}
                    {before.creator && <div>• Creator: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.creator}</span></div>}
                    {before.copyright && <div>• Copyright: <span className="font-semibold text-slate-800 dark:text-slate-200">{before.copyright}</span></div>}
                    {before.gpsCoordinates && <div>• GPS: <span className="font-semibold text-rose-600">{before.gpsCoordinates.stringified}</span></div>}
                    {before.iccProfileDescription && <div>• ICC Profile: <span className="font-semibold text-purple-600">{before.iccProfileDescription}</span></div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Debug Inspector Tab */}
          {activeTab === 'debug' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-700 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-white mb-1">Normalized Metadata Engine Audit</div>
                <div>Status: {item.status.toUpperCase()}</div>
                <div>Original Total Semantic Entries: {before?.totalFieldCount || 0}</div>
                <div>Original Raw Internal Packets: {before?.rawEntries?.length || 0}</div>
                <div>Output Total Semantic Entries: {after?.totalFieldCount || 0}</div>
                <div>Camera Cleanup Verified: {String(verification?.cameraCleanupVerified)}</div>
                <div>ICC Status: {verification?.iccStatus} {verification?.iccReason ? `(${verification.iccReason})` : ''}</div>
              </div>

              {/* RAW PARSER DATA (Distinct from Semantic Metadata) */}
              {before?.rawEntries && before.rawEntries.length > 0 && (
                <div className="space-y-2 p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500" />
                      <span>RAW PARSER DATA (Excluded from Semantic Counts)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-mono font-bold">
                      {before.rawEntries.length} raw packet{before.rawEntries.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                    Raw container byte streams (e.g. XMP raw packet/XML) retained solely for internal parser diagnostics. They do not trigger cleanup, warnings, or count as semantic fields.
                  </p>
                  <div className="space-y-2 pt-2">
                    {before.rawEntries.map((raw, rIdx) => (
                      <div key={rIdx} className="p-2.5 rounded-lg bg-white dark:bg-black/60 border border-amber-200/70 dark:border-amber-800/60 space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-amber-800 dark:text-amber-400">{raw.displayName || raw.key}</span>
                          <span className="text-[10px] text-slate-400">{raw.namespace}.{raw.key} • INTERNAL_RAW</span>
                        </div>
                        <pre className="p-2 bg-black text-slate-200 rounded text-[10px] font-mono overflow-x-auto max-h-36">
                          {String(raw.value)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  NORMALIZED SEMANTIC METADATA (Before: {before?.normalizedEntries?.length || 0}):
                </div>
                <pre className="p-3 bg-black text-slate-200 border border-white/[0.08] rounded-xl text-[11px] font-mono overflow-x-auto max-h-60">
                  {JSON.stringify(
                    before?.normalizedEntries?.map(e => ({
                      category: e.category,
                      namespace: e.namespace,
                      key: e.key,
                      value: e.value,
                      valueType: e.valueType,
                      source: e.source,
                    })) || [],
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  NORMALIZED SEMANTIC METADATA (After: {after?.normalizedEntries?.length || 0}):
                </div>
                <pre className="p-3 bg-black text-slate-200 border border-white/[0.08] rounded-xl text-[11px] font-mono overflow-x-auto max-h-60">
                  {JSON.stringify(
                    after?.normalizedEntries?.map(e => ({
                      category: e.category,
                      namespace: e.namespace,
                      key: e.key,
                      value: e.value,
                      valueType: e.valueType,
                      source: e.source,
                    })) || [],
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Verification Report:
                </div>
                <pre className="p-3 bg-black text-emerald-400 border border-white/[0.08] rounded-xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(verification, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Individual Category Tabs */}
          {activeTab !== 'overview' && activeTab !== 'debug' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Showing normalized entries for category: <strong className="text-slate-800 dark:text-slate-200">{activeTab.toUpperCase()}</strong></span>
                <span className="font-mono">{getEntriesByCategory(activeTab).length} entries</span>
              </div>

              {getEntriesByCategory(activeTab).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 text-xs">
                  No {activeTab.toUpperCase()} metadata entries detected in this image.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08] text-slate-500">
                      <tr>
                        <th className="p-3 font-semibold">Namespace & Key</th>
                        <th className="p-3 font-semibold">Normalized Value</th>
                        <th className="p-3 font-semibold">Category</th>
                        <th className="p-3 font-semibold">Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                      {getEntriesByCategory(activeTab).map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                          <td className="p-3 font-medium text-slate-900 dark:text-white font-mono">
                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{entry.displayName || entry.key}</div>
                            <div className="text-[10px] text-slate-400">{entry.namespace}.{entry.key}</div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 break-all max-w-xs font-mono">
                            {String(entry.value)}
                          </td>
                          <td className="p-3 text-slate-400 uppercase font-mono text-[10px]">
                            {entry.category}
                          </td>
                          <td className="p-3">
                            {entry.category === 'XMP_PROVENANCE' ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold font-mono">
                                XMP_PROVENANCE
                              </span>
                            ) : entry.category === 'CONTAINER_STRUCTURE' ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 text-[10px] font-semibold font-mono border border-slate-200 dark:border-white/[0.06]">
                                CONTAINER_STRUCTURE
                              </span>
                            ) : entry.isPersonal ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                Personal / Privacy
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04] text-slate-500 text-[10px] border border-slate-200 dark:border-white/[0.06]">
                                Technical
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            <span>ExifReader strict namespace inspection with normalized metadata model</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
