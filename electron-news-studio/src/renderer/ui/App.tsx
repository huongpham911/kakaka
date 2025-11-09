import React, { useMemo, useState } from "react";
import type { Project, VideoClip, TransitionType } from "../../shared/types";

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
  const [dragOver, setDragOver] = useState<string | null>(null);
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP(old => ({ ...old, [k]: v }));
  const t = p.tracks;

  const disabled = useMemo(() => t.video.length === 0 || !p.duration, [p]);

  // Video clip management
  const addVideoClip = (filePath: string) => {
    const newClip: VideoClip = {
      id: `clip-${Date.now()}`,
      src: filePath,
      duration: 5,
      transition: { type: 'fade', duration: 1 }
    };
    setP(s => ({ ...s, tracks: { ...s.tracks, video: [...s.tracks.video, newClip] }}));
  };

  const removeVideoClip = (id: string) => {
    setP(s => ({ ...s, tracks: { ...s.tracks, video: s.tracks.video.filter(c => c.id !== id) }}));
  };

  const updateVideoClip = (id: string, updates: Partial<VideoClip>) => {
    setP(s => ({
      ...s,
      tracks: {
        ...s.tracks,
        video: s.tracks.video.map(c => c.id === id ? { ...c, ...updates } : c)
      }
    }));
  };

  const moveClip = (id: string, direction: 'up' | 'down') => {
    const idx = t.video.findIndex(c => c.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === t.video.length - 1)) return;
    const newVideos = [...t.video];
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newVideos[idx], newVideos[newIdx]] = [newVideos[newIdx], newVideos[idx]];
    setP(s => ({ ...s, tracks: { ...s.tracks, video: newVideos }}));
  };

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

  const handleDrop = (e: React.DragEvent, type: 'video' | 'logo' | 'font' | 'bgm' | 'voice') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const filePath = (file as any).path ?? file.name;

    switch (type) {
      case 'video':
        addVideoClip(filePath);
        break;
      case 'logo':
        t.logo!.src = filePath;
        setP({ ...p });
        break;
      case 'font':
        t.ticker!.font = filePath;
        setP({ ...p });
        break;
      case 'bgm':
        t.audio!.bgm!.src = filePath;
        setP({ ...p });
        break;
      case 'voice':
        t.audio!.voice!.src = filePath;
        setP({ ...p });
        break;
    }
  };

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
          <strong>Timeline - Video Clips</strong>
          <div
            className={`dropzone ${dragOver === 'video' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'video')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'video')}
          >
            <input type="file" accept="video/*" multiple onChange={e => {
              const files = e.target.files;
              if (!files) return;
              Array.from(files).forEach(f => addVideoClip((f as any).path ?? ""));
            }} />
            <div className="drop-hint">Kéo thả video vào đây hoặc chọn nhiều file</div>
          </div>

          {/* Timeline clips list */}
          <div className="timeline-clips">
            {t.video.map((clip, idx) => (
              <div key={clip.id} className="clip-item">
                <div className="clip-header">
                  <span className="clip-number">#{idx + 1}</span>
                  <span className="clip-filename">📹 {clip.src.split('/').pop()}</span>
                  <div className="clip-actions">
                    <button className="btn-sm" onClick={() => moveClip(clip.id, 'up')} disabled={idx === 0}>↑</button>
                    <button className="btn-sm" onClick={() => moveClip(clip.id, 'down')} disabled={idx === t.video.length - 1}>↓</button>
                    <button className="btn-sm btn-danger" onClick={() => removeVideoClip(clip.id)}>✕</button>
                  </div>
                </div>
                <div className="clip-controls">
                  <div className="clip-row">
                    <div>
                      <label>Duration (s)</label>
                      <input type="number" min="0.1" step="0.1" value={clip.duration || 5}
                        onChange={e => updateVideoClip(clip.id, { duration: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label>Transition</label>
                      <select value={clip.transition?.type || 'fade'}
                        onChange={e => updateVideoClip(clip.id, {
                          transition: { ...clip.transition, type: e.target.value as TransitionType, duration: clip.transition?.duration || 1 }
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
                    </div>
                    <div>
                      <label>Trans. Duration (s)</label>
                      <input type="number" min="0.1" max="3" step="0.1" value={clip.transition?.duration || 1}
                        onChange={e => updateVideoClip(clip.id, {
                          transition: { ...clip.transition, type: clip.transition?.type || 'fade', duration: Number(e.target.value) }
                        })} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div>
              <label>Project FPS</label>
              <input type="number" value={p.fps} onChange={e => set("fps", Number(e.target.value||24))} />
            </div>
            <div>
              <label>Output Duration (s)</label>
              <input type="number" value={p.duration} onChange={e => set("duration", Number(e.target.value||15))} />
            </div>
          </div>
        </div>

        <div className="box">
          <strong>Logo</strong>
          <div
            className={`dropzone ${dragOver === 'logo' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'logo')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'logo')}
          >
            <input type="file" accept="image/*" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              t.logo!.src = (f as any).path ?? "";
              setP({ ...p });
            }} />
            {t.logo?.src && <div className="file-name">🖼️ {t.logo.src.split('/').pop()}</div>}
            <div className="drop-hint">Kéo thả logo vào đây</div>
          </div>
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
          <div
            className={`dropzone ${dragOver === 'font' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'font')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'font')}
          >
            <input type="file" accept=".ttf,.otf" onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              t.ticker!.font = (f as any).path ?? "";
              setP({ ...p });
            }} />
            {t.ticker?.font && <div className="file-name">🔤 {t.ticker.font.split('/').pop()}</div>}
            <div className="drop-hint">Kéo thả font vào đây</div>
          </div>
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
          <div
            className={`dropzone ${dragOver === 'bgm' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'bgm')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'bgm')}
          >
            <input type="file" accept="audio/*" onChange={e => { const f=e.target.files?.[0]; if(!f) return; t.audio!.bgm!.src=(f as any).path??""; setP({ ...p }); }} />
            {t.audio?.bgm?.src && <div className="file-name">🎵 {t.audio.bgm.src.split('/').pop()}</div>}
            <div className="drop-hint">Kéo thả BGM vào đây</div>
          </div>
          <label>Gain BGM (dB)</label>
          <input type="number" value={t.audio?.bgm?.gain ?? -6} onChange={e => { t.audio!.bgm!.gain = Number(e.target.value||-6); setP({ ...p }); }} />
          <label>Voice</label>
          <div
            className={`dropzone ${dragOver === 'voice' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'voice')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'voice')}
          >
            <input type="file" accept="audio/*" onChange={e => { const f=e.target.files?.[0]; if(!f) return; t.audio!.voice!.src=(f as any).path??""; setP({ ...p }); }} />
            {t.audio?.voice?.src && <div className="file-name">🎤 {t.audio.voice.src.split('/').pop()}</div>}
            <div className="drop-hint">Kéo thả voice vào đây</div>
          </div>
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
