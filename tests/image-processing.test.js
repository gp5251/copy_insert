const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const { processImage } = require('../process-image-export');

describe('图片处理功能', () => {
  let testDir;
  
  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `test-images-${Date.now()}`);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该正确处理 JPEG 图片', async () => {
    // 创建测试图片
    const sourcePath = path.join(testDir, 'test.jpg');
    const targetPath = path.join(testDir, 'output.jpg');
    
    // 创建一个简单的测试图片
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).jpeg().toFile(sourcePath);
    
    // 模拟配置
    const mockStore = {
      get: () => ({ imageCompression: 80 })
    };
    
    // 处理图片
    await processImage(sourcePath, targetPath, mockStore);
    
    // 验证图片是否存在
    expect(fs.existsSync(targetPath)).toBe(true);
    
    // 验证图片属性
    const metadata = await sharp(targetPath).metadata();
    expect(metadata.format).toBe('jpeg');
  });
  
  test('应该正确处理 PNG 图片', async () => {
    // 类似于 JPEG 测试但针对 PNG 格式
    const sourcePath = path.join(testDir, 'test.png');
    const targetPath = path.join(testDir, 'output.png');
    
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 0.5 }
      }
    }).png().toFile(sourcePath);
    
    const mockStore = {
      get: () => ({ imageCompression: 80 })
    };
    
    await processImage(sourcePath, targetPath, mockStore);
    
    expect(fs.existsSync(targetPath)).toBe(true);
    const metadata = await sharp(targetPath).metadata();
    expect(metadata.format).toBe('png');
  });
}); 