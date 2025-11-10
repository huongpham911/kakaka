# 🗞️ Electron News Studio

Professional video editing tool for creating news videos with logo overlays, tickers, transitions, and more. Built with Electron, React 18, and TypeScript.

## ✨ Features

### Video Editing
- **Multi-clip Timeline** - Add unlimited video clips (up to 50)
- **Intro/Outro Support** - Add intro and outro videos
- **13 Transition Types** - fade, wipeleft, wiperight, slideup, dissolve, and more
- **Drag to Reorder** - Drag and drop clips to reorder them
- **5-Layer Track System** - Text, Frame, Logo, Audio, Video layers

### Visual Effects
- **Logo Overlay** - Add watermarks with 5 position presets
- **Frame Border** - Customizable border thickness and color
- **News Ticker** - Scrolling text with full customization
  - RTL/LTR direction
  - Speed, size, color, position
  - Shadow and background options

### Audio
- **Background Music** - Add BGM with gain control
- **Voice-Over** - Add narration with ducking
- **Audio Ducking** - Auto-lower BGM when voice plays

### Project Management
- **Save/Load Projects** - .nsproj file format
- **Auto-Save** - Every 30 seconds to localStorage
- **Undo/Redo** - Full history management (Ctrl+Z / Ctrl+Y)
- **Export Progress** - Real-time progress bar with percentage

### User Experience
- **Keyboard Shortcuts** - Ctrl+S, Ctrl+E, Ctrl+Z, Ctrl+Y, Delete
- **Toast Notifications** - Beautiful toast messages (success, error, warning, info)
- **Modal Dialogs** - Professional confirm/input modals
- **Timeline Zoom** - 50% to 200% zoom levels
- **Playhead Indicator** - Visual playback position
- **Tooltips** - Helpful hints on all controls
- **Validation** - File format, size, and project validation
- **Error Handling** - Comprehensive error messages

## 📋 Requirements

- Node.js 18+
- FFmpeg (installed separately)
- 4GB+ RAM recommended

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd electron-news-studio

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package the app
npm run dist
```

### First Steps

1. **Add Videos**: Drag & drop video files or click "+ Add Video"
2. **Configure Settings**: Add logo, ticker, BGM, etc.
3. **Arrange Timeline**: Drag clips to reorder
4. **Set Output**: Choose aspect ratio (16:9, 9:16, 1:1) and resolution
5. **Export**: Click "Render" (Ctrl+E)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save Project |
| `Ctrl+O` / `Cmd+O` | Open Project |
| `Ctrl+E` / `Cmd+E` | Export/Render |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Y` | Redo |
| `Ctrl+1` / `Cmd+1` | Media Tab |
| `Ctrl+2` / `Cmd+2` | Settings Tab |
| `Delete` / `Backspace` | Remove Selected Clip |

## 🎨 Aspect Ratios & Resolutions

### Aspect Ratios
- **Landscape (16:9)** - Standard widescreen
- **Portrait (9:16)** - Mobile/vertical video
- **Square (1:1)** - Social media posts

### Resolutions
- **720p** - 1280x720 (landscape) / 720x1280 (portrait)
- **1080p** - 1920x1080 (Full HD)
- **2K** - 2560x1440
- **4K** - 3840x2160 (Ultra HD)

## 📂 Supported Formats

### Video
`.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`, `.flv`

### Audio
`.mp3`, `.wav`, `.aac`, `.m4a`, `.ogg`, `.flac`

### Images (Logo)
`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

### Fonts (Ticker)
`.ttf`, `.otf`, `.woff`, `.woff2`

## 🛡️ Validation Rules

- **Max Clips**: 50
- **Duration**: 1 second to 1 hour
- **Resolution**: 480px to 7680px
- **FPS**: 1 to 120
- **File Size**: 5GB max
- **Ticker Text**: 500 characters max

## 🎬 Timeline Layers

From top to bottom:

1. **Text / Ticker (Layer 5)** - Scrolling news ticker
2. **Frame (Layer 4)** - Border decoration
3. **Logo (Layer 3)** - Watermark overlay
4. **Audio (Layer 2)** - BGM + Voice-over
5. **Video (Layer 1)** - Main video clips

## 🔧 Project Structure

```
electron-news-studio/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # App entry, IPC handlers
│   │   ├── preload.cjs    # Context bridge
│   │   └── render/
│   │       └── exporter.ts # FFmpeg export logic
│   ├── renderer/          # React UI
│   │   ├── index.html     # HTML + CSS
│   │   ├── main.tsx       # React entry
│   │   ├── ui/
│   │   │   ├── App.tsx    # Main component
│   │   │   ├── Toast.tsx  # Toast notifications
│   │   │   ├── Modal.tsx  # Modal dialogs
│   │   │   └── ClipEditor.tsx # Clip editor
│   │   └── hooks/
│   │       └── useHistory.ts # Undo/Redo hook
│   └── shared/
│       ├── types.ts       # TypeScript types
│       ├── constants.ts   # App constants
│       └── validation.ts  # Validation utilities
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🎯 Key Technologies

- **Electron** - Desktop app framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **FFmpeg** - Video processing
- **fluent-ffmpeg** - FFmpeg Node.js wrapper

## 💡 Tips & Tricks

1. **Use Auto-Save**: Don't worry about losing work - auto-saves every 30s
2. **Drag to Reorder**: Click and drag clips in the timeline
3. **Zoom Timeline**: Use 🔍+ and 🔍- buttons to zoom in/out
4. **Quick Export**: Press Ctrl+E to export quickly
5. **Undo Mistakes**: Ctrl+Z works for all changes
6. **Validation**: App validates files before adding - check toasts for errors

## 🐛 Troubleshooting

### Export Fails
- Check FFmpeg is installed
- Ensure all video files exist
- Check file formats are supported
- Verify project validation passes

### Performance Issues
- Reduce clip count
- Lower resolution
- Close other applications
- Restart the app

### File Not Found
- Use absolute paths
- Check file permissions
- Ensure files weren't moved/deleted

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Credits

- Built with ❤️ using Electron + React
- Powered by FFmpeg for video processing
- Icons from Unicode emoji

---

**Version**: 1.0.0
**Last Updated**: 2025-01-09
