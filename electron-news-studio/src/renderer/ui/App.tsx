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
  const [p, setP] = useState<Project>(defaultProj);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'settings'>('media');
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
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
    setSelectedClip(newClip.id);
  };

  const removeVideoClip = (id: string) => {
    setP(s => ({ ...s, tracks: { ...s.tracks, video: s.tracks.video.filter(c => c.id !== id) }}));
    if (selectedClip === id) setSelectedClip(null);
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

  const handleDrop = (e: React.DragEvent, type: 'video' | 'intro' | 'outro' | 'logo' | 'font' | 'bgm' | 'voice') => {
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
      case 'intro':
        t.intro = { src: filePath, duration: 3 };
        setP({ ...p });
        break;
      case 'outro':
        t.outro = { src: filePath, duration: 3 };
        setP({ ...p });
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
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE SECTION - Bottom Full Width */}
      <div className="timeline-section">
        <div className="timeline-header">
          <span className="timeline-title">⏱️ Timeline</span>
          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <span style={{fontSize: '12px', opacity: 0.7}}>
              Total: {(t.intro?.duration || 0) + t.video.reduce((acc, c) => acc + (c.duration || 5), 0) + (t.outro?.duration || 0)}s
            </span>
          </div>
        </div>

        <div className="timeline-clips">
          {/* Intro */}
          {t.intro?.src && (
            <div className="clip-item intro-clip">
              <div className="clip-header">
                <span className="clip-number">🎬 Intro</span>
                <div className="clip-actions">
                  <button className="btn-sm btn-danger" onClick={() => { delete t.intro; setP({ ...p }); }}>✕</button>
                </div>
              </div>
              <div className="clip-filename" title={t.intro.src}>📹 {t.intro.src.split('/').pop()}</div>
              <div className="clip-controls" style={{marginTop: '8px'}}>
                <label>Duration (s)</label>
                <input type="number" min="0.1" step="0.1" value={t.intro.duration || 3}
                  onChange={e => { t.intro!.duration = Number(e.target.value); setP({ ...p }); }}
                  style={{width: '100%'}} />
              </div>
            </div>
          )}

          {/* Add Intro Button */}
          {!t.intro?.src && (
            <div className={`add-clip-btn ${dragOver === 'intro' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'intro')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'intro')}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e: any) => {
                  const f = e.target?.files?.[0];
                  if (f) { t.intro = { src: (f as any).path ?? "", duration: 3 }; setP({ ...p }); }
                };
                input.click();
              }}>
              <span style={{fontSize: '24px'}}>+</span>
              <span style={{fontSize: '12px'}}>Intro</span>
            </div>
          )}

          {/* Main Clips */}
          {t.video.map((clip, idx) => (
            <div key={clip.id}
              className={`clip-item ${selectedClip === clip.id ? 'selected' : ''}`}
              onClick={() => setSelectedClip(clip.id)}
              style={selectedClip === clip.id ? {borderColor: '#2463eb', boxShadow: '0 0 0 2px rgba(36,99,235,0.3)'} : {}}>
              <div className="clip-header">
                <span className="clip-number">#{idx + 1}</span>
                <div className="clip-actions">
                  <button className="btn-sm" onClick={(e) => { e.stopPropagation(); moveClip(clip.id, 'up'); }} disabled={idx === 0}>←</button>
                  <button className="btn-sm" onClick={(e) => { e.stopPropagation(); moveClip(clip.id, 'down'); }} disabled={idx === t.video.length - 1}>→</button>
                  <button className="btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); removeVideoClip(clip.id); }}>✕</button>
                </div>
              </div>
              <div className="clip-filename" title={clip.src}>📹 {clip.src.split('/').pop()}</div>
              <div className="clip-controls" style={{marginTop: '8px'}}>
                <label style={{fontSize: '11px', opacity: 0.8}}>
                  {clip.duration || 5}s • {clip.transition?.type || 'fade'} ({clip.transition?.duration || 1}s)
                </label>
              </div>
            </div>
          ))}

          {/* Add Clip Button */}
          <div className={`add-clip-btn ${dragOver === 'video' ? 'drag-over' : ''}`}
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
            <span style={{fontSize: '24px'}}>+</span>
            <span style={{fontSize: '12px'}}>Add Video</span>
          </div>

          {/* Outro */}
          {t.outro?.src && (
            <div className="clip-item outro-clip">
              <div className="clip-header">
                <span className="clip-number">🎬 Outro</span>
                <div className="clip-actions">
                  <button className="btn-sm btn-danger" onClick={() => { delete t.outro; setP({ ...p }); }}>✕</button>
                </div>
              </div>
              <div className="clip-filename" title={t.outro.src}>📹 {t.outro.src.split('/').pop()}</div>
              <div className="clip-controls" style={{marginTop: '8px'}}>
                <label>Duration (s)</label>
                <input type="number" min="0.1" step="0.1" value={t.outro.duration || 3}
                  onChange={e => { t.outro!.duration = Number(e.target.value); setP({ ...p }); }}
                  style={{width: '100%'}} />
              </div>
            </div>
          )}

          {/* Add Outro Button */}
          {!t.outro?.src && (
            <div className={`add-clip-btn ${dragOver === 'outro' ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, 'outro')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'outro')}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e: any) => {
                  const f = e.target?.files?.[0];
                  if (f) { t.outro = { src: (f as any).path ?? "", duration: 3 }; setP({ ...p }); }
                };
                input.click();
              }}>
              <span style={{fontSize: '24px'}}>+</span>
              <span style={{fontSize: '12px'}}>Outro</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
