const path = require('path');
const fs = require('fs');
const os = require('os');

// 导入主文件中的函数
const { 
  generateUniqueFilename,
  applyPathAlias,
  ensureTargetDir
} = require('../utils-export');

describe('工具函数测试', () => {
  let testDir;
  
  beforeEach(() => {
    // 创建测试目录
    testDir = path.join(os.tmpdir(), `test-utils-${Date.now()}`);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // 删除测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  // 测试生成唯一文件名
  describe('generateUniqueFilename', () => {
    test('应该在文件不存在时返回原始路径', () => {
      const testPath = path.join(testDir, 'test.txt');
      const result = generateUniqueFilename(testPath);
      expect(result).toBe(testPath);
    });
    
    test('应该在文件存在时生成唯一文件名', () => {
      const testPath = path.join(testDir, 'test.txt');
      
      // 创建测试文件
      fs.writeFileSync(testPath, 'test content');
      
      const result = generateUniqueFilename(testPath);
      expect(result).toBe(path.join(testDir, 'test_1.txt'));
      
      // 再创建一个文件
      fs.writeFileSync(result, 'test content 2');
      
      const result2 = generateUniqueFilename(testPath);
      expect(result2).toBe(path.join(testDir, 'test_2.txt'));
    });
  });
  
  // 测试路径别名应用
  describe('applyPathAlias', () => {
    test('应该正确应用路径别名', () => {
      const targetDir = path.join(testDir, 'assets', 'images');
      const filePath = path.join(targetDir, 'test.png');
      
      const config = {
        targetDir: targetDir,
        pathAliases: { '@': 'assets' }
      };
      
      const result = applyPathAlias(filePath, config);
      expect(result).toBe('@/images/test.png');
    });
    
    test('当找不到别名时应返回原始路径', () => {
      const targetDir = path.join(testDir, 'storage', 'images');
      const filePath = path.join(targetDir, 'test.png');
      
      const config = {
        targetDir: targetDir,
        pathAliases: { '@': 'assets' }
      };
      
      const result = applyPathAlias(filePath, config);
      expect(result).toBe(filePath);
    });
  });
  
  // 测试确保目标目录存在
  describe('ensureTargetDir', () => {
    test('应该创建不存在的目录', () => {
      const targetDir = path.join(testDir, 'subdir', 'images');
      
      // 模拟 store.get('config')
      const mockStore = {
        get: () => ({ targetDir })
      };
      
      ensureTargetDir(mockStore);
      expect(fs.existsSync(targetDir)).toBe(true);
    });
    
    test('不应改变已存在的目录', () => {
      const targetDir = path.join(testDir, 'existing');
      fs.mkdirSync(targetDir);
      
      // 创建测试文件
      const testFile = path.join(targetDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      
      // 模拟 store.get('config')
      const mockStore = {
        get: () => ({ targetDir })
      };
      
      ensureTargetDir(mockStore);
      expect(fs.existsSync(testFile)).toBe(true);
    });
  });
}); 