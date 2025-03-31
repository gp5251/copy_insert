const path = require('path');
const fs = require('fs');
const os = require('os');

// 先模拟 electron
jest.mock('electron', () => ({
  clipboard: {
    writeText: jest.fn()
  }
}));

// 然后导入测试模块
const { 
  generateUniqueFilename,
  applyPathAlias,
  ensureTargetDir
} = require('../file-handling-export');

describe('文件处理功能', () => {
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
    
    // 清除所有模拟的调用记录
    jest.clearAllMocks();
  });
  
  // 测试路径生成
  test('应该生成唯一的文件名', () => {
    const testPath = path.join(testDir, 'test.txt');
    fs.writeFileSync(testPath, 'test content');
    
    const result = generateUniqueFilename(testPath);
    expect(result).toBe(path.join(testDir, 'test_1.txt'));
  });
  
  // 测试路径别名
  test('应该正确应用路径别名', () => {
    const targetDir = path.join(testDir, 'assets', 'images');
    const filePath = path.join(targetDir, 'test.png');
    
    // 创建目录结构
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const config = {
      targetDir: targetDir,
      pathAliases: { '@': 'assets' }
    };
    
    const result = applyPathAlias(filePath, config);
    expect(result).toContain('@/images/test.png');
  });
  
  // 测试目录创建
  test('应该确保目标目录存在', () => {
    const targetDir = path.join(testDir, 'output', 'files');
    
    const mockStore = {
      get: jest.fn(() => ({ targetDir }))
    };
    
    ensureTargetDir(mockStore);
    expect(fs.existsSync(targetDir)).toBe(true);
  });
}); 