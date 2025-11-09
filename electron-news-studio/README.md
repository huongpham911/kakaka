# Electron News Studio

Electron + React application for creating professional news-style videos with:
- Logo overlay (customizable position, opacity, scale)
- Decorative frame border
- Scrolling news ticker
- Background music with voice-over (with ducking support)
- FFmpeg-powered export to MP4

## Features

- **Video Processing**: Import main video and apply multiple effects
- **Logo Overlay**: Position logo anywhere (top-left, top-right, bottom-left, bottom-right, center)
- **News Ticker**: Scrolling text with custom font, size, color, and speed
- **Frame Border**: Optional decorative border around video
- **Audio Mixing**:
  - Background music with gain control
  - Voice-over with automatic music ducking
  - Independent gain controls for both tracks
- **Export**: Professional MP4 output with all effects applied

## Prerequisites

Before installation, ensure you have:

1. **Node.js** (v18 or higher)
2. **FFmpeg** installed on your system:
   - **Linux**: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (CentOS/RHEL)
   - **macOS**: `brew install ffmpeg`
   - **Windows**: Download from https://ffmpeg.org/download.html

## Installation

```bash
cd electron-news-studio
npm install
```

**Note**: If you encounter network issues during installation, you may need to:
- Configure npm proxy: `npm config set proxy http://your-proxy:port`
- Or use a different network connection
- Electron and some packages download binaries from GitHub during installation

## Development

Start the development server:

```bash
npm run dev
```

This will:
1. Start Vite dev server for the React UI (port 5173)
2. Launch Electron with hot-reload enabled

## Building

Build the application:

```bash
# Build renderer and main process
npm run build

# Create distributable packages
npm run dist
```

Distributables will be created in the `dist` directory.

## Usage

1. **Select Main Video**: Choose your primary video file
2. **Configure Settings**:
   - Set duration and FPS
   - Upload logo (PNG/JPG)
   - Choose ticker font (TTF/OTF)
   - Add background music and/or voice-over
3. **Customize Effects**:
   - Adjust logo position, opacity, and scale
   - Configure ticker text, speed, and appearance
   - Enable/disable frame border
   - Control audio levels and ducking
4. **Export**: Click "Export MP4" to generate the final video

Output will be saved as `output_news.mp4` in the current directory.

## Project Structure

```
electron-news-studio/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Main window and IPC
│   │   ├── preload.cjs    # Preload script
│   │   └── render/
│   │       └── exporter.ts # FFmpeg export logic
│   ├── renderer/          # React frontend
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── ui/
│   │       └── App.tsx    # Main UI component
│   └── shared/
│       └── types.ts       # Shared TypeScript types
├── package.json
├── tsconfig.json          # TypeScript config (renderer)
├── tsconfig.main.json     # TypeScript config (main)
└── vite.config.ts         # Vite config
```

## Technical Details

### FFmpeg Pipeline

The application uses fluent-ffmpeg to construct a complex filter graph:

1. **Video Processing**:
   - Scale to target resolution
   - Overlay logo with transparency
   - Apply frame border (4 drawbox filters)
   - Add scrolling ticker text

2. **Audio Processing**:
   - Volume adjustment (dB to linear conversion)
   - Sidechain compression for voice ducking
   - Mix background music and voice

### Dependencies

- **react** & **react-dom**: UI framework
- **fluent-ffmpeg**: FFmpeg wrapper for Node.js
- **electron**: Desktop application framework
- **vite**: Fast frontend build tool
- **typescript**: Type safety

## Troubleshooting

### "No electronAPI" error
- Ensure you're running via Electron (`npm run dev`), not a web browser

### Export fails
- Verify FFmpeg is installed: `ffmpeg -version`
- Check file paths are accessible
- Ensure sufficient disk space

### Font not rendering in ticker
- Use absolute paths to font files
- Verify font file format (TTF/OTF)

### Audio ducking not working
- Ensure both BGM and Voice tracks are loaded
- Enable "Duck BGM" option
- Adjust threshold in `exporter.ts` if needed

## License

MIT

## Notes

- This application requires system FFmpeg installation
- File paths should be absolute for best compatibility
- Large videos may take time to export
- Preview is static - use external player to verify output
