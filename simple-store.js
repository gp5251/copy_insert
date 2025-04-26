const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Simple storage class, used to replace electron-store
 */
class SimpleStore {
  /**
   * Create a new storage instance
   * @param {Object} options Configuration options
   * @param {string} options.name Storage file name
   * @param {string} options.cwd Storage directory
   * @param {string} options.fileExtension File extension
   */
  constructor(options = {}) {
    this.name = options.name || 'config';
    this.cwd = options.cwd || app.getPath('userData');
    this.fileExtension = options.fileExtension || 'json';
    this.filePath = path.join(this.cwd, `${this.name}.${this.fileExtension}`);
    
    // Ensure directory exists
    if (!fs.existsSync(this.cwd)) {
      fs.mkdirSync(this.cwd, { recursive: true });
    }
    
    // Initialize storage
    this.data = this.read();
  }
  
  /**
   * Read storage file
   * @returns {Object} Stored data
   */
  read() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      // Keep this error log, important for debugging storage issues
      console.error('Failed to read storage file:', error);
    }
    return {};
  }

  /**
   * Write to storage file
   */
  write() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      // Keep this error log, important for debugging storage issues
      console.error('Failed to write storage file:', error);
    }
  }
  
  /**
   * Get stored value
   * @param {string} key Key name
   * @param {*} defaultValue Default value
   * @returns {*} Stored value
   */
  get(key) {
    if (key === undefined) {
      return this.data;
    }
    return this.data[key];
  }
  
  /**
   * Set stored value
   * @param {string|Object} keyOrObject Key name or object
   * @param {*} value Value
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
   * Delete stored value
   * @param {string} key Key name
   */
  delete(key) {
    delete this.data[key];
    this.write();
  }
  
  /**
   * Clear storage
   */
  clear() {
    this.data = {};
    this.write();
  }
  
  /**
   * Check if key exists
   * @param {string} key Key name
   * @returns {boolean} Whether exists
   */
  has(key) {
    return key in this.data;
  }
}

// Static method for initializing in the renderer process
SimpleStore.initRenderer = function() {
  // This method doesn't need to do anything here, just for compatibility with electron-store API
};

module.exports = SimpleStore; 