export const getColorClasses = (colorType) => {
  if (typeof colorType === 'string' && colorType.startsWith('#')) return colorType;
  const colors = {
    pink: "bg-[#F2C6C2] text-stone-800",
    beige: "bg-[#F5E1C0] text-stone-800",
    purple: "bg-[#D6D6F5] text-stone-800",
    green: "bg-[#BDEFDB] text-stone-800",
    default: "bg-gray-100 text-stone-800",
  };
  return colors[colorType] || colors.default;
};

// --- Color Processing Utilities ---

export function componentToHex(c) {
  const hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

export function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function makePastel(r, g, b) {
  let [h, s, l] = rgbToHsl(r, g, b);

  // PASTEL LOGIC: High Lightness (0.80-0.95), Moderate Saturation (0.6+)
  l = 0.85 + l * 0.1;
  if (l > 0.95) l = 0.95;
  if (l < 0.80) l = 0.80;

  if (s < 0.6) s = 0.6;

  return hslToRgb(h, s, l);
}

/**
 * Extract average color from image URL and convert to pastel
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} - Hex color code
 */
export async function extractPastelColorFromImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0, count = 0;
        
        // Iterate over pixels
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // Check alpha
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        
        // Calculate average
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        // Convert to pastel
        const pastel = makePastel(r, g, b);
        const pastelHex = rgbToHex(pastel.r, pastel.g, pastel.b);
        
        resolve(pastelHex);
      } catch (e) {
        console.warn('Could not extract color from image, using fallback:', e);
        resolve('#F5E1C0'); // Fallback to beige
      }
    };
    
    img.onerror = () => {
      console.warn('Image failed to load, using fallback color');
      resolve('#F5E1C0'); // Fallback to beige
    };
    
    img.src = imageUrl;
  });
}

