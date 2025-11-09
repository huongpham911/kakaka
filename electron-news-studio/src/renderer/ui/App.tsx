import React, { useMemo, useState, useEffect, useCallback } from "react";
import type { Project, VideoClip, TransitionType } from "../../shared/types";
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
import { ConfirmModal } from "./Modal";
import { ClipEditor } from "./ClipEditor";
import { useHistory } from "../hooks/useHistory";

declare global {
  interface Window {
    electronAPI?: {
      export: (p: Project) => Promise<string>;
      saveProject: (data: string) => Promise<string | null>;
      loadProject: () => Promise<{ path: string; data: string } | null>;
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
    logo: { src: "", pos: "top-right", opacity: 0.9, scale: 220, start: 0 },
    ticker: {
      text: "TIN NÓNG: Chữ chạy demo | ",
      font: "",
      size: 48,
      color: "white",
      y: 1000,
      speed: 250,
      box: true,
      boxColor: "black",
      boxOpacity: 0.55,
      textOpacity: 1.0,
      direction: 'rtl',
      position: 'footer',
      bold: false,
      italic: false,
      shadow: false,
      shadowColor: "black",
      shadowX: 2,
      shadowY: 2
    },
    frame: { enable: true, thickness: 12, color: "white@0.85" },
    audio: { bgm: { src: "", gain: -6 }, voice: { src: "", gain: 0, duck_bgm: true } }
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
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('landscape');
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>('1080p');
  const [exportProgress, setExportProgress] = useState<{ percent: number; timemark: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

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

  // Video clip management
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
      setSelectedClip(newClip.id);
      showToast('success', 'Video clip added successfully');
      return { ...s, tracks: { ...s.tracks, video: [...s.tracks.video, newClip] }};
    });
  }, [showToast]);

  const removeVideoClip = useCallback((id: string) => {
    setP(s => ({ ...s, tracks: { ...s.tracks, video: s.tracks.video.filter(c => c.id !== id) }}));
    setSelectedClip(prev => prev === id ? null : prev);
    showToast('info', 'Video clip removed');
  }, [showToast]);

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

  const handleDrop = (e: React.DragEvent, type: 'video' | 'intro' | 'outro' | 'logo' | 'font' | 'bgm' | 'voice') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const filePath = (file as any).path ?? file.name;

    // Validate file based on type
    let validation;
    switch (type) {
      case 'video':
      case 'intro':
      case 'outro':
        validation = validateVideoFormat(filePath);
        if (!validation.valid) {
          showToast('error', validation.error || 'Invalid video file');
          return;
        }
        break;
      case 'logo':
        validation = validateImageFormat(filePath);
        if (!validation.valid) {
          showToast('error', validation.error || 'Invalid image file');
          return;
        }
        break;
      case 'font':
        validation = validateFontFormat(filePath);
        if (!validation.valid) {
          showToast('error', validation.error || 'Invalid font file');
          return;
        }
        break;
      case 'bgm':
      case 'voice':
        validation = validateAudioFormat(filePath);
        if (!validation.valid) {
          showToast('error', validation.error || 'Invalid audio file');
          return;
        }
        break;
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
      case 'logo':
        t.logo!.src = filePath;
        setP({ ...p });
        showToast('success', 'Logo image added');
        break;
      case 'font':
        t.ticker!.font = filePath;
        setP({ ...p });
        showToast('success', 'Ticker font added');
        break;
      case 'bgm':
        t.audio!.bgm!.src = filePath;
        setP({ ...p });
        showToast('success', 'Background music added');
        break;
      case 'voice':
        t.audio!.voice!.src = filePath;
        setP({ ...p });
        showToast('success', 'Voice-over added');
        break;
    }
  };

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
        showToast('success', `Project loaded: ${result.path}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', `Load error: ${e?.message || 'Unknown error'}`);
    }
  }

  // Auto-save to localStorage
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify(p));
        console.log("Auto-saved to localStorage");
      } catch (e) {
        console.error("Auto-save error:", e);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [p]);

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

  // Theme management
  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
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

  // Listen to export progress
  useEffect(() => {
    if (!window.electronAPI?.onExportProgress) return;

    const cleanup = window.electronAPI.onExportProgress((data) => {
      setExportProgress(data);
    });

    return cleanup;
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
        }
      }

      // Delete selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClip) {
          e.preventDefault();
          removeVideoClip(selectedClip);
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
  }, [selectedClip, disabled, isExporting, activeTab, undo, redo, canUndo, canRedo, saveProject, loadProject, onExport, removeVideoClip, showToast]);

  // Get selected clip for editing
  const currentClip = selectedClip ? t.video.find(c => c.id === selectedClip) : null;

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
            {/* Selected Clip Editor */}
            {currentClip && (
              <div className="section">
                <h3 className="section-title">✂️ Clip #{t.video.findIndex(c => c.id === selectedClip) + 1}</h3>
                <label>Duration (s)</label>
                <input type="number" min="0.1" step="0.1" value={currentClip.duration || 5}
                  onChange={e => updateVideoClip(currentClip.id, { duration: Number(e.target.value) })} />

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

            {/* Logo Section */}
            <div className="section">
              <h3 className="section-title">🖼️ Logo</h3>
              <div className={`dropzone ${dragOver === 'logo' ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'logo')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'logo')}>
                <input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  t.logo!.src = (f as any).path ?? "";
                  setP({ ...p });
                }} />
                {t.logo?.src && <div className="file-name">🖼️ {t.logo.src.split('/').pop()}</div>}
                <div className="drop-hint">Drop logo here</div>
              </div>
              {t.logo?.src && (
                <>
                  <label>Position</label>
                  <select value={t.logo?.pos} onChange={e => { t.logo!.pos = e.target.value; setP({ ...p }); }}>
                    <option>top-left</option><option>top-right</option><option>bottom-left</option>
                    <option>bottom-right</option><option>center</option>
                  </select>
                  <div className="row">
                    <div><label>Opacity</label><input type="number" min="0" max="1" step="0.05" value={t.logo?.opacity ?? 0.9}
                      onChange={e => { t.logo!.opacity = Number(e.target.value); setP({ ...p }); }} /></div>
                    <div><label>Scale</label><input type="number" value={t.logo?.scale ?? 220}
                      onChange={e => { t.logo!.scale = Number(e.target.value||220); setP({ ...p }); }} /></div>
                  </div>
                </>
              )}
            </div>

            {/* Audio Section */}
            <div className="section">
              <h3 className="section-title">🎵 Audio</h3>
              <label>BGM</label>
              <div className={`dropzone ${dragOver === 'bgm' ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'bgm')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'bgm')}>
                <input type="file" accept="audio/*" onChange={e => {
                  const f=e.target.files?.[0]; if(!f) return;
                  t.audio!.bgm!.src=(f as any).path??""; setP({ ...p });
                }} />
                {t.audio?.bgm?.src && <div className="file-name">🎵 {t.audio.bgm.src.split('/').pop()}</div>}
                <div className="drop-hint">Background music</div>
              </div>
              {t.audio?.bgm?.src && (
                <><label>Gain (dB)</label><input type="number" value={t.audio?.bgm?.gain ?? -6} onChange={e => { t.audio!.bgm!.gain = Number(e.target.value||-6); setP({ ...p }); }} /></>
              )}

              <label>Voice</label>
              <div className={`dropzone ${dragOver === 'voice' ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'voice')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'voice')}>
                <input type="file" accept="audio/*" onChange={e => {
                  const f=e.target.files?.[0]; if(!f) return;
                  t.audio!.voice!.src=(f as any).path??""; setP({ ...p });
                }} />
                {t.audio?.voice?.src && <div className="file-name">🎤 {t.audio.voice.src.split('/').pop()}</div>}
                <div className="drop-hint">Voice over</div>
              </div>
              {t.audio?.voice?.src && (
                <>
                  <label>Gain (dB)</label>
                  <input type="number" value={t.audio?.voice?.gain ?? 0} onChange={e => { t.audio!.voice!.gain = Number(e.target.value||0); setP({ ...p }); }} />
                  {t.audio?.bgm?.src && (
                    <><label>Duck BGM</label>
                    <select value={t.audio?.voice?.duck_bgm ? "1":"0"} onChange={e => { t.audio!.voice!.duck_bgm = e.target.value==="1"; setP({ ...p }); }}>
                      <option value="1">On</option><option value="0">Off</option>
                    </select></>
                  )}
                </>
              )}
            </div>

            {/* Ticker Section */}
            <div className="section">
              <h3 className="section-title">📝 Ticker</h3>
              <label>Text</label>
              <textarea rows={2} value={t.ticker?.text ?? ""} onChange={e => { t.ticker!.text = e.target.value; setP({ ...p }); }}
                placeholder="Enter ticker text..." style={{fontSize: '13px'}} />

              <label>Font</label>
              <div className={`dropzone ${dragOver === 'font' ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'font')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'font')}>
                <input type="file" accept=".ttf,.otf" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  t.ticker!.font = (f as any).path ?? ""; setP({ ...p });
                }} />
                {t.ticker?.font && <div className="file-name">🔤 {t.ticker.font.split('/').pop()}</div>}
                <div className="drop-hint">TTF/OTF font</div>
              </div>

              <div className="row">
                <div><label>Position</label><select value={t.ticker?.position ?? 'footer'} onChange={e => {
                  const pos = e.target.value as 'header' | 'footer' | 'custom';
                  t.ticker!.position = pos;
                  if (pos === 'header') t.ticker!.y = 50;
                  else if (pos === 'footer') t.ticker!.y = 1000;
                  setP({ ...p });
                }}><option value="header">Header</option><option value="footer">Footer</option><option value="custom">Custom</option></select></div>
                <div><label>Direction</label><select value={t.ticker?.direction ?? 'rtl'} onChange={e => { t.ticker!.direction = e.target.value as 'rtl' | 'ltr'; setP({ ...p }); }}>
                  <option value="rtl">← RTL</option><option value="ltr">LTR →</option>
                </select></div>
              </div>

              <details style={{marginTop: '12px'}}>
                <summary style={{cursor: 'pointer', fontSize: '12px', opacity: 0.85, marginBottom: '8px'}}>⚙️ Advanced</summary>
                <div className="row">
                  <div><label>Size</label><input type="number" value={t.ticker?.size ?? 48} onChange={e => { t.ticker!.size = Number(e.target.value||48); setP({ ...p }); }} /></div>
                  <div><label>Speed</label><input type="number" value={t.ticker?.speed ?? 250} onChange={e => { t.ticker!.speed = Number(e.target.value||250); setP({ ...p }); }} /></div>
                </div>
                <label>Color</label>
                <input type="text" value={t.ticker?.color ?? "white"} onChange={e => { t.ticker!.color = e.target.value; setP({ ...p }); }} />
                <label>Opacity</label>
                <input type="number" min="0" max="1" step="0.05" value={t.ticker?.textOpacity ?? 1.0} onChange={e => { t.ticker!.textOpacity = Number(e.target.value); setP({ ...p }); }} />
                <div className="row">
                  <div><label>Shadow</label><select value={t.ticker?.shadow ? "1":"0"} onChange={e => { t.ticker!.shadow = e.target.value==="1"; setP({ ...p }); }}><option value="0">Off</option><option value="1">On</option></select></div>
                  <div><label>Box BG</label><select value={t.ticker?.box ? "1":"0"} onChange={e => { t.ticker!.box = e.target.value==="1"; setP({ ...p }); }}><option value="0">Off</option><option value="1">On</option></select></div>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === 'settings' && (
          <div className="tab-content">
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
        <div className="preview-container">
          <div className="preview-video">
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

        <button className="btn-load" onClick={loadProject} title="Load project">
          📂 Load
        </button>

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

            <button
              className="btn-add-track"
              onClick={() => {
                showToast('info', 'Add Track feature coming soon! Currently all 5 layers are displayed by default.');
              }}
            >
              <span>➕</span>
              <span>Add Track</span>
            </button>
          </div>
        </div>

        <div className="timeline-tracks">
          {/* TEXT / TICKER TRACK - Top layer */}
          <div className="track text-track">
            <div className="track-label">
              <div className="track-label-title">
                <span>📝</span>
                <span>Text / Ticker</span>
              </div>
              <div className="track-label-subtitle">Layer 5</div>
            </div>
            <div className="track-content">
              {t.ticker?.text && t.ticker?.font ? (
                <div className="track-item">
                  <div className="track-item-name">🔤 {t.ticker.text.substring(0, 20)}...</div>
                  <div className="track-item-info">
                    {t.ticker.position || 'footer'} • {t.ticker.direction || 'rtl'}
                  </div>
                </div>
              ) : (
                <div className="track-empty">No ticker configured</div>
              )}
            </div>
          </div>

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

          {/* LOGO TRACK */}
          <div className="track logo-track">
            <div className="track-label">
              <div className="track-label-title">
                <span>🏷️</span>
                <span>Logo</span>
              </div>
              <div className="track-label-subtitle">Layer 3</div>
            </div>
            <div className="track-content">
              {t.logo?.src ? (
                <div className="track-item">
                  <div className="track-item-name">🖼️ {t.logo.src.split('/').pop()}</div>
                  <div className="track-item-info">
                    {t.logo.pos} • opacity: {t.logo.opacity}
                  </div>
                </div>
              ) : (
                <div className="track-empty">No logo</div>
              )}
            </div>
          </div>

          {/* AUDIO TRACK */}
          <div className="track audio-track">
            <div className="track-label">
              <div className="track-label-title">
                <span>🎵</span>
                <span>Audio</span>
              </div>
              <div className="track-label-subtitle">Layer 2</div>
            </div>
            <div className="track-content">
              {t.audio?.bgm?.src && (
                <div className="track-item">
                  <div className="track-item-name">🎵 {t.audio.bgm.src.split('/').pop()}</div>
                  <div className="track-item-info">BGM • {t.audio.bgm.gain}dB</div>
                </div>
              )}
              {t.audio?.voice?.src && (
                <div className="track-item">
                  <div className="track-item-name">🎤 {t.audio.voice.src.split('/').pop()}</div>
                  <div className="track-item-info">Voice • {t.audio.voice.gain}dB{t.audio.voice.duck_bgm ? ' • Duck' : ''}</div>
                </div>
              )}
              {!t.audio?.bgm?.src && !t.audio?.voice?.src && (
                <div className="track-empty">No audio</div>
              )}
            </div>
          </div>

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
                <div className="track-item" onClick={() => setSelectedClip(null)}>
                  <div className="track-item-name">🎬 Intro</div>
                  <div className="track-item-info">{t.intro.duration || 3}s</div>
                </div>
              )}

              {/* Main Clips */}
              {t.video.map((clip, idx) => (
                <div key={clip.id}
                  className="track-item"
                  draggable
                  onDragStart={(e) => handleClipDragStart(e, clip.id)}
                  onDragOver={(e) => handleClipDragOver(e, clip.id)}
                  onDragEnd={handleClipDragEnd}
                  onDrop={(e) => handleClipDrop(e, clip.id)}
                  onClick={() => setSelectedClip(clip.id)}
                  title="Drag to reorder"
                  style={{
                    ...(selectedClip === clip.id ? {borderColor: '#3b82f6', background: '#212e42'} : {}),
                    ...(draggedClipId === clip.id ? {opacity: 0.5} : {}),
                    ...(dragOverClipId === clip.id && draggedClipId !== clip.id ? {borderColor: '#10b981', borderStyle: 'solid'} : {}),
                    cursor: 'grab'
                  }}>
                  <div className="track-item-name">📹 Clip #{idx + 1}</div>
                  <div className="track-item-info">
                    {clip.duration || 5}s • {clip.transition?.type || 'fade'}
                  </div>
                </div>
              ))}

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
                <div className="track-item" onClick={() => setSelectedClip(null)}>
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

      {/* Confirm Modal */}
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
    </>
  );
}
