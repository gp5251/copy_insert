const fs = require('fs');
const path = require('path');

// 安全地尝试导入 Electron
let app;
try {
  const { app: electronApp } = require('electron');
  app = electronApp;
} catch (error) {
  // 如果在测试环境中无法导入 Electron，提供一个模拟
  app = {
    getPath: (key) => {
      if (key === 'userData') {
        return process.cwd();
      }
      return process.cwd();
    }
  };
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
    this.cwd = options.cwd || (app ? app.getPath('userData') : process.cwd());
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
      console.error('写入存储文件失败:', error);
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

module.exports = { SimpleStore }; 