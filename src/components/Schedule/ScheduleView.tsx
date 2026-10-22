import React, { useState, useMemo } from 'react';
import { 
  CalendarClock, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  List, 
  Clock, 
  Send, 
  FolderHeart, 
  Edit3
} from 'lucide-react';
import { Pin, Board, Website } from '../../types';

interface ScheduleViewProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  onUpdatePin: (pin: Pin) => void;
  onEditPin: (pin: Pin) => void;
  onOpenAutoSchedule: (pins: Pin[]) => void;
  onOpenUpload: () => void;
  onPublishPin: (pin: Pin) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  pins,
  boards,
  websites,
  onUpdatePin,
  onEditPin,
  onOpenAutoSchedule,
  onOpenUpload,
  onPublishPin,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedPinId, setDraggedPinId] = useState<string | null>(null);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Build calendar matrix
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Calendar cells
  const calendarCells = useMemo(() => {
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const dateStr = thisDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month filler days (to make grid 35 or 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [year, month, firstDayIndex, daysInMonth, prevMonthDays]);

  // Group pins by scheduled date string (YYYY-MM-DD)
  const pinsByDate = useMemo(() => {
    const map = new Map<string, Pin[]>();
    pins.forEach((pin) => {
      if (pin.scheduledAt) {
        const dStr = pin.scheduledAt.split('T')[0];
        if (!map.has(dStr)) map.set(dStr, []);
        map.get(dStr)?.push(pin);
      }
    });
    map.forEach((dayPins) => {
      dayPins.sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
    });
    return map;
  }, [pins]);

  // All scheduled pins sorted chronologically for list view
  const scheduledPinsList = useMemo(() => {
    return pins
      .filter(p => p.scheduledAt)
      .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
  }, [pins]);

  // Drag and Drop handlers to reschedule pins onto new dates!
  const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, pinId: string) => {
    e.dataTransfer.setData('text/plain', pinId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPinId(pinId);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (hoveredDateStr !== dateStr) {
      setHoveredDateStr(dateStr);
    }
  };

  const handleDragLeave = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (hoveredDateStr === dateStr) {
      setHoveredDateStr(null);
    }
  };

  const handleDropOnDate = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDateStr(null);

    const pinIdToMove = draggedPinId || e.dataTransfer.getData('text/plain');
    if (!pinIdToMove) return;

    const pin = pins.find(p => p.id === pinIdToMove);
    if (pin) {
      let time = '12:00:00';
      if (pin.scheduledAt) {
        const parts = pin.scheduledAt.split('T');
        if (parts[1]) time = parts[1].substring(0, 8);
      }
      const newIso = new Date(`${targetDateStr}T${time}`).toISOString();
      onUpdatePin({
        ...pin,
        scheduledAt: newIso,
        status: 'scheduled',
        updatedAt: new Date().toISOString(),
      });
    }
    setDraggedPinId(null);
  };

  const unscheduledDrafts = useMemo(() => {
    return pins.filter(p => !p.scheduledAt && p.status === 'draft');
  }, [pins]);

  return (
    <div className="space-y-5">
      {/* Top Header Bento Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs transition-colors amoled-card">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#E60023] dark:text-red-400" />
            Publishing Schedule
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {scheduledPinsList.length} Scheduled Pins across your publishing queue.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onOpenAutoSchedule(pins.filter(p => p.status === 'draft' || !p.scheduledAt))}
            className="flex items-center gap-1.5 bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none active:scale-95"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Auto Schedule ({unscheduledDrafts.length} Unscheduled)</span>
          </button>

          {/* View switcher */}
          <div className="flex items-center bg-[#F7F7F9] dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'calendar' ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List ({scheduledPinsList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' ? (
        <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl overflow-hidden shadow-xs transition-colors amoled-card">
          {/* Calendar Month Navigation Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-[#F7F7F9] dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <button
                type="button"
                onClick={goToToday}
                className="text-xs font-bold px-3 py-1 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.1] rounded-lg text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded-lg cursor-pointer transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded-lg cursor-pointer transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/[0.08] bg-[#F7F7F9] dark:bg-white/[0.02] text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-2.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-white/[0.06]">
            {calendarCells.map((cell) => {
              const dayPins = pinsByDate.get(cell.dateStr) || [];
              const isCellHovered = hoveredDateStr === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  data-dropzone="true"
                  onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                  onDragLeave={(e) => handleDragLeave(e, cell.dateStr)}
                  onDrop={(e) => handleDropOnDate(e, cell.dateStr)}
                  className={`min-h-[130px] p-2.5 flex flex-col transition-all relative ${
                    isCellHovered
                      ? 'bg-red-100/60 dark:bg-red-950/60 ring-2 ring-inset ring-[#E60023]'
                      : !cell.isCurrentMonth
                      ? 'bg-slate-50/40 dark:bg-black/40 text-slate-400 dark:text-slate-600'
                      : cell.isToday
                      ? 'bg-red-50/25 dark:bg-red-950/20'
                      : 'bg-white dark:bg-black/20'
                  } hover:bg-slate-50/80 dark:hover:bg-white/[0.03]`}
                >
                  {/* Day number header */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? 'bg-[#E60023] text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {dayPins.length > 0 && (
                      <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                        {dayPins.length} pin{dayPins.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Scheduled Pin Pills for this Day */}
                  <div className="space-y-1.5 overflow-y-auto max-h-28 flex-1">
                    {dayPins.map((pin) => {
                      const timeStr = pin.scheduledAt
                        ? new Date(pin.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <div
                          key={pin.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, pin.id)}
                          onClick={() => onEditPin(pin)}
                          className="group bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] hover:border-[#E60023] dark:hover:border-[#E60023] rounded-xl p-1.5 flex items-center gap-2 cursor-grab active:cursor-grabbing shadow-2xs hover:shadow-xs transition-all text-left select-none"
                          title={`Drag to reschedule. Click to edit: ${pin.title}`}
                        >
                          <img
                            src={pin.thumbnailUrl || pin.imageUrl}
                            alt=""
                            className="w-5 h-7 object-cover rounded-md shrink-0 bg-slate-100 dark:bg-white/[0.06]"
                            draggable={false}
                          />
                          <div className="truncate flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold leading-tight">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{timeStr}</span>
                            </div>
                            <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                              {pin.title || pin.filename}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-3xl overflow-hidden shadow-xs transition-colors amoled-card">
          {scheduledPinsList.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#E60023] dark:text-red-400 flex items-center justify-center mx-auto">
                <CalendarClock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No scheduled Pins</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Use the Auto Schedule tool or assign dates to your Pin drafts.
              </p>
              <button
                type="button"
                onClick={() => onOpenAutoSchedule(pins)}
                className="bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
              >
                Auto Schedule Pins
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {scheduledPinsList.map((pin) => {
                const board = boards.find(b => b.id === pin.boardId);
                const schedDate = pin.scheduledAt
                  ? new Date(pin.scheduledAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '';
                const schedTime = pin.scheduledAt
                  ? new Date(pin.scheduledAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <div
                    key={pin.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F7F9] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        onClick={() => onEditPin(pin)}
                        className="w-12 h-16 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] overflow-hidden shrink-0 cursor-pointer shadow-2xs"
                      >
                        <img
                          src={pin.thumbnailUrl || pin.imageUrl}
                          alt={pin.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 space-y-1 text-left">
                        <h4
                          onClick={() => onEditPin(pin)}
                          className="text-xs font-bold text-slate-900 dark:text-white hover:text-[#E60023] dark:hover:text-red-400 cursor-pointer truncate"
                        >
                          {pin.title || pin.filename}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-bold font-mono">
                            <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            {schedDate} at {schedTime}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <FolderHeart className="w-3 h-3 text-[#E60023] dark:text-red-400" />
                            {board?.name || 'No Board'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {pin.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => onPublishPin(pin)}
                        className="bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
                      >
                        <Send className="w-3 h-3" /> Publish Now
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditPin(pin)}
                        className="bg-[#F7F7F9] dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
