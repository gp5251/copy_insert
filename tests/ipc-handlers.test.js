const { ipcHandlers } = require('../ipc-handlers-export');

// 模拟 electron 依赖
jest.mock('electron', () => require('./mocks/electron.mock'));

describe('IPC 通信处理函数', () => {
  let mockStore;
  
  beforeEach(() => {
    // 模拟存储
    mockStore = {
      get: jest.fn(() => ({ 
        targetDir: '/fake/path',
        imageCompression: 80
      })),
      set: jest.fn()
    };
  });

  test('应该正确处理 updateConfig 请求', async () => {
    const newConfig = { imageCompression: 90 };
    await ipcHandlers.updateConfig(mockStore, {}, newConfig);
    
    expect(mockStore.set).toHaveBeenCalledWith('config', expect.objectContaining({
      imageCompression: 90
    }));
  });
  
  test('应该正确处理 getConfig 请求', async () => {
    const config = await ipcHandlers.getConfig(mockStore);
    
    expect(config).toEqual({
      targetDir: '/fake/path',
      imageCompression: 80
    });
    expect(mockStore.get).toHaveBeenCalledWith('config');
  });
}); 