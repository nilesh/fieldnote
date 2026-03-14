import { useState, useEffect, useRef } from "react";

// ── MP250 Palette ──────────────────────────────────────────────────────
// Bauhaus Tan #CCC4AE | Konkikyo Blue #191F45 | Funky Monkey #AD4E1A
// Bunny Hop #F3ECEA | Angel Falls #A3BDD3 | Blueberry Twist #24547D

const I = {
  Home: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  Mic: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
  HardDrive: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>,
  Settings: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  Search: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Sun: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  Moon: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
  Play: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}><polygon points="6 3 20 12 6 21 6 3"/></svg>,
  Pause: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Download: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Upload: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  Trash: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Folder: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>,
  Check: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  Clock: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Users: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  FileText: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>,
  ChevR: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>,
  Usb: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="10" cy="7" r="1"/><circle cx="4" cy="20" r="1"/><path d="M4.7 19.3 19 5"/><path d="m21 3-3 1 2 2Z"/><path d="M9.26 7.68 5 12l2 2"/><path d="m10 14 2 2"/><circle cx="12" cy="17" r="1"/></svg>,
  Export: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>,
  Sparkles: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>,
  X: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  FileAudio: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 19a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0"/></svg>,
  Waveform: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/></svg>,
  Edit: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>,
  UserPlus: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>,
  Volume: (p) => <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
};

// ── Speaker palette for auto-detected voices ───────────────────────────
const VOICE_COLORS = ["#AD4E1A","#24547D","#A3BDD3","#8B6D3F","#6dbd7a","#D4693A","#CCC4AE","#b83a3a"];

const SPEAKERS = [
  { id: "s1", name: "Nilesh Ghule", color: "#AD4E1A" },
  { id: "s2", name: "Karmendra Singh", color: "#24547D" },
  { id: "s3", name: "Priya Menon", color: "#A3BDD3" },
  { id: "s4", name: "Rahul Desai", color: "#8B6D3F" },
];

const MEETINGS = [
  { id: "m1", title: "Sastrum Product Roadmap Review", date: "2026-03-13T10:00:00", duration: 2847, speakers: ["s1","s2","s3"], folder: "Product", tags: ["roadmap","Q2 planning"],
    sentiment: { positive: 62, neutral: 28, negative: 10 },
    summary: "Team reviewed the Q2 roadmap for Sastrum. Key decisions include prioritizing the workflow automation module and deferring the compliance dashboard redesign to Q3. Karmendra raised concerns about Azure costs for the Malaysia deployment. Priya proposed a phased rollout for the new tenant management features.",
    actionItems: [{ text: "Finalize Azure Malaysia West cost estimates", assignee: "Karmendra Singh", done: false },{ text: "Draft PRD for workflow automation module", assignee: "Nilesh Ghule", done: false },{ text: "Schedule user testing sessions with pilot customers", assignee: "Priya Menon", done: true },{ text: "Review Keycloak multi-tenancy architecture doc", assignee: "Nilesh Ghule", done: false }],
    keyDecisions: ["Workflow automation module prioritized for Q2","Compliance dashboard redesign moved to Q3","Phased rollout approved for tenant management","Budget allocated for additional Azure resources"],
    transcript: [
      { time: 0, speaker: "s1", text: "Alright, let's kick off the roadmap review. I want to make sure we're aligned on Q2 priorities before the board meeting next week." },
      { time: 15, speaker: "s2", text: "Sure. I've been looking at the Azure costs for the Malaysia deployment. The egress estimates came in higher than expected." },
      { time: 32, speaker: "s1", text: "How much higher are we talking? We budgeted around twelve thousand per month for that region." },
      { time: 45, speaker: "s2", text: "Closer to eighteen thousand if we include the WAF and DDoS protection layers. The monitoring stack adds another two thousand." },
      { time: 62, speaker: "s3", text: "That's significant. Should we consider a phased approach? Start with basic monitoring and scale up." },
      { time: 78, speaker: "s1", text: "Good point. Let's separate the must-haves from nice-to-haves. Karmendra, can you put together a tiered cost breakdown?" },
      { time: 95, speaker: "s2", text: "Will do. I'll have it ready by Thursday. Also wanted to flag the Keycloak architecture decision — Organizations or Realms for multi-tenancy." },
      { time: 115, speaker: "s1", text: "Right. I've been leaning towards Organizations since it gives us better isolation without the overhead. Let's review the doc." },
      { time: 138, speaker: "s3", text: "On the product side, the workflow automation module should be our top priority. Every customer demo, that's the first thing they ask about." },
      { time: 155, speaker: "s1", text: "Agreed. The React Flow integration is already in progress. We need to finalize the FastAPI backend for the execution engine." },
      { time: 172, speaker: "s3", text: "I also wanted to propose scheduling user testing sessions with our pilot customers. Three companies signed LOIs." },
      { time: 190, speaker: "s1", text: "Do it. Set those up for the last two weeks of the month." },
      { time: 205, speaker: "s2", text: "What about the compliance dashboard redesign? A few prospects mentioned it looked dated." },
      { time: 222, speaker: "s1", text: "Push that to Q3. The workflow module will have more impact on conversion." },
      { time: 240, speaker: "s3", text: "For the tenant management rollout, I'd suggest a phased approach — subdomain provisioning first, then custom domains and SSO." },
      { time: 260, speaker: "s1", text: "Good. Let's go with that. Anything else before we wrap up?" },
      { time: 270, speaker: "s2", text: "We should allocate budget for additional Azure resources. The dev environment is getting slow." },
      { time: 288, speaker: "s1", text: "Approved. Put together the request and I'll sign off today. Good discussion — let's execute." },
    ],
  },
  { id: "m2", title: "Cygint OT Security Proposal", date: "2026-03-12T14:30:00", duration: 1923, speakers: ["s1","s4"], folder: "Cygint", tags: ["security","banking"],
    sentiment: { positive: 45, neutral: 40, negative: 15 },
    summary: "Reviewed the OT security assessment proposal for the banking sector client. Discussed FirmaGuard integration and compliance requirements.",
    actionItems: [{ text: "Update proposal with FirmaGuard pricing", assignee: "Rahul Desai", done: false },{ text: "Research SBI OT compliance requirements", assignee: "Nilesh Ghule", done: false }],
    keyDecisions: ["Include firmware analysis in proposal scope","Target 6-week assessment timeline"],
    transcript: [{ time: 0, speaker: "s1", text: "Let's go through the OT assessment proposal. Rahul, where are we?" },{ time: 12, speaker: "s4", text: "I've drafted scope covering network segmentation, PLC firmware analysis, and SCADA assessment." },{ time: 30, speaker: "s1", text: "Bundle FirmaGuard. Price it at a fifteen percent premium." }],
  },
  { id: "m3", title: "TPTrac — BBVA Peru Analysis", date: "2026-03-11T09:00:00", duration: 3156, speakers: ["s1","s2","s3","s4"], folder: "Product", tags: ["TPTrac","LATAM"],
    sentiment: { positive: 55, neutral: 30, negative: 15 },
    summary: "Competitive landscape review for BBVA Peru TPRM opportunity. Analyzed KY3P and identified SBS regulatory compliance as key differentiator.",
    actionItems: [{ text: "Create competitive comparison matrix", assignee: "Priya Menon", done: true },{ text: "Draft Spanish language support timeline", assignee: "Rahul Desai", done: false }],
    keyDecisions: ["Focus on SBS regulatory alignment","Commit to Spanish localization by Q2 end"],
    transcript: [{ time: 0, speaker: "s1", text: "Let's review what we know about KY3P for the BBVA Peru opportunity." },{ time: 18, speaker: "s3", text: "KY3P has presence in LATAM but their SBS compliance module is shallow. We can go deeper." }],
  },
  { id: "m4", title: "Weekly Engineering Standup", date: "2026-03-10T11:00:00", duration: 1200, speakers: ["s1","s2"], folder: "Engineering", tags: ["standup","sprint"],
    sentiment: { positive: 70, neutral: 25, negative: 5 },
    summary: "Sprint progress check. Frontend ahead of schedule on workflow editor. Backend API endpoints 80% complete.",
    actionItems: [{ text: "Merge workflow editor PR by EOD", assignee: "Karmendra Singh", done: true },{ text: "Write integration tests for tenant API", assignee: "Nilesh Ghule", done: false }],
    keyDecisions: ["Extend sprint by 2 days for QA"],
    transcript: [{ time: 0, speaker: "s1", text: "Quick standup. Karmendra, workflow editor status?" },{ time: 8, speaker: "s2", text: "Ahead of schedule. React Flow integration done. PR ready by end of day." }],
  },
  { id: "m5", title: "Pre-Seed Pitch Prep", date: "2026-03-08T16:00:00", duration: 4200, speakers: ["s1","s3"], folder: "Business", tags: ["fundraising","pitch"],
    sentiment: { positive: 72, neutral: 20, negative: 8 },
    summary: "Refined the AI differentiation narrative around the four-engine model and Lumina branding for upcoming VC meeting.",
    actionItems: [{ text: "Update pitch deck with Lumina positioning", assignee: "Nilesh Ghule", done: true },{ text: "Prepare financial model scenarios", assignee: "Priya Menon", done: false }],
    keyDecisions: ["Lead with AI-first narrative","Position Lumina as core differentiator","Target 1.5M pre-seed at 8M valuation"],
    transcript: [{ time: 0, speaker: "s1", text: "Let's run through the pitch. I want the AI story tight." },{ time: 14, speaker: "s3", text: "Leading with the four-engine model is the right call. Separates us from traditional GRC." }],
  },
];

const DEVICE_FILES = [
  { id: "f1", name: "REC_20260314_093012.wav", size: "142.3 MB", date: "2026-03-14T09:30:12", duration: 3456, transferred: false },
  { id: "f2", name: "REC_20260313_100000.wav", size: "98.7 MB", date: "2026-03-13T10:00:00", duration: 2847, transferred: true, meetingId: "m1" },
  { id: "f3", name: "REC_20260312_143000.wav", size: "67.2 MB", date: "2026-03-12T14:30:00", duration: 1923, transferred: true, meetingId: "m2" },
  { id: "f4", name: "REC_20260311_090000.wav", size: "112.8 MB", date: "2026-03-11T09:00:00", duration: 3156, transferred: true, meetingId: "m3" },
  { id: "f5", name: "REC_20260310_110000.wav", size: "45.1 MB", date: "2026-03-10T11:00:00", duration: 1200, transferred: true, meetingId: "m4" },
  { id: "f6", name: "REC_20260308_160000.wav", size: "156.9 MB", date: "2026-03-08T16:00:00", duration: 4200, transferred: true, meetingId: "m5" },
];

const FOLDERS = ["All","Product","Cygint","Engineering","Business"];
const ACCEPTED_EXT = ".wav,.mp3,.m4a,.ogg,.flac,.webm,.aac,.mp4,.wma";
const MAX_MB = 500;

const f = {
  dur(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?`${h}h ${m}m`:`${m}m ${sec}s`},
  time(s){return`${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`},
  date(d){const x=Math.floor((new Date()-new Date(d))/864e5);return x===0?"Today":x===1?"Yesterday":x<7?`${x}d ago`:new Date(d).toLocaleDateString("en-IN",{month:"short",day:"numeric"})},
  dateFull(d){return new Date(d).toLocaleDateString("en-IN",{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})},
  size(b){return b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`},
};

// ── Themes ─────────────────────────────────────────────────────────────
const LT = {
  bg:"#F3ECEA",bgSb:"#191F45",bgC:"#ffffff",bgH:"#efe8e4",bgA:"#E6DDD6",bgI:"#ffffff",
  tx:"#191F45",tx2:"#586178",txM:"#8b8f9e",txS:"#A3BDD3",txSA:"#ffffff",
  bd:"#d9cfC5",bdL:"#ebe4dd",
  ac:"#AD4E1A",acH:"#933f12",acL:"#faeee5",acT:"#ffffff",
  lk:"#24547D",lkL:"#dae8f3",sec:"#A3BDD3",secL:"#e4eef5",
  tan:"#CCC4AE",tanL:"#e2ddd2",
  ok:"#3d7a4a",okL:"#e2f2e6",warn:"#AD4E1A",warnL:"#faeee5",err:"#b83a3a",errL:"#fce4e4",
  sh:"0 1px 3px rgba(25,31,69,0.06),0 1px 2px rgba(25,31,69,0.04)",shL:"0 4px 12px rgba(25,31,69,0.08)",
};
const DT = {
  bg:"#141517",bgSb:"#0e0f12",bgC:"#1c1d21",bgH:"#252629",bgA:"#2a2b30",bgI:"#1c1d21",
  tx:"#F3ECEA",tx2:"#b5ada5",txM:"#706b65",txS:"#8a8379",txSA:"#F3ECEA",
  bd:"#2e2f34",bdL:"#232427",
  ac:"#D4693A",acH:"#c05a2d",acL:"#2d201a",acT:"#ffffff",
  lk:"#8bb8d6",lkL:"#1a2530",sec:"#8bb8d6",secL:"#1a2530",
  tan:"#CCC4AE",tanL:"#2a2824",
  ok:"#6dbd7a",okL:"#1a261c",warn:"#D4693A",warnL:"#2d201a",err:"#e06060",errL:"#2d1a1a",
  sh:"0 1px 3px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.03)",shL:"0 8px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03)",
};

// ── Shared Components ──────────────────────────────────────────────────
function SentimentBar({s,t}){return(<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{display:"flex",gap:12,fontSize:12,color:t.tx2}}><span style={{color:t.ok}}>Positive {s.positive}%</span><span>Neutral {s.neutral}%</span><span style={{color:t.err}}>Negative {s.negative}%</span></div><div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",background:t.bgA}}><div style={{width:`${s.positive}%`,background:t.ok}}/><div style={{width:`${s.neutral}%`,background:t.tan}}/><div style={{width:`${s.negative}%`,background:t.err}}/></div></div>)}

function Player({ct,dur,play,onPP,onSeek,t}){const p=dur>0?(ct/dur)*100:0;return(
  <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:t.bgC,border:`1px solid ${t.bd}`,borderRadius:10,boxShadow:t.sh}}>
    <button onClick={onPP} style={{width:36,height:36,borderRadius:"50%",border:"none",background:t.ac,color:t.acT,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{play?<I.Pause/>:<I.Play/>}</button>
    <span style={{fontSize:12,color:t.tx2,minWidth:42,fontVariantNumeric:"tabular-nums"}}>{f.time(ct)}</span>
    <div onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onSeek(Math.floor(((e.clientX-r.left)/r.width)*dur))}} style={{flex:1,height:6,background:t.bgA,borderRadius:3,cursor:"pointer",position:"relative"}}>
      <div style={{width:`${p}%`,height:"100%",background:t.ac,borderRadius:3}}/><div style={{position:"absolute",top:-4,left:`${p}%`,transform:"translateX(-50%)",width:14,height:14,borderRadius:"50%",background:t.ac,boxShadow:t.sh}}/>
    </div>
    <span style={{fontSize:12,color:t.tx2,minWidth:42,fontVariantNumeric:"tabular-nums"}}>{f.time(dur)}</span>
  </div>
)}

// ── Import Wizard ──────────────────────────────────────────────────────
// Steps: 1=upload, 2=transcribing, 3=speaker-tagging, 4=metadata, 5=done
const MOCK_VOICES = [
  { id: "v1", label: "Speaker 1", color: VOICE_COLORS[0], segments: 34, duration: 847, sampleText: "I want to make sure we're aligned on Q2 priorities before the board meeting next week." },
  { id: "v2", label: "Speaker 2", color: VOICE_COLORS[1], segments: 28, duration: 623, sampleText: "The egress estimates came in higher than expected. Closer to eighteen thousand." },
  { id: "v3", label: "Speaker 3", color: VOICE_COLORS[2], segments: 19, duration: 412, sampleText: "Should we consider a phased approach? Start with basic monitoring and scale up." },
];

function ImportWizard({ t, dk, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState(null); // null = choosing, "upload" or "device"
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState({});
  const [deviceFiles] = useState(DEVICE_FILES.filter(x => !x.transferred));
  const [selectedDevice, setSelectedDevice] = useState([]);
  const [deviceTransferring, setDeviceTransferring] = useState(false);
  const [deviceTransferDone, setDeviceTransferDone] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStage, setTranscribeStage] = useState("");
  const [voices, setVoices] = useState(MOCK_VOICES.map(v => ({ ...v, assignedName: "" })));
  const [playingVoice, setPlayingVoice] = useState(null);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("Product");
  const [tags, setTags] = useState("");
  const ref = useRef(null);

  const validate = (fl) => {
    const ext = "." + fl.name.split(".").pop().toLowerCase();
    if (!ACCEPTED_EXT.split(",").includes(ext)) return `Unsupported: ${ext}`;
    if (fl.size > MAX_MB * 1048576) return `Too large. Max ${MAX_MB}MB.`;
    return null;
  };

  const addFiles = (list) => {
    const items = Array.from(list).map(fl => ({ id: Math.random().toString(36).slice(2,8), file: fl, name: fl.name, size: fl.size, error: validate(fl), status: validate(fl) ? "error" : "ready" }));
    setFiles(p => [...p, ...items]);
  };

  const startUpload = () => {
    const valid = files.filter(x => x.status === "ready");
    valid.forEach((fl, i) => {
      let p = 0;
      const iv = setInterval(() => {
        p += Math.random() * 20 + 8;
        if (p >= 100) { p = 100; clearInterval(iv); setProgress(x => ({...x,[fl.id]:100})); setFiles(x => x.map(z => z.id === fl.id ? {...z, status:"uploaded"} : z)); }
        else setProgress(x => ({...x,[fl.id]:Math.min(p,100)}));
      }, 150 + i * 30);
    });
  };

  const allUploaded = files.length > 0 && files.filter(x => !x.error).every(x => x.status === "uploaded");

  const startDeviceTransfer = () => {
    setDeviceTransferring(true);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 6 + 3;
      if (p >= 100) { p = 100; clearInterval(iv); setDeviceTransferDone(true); setDeviceTransferring(false); }
      setProgress(x => ({ ...x, device: Math.min(p, 100) }));
    }, 120);
  };

  const sourceReady = source === "upload" ? allUploaded : (source === "device" && deviceTransferDone);

  // Transcription simulation
  const startTranscription = () => {
    setStep(2);
    const stages = ["Analyzing audio waveform...","Detecting voice activity...","Running speech-to-text...","Identifying speaker segments...","Generating AI summary...","Extracting action items..."];
    let prog = 0;
    let stageIdx = 0;
    setTranscribeStage(stages[0]);
    const iv = setInterval(() => {
      prog += Math.random() * 3 + 1;
      const newStage = Math.min(Math.floor(prog / (100 / stages.length)), stages.length - 1);
      if (newStage !== stageIdx) { stageIdx = newStage; setTranscribeStage(stages[stageIdx]); }
      if (prog >= 100) {
        prog = 100; clearInterval(iv);
        setTranscribeStage("Complete");
        setTimeout(() => setStep(3), 600);
      }
      setTranscribeProgress(Math.min(prog, 100));
    }, 120);
  };

  const steps = [
    { n: 1, label: "Source" },
    { n: 2, label: "Transcribe" },
    { n: 3, label: "Speakers" },
    { n: 4, label: "Details" },
  ];

  const hasValid = files.some(x => x.status === "ready");
  const hasDeviceSel = selectedDevice.length > 0;
  const voicesNamed = voices.filter(v => v.assignedName.trim()).length;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 660, maxHeight: "88vh", background: t.bgC, borderRadius: 18, border: `1px solid ${t.bd}`, boxShadow: dk ? DT.shL : "0 24px 80px rgba(25,31,69,0.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header + Step Indicator */}
        <div style={{ padding: "20px 28px 16px", borderBottom: `1px solid ${t.bd}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: t.tx, margin: 0 }}>Import Recording</h3>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: t.bgA, color: t.tx2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I.X /></button>
          </div>
          {/* Steps */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: step > s.n ? t.ok : step === s.n ? t.ac : t.bgA,
                  color: step >= s.n ? "#fff" : t.txM,
                }}>{step > s.n ? <I.Check style={{ width: 12, height: 12 }} /> : s.n}</div>
                <span style={{ fontSize: 12, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? t.tx : t.txM }}>{s.label}</span>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: step > s.n ? t.ok : t.bgA, borderRadius: 1, marginLeft: 4 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 28px" }}>

          {/* Step 1: Source Selection */}
          {step === 1 && (<>
            {/* Source picker */}
            {!source && (
              <div style={{ display: "flex", gap: 14 }}>
                <div onClick={() => setSource("upload")} style={{ flex: 1, padding: "28px 20px", borderRadius: 14, border: `2px solid ${t.bd}`, background: t.bg, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.ac; e.currentTarget.style.background = t.acL; }} onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.bg; }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: t.acL, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I.Upload style={{ color: t.ac, width: 22, height: 22 }} /></div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.tx, marginBottom: 4 }}>Upload File</div>
                  <div style={{ fontSize: 12, color: t.tx2 }}>From your computer</div>
                  <div style={{ fontSize: 11, color: t.txM, marginTop: 8 }}>WAV, MP3, M4A, FLAC, OGG, AAC, WebM</div>
                </div>
                <div onClick={() => setSource("device")} style={{ flex: 1, padding: "28px 20px", borderRadius: 14, border: `2px solid ${t.bd}`, background: t.bg, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.lk; e.currentTarget.style.background = t.lkL; }} onMouseLeave={e => { e.currentTarget.style.borderColor = t.bd; e.currentTarget.style.background = t.bg; }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: t.lkL, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I.Usb style={{ color: t.lk, width: 22, height: 22 }} /></div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.tx, marginBottom: 4 }}>From Hidock P1</div>
                  <div style={{ fontSize: 12, color: t.tx2 }}>Transfer from device via USB</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.ok }} />
                    <span style={{ fontSize: 11, color: t.ok }}>Connected</span>
                    <span style={{ fontSize: 11, color: t.txM }}>· {deviceFiles.length} recordings</span>
                  </div>
                </div>
              </div>
            )}

            {/* Upload mode */}
            {source === "upload" && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <button onClick={() => { setSource(null); setFiles([]); setProgress({}); }} style={{ fontSize: 12, color: t.lk, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}><I.ChevR style={{ transform: "rotate(180deg)", width: 14, height: 14 }} /> Change source</button>
              </div>
              <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}} onClick={()=>ref.current?.click()}
                style={{ border: `2px dashed ${drag?t.ac:t.bd}`, borderRadius: 12, padding: "28px 24px", textAlign: "center", cursor: "pointer", background: drag?t.acL:t.bg, transition: "all 0.2s" }}>
                <input ref={ref} type="file" accept={ACCEPTED_EXT} multiple onChange={e=>addFiles(e.target.files)} style={{ display: "none" }} />
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: t.acL, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><I.FileAudio style={{ color: t.ac }} /></div>
                <p style={{ fontSize: 14, fontWeight: 600, color: t.tx, margin: "0 0 4px" }}>Drop audio files here or click to browse</p>
                <p style={{ fontSize: 12, color: t.txM, margin: 0 }}>Up to {MAX_MB}MB per file</p>
              </div>
              {files.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {files.map(fl => (
                    <div key={fl.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${fl.error?t.err+"40":t.bd}`, background: fl.error?t.errL:t.bg }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: fl.error?t.errL:t.secL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Waveform style={{ color: fl.error?t.err:t.lk, width: 15, height: 15 }} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fl.name}</div>
                        <div style={{ fontSize: 11, color: fl.error?t.err:t.tx2, marginTop: 1 }}>{fl.error || `${f.size(fl.size)}${fl.status==="uploaded"?" — Uploaded":""}`}</div>
                        {progress[fl.id] !== undefined && fl.status !== "uploaded" && !fl.error && (
                          <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: t.bgA, overflow: "hidden" }}>
                            <div style={{ width: `${progress[fl.id]}%`, height: "100%", borderRadius: 2, background: t.ac, transition: "width 0.15s" }} />
                          </div>
                        )}
                      </div>
                      {fl.status === "uploaded" && <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.okL, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Check style={{ color: t.ok, width: 11, height: 11 }} /></div>}
                      {(fl.status==="ready"||fl.status==="error") && <button onClick={()=>setFiles(p=>p.filter(x=>x.id!==fl.id))} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", color: t.txM, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I.X /></button>}
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* Device mode */}
            {source === "device" && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <button onClick={() => { setSource(null); setSelectedDevice([]); setDeviceTransferDone(false); setProgress({}); }} style={{ fontSize: 12, color: t.lk, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}><I.ChevR style={{ transform: "rotate(180deg)", width: 14, height: 14 }} /> Change source</button>
              </div>

              {/* Device status bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: t.bg, border: `1px solid ${t.bd}`, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: t.okL, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Usb style={{ color: t.ok, width: 16, height: 16 }} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>Hidock P1</div>
                  <div style={{ fontSize: 11, color: t.tx2 }}>Connected via USB · {deviceFiles.length} unprocessed recording{deviceFiles.length !== 1 ? "s" : ""}</div>
                </div>
                {selectedDevice.length > 0 && !deviceTransferDone && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: t.ac }}>{selectedDevice.length} selected</span>
                )}
              </div>

              {/* Device transfer progress */}
              {deviceTransferring && (
                <div style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 10, background: t.acL, border: `1px solid ${t.ac}30` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.tx }}>Transferring {selectedDevice.length} file{selectedDevice.length !== 1 ? "s" : ""} from device...</span>
                    <span style={{ fontSize: 12, color: t.txM }}>{Math.round(progress.device || 0)}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: t.bgA, overflow: "hidden" }}>
                    <div style={{ width: `${progress.device || 0}%`, height: "100%", borderRadius: 3, background: t.ac, transition: "width 0.15s" }} />
                  </div>
                </div>
              )}
              {deviceTransferDone && (
                <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 10, background: t.okL, border: `1px solid ${t.ok}30`, display: "flex", alignItems: "center", gap: 10 }}>
                  <I.Check style={{ color: t.ok }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.tx }}>{selectedDevice.length} recording{selectedDevice.length !== 1 ? "s" : ""} transferred</span>
                </div>
              )}

              {/* File list */}
              {!deviceTransferDone && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {/* Select all */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8 }}>
                    <input type="checkbox" checked={selectedDevice.length === deviceFiles.length && deviceFiles.length > 0} onChange={() => setSelectedDevice(selectedDevice.length === deviceFiles.length ? [] : deviceFiles.map(x => x.id))} style={{ accentColor: t.ac, width: 15, height: 15 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.txM }}>Select all</span>
                  </div>
                  {deviceFiles.map(fl => {
                    const sel = selectedDevice.includes(fl.id);
                    return (
                      <div key={fl.id} onClick={() => setSelectedDevice(p => p.includes(fl.id) ? p.filter(x => x !== fl.id) : [...p, fl.id])}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${sel ? t.ac + "60" : t.bd}`, background: sel ? t.acL : t.bg, cursor: "pointer", transition: "all 0.15s" }}>
                        <input type="checkbox" checked={sel} readOnly style={{ accentColor: t.ac, width: 15, height: 15, pointerEvents: "none" }} />
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: t.secL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Waveform style={{ color: t.lk, width: 15, height: 15 }} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: t.tx }}>{fl.name}</div>
                          <div style={{ fontSize: 11, color: t.tx2, marginTop: 1 }}>{fl.size} · {f.dur(fl.duration)} · {f.date(fl.date)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {deviceFiles.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: t.txM, fontSize: 13 }}>No unprocessed recordings on device.</div>
                  )}
                </div>
              )}
            </>)}
          </>)}

          {/* Step 2: Transcribing */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
              {/* Animated waveform */}
              <div style={{ display: "flex", gap: 3, alignItems: "center", height: 60, marginBottom: 28 }}>
                {Array.from({length: 24}).map((_,i) => {
                  const h = transcribeProgress < 100 ? 12 + Math.sin(Date.now()/300 + i*0.5) * 20 + Math.random()*8 : 6;
                  return <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: t.ac, opacity: 0.4 + (i/24)*0.6, transition: "height 0.15s" }} />;
                })}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.tx, marginBottom: 6 }}>
                {transcribeProgress >= 100 ? "Transcription complete" : "Transcribing your recording"}
              </div>
              <div style={{ fontSize: 13, color: t.tx2, marginBottom: 20 }}>{transcribeStage}</div>
              <div style={{ width: "100%", maxWidth: 400, height: 8, borderRadius: 4, background: t.bgA, overflow: "hidden" }}>
                <div style={{ width: `${transcribeProgress}%`, height: "100%", borderRadius: 4, background: transcribeProgress >= 100 ? t.ok : t.ac, transition: "width 0.2s, background 0.3s" }} />
              </div>
              <div style={{ fontSize: 12, color: t.txM, marginTop: 8 }}>{Math.round(transcribeProgress)}%</div>

              {/* Processing details */}
              <div style={{ marginTop: 28, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {["Speech-to-text","Speaker diarization","AI summarization","Action item extraction","Sentiment analysis"].map((label, i) => {
                  const pct = Math.min(Math.max((transcribeProgress - i*18) * 2.5, 0), 100);
                  const done = pct >= 100;
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: t.bg }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: done ? t.okL : pct > 0 ? t.acL : t.bgA, }}>
                        {done ? <I.Check style={{ color: t.ok, width: 11, height: 11 }} /> : pct > 0 ? <I.Sparkles style={{ color: t.ac, width: 10, height: 10 }} /> : null}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: done ? t.tx : pct > 0 ? t.tx : t.txM, fontWeight: pct > 0 ? 500 : 400 }}>{label}</span>
                      {pct > 0 && !done && <span style={{ fontSize: 11, color: t.txM }}>{Math.round(pct)}%</span>}
                      {done && <span style={{ fontSize: 11, color: t.ok }}>Done</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Speaker Tagging */}
          {step === 3 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: t.tx, fontWeight: 600, margin: "0 0 4px" }}>We detected {voices.length} distinct voices</p>
                <p style={{ fontSize: 13, color: t.tx2, margin: 0 }}>Tag each voice with a name. You can play a sample to identify who's who.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {voices.map((v, vi) => (
                  <div key={v.id} style={{ padding: "16px 18px", borderRadius: 12, border: `1px solid ${v.assignedName.trim() ? t.ok+"50" : t.bd}`, background: v.assignedName.trim() ? (dk ? t.okL : "#f4faf5") : t.bgC, boxShadow: t.sh, transition: "all 0.2s" }}>
                    {/* Voice identity row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: v.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {v.assignedName.trim() ? v.assignedName.trim()[0].toUpperCase() : v.label.split(" ")[1]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: v.color }}>{v.label}</div>
                        <div style={{ fontSize: 11, color: t.tx2 }}>{v.segments} segments · {f.dur(v.duration)} total</div>
                      </div>
                      {/* Play sample button */}
                      <button onClick={() => setPlayingVoice(playingVoice === v.id ? null : v.id)} style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer",
                        border: `1px solid ${t.bd}`, background: playingVoice === v.id ? t.acL : "transparent",
                        color: playingVoice === v.id ? t.ac : t.lk, display: "flex", alignItems: "center", gap: 5,
                      }}>
                        {playingVoice === v.id ? <I.Pause style={{ width: 11, height: 11 }} /> : <I.Volume />}
                        {playingVoice === v.id ? "Playing" : "Sample"}
                      </button>
                    </div>

                    {/* Sample text */}
                    {playingVoice === v.id && (
                      <div style={{ padding: "10px 14px", borderRadius: 8, background: t.bg, marginBottom: 12, borderLeft: `3px solid ${v.color}` }}>
                        <p style={{ fontSize: 13, color: t.tx, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{v.sampleText}"</p>
                        {/* Fake waveform visualization */}
                        <div style={{ display: "flex", gap: 2, alignItems: "center", height: 20, marginTop: 8 }}>
                          {Array.from({ length: 40 }).map((_, j) => (
                            <div key={j} style={{ width: 3, height: 4 + Math.random() * 14, borderRadius: 1, background: v.color, opacity: 0.3 + Math.random() * 0.7 }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Name input */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <I.UserPlus style={{ color: t.txM, flexShrink: 0 }} />
                      <input
                        placeholder={`Who is ${v.label}?`}
                        value={v.assignedName}
                        onChange={e => setVoices(p => p.map(x => x.id === v.id ? { ...x, assignedName: e.target.value } : x))}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.bd}`, background: t.bgI, color: t.tx, fontSize: 13, outline: "none" }}
                        onFocus={e => e.target.style.borderColor = t.ac}
                        onBlur={e => e.target.style.borderColor = t.bd}
                      />
                      {v.assignedName.trim() && <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.okL, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Check style={{ color: t.ok, width: 11, height: 11 }} /></div>}
                    </div>

                    {/* Quick-assign from known speakers */}
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      {SPEAKERS.map(sp => (
                        <button key={sp.id} onClick={() => setVoices(p => p.map(x => x.id === v.id ? { ...x, assignedName: sp.name } : x))}
                          style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, border: `1px solid ${v.assignedName === sp.name ? t.ac : t.bd}`, background: v.assignedName === sp.name ? t.acL : "transparent", color: v.assignedName === sp.name ? t.ac : t.tx2, cursor: "pointer" }}>
                          {sp.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: t.bg, fontSize: 12, color: t.tx2, display: "flex", alignItems: "center", gap: 8 }}>
                <I.Sparkles style={{ color: t.lk, width: 14, height: 14 }} />
                <span>{voicesNamed}/{voices.length} voices identified — unnamed voices will appear as "Speaker {"{N}"}"</span>
              </div>
            </div>
          )}

          {/* Step 4: Meeting Details */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.tx2, display: "block", marginBottom: 6 }}>Meeting Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Quarterly Planning Session"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.bd}`, background: t.bgI, color: t.tx, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = t.ac} onBlur={e => e.target.style.borderColor = t.bd} />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.tx2, display: "block", marginBottom: 6 }}>Folder</label>
                  <select value={folder} onChange={e => setFolder(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.bd}`, background: t.bgI, color: t.tx, fontSize: 13, outline: "none", cursor: "pointer" }}>
                    {FOLDERS.filter(x => x !== "All").map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.tx2, display: "block", marginBottom: 6 }}>Tags</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma separated, e.g. roadmap, Q2"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${t.bd}`, background: t.bgI, color: t.tx, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = t.ac} onBlur={e => e.target.style.borderColor = t.bd} />
                </div>
              </div>

              {/* Preview */}
              <div style={{ padding: "16px 18px", borderRadius: 12, border: `1px solid ${t.bd}`, background: t.bg }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.tx, marginBottom: 10 }}>Summary preview</div>
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  {voices.map(v => (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: v.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>
                        {(v.assignedName.trim() || v.label)[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, color: t.tx2 }}>{v.assignedName.trim() || v.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 12, color: t.txM }}>
                  <span>{files.filter(x => !x.error).length} file(s)</span>
                  <span>·</span>
                  <span>{folder}</span>
                  {tags.trim() && <><span>·</span><span>{tags.split(",").length} tags</span></>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", borderTop: `1px solid ${t.bd}` }}>
          {step === 1 && <>
            <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1px solid ${t.bd}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>Cancel</button>
            <div style={{ display: "flex", gap: 8 }}>
              {source === "upload" && hasValid && !allUploaded && <button onClick={startUpload} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", background: t.lk, color: "#fff", cursor: "pointer" }}>Upload Files</button>}
              {source === "device" && hasDeviceSel && !deviceTransferDone && !deviceTransferring && <button onClick={startDeviceTransfer} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", background: t.lk, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><I.Download style={{ width: 14, height: 14 }} /> Transfer from Device</button>}
              {sourceReady && <button onClick={startTranscription} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", background: t.ac, color: t.acT, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><I.Sparkles style={{ width: 14, height: 14 }} /> Start Transcription</button>}
            </div>
          </>}
          {step === 2 && <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: t.txM }}>Processing — this may take a few minutes for longer recordings</div>}
          {step === 3 && <>
            <button onClick={() => setStep(4)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1px solid ${t.bd}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>Skip tagging</button>
            <button onClick={() => setStep(4)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", background: t.ac, color: t.acT, cursor: "pointer" }}>{voicesNamed > 0 ? `Continue with ${voicesNamed} tagged` : "Continue"}</button>
          </>}
          {step === 4 && <>
            <button onClick={() => setStep(3)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1px solid ${t.bd}`, background: "transparent", color: t.tx2, cursor: "pointer" }}>Back</button>
            <button onClick={() => { onComplete({ title: title || "Untitled Recording", folder, tags: tags.split(",").map(x => x.trim()).filter(Boolean), voices }); onClose(); }}
              style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", background: t.ok, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <I.Check style={{ width: 14, height: 14 }} /> Save Meeting
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────
function Dashboard({ meetings, onSelect, t, q }) {
  const [fld, setFld] = useState("All");
  const [tgs, setTgs] = useState([]);
  const allTags = [...new Set(meetings.flatMap(m => m.tags))];
  const list = meetings.filter(m => {
    if (fld !== "All" && m.folder !== fld) return false;
    if (tgs.length && !tgs.some(x => m.tags.includes(x))) return false;
    if (q && !m.title.toLowerCase().includes(q.toLowerCase()) && !m.summary.toLowerCase().includes(q.toLowerCase()) && !m.tags.some(x => x.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });
  const stats = [
    { label: "Total Meetings", value: meetings.length, icon: <I.Mic width={18} height={18} />, c: t.ac },
    { label: "Recorded Hours", value: `${(meetings.reduce((a,m)=>a+m.duration,0)/3600).toFixed(1)}h`, icon: <I.Clock width={18} height={18} />, c: t.lk },
    { label: "Action Items", value: meetings.reduce((a,m)=>a+m.actionItems.length,0), icon: <I.Check width={18} height={18} />, c: t.ok },
    { label: "Pending", value: meetings.reduce((a,m)=>a+m.actionItems.filter(i=>!i.done).length,0), icon: <I.Clock width={18} height={18} />, c: t.warn },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {stats.map((s,i) => (
          <div key={i} style={{ padding: "18px 20px", background: t.bgC, borderRadius: 12, border: `1px solid ${t.bd}`, boxShadow: t.sh }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: t.tx2 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: s.c+"18", color: s.c }}>{s.icon}</div>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.tx, letterSpacing: "-0.03em" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {FOLDERS.map(x => <button key={x} onClick={() => setFld(x)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", background: fld===x?t.ac:"transparent", color: fld===x?t.acT:t.tx2 }}><I.Folder style={{ marginRight: 4, verticalAlign: -2 }} /> {x}</button>)}
        </div>
        <div style={{ width: 1, height: 20, background: t.bd }} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {allTags.map(x => <button key={x} onClick={() => setTgs(p => p.includes(x)?p.filter(z=>z!==x):[...p,x])} style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, cursor: "pointer", border: `1px solid ${tgs.includes(x)?t.lk:t.bd}`, background: tgs.includes(x)?t.lkL:"transparent", color: tgs.includes(x)?t.lk:t.tx2 }}>{x}</button>)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map(m => {
          const sp = m.speakers.map(id => SPEAKERS.find(s=>s.id===id));
          return (<div key={m.id} onClick={() => onSelect(m)} style={{ padding: "16px 20px", background: t.bgC, borderRadius: 12, border: `1px solid ${t.bd}`, cursor: "pointer", boxShadow: t.sh, transition: "all 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=t.ac;e.currentTarget.style.boxShadow=t.shL}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.bd;e.currentTarget.style.boxShadow=t.sh}}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><h3 style={{ fontSize: 15, fontWeight: 600, color: t.tx, margin: 0 }}>{m.title}</h3><div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: t.tx2 }}><span>{f.date(m.date)}</span><span>{f.dur(m.duration)}</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><I.Users /> {m.speakers.length}</span></div></div>
                <div style={{ display: "flex", gap: 4 }}>{m.tags.map(x => <span key={x} style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 500, background: t.tanL, color: t.tx2 }}>{x}</span>)}</div>
              </div>
              <p style={{ fontSize: 13, color: t.tx2, margin: "8px 0 10px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.summary}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex" }}>{sp.map((s,i) => <div key={s.id} style={{ width: 26, height: 26, borderRadius: "50%", background: s.color, border: `2px solid ${t.bgC}`, marginLeft: i>0?-6:0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff" }}>{s.name[0]}</div>)}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: t.tx2 }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><I.Check /> {m.actionItems.filter(a=>a.done).length}/{m.actionItems.length}</span><I.ChevR style={{ color: t.txM }} /></div>
              </div>
            </div>);
        })}
        {!list.length && <div style={{ textAlign: "center", padding: 48, color: t.txM, fontSize: 14 }}>No meetings match your filters.</div>}
      </div>
    </div>
  );
}

// ── Meeting Detail ─────────────────────────────────────────────────────
function Detail({ m, onBack, t }) {
  const [tab, setTab] = useState("transcript");
  const [play, setPl] = useState(false);
  const [ct, setCt] = useState(0);
  const [hl, setHl] = useState(null);
  const iv = useRef(null);
  useEffect(() => { if (play) { iv.current = setInterval(() => setCt(p => p >= m.duration ? (setPl(false), m.duration) : p + 1), 1000); } return () => clearInterval(iv.current); }, [play, m.duration]);
  useEffect(() => { for (let i = m.transcript.length - 1; i >= 0; i--) { if (ct >= m.transcript[i].time) { setHl(i); break; } } }, [ct, m.transcript]);
  const sp = m.speakers.map(id => SPEAKERS.find(s => s.id === id));
  const tabs = [{ id: "transcript", label: "Transcript" }, { id: "summary", label: "Summary" }, { id: "actions", label: "Action Items" }, { id: "decisions", label: "Decisions" }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: t.lk, cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><I.ChevR style={{ transform: "rotate(180deg)" }} /> Back</button>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: t.tx, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{m.title}</h2>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: t.tx2, flexWrap: "wrap", alignItems: "center" }}><span>{f.dateFull(m.date)}</span><span>{f.dur(m.duration)}</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><I.Folder /> {m.folder}</span>{m.tags.map(x => <span key={x} style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, background: t.tanL, color: t.tx2 }}>{x}</span>)}</div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>{sp.map(s => <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 24, height: 24, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff" }}>{s.name[0]}</div><span style={{ fontSize: 12, color: t.tx2 }}>{s.name}</span></div>)}</div>
        <div style={{ marginTop: 12 }}><SentimentBar s={m.sentiment} t={t} /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>{["PDF","Markdown","Notion"].map(x => <button key={x} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: `1px solid ${t.bd}`, background: t.bgC, color: t.lk, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><I.Export /> {x}</button>)}</div>
      <div style={{ display: "flex", borderBottom: `2px solid ${t.bd}` }}>{tabs.map(x => <button key={x.id} onClick={() => setTab(x.id)} style={{ padding: "10px 18px", fontSize: 13, fontWeight: 500, border: "none", background: "transparent", cursor: "pointer", color: tab === x.id ? t.ac : t.tx2, borderBottom: tab === x.id ? `2px solid ${t.ac}` : "2px solid transparent", marginBottom: -2 }}>{x.label}</button>)}</div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {tab === "transcript" && m.transcript.map((ln, i) => { const s = SPEAKERS.find(x => x.id === ln.speaker); return (
          <div key={i} onClick={() => { setCt(ln.time); setPl(true); }} style={{ display: "flex", gap: 12, padding: "10px 12px", borderRadius: 8, background: hl === i ? t.acL : "transparent", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => { if (hl !== i) e.currentTarget.style.background = t.bgH }} onMouseLeave={e => { if (hl !== i) e.currentTarget.style.background = "transparent" }}>
            <span style={{ fontSize: 11, color: t.txM, minWidth: 40, paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>{f.time(ln.time)}</span>
            <div style={{ width: 3, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.name}</span><p style={{ fontSize: 13, color: t.tx, margin: "2px 0 0", lineHeight: 1.55 }}>{ln.text}</p></div>
          </div>); })}
        {tab === "summary" && <div style={{ padding: 20, background: t.bgC, borderRadius: 12, border: `1px solid ${t.bd}`, boxShadow: t.sh }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: t.ac }}><I.Sparkles /> <span style={{ fontSize: 13, fontWeight: 600 }}>AI Summary</span></div><p style={{ fontSize: 14, lineHeight: 1.65, color: t.tx, margin: 0 }}>{m.summary}</p></div>}
        {tab === "actions" && m.actionItems.map((it, i) => <div key={i} style={{ padding: "14px 16px", background: t.bgC, borderRadius: 12, border: `1px solid ${t.bd}`, boxShadow: t.sh, display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 8 }}><div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `2px solid ${it.done ? t.ok : t.bd}`, background: it.done ? t.ok : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.done && <I.Check style={{ color: "#fff" }} />}</div><div><p style={{ fontSize: 14, color: t.tx, margin: 0, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? .6 : 1 }}>{it.text}</p><span style={{ fontSize: 12, color: t.tx2 }}>→ {it.assignee}</span></div></div>)}
        {tab === "decisions" && m.keyDecisions.map((d, i) => <div key={i} style={{ padding: "14px 16px", background: t.bgC, borderRadius: 12, border: `1px solid ${t.bd}`, boxShadow: t.sh, display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}><div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: t.lkL, color: t.lk, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{i + 1}</div><p style={{ fontSize: 14, color: t.tx, margin: 0 }}>{d}</p></div>)}
      </div>
      {tab === "transcript" && <Player ct={ct} dur={m.duration} play={play} onPP={() => setPl(!play)} onSeek={setCt} t={t} />}
    </div>
  );
}

// ── Device Manager ─────────────────────────────────────────────────────
function Device({ t, onSelect, meetings }) {
  const [files, setFiles] = useState(DEVICE_FILES);
  const [sel, setSel] = useState([]);
  const [xfer, setXfer] = useState(null);
  const used = files.reduce((a, fl) => a + parseFloat(fl.size), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ padding: "20px 24px", background: t.bgC, borderRadius: 14, border: `1px solid ${t.bd}`, boxShadow: t.sh, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}><div style={{ width: 50, height: 50, borderRadius: 14, background: t.okL, display: "flex", alignItems: "center", justifyContent: "center" }}><I.Usb style={{ color: t.ok }} /></div><div><h3 style={{ fontSize: 16, fontWeight: 600, color: t.tx, margin: 0 }}>Hidock P1 Device</h3><div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: t.ok }} /><span style={{ fontSize: 13, color: t.tx2 }}>Connected via USB</span></div></div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, color: t.tx2, marginBottom: 6 }}>{used.toFixed(1)} MB / 512 MB</div><div style={{ width: 200, height: 6, borderRadius: 3, background: t.bgA, overflow: "hidden" }}><div style={{ width: `${(used / 512) * 100}%`, height: "100%", background: t.lk, borderRadius: 3 }} /></div></div>
      </div>
      {sel.length > 0 && <div style={{ display: "flex", gap: 8, padding: "10px 16px", background: t.acL, borderRadius: 8, alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 500, color: t.ac, flex: 1 }}>{sel.length} selected</span><button style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", background: t.ac, color: t.acT, cursor: "pointer" }}>Transfer</button><button style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", background: t.err, color: "#fff", cursor: "pointer" }}>Delete</button></div>}
      <div style={{ background: t.bgC, borderRadius: 14, border: `1px solid ${t.bd}`, boxShadow: t.sh, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 90px 110px 90px 100px", padding: "10px 16px", borderBottom: `1px solid ${t.bd}`, fontSize: 11, fontWeight: 600, color: t.txM, textTransform: "uppercase", letterSpacing: "0.05em" }}><div /><div>Filename</div><div>Size</div><div>Date</div><div>Duration</div><div>Status</div></div>
        {files.map(fl => (
          <div key={fl.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr 90px 110px 90px 100px", padding: "12px 16px", borderBottom: `1px solid ${t.bdL}`, alignItems: "center", transition: "background 0.1s" }} onMouseEnter={e => e.currentTarget.style.background = t.bgH} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <input type="checkbox" checked={sel.includes(fl.id)} onChange={() => setSel(p => p.includes(fl.id) ? p.filter(x => x !== fl.id) : [...p, fl.id])} style={{ accentColor: t.ac }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><I.FileText style={{ color: t.txM }} /><span style={{ fontSize: 13, fontWeight: 500, color: t.tx }}>{fl.name}</span></div>
            <span style={{ fontSize: 13, color: t.tx2 }}>{fl.size}</span><span style={{ fontSize: 12, color: t.tx2 }}>{f.date(fl.date)}</span><span style={{ fontSize: 13, color: t.tx2 }}>{f.dur(fl.duration)}</span>
            <div>{fl.transferred ? <button onClick={() => { const m = meetings.find(x => x.id === fl.meetingId); if (m) onSelect(m); }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, border: "none", background: t.okL, color: t.ok, cursor: fl.meetingId ? "pointer" : "default" }}>Processed</button> : xfer === fl.id ? <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, background: t.warnL, color: t.warn }}>Transferring...</span> : <button onClick={() => { setXfer(fl.id); setTimeout(() => { setFiles(p => p.map(x => x.id === fl.id ? { ...x, transferred: true } : x)); setXfer(null); }, 2000); }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, border: `1px solid ${t.bd}`, background: "transparent", color: t.lk, cursor: "pointer" }}>Transfer</button>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────
function Sett({ t }) {
  const [ai, setAi] = useState("claude-sonnet"); const [ax, setAx] = useState(true); const [lg, setLg] = useState("en"); const [sp, setSp] = useState(true); const [nt, setNt] = useState(true);
  const Tog = ({ v, set }) => <div onClick={() => set(!v)} style={{ width: 44, height: 24, borderRadius: 12, padding: 2, cursor: "pointer", background: v ? t.ac : t.bgA, transition: "background 0.2s", display: "flex", alignItems: "center" }}><div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", transform: v ? "translateX(20px)" : "translateX(0)", transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} /></div>;
  const Sel = ({ v, set, opts }) => <select value={v} onChange={e => set(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, border: `1px solid ${t.bd}`, background: t.bgI, color: t.tx, outline: "none", cursor: "pointer" }}>{opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
  const Sec = ({ title, ch }) => <div style={{ padding: "20px 24px", background: t.bgC, borderRadius: 14, border: `1px solid ${t.bd}`, boxShadow: t.sh }}><h3 style={{ fontSize: 15, fontWeight: 600, color: t.tx, margin: "0 0 16px" }}>{title}</h3><div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{ch}</div></div>;
  const Row = ({ label, desc, ch }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 14, color: t.tx, fontWeight: 500 }}>{label}</div>{desc && <div style={{ fontSize: 12, color: t.tx2, marginTop: 2 }}>{desc}</div>}</div>{ch}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <Sec title="Device" ch={<><Row label="Auto-transfer recordings" desc="Transfer on device connect" ch={<Tog v={ax} set={setAx} />} /><Row label="Save location" desc="/Users/nilesh/Documents/FieldNote" ch={<button style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, border: `1px solid ${t.bd}`, background: "transparent", color: t.lk, cursor: "pointer" }}>Change</button>} /></>} />
      <Sec title="AI Processing" ch={<><Row label="AI Model" desc="Transcription & summarization" ch={<Sel v={ai} set={setAi} opts={[{ v: "claude-sonnet", l: "Claude Sonnet 4" }, { v: "gpt-4o", l: "GPT-4o" }, { v: "whisper-large", l: "Whisper Large v3" }]} />} /><Row label="Speaker detection" desc="Auto-identify speakers" ch={<Tog v={sp} set={setSp} />} /><Row label="Language" desc="Primary transcription language" ch={<Sel v={lg} set={setLg} opts={[{ v: "en", l: "English" }, { v: "hi", l: "Hindi" }, { v: "es", l: "Spanish" }, { v: "auto", l: "Auto-detect" }]} />} /><Row label="Accepted formats" desc="WAV, MP3, M4A, OGG, FLAC, WebM, AAC — up to 500MB" ch={<span style={{ fontSize: 12, color: t.txM }}>9 formats</span>} /></>} />
      <Sec title="Integrations" ch={<>{["Google Calendar", "Slack", "Notion"].map(n => <Row key={n} label={n} desc={`Connect ${n}`} ch={<button style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", background: t.ac, color: t.acT, cursor: "pointer" }}>Connect</button>} />)}</>} />
      <Sec title="Notifications" ch={<Row label="Desktop notifications" desc="Notify on processing complete" ch={<Tog v={nt} set={setNt} />} />} />
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────
export default function App() {
  const [dk, setDk] = useState(false);
  const [pg, setPg] = useState("dash");
  const [mtg, setMtg] = useState(null);
  const [q, setQ] = useState("");
  const [srch, setSrch] = useState(false);
  const [imp, setImp] = useState(false);
  const t = dk ? DT : LT;
  const go = (m) => { setMtg(m); setPg("detail"); };
  const nav = [{ id: "dash", label: "Meetings", icon: <I.Home /> }, { id: "dev", label: "Device", icon: <I.HardDrive /> }, { id: "set", label: "Settings", icon: <I.Settings /> }];
  useEffect(() => { const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSrch(true); } if (e.key === "Escape") { setSrch(false); setImp(false); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: t.bg, color: t.tx, fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", transition: "background 0.3s,color 0.3s" }}>
      {/* Sidebar */}
      <div style={{ width: 230, flexShrink: 0, background: dk ? t.bgSb : "#191F45", borderRight: `1px solid ${dk ? t.bd : "#151b3a"}`, display: "flex", flexDirection: "column", padding: "16px 12px", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: dk ? t.ac : "#AD4E1A", display: "flex", alignItems: "center", justifyContent: "center" }}><I.Mic style={{ color: "#fff", width: 18, height: 18 }} /></div>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: dk ? t.tx : "#fff", letterSpacing: "-0.02em" }}>FieldNote</div><div style={{ fontSize: 9, color: dk ? t.txM : "#A3BDD3", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Hidock P1 Edition</div></div>
        </div>
        <div onClick={() => setSrch(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${dk ? t.bd : "#2a305a"}`, cursor: "pointer", margin: "0 2px 8px", background: dk ? t.bgC : "#1e2450" }}>
          <I.Search style={{ color: dk ? t.txM : "#A3BDD3" }} /><span style={{ flex: 1, fontSize: 13, color: dk ? t.txM : "#A3BDD3" }}>Search</span><kbd style={{ fontSize: 10, color: dk ? t.txM : "#A3BDD3", background: dk ? t.bgA : "#2a305a", padding: "2px 6px", borderRadius: 4 }}>⌘K</kbd>
        </div>
        {nav.map(n => { const a = pg === n.id || (pg === "detail" && n.id === "dash"); const c = dk ? { t: t.tx2, a: t.tx, bg: t.bgA, h: t.bgH } : { t: "#A3BDD3", a: "#fff", bg: "#2a305a", h: "#222856" }; return (
          <button key={n.id} onClick={() => { setPg(n.id); if (n.id !== "dash") setMtg(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, background: a ? c.bg : "transparent", color: a ? c.a : c.t, width: "100%", textAlign: "left" }}
            onMouseEnter={e => { if (!a) e.currentTarget.style.background = c.h }} onMouseLeave={e => { if (!a) e.currentTarget.style.background = "transparent" }}>{n.icon} {n.label}</button>); })}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 12px", borderRadius: 8, background: dk ? t.bgA : "#222856", display: "flex", alignItems: "center", gap: 8, margin: "0 2px" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: dk ? t.ok : "#5cb86b" }} /><span style={{ fontSize: 12, color: dk ? t.tx2 : "#A3BDD3", flex: 1 }}>Hidock P1</span><I.Usb style={{ color: dk ? t.txM : "#A3BDD3", width: 14, height: 14 }} /></div>
        <button onClick={() => setDk(!dk)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, background: "transparent", color: dk ? t.tx2 : "#A3BDD3", width: "100%", marginTop: 4 }}>{dk ? <I.Sun /> : <I.Moon />} {dk ? "Light mode" : "Dark mode"}</button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {pg !== "detail" && <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: t.tx, margin: 0, letterSpacing: "-0.025em" }}>{pg === "dash" ? "Meetings" : pg === "dev" ? "Device Manager" : "Settings"}</h1>
            {pg === "dash" && <button onClick={() => setImp(true)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", background: t.ac, color: t.acT, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px rgba(173,78,26,0.25)" }}><I.Upload /> Import Recording</button>}
          </div>}
          {pg === "dash" && <Dashboard meetings={MEETINGS} onSelect={go} t={t} q={q} />}
          {pg === "detail" && mtg && <Detail m={mtg} onBack={() => { setPg("dash"); setMtg(null); }} t={t} />}
          {pg === "dev" && <Device t={t} onSelect={go} meetings={MEETINGS} />}
          {pg === "set" && <Sett t={t} />}
        </div>
      </div>

      {/* Search */}
      {srch && <div onClick={() => setSrch(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh", zIndex: 1000, backdropFilter: "blur(6px)" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 560, background: t.bgC, borderRadius: 16, border: `1px solid ${t.bd}`, boxShadow: dk ? DT.shL : "0 24px 80px rgba(25,31,69,0.25)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${t.bd}` }}><I.Search style={{ color: t.txM }} /><input autoFocus placeholder="Search meetings, transcripts..." value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", color: t.tx }} /><kbd onClick={() => setSrch(false)} style={{ fontSize: 11, color: t.txM, background: t.bgA, padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>ESC</kbd></div>
          <div style={{ maxHeight: 400, overflow: "auto", padding: 8 }}>{MEETINGS.filter(m => !q || m.title.toLowerCase().includes(q.toLowerCase()) || m.summary.toLowerCase().includes(q.toLowerCase()) || m.tags.some(x => x.toLowerCase().includes(q.toLowerCase())) || m.transcript.some(l => l.text.toLowerCase().includes(q.toLowerCase()))).map(m => <div key={m.id} onClick={() => { go(m); setSrch(false); setQ(""); }} style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = t.bgH} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><div style={{ fontSize: 14, fontWeight: 500, color: t.tx }}>{m.title}</div><div style={{ fontSize: 12, color: t.tx2, marginTop: 2 }}>{f.date(m.date)} · {f.dur(m.duration)} · {m.folder}</div></div>)}</div>
        </div>
      </div>}

      {/* Import Wizard */}
      {imp && <ImportWizard t={t} dk={dk} onClose={() => setImp(false)} onComplete={(data) => console.log("Import complete:", data)} />}
    </div>
  );
}
