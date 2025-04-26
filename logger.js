/**
 * Simple logging system
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[Debug]', ...args);
    }
  },
  
  info: (...args) => {
    console.log('[Info]', ...args);
  },
  
  warn: (...args) => {
    console.warn('[Warn]', ...args);
  },
  
  error: (...args) => {
    console.error('[Error]', ...args);
  }
};

module.exports = logger; 