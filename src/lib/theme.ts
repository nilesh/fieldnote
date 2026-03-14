// MP020 Palette
// Bright Sandstone #DAD8CF | Red Gravy #B83312 | Web Cobblestone #1F282E
// Dusty Cotton #E4E3DC | Otan Red #FF4E20 | Midnight Smoke #414E58

export interface Theme {
  bg: string; bgSb: string; bgC: string; bgH: string; bgA: string; bgI: string;
  tx: string; tx2: string; txM: string; txS: string; txSA: string;
  bd: string; bdL: string;
  ac: string; acH: string; acL: string; acT: string;
  lk: string; lkL: string; sec: string; secL: string;
  tan: string; tanL: string;
  ok: string; okL: string; warn: string; warnL: string; err: string; errL: string;
  sh: string; shL: string;
}

export const lightTheme: Theme = {
  bg: "#DAD8CF",      bgSb: "#E4E3DC",    bgC: "#f0efea",      bgH: "#d0cec4",
  bgA: "#c8c6bc",     bgI: "#f0efea",
  tx: "#1F282E",       tx2: "#414E58",      txM: "#6d7882",
  txS: "#414E58",     txSA: "#1F282E",
  bd: "#c2c0b7",       bdL: "#d1cfc6",
  ac: "#B83312",       acH: "#9a2a0e",      acL: "#f2ddd6",      acT: "#ffffff",
  lk: "#414E58",       lkL: "#dde1e4",      sec: "#FF4E20",      secL: "#ffe4db",
  tan: "#DAD8CF",      tanL: "#E4E3DC",
  ok: "#3d7a4a",       okL: "#dff0e3",      warn: "#B83312",     warnL: "#f2ddd6",
  err: "#b83a3a",      errL: "#fce4e4",
  sh: "0 1px 3px rgba(31,40,46,0.06),0 1px 2px rgba(31,40,46,0.04)",
  shL: "0 4px 12px rgba(31,40,46,0.10)",
};

export const darkTheme: Theme = {
  bg: "#1F282E",       bgSb: "#171e23",     bgC: "#283038",      bgH: "#313a42",
  bgA: "#354049",     bgI: "#283038",
  tx: "#E4E3DC",       tx2: "#a8b0a6",      txM: "#6d7782",
  txS: "#8a9199",     txSA: "#E4E3DC",
  bd: "#354049",       bdL: "#2d363d",
  ac: "#FF4E20",       acH: "#e04318",      acL: "#3a2219",      acT: "#ffffff",
  lk: "#8a9da8",       lkL: "#263038",      sec: "#FF4E20",      secL: "#3a2219",
  tan: "#DAD8CF",      tanL: "#2d3339",
  ok: "#6dbd7a",       okL: "#1e2c20",      warn: "#FF4E20",     warnL: "#3a2219",
  err: "#e06060",      errL: "#3a1e1e",
  sh: "0 1px 3px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.03)",
  shL: "0 8px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03)",
};

export const VOICE_COLORS = [
  "#B83312", "#414E58", "#FF4E20", "#6d7882",
  "#6dbd7a", "#DAD8CF", "#1F282E", "#b83a3a",
];
