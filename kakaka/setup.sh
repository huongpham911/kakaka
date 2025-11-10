#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="electron-news-studio"
echo "🔧 Creating project: $APP_DIR"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# -----------------------------
# package.json
# -----------------------------
cat > package.json << 'JSON'
{
  "name": "electron-news-studio",
  "version": "1.0.0",
  "private": true,
  "description": "Electron + React timeline studio: logo overlay, music/voice, frame, news ticker, FFmpeg export.",
  "main": "dist/main/main.js",
  "type": "module",
  "scripts": {
    "dev": "concurrently -k -n VITE,ELECTRON \"vite\" \"cross-env VITE_DEV_SERVER=true electron .\"",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "build": "npm run build:renderer && npm run build:main",
    "dist": "npm run build && electron-builder",
    "start": "electron ."
  },
  "build": {
    "appId": "com.example.electronnewsstudio",
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraResources": [],
    "mac": { "target": ["dmg","zip"] },
    "win": { "target": ["nsis"] },
    "linux": { "target": ["AppImage","deb","rpm"] }
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-timeline-editor": "^1.8.0",
    "fluent-ffmpeg": "^2.1.2",
    "ffmpeg-static": "^5.2.0",
    "electron-updater": "^6.3.9"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "concurrently": "^9.0.1",
    "cross-env": "^7.0.3",
    "electron": "^32.2.0",
    "electron-builder": "^25.1.8",
    "typescript": "^5.6.3",
    "vite": "^5.4.8",
    "@vitejs/plugin-react": "^4.3.2"
  }
}
JSON

# -----------------------------
# tsconfig (renderer)
# -----------------------------
cat > tsconfig.json << 'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/renderer", "src/shared"]
}
JSON

# -----------------------------
# tsconfig (main)
# -----------------------------
cat > tsconfig.main.json << 'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "outDir": "dist/main",
    "module": "ESNext",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "strict": true,
    "types": ["node"],
    "rootDir": "src/main"
  },
  "include": ["src/main/**/*"]
}
JSON

# -----------------------------
# vite config
# -----------------------------
cat > vite.config.ts << 'TS'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  base: "",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  },
  server: { port: 5173 }
});
TS

# -----------------------------
# gitignore
# -----------------------------
cat > .gitignore << 'GIT'
node_modules
dist
out
.DS_Store
*.log
GIT

# -----------------------------
# Shared types
# -----------------------------
mkdir -p src/shared
cat > src/shared/types.ts << 'TS'
export type TrackItem = {
  id: string;
  src?: string;
  start?: number;
  duration?: number;
  in?: number;
  out?: number;
};

export type Project = {
  fps: number;
  width: number;
  height: number;
  duration: number;
  tracks: {
    video: TrackItem[];
    logo?: { src: string; start?: number; end?: number; pos?: string; opacity?: number; scale?: number };
    ticker?: { text: string; font: string; size?: number; color?: string; y?: number; speed?: number; box?: boolean };
    frame?: { enable?: boolean; thickness?: number; color?: string };
    audio?: {
      bgm?: { src: string; gain?: number };
      voice?: { src: string; gain?: number; duck_bgm?: boolean };
    };
  };
};
TS

# -----------------------------
# Electron main
# -----------------------------
mkdir -p src/main
cat > src/main/main.ts << 'TS'
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { createExporter } from "./render/exporter.js";

const isDev = !!process.env.VITE_DEV_SERVER;

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist", "main", "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const devURL = "http://localhost:5173";
  const prodURL = path.join(app.getAppPath(), "dist", "renderer", "index.html");
  if (isDev) {
    await win.loadURL(devURL);
    win.webContents.openDevTools();
  } else {
    await win.loadFile(prodURL);
  }

  const exporter = createExporter();
  ipcMain.handle("export", (_e, project) => exporter.exportProject(project));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
TS

# -----------------------------
# Preload (expose IPC)
# -----------------------------
cat > src/main/preload.cjs << 'CJS'
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  export: (project) => ipcRenderer.invoke("export", project)
});
CJS

# -----------------------------
# Exporter (FFmpeg pipeline)
# -----------------------------
mkdir -p src/main/render
cat > src/main/render/exporter.ts << 'TS'
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "node:path";

type Pos = { x: string, y: string };
function posExpr(pos: string): Pos {
  switch (pos) {
    case "top-left":     return { x: "20",       y: "20" };
    case "top-right":    return { x: "W-w-20",   y: "20" };
    case "bottom-left":  return { x: "20",       y: "H-h-20" };
    case "bottom-right": return { x: "W-w-20",   y: "H-h-20" };
    case "center":       return { x: "(W-w)/2",  y: "(H-h)/2" };
    default:             return { x: "W-w-20",   y: "20" };
  }
}

export function createExporter() {
  function asVolDb(db: number) {
    return Math.pow(10, db / 20).toFixed(3);
  }

  async function exportProject(project: any): Promise<string> {
    const { width, height, fps, duration, tracks } = project;
    const mainV = tracks.video?.[0]?.src;
    if (!mainV) throw new Error("No main video track");

    const out = path.resolve(process.cwd(), "output_news.mp4");
    ffmpeg.setFfmpegPath(ffmpegPath as string);
    const cmd = ffmpeg().input(mainV);
    let idx = 1;
    let logoIdx = -1, bgmIdx = -1, voiceIdx = -1;

    if (tracks.logo?.src)  { cmd.input(tracks.logo.src);  logoIdx  = idx++; }
    if (tracks.audio?.bgm?.src)   { cmd.input(tracks.audio.bgm.src);   bgmIdx   = idx++; }
    if (tracks.audio?.voice?.src) { cmd.input(tracks.audio.voice.src); voiceIdx = idx++; }

    // Video chain
    const vf: string[] = [];
    vf.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1,format=yuv420p[base]`);

    if (logoIdx >= 0) {
      const pos = posExpr(tracks.logo.pos || "top-right");
      const op  = tracks.logo.opacity ?? 0.9;
      const lsc = tracks.logo.scale ?? 220;
      vf.push(
        `[${logoIdx}:v]scale=${lsc}:-1,format=rgba,colorchannelmixer=aa=${op}[lg]`,
        `[base][lg]overlay=${pos.x}:${pos.y}:enable='between(t,${tracks.logo.start ?? 0},${tracks.logo.end ?? duration})'[v1]`
      );
    } else {
      vf.push(`[base]copy[v1]`);
    }

    if (tracks.frame?.enable) {
      const t = tracks.frame.thickness ?? 12;
      const c = tracks.frame.color ?? "white@0.85";
      vf.push(
        `[v1]drawbox=x=0:y=0:w=iw:h=${t}:t=fill:color=${c}[v2];` +
        `[v2]drawbox=x=0:y=ih-${t}:w=iw:h=${t}:t=fill:color=${c}[v3];` +
        `[v3]drawbox=x=0:y=0:w=${t}:h=ih:t=fill:color=${c}[v4];` +
        `[v4]drawbox=x=iw-${t}:y=0:w=${t}:h=ih:t=fill:color=${c}[v5]`
      );
    } else {
      vf.push(`[v1]copy[v5]`);
    }

    if (tracks.ticker?.text && tracks.ticker?.font) {
      const ty   = tracks.ticker.y ?? (height - 80);
      const spd  = tracks.ticker.speed ?? 250;
      const size = tracks.ticker.size ?? 48;
      const col  = tracks.ticker.color ?? "white";
      const box  = tracks.ticker.box ? `:box=1:boxcolor=black@0.55:boxborderw=20` : ``;
      const textEsc = String(tracks.ticker.text).replace(/:/g, "\\:").replace(/'/g, "\\\\'");
      vf.push(
        `[v5]drawtext=fontfile='${tracks.ticker.font}':text='${textEsc}':fontsize=${size}:fontcolor=${col}` +
        `:x=w-mod(t*${spd}\\,tw+w):y=${ty}${box}[vout]`
      );
    } else {
      vf.push(`[v5]copy[vout]`);
    }

    // Audio chain
    const af: string[] = [];
    const aIns: string[] = [];
    if (voiceIdx >= 0) aIns.push(`${voiceIdx}:a`);
    if (bgmIdx  >= 0) aIns.push(`${bgmIdx}:a`);

    if (aIns.length === 0) {
      // no audio
    } else if (aIns.length === 1) {
      const isVoice = voiceIdx >= 0;
      const gain = isVoice ? (tracks.audio.voice.gain ?? 0) : (tracks.audio.bgm.gain ?? -6);
      af.push(`[${aIns[0]}]volume=${asVolDb(gain)}[aout]`);
    } else {
      const duck = !!tracks.audio.voice?.duck_bgm;
      const vGain = tracks.audio.voice?.gain ?? 0;
      const bGain = tracks.audio.bgm?.gain ?? -6;
      if (duck && voiceIdx >= 0 && bgmIdx >= 0) {
        af.push(
          `[${bgmIdx}:a]volume=${asVolDb(bGain)}[bgm];` +
          `[${voiceIdx}:a]volume=${asVolDb(vGain)}[vo];` +
          `[bgm][vo]sidechaincompress=threshold=0.03:ratio=10:attack=5:release=200:makeup=4[aout]`
        );
      } else {
        af.push(
          `[${bgmIdx}:a]volume=${asVolDb(bGain)}[bgm];` +
          `[${voiceIdx}:a]volume=${asVolDb(vGain)}[vo];` +
          `[bgm][vo]amix=inputs=2:dropout_transition=0:duration=longest,volume=1.0[aout]`
        );
      }
    }

    const filter = vf.concat(af).join(";");

    return await new Promise<string>((resolve, reject) => {
      const pipeline = ffmpeg()
        .input(mainV)
        .outputOptions(["-pix_fmt yuv420p", `-t ${duration}`])
        .videoCodec("libx264")
        .fps(fps);

      // re-add external inputs (logo/audio) again for final chain
      if (logoIdx >= 0) pipeline.input(tracks.logo.src);
      if (bgmIdx  >= 0) pipeline.input(tracks.audio.bgm.src);
      if (voiceIdx >= 0) pipeline.input(tracks.audio.voice.src);

      pipeline
        .complexFilter(filter)
        .map("[vout]");

      if (af.length) pipeline.map("[aout]").audioCodec("aac").audioBitrate("192k");

      pipeline
        .save(out)
        .on("end", () => resolve(out))
        .on("error", reject);
    });
  }

  return { exportProject };
}
TS

# -----------------------------
# Renderer: HTML
# -----------------------------
mkdir -p src/renderer
cat > src/renderer/index.html << 'HTML'
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>News Studio</title>
    <style>
      body { margin:0; font-family: system-ui, sans-serif; background:#0b0f14; color:#e9eef5; }
      header { padding:12px 16px; background:#10171f; border-bottom:1px solid #1b2632; display:flex; align-items:center; gap:12px; }
      .grid { display:grid; grid-template-columns: 360px 1fr; height: calc(100vh - 54px); }
      .panel { padding:14px; overflow:auto; border-right:1px solid #1b2632; }
      .content { padding:14px; overflow:auto; }
      label { font-size:12px; opacity:.85; }
      input, select, button, textarea { width:100%; margin:6px 0 12px; padding:8px; border-radius:8px; border:1px solid #263545; background:#0f141a; color:#e9eef5; }
      button { background:#2463eb; border:none; cursor:pointer; }
      button:hover { filter:brightness(1.1); }
      .row { display:flex; gap:8px; }
      .row > * { flex:1; }
      .hint { font-size:12px; opacity:.7; margin-bottom:12px; }
      .box { padding:10px; border:1px dashed #2b3b4d; border-radius:10px; margin-bottom:12px;}
    </style>
  </head>
  <body>
    <header><strong>🗞️ News Studio</strong><span class="hint">Logo + Frame + Ticker + BGM/Voice → Export MP4</span></header>
    <div id="root" class="grid"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
HTML

# -----------------------------
# Renderer: main.tsx
# -----------------------------
cat > src/renderer/main.tsx << 'TSX'
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";

createRoot(document.getElementById("root")!).render(<App />);
TSX

# -----------------------------
# Renderer: App.tsx
# -----------------------------
mkdir -p src/renderer/ui
cat > src/renderer/ui/App.tsx << 'TSX'
import React, { useMemo, useState } from "react";
import type { Project } from "../../shared/types";

declare global {
  interface Window { electronAPI?: { export: (p: Project) => Promise<string> } }
}

const defaultProj: Project = {
  fps: 24,
  width: 1920,
  height: 1080,
  duration: 15,
  tracks: {
    video: [],
    logo: { src: "", pos: "top-right", opacity: 0.9, scale: 220, start: 0 },
    ticker: { text: "TIN NÓNG: Chữ chạy demo | ", font: "", size: 48, color: "white", y: 1000, speed: 250, box: true },
    frame: { enable: true, thickness: 12, color: "white@0.85" },
    audio: { bgm: { src: "", gain: -6 }, voice: { src: "", gain: 0, duck_bgm: true } }
  }
};

export default function App() {
  const [p, setP] = useState<Project>(defaultProj);
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP(old => ({ ...old, [k]: v }));
  const t = p.tracks;

  const disabled = useMemo(() => !t.video[0]?.src || !p.duration, [p]);

  async function onExport() {
    if (!window.electronAPI) { alert("No electronAPI. Run via Electron."); return; }
    try {
      const out = await window.electronAPI.export(p);
      alert("✅ Exported: " + out);
    } catch (e: any) {
      console.error(e); alert("Export error: " + e?.message);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="box">
          <label>Main Video</label>
          <input type="file" accept="video/*" onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            setP(s => ({ ...s, tracks: { ...s.tracks, video: [{ id: "v1", src: (f as any).path ?? "", start:0 }] }}));
          }} />
          <div className="row">
            <div>
              <label>Duration (s)</label>
              <input type="number" value={p.duration} onChange={e => set("duration", Number(e.target.value||15))} />
            </div>
            <div>
              <label>FPS</label>
              <input type="number" value={p.fps} onChange={e => set("fps", Number(e.target.value||24))} />
            </div>
          </div>
        </div>

        <div className="box">
          <strong>Logo</strong>
          <input type="file" accept="image/*" onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            t.logo!.src = (f as any).path ?? "";
            setP({ ...p });
          }} />
          <div className="row">
            <div>
              <label>Position</label>
              <select value={t.logo?.pos} onChange={e => { t.logo!.pos = e.target.value; setP({ ...p }); }}>
                <option>top-left</option><option>top-right</option><option>bottom-left</option><option>bottom-right</option><option>center</option>
              </select>
            </div>
            <div>
              <label>Opacity</label>
              <input type="number" min="0" max="1" step="0.05" value={t.logo?.opacity ?? 0.9}
                onChange={e => { t.logo!.opacity = Number(e.target.value); setP({ ...p }); }} />
            </div>
            <div>
              <label>Scale(px)</label>
              <input type="number" value={t.logo?.scale ?? 220}
                onChange={e => { t.logo!.scale = Number(e.target.value||220); setP({ ...p }); }} />
            </div>
          </div>
        </div>

        <div className="box">
          <strong>Ticker</strong>
          <textarea rows={3} value={t.ticker?.text ?? ""} onChange={e => { t.ticker!.text = e.target.value; setP({ ...p }); }} />
          <label>Font file (TTF/OTF)</label>
          <input type="file" accept=".ttf,.otf" onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            t.ticker!.font = (f as any).path ?? "";
            setP({ ...p });
          }} />
          <div className="row">
            <div><label>Size</label><input type="number" value={t.ticker?.size ?? 48} onChange={e => { t.ticker!.size = Number(e.target.value||48); setP({ ...p }); }} /></div>
            <div><label>Y</label><input type="number" value={t.ticker?.y ?? 1000} onChange={e => { t.ticker!.y = Number(e.target.value||1000); setP({ ...p }); }} /></div>
            <div><label>Speed</label><input type="number" value={t.ticker?.speed ?? 250} onChange={e => { t.ticker!.speed = Number(e.target.value||250); setP({ ...p }); }} /></div>
          </div>
          <div className="row">
            <div><label>Color</label><input value={t.ticker?.color ?? "white"} onChange={e => { t.ticker!.color = e.target.value; setP({ ...p }); }} /></div>
            <div><label>Box BG</label><select value={t.ticker?.box ? "1":"0"} onChange={e => { t.ticker!.box = e.target.value==="1"; setP({ ...p }); }}><option value="1">On</option><option value="0">Off</option></select></div>
          </div>
        </div>

        <div className="box">
          <strong>Frame</strong>
          <div className="row">
            <div><label>Enable</label><select value={t.frame?.enable ? "1":"0"} onChange={e => { t.frame!.enable = e.target.value==="1"; setP({ ...p }); }}><option value="1">On</option><option value="0">Off</option></select></div>
            <div><label>Thickness</label><input type="number" value={t.frame?.thickness ?? 12} onChange={e => { t.frame!.thickness = Number(e.target.value||12); setP({ ...p }); }} /></div>
            <div><label>Color</label><input value={t.frame?.color ?? "white@0.85"} onChange={e => { t.frame!.color = e.target.value; setP({ ...p }); }} /></div>
          </div>
        </div>

        <div className="box">
          <strong>Audio</strong>
          <label>Background Music</label>
          <input type="file" accept="audio/*" onChange={e => { const f=e.target.files?.[0]; if(!f) return; t.audio!.bgm!.src=(f as any).path??""; setP({ ...p }); }} />
          <label>Gain BGM (dB)</label>
          <input type="number" value={t.audio?.bgm?.gain ?? -6} onChange={e => { t.audio!.bgm!.gain = Number(e.target.value||-6); setP({ ...p }); }} />
          <label>Voice</label>
          <input type="file" accept="audio/*" onChange={e => { const f=e.target.files?.[0]; if(!f) return; t.audio!.voice!.src=(f as any).path??""; setP({ ...p }); }} />
          <div className="row">
            <div><label>Gain Voice (dB)</label><input type="number" value={t.audio?.voice?.gain ?? 0} onChange={e => { t.audio!.voice!.gain = Number(e.target.value||0); setP({ ...p }); }} /></div>
            <div><label>Duck BGM</label><select value={t.audio?.voice?.duck_bgm ? "1":"0"} onChange={e => { t.audio!.voice!.duck_bgm = e.target.value==="1"; setP({ ...p }); }}><option value="1">On</option><option value="0">Off</option></select></div>
          </div>
        </div>

        <button onClick={onExport} disabled={disabled}>Export MP4</button>
        <div className="hint">Yêu cầu FFmpeg (đã tích hợp ffmpeg-static). Nếu export lỗi, kiểm tra đường dẫn file & quyền đọc.</div>
      </div>

      <div className="content">
        <h3>Preview (static)</h3>
        <div style={{aspectRatio: '16/9', width: '100%', background:'#141a22', border:'1px solid #1f2a36', borderRadius:12, display:'grid', placeItems:'center', color:'#7ea1d6'}}>
          Preview placeholder — mở video bằng player ngoài. Ticker/Logo/Frame hiển thị đúng ở file xuất.
        </div>
        <p className="hint">Gợi ý: kéo thả file vào panel trái để cấu hình nhanh.</p>
      </div>
    </>
  );
}
TSX

echo "📦 Installing dependencies (this may take a while)..."
npm i

echo "✅ Done.

Dev:
  npm run dev

Build app:
  npm run dist

Export video:
  - Mở app (npm run dev)
  - Chọn Video/Logo/Font/BGM/Voice
  - Bấm Export MP4 → output_news.mp4
"
