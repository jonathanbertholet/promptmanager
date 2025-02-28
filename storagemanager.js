// storagemanager.js
// Constants used for storage limits.
const CHROME_STORAGE_LIMIT = 10485760; // 10 MB
const CHROME_STORAGE_ITEM_LIMIT = 10485760; // You can adjust this if needed

/**
 * StorageManager class handles getting and saving data to chrome.storage.
 */
class StorageManager {
  /**
   * Retrieves data for the given key, returns defaultValue if undefined.
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {Promise<*>}
   */
  static getData(key, defaultValue) {
    return new Promise(resolve => {
      chrome.storage.local.get(key, data => resolve(data[key] ?? defaultValue));
    });
  }

  /**
   * Saves data for the given key.
   * @param {string} key 
   * @param {*} value 
   * @returns {Promise<void>}
   */
  static setData(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  /**
   * Gets the list of stored prompts.
   * @returns {Promise<Array>}
   */
  static async getPrompts() {
    return await StorageManager.getData('prompts', []);
  }

  /**
   * Caches a prompt locally.
   * @param {object} prompt 
   */
  static cachePrompt(prompt) {
    window.localStorage.setItem('cachedPrompt', JSON.stringify(prompt));
  }

  /**
   * Saves a prompt to chrome.storage if it satisfies the size limits.
   * @param {object} prompt 
   * @returns {Promise<object>} Returns an object with a success flag and error if applicable.
   */
  static async savePrompt(prompt) {
    try {
      const prompts = await StorageManager.getPrompts();
      const allPrompts = [...prompts, prompt];
      const totalSize = new TextEncoder().encode(JSON.stringify(allPrompts)).length;

      if (totalSize > CHROME_STORAGE_LIMIT) {
        StorageManager.cachePrompt(prompt);
        throw new Error(`Total storage limit exceeded. Used ${Math.round(totalSize/1024)}KB of ${Math.round(CHROME_STORAGE_LIMIT/1024)}KB.`);
      }
      const promptSize = new TextEncoder().encode(JSON.stringify(prompt)).length;
      if (promptSize > CHROME_STORAGE_ITEM_LIMIT) {
        StorageManager.cachePrompt(prompt);
        throw new Error(`Individual prompt size exceeded. Used ${Math.round(promptSize/1024)}KB (limit: ${Math.round(CHROME_STORAGE_ITEM_LIMIT/1024)}KB).`);
      }

      await StorageManager.setData('prompts', allPrompts);
      console.log('Prompt saved successfully.');

      // Clean up the cache if successful.
      window.localStorage.removeItem('cachedPrompt');
      return { success: true };
    } catch (error) {
      console.error('Error saving prompt:', error);
      const errorMessage = error.message.includes('QUOTA_BYTES_PER_ITEM')
        ? 'Storage quota exceeded. Reduce prompt size or remove some prompts.'
        : error.message;
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Adds a listener to observe storage changes.
   * @param {function} callback 
   */
  static onChange(callback) {
    chrome.storage.onChanged.addListener(callback);
  }

  /**
   * Gets the stored button position.
   * @returns {Promise<object>}
   */
  static async getButtonPosition() {
    return await StorageManager.getData('buttonPosition', { x: 75, y: 100 });
  }

  /**
   * Saves the button position.
   * @param {object} position 
   * @returns {Promise<void>}
   */
  static async saveButtonPosition(position) {
    return await StorageManager.setData('buttonPosition', position);
  }

  /**
   * Gets the keyboard shortcut from storage.
   * @returns {Promise<object>}
   */
  static async getKeyboardShortcut() {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    return await StorageManager.getData('keyboardShortcut', { 
      key: isMac ? 'p' : 'm',
      modifier: isMac ? 'metaKey' : 'ctrlKey',
      requiresShift: isMac 
    });
  }

  /**
   * Saves a new keyboard shortcut.
   * @param {object} shortcut 
   * @returns {Promise<void>}
   */
  static async saveKeyboardShortcut(shortcut) {
    return await StorageManager.setData('keyboardShortcut', shortcut);
  }

  /**
   * Gets storage usage statistics.
   * @returns {Promise<object>}
   */
  static async getStorageUsage() {
    const prompts = await StorageManager.getPrompts();
    const used = new TextEncoder().encode(JSON.stringify(prompts)).length;
    const total = CHROME_STORAGE_LIMIT;
    const percentage = Math.round((used / total) * 100);
    return { used, total, percentage };
  }
}

// Export the StorageManager for use in other modules.
export { StorageManager }; 