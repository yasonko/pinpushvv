import React, { useState, useMemo } from 'react';
import { 
  X, 
  CalendarClock, 
  Plus, 
  Trash2, 
  FolderHeart, 
  Clock, 
  Calendar as CalendarIcon, 
  Check, 
  Globe, 
  Sparkles, 
  Info,
  RotateCcw
} from 'lucide-react';
import { Pin, Board, Website } from '../../types';
import { autoSchedulePins, schedulePinsByInterval, clearPinsSchedule } from '../../services/scheduler';

interface AutoScheduleModalProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  defaultPublishingTimes: string[];
  isOpen: boolean;
  onClose: () => void;
  onApplySchedule: (scheduledPins: Pin[]) => void;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  pins,
  boards,
  websites,
  defaultPublishingTimes,
  isOpen,
  onClose,
  onApplySchedule,
}) => {
  const [mode, setMode] = useState<'interval' | 'calendar'>('interval');

  // Interval Mode State
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  const defaultStartDate = now.toISOString().split('T')[0];
  const defaultStartTime = `${String(now.getHours()).padStart(2, '0')}:00`;

  const [intervalStartDate, setIntervalStartDate] = useState(defaultStartDate);
  const [intervalStartTime, setIntervalStartTime] = useState(defaultStartTime);
  const [intervalMinutes, setIntervalMinutes] = useState(30);

  // Calendar Mode State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultEndDate = new Date(tomorrow);
  defaultEndDate.setDate(defaultEndDate.getDate() + Math.max(7, Math.ceil(pins.length / 3)));

  const [calendarStartDate, setCalendarStartDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [calendarEndDate, setCalendarEndDate] = useState(defaultEndDate.toISOString().split('T')[0]);
  const [timeSlots, setTimeSlots] = useState<string[]>(
    defaultPublishingTimes.length > 0 ? defaultPublishingTimes : ['09:00', '13:00', '18:00']
  );
  const [newTimeInput, setNewTimeInput] = useState('15:00');
  const [skipWeekends, setSkipWeekends] = useState(false);

  // Common overrides
  const [boardId, setBoardId] = useState(pins[0]?.boardId || boards[0]?.id || '');
  const [destinationUrl, setDestinationUrl] = useState('');

  const addTimeSlot = () => {
    if (newTimeInput && !timeSlots.includes(newTimeInput)) {
      setTimeSlots(prev => [...prev, newTimeInput].sort());
    }
  };

  const removeTimeSlot = (time: string) => {
    setTimeSlots(prev => prev.filter(t => t !== time));
  };

  // Run Scheduling
  const handleRunSchedule = () => {
    if (mode === 'interval') {
      const scheduled = schedulePinsByInterval({
        pins,
        startDate: intervalStartDate,
        startTime: intervalStartTime,
        intervalMinutes,
        boardId: boardId || undefined,
        destinationUrl: destinationUrl || undefined,
      });
      onApplySchedule(scheduled);
    } else {
      const scheduled = autoSchedulePins({
        pins,
        startDate: calendarStartDate,
        endDate: calendarEndDate,
        times: timeSlots,
        boardId: boardId || undefined,
        destinationUrl: destinationUrl || undefined,
        skipWeekends,
      });
      onApplySchedule(scheduled);
    }
    onClose();
  };

  // Clear Schedule
  const handleClearSchedule = () => {
    const cleared = clearPinsSchedule(pins);
    onApplySchedule(cleared);
    onClose();
  };

  if (!isOpen || pins.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Pin Scheduler</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Distribute {pins.length} Pin{pins.length > 1 ? 's' : ''} across publishing slots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4 pb-2 bg-white dark:bg-slate-900 flex gap-2 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode('interval')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'interval'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Interval Spacing (e.g. Every 30 mins)
          </button>
          <button
            type="button"
            onClick={() => setMode('calendar')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'calendar'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Daily Slots (e.g. 3 slots/day)
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] bg-white dark:bg-slate-900">
          {mode === 'interval' ? (
            /* INTERVAL MODE */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={intervalStartDate}
                    onChange={(e) => setIntervalStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={intervalStartTime}
                    onChange={(e) => setIntervalStartTime(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Interval Between Pins
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setIntervalMinutes(mins)}
                      className={`text-xs font-bold py-2 rounded-xl border transition-all cursor-pointer ${
                        intervalMinutes === mins
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CALENDAR MODE */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={calendarStartDate}
                    onChange={(e) => setCalendarStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={calendarEndDate}
                    onChange={(e) => setCalendarEndDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Daily Slots</label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs font-mono px-2 py-1 rounded-lg"
                    >
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{time}</span>
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(time)}
                        className="text-slate-400 hover:text-rose-500 ml-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="time"
                      value={newTimeInput}
                      onChange={(e) => setNewTimeInput(e.target.value)}
                      className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={addTimeSlot}
                      className="p-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Optional Board & URL Overrides */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Target Board (Optional)</label>
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="">-- Keep Existing Board on each Pin --</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Destination URL (Optional)</label>
              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="Leave blank to keep existing URLs"
                className="w-full text-xs font-mono p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClearSchedule}
            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Schedule</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRunSchedule}
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <CalendarClock className="w-4 h-4" />
              <span>APPLY SCHEDULE ({pins.length} Pins)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
