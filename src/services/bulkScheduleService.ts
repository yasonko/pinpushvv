import { Pin } from '../types';

export type PublishIntervalPreset = 
  | '15m' 
  | '30m' 
  | '1h' 
  | '2h' 
  | '3h' 
  | '4h' 
  | '6h' 
  | '12h' 
  | '1d' 
  | 'custom';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type CsvTimeFormat = '12h' | '12h_us' | '24h';

export interface BulkScheduleConfig {
  enabled: boolean;
  startDate: string;      // YYYY-MM-DD
  startTimeHour: number;  // 1-12
  startTimeMinute: number;// 0-59
  startTimeAmPm: 'AM' | 'PM';
  endDate: string;        // YYYY-MM-DD
  endTimeHour: number;    // 1-12
  endTimeMinute: number;  // 0-59
  endTimeAmPm: 'AM' | 'PM';
  intervalPreset: PublishIntervalPreset;
  customIntervalValue: number;
  customIntervalUnit: 'minutes' | 'hours';
  timeFormat: CsvTimeFormat; // '12h' (YYYY-MM-DD hh:mm AM/PM) | '12h_us' (MM/DD/YYYY hh:mm AM/PM) | '24h' (YYYY-MM-DD HH:MM)
  repeatDaily: boolean;
  continueFollowingDays: boolean;
  allowedWeekdays: Record<Weekday, boolean>;
  existingDatesMode: 'keep' | 'replace';
  randomizeOrder: boolean;
}

export interface ScheduledSlot {
  date: Date;
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hours24: number; // 0-23
  minutes: number; // 0-59
  hour12: number;  // 1-12
  ampm: 'AM' | 'PM';
  totalMinutesFromMidnight: number; // 0 - 1439
  isoString: string;          // YYYY-MM-DDTHH:MM:SS (strictly local components, never UTC skewed)
  formattedCsv: string;       // Default 12h: YYYY-MM-DD hh:mm AM/PM (e.g. 2026-08-24 12:30 PM)
  formattedCsv12h: string;    // YYYY-MM-DD hh:mm AM/PM (e.g. 2026-08-24 01:00 PM)
  formattedCsv12hUs: string;  // MM/DD/YYYY hh:mm AM/PM (e.g. 08/24/2026 01:00 PM)
  formattedCsv24h: string;    // YYYY-MM-DD HH:MM (e.g. 2026-08-24 13:00)
  formattedUi: string;        // MM/DD/YYYY hh:mm AM/PM
  formattedDisplay: string;   // Aug 24, 2026 — 01:00 PM
  weekdayName: string;
}

export interface PinScheduleAssignment {
  pin: Pin;
  pinNumber: number;
  title: string;
  boardId?: string;
  slot?: ScheduledSlot;
  existingDateKept: boolean;
}

export interface BulkSchedulePreview {
  isValid: boolean;
  errorMessage?: string;
  totalPins: number;
  availableSlotsCount: number;
  assignedCount: number;
  slotsNeeded: number;
  hasInsufficientSlots: boolean;
  assignments: PinScheduleAssignment[];
  firstSlot?: ScheduledSlot;
  lastSlot?: ScheduledSlot;
  intervalMinutes: number;
}

const WEEKDAY_INDEX_MAP: Record<number, Weekday> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Pads number to 2 digits
 */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Converts 12-hour AM/PM to 24-hour integer (0-23)
 * 12:00 AM -> 0 (Midnight)
 * 01:00 AM -> 1
 * ...
 * 11:00 AM -> 11
 * 11:30 AM -> 11
 * 12:00 PM -> 12 (Noon - NOT midnight, NOT end of day!)
 * 12:30 PM -> 12
 * 01:00 PM -> 13
 * 01:30 PM -> 13
 * ...
 * 11:00 PM -> 23
 * 11:30 PM -> 23
 */
export function convertTo24Hour(hour12: number, ampm: 'AM' | 'PM' | string): number {
  const normAmpm = String(ampm || 'AM').trim().toUpperCase();
  const rawH = Number(hour12) || 12;
  const h = ((Math.floor(rawH) - 1) % 12 + 1); // strictly 1..12

  if (normAmpm === 'AM') {
    return h === 12 ? 0 : h;
  } else {
    // PM
    return h === 12 ? 12 : h + 12;
  }
}

/**
 * Converts 24-hour integer (0-23) to 12-hour object with AM/PM
 * 0  -> { hour12: 12, ampm: 'AM' }  (12:00 AM)
 * 1  -> { hour12: 1,  ampm: 'AM' }  (01:00 AM)
 * 11 -> { hour12: 11, ampm: 'AM' }  (11:00 AM)
 * 12 -> { hour12: 12, ampm: 'PM' }  (12:00 PM - Noon)
 * 13 -> { hour12: 1,  ampm: 'PM' }  (01:00 PM)
 * 23 -> { hour12: 11, ampm: 'PM' }  (11:00 PM)
 */
export function convertTo12Hour(hour24: number): { hour12: number; ampm: 'AM' | 'PM'; hour12Str: string } {
  const h = ((Math.floor(Number(hour24) || 0) % 24) + 24) % 24; // strictly 0..23

  let hour12: number;
  let ampm: 'AM' | 'PM';

  if (h === 0) {
    hour12 = 12;
    ampm = 'AM';
  } else if (h >= 1 && h <= 11) {
    hour12 = h;
    ampm = 'AM';
  } else if (h === 12) {
    hour12 = 12;
    ampm = 'PM';
  } else {
    // 13..23
    hour12 = h - 12;
    ampm = 'PM';
  }

  return {
    hour12,
    ampm,
    hour12Str: pad2(hour12)
  };
}

/**
 * Resolves interval duration in minutes from configuration
 */
export function getIntervalInMinutes(config: BulkScheduleConfig): number {
  switch (config.intervalPreset) {
    case '15m': return 15;
    case '30m': return 30;
    case '1h': return 60;
    case '2h': return 120;
    case '3h': return 180;
    case '4h': return 240;
    case '6h': return 360;
    case '12h': return 720;
    case '1d': return 1440;
    case 'custom': {
      const val = Math.max(1, Number(config.customIntervalValue) || 30);
      return config.customIntervalUnit === 'hours' ? val * 60 : val;
    }
    default: return 30;
  }
}

/**
 * Formats a Date instance safely into local representations without UTC skew
 */
export function createScheduledSlotFromDate(d: Date): ScheduledSlot {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  const { hour12, ampm, hour12Str } = convertTo12Hour(hours24);
  const monthName = MONTH_NAMES[d.getMonth()] || 'Jan';
  const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] || '';

  const isoString = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hours24)}:${pad2(minutes)}:${pad2(seconds)}`;
  // 12-Hour standard format: YYYY-MM-DD hh:mm AM/PM (e.g. 2026-08-24 12:30 PM)
  const formattedCsv12h = `${year}-${pad2(month)}-${pad2(day)} ${hour12Str}:${pad2(minutes)} ${ampm}`;
  // 12-Hour US format: MM/DD/YYYY hh:mm AM/PM (e.g. 08/24/2026 12:30 PM)
  const formattedCsv12hUs = `${pad2(month)}/${pad2(day)}/${year} ${hour12Str}:${pad2(minutes)} ${ampm}`;
  // 24-Hour format: YYYY-MM-DD HH:MM (e.g. 2026-08-24 12:30 or 2026-08-24 13:30)
  const formattedCsv24h = `${year}-${pad2(month)}-${pad2(day)} ${pad2(hours24)}:${pad2(minutes)}`;
  
  // Default to standard 12-hour format for Pinterest
  const formattedCsv = formattedCsv12h;
  const formattedUi = `${pad2(month)}/${pad2(day)}/${year} ${hour12Str}:${pad2(minutes)} ${ampm}`;
  const formattedDisplay = `${monthName} ${pad2(day)}, ${year} — ${hour12Str}:${pad2(minutes)} ${ampm}`;

  return {
    date: new Date(d.getTime()),
    year,
    month,
    day,
    hours24,
    minutes,
    hour12,
    ampm,
    totalMinutesFromMidnight: hours24 * 60 + minutes,
    isoString,
    formattedCsv,
    formattedCsv12h,
    formattedCsv12hUs,
    formattedCsv24h,
    formattedUi,
    formattedDisplay,
    weekdayName,
  };
}

/**
 * Parse local date string (YYYY-MM-DD) and 12-hour time into local Date object
 */
export function parseLocalDateTime(
  dateStr: string,
  hour12: number,
  minute: number,
  ampm: 'AM' | 'PM'
): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const hour24 = convertTo24Hour(hour12, ampm);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const d = new Date(year, month, day, hour24, minute, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Default schedule configuration initializer covering 24 full hours (12:00 AM to 11:30 PM, 48 slots/day at 30 min)
 */
export function getDefaultBulkScheduleConfig(): BulkScheduleConfig {
  const now = new Date();
  // Start today at 12:00 AM (00:00)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // End 7 days later at 11:30 PM (23:30)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 23, 30, 0, 0);

  const startIso = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
  const endIso = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;

  return {
    enabled: true,
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
    allowedWeekdays: {
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: true,
      sun: true,
    },
    existingDatesMode: 'replace',
    randomizeOrder: false,
  };
}

/**
 * Generates all valid time slots based on the schedule configuration:
 * 1. Date Range: Determines which calendar days are available (startDate to endDate)
 * 2. Daily Time Window: Determines daily start and daily end time (e.g. 09:00 AM to 09:00 PM, or 09:00 PM to 11:00 PM)
 * 3. Interval: Explicit interval in minutes between slots (e.g. 30 minutes, 15 minutes, 60 minutes)
 *
 * Algorithm:
 * For each day from startDate to endDate:
 *   If day is allowed weekday:
 *     currentTime = dailyStartTime
 *     While currentTime <= dailyEndTime:
 *       createSlot(day, currentTime)
 *       currentTime += intervalMinutes
 * When daily window is exhausted, advance to the next day.
 */
export function generateScheduleSlots(
  config: BulkScheduleConfig,
  minSlotsNeeded: number = 0
): { slots: ScheduledSlot[]; error?: string } {
  if (!config.startDate) {
    return { slots: [], error: 'Start date is required' };
  }
  if (!config.endDate) {
    return { slots: [], error: 'End date is required' };
  }

  const startParts = config.startDate.split('-').map(Number);
  const endParts = config.endDate.split('-').map(Number);

  if (startParts.length !== 3 || isNaN(startParts[0]) || isNaN(startParts[1]) || isNaN(startParts[2])) {
    return { slots: [], error: 'Invalid start date format (YYYY-MM-DD expected)' };
  }
  if (endParts.length !== 3 || isNaN(endParts[0]) || isNaN(endParts[1]) || isNaN(endParts[2])) {
    return { slots: [], error: 'Invalid end date format (YYYY-MM-DD expected)' };
  }

  const startDayDate = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0);
  const endDayDate = new Date(endParts[0], endParts[1] - 1, endParts[2], 0, 0, 0, 0);

  if (endDayDate.getTime() < startDayDate.getTime()) {
    return { slots: [], error: 'End date must be on or after start date.' };
  }

  const intervalMinutes = getIntervalInMinutes(config);
  if (intervalMinutes <= 0) {
    return { slots: [], error: 'Interval must be greater than 0 minutes.' };
  }

  // Check that at least one weekday is enabled
  const hasAnyWeekday = Object.values(config.allowedWeekdays).some(Boolean);
  if (!hasAnyWeekday) {
    return { slots: [], error: 'At least one scheduling day of the week must be selected.' };
  }

  const MAX_SLOTS_CAP = 5000;
  const slots: ScheduledSlot[] = [];

  // Convert daily start and end to minutes from midnight
  const startHour24 = convertTo24Hour(config.startTimeHour, config.startTimeAmPm);
  const startMin = Math.max(0, Math.min(59, Number(config.startTimeMinute) || 0));
  const dailyStartMinutes = startHour24 * 60 + startMin;

  const endHour24 = convertTo24Hour(config.endTimeHour, config.endTimeAmPm);
  const endMin = Math.max(0, Math.min(59, Number(config.endTimeMinute) || 0));
  let dailyEndMinutes = endHour24 * 60 + endMin;

  // Handle overnight window (e.g. 09:00 PM to 02:00 AM)
  const isOvernight = dailyEndMinutes < dailyStartMinutes;
  const effectiveEndMinutes = isOvernight ? dailyEndMinutes + 1440 : dailyEndMinutes;

  if (config.repeatDaily) {
    // 1. Daily window mode:
    // For each calendar day from startDate to endDate:
    //   If the day is an allowed weekday:
    //     currentMinutes = dailyStartMinutes
    //     while currentMinutes <= effectiveEndMinutes:
    //       create slot for (currentDay + offset, currentMinutes)
    //       currentMinutes += intervalMinutes (increment strictly by minutes!)
    //   Date advances to next day ONLY after exhausting the daily time window.
    let currentDayCursor = new Date(startDayDate.getFullYear(), startDayDate.getMonth(), startDayDate.getDate(), 0, 0, 0, 0);
    const endBoundary = new Date(endDayDate.getFullYear(), endDayDate.getMonth(), endDayDate.getDate(), 23, 59, 59, 999);
    let safetyDayCount = 0;
    const MAX_DAYS = 730;

    while (safetyDayCount < MAX_DAYS && slots.length < MAX_SLOTS_CAP) {
      safetyDayCount++;
      const isWithinDateRange = currentDayCursor.getTime() <= endBoundary.getTime();

      // If we passed the end date:
      // Only continue into following days if continueFollowingDays is enabled AND minSlotsNeeded is requested AND not yet fulfilled
      if (!isWithinDateRange) {
        const needsMoreSlots = minSlotsNeeded > 0 && slots.length < minSlotsNeeded;
        if (!config.continueFollowingDays || !needsMoreSlots) {
          break;
        }
      }

      const dayOfWeekKey = WEEKDAY_INDEX_MAP[currentDayCursor.getDay()];
      if (config.allowedWeekdays[dayOfWeekKey]) {
        const year = currentDayCursor.getFullYear();
        const monthIndex = currentDayCursor.getMonth();
        const day = currentDayCursor.getDate();

        // Increment time strictly in minutes within this day's time window
        let currentMinutes = dailyStartMinutes;

        while (currentMinutes <= effectiveEndMinutes && slots.length < MAX_SLOTS_CAP) {
          const dayOffset = Math.floor(currentMinutes / 1440);
          const minsInDay = currentMinutes % 1440;
          const slotHour = Math.floor(minsInDay / 60);
          const slotMinute = minsInDay % 60;

          const slotDate = new Date(year, monthIndex, day + dayOffset, slotHour, slotMinute, 0, 0);
          slots.push(createScheduledSlotFromDate(slotDate));

          currentMinutes += intervalMinutes;
        }
      }

      // Date advances ONLY after the daily time window has been exhausted!
      currentDayCursor.setDate(currentDayCursor.getDate() + 1);
    }
  } else {
    // 2. Continuous schedule mode: start from startDt and step continuously by intervalMinutes
    const startDt = new Date(
      startDayDate.getFullYear(),
      startDayDate.getMonth(),
      startDayDate.getDate(),
      startHour24,
      startMin,
      0, 0
    );
    const endDt = new Date(
      endDayDate.getFullYear(),
      endDayDate.getMonth(),
      endDayDate.getDate(),
      endHour24,
      endMin,
      0, 0
    );

    let cursor = new Date(startDt.getTime());
    let safetyLoop = 0;
    const MAX_ITERATIONS = 10000;
    const intervalMs = intervalMinutes * 60 * 1000;

    while (safetyLoop < MAX_ITERATIONS && slots.length < MAX_SLOTS_CAP) {
      safetyLoop++;
      const isWithinRange = cursor.getTime() <= endDt.getTime();

      if (!isWithinRange) {
        if (!config.continueFollowingDays || (minSlotsNeeded > 0 && slots.length >= minSlotsNeeded)) {
          break;
        }
      }

      const dayOfWeekKey = WEEKDAY_INDEX_MAP[cursor.getDay()];
      if (config.allowedWeekdays[dayOfWeekKey]) {
        slots.push(createScheduledSlotFromDate(cursor));
      }

      cursor = new Date(cursor.getTime() + intervalMs);
    }
  }

  return { slots };
}

/**
 * Calculates full scheduling preview and assignments for a list of Pins.
 */
export function calculateBulkSchedulePreview(
  pins: Pin[],
  config: BulkScheduleConfig
): BulkSchedulePreview {
  const totalPins = pins.length;
  const intervalMinutes = getIntervalInMinutes(config);

  if (!config.enabled) {
    return {
      isValid: true,
      totalPins,
      availableSlotsCount: 0,
      assignedCount: 0,
      slotsNeeded: 0,
      hasInsufficientSlots: false,
      assignments: pins.map((pin, idx) => ({
        pin,
        pinNumber: idx + 1,
        title: pin.title || pin.filename || `Pin #${idx + 1}`,
        boardId: pin.boardId,
        existingDateKept: Boolean(pin.scheduledAt || pin.publishedAt),
        slot: pin.scheduledAt ? createScheduledSlotFromDate(new Date(pin.scheduledAt)) : undefined,
      })),
      intervalMinutes,
    };
  }

  // Count how many pins need slots
  const pinsNeedingSlots: Array<{ pin: Pin; originalIndex: number }> = [];
  const assignments: PinScheduleAssignment[] = [];

  pins.forEach((pin, idx) => {
    const hasExisting = Boolean(pin.scheduledAt || pin.publishedAt);
    if (hasExisting && config.existingDatesMode === 'keep') {
      const existingDateStr = pin.scheduledAt || pin.publishedAt!;
      const d = new Date(existingDateStr);
      assignments.push({
        pin,
        pinNumber: idx + 1,
        title: pin.title || pin.filename || `Pin #${idx + 1}`,
        boardId: pin.boardId,
        existingDateKept: true,
        slot: !isNaN(d.getTime()) ? createScheduledSlotFromDate(d) : undefined,
      });
    } else {
      pinsNeedingSlots.push({ pin, originalIndex: idx });
      assignments.push({
        pin,
        pinNumber: idx + 1,
        title: pin.title || pin.filename || `Pin #${idx + 1}`,
        boardId: pin.boardId,
        existingDateKept: false,
      });
    }
  });

  const slotsNeeded = pinsNeedingSlots.length;
  const { slots, error } = generateScheduleSlots(config, slotsNeeded);

  if (error) {
    return {
      isValid: false,
      errorMessage: error,
      totalPins,
      availableSlotsCount: 0,
      assignedCount: 0,
      slotsNeeded,
      hasInsufficientSlots: true,
      assignments,
      intervalMinutes,
    };
  }

  const availableSlotsCount = slots.length;
  const hasInsufficientSlots = availableSlotsCount < slotsNeeded;

  // Order pins needing slots (optional randomizer)
  let orderedTargets = [...pinsNeedingSlots];
  if (config.randomizeOrder) {
    orderedTargets = orderedTargets.sort(() => Math.random() - 0.5);
  }

  let assignedCount = 0;
  orderedTargets.forEach((target, slotIndex) => {
    if (slotIndex < slots.length) {
      const slot = slots[slotIndex];
      assignments[target.originalIndex].slot = slot;
      assignedCount++;
    }
  });

  return {
    isValid: !hasInsufficientSlots,
    errorMessage: hasInsufficientSlots
      ? `Not enough scheduling slots. ${slotsNeeded} Pins need to be scheduled, but only ${availableSlotsCount} time slots are available within the date range and time window. Please extend your date range or shorten the interval.`
      : undefined,
    totalPins,
    availableSlotsCount,
    assignedCount,
    slotsNeeded,
    hasInsufficientSlots,
    assignments,
    firstSlot: slots[0],
    lastSlot: slots[Math.min(slots.length - 1, Math.max(0, assignedCount - 1))],
    intervalMinutes,
  };
}

/**
 * Applies the calculated schedule to the Pins, returning updated Pin objects with scheduledAt set.
 */
export function applyScheduleToPins(
  pins: Pin[],
  config: BulkScheduleConfig
): { updatedPins: Pin[]; preview: BulkSchedulePreview } {
  const preview = calculateBulkSchedulePreview(pins, config);

  if (!config.enabled) {
    return { updatedPins: pins, preview };
  }

  const updatedPins = pins.map((pin, idx) => {
    const assignment = preview.assignments[idx];
    if (assignment && assignment.slot) {
      return {
        ...pin,
        scheduledAt: assignment.slot.isoString,
        status: pin.status === 'draft' ? 'scheduled' : pin.status,
      };
    }
    return pin;
  });

  return { updatedPins, preview };
}
