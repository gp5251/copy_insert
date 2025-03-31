// 导出 IPC 处理函数
const ipcHandlers = {
  updateConfig: (store, event, newConfig) => {
    const currentConfig = store.get('config');
    store.set('config', { ...currentConfig, ...newConfig });
    return true;
  },
  
  getConfig: (store) => {
    return store.get('config');
  },
  
  executeNow: async (store, mainWindow) => {
    const { getSelectedFiles, handleFileCopy } = require('./file-handling-export');
    try {
      const files = await getSelectedFiles();
      if (files.length > 0) {
        await handleFileCopy(files, store, mainWindow);
        return { success: true, message: '执行成功' };
      } else {
        throw new Error('请先选择文件');
      }
    } catch (error) {
      throw new Error(error.message || '执行失败');
    }
  },
  
  setAlwaysOnTop: (mainWindow, event, value) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(value);
      return true;
    }
    return false;
  }
};

module.exports = { ipcHandlers }; 