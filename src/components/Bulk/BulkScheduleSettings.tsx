import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  ChevronDown, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Shuffle, 
  RotateCcw, 
  Eye, 
  CalendarDays, 
  Layers,
  Sparkles,
  Info,
  CalendarCheck,
  CalendarRange,
  ArrowRight
} from 'lucide-react';
import { Pin, Board } from '../../types';
import { 
  BulkScheduleConfig, 
  BulkSchedulePreview, 
  calculateBulkSchedulePreview,
  pad2,
  Weekday,
  PublishIntervalPreset,
  CsvTimeFormat,
  getIntervalInMinutes
} from '../../services/bulkScheduleService';

interface BulkScheduleSettingsProps {
  pins: Pin[];
  boards: Board[];
  config: BulkScheduleConfig;
  onChange: (newConfig: BulkScheduleConfig) => void;
  preview: BulkSchedulePreview;
  onPreviewToggle?: () => void;
  isPreviewOpen?: boolean;
}

const INTERVAL_PRESETS: Array<{ id: PublishIntervalPreset; label: string }> = [
  { id: '15m', label: '15 minutes' },
  { id: '30m', label: '30 minutes' },
  { id: '1h', label: '1 hour' },
  { id: '2h', label: '2 hours' },
  { id: '3h', label: '3 hours' },
  { id: '4h', label: '4 hours' },
  { id: '6h', label: '6 hours' },
  { id: '12h', label: '12 hours' },
  { id: '1d', label: '1 day' },
  { id: 'custom', label: 'Custom interval...' },
];

const WEEKDAYS: Array<{ id: Weekday; label: string; short: string }> = [
  { id: 'mon', label: 'Monday', short: 'Mon' },
  { id: 'tue', label: 'Tuesday', short: 'Tue' },
  { id: 'wed', label: 'Wednesday', short: 'Wed' },
  { id: 'thu', label: 'Thursday', short: 'Thu' },
  { id: 'fri', label: 'Friday', short: 'Fri' },
  { id: 'sat', label: 'Saturday', short: 'Sat' },
  { id: 'sun', label: 'Sunday', short: 'Sun' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const BulkScheduleSettings: React.FC<BulkScheduleSettingsProps> = ({
  pins,
  boards,
  config,
  onChange,
  preview,
}) => {
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const boardMap = useMemo(() => new Map(boards.map(b => [b.id, b.name])), [boards]);
  const hasExistingDates = useMemo(() => pins.some(p => Boolean(p.scheduledAt || p.publishedAt)), [pins]);
  const existingDatesCount = useMemo(() => pins.filter(p => Boolean(p.scheduledAt || p.publishedAt)).length, [pins]);

  // Quick Action to extend date range automatically to fit all pins
  const handleExtendRange = () => {
    if (!config.startDate) return;
    const startParts = config.startDate.split('-').map(Number);
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const intervalMin = getIntervalInMinutes(config);
    const totalMinutesNeeded = pins.length * intervalMin;
    const daysNeeded = Math.ceil(totalMinutesNeeded / (12 * 60)) + 3; // buffer

    const newEnd = new Date(start.getTime() + daysNeeded * 24 * 60 * 60 * 1000);
    const newEndStr = `${newEnd.getFullYear()}-${pad2(newEnd.getMonth() + 1)}-${pad2(newEnd.getDate())}`;

    onChange({
      ...config,
      endDate: newEndStr,
      continueFollowingDays: true,
    });
  };

  // Quick Action to reduce interval
  const handleReduceInterval = () => {
    onChange({
      ...config,
      intervalPreset: '15m',
    });
  };

  // Quick Action to enable auto-continuation
  const handleEnableContinuation = () => {
    onChange({
      ...config,
      continueFollowingDays: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Main Toggle: No scheduling vs Schedule all Pins */}
      <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-[#E60023]" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Bulk Scheduling
            </span>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            {config.enabled ? `${preview.assignedCount} / ${pins.length} slots assigned` : 'Disabled'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label 
            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
              !config.enabled 
                ? 'bg-white dark:bg-black/80 border-[#E60023] shadow-xs' 
                : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]'
            }`}
          >
            <input
              type="radio"
              name="bulk_schedule_mode"
              checked={!config.enabled}
              onChange={() => onChange({ ...config, enabled: false })}
              className="text-[#E60023] focus:ring-[#E60023] w-4 h-4"
            />
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              No scheduling
              <div className="text-[11px] font-normal text-slate-500">Leave Publish date blank or as-is</div>
            </div>
          </label>

          <label 
            className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
              config.enabled 
                ? 'bg-white dark:bg-black/80 border-[#E60023] shadow-xs' 
                : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]'
            }`}
          >
            <input
              type="radio"
              name="bulk_schedule_mode"
              checked={config.enabled}
              onChange={() => onChange({ ...config, enabled: true })}
              className="text-[#E60023] focus:ring-[#E60023] w-4 h-4"
            />
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Schedule all Pins
              <div className="text-[11px] font-normal text-slate-500">Generate unique 12-hour publish times</div>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Expanded Schedule Controls */}
      {config.enabled && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Quick Schedule Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const startIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 30, 0, 0);
                const endIso = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
                onChange({
                  ...config,
                  startDate: startIso,
                  startTimeHour: 12,
                  startTimeMinute: 0,
                  startTimeAmPm: 'AM',
                  endDate: endIso,
                  endTimeHour: 11,
                  endTimeMinute: 30,
                  endTimeAmPm: 'PM',
                  intervalPreset: '30m',
                  customIntervalValue: 30,
                  customIntervalUnit: 'minutes',
                  timeFormat: '12h',
                  repeatDaily: true,
                  continueFollowingDays: true,
                });
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg hover:border-[#E60023] hover:text-[#E60023] cursor-pointer transition-colors shadow-2xs"
            >
              Full Day 24h (12:00 AM - 11:30 PM, 48 slots/day)
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const startIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 21, 0, 0, 0);
                const endIso = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
                onChange({
                  ...config,
                  startDate: startIso,
                  startTimeHour: 9,
                  startTimeMinute: 0,
                  startTimeAmPm: 'AM',
                  endDate: endIso,
                  endTimeHour: 9,
                  endTimeMinute: 0,
                  endTimeAmPm: 'PM',
                  intervalPreset: '30m',
                  customIntervalValue: 30,
                  customIntervalUnit: 'minutes',
                  timeFormat: '12h',
                  repeatDaily: true,
                  continueFollowingDays: true,
                });
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
            >
              Daytime (09:00 AM - 09:00 PM)
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const startIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 0, 0, 0);
                const endIso = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
                onChange({
                  ...config,
                  startDate: startIso,
                  startTimeHour: 12,
                  startTimeMinute: 0,
                  startTimeAmPm: 'AM',
                  endDate: endIso,
                  endTimeHour: 11,
                  endTimeMinute: 0,
                  endTimeAmPm: 'PM',
                  intervalPreset: '2h',
                  customIntervalValue: 2,
                  customIntervalUnit: 'hours',
                  timeFormat: '12h',
                  repeatDaily: true,
                  continueFollowingDays: true,
                });
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
            >
              Every 2 Hours (12 slots/day)
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const startIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 21, 0, 0, 0);
                const endIso = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
                onChange({
                  ...config,
                  startDate: startIso,
                  startTimeHour: 9,
                  startTimeMinute: 0,
                  startTimeAmPm: 'PM',
                  endDate: endIso,
                  endTimeHour: 9,
                  endTimeMinute: 0,
                  endTimeAmPm: 'PM',
                  intervalPreset: '1d',
                  timeFormat: '12h',
                  repeatDaily: true,
                  continueFollowingDays: true,
                });
              }}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-black/60 border border-red-200 dark:border-red-900/60 text-[#E60023] rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
            >
              1 Pin Daily at 9:00 PM
            </button>
          </div>

          {/* Date & Time Range Matrix (12-Hour format) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl">
            {/* Start Date & Time */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#E60023]" />
                <span>Start Date & Daily Start Time</span>
              </label>

              <div className="space-y-1.5">
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(e) => onChange({ ...config, startDate: e.target.value })}
                  className="w-full text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E60023] outline-hidden"
                />

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <select
                      value={config.startTimeHour}
                      onChange={(e) => onChange({ ...config, startTimeHour: Number(e.target.value) })}
                      aria-label="Start time hour"
                      className="w-full appearance-none text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-2 text-slate-900 dark:text-white pr-6 focus:ring-2 focus:ring-[#E60023] outline-hidden"
                    >
                      {HOURS.map((h) => (
                        <option key={`start-h-${h}`} value={h} className="bg-white dark:bg-black text-slate-900 dark:text-white">
                          {pad2(h)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  <span className="text-slate-400 font-bold">:</span>

                  <div className="relative flex-1">
                    <select
                      value={config.startTimeMinute}
                      onChange={(e) => onChange({ ...config, startTimeMinute: Number(e.target.value) })}
                      aria-label="Start time minute"
                      className="w-full appearance-none text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-2 text-slate-900 dark:text-white pr-6 focus:ring-2 focus:ring-[#E60023] outline-hidden"
                    >
                      {MINUTES.map((m) => (
                        <option key={`start-m-${m}`} value={m} className="bg-white dark:bg-black text-slate-900 dark:text-white">
                          {pad2(m)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  <div className="flex rounded-xl bg-slate-200 dark:bg-white/[0.06] p-0.5 border border-slate-300 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, startTimeAmPm: 'AM' })}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        config.startTimeAmPm === 'AM'
                          ? 'bg-white dark:bg-black/90 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, startTimeAmPm: 'PM' })}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        config.startTimeAmPm === 'PM'
                          ? 'bg-white dark:bg-black/90 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* End Date & Time */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>End Date & Daily End Time</span>
              </label>

              <div className="space-y-1.5">
                <input
                  type="date"
                  value={config.endDate}
                  onChange={(e) => onChange({ ...config, endDate: e.target.value })}
                  className="w-full text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E60023] outline-hidden"
                />

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <select
                      value={config.endTimeHour}
                      onChange={(e) => onChange({ ...config, endTimeHour: Number(e.target.value) })}
                      aria-label="End time hour"
                      className="w-full appearance-none text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-2 text-slate-900 dark:text-white pr-6 focus:ring-2 focus:ring-[#E60023] outline-hidden"
                    >
                      {HOURS.map((h) => (
                        <option key={`end-h-${h}`} value={h} className="bg-white dark:bg-black text-slate-900 dark:text-white">
                          {pad2(h)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  <span className="text-slate-400 font-bold">:</span>

                  <div className="relative flex-1">
                    <select
                      value={config.endTimeMinute}
                      onChange={(e) => onChange({ ...config, endTimeMinute: Number(e.target.value) })}
                      aria-label="End time minute"
                      className="w-full appearance-none text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-2 text-slate-900 dark:text-white pr-6 focus:ring-2 focus:ring-[#E60023] outline-hidden"
                    >
                      {MINUTES.map((m) => (
                        <option key={`end-m-${m}`} value={m} className="bg-white dark:bg-black text-slate-900 dark:text-white">
                          {pad2(m)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  <div className="flex rounded-xl bg-slate-200 dark:bg-white/[0.06] p-0.5 border border-slate-300 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, endTimeAmPm: 'AM' })}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        config.endTimeAmPm === 'AM'
                          ? 'bg-white dark:bg-black/90 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, endTimeAmPm: 'PM' })}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        config.endTimeAmPm === 'PM'
                          ? 'bg-white dark:bg-black/90 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Publish Interval Selection */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#E60023]" />
                <span>Publish interval</span>
              </label>

              <span className="text-[11px] font-mono text-slate-500">
                {preview.intervalMinutes} min between pins
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <select
                  value={config.intervalPreset}
                  onChange={(e) => onChange({ ...config, intervalPreset: e.target.value as PublishIntervalPreset })}
                  aria-label="Publish interval preset"
                  className="w-full appearance-none text-xs font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-slate-900 dark:text-white pr-8 focus:ring-2 focus:ring-[#E60023] outline-hidden cursor-pointer"
                >
                  {INTERVAL_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id} className="bg-white dark:bg-black text-slate-900 dark:text-white">
                      {preset.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Custom Interval Inputs */}
              {config.intervalPreset === 'custom' && (
                <div className="flex items-center gap-2 animate-in fade-in duration-100">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={config.customIntervalValue}
                    onChange={(e) => onChange({ ...config, customIntervalValue: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-20 text-xs font-mono font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E60023] outline-hidden"
                  />
                  <div className="relative flex-1">
                    <select
                      value={config.customIntervalUnit}
                      onChange={(e) => onChange({ ...config, customIntervalUnit: e.target.value as 'minutes' | 'hours' })}
                      aria-label="Custom interval unit"
                      className="w-full appearance-none text-xs font-bold bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-slate-900 dark:text-white pr-8 focus:ring-2 focus:ring-[#E60023] outline-hidden"
                    >
                      <option value="minutes" className="bg-white dark:bg-black text-slate-900 dark:text-white">minutes</option>
                      <option value="hours" className="bg-white dark:bg-black text-slate-900 dark:text-white">hours</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Export Time Format (12h AM/PM vs 24h) */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#E60023]" />
                <span>Export Time Format (Publish date column)</span>
              </label>

              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/80 text-[#E60023] font-bold">
                12h AM/PM Format
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                (config.timeFormat || '12h') === '12h'
                  ? 'bg-white dark:bg-black/80 border-[#E60023] text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="csv_time_format"
                    checked={(config.timeFormat || '12h') === '12h'}
                    onChange={() => onChange({ ...config, timeFormat: '12h' })}
                    className="text-[#E60023] focus:ring-[#E60023]"
                  />
                  <span>12-Hour Standard</span>
                </div>
                <div className="text-[11px] font-mono font-normal text-emerald-600 dark:text-emerald-400 pl-5 pt-1">
                  2026-08-25 09:30 AM
                </div>
              </label>

              <label className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                config.timeFormat === '12h_us'
                  ? 'bg-white dark:bg-black/80 border-[#E60023] text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="csv_time_format"
                    checked={config.timeFormat === '12h_us'}
                    onChange={() => onChange({ ...config, timeFormat: '12h_us' })}
                    className="text-[#E60023] focus:ring-[#E60023]"
                  />
                  <span>12-Hour US</span>
                </div>
                <div className="text-[11px] font-mono font-normal text-slate-500 dark:text-slate-400 pl-5 pt-1">
                  08/25/2026 09:30 AM
                </div>
              </label>

              <label className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                config.timeFormat === '24h'
                  ? 'bg-white dark:bg-black/80 border-[#E60023] text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="csv_time_format"
                    checked={config.timeFormat === '24h'}
                    onChange={() => onChange({ ...config, timeFormat: '24h' })}
                    className="text-[#E60023] focus:ring-[#E60023]"
                  />
                  <span>24-Hour Military</span>
                </div>
                <div className="text-[11px] font-mono font-normal text-slate-500 dark:text-slate-400 pl-5 pt-1">
                  2026-08-25 09:30
                </div>
              </label>
            </div>
          </div>

          {/* 5. Scheduling Options & Continuation */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Schedule Behavior
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.repeatDaily}
                  onChange={(e) => onChange({ ...config, repeatDaily: e.target.checked })}
                  className="mt-0.5 text-[#E60023] focus:ring-[#E60023] rounded-md w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Repeat daily schedule
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Creates time slots between {pad2(config.startTimeHour)}:{pad2(config.startTimeMinute)} {config.startTimeAmPm} and {pad2(config.endTimeHour)}:{pad2(config.endTimeMinute)} {config.endTimeAmPm} each selected day
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.continueFollowingDays}
                  onChange={(e) => onChange({ ...config, continueFollowingDays: e.target.checked })}
                  className="mt-0.5 text-[#E60023] focus:ring-[#E60023] rounded-md w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Continue into following days if necessary
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Automatically continues scheduling onto subsequent days until all {pins.length} Pins have unique time slots
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={config.randomizeOrder}
                  onChange={(e) => onChange({ ...config, randomizeOrder: e.target.checked })}
                  className="mt-0.5 text-[#E60023] focus:ring-[#E60023] rounded-md w-4 h-4 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Shuffle className="w-3 h-3 text-purple-500" />
                    <span>Randomize Pin order</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Randomizes which Pin receives each time slot while keeping all times chronologically ordered
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 5. Weekday Filter */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-[#E60023]" />
                <span>Schedule on days of week:</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({
                    ...config,
                    allowedWeekdays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
                  })}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Weekdays only
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => onChange({
                    ...config,
                    allowedWeekdays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
                  })}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  All days
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {WEEKDAYS.map((w) => {
                const isChecked = config.allowedWeekdays[w.id];
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onChange({
                      ...config,
                      allowedWeekdays: {
                        ...config.allowedWeekdays,
                        [w.id]: !isChecked,
                      },
                    })}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer text-center ${
                      isChecked 
                        ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-[#E60023] dark:text-red-400 font-extrabold shadow-2xs' 
                        : 'bg-white dark:bg-black/60 border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    {w.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Existing Publish Dates Handling */}
          {hasExistingDates && (
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Existing publish dates detected ({existingDatesCount} Pins have dates)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  config.existingDatesMode === 'keep'
                    ? 'bg-white dark:bg-black/80 border-amber-400 text-amber-950 dark:text-white font-bold shadow-xs'
                    : 'bg-white/40 dark:bg-white/[0.02] border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="existing_dates_mode"
                      checked={config.existingDatesMode === 'keep'}
                      onChange={() => onChange({ ...config, existingDatesMode: 'keep' })}
                      className="text-[#E60023] focus:ring-[#E60023]"
                    />
                    <span>Keep existing dates</span>
                  </div>
                  <div className="text-[10px] font-normal text-slate-500 pl-5 pt-0.5">
                    Only schedule pins without dates
                  </div>
                </label>

                <label className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  config.existingDatesMode === 'replace'
                    ? 'bg-white dark:bg-black/80 border-amber-400 text-amber-950 dark:text-white font-bold shadow-xs'
                    : 'bg-white/40 dark:bg-white/[0.02] border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="existing_dates_mode"
                      checked={config.existingDatesMode === 'replace'}
                      onChange={() => onChange({ ...config, existingDatesMode: 'replace' })}
                      className="text-[#E60023] focus:ring-[#E60023]"
                    />
                    <span>Replace all dates</span>
                  </div>
                  <div className="text-[10px] font-normal text-slate-500 pl-5 pt-0.5">
                    Assign new slots to all pins
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 7. Insufficient Slots Warning & Quick Fixes */}
          {preview.hasInsufficientSlots && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-red-950 dark:text-red-200">
                    Not enough scheduling slots.
                  </div>
                  <div className="text-xs text-red-800 dark:text-red-300">
                    {preview.slotsNeeded} Pins need to be scheduled, but only {preview.availableSlotsCount} time slots are available.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExtendRange}
                  className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-black/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/80 cursor-pointer transition-colors"
                >
                  [ Extend date range ]
                </button>
                <button
                  type="button"
                  onClick={handleReduceInterval}
                  className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-black/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/80 cursor-pointer transition-colors"
                >
                  [ Reduce interval ]
                </button>
                <button
                  type="button"
                  onClick={handleEnableContinuation}
                  className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 cursor-pointer shadow-xs transition-colors"
                >
                  [ Automatically continue scheduling into following days ]
                </button>
              </div>
            </div>
          )}

          {/* 8. Preview Trigger Bar */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {preview.isValid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>✓ {preview.assignedCount} Pins scheduled ({preview.assignedCount} unique slots)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Scheduling incomplete</span>
                  </>
                )}
              </div>
              {preview.firstSlot && preview.lastSlot && (
                <div className="text-[11px] text-slate-500 font-mono">
                  {preview.firstSlot.formattedDisplay} → {preview.lastSlot.formattedDisplay}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-[#E60023]" />
              <span>[ Preview Schedule ]</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Full Scheduling Inspector Preview */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
          <div className="bg-white/95 dark:bg-black/95 dark:backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-white/[0.08] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col transition-colors">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/60 text-[#E60023] flex items-center justify-center font-bold">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Scheduling Preview
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {preview.assignedCount} Pins • {preview.intervalMinutes} min interval
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] grid grid-cols-2 gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
              <div>
                <span className="text-slate-400">Start: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {preview.firstSlot ? preview.firstSlot.formattedDisplay : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">End: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {preview.lastSlot ? preview.lastSlot.formattedDisplay : 'N/A'}
                </span>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
              {preview.assignments.map((item) => (
                <div key={item.pin.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-red-500 w-12">Pin #{item.pinNumber}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      {item.boardId && (
                        <div className="text-[11px] text-slate-400">
                          Board: {boardMap.get(item.boardId) || item.boardId}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.slot ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-[11px]">
                          <Clock className="w-3 h-3 text-emerald-500" />
                          <span>
                            {config.timeFormat === '12h_us'
                              ? item.slot.formattedCsv12hUs
                              : config.timeFormat === '24h'
                              ? item.slot.formattedCsv24h
                              : item.slot.formattedCsv12h}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          CSV: {config.timeFormat === '12h_us'
                            ? item.slot.formattedCsv12hUs
                            : config.timeFormat === '24h'
                            ? item.slot.formattedCsv24h
                            : item.slot.formattedCsv12h}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-500 font-mono font-bold">
                        Unscheduled
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ {preview.assignedCount} unique time slots assigned</span>
              </span>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-xs font-bold px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
