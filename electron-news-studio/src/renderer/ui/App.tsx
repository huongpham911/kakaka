import React, { useMemo, useState, useEffect, useCallback, Suspense, lazy } from "react";
import type { Project, VideoClip, TransitionType, AudioTrack, LogoTrack, TickerTrack } from "../../shared/types";
import {
  RESOLUTIONS,
  AUTOSAVE_INTERVAL,
  STORAGE_KEYS,
  LIMITS,
  type AspectRatio,
  type ResolutionPreset
} from "../../shared/constants";
import {
  validateProject,
  validateVideoFormat,
  validateAudioFormat,
  validateImageFormat,
  validateFontFormat,
  validateClipCount,
  isVideoFile
} from "../../shared/validation";
import { ToastContainer, type Toast, type ToastType } from "./Toast";
import { useHistory } from "../hooks/useHistory";

// Lazy load heavy components
const ConfirmModal = lazy(() => import("./Modal").then(m => ({ default: m.ConfirmModal })));
const ClipEditor = lazy(() => import("./ClipEditor").then(m => ({ default: m.ClipEditor })));

declare global {
  interface Window {
    electronAPI?: {
      export: (p: Project) => Promise<string>;
      saveProject: (data: string) => Promise<string | null>;
      loadProject: () => Promise<{ path: string; data: string } | null>;
      loadProjectFromPath: (filePath: string) => Promise<{ path: string; data: string } | null>;
      onExportProgress: (callback: (data: { percent: number; timemark: string }) => void) => () => void;
    }
  }
}

// Helper function to format time in MM:SS
function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const defaultProj: Project = {
  fps: 24,
  width: 1920,
  height: 1080,
  duration: 15,
  tracks: {
    video: [],
    audios: [], // Multiple audio tracks
    logos: [], // Multiple logo tracks
    tickers: [], // Multiple ticker tracks
    frame: { enable: true, thickness: 12, color: "white@0.85" }
  }
};

export default function App() {
  const { state: p, setState: setP, undo, redo, canUndo, canRedo } = useHistory<Project>(defaultProj);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dragOverClipId, setDragOverClipId] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState<number>(1); // 0.5x to 2x
  const [playheadPosition, setPlayheadPosition] = useState<number>(0); // 0-100%
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'media' | 'settings'>('media');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [copiedClips, setCopiedClips] = useState<VideoClip[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDraggingSeekbar, setIsDraggingSeekbar] = useState<boolean>(false);
  const [seekbarHoverTime, setSeekbarHoverTime] = useState<number | null>(null);
  const [volume, setVolume] = useState<number>(1); // 0-1
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volumeBeforeMute, setVolumeBeforeMute] = useState<number>(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.25-2
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const seekbarRef = React.useRef<HTMLDivElement>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('landscape');
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>('1080p');
  const [exportPreset, setExportPreset] = useState<string>('custom');
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [exportProgress, setExportProgress] = useState<{ percent: number; timemark: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [recentProjects, setRecentProjects] = useState<Array<{ path: string; name: string; timestamp: number }>>([]);
  const [showRecentMenu, setShowRecentMenu] = useState<boolean>(false);

  // Media Libraries - Separate folders for each type
  const [mediaImages, setMediaImages] = useState<string[]>([]); // For logos
  const [mediaVideos, setMediaVideos] = useState<string[]>([]); // For timeline clips
  const [mediaIntros, setMediaIntros] = useState<string[]>([]); // For intro videos
  const [mediaOutros, setMediaOutros] = useState<string[]>([]); // For outro videos
  const [mediaAudio, setMediaAudio] = useState<string[]>([]); // For BGM/Voice
  const [mediaFonts, setMediaFonts] = useState<string[]>([]); // For ticker fonts

  // Logo drag state (for dragging logos on preview)
  const [draggedLogoId, setDraggedLogoId] = useState<string | null>(null);
  const [logoDragOffset, setLogoDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Timeline track drag state (for resizing/moving tracks in timeline)
  const [timelineDrag, setTimelineDrag] = useState<{
    trackId: string | null;
    trackType: 'logo' | 'audio' | 'ticker' | null;
    mode: 'resize-start' | 'resize-end' | 'move' | null;
    startX: number;
    originalStart: number;
    originalEnd: number;
  }>({
    trackId: null,
    trackType: null,
    mode: null,
    startX: 0,
    originalStart: 0,
    originalEnd: 0
  });

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP(old => ({ ...old, [k]: v }));
  const t = p.tracks;

  // Toast helpers
  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, message, duration };
    setToasts(prev => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  }, []);

  const disabled = useMemo(() => t.video.length === 0 || !p.duration, [p]);

  // Handle aspect ratio change
  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    const [w, h] = RESOLUTIONS[ratio][resolutionPreset];
    setP(old => ({ ...old, width: w, height: h }));
  };

  // Handle resolution preset change
  const handleResolutionChange = (preset: ResolutionPreset) => {
    setResolutionPreset(preset);
    const [w, h] = RESOLUTIONS[aspectRatio][preset];
    setP(old => ({ ...old, width: w, height: h }));
  };

  // Project templates
  const applyProjectTemplate = (template: string) => {
    switch (template) {
      case 'news-report':
        setP({
          ...p,
          fps: 30,
          width: 1920,
          height: 1080,
          duration: 60,
          tracks: {
            ...p.tracks,
            ticker: {
              text: "TIN NÓNG: Chữ chạy tin tức | ",
              font: "",
              size: 48,
              color: "white",
              y: 1000,
              speed: 250,
              box: true,
              boxColor: "black",
              boxOpacity: 0.7,
              textOpacity: 1.0,
              direction: 'rtl',
              position: 'footer',
              bold: true,
              italic: false,
              shadow: true,
              shadowColor: "black",
              shadowX: 2,
              shadowY: 2
            },
            frame: { enable: true, thickness: 12, color: "white@0.9" }
          }
        });
        setAspectRatio('landscape');
        setResolutionPreset('1080p');
        showToast('success', 'Applied News Report template');
        break;
      case 'social-media':
        setP({
          ...p,
          fps: 30,
          width: 1080,
          height: 1920,
          duration: 30,
          tracks: {
            ...p.tracks,
            frame: { enable: false, thickness: 0, color: "" }
          }
        });
        setAspectRatio('portrait');
        setResolutionPreset('1080p');
        showToast('success', 'Applied Social Media template (Vertical)');
        break;
      case 'tutorial':
        setP({
          ...p,
          fps: 30,
          width: 1920,
          height: 1080,
          duration: 120,
          tracks: {
            ...p.tracks,
            frame: { enable: true, thickness: 8, color: "#3b82f6@0.8" }
          }
        });
        setAspectRatio('landscape');
        setResolutionPreset('1080p');
        showToast('success', 'Applied Tutorial template');
        break;
      case 'promo':
        setP({
          ...p,
          fps: 30,
          width: 1920,
          height: 1080,
          duration: 15,
          tracks: {
            ...p.tracks,
            frame: { enable: true, thickness: 16, color: "gold@0.9" }
          }
        });
        setAspectRatio('landscape');
        setResolutionPreset('1080p');
        showToast('success', 'Applied Promo template');
        break;
      case 'blank':
        setP(defaultProj);
        setAspectRatio('landscape');
        setResolutionPreset('1080p');
        showToast('info', 'Reset to blank project');
        break;
    }
  };

  // Export presets for different platforms
  const applyExportPreset = (preset: string) => {
    setExportPreset(preset);
    switch (preset) {
      case 'youtube':
        setP(old => ({ ...old, width: 1920, height: 1080, fps: 30 }));
        setAspectRatio('landscape');
        setResolutionPreset('1080p');
        showToast('success', 'Applied YouTube preset (1920x1080, 30fps)');
        break;
      case 'instagram-post':
        setP(old => ({ ...old, width: 1080, height: 1080, fps: 30 }));
        setAspectRatio('square');
        setResolutionPreset('1080p');
        showToast('success', 'Applied Instagram Post preset (1080x1080, 30fps)');
        break;
      case 'instagram-story':
        setP(old => ({ ...old, width: 1080, height: 1920, fps: 30 }));
        setAspectRatio('portrait');
        setResolutionPreset('1080p');
        showToast('success', 'Applied Instagram Story preset (1080x1920, 30fps)');
        break;
      case 'tiktok':
        setP(old => ({ ...old, width: 1080, height: 1920, fps: 30 }));
        setAspectRatio('portrait');
        setResolutionPreset('1080p');
        showToast('success', 'Applied TikTok preset (1080x1920, 30fps)');
        break;
      case 'twitter':
        setP(old => ({ ...old, width: 1280, height: 720, fps: 30 }));
        setAspectRatio('landscape');
        setResolutionPreset('720p');
        showToast('success', 'Applied Twitter preset (1280x720, 30fps)');
        break;
      case 'facebook':
        setP(old => ({ ...old, width: 1920, height: 1080, fps: 30 }));
        setAspectRatio('landscape');
        setResolutionPreset('1080p');
        showToast('success', 'Applied Facebook preset (1920x1080, 30fps)');
        break;
      case 'custom':
        showToast('info', 'Custom preset - adjust settings manually');
        break;
    }
  };

  // Media Library Management
  // Add images to library
  const addImagesToLibrary = useCallback((files: FileList) => {
    const newImages: string[] = [];
    Array.from(files).forEach(file => {
      const filePath = (file as any).path ?? file.name;
      const validation = validateImageFormat(filePath);
      if (validation.valid) {
        newImages.push(filePath);
      } else {
        showToast('warning', `Skipped ${file.name}: ${validation.error}`);
      }
    });
    if (newImages.length > 0) {
      setMediaImages(prev => [...prev, ...newImages]);
      showToast('success', `Added ${newImages.length} image${newImages.length > 1 ? 's' : ''} to library`);
    }
  }, [showToast]);

  // Add videos to library
  const addVideosToLibrary = useCallback((files: FileList) => {
    const newVideos: string[] = [];
    Array.from(files).forEach(file => {
      const filePath = (file as any).path ?? file.name;
      const validation = validateVideoFormat(filePath);
      if (validation.valid) {
        newVideos.push(filePath);
      } else {
        showToast('warning', `Skipped ${file.name}: ${validation.error}`);
      }
    });
    if (newVideos.length > 0) {
      setMediaVideos(prev => [...prev, ...newVideos]);
      showToast('success', `Added ${newVideos.length} video${newVideos.length > 1 ? 's' : ''} to library`);
    }
  }, [showToast]);

  // Add audio files to library
  const addAudioToLibrary = useCallback((files: FileList) => {
    const newAudio: string[] = [];
    Array.from(files).forEach(file => {
      const filePath = (file as any).path ?? file.name;
      const validation = validateAudioFormat(filePath);
      if (validation.valid) {
        newAudio.push(filePath);
      } else {
        showToast('warning', `Skipped ${file.name}: ${validation.error}`);
      }
    });
    if (newAudio.length > 0) {
      setMediaAudio(prev => [...prev, ...newAudio]);
      showToast('success', `Added ${newAudio.length} audio file${newAudio.length > 1 ? 's' : ''} to library`);
    }
  }, [showToast]);

  // Remove from libraries
  const removeImageFromLibrary = useCallback((path: string) => {
    setMediaImages(prev => prev.filter(p => p !== path));
    showToast('info', 'Image removed from library');
  }, [showToast]);

  const removeVideoFromLibrary = useCallback((path: string) => {
    setMediaVideos(prev => prev.filter(p => p !== path));
    showToast('info', 'Video removed from library');
  }, [showToast]);

  const removeAudioFromLibrary = useCallback((path: string) => {
    setMediaAudio(prev => prev.filter(p => p !== path));
    showToast('info', 'Audio removed from library');
  }, [showToast]);

  // Add intro videos to library
  const addIntrosToLibrary = useCallback((files: FileList) => {
    const newIntros: string[] = [];
    Array.from(files).forEach(file => {
      const filePath = (file as any).path ?? file.name;
      const validation = validateVideoFormat(filePath);
      if (validation.valid) {
        newIntros.push(filePath);
      } else {
        showToast('warning', `Skipped ${file.name}: ${validation.error}`);
      }
    });
    if (newIntros.length > 0) {
      setMediaIntros(prev => [...prev, ...newIntros]);
      showToast('success', `Added ${newIntros.length} intro video${newIntros.length > 1 ? 's' : ''} to library`);
    }
  }, [showToast]);

  // Add outro videos to library
  const addOutrosToLibrary = useCallback((files: FileList) => {
    const newOutros: string[] = [];
    Array.from(files).forEach(file => {
      const filePath = (file as any).path ?? file.name;
      const validation = validateVideoFormat(filePath);
      if (validation.valid) {
        newOutros.push(filePath);
      } else {
        showToast('warning', `Skipped ${file.name}: ${validation.error}`);
      }
    });
    if (newOutros.length > 0) {
      setMediaOutros(prev => [...prev, ...newOutros]);
      showToast('success', `Added ${newOutros.length} outro video${newOutros.length > 1 ? 's' : ''} to library`);
    }
  }, [showToast]);

  // Add fonts to library
  const addFontsToLibrary = useCallback((files: FileList) => {
    const newFonts: string[] = [];
    Array.from(files).forEach(file => {
      const filePath = (file as any).path ?? file.name;
      // Simple validation for font files
      if (filePath.match(/\.(ttf|otf|woff|woff2)$/i)) {
        newFonts.push(filePath);
      } else {
        showToast('warning', `Skipped ${file.name}: Not a valid font file`);
      }
    });
    if (newFonts.length > 0) {
      setMediaFonts(prev => [...prev, ...newFonts]);
      showToast('success', `Added ${newFonts.length} font${newFonts.length > 1 ? 's' : ''} to library`);
    }
  }, [showToast]);

  // Remove from intro/outro/font libraries
  const removeIntroFromLibrary = useCallback((path: string) => {
    setMediaIntros(prev => prev.filter(p => p !== path));
    showToast('info', 'Intro video removed from library');
  }, [showToast]);

  const removeOutroFromLibrary = useCallback((path: string) => {
    setMediaOutros(prev => prev.filter(p => p !== path));
    showToast('info', 'Outro video removed from library');
  }, [showToast]);

  const removeFontFromLibrary = useCallback((path: string) => {
    setMediaFonts(prev => prev.filter(p => p !== path));
    showToast('info', 'Font removed from library');
  }, [showToast]);

  // ========== TRACK MANAGEMENT ==========
  // Add Audio Track
  const addAudioTrack = useCallback((src: string, type: 'bgm' | 'voice' = 'bgm') => {
    const newTrack: AudioTrack = {
      id: `audio-${Date.now()}`,
      name: type === 'bgm' ? `BGM ${t.audios.length + 1}` : `Voice ${t.audios.length + 1}`,
      src,
      gain: type === 'bgm' ? -6 : 0,
      type,
      duckOthers: type === 'voice'
    };
    setP(old => ({
      ...old,
      tracks: { ...old.tracks, audios: [...old.tracks.audios, newTrack] }
    }));
    showToast('success', `Audio track added: ${newTrack.name}`);
  }, [t.audios, showToast]);

  // Add Logo Track
  const addLogoTrack = useCallback((src: string) => {
    const newTrack: LogoTrack = {
      id: `logo-${Date.now()}`,
      name: `Logo ${t.logos.length + 1}`,
      src,
      pos: 'top-right',
      opacity: 0.9,
      scale: 220
    };
    setP(old => ({
      ...old,
      tracks: { ...old.tracks, logos: [...old.tracks.logos, newTrack] }
    }));
    showToast('success', `Logo track added: ${newTrack.name}`);
  }, [t.logos, showToast]);

  // Add Ticker Track
  const addTickerTrack = useCallback((text: string, font: string) => {
    const newTrack: TickerTrack = {
      id: `ticker-${Date.now()}`,
      name: `Ticker ${t.tickers.length + 1}`,
      text,
      font,
      size: 48,
      color: 'white',
      y: 1000,
      speed: 250,
      box: true,
      boxColor: 'black',
      boxOpacity: 0.55,
      textOpacity: 1.0,
      direction: 'rtl',
      position: 'footer',
      shadow: false,
      shadowColor: 'black',
      shadowX: 2,
      shadowY: 2
    };
    setP(old => ({
      ...old,
      tracks: { ...old.tracks, tickers: [...old.tracks.tickers, newTrack] }
    }));
    showToast('success', `Ticker track added: ${newTrack.name}`);
  }, [t.tickers, showToast]);

  // Remove Track (generic)
  const removeAudioTrack = useCallback((id: string) => {
    setP(old => ({
      ...old,
      tracks: { ...old.tracks, audios: old.tracks.audios.filter(t => t.id !== id) }
    }));
    showToast('info', 'Audio track removed');
  }, [showToast]);

  const removeLogoTrack = useCallback((id: string) => {
    setP(old => ({
      ...old,
      tracks: { ...old.tracks, logos: old.tracks.logos.filter(t => t.id !== id) }
    }));
    showToast('info', 'Logo track removed');
  }, [showToast]);

  const removeTickerTrack = useCallback((id: string) => {
    setP(old => ({
      ...old,
      tracks: { ...old.tracks, tickers: old.tracks.tickers.filter(t => t.id !== id) }
    }));
    showToast('info', 'Ticker track removed');
  }, [showToast]);

  // Update Track
  const updateAudioTrack = useCallback((id: string, updates: Partial<AudioTrack>) => {
    setP(old => ({
      ...old,
      tracks: {
        ...old.tracks,
        audios: old.tracks.audios.map(t => t.id === id ? { ...t, ...updates } : t)
      }
    }));
  }, []);

  const updateLogoTrack = useCallback((id: string, updates: Partial<LogoTrack>) => {
    setP(old => ({
      ...old,
      tracks: {
        ...old.tracks,
        logos: old.tracks.logos.map(t => t.id === id ? { ...t, ...updates } : t)
      }
    }));
  }, []);

  const updateTickerTrack = useCallback((id: string, updates: Partial<TickerTrack>) => {
    setP(old => ({
      ...old,
      tracks: {
        ...old.tracks,
        tickers: old.tracks.tickers.map(t => t.id === id ? { ...t, ...updates } : t)
      }
    }));
  }, []);

  // Video clip management
  // Toggle clip selection (for multi-select)
  const toggleClipSelection = useCallback((clipId: string, isCtrlOrCmd: boolean) => {
    if (isCtrlOrCmd) {
      // Multi-select mode
      setSelectedClips(prev =>
        prev.includes(clipId)
          ? prev.filter(id => id !== clipId)
          : [...prev, clipId]
      );
    } else {
      // Single select mode
      setSelectedClips([clipId]);
    }
  }, []);

  const addVideoClip = useCallback((filePath: string) => {
    // Validate file format
    const formatValidation = validateVideoFormat(filePath);
    if (!formatValidation.valid) {
      showToast('error', formatValidation.error || 'Invalid video format');
      return;
    }

    // Validate clip count - use callback to get latest value
    setP(s => {
      const countValidation = validateClipCount(s.tracks.video.length + 1);
      if (!countValidation.valid) {
        showToast('warning', countValidation.error || 'Too many clips');
        return s;
      }

      const newClip: VideoClip = {
        id: `clip-${Date.now()}`,
        src: filePath,
        duration: 5,
        transition: { type: 'fade', duration: 1 }
      };
      setSelectedClips([newClip.id]);
      showToast('success', 'Video clip added successfully');
      return { ...s, tracks: { ...s.tracks, video: [...s.tracks.video, newClip] }};
    });
  }, [showToast]);

  const removeVideoClip = useCallback((id: string) => {
    setP(s => ({ ...s, tracks: { ...s.tracks, video: s.tracks.video.filter(c => c.id !== id) }}));
    setSelectedClips(prev => prev.filter(clipId => clipId !== id));
    showToast('info', 'Video clip removed');
  }, [showToast]);

  const removeSelectedClips = useCallback(() => {
    if (selectedClips.length === 0) return;
    setP(s => ({
      ...s,
      tracks: {
        ...s.tracks,
        video: s.tracks.video.filter(c => !selectedClips.includes(c.id))
      }
    }));
    showToast('info', `${selectedClips.length} clip${selectedClips.length > 1 ? 's' : ''} removed`);
    setSelectedClips([]);
  }, [selectedClips, showToast]);

  // Copy selected clips
  const copySelectedClips = useCallback(() => {
    if (selectedClips.length === 0) {
      showToast('warning', 'No clips selected to copy');
      return;
    }
    const clipsToCopy = t.video.filter(c => selectedClips.includes(c.id));
    setCopiedClips(clipsToCopy);
    showToast('success', `${clipsToCopy.length} clip${clipsToCopy.length > 1 ? 's' : ''} copied`);
  }, [selectedClips, t.video, showToast]);

  // Paste copied clips
  const pasteClips = useCallback(() => {
    if (copiedClips.length === 0) {
      showToast('warning', 'No clips in clipboard');
      return;
    }

    // Create new clips with new IDs
    const newClips: VideoClip[] = copiedClips.map(clip => ({
      ...clip,
      id: `clip-${Date.now()}-${Math.random()}`
    }));

    setP(s => ({
      ...s,
      tracks: {
        ...s.tracks,
        video: [...s.tracks.video, ...newClips]
      }
    }));

    // Select the newly pasted clips
    setSelectedClips(newClips.map(c => c.id));
    showToast('success', `${newClips.length} clip${newClips.length > 1 ? 's' : ''} pasted`);
  }, [copiedClips, showToast]);

  const updateVideoClip = useCallback((id: string, updates: Partial<VideoClip>) => {
    setP(s => ({
      ...s,
      tracks: {
        ...s.tracks,
        video: s.tracks.video.map(c => c.id === id ? { ...c, ...updates } : c)
      }
    }));
  }, []);

  const moveClip = (id: string, direction: 'up' | 'down') => {
    const idx = t.video.findIndex(c => c.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === t.video.length - 1)) return;
    const newVideos = [...t.video];
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newVideos[idx], newVideos[newIdx]] = [newVideos[newIdx], newVideos[idx]];
    setP(s => ({ ...s, tracks: { ...s.tracks, video: newVideos }}));
  };

  // Drag and drop to reorder clips
  const handleClipDragStart = useCallback((e: React.DragEvent, clipId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', clipId);
    setDraggedClipId(clipId);
  }, []);

  const handleClipDragOver = useCallback((e: React.DragEvent, clipId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverClipId(clipId);
  }, []);

  const handleClipDragEnd = useCallback(() => {
    setDraggedClipId(null);
    setDragOverClipId(null);
  }, []);

  const handleClipDrop = useCallback((e: React.DragEvent, targetClipId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceClipId = e.dataTransfer.getData('text/plain');
    if (!sourceClipId || sourceClipId === targetClipId) {
      setDraggedClipId(null);
      setDragOverClipId(null);
      return;
    }

    setP(s => {
      const videos = [...s.tracks.video];
      const sourceIdx = videos.findIndex(c => c.id === sourceClipId);
      const targetIdx = videos.findIndex(c => c.id === targetClipId);

      if (sourceIdx === -1 || targetIdx === -1) return s;

      const [movedClip] = videos.splice(sourceIdx, 1);
      videos.splice(targetIdx, 0, movedClip);

      return { ...s, tracks: { ...s.tracks, video: videos }};
    });

    setDraggedClipId(null);
    setDragOverClipId(null);
    showToast('success', 'Clip reordered');
  }, [setP, showToast]);

  // Playhead scrubbing handlers
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
  }, []);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't move playhead when clicking on clips or playhead itself
    if ((e.target as HTMLElement).closest('.track-item, .playhead')) return;

    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // rect.width already accounts for CSS transform scale
    const percent = (x / rect.width) * 100;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    setPlayheadPosition(clampedPercent);
  }, []);

  const handleDragOver = (e: React.DragEvent, zone: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(zone);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'video' | 'intro' | 'outro') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const filePath = (file as any).path ?? file.name;

    // Validate file based on type
    const validation = validateVideoFormat(filePath);
    if (!validation.valid) {
      showToast('error', validation.error || 'Invalid video file');
      return;
    }

    switch (type) {
      case 'video':
        addVideoClip(filePath);
        break;
      case 'intro':
        t.intro = { src: filePath, duration: 3 };
        setP({ ...p });
        showToast('success', 'Intro video added');
        break;
      case 'outro':
        t.outro = { src: filePath, duration: 3 };
        setP({ ...p });
        showToast('success', 'Outro video added');
        break;
      // NOTE: logo, font, bgm, voice cases removed - now handled by media libraries
      // Use Image Library → addLogoTrack()
      // Use Audio Library → addAudioTrack()
      // Use Font Library → addTickerTrack()
    }
  };

  // Logo drag handlers (for dragging logos on preview)
  const handleLogoMouseDown = useCallback((e: React.MouseEvent, logoId: string) => {
    e.preventDefault();
    const logo = t.logos.find(l => l.id === logoId);
    if (!logo) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedLogoId(logoId);
    setLogoDragOffset({ x: offsetX, y: offsetY });
  }, [t.logos]);

  const handleLogoMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedLogoId) return;

    const logo = t.logos.find(l => l.id === draggedLogoId);
    if (!logo) return;

    const previewVideo = e.currentTarget;
    const rect = previewVideo.getBoundingClientRect();

    // Calculate new position relative to video container
    const x = e.clientX - rect.left - logoDragOffset.x;
    const y = e.clientY - rect.top - logoDragOffset.y;

    // Clamp to video boundaries (use actual logo scale, not hardcoded 100px)
    const logoWidth = logo.scale ?? 220;
    const clampedX = Math.max(0, Math.min(x, rect.width - logoWidth));
    const clampedY = Math.max(0, Math.min(y, rect.height - logoWidth * 0.6)); // Assume height ~60% of width

    // Convert preview coordinates to video coordinates
    // Preview uses object-fit: contain, so video might be letterboxed
    const videoAspect = p.width / p.height;
    const previewAspect = rect.width / rect.height;

    let videoX = clampedX;
    let videoY = clampedY;

    if (previewAspect > videoAspect) {
      // Video is letterboxed horizontally (black bars on sides)
      const videoWidth = rect.height * videoAspect;
      const offsetX = (rect.width - videoWidth) / 2;
      videoX = ((clampedX - offsetX) / videoWidth) * p.width;
      videoY = (clampedY / rect.height) * p.height;
    } else {
      // Video is letterboxed vertically (black bars top/bottom)
      const videoHeight = rect.width / videoAspect;
      const offsetY = (rect.height - videoHeight) / 2;
      videoX = (clampedX / rect.width) * p.width;
      videoY = ((clampedY - offsetY) / videoHeight) * p.height;
    }

    // Update logo position with video coordinates
    updateLogoTrack(draggedLogoId, {
      x: Math.max(0, Math.min(Math.round(videoX), p.width - logoWidth)),
      y: Math.max(0, Math.min(Math.round(videoY), p.height - logoWidth * 0.6))
    });
  }, [draggedLogoId, logoDragOffset, updateLogoTrack, t.logos, p.width, p.height]);

  const handleLogoMouseUp = useCallback(() => {
    setDraggedLogoId(null);
  }, []);

  // Timeline track drag handlers (for resizing/moving tracks in timeline)
  const handleTimelineTrackMouseDown = useCallback((
    e: React.MouseEvent,
    trackId: string,
    trackType: 'logo' | 'audio' | 'ticker',
    mode: 'resize-start' | 'resize-end' | 'move'
  ) => {
    e.stopPropagation();

    let track: any;
    if (trackType === 'logo') track = t.logos.find(l => l.id === trackId);
    else if (trackType === 'audio') track = t.audios.find(a => a.id === trackId);
    else if (trackType === 'ticker') track = t.tickers.find(tk => tk.id === trackId);

    if (!track) return;

    setTimelineDrag({
      trackId,
      trackType,
      mode,
      startX: e.clientX,
      originalStart: track.start ?? 0,
      originalEnd: track.end ?? p.duration
    });
  }, [t.logos, t.audios, t.tickers, p.duration]);

  const handleTimelineTrackMouseMove = useCallback((e: React.MouseEvent) => {
    if (!timelineDrag.trackId || !timelineDrag.mode) return;

    const deltaX = e.clientX - timelineDrag.startX;
    // Convert pixels to seconds (adjust based on zoom level)
    // Base: 50px per second, scaled by timelineZoom (0.5x to 2x)
    const deltaSeconds = deltaX / (50 * timelineZoom);

    const { trackType, trackId, mode, originalStart, originalEnd } = timelineDrag;

    let newStart = originalStart;
    let newEnd = originalEnd;

    if (mode === 'resize-start') {
      newStart = Math.max(0, originalStart + deltaSeconds);
      newStart = Math.min(newStart, originalEnd - 0.5); // Min 0.5s duration
    } else if (mode === 'resize-end') {
      newEnd = Math.min(p.duration, originalEnd + deltaSeconds);
      newEnd = Math.max(newEnd, originalStart + 0.5); // Min 0.5s duration
    } else if (mode === 'move') {
      const duration = originalEnd - originalStart;
      newStart = Math.max(0, originalStart + deltaSeconds);
      newEnd = newStart + duration;
      if (newEnd > p.duration) {
        newEnd = p.duration;
        newStart = newEnd - duration;
      }
    }

    // Update track based on type
    if (trackType === 'logo') {
      updateLogoTrack(trackId, { start: Math.round(newStart * 10) / 10, end: Math.round(newEnd * 10) / 10 });
    } else if (trackType === 'audio') {
      updateAudioTrack(trackId, { start: Math.round(newStart * 10) / 10, end: Math.round(newEnd * 10) / 10 });
    } else if (trackType === 'ticker') {
      updateTickerTrack(trackId, { start: Math.round(newStart * 10) / 10, end: Math.round(newEnd * 10) / 10 });
    }
  }, [timelineDrag, p.duration, updateLogoTrack, updateAudioTrack, updateTickerTrack]);

  const handleTimelineTrackMouseUp = useCallback(() => {
    setTimelineDrag({
      trackId: null,
      trackType: null,
      mode: null,
      startX: 0,
      originalStart: 0,
      originalEnd: 0
    });
  }, []);

  async function onExport() {
    if (!window.electronAPI) {
      showToast('error', 'No electronAPI. Run via Electron.');
      return;
    }

    // Validate project before export
    const validation = validateProject(p);
    if (!validation.valid) {
      showToast('error', validation.error || 'Project validation failed');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress({ percent: 0, timemark: "00:00:00" });
      const out = await window.electronAPI.export(p);
      setExportProgress({ percent: 100, timemark: "Complete" });
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
        showToast('success', `Video exported successfully: ${out}`, 5000);
      }, 500);
    } catch (e: any) {
      console.error(e);
      setIsExporting(false);
      setExportProgress(null);
      showToast('error', `Export error: ${e?.message || 'Unknown error'}`);
    }
  }

  // Add project to recent projects list
  const addToRecentProjects = useCallback((filePath: string) => {
    const projectName = filePath.split('/').pop() || filePath.split('\\').pop() || 'Untitled';
    const newEntry = { path: filePath, name: projectName, timestamp: Date.now() };

    setRecentProjects(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(p => p.path !== filePath);
      // Add to front and limit to 10
      const updated = [newEntry, ...filtered].slice(0, 10);
      // Save to localStorage
      localStorage.setItem('recentProjects', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear recent projects list
  const clearRecentProjects = useCallback(() => {
    setRecentProjects([]);
    localStorage.removeItem('recentProjects');
    showToast('info', 'Recent projects cleared');
  }, [showToast]);

  // Load project from recent list
  const loadFromRecent = useCallback(async (filePath: string) => {
    if (!window.electronAPI?.loadProjectFromPath) {
      showToast('error', 'Load not available. Run via Electron.');
      return;
    }
    try {
      const result = await window.electronAPI.loadProjectFromPath(filePath);
      if (result) {
        const loadedProject = JSON.parse(result.data);
        setP(loadedProject);
        localStorage.setItem(STORAGE_KEYS.LAST_PROJECT_PATH, result.path);
        addToRecentProjects(result.path);
        showToast('success', `Project loaded: ${result.path.split('/').pop() || result.path.split('\\').pop()}`);
        setShowRecentMenu(false);
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', `Load error: ${e?.message || 'Unknown error'}`);
      // Remove from recent projects if file doesn't exist or is corrupted
      setRecentProjects(prev => prev.filter(p => p.path !== filePath));
    }
  }, [showToast, addToRecentProjects]);

  // Save project
  async function saveProject() {
    if (!window.electronAPI?.saveProject) {
      showToast('error', 'Save not available. Run via Electron.');
      return;
    }
    try {
      const projectData = JSON.stringify(p, null, 2);
      const filePath = await window.electronAPI.saveProject(projectData);
      if (filePath) {
        localStorage.setItem(STORAGE_KEYS.LAST_PROJECT_PATH, filePath);
        addToRecentProjects(filePath);
        showToast('success', `Project saved: ${filePath}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', `Save error: ${e?.message || 'Unknown error'}`);
    }
  }

  // Load project
  async function loadProject() {
    if (!window.electronAPI?.loadProject) {
      showToast('error', 'Load not available. Run via Electron.');
      return;
    }
    try {
      const result = await window.electronAPI.loadProject();
      if (result) {
        const loadedProject = JSON.parse(result.data);
        setP(loadedProject);
        localStorage.setItem(STORAGE_KEYS.LAST_PROJECT_PATH, result.path);
        addToRecentProjects(result.path);
        showToast('success', `Project loaded: ${result.path}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', `Load error: ${e?.message || 'Unknown error'}`);
    }
  }

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify(p));
        const now = new Date();
        setLastAutoSaveTime(now);

        // Show subtle toast notification
        showToast('info', '💾 Auto-saved', 1000);
      } catch (e) {
        console.error("Auto-save error:", e);
        showToast('error', 'Auto-save failed');
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearTimeout(timer);
  }, [p, autoSaveEnabled, showToast]);

  // Load auto-save on mount
  useEffect(() => {
    try {
      const autosaved = localStorage.getItem(STORAGE_KEYS.AUTOSAVE);
      if (autosaved) {
        showConfirm(
          'Restore Auto-saved Project?',
          'We found an auto-saved project from your last session. Would you like to restore it?',
          () => {
            try {
              setP(JSON.parse(autosaved));
              showToast('success', 'Project restored from auto-save');
            } catch (e) {
              showToast('error', 'Failed to restore auto-saved project');
            }
          }
        );
      }
    } catch (e) {
      console.error("Failed to restore auto-save:", e);
    }
  }, []);

  // Theme management and load preferences on mount
  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Load volume from localStorage
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
        setVolume(vol);
      }
    }

    // Load playback speed from localStorage
    const savedSpeed = localStorage.getItem('playbackSpeed');
    if (savedSpeed) {
      const speed = parseFloat(savedSpeed);
      if (!isNaN(speed) && speed >= 0.25 && speed <= 2) {
        setPlaybackSpeed(speed);
      }
    }

    // Load recent projects from localStorage
    const savedRecent = localStorage.getItem('recentProjects');
    if (savedRecent) {
      try {
        const parsed = JSON.parse(savedRecent);
        if (Array.isArray(parsed)) {
          setRecentProjects(parsed);
        }
      } catch (e) {
        console.error('Failed to load recent projects:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      showToast('info', `Switched to ${newTheme} mode`);
      return newTheme;
    });
  }, [showToast]);

  // Video preview controls
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(e => {
        console.error('Play error:', e);
        showToast('error', 'Failed to play video');
      });
      setIsPlaying(true);
    }
  }, [isPlaying, showToast]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    // Update playhead position based on video time
    const duration = videoRef.current.duration;
    if (duration > 0) {
      const percent = (videoRef.current.currentTime / duration) * 100;
      setPlayheadPosition(percent);
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    setPlayheadPosition(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, []);

  const seekVideo = useCallback((time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Seekbar handlers
  const handleSeekbarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !seekbarRef.current) return;

    const rect = seekbarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * videoRef.current.duration;

    seekVideo(time);
  }, [seekVideo]);

  const handleSeekbarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingSeekbar(true);
    handleSeekbarClick(e);
  }, [handleSeekbarClick]);

  const handleSeekbarMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !seekbarRef.current) return;

    const rect = seekbarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * videoRef.current.duration;

    setSeekbarHoverTime(time);
  }, []);

  const handleSeekbarMouseLeave = useCallback(() => {
    setSeekbarHoverTime(null);
  }, []);

  // Volume controls
  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(volumeBeforeMute);
    } else {
      setVolumeBeforeMute(volume);
      setIsMuted(true);
      setVolume(0);
    }
  }, [isMuted, volume, volumeBeforeMute]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume > 0) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  }, []);

  // Apply volume to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    // Save volume to localStorage
    localStorage.setItem('volume', volume.toString());
  }, [volume]);

  // Apply playback speed to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
    // Save playback speed to localStorage
    localStorage.setItem('playbackSpeed', playbackSpeed.toString());
  }, [playbackSpeed]);

  // Handler for playback speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    showToast('info', `Playback speed: ${newSpeed}x`);
  }, [showToast]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(async () => {
    if (!previewContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await previewContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        showToast('info', 'Entered fullscreen mode (Press Esc to exit)');
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        showToast('info', 'Exited fullscreen mode');
      }
    } catch (e) {
      console.error('Fullscreen error:', e);
      showToast('error', 'Fullscreen not supported');
    }
  }, [showToast]);

  // Listen to export progress
  useEffect(() => {
    if (!window.electronAPI?.onExportProgress) return;

    const cleanup = window.electronAPI.onExportProgress((data) => {
      setExportProgress(data);
    });

    return cleanup;
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Playhead dragging
  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      const timeline = document.querySelector('.track-content') as HTMLElement;
      if (!timeline) return;

      const rect = timeline.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // rect.width already accounts for CSS transform scale
      const percent = (x / rect.width) * 100;
      const clampedPercent = Math.max(0, Math.min(100, percent));
      setPlayheadPosition(clampedPercent);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead]);

  // Seekbar dragging
  useEffect(() => {
    if (!isDraggingSeekbar) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!videoRef.current || !seekbarRef.current) return;

      const rect = seekbarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * videoRef.current.duration;

      seekVideo(time);
    };

    const handleMouseUp = () => {
      setIsDraggingSeekbar(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSeekbar, seekVideo]);

  // Close recent menu when clicking outside
  useEffect(() => {
    if (!showRecentMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.btn-recent-toggle') && !target.closest('.btn-load')) {
        setShowRecentMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showRecentMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Prevent shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (ctrlOrCmd) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            saveProject();
            showToast('info', 'Shortcut: Ctrl+S (Save)');
            break;
          case 'o':
            e.preventDefault();
            loadProject();
            showToast('info', 'Shortcut: Ctrl+O (Open)');
            break;
          case 'e':
            e.preventDefault();
            if (!disabled && !isExporting) {
              onExport();
              showToast('info', 'Shortcut: Ctrl+E (Export)');
            }
            break;
          case 'z':
            e.preventDefault();
            if (canUndo) {
              undo();
              showToast('info', 'Undo');
            } else {
              showToast('warning', 'Nothing to undo');
            }
            break;
          case 'y':
            e.preventDefault();
            if (canRedo) {
              redo();
              showToast('info', 'Redo');
            } else {
              showToast('warning', 'Nothing to redo');
            }
            break;
          case 'c':
            e.preventDefault();
            copySelectedClips();
            showToast('info', 'Shortcut: Ctrl+C (Copy)');
            break;
          case 'v':
            e.preventDefault();
            pasteClips();
            showToast('info', 'Shortcut: Ctrl+V (Paste)');
            break;
          case 'a':
            e.preventDefault();
            if (t.video.length > 0) {
              setSelectedClips(t.video.map(c => c.id));
              showToast('info', `All ${t.video.length} clips selected`);
            }
            break;
        }
      }

      // Space: Play/Pause video
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlayPause();
      }

      // Escape: Clear selection or close menus
      if (e.key === 'Escape') {
        if (selectedClips.length > 0) {
          setSelectedClips([]);
          showToast('info', 'Selection cleared');
        }
        if (showRecentMenu) {
          setShowRecentMenu(false);
        }
      }

      // Arrow keys: Seek video
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (videoRef.current) {
          e.preventDefault();
          const seekAmount = e.shiftKey ? 10 : 5; // Shift for larger jumps
          const newTime = e.key === 'ArrowLeft'
            ? Math.max(0, currentTime - seekAmount)
            : Math.min(videoRef.current.duration || 0, currentTime + seekAmount);
          seekVideo(newTime);
          showToast('info', `${e.key === 'ArrowLeft' ? '⏪' : '⏩'} ${seekAmount}s`);
        }
      }

      // Home/End: Go to start/end
      if (e.key === 'Home') {
        e.preventDefault();
        if (videoRef.current) {
          seekVideo(0);
          setPlayheadPosition(0);
          showToast('info', 'Jump to start');
        }
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (videoRef.current && videoRef.current.duration) {
          seekVideo(videoRef.current.duration);
          setPlayheadPosition(100);
          showToast('info', 'Jump to end');
        }
      }

      // Delete selected clip(s)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClips.length > 0) {
          e.preventDefault();
          removeSelectedClips();
        }
      }

      // Tab switching
      if (e.key === '1' && ctrlOrCmd) {
        e.preventDefault();
        setActiveTab('media');
      }
      if (e.key === '2' && ctrlOrCmd) {
        e.preventDefault();
        setActiveTab('settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClips, disabled, isExporting, activeTab, undo, redo, canUndo, canRedo, saveProject, loadProject, onExport, removeSelectedClips, copySelectedClips, pasteClips, showToast, t.video, togglePlayPause, currentTime, seekVideo, showRecentMenu, videoRef]);

  // Get selected clip for editing (first selected clip)
  const currentClip = useMemo(
    () => selectedClips.length > 0 ? t.video.find(c => c.id === selectedClips[0]) : null,
    [selectedClips, t.video]
  );

  return (
    <>
      {/* SIDEBAR - Left Panel */}
      <div className="sidebar">
        {/* Tab Navigation */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}>
            📁 Media
          </button>
          <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Settings
          </button>
        </div>

        {/* ==================== MEDIA TAB ==================== */}
        {activeTab === 'media' && (
          <div className="tab-content">
            {/* IMAGE LIBRARY */}
            <div className="section">
              <h3 className="section-title">📷 Image Library</h3>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => e.target.files && addImagesToLibrary(e.target.files)}
                style={{marginBottom: '12px'}}
              />
              {mediaImages.length > 0 ? (
                <div className="media-grid">
                  {mediaImages.map((img, idx) => (
                    <div key={idx} className="media-item">
                      <div className="media-thumbnail" style={{backgroundImage: `url('${img}')`}}
                        onClick={() => addLogoTrack(img)}
                        title="Click to add as logo track"
                      />
                      <div className="media-name">{img.split('/').pop() || img.split('\\').pop()}</div>
                      <button
                        className="btn-remove-media"
                        onClick={() => removeImageFromLibrary(img)}
                        title="Remove from library"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="media-empty">No images in library. Upload images to get started.</div>
              )}
            </div>

            {/* VIDEO LIBRARY */}
            <div className="section">
              <h3 className="section-title">🎬 Video Library</h3>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={e => e.target.files && addVideosToLibrary(e.target.files)}
                style={{marginBottom: '12px'}}
              />
              {mediaVideos.length > 0 ? (
                <div className="media-grid">
                  {mediaVideos.map((vid, idx) => (
                    <div key={idx} className="media-item">
                      <div className="media-thumbnail media-thumbnail-video"
                        onClick={() => {
                          addVideoClip(vid);
                          showToast('success', 'Video added to timeline');
                        }}
                        title="Click to add to timeline"
                      >
                        <div className="media-icon">🎬</div>
                      </div>
                      <div className="media-name">{vid.split('/').pop() || vid.split('\\').pop()}</div>
                      <button
                        className="btn-remove-media"
                        onClick={() => removeVideoFromLibrary(vid)}
                        title="Remove from library"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="media-empty">No videos in library. Upload videos to get started.</div>
              )}
            </div>

            {/* AUDIO LIBRARY */}
            <div className="section">
              <h3 className="section-title">🎵 Audio Library</h3>
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={e => e.target.files && addAudioToLibrary(e.target.files)}
                style={{marginBottom: '12px'}}
              />
              {mediaAudio.length > 0 ? (
                <div className="media-grid">
                  {mediaAudio.map((audio, idx) => (
                    <div key={idx} className="media-item">
                      <div className="media-thumbnail media-thumbnail-audio"
                        onClick={() => {
                          // Show menu to choose BGM or Voice
                          const choice = confirm('Add as BGM? (Cancel for Voice-over)');
                          addAudioTrack(audio, choice ? 'bgm' : 'voice');
                        }}
                        title="Click to add audio track (BGM or Voice)"
                      >
                        <div className="media-icon">🎵</div>
                      </div>
                      <div className="media-name">{audio.split('/').pop() || audio.split('\\').pop()}</div>
                      <button
                        className="btn-remove-media"
                        onClick={() => removeAudioFromLibrary(audio)}
                        title="Remove from library"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="media-empty">No audio in library. Upload audio files to get started.</div>
              )}
            </div>

            {/* INTRO LIBRARY */}
            <div className="section">
              <h3 className="section-title">🎞️ Intro Library</h3>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={e => e.target.files && addIntrosToLibrary(e.target.files)}
                style={{marginBottom: '12px'}}
              />
              {mediaIntros.length > 0 ? (
                <div className="media-grid">
                  {mediaIntros.map((intro, idx) => (
                    <div key={idx} className="media-item">
                      <div className="media-thumbnail media-thumbnail-video"
                        onClick={() => {
                          t.intro = { src: intro, duration: 3 };
                          setP({ ...p });
                          showToast('success', 'Video set as intro');
                        }}
                        title="Click to use as intro"
                      >
                        <div className="media-icon">🎞️</div>
                      </div>
                      <div className="media-name">{intro.split('/').pop() || intro.split('\\').pop()}</div>
                      <button
                        className="btn-remove-media"
                        onClick={() => removeIntroFromLibrary(intro)}
                        title="Remove from library"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="media-empty">No intro videos in library. Upload intro videos to get started.</div>
              )}
            </div>

            {/* OUTRO LIBRARY */}
            <div className="section">
              <h3 className="section-title">🎞️ Outro Library</h3>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={e => e.target.files && addOutrosToLibrary(e.target.files)}
                style={{marginBottom: '12px'}}
              />
              {mediaOutros.length > 0 ? (
                <div className="media-grid">
                  {mediaOutros.map((outro, idx) => (
                    <div key={idx} className="media-item">
                      <div className="media-thumbnail media-thumbnail-video"
                        onClick={() => {
                          t.outro = { src: outro, duration: 3 };
                          setP({ ...p });
                          showToast('success', 'Video set as outro');
                        }}
                        title="Click to use as outro"
                      >
                        <div className="media-icon">🎞️</div>
                      </div>
                      <div className="media-name">{outro.split('/').pop() || outro.split('\\').pop()}</div>
                      <button
                        className="btn-remove-media"
                        onClick={() => removeOutroFromLibrary(outro)}
                        title="Remove from library"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="media-empty">No outro videos in library. Upload outro videos to get started.</div>
              )}
            </div>

            {/* FONT LIBRARY */}
            <div className="section">
              <h3 className="section-title">🔤 Font Library</h3>
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                multiple
                onChange={e => e.target.files && addFontsToLibrary(e.target.files)}
                style={{marginBottom: '12px'}}
              />
              {mediaFonts.length > 0 ? (
                <div className="media-grid">
                  {mediaFonts.map((font, idx) => (
                    <div key={idx} className="media-item">
                      <div className="media-thumbnail media-thumbnail-audio"
                        onClick={() => {
                          const text = prompt('Enter ticker text:', 'TIN NÓNG: Chữ chạy demo | ');
                          if (text) {
                            addTickerTrack(text, font);
                          }
                        }}
                        title="Click to create ticker track with this font"
                      >
                        <div className="media-icon">🔤</div>
                      </div>
                      <div className="media-name">{font.split('/').pop() || font.split('\\').pop()}</div>
                      <button
                        className="btn-remove-media"
                        onClick={() => removeFontFromLibrary(font)}
                        title="Remove from library"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="media-empty">No fonts in library. Upload font files to get started.</div>
              )}
            </div>

            {/* Selected Clip Editor */}
            {currentClip && (
              <div className="section">
                <h3 className="section-title">
                  ✂️ Clip #{t.video.findIndex(c => c.id === selectedClips[0]) + 1}
                  {selectedClips.length > 1 && (
                    <span style={{fontSize: '11px', opacity: 0.7, marginLeft: '8px'}}>
                      (+{selectedClips.length - 1} more selected)
                    </span>
                  )}
                </h3>
                <label>Duration (s)</label>
                <input type="number" min="0.1" step="0.1" value={currentClip.duration || 5}
                  onChange={e => updateVideoClip(currentClip.id, { duration: Number(e.target.value) })} />

                {/* Clip Info */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  marginBottom: '12px'
                }}>
                  <div style={{opacity: 0.7, marginBottom: '4px'}}>Source File:</div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    wordBreak: 'break-all',
                    opacity: 0.9,
                    lineHeight: '1.4'
                  }}>
                    {currentClip.src.split('/').pop() || currentClip.src.split('\\').pop() || currentClip.src}
                  </div>
                </div>

                {/* Trim Controls */}
                <details style={{marginTop: '12px', marginBottom: '12px'}}>
                  <summary style={{cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginBottom: '8px'}}>
                    ✂️ Trim Clip
                  </summary>
                  <div className="row">
                    <div>
                      <label>Start Time (s)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={currentClip.trim?.start || 0}
                        onChange={e => {
                          const start = Math.max(0, Number(e.target.value));
                          const end = currentClip.trim?.end || currentClip.duration || 5;
                          if (start < end) {
                            updateVideoClip(currentClip.id, {
                              trim: { start, end }
                            });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label>End Time (s)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={currentClip.trim?.end || currentClip.duration || 5}
                        onChange={e => {
                          const end = Math.max(0, Number(e.target.value));
                          const start = currentClip.trim?.start || 0;
                          if (end > start) {
                            updateVideoClip(currentClip.id, {
                              trim: { start, end }
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                  {currentClip.trim && (currentClip.trim.start > 0 || currentClip.trim.end < (currentClip.duration || 5)) && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'var(--bg-elevated)',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <div style={{opacity: 0.8}}>
                        Trimmed: {(currentClip.trim.end - currentClip.trim.start).toFixed(1)}s
                        ({currentClip.trim.start.toFixed(1)}s → {currentClip.trim.end.toFixed(1)}s)
                      </div>
                      <button
                        onClick={() => updateVideoClip(currentClip.id, { trim: undefined })}
                        style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          background: 'var(--error)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Reset Trim
                      </button>
                    </div>
                  )}
                </details>

                <label>Transition Type</label>
                <select value={currentClip.transition?.type || 'fade'}
                  onChange={e => updateVideoClip(currentClip.id, {
                    transition: { ...currentClip.transition, type: e.target.value as TransitionType, duration: currentClip.transition?.duration || 1 }
                  })}>
                  <option value="none">None</option>
                  <option value="fade">Fade</option>
                  <option value="fadeblack">Fade Black</option>
                  <option value="wipeleft">Wipe Left</option>
                  <option value="wiperight">Wipe Right</option>
                  <option value="wipeup">Wipe Up</option>
                  <option value="wipedown">Wipe Down</option>
                  <option value="slideleft">Slide Left</option>
                  <option value="slideright">Slide Right</option>
                  <option value="slideup">Slide Up</option>
                  <option value="slidedown">Slide Down</option>
                  <option value="circlecrop">Circle Crop</option>
                  <option value="circleopen">Circle Open</option>
                  <option value="dissolve">Dissolve</option>
                </select>

                <label>Transition Duration (s)</label>
                <input type="number" min="0.1" max="3" step="0.1" value={currentClip.transition?.duration || 1}
                  onChange={e => updateVideoClip(currentClip.id, {
                    transition: { ...currentClip.transition, type: currentClip.transition?.type || 'fade', duration: Number(e.target.value) }
                  })} />
              </div>
            )}

          </div>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            {/* Project Templates */}
            <div className="section">
              <h3 className="section-title">📋 Project Templates</h3>
              <label>Apply Template</label>
              <select
                onChange={e => {
                  if (e.target.value && e.target.value !== '') {
                    applyProjectTemplate(e.target.value);
                    e.target.value = ''; // Reset dropdown
                  }
                }}
                style={{fontWeight: '600'}}
                defaultValue=""
              >
                <option value="">-- Select Template --</option>
                <option value="blank">🔄 Blank Project</option>
                <option value="news-report">📰 News Report</option>
                <option value="social-media">📱 Social Media (Vertical)</option>
                <option value="tutorial">📚 Tutorial</option>
                <option value="promo">✨ Promo/Ad</option>
              </select>
              <div className="hint" style={{marginTop: '8px', fontSize: '11px'}}>
                Templates provide pre-configured settings for common video types
              </div>
            </div>

            {/* Project Settings */}
            <div className="section">
              <h3 className="section-title">⚙️ Project</h3>
              <div className="row">
                <div><label>FPS</label><input type="number" value={p.fps} onChange={e => set("fps", Number(e.target.value||24))} /></div>
                <div><label>Duration</label><input type="number" value={p.duration} onChange={e => set("duration", Number(e.target.value||15))} /></div>
              </div>
              <div className="row">
                <div><label>Width</label><input type="number" value={p.width} onChange={e => set("width", Number(e.target.value||1920))} /></div>
                <div><label>Height</label><input type="number" value={p.height} onChange={e => set("height", Number(e.target.value||1080))} /></div>
              </div>
            </div>

            {/* Frame */}
            <div className="section">
              <h3 className="section-title">🖼️ Frame</h3>
              <div className="row">
                <div><label>Enable</label><select value={t.frame?.enable ? "1":"0"} onChange={e => { t.frame!.enable = e.target.value==="1"; setP({ ...p }); }}>
                  <option value="1">On</option><option value="0">Off</option>
                </select></div>
                <div><label>Thickness</label><input type="number" value={t.frame?.thickness ?? 12} onChange={e => { t.frame!.thickness = Number(e.target.value||12); setP({ ...p }); }} disabled={!t.frame?.enable} /></div>
              </div>
              <label>Color</label>
              <input value={t.frame?.color ?? "white@0.85"} onChange={e => { t.frame!.color = e.target.value; setP({ ...p }); }}
                placeholder="white@0.85" disabled={!t.frame?.enable} />
            </div>

            {/* Auto-Backup */}
            <div className="section">
              <h3 className="section-title">💾 Auto-Backup</h3>
              <div className="row">
                <div style={{flex: 1}}>
                  <label>Enable Auto-Save</label>
                  <select value={autoSaveEnabled ? "1" : "0"} onChange={e => {
                    const enabled = e.target.value === "1";
                    setAutoSaveEnabled(enabled);
                    showToast(enabled ? 'success' : 'warning', `Auto-save ${enabled ? 'enabled' : 'disabled'}`);
                  }}>
                    <option value="1">On</option>
                    <option value="0">Off</option>
                  </select>
                </div>
              </div>
              {lastAutoSaveTime && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  textAlign: 'center',
                  opacity: 0.8
                }}>
                  Last saved: {lastAutoSaveTime.toLocaleTimeString()}
                </div>
              )}
              <div className="hint" style={{marginTop: '8px', textAlign: 'center', fontSize: '11px'}}>
                Auto-saves every {AUTOSAVE_INTERVAL / 1000}s to localStorage
              </div>
            </div>

            {/* Export */}
            <div className="section">
              <h3 className="section-title">📤 Export</h3>
              <button onClick={onExport} disabled={disabled} style={{padding: '12px', fontSize: '15px', fontWeight: '600'}}>
                {disabled ? '⚠️ Add video' : '🎬 Export MP4'}
              </button>
              <div className="hint" style={{marginTop: '8px', textAlign: 'center'}}>output_news.mp4</div>
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW SECTION - Center */}
      <div className="preview-section">
        <div className="preview-container" ref={previewContainerRef}>
          <div
            className="preview-video"
            onMouseMove={handleLogoMouseMove}
            onMouseUp={handleLogoMouseUp}
            onMouseLeave={handleLogoMouseUp}
            style={{ position: 'relative', cursor: draggedLogoId ? 'grabbing' : 'default' }}
          >
            {t.video.length > 0 && t.video[0].src ? (
              <>
                <video
                  ref={videoRef}
                  src={t.video[0].src}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '12px'
                  }}
                />

                {/* Logo Overlays - Draggable */}
                {t.logos.map((logo) => (
                  <div
                    key={logo.id}
                    onMouseDown={(e) => handleLogoMouseDown(e, logo.id)}
                    style={{
                      position: 'absolute',
                      left: logo.x !== undefined ? `${logo.x}px` : '20px',
                      top: logo.y !== undefined ? `${logo.y}px` : '20px',
                      opacity: logo.opacity ?? 0.9,
                      cursor: draggedLogoId === logo.id ? 'grabbing' : 'grab',
                      zIndex: 10,
                      pointerEvents: 'auto'
                    }}
                    title={`${logo.name} - Click and drag to reposition`}
                  >
                    <img
                      src={logo.src}
                      alt={logo.name}
                      style={{
                        width: `${logo.scale ?? 220}px`,
                        height: 'auto',
                        userSelect: 'none',
                        border: draggedLogoId === logo.id ? '2px solid #3b82f6' : '2px solid transparent',
                        borderRadius: '4px'
                      }}
                      draggable={false}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '-20px',
                      left: '0',
                      fontSize: '10px',
                      background: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                      opacity: draggedLogoId === logo.id ? 1 : 0,
                      transition: 'opacity 0.2s'
                    }}>
                      x:{logo.x ?? 0} y:{logo.y ?? 0}
                    </div>
                  </div>
                ))}

                {/* Video Progress Bar */}
                <div
                  ref={seekbarRef}
                  className="video-seekbar"
                  onMouseDown={handleSeekbarMouseDown}
                  onMouseMove={handleSeekbarMouseMove}
                  onMouseLeave={handleSeekbarMouseLeave}
                  style={{ cursor: isDraggingSeekbar ? 'grabbing' : 'pointer' }}
                >
                  <div
                    className="video-seekbar-progress"
                    style={{
                      width: `${videoRef.current && videoRef.current.duration > 0
                        ? (currentTime / videoRef.current.duration) * 100
                        : 0}%`
                    }}
                  />
                  <div
                    className="video-seekbar-handle"
                    style={{
                      left: `${videoRef.current && videoRef.current.duration > 0
                        ? (currentTime / videoRef.current.duration) * 100
                        : 0}%`
                    }}
                  />
                  {seekbarHoverTime !== null && (
                    <div
                      className="video-seekbar-tooltip"
                      style={{
                        left: `${videoRef.current && videoRef.current.duration > 0
                          ? (seekbarHoverTime / videoRef.current.duration) * 100
                          : 0}%`
                      }}
                    >
                      {formatTime(seekbarHoverTime)}
                    </div>
                  )}
                </div>

                {/* Video Controls */}
                <div className="video-controls">
                  <button className="btn-video-control" onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <span className="video-time">
                    {formatTime(currentTime)} / {videoRef.current ? formatTime(videoRef.current.duration || 0) : '0:00'}
                  </span>
                  <button className="btn-video-control" onClick={() => seekVideo(0)} title="Restart">
                    ⏮️
                  </button>

                  <div className="volume-control">
                    <button className="btn-video-control" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                      {volume === 0 || isMuted ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="volume-slider"
                      title={`Volume: ${Math.round(volume * 100)}%`}
                    />
                    <span className="volume-percent">{Math.round(volume * 100)}%</span>
                  </div>

                  <div className="speed-control">
                    <label className="speed-label">Speed:</label>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                      className="speed-select"
                      title="Playback speed"
                    >
                      <option value="0.25">0.25x</option>
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="1.75">1.75x</option>
                      <option value="2">2x</option>
                    </select>
                  </div>

                  <button
                    className="btn-video-control"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    style={{marginLeft: '12px'}}
                  >
                    {isFullscreen ? '⛶' : '⛶'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{textAlign: 'center', padding: '40px'}}>
                <p style={{fontSize: '20px', marginBottom: '12px', opacity: 0.9}}>📹 Video Preview</p>
                <p style={{fontSize: '14px', opacity: 0.6}}>
                  {t.intro ? 'Intro • ' : ''}
                  {t.video.length > 0 ? `${t.video.length} clip${t.video.length > 1 ? 's' : ''} ` : 'No clips'}
                  {t.outro ? ' • Outro' : ''}
                </p>
                <p style={{fontSize: '12px', opacity: 0.5, marginTop: '20px'}}>
                  {p.width} × {p.height} @ {p.fps}fps
                </p>
                <p style={{fontSize: '12px', opacity: 0.4, marginTop: '12px'}}>
                  Add a video clip to see preview
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TOOLBAR SECTION - Between Preview and Timeline */}
      <div className="toolbar-section">
        <div className="toolbar-group">
          <label>Export Preset</label>
          <select value={exportPreset} onChange={e => applyExportPreset(e.target.value)} style={{fontWeight: '600'}}>
            <option value="custom">Custom</option>
            <option value="youtube">📺 YouTube</option>
            <option value="instagram-post">📷 Instagram Post</option>
            <option value="instagram-story">📱 Instagram Story</option>
            <option value="tiktok">🎵 TikTok</option>
            <option value="twitter">🐦 Twitter</option>
            <option value="facebook">👥 Facebook</option>
          </select>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <label>Tỉ lệ khung hình</label>
          <select value={aspectRatio} onChange={e => handleAspectRatioChange(e.target.value as AspectRatio)}>
            <option value="landscape">Ngang (16:9)</option>
            <option value="portrait">Dọc (9:16)</option>
            <option value="square">1:1</option>
          </select>
        </div>

        <div className="toolbar-group">
          <label>Độ phân giải</label>
          <select value={resolutionPreset} onChange={e => handleResolutionChange(e.target.value as ResolutionPreset)}>
            <option value="720p">720p</option>
            <option value="1080p">1080p (Full HD)</option>
            <option value="2k">2K</option>
            <option value="4k">4K (Ultra HD)</option>
          </select>
        </div>

        <div className="toolbar-divider"></div>

        <button className="btn-save" onClick={saveProject} title="Save project">
          💾 Save
        </button>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button className="btn-load" onClick={loadProject} title="Load project">
            📂 Load
          </button>

          {/* Recent Projects Dropdown Toggle */}
          <button
            className="btn-recent-toggle"
            onClick={() => setShowRecentMenu(!showRecentMenu)}
            title="Recent projects"
            style={{
              marginLeft: '4px',
              padding: '8px 10px',
              fontSize: '14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}
          >
            ▼
          </button>

          {/* Recent Projects Dropdown Menu */}
          {showRecentMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                minWidth: '300px',
                maxWidth: '400px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                padding: '8px 0'
              }}
            >
              <div style={{
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border)'
              }}>
                Recent Projects
              </div>

              {recentProjects.length === 0 ? (
                <div style={{
                  padding: '16px 12px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  opacity: 0.7
                }}>
                  No recent projects
                </div>
              ) : (
                <>
                  {recentProjects.map((project, idx) => (
                    <div
                      key={project.path}
                      onClick={() => loadFromRecent(project.path)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        borderBottom: idx < recentProjects.length - 1 ? '1px solid var(--border)' : 'none',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        📄 {project.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        opacity: 0.7,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {project.path}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '2px' }}>
                        {new Date(project.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  <div
                    onClick={clearRecentProjects}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#ef4444',
                      fontWeight: '500',
                      marginTop: '4px',
                      borderTop: '1px solid var(--border)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    🗑️ Clear History
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="toolbar-divider"></div>

        <button className="btn-theme" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        <div className="toolbar-divider"></div>

        <button className="btn-preview" onClick={() => showToast('info', 'Preview feature coming soon!')}>
          👁️ Preview
        </button>

        <button className="btn-render" onClick={onExport} disabled={disabled || isExporting}>
          {isExporting ? '⏳ Rendering...' : disabled ? '⚠️ Add video' : '🎬 Render'}
        </button>
      </div>

      {/* EXPORT PROGRESS BAR */}
      {exportProgress && (
        <div className="export-progress-container">
          <div className="export-progress-info">
            <span className="export-progress-label">
              Rendering video... {exportProgress.percent.toFixed(1)}%
            </span>
            <span className="export-progress-time">{exportProgress.timemark}</span>
          </div>
          <div className="export-progress-bar">
            <div
              className="export-progress-fill"
              style={{width: `${exportProgress.percent}%`}}
            />
          </div>
        </div>
      )}

      {/* TIMELINE SECTION - Bottom Full Width */}
      <div className="timeline-section">
        <div className="timeline-header">
          <span className="timeline-title">⏱️ Timeline Layers</span>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            {selectedClips.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '4px 8px',
                background: 'var(--accent-primary)',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                <span>{selectedClips.length} selected</span>
                <button
                  onClick={() => setSelectedClips([])}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: 'white'
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            <span style={{fontSize: '12px', opacity: 0.7}}>
              Total: {(t.intro?.duration || 0) + t.video.reduce((acc, c) => acc + (c.duration || 5), 0) + (t.outro?.duration || 0)}s
            </span>

            {/* Zoom Controls */}
            <div style={{display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '8px'}}>
              <button
                className="btn-timeline-zoom"
                onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.25))}
                disabled={timelineZoom <= 0.5}
                title="Zoom out timeline"
              >
                🔍−
              </button>
              <span style={{fontSize: '11px', minWidth: '45px', textAlign: 'center', opacity: 0.8}}>
                {(timelineZoom * 100).toFixed(0)}%
              </span>
              <button
                className="btn-timeline-zoom"
                onClick={() => setTimelineZoom(Math.min(2, timelineZoom + 0.25))}
                disabled={timelineZoom >= 2}
                title="Zoom in timeline"
              >
                🔍+
              </button>
            </div>
          </div>
        </div>

        <div className="timeline-tracks">
          {/* TEXT / TICKER TRACK - Top layer */}
          {/* TICKER TRACKS - Dynamic (multiple) */}
          {t.tickers.map((ticker) => (
            <div key={ticker.id} className="track text-track">
              <div className="track-label">
                <div className="track-label-title">
                  <span>📝</span>
                  <span>{ticker.name}</span>
                </div>
                <button
                  className="btn-track-remove"
                  onClick={() => removeTickerTrack(ticker.id)}
                  title="Remove ticker track"
                >×</button>
              </div>
              <div
                className="track-content"
                onMouseMove={handleTimelineTrackMouseMove}
                onMouseUp={handleTimelineTrackMouseUp}
                onMouseLeave={handleTimelineTrackMouseUp}
              >
                <div className="track-item-wrapper">
                  <div
                    className="resize-handle resize-handle-left"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, ticker.id, 'ticker', 'resize-start')}
                    title="Drag to change start time"
                  />
                  <div
                    className="track-item"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, ticker.id, 'ticker', 'move')}
                    style={{ cursor: timelineDrag.trackId === ticker.id ? 'grabbing' : 'grab' }}
                  >
                    <div className="track-item-name">🔤 {ticker.text.substring(0, 30)}...</div>
                    <div className="track-item-info">
                      {ticker.position || 'footer'} • {ticker.direction || 'rtl'} • {(ticker.start ?? 0).toFixed(1)}s - {(ticker.end ?? p.duration).toFixed(1)}s
                    </div>
                  </div>
                  <div
                    className="resize-handle resize-handle-right"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, ticker.id, 'ticker', 'resize-end')}
                    title="Drag to change end time"
                  />
                </div>
              </div>
            </div>
          ))}
          {t.tickers.length === 0 && (
            <div className="track text-track">
              <div className="track-label">
                <div className="track-label-title">
                  <span>📝</span>
                  <span>Ticker</span>
                </div>
              </div>
              <div className="track-content">
                <div className="track-empty">No ticker tracks (use Font Library to add)</div>
              </div>
            </div>
          )}

          {/* FRAME TRACK */}
          <div className="track frame-track">
            <div className="track-label">
              <div className="track-label-title">
                <span>🖼️</span>
                <span>Frame</span>
              </div>
              <div className="track-label-subtitle">Layer 4</div>
            </div>
            <div className="track-content">
              {t.frame?.enable ? (
                <div className="track-item">
                  <div className="track-item-name">⬜ Frame Border</div>
                  <div className="track-item-info">
                    {t.frame.thickness}px • {t.frame.color}
                  </div>
                </div>
              ) : (
                <div className="track-empty">Frame disabled</div>
              )}
            </div>
          </div>

          {/* LOGO TRACKS - Dynamic (multiple overlays) */}
          {t.logos.map((logo) => (
            <div key={logo.id} className="track logo-track">
              <div className="track-label">
                <div className="track-label-title">
                  <span>🏷️</span>
                  <span>{logo.name}</span>
                </div>
                <button
                  className="btn-track-remove"
                  onClick={() => removeLogoTrack(logo.id)}
                  title="Remove logo track"
                >×</button>
              </div>
              <div
                className="track-content"
                onMouseMove={handleTimelineTrackMouseMove}
                onMouseUp={handleTimelineTrackMouseUp}
                onMouseLeave={handleTimelineTrackMouseUp}
              >
                <div className="track-item-wrapper">
                  <div
                    className="resize-handle resize-handle-left"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, logo.id, 'logo', 'resize-start')}
                    title="Drag to change start time"
                  />
                  <div
                    className="track-item"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, logo.id, 'logo', 'move')}
                    style={{ cursor: timelineDrag.trackId === logo.id ? 'grabbing' : 'grab' }}
                  >
                    <div className="track-item-name">🖼️ {logo.src.split('/').pop()}</div>
                    <div className="track-item-info">
                      {logo.pos || `x:${logo.x ?? 0} y:${logo.y ?? 0}`} • {(logo.start ?? 0).toFixed(1)}s - {(logo.end ?? p.duration).toFixed(1)}s
                    </div>
                  </div>
                  <div
                    className="resize-handle resize-handle-right"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, logo.id, 'logo', 'resize-end')}
                    title="Drag to change end time"
                  />
                </div>
              </div>
            </div>
          ))}
          {t.logos.length === 0 && (
            <div className="track logo-track">
              <div className="track-label">
                <div className="track-label-title">
                  <span>🏷️</span>
                  <span>Logo</span>
                </div>
              </div>
              <div className="track-content">
                <div className="track-empty">No logo tracks (use Image Library to add)</div>
              </div>
            </div>
          )}

          {/* AUDIO TRACKS - Dynamic (multiple) */}
          {t.audios.map((audio) => (
            <div key={audio.id} className="track audio-track">
              <div className="track-label">
                <div className="track-label-title">
                  <span>{audio.type === 'voice' ? '🎤' : '🎵'}</span>
                  <span>{audio.name}</span>
                </div>
                <button
                  className="btn-track-remove"
                  onClick={() => removeAudioTrack(audio.id)}
                  title="Remove audio track"
                >×</button>
              </div>
              <div
                className="track-content"
                onMouseMove={handleTimelineTrackMouseMove}
                onMouseUp={handleTimelineTrackMouseUp}
                onMouseLeave={handleTimelineTrackMouseUp}
              >
                <div className="track-item-wrapper">
                  <div
                    className="resize-handle resize-handle-left"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, audio.id, 'audio', 'resize-start')}
                    title="Drag to change start time"
                  />
                  <div
                    className="track-item"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, audio.id, 'audio', 'move')}
                    style={{ cursor: timelineDrag.trackId === audio.id ? 'grabbing' : 'grab' }}
                  >
                    <div className="track-item-name">
                      {audio.type === 'voice' ? '🎤' : '🎵'} {audio.src.split('/').pop()}
                    </div>
                    <div className="track-item-info">
                      {audio.type === 'voice' ? 'Voice' : 'BGM'} • {audio.gain || 0}dB
                      {audio.duckOthers ? ' • Duck' : ''} • {(audio.start ?? 0).toFixed(1)}s - {(audio.end ?? p.duration).toFixed(1)}s
                    </div>
                  </div>
                  <div
                    className="resize-handle resize-handle-right"
                    onMouseDown={(e) => handleTimelineTrackMouseDown(e, audio.id, 'audio', 'resize-end')}
                    title="Drag to change end time"
                  />
                </div>
              </div>
            </div>
          ))}
          {t.audios.length === 0 && (
            <div className="track audio-track">
              <div className="track-label">
                <div className="track-label-title">
                  <span>🎵</span>
                  <span>Audio</span>
                </div>
              </div>
              <div className="track-content">
                <div className="track-empty">No audio tracks (use Audio Library to add)</div>
              </div>
            </div>
          )}

          {/* VIDEO TRACK - Bottom layer */}
          <div className="track video-track">
            <div className="track-label">
              <div className="track-label-title">
                <span>🎬</span>
                <span>Video</span>
              </div>
              <div className="track-label-subtitle">Layer 1</div>
            </div>
            <div
              className="track-content"
              style={{transformOrigin: 'left', transform: `scaleX(${timelineZoom})`, position: 'relative', cursor: isDraggingPlayhead ? 'grabbing' : 'default'}}
              onClick={handleTimelineClick}
            >
              {/* Playhead */}
              <div
                className="playhead"
                style={{left: `${playheadPosition}%`, cursor: isDraggingPlayhead ? 'grabbing' : 'grab'}}
                title={`Playhead: ${playheadPosition.toFixed(1)}%`}
                onMouseDown={handlePlayheadMouseDown}
              />

              {/* Intro */}
              {t.intro?.src && (
                <div className="track-item" onClick={() => setSelectedClips([])}>
                  <div className="track-item-name">🎬 Intro</div>
                  <div className="track-item-info">{t.intro.duration || 3}s</div>
                </div>
              )}

              {/* Main Clips */}
              {t.video.map((clip, idx) => {
                const filename = clip.src.split('/').pop() || clip.src.split('\\').pop() || 'video';
                const shortName = filename.length > 15 ? filename.substring(0, 12) + '...' : filename;
                return (
                  <div key={clip.id}
                    className="track-item"
                    draggable
                    onDragStart={(e) => handleClipDragStart(e, clip.id)}
                    onDragOver={(e) => handleClipDragOver(e, clip.id)}
                    onDragEnd={handleClipDragEnd}
                    onDrop={(e) => handleClipDrop(e, clip.id)}
                    onClick={(e) => {
                      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
                      toggleClipSelection(clip.id, isCtrlOrCmd);
                    }}
                    title={`${filename}\nClick to select, Ctrl/Cmd+Click for multi-select\nDrag to reorder`}
                    style={{
                      ...(selectedClips.includes(clip.id) ? {borderColor: '#3b82f6', background: '#212e42'} : {}),
                      ...(draggedClipId === clip.id ? {opacity: 0.5} : {}),
                      ...(dragOverClipId === clip.id && draggedClipId !== clip.id ? {borderColor: '#10b981', borderStyle: 'solid'} : {}),
                      cursor: 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                      <div className="track-item-name" style={{fontSize: '11px'}}>
                        📹 Clip #{idx + 1}
                        {clip.trim && (clip.trim.start > 0 || clip.trim.end < (clip.duration || 5)) && (
                          <span style={{marginLeft: '4px', fontSize: '10px', opacity: 0.7}}>✂️</span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '9px',
                      opacity: 0.6,
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {shortName}
                    </div>
                    <div className="track-item-info" style={{fontSize: '10px'}}>
                      {clip.trim ? (
                        <>
                          {(clip.trim.end - clip.trim.start).toFixed(1)}s • {clip.transition?.type || 'fade'}
                        </>
                      ) : (
                        <>
                          {clip.duration || 5}s • {clip.transition?.type || 'fade'}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Video Button */}
              <div className={`track-item ${dragOver === 'video' ? 'drag-over' : ''}`}
                style={{border: '1px dashed #3b4b5d', cursor: 'pointer', background: 'transparent'}}
                onDragOver={(e) => handleDragOver(e, 'video')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'video')}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'video/*';
                  input.multiple = true;
                  input.onchange = (e: any) => {
                    const files = e.target?.files;
                    if (files) Array.from(files).forEach((f: any) => addVideoClip((f as any).path ?? ""));
                  };
                  input.click();
                }}>
                <div className="track-item-name" style={{opacity: 0.6}}>+ Add Video</div>
              </div>

              {/* Outro */}
              {t.outro?.src && (
                <div className="track-item" onClick={() => setSelectedClips([])}>
                  <div className="track-item-name">🎬 Outro</div>
                  <div className="track-item-info">{t.outro.duration || 3}s</div>
                </div>
              )}

              {!t.intro?.src && !t.video.length && !t.outro?.src && (
                <div className="track-empty">No video clips</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Confirm Modal - Lazy loaded */}
      <Suspense fallback={<div />}>
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={closeConfirm}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText="Restore"
          cancelText="Skip"
          type="info"
        />
      </Suspense>
    </>
  );
}
