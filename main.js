const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const SimpleStore = require('./simple-store.js');

// try {
//   console.log('Sharp module loaded successfully');
// } catch (error) {
//   console.error('Failed to load sharp module:', error);
// }

// 使用 SimpleStore 替代 electron-store
const store = new SimpleStore({ name: 'config' });
const profileStore = new SimpleStore({ name: 'profiles' });

// 创建默认配置文件（如果不存在）
if (!profileStore.has('profiles')) {
  const defaultProfile = {
    targetDir: '',
    format: 'jpeg',
    quality: 80,
    imageCompression: 80,
    keepOriginalName: true,
    alwaysOnTop: true,
    showConfigOnStartup: true,
    width: 800,
    height: 600,
    hasFrame: false,
    pathAliases: {"@": "src"},
    compressOnCopy: false
  };

  profileStore.set({
    profiles: { 'default': defaultProfile },
    activeProfile: 'default'
  });
  
  // 将默认配置应用到当前配置
  store.set('config', defaultProfile);
}

// 确保配置存在
if (!store.has('config')) {
  const defaultConfig = {
    targetDir: path.join(app.getPath('pictures'), 'CopyInsert'),
    format: 'jpeg',
    quality: 80,
    imageCompression: 80,
    keepOriginalName: true,
    alwaysOnTop: true,
    showConfigOnStartup: true,
    width: 800,
    height: 600,
    hasFrame: false,
    pathAliases: {"@": "src"},
    compressOnCopy: false
  };
  store.set('config', defaultConfig);
}

// 确保目标目录存在
const config = store.get('config');
if (config && config.targetDir && !fs.existsSync(config.targetDir)) {
  try {
    fs.mkdirSync(config.targetDir, { recursive: true });
  } catch (error) {
    console.error('创建目标目录失败:', error);
  }
}

// Generate unique filename
function generateUniqueFilename(originalName, extension) {
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${originalName}_${timestamp}_${randomString}.${extension}`;
}

// 获取选中的文件路径（从系统剪贴板）
function getSelectedFilePaths() {
  if (process.platform === 'darwin') {
    // macOS使用NSPasteboard
    try {
      // 尝试获取剪贴板中的文件路径
      const text = clipboard.read('public.file-url');
      if (!text) return null;
      
      const selectedFiles = text.split('\n')
        .filter(url => url.trim() !== '')
        .map(url => {
          // 移除file://前缀并处理URL编码
          return decodeURI(url.replace('file://', ''));
        });
      
      console.log('选中的文件:', selectedFiles);
      return selectedFiles.length > 0 ? selectedFiles : null;
    } catch (error) {
      console.error('读取剪贴板文件失败:', error);
      return null;
    }
  } else if (process.platform === 'win32') {
    // Windows处理
    try {
      const rawBuffer = clipboard.readBuffer('FileNameW');
      if (!rawBuffer || rawBuffer.length === 0) return null;
      
      const selectedFiles = rawBuffer.toString('ucs2')
        .replace(/\\/g, '/')
        .replace(/\u0000/g, '\n')
        .trim()
        .split('\n')
        .filter(file => file.trim() !== '');
      
      console.log('选中的文件:', selectedFiles);
      return selectedFiles.length > 0 ? selectedFiles : null;
    } catch (error) {
      console.error('读取剪贴板文件失败:', error);
      return null;
    }
  }
  
  return null;
}

// 尝试另一种方式获取选中的文件（使用clipboard.readImage或其他格式）
function getSelectedFilesAlternative() {
  try {
    // 检查剪贴板是否有文件列表（新方法）
    const formats = clipboard.availableFormats();
    console.log('可用的剪贴板格式:', formats);
    
    // macOS特有的格式
    if (process.platform === 'darwin') {
      if (formats.includes('NSFilenamesPboardType')) {
        return clipboard.read('NSFilenamesPboardType').split('\n').filter(Boolean);
      }
      
      if (formats.includes('Apple files promise pasteboard type')) {
        return clipboard.read('Apple files promise pasteboard type').split('\n').filter(Boolean);
      }
    }
    
    // 通用格式
    for (const format of formats) {
      if (format.includes('file') || format.includes('File')) {
        const content = clipboard.read(format);
        if (content) {
          const files = content.split('\n').filter(Boolean);
          if (files.length > 0) return files;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('另一种方式读取剪贴板失败:', error);
    return null;
  }
}

// 获取macOS Finder中选中的文件（使用AppleScript）
function getFinderSelectedFiles() {
  if (process.platform !== 'darwin') {
    return null; // 仅支持macOS
  }
  
  try {
    const { execSync } = require('child_process');
    
    // 执行AppleScript命令获取Finder中选中的文件
    const script = `
    tell application "Finder"
      set theSelection to selection
      set selectedItems to {}
      repeat with theItem in theSelection
        set end of selectedItems to (POSIX path of (theItem as alias))
      end repeat
      return selectedItems
    end tell
    `;
    
    // 执行AppleScript并解析结果
    const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
    
    if (result) {
      // 解析返回的文件路径（AppleScript返回的是逗号分隔的路径）
      const files = result.trim().split(',').map(path => path.trim());
      console.log('Finder选中的文件:', files);
      return files.length > 0 ? files : null;
    }
  } catch (error) {
    console.error('获取Finder选中文件失败:', error);
  }
  
  return null;
}

// 为其他平台提供的获取文件选择函数
function getExplorerSelectedFiles() {
  // Windows可以使用PowerShell或COM接口获取，但复杂度较高
  // 此处暂不实现，可后续扩展
  return null;
}

// 从任何可能的来源获取选中的文件
function getSelectedFiles() {
  // 先尝试从Finder/文件管理器获取
  let files = process.platform === 'darwin' ? getFinderSelectedFiles() : getExplorerSelectedFiles();
  if (files && files.length > 0) return files;
  
  // 尝试从剪贴板获取
  files = getSelectedFilePaths();
  if (files && files.length > 0) return files;
  
  // 尝试另一种剪贴板方法
  files = getSelectedFilesAlternative();
  if (files && files.length > 0) return files;
  
  return null;
}

// 压缩图片函数
async function compressImageInPlace(filePath, quality) {
  try {
    const extname = path.extname(filePath).toLowerCase();
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    
    if (!supportedFormats.includes(extname)) {
      return { 
        success: false, 
        path: filePath, 
        error: '不支持的文件格式' 
      };
    }
    
    // 生成复制文件的路径
    const originalName = path.basename(filePath, extname);
    const copyFilename = `${originalName}_compressed${extname}`;
    const copyPath = path.join(path.dirname(filePath), copyFilename);
    
    // 复制原文件
    fs.copyFileSync(filePath, copyPath);
    
    const config = store.get();
    const compressQuality = quality || config.quality || 80;
    
    let sharpInstance = sharp(copyPath);
    
    // 根据文件格式设置压缩参数
    switch (extname) {
      case '.jpg':
      case '.jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: compressQuality });
        break;
      case '.png':
        sharpInstance = sharpInstance.png({ quality: compressQuality });
        break;
      case '.webp':
        sharpInstance = sharpInstance.webp({ quality: compressQuality });
        break;
      case '.avif':
        sharpInstance = sharpInstance.avif({ quality: compressQuality });
        break;
      default:
        sharpInstance = sharpInstance.jpeg({ quality: compressQuality });
    }
    
    // 创建临时文件路径
    const tempPath = `${copyPath}.temp${extname}`;
    
    // 保存到临时文件
    await sharpInstance.toFile(tempPath);
    
    // 获取原始文件和压缩后文件大小
    const originalSize = fs.statSync(filePath).size;
    const compressedSize = fs.statSync(tempPath).size;
    
    // 用压缩后的文件替换复制的文件
    fs.unlinkSync(copyPath);
    fs.renameSync(tempPath, copyPath);
    
    // 计算压缩比例
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    return {
      success: true,
      path: copyPath,
      originalSize,
      compressedSize,
      compressionRatio,
      quality: compressQuality
    };
  } catch (error) {
    console.error('压缩图片失败:', error);
    return {
      success: false,
      path: filePath,
      error: error.message
    };
  }
}

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: store.get('width') || 800,
    height: store.get('height') || 600,
    frame: store.get('hasFrame') !== false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setAlwaysOnTop(store.get('alwaysOnTop') || false);

  if (process.platform === 'darwin') {
    registerMacOSMenu();
  }
}

// Image processing function
async function processImage(filePaths, quality) {
  const results = [];
  const config = store.get('config');
  const targetDir = config.targetDir;
  const pathAliases = config.pathAliases || {};
  const compressionQuality = quality || config.imageCompression || 80;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const filePath of filePaths) {
    try {
      const originalName = path.basename(filePath);
      const ext = path.extname(originalName).toLowerCase();
      
      // 检查是否为支持的图片格式
      const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
      if (!supportedFormats.includes(ext)) {
        results.push({
          originalPath: filePath,
          error: '不支持的文件格式',
          success: false
        });
        mainWindow.webContents.send('error', `不支持的文件格式: ${originalName}`);
        continue;
      }

      let targetFilename = originalName;
      let counter = 1;
      
      // 如果目标文件已存在，则添加序号
      while (fs.existsSync(path.join(targetDir, targetFilename))) {
        const nameWithoutExt = path.basename(originalName, ext);
        targetFilename = `${nameWithoutExt}_${counter}${ext}`;
        counter++;
      }
      
      const targetPath = path.join(targetDir, targetFilename);
      
      // 处理图片压缩
      let sharpInstance = sharp(filePath);
      const format = ext.replace('.', '');
      
      // 根据文件格式设置压缩参数
      switch (format) {
        case 'jpg':
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality: compressionQuality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality: compressionQuality });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality: compressionQuality });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({ quality: compressionQuality });
          break;
        default:
          // 对于其他格式（如 gif），直接复制
          fs.copyFileSync(filePath, targetPath);
          break;
      }

      // 如果是可压缩的格式，执行压缩
      if (format !== 'gif') {
        await sharpInstance.toFile(targetPath);
      }

      // 生成用于剪贴板的路径（使用别名替换）
      let clipboardPath = targetPath;
      for (const [alias, value] of Object.entries(pathAliases)) {
        if (targetPath.includes(value)) {
          clipboardPath = targetPath.replace(value, alias);
          // 只保留别名开始的部分
          const aliasIndex = clipboardPath.indexOf(alias);
          if (aliasIndex !== -1) {
            clipboardPath = clipboardPath.substring(aliasIndex);
          }
          break;
        }
      }

      // 获取压缩前后的文件大小
      const originalSize = fs.statSync(filePath).size;
      const compressedSize = fs.statSync(targetPath).size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      
      results.push({
        originalPath: filePath,
        targetPath: targetPath,
        clipboardPath: clipboardPath,
        compressionRatio: compressionRatio,
        success: true
      });
      
      mainWindow.webContents.send('success', `已压缩并复制文件: ${targetFilename}，压缩率: ${compressionRatio}%`);
    } catch (error) {
      console.error('处理图片失败:', error);
      
      results.push({
        originalPath: filePath,
        error: error.message,
        success: false
      });
      
      mainWindow.webContents.send('error', `处理文件失败: ${path.basename(filePath)}`);
    }
  }

  // 如果有成功复制的文件，将路径写入剪贴板
  if (results.length > 0 && results.some(r => r.success)) {
    const clipboardText = results
      .filter(r => r.success)
      .map(r => r.clipboardPath)
      .join('\n');
    clipboard.writeText(clipboardText);
  }
  
  return results;
}

// macOS context menu
function registerMacOSMenu() {
  app.dock.setMenu(Menu.buildFromTemplate([
    {
      label: 'Copy and Process Selected Files',
      click: async () => {
        const result = await dialog.showOpenDialog({
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
          ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          processImage(result.filePaths);
        }
      }
    }
  ]));
}

// Windows/Linux context menu
if (process.platform === 'win32' || process.platform === 'linux') {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Copy and Process Selected Files',
      click: async () => {
        const result = await dialog.showOpenDialog({
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
          ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
          processImage(result.filePaths);
        }
      }
    }
  ]);
  
  app.on('ready', () => {
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      contextMenu.popup();
    });
  });
}

// Application lifecycle events
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('updateConfig', async (event, config) => {
  store.set(config);
  return { success: true };
});

ipcMain.handle('getConfig', async () => {
  return store.get();
});

ipcMain.handle('setAlwaysOnTop', async (event, value) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(value);
    store.set('alwaysOnTop', value);
  }
  return { success: true };
});

ipcMain.handle('setCompressOnCopy', async (event, value) => {
  store.set('compressOnCopy', value);
  return { success: true };
});

ipcMain.handle('executeNow', async () => {
  // 尝试获取选中的文件
  const selectedFiles = getSelectedFiles();
  
  if (selectedFiles && selectedFiles.length > 0) {
    console.log('获取到选中的文件:', selectedFiles);
    // 处理选中的文件
    const results = await processImage(selectedFiles);
    const successCount = results.filter(r => r.success).length;
    return { 
      success: true, 
      message: `已处理 ${successCount} 个文件，路径已复制到剪贴板`
    };
  } else {
    console.log('未能获取选中的文件，使用文件选择对话框');
    // 如果没有选中的文件，使用文件选择对话框
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const results = await processImage(result.filePaths);
      const successCount = results.filter(r => r.success).length;
      return { 
        success: true, 
        message: `已处理 ${successCount} 个文件，路径已复制到剪贴板`
      };
    }
  }
  
  return { canceled: true };
});

ipcMain.handle('compressSelected', async (event, quality) => {
  // 尝试获取选中的文件
  const selectedFiles = getSelectedFiles();
  
  if (selectedFiles && selectedFiles.length > 0) {
    // 原地压缩选中的图片
    const results = [];
    let compressedCount = 0;
    let failedCount = 0;
    
    for (const filePath of selectedFiles) {
      const result = await compressImageInPlace(filePath, quality);
      results.push(result);
      
      if (result.success) {
        compressedCount++;
        mainWindow.webContents.send('success', `压缩完成: ${path.basename(filePath)}，减小了 ${result.compressionRatio}%，使用压缩质量: ${result.quality}`);
      } else {
        failedCount++;
        mainWindow.webContents.send('error', `压缩失败: ${path.basename(filePath)}，错误: ${result.error}`);
      }
    }
    
    return { 
      success: true, 
      quality: quality || store.get('config').quality || 80,
      results,
      compressedCount,
      failedCount,
      message: `压缩成功: ${compressedCount} 个图片已处理，使用压缩质量: ${quality}，平均减小了 ${results.reduce((sum, r) => sum + parseFloat(r.compressionRatio || 0), 0) / compressedCount}%`
    };
  } else {
    console.log('未能获取选中的文件，使用文件选择对话框');
    // 如果没有选中的文件，使用文件选择对话框
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const results = [];
      let compressedCount = 0;
      let failedCount = 0;
      
      for (const filePath of result.filePaths) {
        const compressResult = await compressImageInPlace(filePath, quality);
        results.push(compressResult);
        
        if (compressResult.success) {
          compressedCount++;
          mainWindow.webContents.send('success', `压缩完成: ${path.basename(filePath)}，减小了 ${compressResult.compressionRatio}%，使用压缩质量: ${compressResult.quality}`);
        } else {
          failedCount++;
          mainWindow.webContents.send('error', `压缩失败: ${path.basename(filePath)}，错误: ${compressResult.error}`);
        }
      }
      
      return { 
        success: true, 
        quality: quality || store.get('config').quality || 80,
        results,
        compressedCount,
        failedCount,
        message: `压缩成功: ${compressedCount} 个图片已处理，使用压缩质量: ${quality}，平均减小了 ${results.reduce((sum, r) => sum + parseFloat(r.compressionRatio || 0), 0) / compressedCount}%`
      };
    }
  }
  
  return { canceled: true };
});

ipcMain.handle('setWindowSize', async (event, width, height, hasFrame) => {
  if (mainWindow) {
    store.set({
      width: width,
      height: height,
      hasFrame: hasFrame
    });
    
    mainWindow.setSize(width, height);
    // Need to restart application to apply frame changes
    mainWindow.webContents.send('window-resized', { width, height, hasFrame });
  }
  return { success: true };
});

ipcMain.handle('openTargetDir', async () => {
  const config = store.get('config');
  if (config && config.targetDir && fs.existsSync(config.targetDir)) {
    shell.openPath(config.targetDir);
    return { success: true };
  } else {
    return { success: false, error: '目标目录不存在' };
  }
});

// Profile management
ipcMain.handle('getAllProfiles', async () => {
  return profileStore.get() || { profiles: {}, activeProfile: 'default' };
});

ipcMain.handle('saveProfile', async (event, profileName, config) => {
  try {
    const profilesData = profileStore.get();
    const profiles = profilesData.profiles || {};
    
    // Update the profile
    profiles[profileName] = config;
    
    // Save the profiles
    profileStore.set({
      ...profilesData,
      profiles: profiles,
      activeProfile: profileName
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save profile:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('applyProfile', async (event, profileName) => {
  try {
    const profilesData = profileStore.get();
    const profiles = profilesData.profiles || {};
    
    if (profiles[profileName]) {
      // Update the current active profile
      profileStore.set({
        ...profilesData,
        activeProfile: profileName
      });
      
      // Apply the profile config to the main config
      store.set('config', profiles[profileName]);
      
      return { success: true, config: profiles[profileName] };
    } else {
      return { success: false, error: '配置文件不存在' };
    }
  } catch (error) {
    console.error('应用配置文件失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('deleteProfile', async (event, profileName) => {
  try {
    const profilesData = profileStore.get();
    const profiles = profilesData.profiles || {};
    
    if (profiles[profileName]) {
      // Remove the profile
      delete profiles[profileName];
      
      // Update active profile if needed
      let activeProfile = profilesData.activeProfile;
      if (activeProfile === profileName) {
        activeProfile = 'default';
      }
      
      // Save the profiles
      profileStore.set({
        ...profilesData,
        profiles: profiles,
        activeProfile: activeProfile
      });
      
      return { success: true };
    } else {
      return { success: false, error: 'Profile does not exist' };
    }
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('closeWindow', () => {
  if (mainWindow) {
    mainWindow.close();
  }
  return { success: true };
});

ipcMain.handle('exitApp', () => {
  app.quit();
  return { success: true };
});

// 添加模式切换处理
ipcMain.on('toggle-compact-mode', (event, isCompact) => {
  if (mainWindow) {
    mainWindow.webContents.send('compact-mode-changed', isCompact);
    store.set('compactMode', isCompact);
  }
});

// 添加退出应用处理
ipcMain.on('quit-app', () => {
  app.quit();
});