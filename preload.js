const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('getConfig'),
  updateConfig: (config) => ipcRenderer.invoke('updateConfig', config),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('setAlwaysOnTop', value),
  
  // 执行操作
  executeNow: () => ipcRenderer.invoke('executeNow'),
  openTargetDir: () => ipcRenderer.invoke('openTargetDir'),
  compressSelected: (quality) => ipcRenderer.invoke('compressSelected', quality),
  
  // 窗口控制
  setWindowSize: (width, height, hasFrame) => ipcRenderer.invoke('setWindowSize', width, height, hasFrame),
  closeWindow: () => ipcRenderer.invoke('closeWindow'),
  exitApp: () => ipcRenderer.invoke('exitApp'),
  
  // 通知事件
  onError: (callback) => ipcRenderer.on('error', (_, data) => callback(data)),
  onSuccess: (callback) => ipcRenderer.on('success', (_, data) => callback(data)),
  onWindowResize: (callback) => ipcRenderer.on('window-resized', (_, data) => callback(data)),
  
  // 配置文件管理
  getAllProfiles: () => ipcRenderer.invoke('getAllProfiles'),
  saveProfile: (profileName, config) => ipcRenderer.invoke('saveProfile', profileName, config),
  applyProfile: (profileName) => ipcRenderer.invoke('applyProfile', profileName),
  deleteProfile: (profileName) => ipcRenderer.invoke('deleteProfile', profileName)
}); 