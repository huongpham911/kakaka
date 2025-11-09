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

  return (
    <>
      <div className="panel">
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
            {/* VIDEO SECTION */}
            <div className="section">
              <h3 className="section-title">📹 Video</h3>

              {/* Intro Video */}
              <div className="subsection">
                <label>Intro (Video mở đầu)</label>
                <div className={`dropzone ${dragOver === 'intro' ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, 'intro')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'intro')}>
                  <input type="file" accept="video/*" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    t.intro = { src: (f as any).path ?? "", duration: 3 };
                    setP({ ...p });
                  }} />
                  {t.intro?.src && <div className="file-name">📹 {t.intro.src.split('/').pop()}</div>}
                  <div className="drop-hint">Kéo thả intro video</div>
                </div>
                {t.intro?.src && (
                  <div className="row">
                    <div><label>Duration (s)</label><input type="number" min="0.1" step="0.1" value={t.intro?.duration || 3} onChange={e => { t.intro!.duration = Number(e.target.value); setP({ ...p }); }} /></div>
                    <div style={{display: 'flex', alignItems: 'flex-end'}}><button className="btn-sm btn-danger" onClick={() => { delete t.intro; setP({ ...p }); }}>Xóa Intro</button></div>
                  </div>
                )}
              </div>

              {/* Main Timeline */}
              <div className="subsection">
                <label>Main Timeline (Video chính)</label>
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
              </div>

              {/* Outro Video */}
              <div className="subsection">
                <label>Outro (Video kết thúc)</label>
                <div className={`dropzone ${dragOver === 'outro' ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, 'outro')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'outro')}>
                  <input type="file" accept="video/*" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    t.outro = { src: (f as any).path ?? "", duration: 3 };
                    setP({ ...p });
                  }} />
                  {t.outro?.src && <div className="file-name">📹 {t.outro.src.split('/').pop()}</div>}
                  <div className="drop-hint">Kéo thả outro video</div>
                </div>
                {t.outro?.src && (
                  <div className="row">
                    <div><label>Duration (s)</label><input type="number" min="0.1" step="0.1" value={t.outro?.duration || 3} onChange={e => { t.outro!.duration = Number(e.target.value); setP({ ...p }); }} /></div>
                    <div style={{display: 'flex', alignItems: 'flex-end'}}><button className="btn-sm btn-danger" onClick={() => { delete t.outro; setP({ ...p }); }}>Xóa Outro</button></div>
                  </div>
                )}
              </div>

              {/* Logo */}
              <div className="subsection">
                <label>Logo Overlay</label>
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
                {t.logo?.src && (
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
                )}
              </div>
            </div>

            {/* AUDIO SECTION */}
            <div className="section">
              <h3 className="section-title">🎵 Audio</h3>

              {/* Background Music */}
              <div className="subsection">
                <label>Background Music (BGM)</label>
                <div
                  className={`dropzone ${dragOver === 'bgm' ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, 'bgm')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'bgm')}
                >
                  <input type="file" accept="audio/*" onChange={e => {
                    const f=e.target.files?.[0]; if(!f) return;
                    t.audio!.bgm!.src=(f as any).path??"";
                    setP({ ...p });
                  }} />
                  {t.audio?.bgm?.src && <div className="file-name">🎵 {t.audio.bgm.src.split('/').pop()}</div>}
                  <div className="drop-hint">Kéo thả BGM vào đây</div>
                </div>
                {t.audio?.bgm?.src && (
                  <>
                    <label>Gain BGM (dB)</label>
                    <input type="number" value={t.audio?.bgm?.gain ?? -6} onChange={e => {
                      t.audio!.bgm!.gain = Number(e.target.value||-6);
                      setP({ ...p });
                    }} />
                  </>
                )}
              </div>

              {/* Voice */}
              <div className="subsection">
                <label>Voice / Narration</label>
                <div
                  className={`dropzone ${dragOver === 'voice' ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, 'voice')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'voice')}
                >
                  <input type="file" accept="audio/*" onChange={e => {
                    const f=e.target.files?.[0]; if(!f) return;
                    t.audio!.voice!.src=(f as any).path??"";
                    setP({ ...p });
                  }} />
                  {t.audio?.voice?.src && <div className="file-name">🎤 {t.audio.voice.src.split('/').pop()}</div>}
                  <div className="drop-hint">Kéo thả voice vào đây</div>
                </div>
                {t.audio?.voice?.src && (
                  <div className="row">
                    <div><label>Gain Voice (dB)</label><input type="number" value={t.audio?.voice?.gain ?? 0} onChange={e => {
                      t.audio!.voice!.gain = Number(e.target.value||0);
                      setP({ ...p });
                    }} /></div>
                    <div><label>Duck BGM</label><select value={t.audio?.voice?.duck_bgm ? "1":"0"} onChange={e => {
                      t.audio!.voice!.duck_bgm = e.target.value==="1";
                      setP({ ...p });
                    }}><option value="1">On</option><option value="0">Off</option></select></div>
                  </div>
                )}
              </div>
            </div>

            {/* TEXT / TICKER SECTION */}
            <div className="section">
              <h3 className="section-title">📝 Text / Ticker (Chữ Chạy)</h3>

              <div className="subsection">
                <label>Nội dung chữ chạy</label>
                <textarea rows={3} value={t.ticker?.text ?? ""} onChange={e => {
                  t.ticker!.text = e.target.value;
                  setP({ ...p });
                }} placeholder="Nhập nội dung chữ chạy..." />

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

                {/* Vị trí & Hướng */}
                <div className="row">
                  <div>
                    <label>Vị trí</label>
                    <select value={t.ticker?.position ?? 'footer'} onChange={e => {
                      const pos = e.target.value as 'header' | 'footer' | 'custom';
                      t.ticker!.position = pos;
                      if (pos === 'header') t.ticker!.y = 50;
                      else if (pos === 'footer') t.ticker!.y = 1000;
                      setP({ ...p });
                    }}>
                      <option value="header">Header (Trên)</option>
                      <option value="footer">Footer (Dưới)</option>
                      <option value="custom">Tùy chỉnh</option>
                    </select>
                  </div>
                  <div>
                    <label>Y {(t.ticker?.position === 'custom') ? '(Custom)' : ''}</label>
                    <input type="number" value={t.ticker?.y ?? 1000}
                      onChange={e => { t.ticker!.y = Number(e.target.value||1000); setP({ ...p }); }}
                      disabled={t.ticker?.position !== 'custom'} />
                  </div>
                  <div>
                    <label>Hướng</label>
                    <select value={t.ticker?.direction ?? 'rtl'} onChange={e => {
                      t.ticker!.direction = e.target.value as 'rtl' | 'ltr';
                      setP({ ...p });
                    }}>
                      <option value="rtl">← Phải → Trái</option>
                      <option value="ltr">Trái → Phải →</option>
                    </select>
                  </div>
                </div>

                {/* Kích thước & Tốc độ */}
                <div className="row">
                  <div><label>Size (px)</label><input type="number" value={t.ticker?.size ?? 48} onChange={e => {
                    t.ticker!.size = Number(e.target.value||48);
                    setP({ ...p });
                  }} /></div>
                  <div><label>Speed</label><input type="number" value={t.ticker?.speed ?? 250} onChange={e => {
                    t.ticker!.speed = Number(e.target.value||250);
                    setP({ ...p });
                  }} /></div>
                </div>

                {/* Màu & Độ trong suốt chữ */}
                <div className="row">
                  <div>
                    <label>Màu chữ</label>
                    <div className="color-input-group">
                      <input type="text" value={t.ticker?.color ?? "white"} onChange={e => {
                        t.ticker!.color = e.target.value;
                        setP({ ...p });
                      }} placeholder="white, #fff, rgb()" />
                      <input type="color" value={t.ticker?.color?.startsWith('#') ? t.ticker.color : '#ffffff'}
                        onChange={e => { t.ticker!.color = e.target.value; setP({ ...p }); }}
                        style={{width: '50px', padding: '4px', marginLeft: '4px'}} />
                    </div>
                  </div>
                  <div><label>Opacity chữ</label><input type="number" min="0" max="1" step="0.05" value={t.ticker?.textOpacity ?? 1.0} onChange={e => {
                    t.ticker!.textOpacity = Number(e.target.value);
                    setP({ ...p });
                  }} /></div>
                </div>

                {/* Đậm & Nghiêng */}
                <div className="row">
                  <div><label>Bold (Đậm)*</label><select value={t.ticker?.bold ? "1":"0"} onChange={e => {
                    t.ticker!.bold = e.target.value==="1";
                    setP({ ...p });
                  }}><option value="0">Off</option><option value="1">On</option></select></div>
                  <div><label>Italic (Nghiêng)*</label><select value={t.ticker?.italic ? "1":"0"} onChange={e => {
                    t.ticker!.italic = e.target.value==="1";
                    setP({ ...p });
                  }}><option value="0">Off</option><option value="1">On</option></select></div>
                </div>
                <div className="hint">* Lưu ý: Bold/Italic cần font đặc biệt (VD: Arial-Bold.ttf, Arial-Italic.ttf)</div>

                {/* Bóng chữ */}
                <div className="row">
                  <div><label>Shadow (Bóng)</label><select value={t.ticker?.shadow ? "1":"0"} onChange={e => {
                    t.ticker!.shadow = e.target.value==="1";
                    setP({ ...p });
                  }}><option value="0">Off</option><option value="1">On</option></select></div>
                  <div>
                    <label>Shadow Color</label>
                    <input type="text" value={t.ticker?.shadowColor ?? "black"} onChange={e => {
                      t.ticker!.shadowColor = e.target.value;
                      setP({ ...p });
                    }} disabled={!t.ticker?.shadow} />
                  </div>
                </div>
                {t.ticker?.shadow && (
                  <div className="row">
                    <div><label>Shadow X</label><input type="number" value={t.ticker?.shadowX ?? 2} onChange={e => {
                      t.ticker!.shadowX = Number(e.target.value||2);
                      setP({ ...p });
                    }} /></div>
                    <div><label>Shadow Y</label><input type="number" value={t.ticker?.shadowY ?? 2} onChange={e => {
                      t.ticker!.shadowY = Number(e.target.value||2);
                      setP({ ...p });
                    }} /></div>
                  </div>
                )}

                {/* Nền chữ */}
                <div className="row">
                  <div><label>Box BG</label><select value={t.ticker?.box ? "1":"0"} onChange={e => {
                    t.ticker!.box = e.target.value==="1";
                    setP({ ...p });
                  }}><option value="0">Off</option><option value="1">On</option></select></div>
                  <div>
                    <label>Box Color</label>
                    <input type="text" value={t.ticker?.boxColor ?? "black"} onChange={e => {
                      t.ticker!.boxColor = e.target.value;
                      setP({ ...p });
                    }} disabled={!t.ticker?.box} />
                  </div>
                  <div><label>Box Opacity</label><input type="number" min="0" max="1" step="0.05" value={t.ticker?.boxOpacity ?? 0.55} onChange={e => {
                    t.ticker!.boxOpacity = Number(e.target.value);
                    setP({ ...p });
                  }} disabled={!t.ticker?.box} /></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === 'settings' && (
          <div className="tab-content">
            {/* PROJECT SETTINGS */}
            <div className="section">
              <h3 className="section-title">⚙️ Project Settings</h3>

              <div className="row">
                <div>
                  <label>FPS (Frames/sec)</label>
                  <input type="number" value={p.fps} onChange={e => set("fps", Number(e.target.value||24))} />
                </div>
                <div>
                  <label>Output Duration (s)</label>
                  <input type="number" value={p.duration} onChange={e => set("duration", Number(e.target.value||15))} />
                </div>
              </div>

              <div className="row">
                <div>
                  <label>Width (px)</label>
                  <input type="number" value={p.width} onChange={e => set("width", Number(e.target.value||1920))} />
                </div>
                <div>
                  <label>Height (px)</label>
                  <input type="number" value={p.height} onChange={e => set("height", Number(e.target.value||1080))} />
                </div>
              </div>
            </div>

            {/* FRAME SETTINGS */}
            <div className="section">
              <h3 className="section-title">🖼️ Frame Border</h3>

              <div className="row">
                <div>
                  <label>Enable Frame</label>
                  <select value={t.frame?.enable ? "1":"0"} onChange={e => {
                    t.frame!.enable = e.target.value==="1";
                    setP({ ...p });
                  }}>
                    <option value="1">On</option>
                    <option value="0">Off</option>
                  </select>
                </div>
                <div>
                  <label>Thickness (px)</label>
                  <input type="number" value={t.frame?.thickness ?? 12} onChange={e => {
                    t.frame!.thickness = Number(e.target.value||12);
                    setP({ ...p });
                  }} disabled={!t.frame?.enable} />
                </div>
                <div>
                  <label>Color (with opacity)</label>
                  <input value={t.frame?.color ?? "white@0.85"} onChange={e => {
                    t.frame!.color = e.target.value;
                    setP({ ...p });
                  }} placeholder="white@0.85" disabled={!t.frame?.enable} />
                </div>
              </div>
              <div className="hint">Ví dụ: white@0.85, black@0.5, #ff0000@0.7</div>
            </div>

            {/* EXPORT */}
            <div className="section">
              <h3 className="section-title">📤 Export</h3>

              <button onClick={onExport} disabled={disabled} style={{width: '100%', padding: '12px', fontSize: '16px'}}>
                {disabled ? '⚠️ Cần ít nhất 1 video' : '🎬 Export MP4'}
              </button>
              <div className="hint">Yêu cầu FFmpeg đã cài đặt trên hệ thống. Output sẽ được lưu tại: output_news.mp4</div>
            </div>
          </div>
        )}
      </div>

      <div className="content">
        <h3>Preview (static)</h3>
        <div style={{aspectRatio: '16/9', width: '100%', background:'#141a22', border:'1px solid #1f2a36', borderRadius:12, display:'grid', placeItems:'center', color:'#7ea1d6', padding: '20px', textAlign: 'center'}}>
          <div>
            <p style={{fontSize: '18px', marginBottom: '10px'}}>📹 Preview Placeholder</p>
            <p style={{fontSize: '14px', opacity: 0.7}}>Mở video bằng player ngoài để xem kết quả</p>
            <p style={{fontSize: '12px', opacity: 0.5, marginTop: '10px'}}>Ticker/Logo/Frame sẽ hiển thị đúng ở file xuất</p>
          </div>
        </div>
        <p className="hint" style={{marginTop: '20px'}}>💡 Gợi ý: Kéo thả file vào các ô bên trái để import nhanh. Sử dụng tab Media để quản lý nội dung, tab Settings để cấu hình dự án.</p>

        {/* Quick Stats */}
        <div style={{marginTop: '20px', padding: '15px', background: '#0d1218', border: '1px solid #1f2a36', borderRadius: '8px'}}>
          <h4 style={{marginTop: 0, marginBottom: '12px', fontSize: '14px', opacity: 0.9}}>📊 Project Stats</h4>
          <div style={{fontSize: '12px', opacity: 0.75, lineHeight: '1.8'}}>
            <div>• Video clips: {t.video.length}{t.intro ? ' + Intro' : ''}{t.outro ? ' + Outro' : ''}</div>
            <div>• Logo: {t.logo?.src ? '✓ Loaded' : '✗ Not loaded'}</div>
            <div>• Ticker: {t.ticker?.text && t.ticker?.font ? '✓ Configured' : '✗ Not configured'}</div>
            <div>• BGM: {t.audio?.bgm?.src ? '✓ Loaded' : '✗ Not loaded'}</div>
            <div>• Voice: {t.audio?.voice?.src ? '✓ Loaded' : '✗ Not loaded'}</div>
            <div>• Frame: {t.frame?.enable ? '✓ Enabled' : '✗ Disabled'}</div>
          </div>
        </div>
      </div>
    </>
  );
}
