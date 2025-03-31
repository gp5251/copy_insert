const { app, clipboard, ipcMain, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec: execCallback } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');
let sharp;

try {
  sharp = require('sharp');
} catch (error) {
  logger.error('加载 sharp 模块失败:', error);
}

/**
 * 简单的存储类，用于替代 electron-store
 */
class SimpleStore {
  /**
   * 创建一个新的存储实例
   * @param {Object} options 配置选项
   * @param {string} options.name 存储文件名
   * @param {string} options.cwd 存储目录
   * @param {string} options.fileExtension 文件扩展名
   */
  constructor(options = {}) {
    this.name = options.name || 'config';
    this.cwd = options.cwd || app.getPath('userData');
    this.fileExtension = options.fileExtension || 'json';
    this.filePath = path.join(this.cwd, `${this.name}.${this.fileExtension}`);
    
    // 确保目录存在
    if (!fs.existsSync(this.cwd)) {
      fs.mkdirSync(this.cwd, { recursive: true });
    }
    
    // 初始化存储
    this.data = this.read();
  }
  
  /**
   * 读取存储文件
   * @returns {Object} 存储的数据
   */
  read() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('读取存储文件失败:', error);
    }
    return {};
  }
  
  /**
   * 写入存储文件
   */
  write() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      logger.error('写入存储文件失败:', error);
    }
  }
  
  /**
   * 获取存储的值
   * @param {string} key 键名
   * @param {*} defaultValue 默认值
   * @returns {*} 存储的值
   */
  get(key) {
    if (key === undefined) {
      return this.data;
    }
    return this.data[key];
  }
  
  /**
   * 设置存储的值
   * @param {string|Object} keyOrObject 键名或对象
   * @param {*} value 值
   */
  set(keyOrObject, value) {
    if (typeof keyOrObject === 'object') {
      this.data = { ...this.data, ...keyOrObject };
    } else {
      this.data[keyOrObject] = value;
    }
    this.write();
  }
  
  /**
   * 删除存储的值
   * @param {string} key 键名
   */
  delete(key) {
    delete this.data[key];
    this.write();
  }
  
  /**
   * 清空存储
   */
  clear() {
    this.data = {};
    this.write();
  }
  
  /**
   * 检查是否存在键
   * @param {string} key 键名
   * @returns {boolean} 是否存在
   */
  has(key) {
    return key in this.data;
  }
}

// 配置存储
const store = new SimpleStore({
  cwd: app.getPath('userData'),
  name: 'config',
  fileExtension: 'json'
});

// 添加配置项存储
const configStore = new SimpleStore({
  cwd: app.getPath('userData'),
  name: 'configProfiles',
  fileExtension: 'json'
});

let mainWindow;

const exec = promisify(execCallback);

function createWindow() {
  const config = store.get('config');
  const isSimpleMode = config && config.simpleMode;

  mainWindow = new BrowserWindow({
    width: isSimpleMode ? 190 : 380,
    height: isSimpleMode ? 90 : 390,
    useContentSize: true,
    resizable: true,
    minWidt: isSimpleMode ? 190 : 390,
    minHeight: 80,
    frame: false,
    titleBarStyle: 'customButtonsOnHover',
    titleBarOverlay: {
      color: 'transparent',
      symbolColor: 'transparent',
      height: 0
    },
    trafficLightPosition: { x: -100, y: -100 },
    transparent: true,
    vibrancy: 'window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'preload.js')
    }
  });

  if (isSimpleMode) {
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(false);
    }
    mainWindow.on('enter-full-screen', () => {
      mainWindow.setWindowButtonVisibility(false);
    });
    mainWindow.on('leave-full-screen', () => {
      mainWindow.setWindowButtonVisibility(false);
    });
  }

  // 监听窗口大小变化
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize();
    mainWindow.webContents.send('window-resized', { width, height });
  });

  // 设置置顶状态
  if (config && config.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true);
  }

  // 加载应用
  mainWindow.loadFile('index.html');

  // 监听模式切换事件
  // ipcMain.on('toggle-mode', (event, isCompactMode) => {
  //   if (isCompactMode) {
  //     mainWindow.setSize(190, 95); // 精简模式尺寸
  //     mainWindow.setMinimumSize(190, 95);
  //   } else {
  //     mainWindow.setSize(380, 360); // 正常模式尺寸
  //     mainWindow.setMinimumSize(380, 360);
  //   }
  // });
}

// 默认配置
const DEFAULT_CONFIG = {
  targetDir: path.join(app.getPath('home'), 'Documents', 'CopyInsert'),
  imageCompression: 80,
  pathAliases: {
    '@': 'assets'
  },
  alwaysOnTop: false,
  simpleMode: false
};

// 确保配置存在
if (!store.get('config')) {
  store.set('config', DEFAULT_CONFIG);
}

// 确保配置项存储存在
if (!configStore.get('profiles')) {
  configStore.set('profiles', {
    'default': DEFAULT_CONFIG
  });
  configStore.set('activeProfile', 'default');
}

// 确保目标目录存在
function ensureTargetDir() {
  const config = store.get('config');
  if (!fs.existsSync(config.targetDir)) {
    fs.mkdirSync(config.targetDir, { recursive: true });
  }
}

// 生成唯一文件名
function generateUniqueFilename(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  let counter = 1;
  let newPath = filePath;

  while (fs.existsSync(newPath)) {
    newPath = path.join(dir, `${baseName}_${counter}${ext}`);
    counter++;
  }

  return newPath;
}

// 支持的图片格式
const SUPPORTED_IMAGE_FORMATS = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
  '.avif': 'avif',
  '.gif': 'gif',
  '.tiff': 'tiff',
  '.heif': 'heif',
  '.heic': 'heif'
};

// 处理图片
async function processImage(sourcePath, targetPath) {
  const config = store.get('config');
  const ext = path.extname(sourcePath).toLowerCase();
  const format = SUPPORTED_IMAGE_FORMATS[ext] || 'jpeg';
  
  let sharpInstance = sharp(sourcePath);
  
  // 根据不同格式设置压缩选项
  switch (format) {
    case 'jpeg':
      sharpInstance = sharpInstance.jpeg({ quality: config.imageCompression });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({ quality: config.imageCompression });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality: config.imageCompression });
      break;
    case 'avif':
      sharpInstance = sharpInstance.avif({ quality: config.imageCompression });
      break;
    case 'heif':
      sharpInstance = sharpInstance.heif({ quality: config.imageCompression });
      break;
    case 'tiff':
      sharpInstance = sharpInstance.tiff({ quality: config.imageCompression });
      break;
    // GIF 格式不支持质量压缩，但支持调整颜色数量
    case 'gif':
      sharpInstance = sharpInstance.gif();
      break;
  }

  await sharpInstance.toFile(targetPath);
}

// 添加路径别名处理函数
function applyPathAlias(filePath, config) {
  const targetDir = config.targetDir;
  const aliases = config.pathAliases;
  
  // 获取第一个别名配置
  const [alias, aliasValue] = Object.entries(aliases)[0];
  
  // 在目标路径中查找别名值
  const parts = targetDir.split(aliasValue);
  if (parts.length < 2) {
    return filePath;
  }

  // 获取别名值之后的路径部分
  const pathAfterAlias = targetDir.substring(targetDir.indexOf(aliasValue) + aliasValue.length);

  // 如果是目标目录本身
  if (filePath === targetDir) {
    const normalizedAlias = alias.startsWith('@') ? alias : '@';
    return normalizedAlias + pathAfterAlias;
  }

  // 获取文件相对于目标目录的路径
  const relativePath = path.relative(targetDir, filePath);

  // 构建最终路径
  const normalizedAlias = alias.startsWith('@') ? alias : '@';
  const finalPath = normalizedAlias + pathAfterAlias + '/' + relativePath;
  
  return finalPath;
}

// 修改 getSelectedFiles 函数
async function getSelectedFiles() {
  if (process.platform === 'darwin') {
    const script = `
      osascript -e '
        tell application "Finder"
          try
            if not (exists window 1) then
              display notification "请先打开Finder窗口并选择文件"
              return ""
            end if
            set theSelection to selection
            if theSelection is {} then
              display notification "请先选择文件"
              return ""
            end if
            set output to ""
            repeat with theItem in theSelection
              try
                set itemPath to POSIX path of (theItem as alias)
                set output to output & itemPath & "\n"
              on error errMsg
                display notification "处理文件时出错: " & errMsg
              end try
            end repeat
            return output
          on error errMsg
            display notification "获取文件失败: " & errMsg
            return ""
          end try
        end tell'
    `;

    try {
      const { stdout, stderr } = await exec(script);
      
      const files = stdout.trim().split('\n').filter(Boolean);
      return files;
    } catch (error) {
      logger.error('获取macOS文件选择失败:', error);
      if (error.message.includes('not authorized') || error.message.includes('permission')) {
        mainWindow.webContents.send('error', '需要授权访问Finder。请在系统偏好设置中允许应用访问文件和文件夹。');
      }
      throw error;
    }
  } else if (process.platform === 'win32') {
    const script = `
      Add-Type -AssemblyName Microsoft.VisualBasic
      $explorer = New-Object -ComObject Shell.Application
      $selectedItems = @()
      foreach ($window in $explorer.Windows()) {
        $selectedItems += @($window.Document.SelectedItems() | ForEach-Object { $_.Path })
      }
      $selectedItems -join "\n"
    `;
    
    try {
      const { stdout } = await exec('powershell -command "' + script + '"');
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      logger.error('获取Windows文件选择失败:', error);
      return [];
    }
  }
  
  return [];
}

// 处理文件复制
async function handleFileCopy(filePaths) {
  logger.info('开始处理文件复制:', filePaths);
  const config = store.get('config');
  ensureTargetDir();

  const results = [];
  for (const sourcePath of filePaths) {
    logger.debug('处理文件:', sourcePath);
    const fileName = path.basename(sourcePath);
    let targetPath = path.join(config.targetDir, fileName);
    targetPath = generateUniqueFilename(targetPath);
    logger.debug('目标路径:', targetPath);

    const ext = path.extname(sourcePath).toLowerCase();
    const isImage = Object.keys(SUPPORTED_IMAGE_FORMATS).includes(ext);

    try {
      if (isImage) {
        logger.info('处理图片文件...');
        await processImage(sourcePath, targetPath);
        logger.info('图片处理完成');
      } else {
        logger.info('复制普通文件...');
        fs.copyFileSync(sourcePath, targetPath);
        logger.info('文件复制完成');
      }

      results.push(targetPath);
    } catch (error) {
      logger.error(`处理文件失败: ${sourcePath}`, error);
      mainWindow.webContents.send('error', `处理文件失败: ${fileName}`);
    }
  }

  if (results.length > 0) {
    // 生成剪贴板路径
    let clipboardText;
    if (results.length === 1) {
      // 对单个文件应用路径别名
      clipboardText = applyPathAlias(results[0], config);
    } else {
      // 对目录应用路径别名
      clipboardText = applyPathAlias(config.targetDir, config);
    }

    logger.info('写入剪贴板:', clipboardText);
    clipboard.writeText(clipboardText);
    mainWindow.webContents.send('success', `已处理 ${results.length} 个文件`);
  }
}

// 添加右键菜单功能
function setupContextMenu() {
  if (process.platform === 'darwin') {
    // macOS 系统服务菜单
    const menu = Menu.buildFromTemplate([
      {
        label: 'Services',
        submenu: [{
          label: 'CopyInsert - 复制并处理',
          click: async () => {
            try {
              const files = await getSelectedFiles();
              if (files.length > 0) {
                await handleFileCopy(files);
              } else {
                mainWindow.webContents.send('error', '请先选择文件');
              }
            } catch (error) {
              logger.error('处理文件失败:', error);
              mainWindow.webContents.send('error', error.message);
            }
          }
        }]
      }
    ]);
    if (app.dock) {
      app.dock.setMenu(menu);
    }
  } else if (process.platform === 'win32') {
    // Windows 右键菜单
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'CopyInsert - 复制并处理',
        click: async () => {
          try {
            const files = await getSelectedFiles();
            if (files.length > 0) {
              await handleFileCopy(files);
            } else {
              mainWindow.webContents.send('error', '请先选择文件');
            }
          } catch (error) {
            logger.error('处理文件失败:', error);
            mainWindow.webContents.send('error', error.message);
          }
        }
      }
    ]);

    app.setUserTasks([
      {
        program: process.execPath,
        arguments: '',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'CopyInsert - 复制并处理',
        description: '复制并处理选中的文件'
      }
    ]);
  }
}

app.whenReady().then(() => {
  createWindow();
  setupContextMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 处理 IPC 通信
ipcMain.handle('updateConfig', (event, newConfig) => {
  store.set('config', { ...store.get('config'), ...newConfig });
});

ipcMain.handle('getConfig', () => {
  return store.get('config');
});

// 添加获取所有配置项的处理函数
ipcMain.handle('getAllProfiles', () => {
  return {
    profiles: configStore.get('profiles'),
    activeProfile: configStore.get('activeProfile')
  };
});

// 添加保存配置项的处理函数
ipcMain.handle('saveProfile', (event, profileName, config) => {
  const profiles = configStore.get('profiles') || {};
  profiles[profileName] = config;
  configStore.set('profiles', profiles);
  return { success: true };
});

// 添加应用配置项的处理函数
ipcMain.handle('applyProfile', (event, profileName) => {
  const profiles = configStore.get('profiles') || {};
  if (profiles[profileName]) {
    store.set('config', profiles[profileName]);
    configStore.set('activeProfile', profileName);
    return { success: true, config: profiles[profileName] };
  }
  return { success: false, message: '配置项不存在' };
});

// 添加删除配置项的处理函数
ipcMain.handle('deleteProfile', (event, profileName) => {
  const profiles = configStore.get('profiles') || {};
  const activeProfile = configStore.get('activeProfile');
  
  if (profileName === 'default') {
    return { success: false, message: '不能删除默认配置' };
  }
  
  if (profiles[profileName]) {
    delete profiles[profileName];
    configStore.set('profiles', profiles);
    
    // 如果删除的是当前激活的配置，则切换到默认配置
    if (activeProfile === profileName) {
      configStore.set('activeProfile', 'default');
      store.set('config', profiles['default']);
    }
    
    return { success: true };
  }
  return { success: false, message: '配置项不存在' };
});

// 添加置顶控制处理
ipcMain.handle('setAlwaysOnTop', (event, value) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(value);
    return true;
  }
  return false;
});

// 处理立即执行请求
ipcMain.handle('executeNow', async () => {
  try {
    const files = await getSelectedFiles();
    if (files.length > 0) {
      await handleFileCopy(files);
      return { success: true, message: '执行成功' };
    } else {
      throw new Error('请先在Finder中选择文件');
    }
  } catch (error) {
    logger.error('执行失败:', error);
    // 确保错误信息被正确传递到渲染进程
    throw new Error(error.message || '执行失败');
  }
});

// 处理窗口大小调整和边框设置
ipcMain.handle('setWindowSize', async (event, width, height, hasFrame) => {
  if (mainWindow) {
    const position = mainWindow.getPosition();
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
    
    // 保存当前窗口状态
    const currentConfig = store.get('config');
    store.set('config', {
      ...currentConfig,
      simpleMode: !hasFrame
    });
    
    // 设置窗口大小
    mainWindow.setSize(width, height);
    mainWindow.setResizable(true);
    
    // 设置窗口按钮可见性
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(!hasFrame);
    }
    
    // 恢复置顶状态
    if (isAlwaysOnTop) {
      mainWindow.setAlwaysOnTop(true);
    }
    
    return true;
  }
  return false;
});

// 添加打开目标目录的 IPC 处理函数
ipcMain.handle('openTargetDir', async () => {
    try {
        const config = store.get('config');
        if (!fs.existsSync(config.targetDir)) {
            ensureTargetDir();
        }
        await shell.openPath(config.targetDir);
        return { success: true };
    } catch (error) {
        logger.error('打开目标目录失败:', error);
        return { success: false, message: error.message };
    }
});

// 添加关闭窗口的 IPC 处理函数
ipcMain.handle('closeWindow', () => {
  if (mainWindow) {
    mainWindow.close();
    return true;
  }
  return false;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});