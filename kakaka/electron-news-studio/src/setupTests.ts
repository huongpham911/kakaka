import '@testing-library/jest-dom';

// Mock electron API
global.window = global.window || {};
(global.window as any).electronAPI = {
  export: jest.fn(),
  saveProject: jest.fn(),
  loadProject: jest.fn(),
  onExportProgress: jest.fn(() => () => {}),
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;
