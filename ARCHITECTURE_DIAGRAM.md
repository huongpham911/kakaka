# 🎬 ELECTRON NEWS STUDIO - SƠ ĐỒ KIẾN TRÚC

## 📋 TỔNG QUAN
**Electron News Studio** là ứng dụng desktop để tạo video tin tức chuyên nghiệp với logo overlay, chữ chạy (ticker), khung viền, và audio mixing.

---

## 🏗️ KIẾN TRÚC TỔNG THỂ

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON NEWS STUDIO                         │
│                  (Desktop Application)                          │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐                 ┌──────────────────┐
│  MAIN PROCESS    │◄───────IPC─────►│ RENDERER PROCESS │
│   (Node.js)      │                 │   (React + Vite) │
└──────────────────┘                 └──────────────────┘
        │                                       │
        │                                       │
        ▼                                       ▼
┌──────────────────┐                 ┌──────────────────┐
│  - FFmpeg Export │                 │  - UI Components │
│  - File I/O      │                 │  - State Mgmt    │
│  - IPC Handlers  │                 │  - Timeline      │
└──────────────────┘                 └──────────────────┘
```

---

## 📂 CẤU TRÚC THƯ MỤC

```
electron-news-studio/
│
├── src/
│   ├── main/                          # ELECTRON MAIN PROCESS
│   │   ├── main.ts                    # Entry point, window mgmt, IPC
│   │   ├── preload.cjs                # IPC bridge (contextBridge)
│   │   └── render/
│   │       └── exporter.ts            # FFmpeg export engine ⭐
│   │
│   ├── renderer/                      # REACT RENDERER
│   │   ├── index.html                 # HTML entry
│   │   ├── main.tsx                   # React entry point
│   │   ├── ui/
│   │   │   ├── App.tsx                # Main UI component ⭐
│   │   │   ├── ClipEditor.tsx         # Clip editing controls
│   │   │   ├── Toast.tsx              # Toast notifications
│   │   │   └── Modal.tsx              # Confirmation modals
│   │   └── hooks/
│   │       └── useHistory.ts          # Undo/Redo functionality
│   │
│   ├── shared/                        # SHARED CODE
│   │   ├── types.ts                   # TypeScript types
│   │   ├── constants.ts               # App constants
│   │   └── validation.ts              # Input validation
│   │
│   └── setupTests.ts                  # Test configuration
│
├── package.json                       # Dependencies
├── vite.config.ts                     # Vite bundler config
└── tsconfig.json                      # TypeScript config
```

---

## 🎨 KIẾN TRÚC UI - RENDERER PROCESS

```
┌────────────────────────────────────────────────────────────────┐
│                          APP.TSX                               │
│                   (Main React Component)                       │
└────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   SIDEBAR    │   │   PREVIEW    │   │   TIMELINE   │
│   (Left)     │   │   (Center)   │   │   (Bottom)   │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        │                   │                   │
   ┌────┴────┐         ┌────┴────┐       ┌─────┴─────┐
   │         │         │         │       │           │
   ▼         ▼         ▼         ▼       ▼           ▼
┌─────┐ ┌─────┐   ┌──────┐ ┌──────┐ ┌──────┐   ┌──────┐
│Media│ │Sett-│   │Video │ │Ctrl  │ │5     │   │Zoom  │
│ Tab │ │ings │   │Play- │ │Panel │ │Layers│   │Tools │
│     │ │ Tab │   │back  │ │      │ │      │   │      │
└─────┘ └─────┘   └──────┘ └──────┘ └──────┘   └──────┘
```

### 🎯 SIDEBAR - Left Panel

```
┌─────────────────────────────┐
│      TABBED SIDEBAR         │
├─────────────────────────────┤
│  [📁 Media] [⚙️ Settings]   │
├─────────────────────────────┤
│                             │
│  ┌─ MEDIA TAB ────────────┐│
│  │                         ││
│  │ ✂️ Clip Editor          ││
│  │   - Duration            ││
│  │   - Trim (start/end)    ││
│  │   - Transition type     ││
│  │                         ││
│  │ 🖼️ Logo                 ││
│  │   - Upload image        ││
│  │   - Position            ││
│  │   - Opacity & Scale     ││
│  │                         ││
│  │ 🎵 Audio                ││
│  │   - BGM (music)         ││
│  │   - Voice-over          ││
│  │   - Gain control (dB)   ││
│  │   - Ducking toggle      ││
│  │                         ││
│  │ 📝 Ticker               ││
│  │   - Text input          ││
│  │   - Font upload         ││
│  │   - Position/Direction  ││
│  │   - Color/Shadow/Box    ││
│  └─────────────────────────┘│
│                             │
│  ┌─ SETTINGS TAB ─────────┐│
│  │                         ││
│  │ 📋 Templates            ││
│  │ ⚙️ Project (FPS/Size)   ││
│  │ 🖼️ Frame Border         ││
│  │ 💾 Auto-save            ││
│  │ 📤 Export Button        ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

### 📺 PREVIEW - Center Panel

```
┌─────────────────────────────────┐
│      VIDEO PREVIEW AREA         │
├─────────────────────────────────┤
│                                 │
│    ┌───────────────────────┐   │
│    │                       │   │
│    │   🎬 VIDEO PLAYER     │   │
│    │   (HTML5 <video>)     │   │
│    │                       │   │
│    └───────────────────────┘   │
│                                 │
│    ═══════════════════════     │ ◄── Seekbar
│                                 │
│    [▶️] 0:00/5:00 [⏮️]          │ ◄── Controls
│    [🔊] ████░░ 80%             │ ◄── Volume
│    Speed: [1x▼]  [⛶]          │ ◄── Speed/Fullscreen
│                                 │
├─────────────────────────────────┤
│      TOOLBAR                    │
│  [Preset▼] [Ratio▼] [Res▼]     │
│  [💾Save] [📂Load] [☀️Theme]    │
│  [👁️Preview] [🎬Render]         │
└─────────────────────────────────┘
```

### ⏱️ TIMELINE - Bottom Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  ⏱️ Timeline Layers                         [🔍- 100% 🔍+] [➕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 5: 📝 Text/Ticker  │ [🔤 TIN NÓNG: Chữ chạy...]        │
│  Layer 4: 🖼️ Frame         │ [⬜ Frame Border: 12px]            │
│  Layer 3: 🏷️ Logo          │ [🖼️ logo.png: top-right]          │
│  Layer 2: 🎵 Audio         │ [🎵 bgm.mp3] [🎤 voice.mp3]       │
│  Layer 1: 🎬 Video         │ [Intro] [Clip#1] [Clip#2] [Outro] │
│                           │    ▲ playhead                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 DATA FLOW - IPC COMMUNICATION

```
┌─────────────────────┐                    ┌─────────────────────┐
│   RENDERER PROCESS  │                    │    MAIN PROCESS     │
│      (React)        │                    │     (Node.js)       │
└─────────────────────┘                    └─────────────────────┘
          │                                           │
          │  1. User clicks "Export" button          │
          ├──────────────────────────────────────────►│
          │     IPC: export(project)                  │
          │                                           │
          │                                2. Build   │
          │                                FFmpeg     │
          │                                pipeline   │
          │                                           │
          │  3. Progress updates (every frame)       │
          │◄──────────────────────────────────────────┤
          │     IPC: export-progress                  │
          │     {percent: 45%, timemark: "00:00:15"}  │
          │                                           │
          │  4. Export complete                       │
          │◄──────────────────────────────────────────┤
          │     return: "/path/output_news.mp4"      │
          │                                           │
          ▼                                           ▼
   Show toast notification               Write MP4 file to disk
   "Export successful!"
```

### 🔌 IPC Handlers (main.ts)

```typescript
// IPC Channel Map:
┌──────────────────────┬────────────────────────────────┐
│ Channel Name         │ Purpose                        │
├──────────────────────┼────────────────────────────────┤
│ export               │ Render video to MP4            │
│ export-progress      │ Real-time export progress      │
│ save-project         │ Save .nsproj file              │
│ load-project         │ Load .nsproj file              │
└──────────────────────┴────────────────────────────────┘
```

---

## 🎥 VIDEO PROCESSING PIPELINE

### 📊 FFmpeg Filter Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    FFMPEG EXPORT PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

INPUT STAGE:
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Intro   │  │  Clip 1  │  │  Clip 2  │  │  Outro   │
│ (video)  │  │ (video)  │  │ (video)  │  │ (video)  │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────┐
│  STEP 1: Scale + Pad + Trim + FPS                   │
│  scale=1920:1080, pad, trim, fps=30                 │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 2: Apply Transitions (xfade filter)           │
│  [v0][v1]xfade=fade:duration=1:offset=5             │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 3: Concat segments (intro+main+outro)         │
│  [intro][main][outro]concat=n=3:v=1:a=0             │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 4: Logo Overlay                               │
│  overlay=x=W-w-20:y=20:enable='between(t,0,60)'     │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 5: Frame Border (4x drawbox)                  │
│  drawbox=x=0:y=0:w=iw:h=12:color=white@0.85         │
│  (top, bottom, left, right borders)                 │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 6: Scrolling Ticker Text                      │
│  drawtext=text='TIN NÓNG':x=w-mod(t*250,tw+w):y=1000│
└─────────────────────────────────────────────────────┘
     │
     ▼                            ┌──────────────┐
┌─────────────┐                  │   BGM        │
│  VIDEO OUT  │                  │  (audio)     │
│   [vout]    │                  └──────┬───────┘
└──────┬──────┘                         │
       │                          ┌─────▼────────┐
       │                          │   Voice      │
       │                          │  (audio)     │
       │                          └─────┬────────┘
       │                                │
       │                          ┌─────▼────────┐
       │                          │ Audio Mix    │
       │                          │ + Ducking    │
       │                          │   [aout]     │
       │                          └─────┬────────┘
       │                                │
       └────────────┬───────────────────┘
                    ▼
         ┌─────────────────────┐
         │   FINAL OUTPUT      │
         │   output_news.mp4   │
         │   H.264 + AAC       │
         └─────────────────────┘
```

### 🎬 Transition Types

```
┌──────────────┬────────────────────────────────┐
│ Type         │ Effect                         │
├──────────────┼────────────────────────────────┤
│ fade         │ Cross-fade blend               │
│ fadeblack    │ Fade to black then next clip   │
│ wipeleft     │ Wipe from right to left        │
│ wiperight    │ Wipe from left to right        │
│ wipeup       │ Wipe from bottom to top        │
│ wipedown     │ Wipe from top to bottom        │
│ slideleft    │ Slide out to left              │
│ slideright   │ Slide out to right             │
│ slideup      │ Slide up                       │
│ slidedown    │ Slide down                     │
│ circlecrop   │ Circle crop reveal             │
│ circleopen   │ Circle open reveal             │
│ dissolve     │ Dissolve effect                │
└──────────────┴────────────────────────────────┘
```

---

## 🎵 AUDIO PIPELINE

```
┌─────────────────────────────────────────────────────┐
│              AUDIO MIXING PIPELINE                  │
└─────────────────────────────────────────────────────┘

┌──────────────┐                    ┌──────────────┐
│     BGM      │                    │    Voice     │
│  (music.mp3) │                    │ (voice.mp3)  │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│ Volume Gain  │                    │ Volume Gain  │
│  (e.g. -6dB) │                    │  (e.g. 0dB)  │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │         ┌─────────────────────────┤
       │         │                         │
       │         ▼                         ▼
       │    ┌──────────────────────────────────┐
       │    │  If DUCKING enabled:             │
       └───►│  sidechaincompress               │
            │  (lower BGM when voice active)   │
            │                                  │
            │  If DUCKING disabled:            │
            │  amix (simple mix)               │
            └──────────────┬───────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Mixed Audio │
                    │    [aout]    │
                    └──────────────┘
```

---

## 💾 STATE MANAGEMENT

```
┌─────────────────────────────────────────────────────┐
│                  REACT STATE                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  useHistory Hook (Undo/Redo)                        │
│  - Project state history                            │
│  - Undo/Redo operations                             │
│  - Ctrl+Z / Ctrl+Y shortcuts                        │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  Project State (p: Project)                         │
│                                                     │
│  {                                                  │
│    fps: number                                      │
│    width: number                                    │
│    height: number                                   │
│    duration: number                                 │
│    tracks: {                                        │
│      intro?: VideoClip                              │
│      video: VideoClip[]         ◄── Main timeline   │
│      outro?: VideoClip                              │
│      logo?: LogoConfig                              │
│      ticker?: TickerConfig                          │
│      frame?: FrameConfig                            │
│      audio?: {                                      │
│        bgm?: AudioTrack                             │
│        voice?: AudioTrack                           │
│      }                                              │
│    }                                                │
│  }                                                  │
└─────────────────────────────────────────────────────┘
                    │
                    ├─────► localStorage (auto-save every 30s)
                    │
                    ├─────► File system (.nsproj files)
                    │
                    └─────► IPC → Main Process → FFmpeg
```

---

## 🎯 FEATURE LAYERS (Compositing Order)

```
        TOP (Last to render, appears on top)
        ↑
        │
    ┌───┴───────────────────────────────────┐
    │  LAYER 5: Text/Ticker                 │ ◄── Scrolling news ticker
    │  (drawtext filter)                    │
    ├───────────────────────────────────────┤
    │  LAYER 4: Frame Border                │ ◄── Decorative border
    │  (4x drawbox filters)                 │
    ├───────────────────────────────────────┤
    │  LAYER 3: Logo Overlay                │ ◄── Logo with transparency
    │  (overlay filter)                     │
    ├───────────────────────────────────────┤
    │  LAYER 2: Audio Mix                   │ ◄── BGM + Voice + Ducking
    │  (amix/sidechaincompress)             │
    ├───────────────────────────────────────┤
    │  LAYER 1: Base Video                  │ ◄── Main timeline
    │  (intro → clips → outro)              │     (with transitions)
    └───────────────────────────────────────┘
        │
        ↓
    BOTTOM (First to render, background)
```

---

## 🔧 KEY FEATURES

### ✨ UI Features

```
┌────────────────────────────────────────────────┐
│  📁 Project Management                         │
│    - Save/Load projects (.nsproj)              │
│    - Auto-save (30s interval)                  │
│    - Recent projects menu                      │
│    - Project templates                         │
│                                                │
│  ✂️ Timeline Editing                           │
│    - Drag & drop reorder                       │
│    - Multi-select clips (Ctrl+Click)           │
│    - Copy/paste clips (Ctrl+C/V)               │
│    - Delete clips (Del/Backspace)              │
│    - Undo/Redo (Ctrl+Z/Y)                      │
│    - Timeline zoom (0.5x - 2x)                 │
│    - Playhead scrubbing                        │
│                                                │
│  🎬 Video Preview                              │
│    - HTML5 video playback                      │
│    - Play/pause (Space)                        │
│    - Seek controls (Arrow keys)                │
│    - Volume control                            │
│    - Playback speed (0.25x - 2x)               │
│    - Fullscreen mode                           │
│                                                │
│  📤 Export                                     │
│    - Real-time progress bar                    │
│    - H.264 video codec                         │
│    - AAC audio codec                           │
│    - Multiple resolution presets               │
│    - Platform presets (YouTube, Instagram, etc)│
│                                                │
│  🎨 Theming                                    │
│    - Dark/Light mode toggle                    │
│    - Persistent preferences                    │
│                                                │
│  🔔 Notifications                              │
│    - Toast messages                            │
│    - Confirmation modals                       │
│    - Error handling                            │
└────────────────────────────────────────────────┘
```

### ⌨️ Keyboard Shortcuts

```
┌─────────────────┬────────────────────────────┐
│ Shortcut        │ Action                     │
├─────────────────┼────────────────────────────┤
│ Ctrl+S          │ Save project               │
│ Ctrl+O          │ Open project               │
│ Ctrl+E          │ Export video               │
│ Ctrl+Z          │ Undo                       │
│ Ctrl+Y          │ Redo                       │
│ Ctrl+C          │ Copy selected clips        │
│ Ctrl+V          │ Paste clips                │
│ Ctrl+A          │ Select all clips           │
│ Space           │ Play/Pause preview         │
│ Arrow Left/Right│ Seek video (-5s/+5s)       │
│ Shift+Arrows    │ Seek video (-10s/+10s)     │
│ Home            │ Jump to start              │
│ End             │ Jump to end                │
│ Delete          │ Remove selected clips      │
│ Escape          │ Clear selection            │
│ Ctrl+1          │ Switch to Media tab        │
│ Ctrl+2          │ Switch to Settings tab     │
└─────────────────┴────────────────────────────┘
```

---

## 📦 DATA STRUCTURES

### TypeScript Types

```typescript
// Project Configuration
interface Project {
  fps: number;                    // 24, 30, 60
  width: number;                  // 1920, 1080, etc
  height: number;                 // 1080, 1920, etc
  duration: number;               // Total seconds
  tracks: {
    intro?: VideoClip;
    video: VideoClip[];           // Main timeline
    outro?: VideoClip;
    logo?: LogoConfig;
    ticker?: TickerConfig;
    frame?: FrameConfig;
    audio?: AudioConfig;
  };
}

// Video Clip
interface VideoClip {
  id: string;                     // Unique ID
  src: string;                    // File path
  duration?: number;              // Seconds
  trim?: {                        // Trim settings
    start: number;
    end: number;
  };
  transition?: {                  // Transition to next clip
    type: TransitionType;
    duration: number;
  };
}

// Ticker Configuration
interface TickerConfig {
  text: string;                   // Scrolling text
  font: string;                   // Font file path
  size?: number;                  // Font size
  color?: string;                 // Text color
  speed?: number;                 // Scroll speed
  direction?: 'rtl' | 'ltr';     // Right-to-left or left-to-right
  position?: 'header' | 'footer' | 'custom';
  y?: number;                     // Y position
  box?: boolean;                  // Background box
  boxColor?: string;
  boxOpacity?: number;
  textOpacity?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
}
```

---

## 🔐 VALIDATION & LIMITS

```
┌─────────────────────────────────────────────┐
│  File Format Support                        │
├─────────────────────────────────────────────┤
│  Video:  mp4, mov, avi, mkv, webm          │
│  Audio:  mp3, wav, aac, m4a, ogg           │
│  Image:  png, jpg, jpeg, gif, webp         │
│  Font:   ttf, otf                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Limits                                     │
├─────────────────────────────────────────────┤
│  Max clips:        50                       │
│  Max duration:     3600s (1 hour)           │
│  Min duration:     1s                       │
│  Max file size:    5GB                      │
│  Min resolution:   480px                    │
│  Max resolution:   7680px (8K)              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Resolution Presets                         │
├─────────────────────────────────────────────┤
│  Landscape (16:9)                           │
│    720p:  1280x720                          │
│    1080p: 1920x1080                         │
│    2K:    2560x1440                         │
│    4K:    3840x2160                         │
│                                             │
│  Portrait (9:16)                            │
│    720p:  720x1280                          │
│    1080p: 1080x1920                         │
│    2K:    1440x2560                         │
│    4K:    2160x3840                         │
│                                             │
│  Square (1:1)                               │
│    720p:  720x720                           │
│    1080p: 1080x1080                         │
│    2K:    1440x1440                         │
│    4K:    2160x2160                         │
└─────────────────────────────────────────────┘
```

---

## 🚀 WORKFLOW DIAGRAM

```
START
  │
  ▼
┌─────────────────┐
│ 1. Create/Load  │
│    Project      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Add Media    │
│   - Video clips │
│   - Logo        │
│   - Audio       │
│   - Font        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Configure    │
│   - Transitions │
│   - Ticker      │
│   - Frame       │
│   - Audio mix   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Preview      │
│   - Play video  │
│   - Adjust      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Export       │
│   - Render MP4  │
│   - Progress    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. Done!        │
│ output_news.mp4 │
└─────────────────┘
```

---

## 🛠️ TECHNOLOGY STACK

```
┌────────────────────────────────────────────┐
│  Frontend                                  │
├────────────────────────────────────────────┤
│  React 18.3.1        - UI framework        │
│  TypeScript 5.6.3    - Type safety         │
│  Vite 5.4.8          - Build tool          │
│  CSS Modules         - Styling             │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Backend (Electron Main)                   │
├────────────────────────────────────────────┤
│  Electron 32.2.0     - Desktop framework   │
│  Node.js             - Runtime             │
│  fluent-ffmpeg 2.1.2 - FFmpeg wrapper      │
│  FFmpeg              - Video processing    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Development                               │
├────────────────────────────────────────────┤
│  Jest                - Testing             │
│  electron-builder    - Packaging           │
│  concurrently        - Dev server          │
│  electron-updater    - Auto-updates        │
└────────────────────────────────────────────┘
```

---

## 📊 PERFORMANCE CONSIDERATIONS

```
┌────────────────────────────────────────────┐
│  Optimization Strategies                   │
├────────────────────────────────────────────┤
│  ✓ Auto-save throttled to 30s intervals    │
│  ✓ Video preview uses HTML5 native player  │
│  ✓ Timeline zoom preserves clip width      │
│  ✓ IPC progress updates every frame        │
│  ✓ Toast notifications auto-dismiss        │
│  ✓ Lazy loading for large projects         │
│  ✓ File validation before processing       │
│  ✓ FFmpeg streaming for large videos       │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  Export Performance                        │
├────────────────────────────────────────────┤
│  Encoding: H.264 (libx264)                 │
│  Audio: AAC @ 192kbps                      │
│  Pixel format: yuv420p (compatibility)     │
│  Multi-pass encoding: No (single pass)     │
│  Hardware accel: Not enabled by default    │
└────────────────────────────────────────────┘
```

---

## 🎓 SUMMARY

**Electron News Studio** là một ứng dụng desktop hoàn chỉnh để tạo video tin tức chuyên nghiệp với các tính năng:

1. **Timeline Editor** - Quản lý video clips với transitions
2. **Logo Overlay** - Thêm logo với vị trí và opacity tùy chỉnh
3. **News Ticker** - Chữ chạy với font, màu, shadow tùy chỉnh
4. **Frame Border** - Khung viền trang trí
5. **Audio Mixing** - Trộn BGM và voice-over với ducking
6. **FFmpeg Export** - Xuất video MP4 chất lượng cao
7. **Modern UI** - React + TypeScript + Dark/Light theme
8. **Keyboard Shortcuts** - Workflow nhanh chóng
9. **Auto-save** - Tự động lưu mỗi 30 giây
10. **Project Templates** - Các template có sẵn

---

**Created by:** Claude Code
**Date:** 2025-11-10
**Version:** 1.0.0
