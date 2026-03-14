// MP250 Palette
// Bauhaus Tan #CCC4AE | Konkikyo Blue #191F45 | Funky Monkey #AD4E1A
// Bunny Hop #F3ECEA | Angel Falls #A3BDD3 | Blueberry Twist #24547D

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
  bg: "#F3ECEA",      bgSb: "#191F45",    bgC: "#ffffff",      bgH: "#efe8e4",
  bgA: "#E6DDD6",     bgI: "#ffffff",
  tx: "#191F45",       tx2: "#586178",      txM: "#8b8f9e",
  txS: "#A3BDD3",     txSA: "#ffffff",
  bd: "#d9cfC5",       bdL: "#ebe4dd",
  ac: "#AD4E1A",       acH: "#933f12",      acL: "#faeee5",      acT: "#ffffff",
  lk: "#24547D",       lkL: "#dae8f3",      sec: "#A3BDD3",      secL: "#e4eef5",
  tan: "#CCC4AE",      tanL: "#e2ddd2",
  ok: "#3d7a4a",       okL: "#e2f2e6",      warn: "#AD4E1A",     warnL: "#faeee5",
  err: "#b83a3a",      errL: "#fce4e4",
  sh: "0 1px 3px rgba(25,31,69,0.06),0 1px 2px rgba(25,31,69,0.04)",
  shL: "0 4px 12px rgba(25,31,69,0.08)",
};

export const darkTheme: Theme = {
  bg: "#141517",       bgSb: "#0e0f12",     bgC: "#1c1d21",      bgH: "#252629",
  bgA: "#2a2b30",     bgI: "#1c1d21",
  tx: "#F3ECEA",       tx2: "#b5ada5",      txM: "#706b65",
  txS: "#8a8379",     txSA: "#F3ECEA",
  bd: "#2e2f34",       bdL: "#232427",
  ac: "#D4693A",       acH: "#c05a2d",      acL: "#2d201a",      acT: "#ffffff",
  lk: "#8bb8d6",       lkL: "#1a2530",      sec: "#8bb8d6",      secL: "#1a2530",
  tan: "#CCC4AE",      tanL: "#2a2824",
  ok: "#6dbd7a",       okL: "#1a261c",      warn: "#D4693A",     warnL: "#2d201a",
  err: "#e06060",      errL: "#2d1a1a",
  sh: "0 1px 3px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.03)",
  shL: "0 8px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03)",
};

export const VOICE_COLORS = [
  "#AD4E1A", "#24547D", "#A3BDD3", "#8B6D3F",
  "#6dbd7a", "#D4693A", "#CCC4AE", "#b83a3a",
];
