const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  updateConfig: (config) => ipcRenderer.invoke('updateConfig', config),
  getConfig: () => ipcRenderer.invoke('getConfig'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('setAlwaysOnTop', value),
  executeNow: () => ipcRenderer.invoke('executeNow'),
  onError: (callback) => ipcRenderer.on('error', (event, value) => callback(value)),
  onSuccess: (callback) => ipcRenderer.on('success', (event, value) => callback(value))
}); 