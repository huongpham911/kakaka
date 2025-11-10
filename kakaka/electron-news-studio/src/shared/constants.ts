// Resolution presets for different aspect ratios
export const RESOLUTIONS = {
  landscape: {
    '720p': [1280, 720] as const,
    '1080p': [1920, 1080] as const,
    '2k': [2560, 1440] as const,
    '4k': [3840, 2160] as const
  },
  portrait: {
    '720p': [720, 1280] as const,
    '1080p': [1080, 1920] as const,
    '2k': [1440, 2560] as const,
    '4k': [2160, 3840] as const
  },
  square: {
    '720p': [720, 720] as const,
    '1080p': [1080, 1080] as const,
    '2k': [1440, 1440] as const,
    '4k': [2160, 2160] as const
  }
} as const;

export type AspectRatio = keyof typeof RESOLUTIONS;
export type ResolutionPreset = keyof typeof RESOLUTIONS.landscape;

// Default project configuration
export const DEFAULT_PROJECT_CONFIG = {
  fps: 24,
  width: 1920,
  height: 1080,
  duration: 15,
  defaultClipDuration: 5,
  defaultTransitionDuration: 1
} as const;

// Auto-save interval (milliseconds)
export const AUTOSAVE_INTERVAL = 30000; // 30 seconds

// Local storage keys
export const STORAGE_KEYS = {
  AUTOSAVE: 'news-studio-autosave',
  LAST_PROJECT_PATH: 'news-studio-last-path',
  PREFERENCES: 'news-studio-preferences'
} as const;

// File filters for dialogs
export const FILE_FILTERS = {
  PROJECT: { name: 'News Studio Project', extensions: ['nsproj', 'json'] },
  VIDEO: { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
  AUDIO: { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] },
  IMAGE: { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
  FONT: { name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2'] }
} as const;

// Validation limits
export const LIMITS = {
  MAX_CLIPS: 50,
  MAX_DURATION: 3600, // 1 hour
  MIN_DURATION: 1,
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB
  MIN_RESOLUTION: 480,
  MAX_RESOLUTION: 7680
} as const;
