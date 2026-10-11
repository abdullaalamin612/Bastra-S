/**
 * Utility to process and remove background from logos/images using HTML5 Canvas.
 * Automatically samples edge pixels to identify and remove solid, white, or light backgrounds.
 */

export async function removeImageBackground(
  imageUrl: string,
  tolerance: number = 28
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Sample corners to find background color
        const cornerIndices = [
          0, // Top-Left
          (canvas.width - 1) * 4, // Top-Right
          (canvas.height - 1) * canvas.width * 4, // Bottom-Left
          ((canvas.height - 1) * canvas.width + (canvas.width - 1)) * 4, // Bottom-Right
        ];

        let bgR = 255;
        let bgG = 255;
        let bgB = 255;

        // Calculate average corner RGB
        let totalR = 0,
          totalG = 0,
          totalB = 0,
          count = 0;
        for (const idx of cornerIndices) {
          if (idx < data.length) {
            totalR += data[idx];
            totalG += data[idx + 1];
            totalB += data[idx + 2];
            count++;
          }
        }
        if (count > 0) {
          bgR = Math.round(totalR / count);
          bgG = Math.round(totalG / count);
          bgB = Math.round(totalB / count);
        }

        // Iterate all pixels and calculate Euclidean distance to background color
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if close to corner background OR white/near-white (R>240, G>240, B>240)
          const distToCornerBg = Math.sqrt(
            Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
          );
          const isNearWhite = r >= 235 && g >= 235 && b >= 235;

          if (distToCornerBg <= tolerance || isNearWhite) {
            // Smooth alpha falloff near the threshold
            if (distToCornerBg < tolerance * 0.7 || isNearWhite) {
              data[i + 3] = 0; // Fully transparent
            } else {
              const alphaFactor = (distToCornerBg - tolerance * 0.7) / (tolerance * 0.3);
              data[i + 3] = Math.min(data[i + 3], Math.round(alphaFactor * 255));
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const transparentDataUrl = canvas.toDataURL('image/png');
        resolve(transparentDataUrl);
      } catch (err) {
        console.warn('Canvas background removal failed:', err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
}
