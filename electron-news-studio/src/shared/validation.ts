import { LIMITS } from "./constants";
import type { Project } from "./types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// File validation
export function validateFileSize(size: number): ValidationResult {
  if (size > LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${Math.round(LIMITS.MAX_FILE_SIZE / (1024 * 1024 * 1024))}GB limit`
    };
  }
  return { valid: true };
}

export function validateVideoFormat(fileName: string): ValidationResult {
  const validExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'];
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1) {
    return {
      valid: false,
      error: 'File has no extension'
    };
  }

  const ext = fileName.toLowerCase().substring(dotIndex);

  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported video format. Supported: ${validExtensions.join(', ')}`
    };
  }
  return { valid: true };
}

export function validateAudioFormat(fileName: string): ValidationResult {
  const validExtensions = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac'];
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1) {
    return {
      valid: false,
      error: 'File has no extension'
    };
  }

  const ext = fileName.toLowerCase().substring(dotIndex);

  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported audio format. Supported: ${validExtensions.join(', ')}`
    };
  }
  return { valid: true };
}

export function validateImageFormat(fileName: string): ValidationResult {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1) {
    return {
      valid: false,
      error: 'File has no extension'
    };
  }

  const ext = fileName.toLowerCase().substring(dotIndex);

  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported image format. Supported: ${validExtensions.join(', ')}`
    };
  }
  return { valid: true };
}

export function validateFontFormat(fileName: string): ValidationResult {
  const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex === -1) {
    return {
      valid: false,
      error: 'File has no extension'
    };
  }

  const ext = fileName.toLowerCase().substring(dotIndex);

  if (!validExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported font format. Supported: ${validExtensions.join(', ')}`
    };
  }
  return { valid: true };
}

// Project validation
export function validateDuration(duration: number): ValidationResult {
  if (duration < LIMITS.MIN_DURATION) {
    return {
      valid: false,
      error: `Duration must be at least ${LIMITS.MIN_DURATION} second`
    };
  }
  if (duration > LIMITS.MAX_DURATION) {
    return {
      valid: false,
      error: `Duration exceeds ${LIMITS.MAX_DURATION / 60} minutes limit`
    };
  }
  return { valid: true };
}

export function validateResolution(width: number, height: number): ValidationResult {
  if (width < LIMITS.MIN_RESOLUTION || height < LIMITS.MIN_RESOLUTION) {
    return {
      valid: false,
      error: `Resolution must be at least ${LIMITS.MIN_RESOLUTION}px`
    };
  }
  if (width > LIMITS.MAX_RESOLUTION || height > LIMITS.MAX_RESOLUTION) {
    return {
      valid: false,
      error: `Resolution exceeds ${LIMITS.MAX_RESOLUTION}px limit`
    };
  }
  return { valid: true };
}

export function validateClipCount(count: number): ValidationResult {
  if (count > LIMITS.MAX_CLIPS) {
    return {
      valid: false,
      error: `Maximum ${LIMITS.MAX_CLIPS} clips allowed`
    };
  }
  return { valid: true };
}

export function validateProject(project: Project): ValidationResult {
  // Check if has at least one video source (clip, intro, or outro)
  const hasVideoClips = project.tracks.video && project.tracks.video.length > 0;
  const hasIntro = !!project.tracks.intro?.src;
  const hasOutro = !!project.tracks.outro?.src;

  if (!hasVideoClips && !hasIntro && !hasOutro) {
    return {
      valid: false,
      error: 'Project must have at least one video source (video clip, intro, or outro)'
    };
  }

  // Validate clip count
  const clipCountResult = validateClipCount(project.tracks.video.length);
  if (!clipCountResult.valid) return clipCountResult;

  // Validate duration
  const durationResult = validateDuration(project.duration);
  if (!durationResult.valid) return durationResult;

  // Validate resolution
  const resolutionResult = validateResolution(project.width, project.height);
  if (!resolutionResult.valid) return resolutionResult;

  // Validate FPS
  if (project.fps < 1 || project.fps > 120) {
    return {
      valid: false,
      error: 'FPS must be between 1 and 120'
    };
  }

  // Check if all video clips have valid sources
  for (let i = 0; i < project.tracks.video.length; i++) {
    const clip = project.tracks.video[i];
    if (!clip.src || clip.src.trim() === '') {
      return {
        valid: false,
        error: `Video clip #${i + 1} has no source file`
      };
    }
  }

  return { valid: true };
}

// Ticker validation
export function validateTickerText(text: string): ValidationResult {
  if (text.length > 500) {
    return {
      valid: false,
      error: 'Ticker text must be less than 500 characters'
    };
  }
  return { valid: true };
}

// Helper to get file extension
export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return fileName.toLowerCase().substring(dotIndex);
}

// Helper to check if file is video
export function isVideoFile(fileName: string): boolean {
  const validExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'];
  return validExtensions.includes(getFileExtension(fileName));
}

// Helper to check if file is audio
export function isAudioFile(fileName: string): boolean {
  const validExtensions = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac'];
  return validExtensions.includes(getFileExtension(fileName));
}

// Helper to check if file is image
export function isImageFile(fileName: string): boolean {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  return validExtensions.includes(getFileExtension(fileName));
}
