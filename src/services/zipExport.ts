import JSZip from 'jszip';
import { Pin, Board } from '../types';
import { exportPinsToCSV } from './csvEngine';

export async function downloadPinsAsZip(
  pins: Pin[],
  boards: Board[],
  zipFilename: string = `pinpulse-export-${new Date().toISOString().split('T')[0]}.zip`
): Promise<void> {
  const zip = new JSZip();
  const imagesFolder = zip.folder('images');

  // Add CSV manifest to the zip
  const csvData = exportPinsToCSV(pins, boards);
  zip.file('pins_metadata.csv', csvData);

  // Process all images
  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    const rawUrl = pin.imageUrl || pin.thumbnailUrl;
    let extension = 'jpg';
    if (pin.filename) {
      const match = pin.filename.match(/\.([0-9a-z]+)$/i);
      if (match) extension = match[1].toLowerCase();
    }

    const safeName = `${String(i + 1).padStart(3, '0')}_${(pin.title || pin.filename || 'pin').replace(/[^a-z0-9_-]/gi, '_')}.${extension}`;

    if (rawUrl.startsWith('data:')) {
      // Base64 data
      const commaIndex = rawUrl.indexOf(',');
      if (commaIndex > -1) {
        const base64Data = rawUrl.substring(commaIndex + 1);
        imagesFolder?.file(safeName, base64Data, { base64: true });
      }
    } else {
      // Remote or blob URL
      try {
        const res = await fetch(rawUrl);
        const blob = await res.blob();
        imagesFolder?.file(safeName, blob);
      } catch (err) {
        console.warn(`Could not fetch image for pin ${pin.id}:`, err);
      }
    }
  }

  // Generate zip file and trigger download
  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}
