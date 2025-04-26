const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const SimpleStore = require('./simple-store.js');

// try {
//   console.log('Sharp module loaded successfully');
// } catch (error) {
//   console.error('Failed to load sharp module:', error);
// }

// Using SimpleStore instead of electron-store
const store = new SimpleStore({ name: 'config' });
const profileStore = new SimpleStore({ name: 'profiles' });

// Create default profile if it doesn't exist
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
    pathAliases: {"@": "src"}
  };

  profileStore.set({
    profiles: { 'default': defaultProfile },
    activeProfile: 'default'
  });
  
  // Apply default profile to current config
  store.set(defaultProfile);
}

// Ensure configuration exists
if (!store.has('targetDir')) {
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
    pathAliases: {"@": "src"}
  };
  store.set(defaultConfig);
}

// Ensure target directory exists
const targetDir = store.get('targetDir');
if (targetDir && !fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Generate unique filename
function generateUniqueFilename(originalName, extension) {
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${originalName}_${timestamp}_${randomString}.${extension}`;
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
  const config = store.get();
  const targetDir = config.targetDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const filePath of filePaths) {
    try {
      const originalName = path.basename(filePath, path.extname(filePath));
      const targetFormat = config.format || 'jpeg';
      
      let targetFilename;
      if (config.keepOriginalName) {
        targetFilename = `${originalName}.${targetFormat}`;
        let counter = 1;
        while (fs.existsSync(path.join(targetDir, targetFilename))) {
          targetFilename = `${originalName}_${counter}.${targetFormat}`;
          counter++;
        }
      } else {
        targetFilename = generateUniqueFilename(originalName, targetFormat);
      }
      
      const targetPath = path.join(targetDir, targetFilename);
      
      let sharpInstance = sharp(filePath);
      
      // Set output options based on target format
      switch (targetFormat.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          sharpInstance = sharpInstance.jpeg({ quality: quality || config.quality || 80 });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality: quality || config.quality || 80 });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality: quality || config.quality || 80 });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({ quality: quality || config.quality || 80 });
          break;
        default:
          sharpInstance = sharpInstance.jpeg({ quality: quality || config.quality || 80 });
      }
      
      await sharpInstance.toFile(targetPath);
      
      results.push({
        originalPath: filePath,
        targetPath: targetPath,
        success: true
      });
      
      mainWindow.webContents.send('success', {
        message: `Processing successful: ${targetFilename}`,
        path: targetPath
      });
    } catch (error) {
      console.error('Error processing image:', error);
      
      results.push({
        originalPath: filePath,
        error: error.message,
        success: false
      });
      
      mainWindow.webContents.send('error', {
        message: `Processing failed: ${path.basename(filePath)}`,
        error: error.message
      });
    }
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

ipcMain.handle('executeNow', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return processImage(result.filePaths);
  }
  
  return { canceled: true };
});

ipcMain.handle('compressSelected', async (event, quality) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return processImage(result.filePaths, quality);
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
  const targetDir = store.get('targetDir');
  if (fs.existsSync(targetDir)) {
    shell.openPath(targetDir);
    return { success: true };
  } else {
    return { success: false, error: 'Target directory does not exist' };
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
      store.set(profiles[profileName]);
      
      return { success: true, config: profiles[profileName] };
    } else {
      return { success: false, error: 'Profile does not exist' };
    }
  } catch (error) {
    console.error('Failed to apply profile:', error);
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