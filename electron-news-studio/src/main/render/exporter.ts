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
  handler_name?: string;
  timecode?: string;
  major_brand?: string;
  compatible_brands?: string;
  make?: string;
  model?: string;
  language?: string;
};

// Adobe Premiere Pro version database (2020-2025)
const adobePremiereVersions = [
  { year: 2020, versions: ['14.0', '14.1', '14.2', '14.3', '14.4', '14.5', '14.9'], buildRange: [1, 69] },
  { year: 2021, versions: ['15.0', '15.1', '15.2', '15.4'], buildRange: [1, 47] },
  { year: 2022, versions: ['22.0', '22.1', '22.2', '22.3', '22.4', '22.5', '22.6'], buildRange: [1, 101] },
  { year: 2023, versions: ['23.0', '23.1', '23.2', '23.3', '23.4', '23.5', '23.6'], buildRange: [1, 69] },
  { year: 2024, versions: ['24.0', '24.1', '24.2', '24.3', '24.4', '24.5', '24.6'], buildRange: [1, 100] },
  { year: 2025, versions: ['25.0', '25.1'], buildRange: [1, 30] },
];

// Adobe After Effects version database (2020-2025)
const adobeAfterEffectsVersions = [
  { year: 2020, versions: ['17.0', '17.0.1', '17.1', '17.1.1', '17.5'], buildRange: [1, 60] },
  { year: 2021, versions: ['18.0', '18.1', '18.2', '18.4'], buildRange: [1, 52] },
  { year: 2022, versions: ['22.0', '22.1', '22.2', '22.3', '22.4', '22.5', '22.6'], buildRange: [1, 112] },
  { year: 2023, versions: ['23.0', '23.1', '23.2', '23.3', '23.4', '23.5', '23.6'], buildRange: [1, 83] },
  { year: 2024, versions: ['24.0', '24.1', '24.2', '24.3', '24.4', '24.5'], buildRange: [1, 95] },
  { year: 2025, versions: ['25.0'], buildRange: [1, 25] },
];

// Adobe Media Encoder version database (2020-2025)
const adobeMediaEncoderVersions = [
  { year: 2020, versions: ['14.0', '14.0.1', '14.1', '14.2', '14.3', '14.4', '14.5'], buildRange: [1, 73] },
  { year: 2021, versions: ['15.0', '15.1', '15.2', '15.4'], buildRange: [1, 46] },
  { year: 2022, versions: ['22.0', '22.1', '22.2', '22.3', '22.4', '22.5', '22.6'], buildRange: [1, 101] },
  { year: 2023, versions: ['23.0', '23.1', '23.2', '23.3', '23.4', '23.5', '23.6'], buildRange: [1, 71] },
  { year: 2024, versions: ['24.0', '24.1', '24.2', '24.3', '24.4', '24.5', '24.6'], buildRange: [1, 97] },
  { year: 2025, versions: ['25.0', '25.1'], buildRange: [1, 28] },
];

// Camtasia Studio version database (2020-2025)
const camtasiaVersions = [
  { year: 2020, versions: ['2020.0.0', '2020.0.1', '2020.0.2', '2020.0.3', '2020.0.4', '2020.0.5'], buildRange: [4220, 4350] },
  { year: 2021, versions: ['2021.0.0', '2021.0.1', '2021.0.2', '2021.0.3', '2021.0.4', '2021.0.5', '2021.0.6', '2021.0.7'], buildRange: [4500, 4820] },
  { year: 2022, versions: ['2022.0.0', '2022.0.1', '2022.0.2', '2022.0.3'], buildRange: [5100, 5420] },
  { year: 2023, versions: ['2023.0.0', '2023.0.1', '2023.0.2', '2023.0.3', '2023.0.4'], buildRange: [5600, 5940] },
  { year: 2024, versions: ['2024.0.0', '2024.0.1', '2024.0.2', '2024.0.3', '2024.0.4', '2024.0.5'], buildRange: [6200, 6580] },
  { year: 2025, versions: ['2025.0.0', '2025.0.1'], buildRange: [6800, 6950] },
];

// Random Adobe Premiere version
function randomPremiereVersion() {
  const yearData = adobePremiereVersions[Math.floor(Math.random() * adobePremiereVersions.length)];
  const version = yearData.versions[Math.floor(Math.random() * yearData.versions.length)];
  const build = Math.floor(Math.random() * (yearData.buildRange[1] - yearData.buildRange[0] + 1)) + yearData.buildRange[0];
  return { year: yearData.year, version, build };
}

// Random After Effects version
function randomAfterEffectsVersion() {
  const yearData = adobeAfterEffectsVersions[Math.floor(Math.random() * adobeAfterEffectsVersions.length)];
  const version = yearData.versions[Math.floor(Math.random() * yearData.versions.length)];
  const build = Math.floor(Math.random() * (yearData.buildRange[1] - yearData.buildRange[0] + 1)) + yearData.buildRange[0];
  return { year: yearData.year, version, build };
}

// Random Media Encoder version
function randomMediaEncoderVersion() {
  const yearData = adobeMediaEncoderVersions[Math.floor(Math.random() * adobeMediaEncoderVersions.length)];
  const version = yearData.versions[Math.floor(Math.random() * yearData.versions.length)];
  const build = Math.floor(Math.random() * (yearData.buildRange[1] - yearData.buildRange[0] + 1)) + yearData.buildRange[0];
  return { year: yearData.year, version, build };
}

// Random Camtasia version
function randomCamtasiaVersion() {
  const yearData = camtasiaVersions[Math.floor(Math.random() * camtasiaVersions.length)];
  const version = yearData.versions[Math.floor(Math.random() * yearData.versions.length)];
  const build = Math.floor(Math.random() * (yearData.buildRange[1] - yearData.buildRange[0] + 1)) + yearData.buildRange[0];
  return { year: yearData.year, version, build };
}

function getMetadataPreset(preset: string): MetadataValues {
  const now = new Date().toISOString();

  // Random computer/device names for realism
  const computerNames = ['DESKTOP-7K9XM2P', 'WORKSTATION-5F3QN1', 'PC-STUDIO-X8L', 'EDIT-STATION-4N7', 'RENDER-PC-2K8', 'STUDIO-WS-9F4'];
  const randomPC = computerNames[Math.floor(Math.random() * computerNames.length)];

  switch (preset) {
    case 'adobe-premiere': {
      const ver = randomPremiereVersion();
      return {
        encoder: `Adobe Premiere Pro ${ver.year} (Windows)`,
        comment: `Encoded by Adobe Premiere Pro ${ver.version} Build ${ver.build}`,
        creation_time: now,
        handler_name: 'VideoHandler',
        timecode: '00:00:00:00',
        major_brand: 'isom',
        compatible_brands: 'isomiso2avc1mp41',
        make: 'Adobe Systems Incorporated',
        model: `Premiere Pro ${ver.year}`,
        language: 'eng',
      };
    }
    case 'adobe-after-effects': {
      const ver = randomAfterEffectsVersion();
      const renderQueue = Math.floor(Math.random() * 999) + 1;
      const compName = `Comp ${Math.floor(Math.random() * 50) + 1}`;
      return {
        encoder: `Adobe After Effects ${ver.year} (Windows)`,
        comment: `Rendered with Adobe After Effects ${ver.version} (Build ${ver.build}) - ${compName} - Render Queue Item ${renderQueue}`,
        creation_time: now,
        handler_name: 'Core Media Video',
        timecode: '00:00:00:00',
        major_brand: 'qt  ',
        compatible_brands: 'qt  ',
        make: 'Adobe Systems Incorporated',
        model: `After Effects ${ver.year}`,
        language: 'eng',
      };
    }
    case 'adobe-media-encoder': {
      const ver = randomMediaEncoderVersion();
      const presetNames = ['YouTube 1080p HD', 'H.264 High Quality', 'Match Source - High bitrate', 'Vimeo 1080p HD', 'Facebook 1080p', 'Custom Export'];
      const randomPreset = presetNames[Math.floor(Math.random() * presetNames.length)];
      const queueItem = Math.floor(Math.random() * 50) + 1;
      return {
        encoder: `Adobe Media Encoder ${ver.year} (Windows)`,
        comment: `Encoded by Adobe Media Encoder ${ver.version} Build ${ver.build} - Preset: ${randomPreset} - Queue Item ${queueItem}`,
        creation_time: now,
        handler_name: 'VideoHandler',
        timecode: '00:00:00:00',
        major_brand: 'isom',
        compatible_brands: 'isomiso2avc1mp41',
        make: 'Adobe Systems Incorporated',
        model: `Media Encoder ${ver.year}`,
        language: 'eng',
      };
    }
    case 'camtasia': {
      const ver = randomCamtasiaVersion();
      const projectNames = ['Screencast', 'Tutorial', 'Recording', 'Project', 'Presentation', 'Demo', 'Walkthrough'];
      const randomProject = projectNames[Math.floor(Math.random() * projectNames.length)];
      return {
        encoder: `TechSmith Camtasia Studio ${ver.version} (Build ${ver.build})`,
        comment: `Produced with Camtasia Studio ${ver.version} for Windows - ${randomProject} on ${randomPC}`,
        creation_time: now,
        handler_name: 'VideoHandler',
        timecode: '00:00:00;00',
        major_brand: 'mp42',
        compatible_brands: 'mp42isom',
        make: 'TechSmith Corporation',
        model: `Camtasia ${ver.year}`,
        language: 'eng',
      };
    }
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
        if (metadataValues.handler_name) outputOpts.push("-metadata:s:v:0", `handler_name=${metadataValues.handler_name}`);
        if (metadataValues.timecode) outputOpts.push("-metadata", `timecode=${metadataValues.timecode}`);
        if (metadataValues.major_brand) outputOpts.push("-brand", metadataValues.major_brand);
        if (metadataValues.make) outputOpts.push("-metadata", `make=${metadataValues.make}`);
        if (metadataValues.model) outputOpts.push("-metadata", `model=${metadataValues.model}`);
        if (metadataValues.language) outputOpts.push("-metadata:s:v:0", `language=${metadataValues.language}`);
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
