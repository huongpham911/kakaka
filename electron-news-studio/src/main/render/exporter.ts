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
    const videoClips = tracks.video || [];

    if (videoClips.length === 0) throw new Error("No video clips in timeline");

    const out = path.resolve(process.cwd(), "output_news.mp4");
    const vf: string[] = [];

    // Step 1: Build video timeline with transitions
    let currentLabel = 'base';

    if (videoClips.length === 1) {
      // Single clip - simple case
      const clip = videoClips[0];
      const clipDur = clip.duration || 5;
      vf.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},trim=0:${clipDur},setpts=PTS-STARTPTS[base]`);
    } else {
      // Multiple clips with transitions
      videoClips.forEach((clip, i) => {
        const clipDur = clip.duration || 5;
        vf.push(`[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},trim=0:${clipDur},setpts=PTS-STARTPTS[v${i}]`);
      });

      // Apply transitions between clips
      let offset = 0;
      for (let i = 0; i < videoClips.length - 1; i++) {
        const clip = videoClips[i];
        const nextClip = videoClips[i + 1];
        const transDur = (nextClip.transition?.duration || 1);
        const transType = nextClip.transition?.type || 'fade';

        const inputA = i === 0 ? `v${i}` : `t${i - 1}`;
        const inputB = `v${i + 1}`;
        const output = `t${i}`;

        const clipDur = clip.duration || 5;
        offset += clipDur - transDur;

        if (transType === 'none') {
          // No transition, just concat
          vf.push(`[${inputA}][${inputB}]concat=n=2:v=1:a=0[${output}]`);
        } else {
          // Map transition type to xfade transition name
          const xfadeType = mapTransitionType(transType);
          vf.push(`[${inputA}][${inputB}]xfade=transition=${xfadeType}:duration=${transDur}:offset=${offset}[${output}]`);
        }
      }

      currentLabel = `t${videoClips.length - 2}`;
      vf.push(`[${currentLabel}]copy[base]`);
    }

    // Step 2: Apply logo overlay
    let logoIdx = -1;
    if (tracks.logo?.src) {
      logoIdx = videoClips.length;
      const pos = posExpr(tracks.logo.pos || "top-right");
      const op  = tracks.logo.opacity ?? 0.9;
      const lsc = tracks.logo.scale ?? 220;
      vf.push(
        `[${logoIdx}:v]scale=${lsc}:-1,format=rgba,colorchannelmixer=aa=${op}[lg]`,
        `[base][lg]overlay=${pos.x}:${pos.y}:enable='between(t,${tracks.logo.start ?? 0},${tracks.logo.end ?? duration})'[v1]`
      );
      currentLabel = 'v1';
    } else {
      vf.push(`[base]copy[v1]`);
      currentLabel = 'v1';
    }

    // Step 3: Apply frame border
    if (tracks.frame?.enable) {
      const t = tracks.frame.thickness ?? 12;
      const c = tracks.frame.color ?? "white@0.85";
      vf.push(
        `[${currentLabel}]drawbox=x=0:y=0:w=iw:h=${t}:t=fill:color=${c}[v2]`,
        `[v2]drawbox=x=0:y=ih-${t}:w=iw:h=${t}:t=fill:color=${c}[v3]`,
        `[v3]drawbox=x=0:y=0:w=${t}:h=ih:t=fill:color=${c}[v4]`,
        `[v4]drawbox=x=iw-${t}:y=0:w=${t}:h=ih:t=fill:color=${c}[v5]`
      );
      currentLabel = 'v5';
    } else {
      vf.push(`[${currentLabel}]copy[v5]`);
      currentLabel = 'v5';
    }

    // Step 4: Apply ticker
    if (tracks.ticker?.text && tracks.ticker?.font) {
      const ticker = tracks.ticker;
      const ty   = ticker.y ?? (height - 80);
      const spd  = ticker.speed ?? 250;
      const size = ticker.size ?? 48;
      const col  = ticker.color ?? "white";
      const dir  = ticker.direction ?? 'rtl';
      const textOp = ticker.textOpacity ?? 1.0;
      const textEsc = String(ticker.text).replace(/:/g, "\\:").replace(/'/g, "\\\\'");

      // Direction formulas:
      // RTL (right to left): x=w-mod(t*speed, tw+w) - starts from right, moves left
      // LTR (left to right): x=mod(t*speed, tw+w)-tw - starts from left, moves right
      const xFormula = dir === 'rtl'
        ? `w-mod(t*${spd}\\,tw+w)`
        : `mod(t*${spd}\\,tw+w)-tw`;

      // Build font color with opacity (convert color to RGBA if needed)
      let fontColor = col;
      if (textOp < 1.0) {
        // If color is a name or hex, convert to rgba with alpha
        // For simplicity, append @alpha notation which FFmpeg supports
        fontColor = `${col}@${textOp.toFixed(2)}`;
      }

      // Build drawtext parameters
      let drawtextParams = `fontfile='${ticker.font}':text='${textEsc}':fontsize=${size}:fontcolor=${fontColor}:x=${xFormula}:y=${ty}`;

      // Add shadow if enabled
      if (ticker.shadow) {
        const shadowCol = ticker.shadowColor ?? "black";
        const shadowX = ticker.shadowX ?? 2;
        const shadowY = ticker.shadowY ?? 2;
        drawtextParams += `:shadowcolor=${shadowCol}:shadowx=${shadowX}:shadowy=${shadowY}`;
      }

      // Add box background if enabled
      if (ticker.box) {
        const boxCol = ticker.boxColor ?? "black";
        const boxOp = ticker.boxOpacity ?? 0.55;
        const boxColorWithAlpha = `${boxCol}@${boxOp.toFixed(2)}`;
        drawtextParams += `:box=1:boxcolor=${boxColorWithAlpha}:boxborderw=20`;
      }

      // Note: FFmpeg drawtext doesn't directly support bold/italic via parameters
      // These would need to be handled by using bold/italic font variants
      // For now, we'll add a comment noting this limitation
      // Users should load appropriate font files (e.g., Arial-Bold.ttf, Arial-Italic.ttf)

      vf.push(`[${currentLabel}]drawtext=${drawtextParams}[vout]`);
    } else {
      vf.push(`[${currentLabel}]copy[vout]`);
    }

    // Step 5: Audio chain
    const af: string[] = [];
    let bgmIdx = -1, voiceIdx = -1;
    let audioOffset = videoClips.length;
    if (tracks.logo?.src) audioOffset++;

    if (tracks.audio?.bgm?.src) bgmIdx = audioOffset++;
    if (tracks.audio?.voice?.src) voiceIdx = audioOffset++;

    const aIns: string[] = [];
    if (voiceIdx >= 0) aIns.push(`${voiceIdx}:a`);
    if (bgmIdx >= 0) aIns.push(`${bgmIdx}:a`);

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
          `[${bgmIdx}:a]volume=${asVolDb(bGain)}[bgm]`,
          `[${voiceIdx}:a]volume=${asVolDb(vGain)}[vo]`,
          `[bgm][vo]sidechaincompress=threshold=0.03:ratio=10:attack=5:release=200:makeup=4[aout]`
        );
      } else {
        af.push(
          `[${bgmIdx}:a]volume=${asVolDb(bGain)}[bgm]`,
          `[${voiceIdx}:a]volume=${asVolDb(vGain)}[vo]`,
          `[bgm][vo]amix=inputs=2:dropout_transition=0:duration=longest,volume=1.0[aout]`
        );
      }
    }

    const filter = vf.concat(af).join(";");

    // Build FFmpeg command
    return await new Promise<string>((resolve, reject) => {
      const pipeline = ffmpeg();

      // Add all video clips as inputs
      videoClips.forEach(clip => pipeline.input(clip.src));

      // Add logo, bgm, voice
      if (tracks.logo?.src) pipeline.input(tracks.logo.src);
      if (tracks.audio?.bgm?.src) pipeline.input(tracks.audio.bgm.src);
      if (tracks.audio?.voice?.src) pipeline.input(tracks.audio.voice.src);

      pipeline
        .outputOptions(["-pix_fmt yuv420p"])
        .videoCodec("libx264")
        .fps(fps)
        .complexFilter(filter)
        .map("[vout]");

      if (af.length) pipeline.map("[aout]").audioCodec("aac").audioBitrate("192k");

      pipeline
        .save(out)
        .on("end", () => resolve(out))
        .on("error", reject);
    });
  }

  function mapTransitionType(type: string): string {
    // Map our transition types to xfade transition names
    const map: Record<string, string> = {
      'fade': 'fade',
      'fadeblack': 'fadeblack',
      'wipeleft': 'wipeleft',
      'wiperight': 'wiperight',
      'wipeup': 'wipeup',
      'wipedown': 'wipedown',
      'slideleft': 'slideleft',
      'slideright': 'slideright',
      'slideup': 'slideup',
      'slidedown': 'slidedown',
      'circlecrop': 'circlecrop',
      'circleopen': 'circleopen',
      'dissolve': 'dissolve'
    };
    return map[type] || 'fade';
  }

  return { exportProject };
}
