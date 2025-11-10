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

    // Multiple logos, audios come after all video inputs
    const logoStartIdx = inputIdx;
    const logos = tracks.logos || [];
    logos.forEach(() => inputIdx++);

    const audioStartIdx = inputIdx;
    const audios = tracks.audios || [];
    audios.forEach(() => inputIdx++);

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

    // Step 5: Apply logo overlays (multiple)
    let currentLabel = 'base';
    if (logos.length > 0) {
      logos.forEach((logo: any, i: number) => {
        // Use custom x, y if available, otherwise use preset position
        let overlayX: string;
        let overlayY: string;
        if (logo.x !== undefined && logo.y !== undefined) {
          // Custom position (pixels from left/top)
          overlayX = String(logo.x);
          overlayY = String(logo.y);
        } else {
          // Preset position (top-left, top-right, etc)
          const pos = posExpr(logo.pos || "top-right");
          overlayX = pos.x;
          overlayY = pos.y;
        }

        const op  = logo.opacity ?? 0.9;
        const lsc = logo.scale ?? 220;
        const inputIdx = logoStartIdx + i;
        const outputLabel = `v1_${i}`;

        vf.push(
          `[${inputIdx}:v]scale=${lsc}:-1,format=rgba,colorchannelmixer=aa=${op}[lg${i}]`,
          `[${currentLabel}][lg${i}]overlay=${overlayX}:${overlayY}:enable='between(t,${logo.start ?? 0},${logo.end ?? duration})'[${outputLabel}]`
        );
        currentLabel = outputLabel;
      });
    }

    // Ensure we have v1 label for next step
    if (currentLabel === 'base') {
      vf.push(`[base]copy[v1]`);
      currentLabel = 'v1';
    } else {
      vf.push(`[${currentLabel}]copy[v1]`);
      currentLabel = 'v1';
    }

    // Step 6: Apply frame border
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

    // Step 7: Apply tickers (multiple)
    const tickers = tracks.tickers || [];
    if (tickers.length > 0) {
      tickers.forEach((ticker: any, i: number) => {
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

        // Add timing (enable between start and end)
        const tickerStart = ticker.start ?? 0;
        const tickerEnd = ticker.end ?? duration;
        drawtextParams += `:enable='between(t,${tickerStart},${tickerEnd})'`;

        const outputLabel = i === tickers.length - 1 ? 'vout' : `vtick${i}`;
        vf.push(`[${currentLabel}]drawtext=${drawtextParams}[${outputLabel}]`);
        currentLabel = outputLabel;
      });
    } else {
      vf.push(`[${currentLabel}]copy[vout]`);
    }

    // Step 8: Audio chain (multiple tracks)
    const af: string[] = [];

    if (audios.length === 0) {
      // No audio
    } else if (audios.length === 1) {
      // Single audio track - simple gain with timing
      const audio = audios[0];
      const gain = audio.gain ?? (audio.type === 'voice' ? 0 : -6);
      const inputIdx = audioStartIdx;
      const audioStart = audio.start ?? 0;
      const audioEnd = audio.end ?? duration;
      const audioDur = audioEnd - audioStart;

      // Apply delay (start time), trim (duration), and volume
      if (audioStart > 0 || audioEnd < duration) {
        af.push(`[${inputIdx}:a]adelay=${Math.round(audioStart * 1000)}|${Math.round(audioStart * 1000)},atrim=0:${audioDur},volume=${asVolDb(gain)}[aout]`);
      } else {
        af.push(`[${inputIdx}:a]volume=${asVolDb(gain)}[aout]`);
      }
    } else {
      // Multiple audio tracks - need mixing
      // Separate voice tracks (with ducking) from other tracks
      const voiceTracks = audios.filter((a: any) => a.duckOthers);
      const otherTracks = audios.filter((a: any) => !a.duckOthers);

      // Apply delay, trim, and gain to all tracks first
      audios.forEach((audio: any, i: number) => {
        const gain = audio.gain ?? (audio.type === 'voice' ? 0 : -6);
        const inputIdx = audioStartIdx + i;
        const audioStart = audio.start ?? 0;
        const audioEnd = audio.end ?? duration;
        const audioDur = audioEnd - audioStart;

        // Apply timing if custom start/end is set
        if (audioStart > 0 || audioEnd < duration) {
          af.push(`[${inputIdx}:a]adelay=${Math.round(audioStart * 1000)}|${Math.round(audioStart * 1000)},atrim=0:${audioDur},volume=${asVolDb(gain)}[a${i}]`);
        } else {
          af.push(`[${inputIdx}:a]volume=${asVolDb(gain)}[a${i}]`);
        }
      });

      if (voiceTracks.length > 0 && otherTracks.length > 0) {
        // Mix other tracks first
        const otherIndices = audios
          .map((a: any, i: number) => !a.duckOthers ? i : -1)
          .filter((i: number) => i >= 0);
        const voiceIndices = audios
          .map((a: any, i: number) => a.duckOthers ? i : -1)
          .filter((i: number) => i >= 0);

        if (otherIndices.length === 1) {
          af.push(`[a${otherIndices[0]}]acopy[bgm_mix]`);
        } else {
          const bgmInputs = otherIndices.map((i: number) => `[a${i}]`).join('');
          af.push(`${bgmInputs}amix=inputs=${otherIndices.length}:dropout_transition=0:duration=longest[bgm_mix]`);
        }

        // Mix voice tracks
        if (voiceIndices.length === 1) {
          af.push(`[a${voiceIndices[0]}]acopy[voice_mix]`);
        } else {
          const voiceInputs = voiceIndices.map((i: number) => `[a${i}]`).join('');
          af.push(`${voiceInputs}amix=inputs=${voiceIndices.length}:dropout_transition=0:duration=longest[voice_mix]`);
        }

        // Apply ducking: voice ducks bgm
        af.push(`[bgm_mix][voice_mix]sidechaincompress=threshold=0.03:ratio=10:attack=5:release=200:makeup=4[aout]`);
      } else {
        // No ducking needed, just mix all tracks
        const allInputs = audios.map((_: any, i: number) => `[a${i}]`).join('');
        af.push(`${allInputs}amix=inputs=${audios.length}:dropout_transition=0:duration=longest,volume=1.0[aout]`);
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
      logos.forEach((logo: any) => pipeline.input(logo.src));
      audios.forEach((audio: any) => pipeline.input(audio.src));

      pipeline
        .outputOptions(["-pix_fmt yuv420p"])
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
