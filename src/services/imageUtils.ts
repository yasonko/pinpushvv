export async function createThumbnail(file: File, maxWidth: number = 360, quality: number = 0.82): Promise<{ fullUrl: string; thumbnailUrl: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fullUrl = (e.target?.result as string) || '';
      const img = new Image();
      img.onload = () => {
        try {
          // 1. Create fast thumbnail
          const thumbScale = Math.min(1, maxWidth / Math.max(img.width, 1));
          const thumbWidth = Math.round(img.width * thumbScale);
          const thumbHeight = Math.round(img.height * thumbScale);

          const canvas = document.createElement('canvas');
          canvas.width = thumbWidth;
          canvas.height = thumbHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ fullUrl, thumbnailUrl: fullUrl });
            return;
          }

          ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', quality);

          // 2. If original image is extremely large (> 1600px width/height), compress web version
          const maxDimension = 1600;
          if (img.width > maxDimension || img.height > maxDimension) {
            const webScale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            const webWidth = Math.round(img.width * webScale);
            const webHeight = Math.round(img.height * webScale);

            canvas.width = webWidth;
            canvas.height = webHeight;
            const webCtx = canvas.getContext('2d');
            if (webCtx) {
              webCtx.drawImage(img, 0, 0, webWidth, webHeight);
              const optimizedFullUrl = canvas.toDataURL('image/jpeg', 0.88);
              resolve({ fullUrl: optimizedFullUrl, thumbnailUrl });
              return;
            }
          }

          resolve({ fullUrl, thumbnailUrl });
        } catch {
          resolve({ fullUrl, thumbnailUrl: fullUrl });
        }
      };
      img.onerror = () => {
        resolve({ fullUrl, thumbnailUrl: fullUrl });
      };
      img.src = fullUrl;
    };
    reader.onerror = () => {
      resolve({ fullUrl: '', thumbnailUrl: '' });
    };
    reader.readAsDataURL(file);
  });
}

// Convert filename to human readable Pinterest title
export function formatFilenameToTitle(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  // Replace underscores, hyphens, and dots with spaces
  const clean = nameWithoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize words
  return clean
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
