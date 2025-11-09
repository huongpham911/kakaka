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
