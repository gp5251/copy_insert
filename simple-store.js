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
    // 保留此错误日志，它对调试存储问题很重要
    console.error('读取存储文件失败:', error);
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
    // 保留此错误日志，它对调试存储问题很重要
    console.error('写入存储文件失败:', error);
  }
} 