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

type MetadataValues = {
  encoder?: string;
  title?: string;
  author?: string;
  comment?: string;
  copyright?: string;
  creation_time?: string;
};

function getMetadataPreset(preset: string): MetadataValues {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  switch (preset) {
    case 'adobe-premiere':
      return {
        encoder: `Adobe Premiere Pro ${year}`,
        comment: "Created with Adobe Premiere Pro",
        creation_time: now,
      };
    case 'adobe-after-effects':
      return {
        encoder: `Adobe After Effects ${year}`,
        comment: "Rendered with Adobe After Effects",
        creation_time: now,
      };
    case 'camtasia':
      return {
        encoder: `TechSmith Camtasia Studio ${year}`,
        comment: "Produced with Camtasia Studio",
        creation_time: now,
      };
    default:
      return {};
  }
}

export function createExporter() {
  function asVolDb(db: number) {
    return Math.pow(10, db / 20).toFixed(3);
  }

  async function exportProject(
    project: any,
    onProgress?: (percent: number, timemark: string) => void
  ): Promise<string> {
    const { width, height, fps, duration, tracks } = project;
    const videoClips = tracks.video || [];
    const hasIntro = !!tracks.intro?.src;
    const hasOutro = !!tracks.outro?.src;

    if (videoClips.length === 0 && !hasIntro && !hasOutro) {
      throw new Error("No video content (need at least intro, main clips, or outro)");
    }

    const out = path.resolve(process.cwd(), "output_news.mp4");
    const vf: string[] = [];

    // Track input indices
    let inputIdx = 0;
    const inputs: string[] = [];

    // Add intro to inputs if present
    if (hasIntro) {
      inputs.push(tracks.intro.src);
      inputIdx++;
    }

    // Add main video clips to inputs
    const videoStartIdx = inputIdx;
    videoClips.forEach((clip: any) => {
      inputs.push(clip.src);
      inputIdx++;
    });

    // Add outro to inputs if present
    const outroIdx = hasOutro ? inputIdx : -1;
    if (hasOutro) {
      inputs.push(tracks.outro.src);
      inputIdx++;
    }

    // Logo, BGM, Voice come after all video inputs
    const logoIdx = tracks.logo?.src ? inputIdx++ : -1;
    const bgmIdx = tracks.audio?.bgm?.src ? inputIdx++ : -1;
    const voiceIdx = tracks.audio?.voice?.src ? inputIdx++ : -1;

    // Step 1: Process intro (if exists)
    if (hasIntro) {
      const introDur = tracks.intro.duration || 3;
      vf.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},trim=0:${introDur},setpts=PTS-STARTPTS[intro]`);
    }

    // Step 2: Process main timeline
    let mainLabel = 'main';

    if (videoClips.length === 0) {
      // No main clips, skip
      mainLabel = '';
    } else if (videoClips.length === 1) {
      // Single clip - simple case
      const clip = videoClips[0];
      const clipDur = clip.duration || 5;
      const idx = videoStartIdx;
      vf.push(`[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},trim=0:${clipDur},setpts=PTS-STARTPTS[main]`);
    } else {
      // Multiple clips with transitions
      videoClips.forEach((clip: any, i: number) => {
        const clipDur = clip.duration || 5;
        const idx = videoStartIdx + i;
        vf.push(`[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},trim=0:${clipDur},setpts=PTS-STARTPTS[v${i}]`);
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

      mainLabel = `t${videoClips.length - 2}`;
    }

    // Step 3: Process outro (if exists)
    if (hasOutro) {
      const outroDur = tracks.outro.duration || 3;
      vf.push(`[${outroIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},trim=0:${outroDur},setpts=PTS-STARTPTS[outro]`);
    }

    // Step 4: Concatenate intro + main + outro
    const segments: string[] = [];
    if (hasIntro) segments.push('intro');
    if (mainLabel) segments.push(mainLabel);
    if (hasOutro) segments.push('outro');

    if (segments.length === 0) {
      throw new Error("No video segments to process");
    } else if (segments.length === 1) {
      vf.push(`[${segments[0]}]copy[base]`);
    } else {
      // Concatenate multiple segments
      vf.push(`[${segments.join('][')}]concat=n=${segments.length}:v=1:a=0[base]`);
    }

    // Calculate main video timing (exclude intro and outro)
    const introTime = tracks.intro?.duration || 0;
    const mainStartTime = introTime;
    const mainEndTime = introTime + duration;

    // Step 5: Apply logo overlay (only during main video)
    let currentLabel = 'base';
    if (logoIdx >= 0) {
      const pos = posExpr(tracks.logo.pos || "top-right");
      const op  = tracks.logo.opacity ?? 0.9;
      const lsc = tracks.logo.scale ?? 220;
      vf.push(
        `[${logoIdx}:v]scale=${lsc}:-1,format=rgba,colorchannelmixer=aa=${op}[lg]`,
        `[base][lg]overlay=${pos.x}:${pos.y}:enable='between(t,${tracks.logo.start ?? mainStartTime},${tracks.logo.end ?? mainEndTime})'[v1]`
      );
      currentLabel = 'v1';
    } else {
      vf.push(`[base]copy[v1]`);
      currentLabel = 'v1';
    }

    // Step 6: Apply frame border (only during main video)
    if (tracks.frame?.enable) {
      const t = tracks.frame.thickness ?? 12;
      const c = tracks.frame.color ?? "white@0.85";
      const timeCondition = `:enable='between(t,${mainStartTime},${mainEndTime})'`;
      vf.push(
        `[${currentLabel}]drawbox=x=0:y=0:w=iw:h=${t}:t=fill:color=${c}${timeCondition}[v2]`,
        `[v2]drawbox=x=0:y=ih-${t}:w=iw:h=${t}:t=fill:color=${c}${timeCondition}[v3]`,
        `[v3]drawbox=x=0:y=0:w=${t}:h=ih:t=fill:color=${c}${timeCondition}[v4]`,
        `[v4]drawbox=x=iw-${t}:y=0:w=${t}:h=ih:t=fill:color=${c}${timeCondition}[v5]`
      );
      currentLabel = 'v5';
    } else {
      vf.push(`[${currentLabel}]copy[v5]`);
      currentLabel = 'v5';
    }

    // Step 7: Apply ticker
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

    // Step 8: Audio chain
    const af: string[] = [];

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

      // Add all inputs in order
      if (hasIntro) pipeline.input(tracks.intro.src);
      videoClips.forEach((clip: any) => pipeline.input(clip.src));
      if (hasOutro) pipeline.input(tracks.outro.src);
      if (logoIdx >= 0) pipeline.input(tracks.logo.src);
      if (bgmIdx >= 0) pipeline.input(tracks.audio.bgm.src);
      if (voiceIdx >= 0) pipeline.input(tracks.audio.voice.src);

      // Prepare metadata
      const outputOpts = ["-pix_fmt", "yuv420p"];

      if (project.metadata) {
        const meta = project.metadata;
        let metadataValues: MetadataValues = {};

        // Apply preset if specified
        if (meta.preset && meta.preset !== 'none') {
          metadataValues = getMetadataPreset(meta.preset);
        }

        // Override with custom values
        if (meta.encoder) metadataValues.encoder = meta.encoder;
        if (meta.title) metadataValues.title = meta.title;
        if (meta.author) metadataValues.author = meta.author;
        if (meta.comment) metadataValues.comment = meta.comment;
        if (meta.copyright) metadataValues.copyright = meta.copyright;

        // Add metadata to output options
        if (metadataValues.encoder) outputOpts.push("-metadata", `encoder=${metadataValues.encoder}`);
        if (metadataValues.title) outputOpts.push("-metadata", `title=${metadataValues.title}`);
        if (metadataValues.author) outputOpts.push("-metadata", `artist=${metadataValues.author}`);
        if (metadataValues.comment) outputOpts.push("-metadata", `comment=${metadataValues.comment}`);
        if (metadataValues.copyright) outputOpts.push("-metadata", `copyright=${metadataValues.copyright}`);
        if (metadataValues.creation_time) outputOpts.push("-metadata", `creation_time=${metadataValues.creation_time}`);
      }

      pipeline
        .outputOptions(outputOpts)
        .videoCodec("libx264")
        .fps(fps)
        .complexFilter(filter)
        .map("[vout]");

      if (af.length) pipeline.map("[aout]").audioCodec("aac").audioBitrate("192k");

      pipeline
        .save(out)
        .on("progress", (progress: any) => {
          if (onProgress && progress.timemark && duration) {
            // Parse timemark (format: HH:MM:SS.MS)
            const parts = progress.timemark.split(':');
            if (parts.length === 3) {
              const hours = parseFloat(parts[0]);
              const minutes = parseFloat(parts[1]);
              const seconds = parseFloat(parts[2]);
              const currentTime = hours * 3600 + minutes * 60 + seconds;

              // Calculate total duration including intro/outro
              const totalDuration =
                (tracks.intro?.duration || 0) +
                duration +
                (tracks.outro?.duration || 0);

              const percent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));
              onProgress(percent, progress.timemark);
            }
          }
        })
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
