const sharp = require('sharp');
const path = require('path');

// 支持的图片格式
const SUPPORTED_IMAGE_FORMATS = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
  '.avif': 'avif',
  '.gif': 'gif',
  '.tiff': 'tiff',
  '.heif': 'heif',
  '.heic': 'heif'
};

async function processImage(sourcePath, targetPath, store) {
  const config = store.get('config');
  const ext = path.extname(sourcePath).toLowerCase();
  const format = SUPPORTED_IMAGE_FORMATS[ext] || 'jpeg';
  
  let sharpInstance = sharp(sourcePath);
  
  // 根据不同格式设置压缩选项
  switch (format) {
    case 'jpeg':
      sharpInstance = sharpInstance.jpeg({ quality: config.imageCompression });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({ quality: config.imageCompression });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality: config.imageCompression });
      break;
    case 'avif':
      sharpInstance = sharpInstance.avif({ quality: config.imageCompression });
      break;
    case 'heif':
      sharpInstance = sharpInstance.heif({ quality: config.imageCompression });
      break;
    case 'tiff':
      sharpInstance = sharpInstance.tiff({ quality: config.imageCompression });
      break;
    // GIF 格式不支持质量压缩，但支持调整颜色数量
    case 'gif':
      sharpInstance = sharpInstance.gif();
      break;
  }

  await sharpInstance.toFile(targetPath);
}

module.exports = { processImage }; 