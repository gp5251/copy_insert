import { app, clipboard, ipcMain, BrowserWindow, Menu } from 'electron';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置 electron-store
Store.initRenderer();
const store = new Store({
  cwd: app.getPath('userData'),
  name: 'config',
  fileExtension: 'json',
  clearInvalidConfig: true
});

let mainWindow;

const exec = promisify(execCallback);

function createWindow() {
  const config = store.get('config');
  const isSimpleMode = config && config.simpleMode;

  mainWindow = new BrowserWindow({
    width: isSimpleMode ? 380 : 380,
    height: isSimpleMode ? 50 : 360,
    useContentSize: true,
    resizable: true,
    minWidth: 380,
    minHeight: 40,
    frame: !isSimpleMode,
    transparent: true,
    titleBarStyle: isSimpleMode ? 'hidden' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'preload.js')
    }
  });

  // 监听窗口大小变化
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize();
    mainWindow.webContents.send('window-resized', { width, height });
  });

  // 设置置顶状态
  if (config && config.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true);
  }

  mainWindow.loadFile('index.html');
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
  
  console.log('处理路径别名:', {
    原始路径: filePath,
    目标目录: targetDir,
    别名配置: aliases
  });

  // 获取第一个别名配置
  const [alias, aliasValue] = Object.entries(aliases)[0];
  
  // 在目标路径中查找别名值
  const parts = targetDir.split(aliasValue);
  if (parts.length < 2) {
    console.log('未找到别名值在目标路径中的位置');
    return filePath;
  }

  // 获取别名值之后的路径部分
  const pathAfterAlias = targetDir.substring(targetDir.indexOf(aliasValue) + aliasValue.length);
  console.log('别名截断信息:', {
    别名值: aliasValue,
    截断后路径: pathAfterAlias
  });

  // 如果是目标目录本身
  if (filePath === targetDir) {
    const normalizedAlias = alias.startsWith('@') ? alias : '@';
    return normalizedAlias + pathAfterAlias;
  }

  // 获取文件相对于目标目录的路径
  const relativePath = path.relative(targetDir, filePath);
  console.log('相对路径:', relativePath);

  // 构建最终路径
  const normalizedAlias = alias.startsWith('@') ? alias : '@';
  const finalPath = normalizedAlias + pathAfterAlias + '/' + relativePath;
  
  console.log('最终路径:', finalPath);
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
      console.log('执行 AppleScript 获取文件...');
      const { stdout, stderr } = await exec(script);
      console.log('AppleScript 输出:', stdout);
      if (stderr) console.error('AppleScript 错误:', stderr);
      
      const files = stdout.trim().split('\n').filter(Boolean);
      console.log('获取到的文件列表:', files);
      return files;
    } catch (error) {
      console.error('获取macOS文件选择失败:', error);
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
      console.error('获取Windows文件选择失败:', error);
      return [];
    }
  }
  
  return [];
}

// 处理文件复制
async function handleFileCopy(filePaths) {
  console.log('开始处理文件复制:', filePaths);
  const config = store.get('config');
  ensureTargetDir();

  const results = [];
  for (const sourcePath of filePaths) {
    console.log('处理文件:', sourcePath);
    const fileName = path.basename(sourcePath);
    let targetPath = path.join(config.targetDir, fileName);
    targetPath = generateUniqueFilename(targetPath);
    console.log('目标路径:', targetPath);

    const ext = path.extname(sourcePath).toLowerCase();
    const isImage = Object.keys(SUPPORTED_IMAGE_FORMATS).includes(ext);

    try {
      if (isImage) {
        console.log('处理图片文件...');
        await processImage(sourcePath, targetPath);
        console.log('图片处理完成');
      } else {
        console.log('复制普通文件...');
        fs.copyFileSync(sourcePath, targetPath);
        console.log('文件复制完成');
      }

      results.push(targetPath);
    } catch (error) {
      console.error(`处理文件失败: ${sourcePath}`, error);
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

    console.log('写入剪贴板:', clipboardText);
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
              console.error('处理文件失败:', error);
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
            console.error('处理文件失败:', error);
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

// 添加置顶控制处理
ipcMain.handle('setAlwaysOnTop', (event, value) => {
  console.log('设置窗口置顶:', value);
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(value);
    return true;
  }
  return false;
});

// 处理立即执行请求
ipcMain.handle('executeNow', async () => {
  console.log('手动触发执行');
  try {
    const files = await getSelectedFiles();
    console.log('获取到的文件:', files);
    if (files.length > 0) {
      await handleFileCopy(files);
      return { success: true, message: '执行成功' };
    } else {
      throw new Error('请先在Finder中选择文件');
    }
  } catch (error) {
    console.error('执行失败:', error);
    // 确保错误信息被正确传递到渲染进程
    throw new Error(error.message || '执行失败');
  }
});

// 处理窗口大小调整和边框设置
ipcMain.handle('setWindowSize', async (event, width, height, hasFrame) => {
  if (mainWindow) {
    const position = mainWindow.getPosition();
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
    
    // 更新当前窗口的设置
    mainWindow.setSize(width, height);
    mainWindow.setResizable(true);
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(hasFrame);
    }
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    
    return true;
  }
  return false;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 