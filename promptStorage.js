// Proxy module: root-level promptStorage.js
// Purpose: some build setups flatten the extension so content scripts look for this file
// Re-export everything from the real module inside src/
export * from './src/promptStorage.js'; 