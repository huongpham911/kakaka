import {
  validateVideoFormat,
  validateAudioFormat,
  validateImageFormat,
  validateFontFormat,
  validateClipCount,
  validateProject,
  isVideoFile,
} from './validation';
import type { Project } from './types';

describe('Validation Functions', () => {
  describe('validateVideoFormat', () => {
    it('should accept valid video formats', () => {
      expect(validateVideoFormat('video.mp4').valid).toBe(true);
      expect(validateVideoFormat('video.mov').valid).toBe(true);
      expect(validateVideoFormat('video.avi').valid).toBe(true);
      expect(validateVideoFormat('/path/to/video.mkv').valid).toBe(true);
    });

    it('should reject invalid video formats', () => {
      const result = validateVideoFormat('document.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mp4, mov, avi');
    });

    it('should reject empty paths', () => {
      const result = validateVideoFormat('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAudioFormat', () => {
    it('should accept valid audio formats', () => {
      expect(validateAudioFormat('audio.mp3').valid).toBe(true);
      expect(validateAudioFormat('audio.wav').valid).toBe(true);
      expect(validateAudioFormat('audio.aac').valid).toBe(true);
    });

    it('should reject invalid audio formats', () => {
      const result = validateAudioFormat('video.mp4');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mp3, wav, aac');
    });
  });

  describe('validateImageFormat', () => {
    it('should accept valid image formats', () => {
      expect(validateImageFormat('logo.png').valid).toBe(true);
      expect(validateImageFormat('logo.jpg').valid).toBe(true);
      expect(validateImageFormat('logo.jpeg').valid).toBe(true);
      expect(validateImageFormat('logo.webp').valid).toBe(true);
    });

    it('should reject invalid image formats', () => {
      const result = validateImageFormat('document.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('png, jpg, jpeg');
    });
  });

  describe('validateFontFormat', () => {
    it('should accept valid font formats', () => {
      expect(validateFontFormat('font.ttf').valid).toBe(true);
      expect(validateFontFormat('font.otf').valid).toBe(true);
    });

    it('should reject invalid font formats', () => {
      const result = validateFontFormat('font.woff');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ttf, otf');
    });
  });

  describe('validateClipCount', () => {
    it('should accept valid clip counts', () => {
      expect(validateClipCount(1).valid).toBe(true);
      expect(validateClipCount(50).valid).toBe(true);
      expect(validateClipCount(100).valid).toBe(true);
    });

    it('should reject too many clips', () => {
      const result = validateClipCount(101);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('100');
    });

    it('should reject zero or negative clips', () => {
      expect(validateClipCount(0).valid).toBe(false);
      expect(validateClipCount(-1).valid).toBe(false);
    });
  });

  describe('validateProject', () => {
    const validProject: Project = {
      fps: 24,
      width: 1920,
      height: 1080,
      duration: 15,
      tracks: {
        video: [
          {
            id: 'clip1',
            src: '/path/to/video.mp4',
            duration: 5,
            transition: { type: 'fade', duration: 1 }
          }
        ],
        logo: { src: '', pos: 'top-right', opacity: 0.9, scale: 220, start: 0 },
        ticker: {
          text: 'Test',
          font: '',
          size: 48,
          color: 'white',
          y: 1000,
          speed: 250,
          box: true,
          boxColor: 'black',
          boxOpacity: 0.5,
          textOpacity: 1.0,
          direction: 'rtl',
          position: 'footer',
          bold: false,
          italic: false,
          shadow: false,
          shadowColor: 'black',
          shadowX: 2,
          shadowY: 2
        },
        frame: { enable: true, thickness: 12, color: 'white@0.85' },
        audio: { bgm: { src: '', gain: -6 }, voice: { src: '', gain: 0, duck_bgm: true } }
      }
    };

    it('should accept valid project', () => {
      expect(validateProject(validProject).valid).toBe(true);
    });

    it('should reject project with no video clips', () => {
      const project = { ...validProject, tracks: { ...validProject.tracks, video: [] } };
      const result = validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('video clip');
    });

    it('should reject project with invalid FPS', () => {
      const project = { ...validProject, fps: 0 };
      const result = validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('FPS');
    });

    it('should reject project with invalid dimensions', () => {
      const project1 = { ...validProject, width: 0 };
      expect(validateProject(project1).valid).toBe(false);

      const project2 = { ...validProject, height: 0 };
      expect(validateProject(project2).valid).toBe(false);
    });

    it('should reject project with invalid duration', () => {
      const project = { ...validProject, duration: -1 };
      const result = validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('duration');
    });
  });

  describe('isVideoFile', () => {
    it('should correctly identify video files', () => {
      expect(isVideoFile('video.mp4')).toBe(true);
      expect(isVideoFile('video.mov')).toBe(true);
      expect(isVideoFile('audio.mp3')).toBe(false);
      expect(isVideoFile('image.png')).toBe(false);
    });
  });
});
