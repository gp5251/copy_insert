const { configManagement } = require('../config-management-export');

describe('配置管理功能', () => {
  let mockStore;
  let mockConfigStore;
  
  beforeEach(() => {
    // 模拟存储
    mockStore = {
      get: jest.fn(() => ({
        targetDir: '/fake/path',
        imageCompression: 80
      })),
      set: jest.fn()
    };
    
    mockConfigStore = {
      get: jest.fn((key) => {
        if (key === 'profiles') {
          return {
            'default': {
              targetDir: '/default/path',
              imageCompression: 70
            },
            'profile1': {
              targetDir: '/profile1/path',
              imageCompression: 90
            }
          };
        }
        if (key === 'activeProfile') {
          return 'default';
        }
        return null;
      }),
      set: jest.fn()
    };
  });

  test('应该正确获取所有配置项', () => {
    const result = configManagement.getAllProfiles(mockConfigStore);
    
    expect(result).toEqual({
      profiles: {
        'default': {
          targetDir: '/default/path',
          imageCompression: 70
        },
        'profile1': {
          targetDir: '/profile1/path',
          imageCompression: 90
        }
      },
      activeProfile: 'default'
    });
  });
  
  test('应该正确保存配置项', () => {
    const newConfig = { targetDir: '/new/path', imageCompression: 85 };
    const result = configManagement.saveProfile(mockConfigStore, 'newProfile', newConfig);
    
    expect(result).toEqual({ success: true });
    expect(mockConfigStore.set).toHaveBeenCalledWith('profiles', expect.objectContaining({
      'newProfile': newConfig
    }));
  });
  
  test('应该正确应用配置项', () => {
    const result = configManagement.applyProfile(mockStore, mockConfigStore, 'profile1');
    
    expect(result).toEqual({
      success: true,
      config: {
        targetDir: '/profile1/path',
        imageCompression: 90
      }
    });
    expect(mockStore.set).toHaveBeenCalledWith('config', {
      targetDir: '/profile1/path',
      imageCompression: 90
    });
    expect(mockConfigStore.set).toHaveBeenCalledWith('activeProfile', 'profile1');
  });
}); 