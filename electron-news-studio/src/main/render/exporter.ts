import ffmpeg from "fluent-ffmpeg";
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
    // Using system's ffmpeg installation
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
