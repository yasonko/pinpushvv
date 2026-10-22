import { Pin } from '../types';

function toLocalIsoString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export interface AutoScheduleOptions {
  pins: Pin[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  times: string[];   // e.g. ["09:00", "13:00", "18:00"]
  boardId?: string;
  websiteId?: string;
  destinationUrl?: string;
  skipWeekends?: boolean;
}

export interface IntervalScheduleOptions {
  pins: Pin[];
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  intervalMinutes: number; // e.g. 15, 30, 60
  boardId?: string;
  websiteId?: string;
  destinationUrl?: string;
}

export function schedulePinsByInterval(options: IntervalScheduleOptions): Pin[] {
  const { pins, startDate, startTime, intervalMinutes, boardId, websiteId, destinationUrl } = options;
  if (!pins.length) return pins;

  const [hours, minutes] = (startTime || '10:00').split(':').map(Number);
  const start = new Date(`${startDate}T00:00:00`);
  start.setHours(hours || 10, minutes || 0, 0, 0);

  const stepMs = Math.max(1, intervalMinutes || 30) * 60 * 1000;
  const now = toLocalIsoString(new Date());

  return pins.map((pin, index) => {
    const slotTime = new Date(start.getTime() + index * stepMs);
    return {
      ...pin,
      boardId: boardId !== undefined && boardId !== '' ? boardId : pin.boardId,
      websiteId: websiteId !== undefined && websiteId !== '' ? websiteId : pin.websiteId,
      destinationUrl: destinationUrl ? destinationUrl : pin.destinationUrl,
      status: 'scheduled',
      scheduledAt: toLocalIsoString(slotTime),
      updatedAt: now,
    };
  });
}

export function clearPinsSchedule(pins: Pin[]): Pin[] {
  const now = toLocalIsoString(new Date());
  return pins.map((pin) => ({
    ...pin,
    scheduledAt: null,
    status: pin.status === 'scheduled' ? 'ready' : pin.status,
    updatedAt: now,
  }));
}

export function autoSchedulePins(options: AutoScheduleOptions): Pin[] {
  const { pins, startDate, endDate, times, boardId, websiteId, destinationUrl, skipWeekends } = options;
  if (!pins.length || !times.length) return pins;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  // Sort times ascending
  const sortedTimes = [...times].sort();

  // Generate valid slot dates
  const availableSlots: Date[] = [];
  const currentDay = new Date(start);

  while (currentDay <= end) {
    const dayOfWeek = currentDay.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!skipWeekends || !isWeekend) {
      const year = currentDay.getFullYear();
      for (const timeStr of sortedTimes) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const slotDate = new Date(year, currentDay.getMonth(), currentDay.getDate(), hours || 0, minutes || 0, 0);
        availableSlots.push(slotDate);
      }
    }
    // Advance to next day
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // If available slots are fewer than pins, extend beyond end date preserving same daily interval
  if (availableSlots.length < pins.length) {
    const lastDay = new Date(currentDay);
    while (availableSlots.length < pins.length) {
      const dayOfWeek = lastDay.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (!skipWeekends || !isWeekend) {
        const year = lastDay.getFullYear();
        for (const timeStr of sortedTimes) {
          if (availableSlots.length >= pins.length) break;
          const [hours, minutes] = timeStr.split(':').map(Number);
          const slotDate = new Date(year, lastDay.getMonth(), lastDay.getDate(), hours || 0, minutes || 0, 0);
          availableSlots.push(slotDate);
        }
      }
      lastDay.setDate(lastDay.getDate() + 1);
    }
  }

  const now = toLocalIsoString(new Date());

  return pins.map((pin, index) => {
    const slot = availableSlots[index % availableSlots.length];
    return {
      ...pin,
      boardId: boardId !== undefined ? boardId : pin.boardId,
      websiteId: websiteId !== undefined ? websiteId : pin.websiteId,
      destinationUrl: destinationUrl ? destinationUrl : pin.destinationUrl,
      status: 'scheduled',
      scheduledAt: toLocalIsoString(slot),
      updatedAt: now,
    };
  });
}
