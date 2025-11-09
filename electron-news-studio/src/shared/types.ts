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
    video: TrackItem[];
    logo?: { src: string; start?: number; end?: number; pos?: string; opacity?: number; scale?: number };
    ticker?: { text: string; font: string; size?: number; color?: string; y?: number; speed?: number; box?: boolean };
    frame?: { enable?: boolean; thickness?: number; color?: string };
    audio?: {
      bgm?: { src: string; gain?: number };
      voice?: { src: string; gain?: number; duck_bgm?: boolean };
    };
  };
};
