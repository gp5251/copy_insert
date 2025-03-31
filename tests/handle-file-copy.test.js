const path = require('path');
const fs = require('fs');
const os = require('os');

// 模拟 electron
const mockSend = jest.fn();
const mockWriteText = jest.fn();

jest.mock('electron', () => ({
  clipboard: {
    writeText: mockWriteText
  }
}));

// 导入测试函数
const { handleFileCopy } = require('../file-handling-export');

describe('文件复制处理', () => {
  let testDir;
  let sourceDir;
  let targetDir;
  
  beforeEach(() => {
    // 创建测试目录
    testDir = path.join(os.tmpdir(), `test-file-copy-${Date.now()}`);
    sourceDir = path.join(testDir, 'source');
    targetDir = path.join(testDir, 'target');
    
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    
    // 创建源文件
    fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'Test content');
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });
  
  test('应该正确复制文件并发送成功消息', async () => {
    const filePaths = [path.join(sourceDir, 'test.txt')];
    
    const mockStore = {
      get: jest.fn(() => ({
        targetDir,
        pathAliases: { '@': 'target' }
      }))
    };
    
    const mockMainWindow = {
      webContents: {
        send: mockSend
      }
    };
    
    await handleFileCopy(filePaths, mockStore, mockMainWindow);
    
    // 检查文件是否被复制
    expect(fs.existsSync(path.join(targetDir, 'test.txt'))).toBe(true);
    
    // 检查成功消息是否被发送
    expect(mockSend).toHaveBeenCalledWith('success', expect.any(String));
    
    // 检查剪贴板是否被更新
    expect(mockWriteText).toHaveBeenCalled();
  });
}); 