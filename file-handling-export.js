const path = require('path');
const fs = require('fs');
const { clipboard } = require('electron');

// 确保目标目录存在
function ensureTargetDir(store) {
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

// 处理文件复制
async function handleFileCopy(filePaths, store, mainWindow) {
  const config = store.get('config');
  ensureTargetDir(store);

  const results = [];
  for (const sourcePath of filePaths) {
    const fileName = path.basename(sourcePath);
    let targetPath = path.join(config.targetDir, fileName);
    targetPath = generateUniqueFilename(targetPath);

    try {
      fs.copyFileSync(sourcePath, targetPath);
      results.push(targetPath);
    } catch (error) {
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

    clipboard.writeText(clipboardText);
    mainWindow.webContents.send('success', `已处理 ${results.length} 个文件`);
  }
}

// 模拟版本的 getSelectedFiles (实际版本会与操作系统交互)
async function getSelectedFiles() {
  // 这里仅用于测试，实际实现会与操作系统交互
  return ['/test/file1.txt', '/test/file2.jpg'];
}

module.exports = { 
  handleFileCopy,
  getSelectedFiles,
  generateUniqueFilename,
  ensureTargetDir,
  applyPathAlias
}; 