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

export type Project = {
  fps: number;
  width: number;
  height: number;
  duration: number;
  tracks: {
    video: VideoClip[];
    logo?: { src: string; start?: number; end?: number; pos?: string; opacity?: number; scale?: number };
    ticker?: {
      text: string;
      font: string;
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
    frame?: { enable?: boolean; thickness?: number; color?: string };
    audio?: {
      bgm?: { src: string; gain?: number };
      voice?: { src: string; gain?: number; duck_bgm?: boolean };
    };
  };
};
