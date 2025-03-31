// 模拟 Electron 对象
const electron = {
  app: {
    getPath: jest.fn((key) => {
      if (key === 'userData') {
        return '/mock/user/data/path';
      }
      return '/mock/path';
    }),
    isReady: jest.fn(() => true),
    whenReady: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    dock: {
      setMenu: jest.fn()
    },
    setUserTasks: jest.fn()
  },
  ipcMain: {
    handle: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn()
    },
    setSize: jest.fn(),
    getSize: jest.fn(() => [800, 600]),
    setAlwaysOnTop: jest.fn(),
    isAlwaysOnTop: jest.fn(() => false),
    setWindowButtonVisibility: jest.fn(),
    close: jest.fn(),
    getPosition: jest.fn(() => [0, 0])
  })),
  Menu: {
    buildFromTemplate: jest.fn(() => ({
      popup: jest.fn()
    }))
  },
  dialog: {
    showErrorBox: jest.fn()
  },
  clipboard: {
    writeText: jest.fn()
  },
  shell: {
    openPath: jest.fn()
  }
};

module.exports = electron; 