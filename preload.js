const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  updateConfig: (config) => ipcRenderer.invoke('updateConfig', config),
  getConfig: () => ipcRenderer.invoke('getConfig'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('setAlwaysOnTop', value),
  executeNow: () => ipcRenderer.invoke('executeNow'),
  setWindowSize: (width, height, hasFrame) => ipcRenderer.invoke('setWindowSize', width, height, hasFrame),
  onError: (callback) => ipcRenderer.on('error', (event, value) => callback(value)),
  onSuccess: (callback) => ipcRenderer.on('success', (event, value) => callback(value)),
  onWindowResize: (callback) => ipcRenderer.on('window-resized', (event, value) => callback(value)),
  openTargetDir: () => ipcRenderer.invoke('openTargetDir'),
  getAllProfiles: () => ipcRenderer.invoke('getAllProfiles'),
  saveProfile: (profileName, config) => ipcRenderer.invoke('saveProfile', profileName, config),
  applyProfile: (profileName) => ipcRenderer.invoke('applyProfile', profileName),
  deleteProfile: (profileName) => ipcRenderer.invoke('deleteProfile', profileName),
  closeWindow: () => ipcRenderer.invoke('closeWindow'),
  exitApp: () => ipcRenderer.invoke('closeWindow')
}); 