export type TransitionType = 'none' | 'fade' | 'fadeblack' | 'wipeleft' | 'wiperight' | 'wipeup' | 'wipedown' | 'slideleft' | 'slideright' | 'slideup' | 'slidedown' | 'circlecrop' | 'circleopen' | 'dissolve';

export type VideoClip = {
  id: string;
  src: string;
  duration?: number;
  trim?: { start: number; end: number };
  transition?: {
    type: TransitionType;
    duration: number; // in seconds
  };
};

export type TrackItem = {
  id: string;
  src?: string;
  start?: number;
  duration?: number;
  in?: number;
  out?: number;
};

// Audio Track - Can have multiple
export type AudioTrack = {
  id: string;
  name: string;
  src: string;
  start?: number; // Start time in seconds (for timeline positioning)
  end?: number; // End time in seconds (for timeline positioning)
  gain?: number;
  type?: 'bgm' | 'voice'; // bgm or voice-over
  duckOthers?: boolean; // duck other audio tracks when this plays
};

// Logo Track - Can have multiple overlays
export type LogoTrack = {
  id: string;
  name: string;
  src: string;
  start?: number;
  end?: number;
  pos?: string; // top-left, top-right, bottom-left, bottom-right, center (preset)
  x?: number; // Custom X position (pixels from left, overrides pos if set)
  y?: number; // Custom Y position (pixels from top, overrides pos if set)
  opacity?: number;
  scale?: number;
};

// Ticker Track - Can have multiple tickers
export type TickerTrack = {
  id: string;
  name: string;
  text: string;
  font: string;
  start?: number; // Start time in seconds (for timeline positioning)
  end?: number; // End time in seconds (for timeline positioning)
  size?: number;
  color?: string;
  y?: number;
  speed?: number;
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number;
  textOpacity?: number;
  direction?: 'rtl' | 'ltr';
  position?: 'header' | 'footer' | 'custom';
  bold?: boolean;
  italic?: boolean;
  shadow?: boolean;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
};

export type Project = {
  fps: number;
  width: number;
  height: number;
  duration: number;
  tracks: {
    intro?: { src: string; duration?: number };
    video: VideoClip[]; // Main video track (single track, multiple clips)
    outro?: { src: string; duration?: number };
    audios: AudioTrack[]; // Multiple audio tracks
    logos: LogoTrack[]; // Multiple logo overlay tracks
    tickers: TickerTrack[]; // Multiple ticker tracks
    frame?: { enable?: boolean; thickness?: number; color?: string }; // Single frame (border)
  };
};
