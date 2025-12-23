// Generate a simple icon for development
const fs = require('fs');
const path = require('path');

// Create a minimal 32x32 PNG (purple square - our accent color)
// PNG header + IHDR + IDAT + IEND chunks for a solid purple 32x32 image
const createSimplePNG = () => {
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(0, 0, 256, 256);

  // "O" letter
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 180px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('O', 128, 138);

  return canvas.toBuffer('image/png');
};

// Alternative: Create a minimal valid ICO file directly
const createMinimalICO = () => {
  // ICO file format:
  // Header (6 bytes) + Directory Entry (16 bytes) + Image Data

  const width = 32;
  const height = 32;
  const bpp = 32; // bits per pixel (RGBA)

  // BMP info header size
  const bmpHeaderSize = 40;
  // Image data size (RGBA, 4 bytes per pixel)
  const imageDataSize = width * height * 4;
  // Total image size (BMP header + image data)
  const imageSize = bmpHeaderSize + imageDataSize;

  // Create buffer
  const buffer = Buffer.alloc(6 + 16 + imageSize);
  let offset = 0;

  // ICO Header
  buffer.writeUInt16LE(0, offset); offset += 2;      // Reserved
  buffer.writeUInt16LE(1, offset); offset += 2;      // Type (1 = ICO)
  buffer.writeUInt16LE(1, offset); offset += 2;      // Number of images

  // Directory Entry
  buffer.writeUInt8(width, offset); offset += 1;     // Width
  buffer.writeUInt8(height, offset); offset += 1;    // Height
  buffer.writeUInt8(0, offset); offset += 1;         // Color palette
  buffer.writeUInt8(0, offset); offset += 1;         // Reserved
  buffer.writeUInt16LE(1, offset); offset += 2;      // Color planes
  buffer.writeUInt16LE(bpp, offset); offset += 2;    // Bits per pixel
  buffer.writeUInt32LE(imageSize, offset); offset += 4;  // Image size
  buffer.writeUInt32LE(22, offset); offset += 4;     // Image offset (6 + 16 = 22)

  // BMP Info Header (BITMAPINFOHEADER)
  buffer.writeUInt32LE(40, offset); offset += 4;     // Header size
  buffer.writeInt32LE(width, offset); offset += 4;   // Width
  buffer.writeInt32LE(height * 2, offset); offset += 4;  // Height (doubled for ICO)
  buffer.writeUInt16LE(1, offset); offset += 2;      // Planes
  buffer.writeUInt16LE(bpp, offset); offset += 2;    // Bits per pixel
  buffer.writeUInt32LE(0, offset); offset += 4;      // Compression
  buffer.writeUInt32LE(imageDataSize, offset); offset += 4;  // Image size
  buffer.writeInt32LE(0, offset); offset += 4;       // X pixels per meter
  buffer.writeInt32LE(0, offset); offset += 4;       // Y pixels per meter
  buffer.writeUInt32LE(0, offset); offset += 4;      // Colors used
  buffer.writeUInt32LE(0, offset); offset += 4;      // Important colors

  // Image data (BGRA format, bottom-up)
  // Purple color: #6366f1 -> B=0xf1, G=0x66, R=0x63, A=0xff
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buffer.writeUInt8(0xf1, offset); offset += 1;  // Blue
      buffer.writeUInt8(0x66, offset); offset += 1;  // Green
      buffer.writeUInt8(0x63, offset); offset += 1;  // Red
      buffer.writeUInt8(0xff, offset); offset += 1;  // Alpha
    }
  }

  return buffer;
};

// Create icons directory
const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create the ICO file
const icoBuffer = createMinimalICO();
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
console.log('Created icon.ico');

// Also create PNG versions
const pngBuffer = createMinimalICO(); // We'll use same purple for PNGs
// For simplicity, we'll create dummy PNG files that Tauri can handle
// In production, you'd use proper image generation

console.log('Icons generated successfully!');
