const path = require('path');
const fs = require('fs');
const os = require('os');
const { SimpleStore } = require('../simple-store-export');

describe('SimpleStore', () => {
  let testDir;
  let testStore;
  
  // 每个测试前设置环境
  beforeEach(() => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `test-simple-store-${Date.now()}`);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // 创建测试存储实例
    testStore = new SimpleStore({
      name: 'test-config',
      cwd: testDir,
      fileExtension: 'json'
    });
  });
  
  // 每个测试后清理环境
  afterEach(() => {
    // 删除测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  // 测试存储初始化
  test('应该正确初始化存储', () => {
    expect(testStore.name).toBe('test-config');
    expect(testStore.cwd).toBe(testDir);
    expect(testStore.fileExtension).toBe('json');
    expect(testStore.filePath).toBe(path.join(testDir, 'test-config.json'));
    expect(testStore.data).toEqual({});
  });
  
  // 测试设置和获取值
  test('应该能正确设置和获取值', () => {
    testStore.set('testKey', 'testValue');
    expect(testStore.get('testKey')).toBe('testValue');
    
    // 测试对象设置
    testStore.set({ 
      key1: 'value1', 
      key2: 'value2' 
    });
    expect(testStore.get('key1')).toBe('value1');
    expect(testStore.get('key2')).toBe('value2');
    
    // 测试获取所有数据
    expect(testStore.get()).toEqual({
      testKey: 'testValue',
      key1: 'value1',
      key2: 'value2'
    });
  });
  
  // 测试删除值
  test('应该能正确删除值', () => {
    testStore.set('testKey', 'testValue');
    expect(testStore.get('testKey')).toBe('testValue');
    
    testStore.delete('testKey');
    expect(testStore.get('testKey')).toBeUndefined();
  });
  
  // 测试清空存储
  test('应该能正确清空存储', () => {
    testStore.set('key1', 'value1');
    testStore.set('key2', 'value2');
    
    testStore.clear();
    expect(testStore.get()).toEqual({});
  });
  
  // 测试检查键存在
  test('应该能正确检查键是否存在', () => {
    testStore.set('testKey', 'testValue');
    
    expect(testStore.has('testKey')).toBe(true);
    expect(testStore.has('nonExistentKey')).toBe(false);
  });
  
  // 测试数据持久化
  test('应该能正确持久化数据', () => {
    testStore.set('key1', 'value1');
    
    // 创建新实例读取相同文件
    const newStore = new SimpleStore({
      name: 'test-config',
      cwd: testDir,
      fileExtension: 'json'
    });
    
    expect(newStore.get('key1')).toBe('value1');
  });
}); 