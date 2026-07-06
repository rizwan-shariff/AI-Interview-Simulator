/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Video,
  Timer,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Sparkles,
  Play,
  CheckCircle,
  AlertTriangle,
  History,
  LayoutDashboard,
  LogOut,
  HelpCircle,
  Plus,
  Compass,
  FileText,
  Volume2,
  VolumeX,
  Keyboard,
  Info,
  Loader2,
  Trash2,
  Camera,
} from "lucide-react";

import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs-backend-webgl";

import { InterviewConfig, Question, Evaluation, InterviewRound, Session } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://ai-interview-simulator-1-rslz.onrender.com";

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

// Preset Job Descriptions for quick loading
const PRESET_JDS = [
  {
    title: "Google: Software Engineer (L4)",
    text: "Seeking a strong SWE to design scalable distributed systems using Go/C++ and optimize backend performance. Must have excellent algorithmic problem-solving skills and system design knowledge.",
  },
  {
    title: "Meta: Front-End Engineer",
    text: "Looking for an expert React developer to build high-performance, dynamic UIs. Deep knowledge of JavaScript, state management, and web performance optimization required.",
  },
  {
    title: "Amazon: AWS Cloud Architect",
    text: "Seeking a cloud expert to design highly available, scalable AWS infrastructures. Must have deep experience with EC2, Lambda, DynamoDB, and infrastructure-as-code practices.",
  },
  {
    title: "Stripe: Backend API Engineer",
    text: "Looking for a backend engineer with strong REST/GraphQL API design skills and a deep understanding of PostgreSQL and Redis. Security-first mindset is essential.",
  },
  {
    title: "OpenAI: AI/ML Engineer",
    text: "Seeking an ML engineer to optimize and deploy large language models. Strong Python, PyTorch experience, and understanding of transformer architectures and RAG systems required.",
  },
  {
    title: "Apple: iOS Swift Developer",
    text: "Seeking an experienced iOS engineer to build elegant, high-performance applications using Swift and SwiftUI. Deep understanding of memory management and UI/UX guidelines needed.",
  },
];

let cachedCocoModel: cocoSsd.ObjectDetection | null = null;

export default function App() {
  const [view, setView] = useState<"setup" | "live" | "dashboard" | "history">("setup");
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  
  // Setup States
  const [config, setConfig] = useState<InterviewConfig>({
    jobDescription: PRESET_JDS[0].text,
    experienceLevel: "Senior",
    numQuestions: 5,
  });
  
  // Status check state
  const [backendStatus, setBackendStatus] = useState<{ hasGeminiKey: boolean; mode: string }>({
    hasGeminiKey: false,
    mode: "demo_fallback",
  });

  // App Initialization: Load past sessions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("aura_session_history");
    if (saved) {
      try {
        setSessionHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse session history", e);
      }
    }

    // Fetch backend configuration status
    fetch(`${API_BASE_URL}/api/status`)
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus({
          hasGeminiKey: data.hasGeminiKey,
          mode: data.mode,
        });
      })
      .catch((e) => console.error("Failed to fetch backend status", e));
  }, []);

  // Save history helper
  const saveSessionHistory = (newHistory: Session[]) => {
    setSessionHistory(newHistory);
    localStorage.setItem("aura_session_history", JSON.stringify(newHistory));
  };

  const startNewSession = (customConfig: InterviewConfig) => {
    const newSession: Session = {
      id: "session_" + Date.now(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      config: { ...customConfig },
      rounds: [],
      completed: false,
      durationSeconds: 0,
    };
    setCurrentSession(newSession);
    setView("live");
  };

  const deleteSession = (sessionId: string) => {
    const updated = sessionHistory.filter((s) => s.id !== sessionId);
    saveSessionHistory(updated);
  };

  const selectPastSession = (session: Session) => {
    setCurrentSession(session);
    setView("dashboard");
  };

  return (
    <div className="bg-[#050505] text-[#e5e2e1] min-h-screen flex flex-col font-sans relative overflow-x-hidden selection:bg-primary/30 selection:text-white">
      {/* Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid w-full h-full opacity-60"></div>
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px] mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] mix-blend-screen"></div>
      </div>

      {view === "setup" && (
        <SetupView
          config={config}
          setConfig={setConfig}
          onStart={startNewSession}
          historyCount={sessionHistory.length}
          backendStatus={backendStatus}
          onNavigateHistory={() => setView("history")}
        />
      )}

      {view === "live" && currentSession && (
        <LiveView
          session={currentSession}
          setSession={setCurrentSession}
          onEndSession={(finalSession) => {
            const updatedHistory = [finalSession, ...sessionHistory];
            saveSessionHistory(updatedHistory);
            setCurrentSession(finalSession);
            setView("dashboard");
          }}
          onAbort={() => {
            setCurrentSession(null);
            setView("setup");
          }}
        />
      )}

      {view === "dashboard" && currentSession && (
        <DashboardView
          session={currentSession}
          onNewSession={() => setView("setup")}
          onViewHistory={() => setView("history")}
        />
      )}

      {view === "history" && (
        <HistoryListView
          history={sessionHistory}
          onSelect={selectPastSession}
          onDelete={deleteSession}
          onBack={() => setView("setup")}
        />
      )}
    </div>
  );
}

/* ============================================================================
   VIEW 1: SETUPVIEW
   ============================================================================ */
interface SetupViewProps {
  config: InterviewConfig;
  setConfig: React.Dispatch<React.SetStateAction<InterviewConfig>>;
  onStart: (config: InterviewConfig) => void;
  historyCount: number;
  backendStatus: { hasGeminiKey: boolean; mode: string };
  onNavigateHistory: () => void;
}

function SetupView({ config, setConfig, onStart, historyCount, backendStatus, onNavigateHistory }: SetupViewProps) {
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectPreset = (text: string) => {
    setConfig((prev) => ({ ...prev, jobDescription: text }));
  };

  const handleInitialize = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }

    setLoadingQuestions(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: config.jobDescription,
          experienceLevel: config.experienceLevel,
          numQuestions: config.numQuestions,
        }),
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        onStart({
          ...config,
          // Save generated questions in the active flow
        });
      } else {
        throw new Error("No questions generated from API");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage("Could not connect to service. Launching with local fallback mode.");
      // Auto fallback launch after small delay
      setTimeout(() => {
        onStart(config);
      }, 1500);
    } finally {
      setLoadingQuestions(false);
    }
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col min-h-screen">
      {/* Top Banner Header */}
      <header className="w-full flex justify-between items-center px-6 md:px-12 h-20 bg-[#050505]/40 backdrop-blur-3xl border-b border-white/10 shadow-[0_0_20px_rgba(173,198,255,0.05)]">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold tracking-tight text-primary">Interview Simulator</span>
        </div>
        <div className="flex items-center gap-4">
          {historyCount > 0 && (
            <button
              onClick={onNavigateHistory}
              className="px-4 py-2 text-sm text-on-surface-variant hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition-all flex items-center gap-2"
            >
              <History size={16} />
              <span>Past Sessions ({historyCount})</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${backendStatus.hasGeminiKey ? "bg-emerald-500 animate-pulse" : "bg-yellow-500"}`}></span>
            <span className="opacity-80">{backendStatus.hasGeminiKey ? "Live Gemini Active" : "Local Demo Fallback"}</span>
          </div>
        </div>
      </header>

      {/* Hero Banner Grid */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 md:py-12 py-6 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Description */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-mono tracking-widest uppercase">
              <Sparkles size={12} />
              <span>Cinematic AI Intelligence</span>
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Master the technical interview with <span className="text-primary glow-text">Interview Simulator</span>
            </h1>
            
            <p className="text-on-surface-variant text-base leading-relaxed opacity-90">
              Interview Simulator is a high-fidelity interactive mock interviewer that speaks, listens, and delivers professional insights in a cinematic cockpit design. Build confidence with customizable job roles, live answer tracking, and detailed performance scorecards.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5 text-primary text-xs font-bold">1</div>
                <div>
                  <h4 className="font-bold text-sm text-white">Customize Experience</h4>
                  <p className="text-xs text-on-surface-variant">Paste any custom job description or select one of our curated tech presets.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5 text-primary text-xs font-bold">2</div>
                <div>
                  <h4 className="font-bold text-sm text-white">Interactive Live Engine</h4>
                  <p className="text-xs text-on-surface-variant">Simulate high-stakes environments using webcam perspectives, speech transcripts, and active timers.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mt-0.5 text-primary text-xs font-bold">3</div>
                <div>
                  <h4 className="font-bold text-sm text-white">Expert Evaluation Panel</h4>
                  <p className="text-xs text-on-surface-variant">Review dynamic metric breakdown scores (Technical, Clarity, Confidence) mapped over timeline trajectories.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Configuration Card */}
          <div className="lg:col-span-7">
            <div className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-2xl glow-effect border border-white/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <h3 className="font-display text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
                <BrainCircuit className="text-primary" size={20} />
                <span>Configure Simulator</span>
              </h3>

              {errorMessage && (
                <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-xs text-yellow-400 flex items-start gap-3">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-6">
                {/* Candidate Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      Candidate Name
                    </label>
                    <input
                      type="text"
                      value={config.candidateName || ""}
                      onChange={(e) => setConfig((prev) => ({ ...prev, candidateName: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-all"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      Candidate Email
                    </label>
                    <input
                      type="email"
                      value={config.candidateEmail || ""}
                      onChange={(e) => setConfig((prev) => ({ ...prev, candidateEmail: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      Target Company (Optional)
                    </label>
                    <input
                      type="text"
                      value={config.companyName || ""}
                      onChange={(e) => setConfig((prev) => ({ ...prev, companyName: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-all"
                      placeholder="e.g. Acme Corp..."
                    />
                  </div>
                </div>

                {/* Preset Fast Picker */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Job Description Preset
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_JDS.map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectPreset(preset.text)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          config.jobDescription === preset.text
                            ? "bg-primary/20 text-primary border-primary/50"
                            : "bg-white/5 text-on-surface-variant border-white/5 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main JD Textarea */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-primary" />
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Custom Job Description
                    </label>
                  </div>
                  <textarea
                    value={config.jobDescription}
                    onChange={(e) => setConfig((prev) => ({ ...prev, jobDescription: e.target.value }))}
                    className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary/80 focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-sans leading-relaxed"
                    placeholder="Paste full job description requirements here..."
                  />
                </div>

                {/* Bottom Row controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Experience Level */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      Experience Level
                    </label>
                    <select
                      value={config.experienceLevel}
                      onChange={(e: any) => setConfig((prev) => ({ ...prev, experienceLevel: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-all cursor-pointer"
                    >
                      <option value="Junior" className="bg-neutral-900">Junior (Entry/Associate)</option>
                      <option value="Mid" className="bg-neutral-900">Mid-Level Engineer</option>
                      <option value="Senior" className="bg-neutral-900">Senior Engineer</option>
                      <option value="Lead" className="bg-neutral-900">Lead / Principal / Manager</option>
                    </select>
                  </div>

                  {/* Question Count slider */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Questions Count
                      </label>
                      <span className="text-primary font-mono font-bold text-sm bg-primary/10 px-2.5 py-0.5 rounded-md">
                        {config.numQuestions}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={Math.min(config.numQuestions, 10)}
                        onChange={(e) => setConfig((prev) => ({ ...prev, numQuestions: parseInt(e.target.value) }))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, numQuestions: 10 }))}
                        className="text-[10px] text-primary hover:text-white font-mono opacity-85 hover:underline transition-all shrink-0"
                      >
                        {config.numQuestions >= 10 ? "Custom limit active" : "10 max (Set Custom)"}
                      </button>
                    </div>

                    {config.numQuestions >= 10 && (
                      <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4 transition-all">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-white">Custom Limit Option</span>
                          <span className="text-[10px] text-on-surface-variant opacity-80">Enter custom questions quantity:</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={config.numQuestions}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setConfig((prev) => ({ ...prev, numQuestions: Math.max(1, val) }));
                            }
                          }}
                          className="w-16 bg-black/60 border border-white/20 rounded-lg p-1.5 text-center text-xs font-mono font-bold text-primary focus:border-primary outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  onClick={handleInitialize}
                  disabled={loadingQuestions || !config.jobDescription.trim()}
                  className="w-full mt-4 py-4 rounded-xl btn-primary font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loadingQuestions ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span className="text-white">Analyzing Job Requirements...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" className="text-white" />
                      <span className="text-white">Start Interview Session</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

/* ============================================================================
   VIEW 2: LIVEVIEW
   ============================================================================ */
interface LiveViewProps {
  session: Session;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  onEndSession: (session: Session) => void;
  onAbort: () => void;
}

function LiveView({ session, setSession, onEndSession, onAbort }: LiveViewProps) {
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const snapshotsRef = useRef<Blob[]>([]);

  // Initialize camera stream
  useEffect(() => {
    let isMounted = true;
    let activeStream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!isMounted) {
          // Prevent orphaned streams in React Strict Mode if component unmounted while awaiting permission
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn("Camera access denied or unavailable:", err);
        if (isMounted) setCameraError(err.message || "No camera found");
      }
    }
    startCamera();

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setTypedAnswer(transcript);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  // Snapshot timer (Vision API)
  useEffect(() => {
    const timer = setInterval(() => {
      if (videoRef.current && cameraStream && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) {
                snapshotsRef.current.push(blob);
                // limit to last 20 frames to avoid huge uploads
                if (snapshotsRef.current.length > 20) {
                  snapshotsRef.current.shift();
                }
              }
            }, "image/jpeg", 0.7);
          } catch (e) {
            console.warn("Canvas snapshot failed", e);
          }
        }
      }
    }, 15000); // every 15s
    
    return () => clearInterval(timer);
  }, [cameraStream]);

  // Sync stream to video element when it mounts/updates
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => console.warn("Video auto-play prevented:", e));
      }
    }
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const hasSpokenRoundRef = useRef(-1);
  
  // Anti-Cheat State
  const violationCountRef = useRef(0);
  const lastViolationTimeRef = useRef(0);
  const cheatWarningDataRef = useRef<{ title: string; message: string } | null>(null);
  const [cheatWarningData, setCheatWarningData] = useState<{ title: string; message: string } | null>(null);
  const cheatEvidenceRef = useRef<string | null>(null);
  const cheatReasonRef = useRef<string | null>(null);
  const violationsListRef = useRef<{ reason: string; evidence?: string; timestamp: string }[]>([]);
  
  // Timer State
  const [seconds, setSeconds] = useState(0);
  
  // Input answer state
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [isAITalking, setIsAITalking] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState("");

  // Voice/Record State Simulation
  const [isRecording, setIsRecording] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState<number[]>(Array(10).fill(5));
  const [isMuted, setIsMuted] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [showSecurityBriefing, setShowSecurityBriefing] = useState(true);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load / Generate Questions
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/generate-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobDescription: session.config.jobDescription,
            experienceLevel: session.config.experienceLevel,
            numQuestions: session.config.numQuestions,
          }),
        });
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          const mapped: Question[] = data.questions.map((qText: string, idx: number) => ({
            id: idx + 1,
            text: qText,
          }));
          setQuestions(mapped);
          
          // Seed initial round structure
          const initialRounds: InterviewRound[] = mapped.map((q) => ({
            questionId: q.id,
            questionText: q.text,
            answerText: "",
          }));
          setSession((prev) => prev ? { ...prev, rounds: initialRounds } : null);
        } else {
          throw new Error("Empty questions generated");
        }
      } catch (e) {
        console.warn("Generating mock questions locally:", e);
        // Fallback list
        const backupList = [
          "Explain your core experience working with large-scale applications and your primary architecture choice.",
          "Describe how you handle conflict resolution and technical disagreements within an agile project team.",
          "What is your approach to measuring performance metrics, bottlenecks, and optimizing rendering latency?",
          "How do you design secure APIs and protect client-server communication from typical vulnerability vectors?",
          "Can you walk us through a complex system design or deployment lifecycle you led from start to finish?",
        ].slice(0, session.config.numQuestions);

        const mapped: Question[] = backupList.map((qText, idx) => ({
          id: idx + 1,
          text: qText,
        }));
        setQuestions(mapped);
        const initialRounds: InterviewRound[] = mapped.map((q) => ({
          questionId: q.id,
          questionText: q.text,
          answerText: "",
        }));
        setSession((prev) => prev ? { ...prev, rounds: initialRounds } : null);
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, []);

  // Timer counter
  useEffect(() => {
    if (loadingQuestions) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loadingQuestions]);

  // Voice output triggered on new questions
  useEffect(() => {
    if (loadingQuestions || showSecurityBriefing || questions.length === 0 || currentRoundIndex >= questions.length) return;
    
    if (hasSpokenRoundRef.current !== currentRoundIndex) {
      hasSpokenRoundRef.current = currentRoundIndex;
      const currentQuestion = questions[currentRoundIndex];
      // small timeout to prevent strict mode race conditions with window.speechSynthesis
      setTimeout(() => triggerAISpeech(currentQuestion.text), 50);
    }
  }, [loadingQuestions, showSecurityBriefing, currentRoundIndex, questions]);

  // Simulate Soundwaves when recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setVoiceVolume(Array(15).fill(0).map(() => Math.floor(Math.random() * 80) + 10));
      }, 100);
    } else {
      setVoiceVolume(Array(15).fill(4));
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const triggerAISpeech = async (text: string) => {
    if (!isTtsEnabled) {
      setIsAITalking(false);
      simulateSubtitleEffect(text);
      return;
    }

    simulateSubtitleEffect(text);
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

    const playNativeFemaleVoice = (textToSpeak: string) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.lang.startsWith("en") && 
        (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Victoria") || v.name.includes("Zira") || v.name.includes("Karen") || v.name.includes("Moira"))
      ) || voices.find(v => v.lang.startsWith("en")); // fallback to any English voice
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 0.95;
      utterance.pitch = 1.1; // force higher pitch for female approximation
      utterance.onstart = () => setIsAITalking(true);
      utterance.onend = () => setIsAITalking(false);
      utterance.onerror = () => setIsAITalking(false);
      window.speechSynthesis.speak(utterance);
    };

    if (!apiKey) {
      console.warn("No ElevenLabs API key found. Falling back to native TTS.");
      playNativeFemaleVoice(text);
      return;
    }

    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }

      setIsAITalking(true);
      const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Bella
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2_5", // Use turbo to prevent hallucination/mismatch
          voice_settings: { stability: 0.25, similarity_boost: 0.95, style: 0.5 }
        })
      });
      
      if (!res.ok) throw new Error("ElevenLabs API failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      
      audio.onended = () => { setIsAITalking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsAITalking(false); URL.revokeObjectURL(url); };
      
      audio.play().catch(e => {
        console.warn("Audio auto-play failed", e);
        playNativeFemaleVoice(text);
      });
    } catch (e) {
      console.warn("ElevenLabs TTS error:", e);
      playNativeFemaleVoice(text);
    }
  };

  const triggerWarningSpeech = async (message: string) => {
    if (!isTtsEnabled) return;
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    const warningText = message + ". Warning: One more violation will automatically submit and terminate your interview session.";
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

    const playNativeFemaleWarning = (textToSpeak: string) => {
      if (!window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        v.lang.startsWith("en") && 
        (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Victoria") || v.name.includes("Zira") || v.name.includes("Karen") || v.name.includes("Moira"))
      ) || voices.find(v => v.lang.startsWith("en"));
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.onstart = () => setIsAITalking(true);
      utterance.onend = () => setIsAITalking(false);
      utterance.onerror = () => setIsAITalking(false);
      window.speechSynthesis.speak(utterance);
    };

    if (!apiKey) {
      playNativeFemaleWarning(warningText);
      return;
    }

    try {
      setIsAITalking(true);
      const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Bella
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          text: warningText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.25, similarity_boost: 0.95, style: 0.5 }
        })
      });
      
      if (!res.ok) throw new Error("ElevenLabs API failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      
      audio.onended = () => { setIsAITalking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsAITalking(false); URL.revokeObjectURL(url); };
      audio.play().catch(e => { playNativeFemaleWarning(warningText); });
    } catch (e) {
      console.warn("ElevenLabs TTS warning error:", e);
      playNativeFemaleWarning(warningText);
    }
  };

  const simulateSubtitleEffect = (text: string) => {
    // Reveal text in chunks to represent live talking
    setCurrentTranscription("");
    const words = text.split(" ");
    let currentIdx = 0;
    
    const timer = setInterval(() => {
      if (currentIdx < words.length) {
        setCurrentTranscription(prev => prev + (prev ? " " : "") + words[currentIdx]);
        currentIdx++;
      } else {
        clearInterval(timer);
      }
    }, 150);
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleToggleTts = () => {
    const nextState = !isTtsEnabled;
    setIsTtsEnabled(nextState);
    if (!nextState && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsAITalking(false);
    } else if (nextState && questions[currentRoundIndex]) {
      triggerAISpeech(questions[currentRoundIndex].text);
    }
  };

  const handleStartRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      // Auto-submit the answer directly
      setTimeout(() => {
        if (typedAnswer.trim() !== "") {
          handleSubmitCandidateAnswer(typedAnswer);
        }
      }, 500);
    } else {
      setIsRecording(true);
      setTypedAnswer("");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Speech Recognition already started", e);
        }
      } else {
        alert("Speech Recognition not supported in this browser.");
        setIsRecording(false);
      }
    }
  };

  const handleUpdateSidebarSession = (newConfig: InterviewConfig) => {
    setSession((prev) => prev ? { ...prev, config: newConfig } : null);
    setIsSidebarOpen(false);
    // Restart active question fetch with new parameters
    // In actual system, we'd regenerate. Let's show visual feedback
  };

  const handleSubmitCandidateAnswer = async (overrideAnswer?: string) => {
    const finalAnswer = overrideAnswer || typedAnswer;
    if (!finalAnswer.trim()) return;
    
    setSubmittingAnswer(true);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel(); // Mute AI before submission
    }

    const currentQuestion = questions[currentRoundIndex];
    const candidateAnswer = finalAnswer;

    try {
      // Evaluate current answer dynamically via server-side Gemini
      const res = await fetch(`${API_BASE_URL}/api/evaluate-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.text,
          answer: candidateAnswer,
          jobDescription: session.config.jobDescription,
          experienceLevel: session.config.experienceLevel,
        }),
      });
      const data = await res.json();
      
      let updatedRounds: InterviewRound[] = [];
      // Append evaluation to current session rounds
      setSession((prev) => {
        if (!prev) return null;
        updatedRounds = [...prev.rounds];
        updatedRounds[currentRoundIndex] = {
          questionId: currentQuestion.id,
          questionText: currentQuestion.text,
          answerText: candidateAnswer,
          evaluation: data.evaluation,
        };
        return {
          ...prev,
          rounds: updatedRounds,
        };
      });

      // Clear answer states and proceed
      setTypedAnswer("");
      setShowKeyboard(false);

      if (currentRoundIndex + 1 < questions.length) {
        setCurrentRoundIndex((prev) => prev + 1);
      } else {
        // All questions answered, end interview and generate dashboard summary!
        handleCompleteInterview(updatedRounds);
      }
    } catch (e) {
      console.error("Evaluation submission failed", e);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const [isFinishingSession, setIsFinishingSession] = useState(false);

  // Auto-sync active question with AI voice whenever we move to a new round
  useEffect(() => {
    // End interview automatically if we've passed the final question
    if (!loadingQuestions && questions.length > 0 && currentRoundIndex >= questions.length) {
      handleCompleteInterview();
    }
  }, [currentRoundIndex, questions, loadingQuestions]);

  const handleCompleteInterview = async (latestRounds?: InterviewRound[]) => {
    setSubmittingAnswer(true);
    setIsFinishingSession(true);
    
    // Grab latest session rounds state
    let finalRounds = latestRounds || (session ? [...session.rounds] : []);
    // Fill any missing answers if they skipped or ended prematurely
    finalRounds = finalRounds.map((round, idx) => {
      if (!round.answerText) {
        return {
          ...round,
          answerText: "Skipped / No response recorded.",
          evaluation: {
            technicalScore: 10,
            communicationScore: 10,
            confidenceScore: 10,
            feedback: "No candidate response captured during this round.",
            suggestions: "Practice articulating complete answers for all questions to demonstrate your expertise.",
          },
        };
      }
      return round;
    });

    const hasAnyRealAnswers = finalRounds.some(r => r.answerText !== "Skipped / No response recorded.");
    
    if (!hasAnyRealAnswers) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      // Force skip to fallback immediately to prevent infinite API stall
      const finishedSession: Session = {
        ...session,
        rounds: finalRounds,
        completed: true,
        durationSeconds: seconds,
        overallScore: cheatReasonRef.current ? 0 : 82,
        keyTakeaways: {
          strengths: ["Clear structure used during the architectural trade-offs questions.", "Maintained professional posture and solid active listening characteristics."],
          opportunities: ["Deepen discussion around automated test architectures and specific metrics.", "Utilize STAR methodology metrics on all communication scenarios."],
        },
        trajectory: [75, 82, 80, 88],
        bodyLanguageScore: 85,
        bodyLanguageFeedback: "Good eye contact, but try to remain more centered in the frame.",
        cheatEvidence: cheatEvidenceRef.current || undefined,
        cheatReason: cheatReasonRef.current || undefined
      };
      onEndSession(finishedSession);
      setSubmittingAnswer(false);
      setIsFinishingSession(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s hard timeout

    try {
      // 1. Get summary
      const res = await fetch(`${API_BASE_URL}/api/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rounds: finalRounds,
          jobDescription: session.config.jobDescription,
          experienceLevel: session.config.experienceLevel,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      
      // 2. Evaluate Body Language (Vision API)
      let bodyLanguageScore = 80;
      let bodyLanguageFeedback = "Excellent presence.";
      
      if (snapshotsRef.current.length > 0) {
        const formData = new FormData();
        snapshotsRef.current.forEach((blob, idx) => {
          formData.append("images", blob, `snapshot_${idx}.jpg`);
        });
        
        try {
          const visionRes = await fetch(`${API_BASE_URL}/api/evaluate-body-language`, {
            method: "POST",
            body: formData,
          });
          const visionData = await visionRes.json();
          if (visionData.evaluation) {
            bodyLanguageScore = visionData.evaluation.body_language_score * 10 || 80; // Assuming 1-10 scale in backend, converting to 1-100
            bodyLanguageFeedback = visionData.evaluation.feedback || bodyLanguageFeedback;
          }
        } catch (visionErr) {
          console.error("Vision API failed", visionErr);
        }
      }
      
      const finishedSession: Session = {
        ...session,
        rounds: finalRounds,
        completed: true,
        durationSeconds: seconds,
        overallScore: cheatReasonRef.current ? 0 : (data.summary?.overallScore || 82),
        keyTakeaways: {
          strengths: data.summary?.strengths || ["Completed Interview Session"],
          opportunities: data.summary?.opportunities || ["Ensure all answers are detailed"],
        },
        trajectory: data.summary?.trajectory || [80, 82, 85, 88],
        bodyLanguageScore,
        bodyLanguageFeedback,
        cheatEvidence: cheatEvidenceRef.current || undefined,
        cheatReason: cheatReasonRef.current || undefined,
        violations: violationsListRef.current
      };

      onEndSession(finishedSession);
    } catch (e) {
      console.error("Summary synthesis failed", e);
      // Fallback
      const finishedSession: Session = {
        ...session,
        rounds: finalRounds,
        completed: true,
        durationSeconds: seconds,
        overallScore: cheatReasonRef.current ? 0 : 82,
        keyTakeaways: {
          strengths: ["Clear structure used during the architectural trade-offs questions.", "Maintained professional posture and solid active listening characteristics."],
          opportunities: ["Deepen discussion around automated test architectures and specific metrics.", "Utilize STAR methodology metrics on all communication scenarios."],
        },
        trajectory: [75, 82, 80, 88],
        bodyLanguageScore: 85,
        bodyLanguageFeedback: "Good eye contact, but try to remain more centered in the frame.",
        cheatEvidence: cheatEvidenceRef.current || undefined,
        cheatReason: cheatReasonRef.current || undefined,
        violations: violationsListRef.current
      };
      onEndSession(finishedSession);
    } finally {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      setSubmittingAnswer(false);
      setIsFinishingSession(false);
    }
  };

  const handleCompleteRef = useRef(handleCompleteInterview);
  useEffect(() => {
    handleCompleteRef.current = handleCompleteInterview;
  });

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      setTimeout(() => oscillator.stop(), 300); 
    } catch(e) {
      console.warn("Audio beep failed", e);
    }
  };

  const handleViolationRef = useRef<(title: string, message: string) => void>();
  useEffect(() => {
    handleViolationRef.current = (title: string, message: string) => {
      console.warn("Anti-cheat violation triggered: ", message);
      if (isFinishingSession || submittingAnswer || loadingQuestions) return;

      const now = Date.now();
      if (now - lastViolationTimeRef.current < 6000) return; // 6 seconds cooldown
      lastViolationTimeRef.current = now;

      playBeep();

      let capturedEvidence: string | undefined = undefined;
      // Capture screenshot for the violation
      if (videoRef.current) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Apply mirroring to fix flipped image
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0);
            
            capturedEvidence = canvas.toDataURL("image/jpeg", 0.7);
            // also keep legacy for simple checks
            if (!cheatEvidenceRef.current) {
              cheatEvidenceRef.current = capturedEvidence;
              cheatReasonRef.current = message;
            }
          }
        } catch (e) {
          console.warn("Screenshot capture failed", e);
        }
      }

      violationsListRef.current.push({
        reason: message,
        evidence: capturedEvidence,
        timestamp: new Date().toLocaleTimeString()
      });

      violationCountRef.current += 1;
      const newCount = violationCountRef.current;

      if (newCount === 1) {
        setCheatWarningData({ title, message });
        triggerWarningSpeech(`${title}. ${message}`);
        setTimeout(() => setCheatWarningData(null), 5000);
      } else if (newCount >= 2) {
        setSubmittingAnswer(true); // lock inputs
        setCheatWarningData({ title: "DISQUALIFIED: " + title, message });
        triggerWarningSpeech(`Final strike. ${title}. ${message}. Terminating interview session.`);
        // Give them 4 seconds to see the flashing screen and hear the audio before it unmounts
        setTimeout(() => {
          handleCompleteRef.current();
        }, 4000);
      }
    };
  });

  // Anti-Cheat Monitors (Tab and Fullscreen)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleViolationRef.current?.("TAB SWITCH DETECTED", "Please remain on this tab.");
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolationRef.current?.("FULLSCREEN EXITED", "Please remain in fullscreen mode.");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  // TensorFlow.js Object Detection Anti-Cheat
  useEffect(() => {
    let detectionInterval: NodeJS.Timeout;
    let isActive = true;

    const startDetection = async () => {
      if (!videoRef.current || !cameraStream) return;
      try {
        await tf.ready();
        if (!cachedCocoModel) {
          cachedCocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        }
        const model = cachedCocoModel;
        
        let isDetecting = false;
        detectionInterval = setInterval(async () => {
          if (!isActive || !videoRef.current || isFinishingSession || isDetecting) return;
          
          if (videoRef.current.readyState >= 2) {
            isDetecting = true;
            try {
              const predictions = await model.detect(videoRef.current);
              
              const phonePred = predictions.find(p => p.class === "cell phone" && p.score > 0.2);
              const personPreds = predictions.filter(p => p.class === "person" && p.score > 0.70);
              
              // Console log for debugging the live threshold testing
              if (predictions.length > 0) {
                console.log("TFJS detections:", predictions.map(p => `${p.class} (${Math.round(p.score * 100)}%)`));
              }
              
              if (phonePred) {
                handleViolationRef.current?.("UNAUTHORIZED DEVICE", "Mobile phone detected in frame.");
              } else if (personPreds.length > 1) {
                handleViolationRef.current?.("MULTIPLE PEOPLE DETECTED", "Please ensure you are alone in the room.");
              }
            } finally {
              isDetecting = false;
            }
          }
        }, 500);
      } catch (e) {
        console.warn("TFJS Object Detection error", e);
      }
    };

    if (cameraStream && !isFinishingSession) {
      startDetection();
    }

    return () => {
      isActive = false;
      if (detectionInterval) clearInterval(detectionInterval);
    };
  }, [cameraStream, isFinishingSession]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loadingQuestions) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center space-y-6 glow-effect border border-white/10">
          <Loader2 className="animate-spin text-primary mx-auto" size={48} />
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-white">Generating Persona Session</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Our AI Hiring Manager is reviewing your job description to generate standard tailored questions matching your experience level...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isFinishingSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center space-y-6 glow-effect border border-white/10">
          <Loader2 className="animate-spin text-primary mx-auto" size={48} />
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-white">Synthesizing Performance</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Our AI is analyzing your responses, behavioral indicators, and constructing your final dashboard scorecard. This may take up to 20 seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[currentRoundIndex];

  return (
    <div className="relative z-10 flex-1 flex flex-col h-screen min-h-screen">
      {/* Security Briefing Modal */}
      {showSecurityBriefing && !cheatWarningData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-black/80">
          <div className="bg-black/90 p-8 rounded-3xl max-w-lg w-full text-center shadow-[0_0_80px_rgba(173,198,255,0.15)] border border-primary/30">
            <Info className="text-primary mx-auto mb-4" size={64} />
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-white mb-4 uppercase tracking-widest">
              Security Protocols
            </h2>
            <div className="text-on-surface-variant text-sm md:text-base leading-relaxed space-y-4 text-left bg-white/5 p-6 rounded-2xl border border-white/10">
              <p className="flex items-start gap-3">
                <span className="text-red-400 mt-1">1.</span>
                <span><strong>Stay in Fullscreen:</strong> Exiting fullscreen mode will trigger a strike.</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-red-400 mt-1">2.</span>
                <span><strong>No Devices:</strong> AI Vision detects mobile phones. Using one will trigger a strike.</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-red-400 mt-1">3.</span>
                <span><strong>No Assistance:</strong> Ensure you are alone in a quiet room. Multiple people in frame will trigger a strike.</span>
              </p>
            </div>
            <p className="text-primary mt-6 mb-8 font-bold text-sm bg-primary/10 py-2 rounded-lg">
              Two strikes will result in immediate disqualification.
            </p>
            <button
              onClick={() => {
                setShowSecurityBriefing(false);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(e => console.warn(e));
                }
              }}
              className="w-full py-4 bg-primary text-black rounded-xl font-extrabold text-sm uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg active:scale-95"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      )}

      {/* Anti-Cheat Warning Overlay */}
      {cheatWarningData && (
        <div 
          onClick={() => {
            if (cheatWarningData.title.includes("FULLSCREEN EXITED") && !document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(e => console.warn(e));
            }
          }}
          className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md transition-all ${
            cheatWarningData.title.includes("UNAUTHORIZED DEVICE") ? "bg-red-800/90" : "bg-red-950/90"
          } ${cheatWarningData.title.includes("FULLSCREEN EXITED") ? "cursor-pointer" : ""}`}
        >
          <div className={`bg-red-900/40 p-8 rounded-3xl max-w-xl text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] ${
            cheatWarningData.title.includes("UNAUTHORIZED DEVICE") ? "border-4 border-red-500 scale-110 animate-pulse" : "border-2 border-red-500 animate-pulse"
          }`}>
            <AlertTriangle className={`text-red-500 mx-auto mb-4 ${cheatWarningData.title.includes("UNAUTHORIZED DEVICE") ? "animate-bounce" : ""}`} size={80} />
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-2 uppercase tracking-widest text-red-50">
              {cheatWarningData.title}
            </h2>
            <p className="text-red-200 text-lg md:text-xl leading-relaxed mt-4">
              {cheatWarningData.message}
              <br/>
              <br/>
              <strong className="text-white text-xl bg-red-600/50 px-4 py-2 rounded-xl inline-block border border-red-500 shadow-xl">
                One more violation will automatically submit and terminate your interview session.
              </strong>
            </p>
            {cheatWarningData.title.includes("FULLSCREEN EXITED") && (
              <p className="text-white font-bold mt-6 bg-red-600/50 py-2 px-4 rounded-xl inline-block border border-red-500">
                Click anywhere to return to fullscreen
              </p>
            )}
          </div>
        </div>
      )}

      {/* Config Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-16 bottom-0 w-80 glass-panel backdrop-blur-md border-r border-white/10 z-40 transition-transform duration-300 flex flex-col ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarConfigDrawer
          initialConfig={session.config}
          onUpdate={handleUpdateSidebarSession}
          onClose={() => setIsSidebarOpen(false)}
        />
      </aside>

      {/* Top Navbar */}
      <header className="w-full z-50 flex justify-between items-center px-6 h-16 bg-[#050505]/60 backdrop-blur-3xl border-b border-white/10 shadow-[0_0_20px_rgba(173,198,255,0.08)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 border border-white/10 rounded-lg text-primary transition-all flex items-center justify-center"
            title="Interview Settings"
          >
            <Settings size={18} />
          </button>
          <div className="font-display text-lg font-bold text-primary tracking-tight">Interview AI</div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-on-surface-variant text-xs font-semibold">Active Session</span>
          </div>

          <div className="flex items-center gap-2 text-primary">
            <Timer size={16} />
            <span className="font-mono text-sm tracking-wide font-bold">{formatTime(seconds)}</span>
          </div>

          <div className="h-6 w-[1px] bg-white/10 mx-1"></div>

          <button
            onClick={handleCompleteInterview}
            disabled={submittingAnswer}
            className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main interactive Canvas */}
      <main className="flex-1 p-6 flex flex-col items-center justify-between relative w-full max-w-6xl mx-auto h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Live Feed Container */}
        <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden glass-panel glow-effect shadow-2xl flex items-center justify-center border border-white/10 bg-black/60">
          
          {/* Live Webcam Feed in primary position */}
          {cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-70"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 p-4 text-center z-10">
              <Video size={36} className="text-white/40 mb-2 animate-pulse" />
              <span className="text-xs font-medium opacity-75">
                {cameraError ? "Camera Access Blocked / Unavailable" : "Requesting Camera Access..."}
              </span>
            </div>
          )}

          {/* REC Status Badge with blinking recording symbol */}
          <div className="absolute top-4 left-4 flex items-center gap-2.5 bg-black/55 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 z-20 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 relative">
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"></div>
            </div>
            <span className="font-mono text-[10px] text-white tracking-widest uppercase font-bold">REC</span>
          </div>

          {/* AI TTS Mute Toggle */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-20">
            <button
              onClick={handleToggleTts}
              className={`p-2 rounded-full border transition-all ${
                isTtsEnabled
                  ? "bg-primary/20 border-primary/35 text-primary hover:bg-primary/30"
                  : "bg-white/5 border-white/10 text-on-surface-variant hover:bg-white/10"
              }`}
              title={isTtsEnabled ? "Disable AI Speech" : "Enable AI Speech"}
            >
              {isTtsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          </div>

          {/* Glowing Green Overlay indicating Live camera active */}
          <div className="absolute inset-0 border-[2px] border-emerald-500/10 pointer-events-none rounded-2xl z-10"></div>

          {/* Central Target Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-10">
            <svg fill="none" height="140" viewBox="0 0 200 200" width="140" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 50L10 10L50 10" stroke="#adc6ff" strokeWidth="2" strokeLinecap="round"></path>
              <path d="M190 50L190 10L150 10" stroke="#adc6ff" strokeWidth="2" strokeLinecap="round"></path>
              <path d="M10 150L10 190L50 190" stroke="#adc6ff" strokeWidth="2" strokeLinecap="round"></path>
              <path d="M190 150L190 190L150 190" stroke="#adc6ff" strokeWidth="2" strokeLinecap="round"></path>
              <circle cx="100" cy="100" fill="#adc6ff" r="3"></circle>
            </svg>
          </div>

        </div>

        {/* Question Display Screen */}
        <div className="text-center w-full max-w-4xl py-6 flex-1 flex flex-col justify-center items-center">
          <span className="text-xs font-mono tracking-widest text-primary/70 uppercase mb-3 bg-primary/10 px-3 py-1 rounded-full border border-primary/10">
            Question {currentRoundIndex + 1} of {questions.length}
          </span>
          <h2 className="font-display text-2xl md:text-3.5xl font-bold text-white tracking-tight leading-snug max-w-3xl">
            "{activeQuestion?.text}"
          </h2>
          
          <button
            onClick={() => activeQuestion && triggerAISpeech(activeQuestion.text)}
            className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            title="Read Question Out Loud"
          >
            <Volume2 size={14} className={isAITalking ? "animate-pulse" : ""} />
            <span>{isAITalking ? "Speaking Question..." : "Listen to Question"}</span>
          </button>
        </div>

        {/* Dynamic Transcription / Typed response Review Box */}
        {typedAnswer && (
          <div className="w-full max-w-2xl bg-white/5 border border-white/10 p-4 rounded-xl text-center mb-4 text-xs text-on-surface-variant flex items-center justify-between gap-4">
            <span className="text-left leading-relaxed max-h-16 overflow-y-auto pr-2 flex-1">
              <strong className="text-primary uppercase mr-2 font-mono text-[10px]">Your Answer Draft:</strong>
              {typedAnswer}
            </span>
            <button
              onClick={() => setTypedAnswer("")}
              className="text-xs text-red-400 hover:text-red-300 font-semibold shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Interaction Controls */}
        <div className="w-full max-w-md flex flex-col items-center gap-4 mb-4 relative z-25">
          {showKeyboard ? (
            <div className="w-full bg-[#131313]/90 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Type Your Answer</span>
                <button
                  type="button"
                  onClick={() => setShowKeyboard(false)}
                  className="text-xs text-on-surface-variant hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder="Formulate your response here..."
                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none resize-none font-sans"
                autoFocus
              />
              <button
                onClick={() => handleSubmitCandidateAnswer()}
                disabled={submittingAnswer || !typedAnswer.trim()}
                className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingAnswer ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-on-primary" />
                    <span>Analyzing Answer Quality...</span>
                  </>
                ) : (
                  <span>Submit Answer</span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 w-full justify-center">
              {/* Record Mic Button */}
              <button
                onClick={handleStartRecording}
                disabled={submittingAnswer}
                className="relative group flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-b from-primary to-[#005bc1] shadow-[0_0_30px_rgba(173,198,255,0.25)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                title={isRecording ? "Stop Speech Capture" : "Simulate Microphone Response"}
              >
                {isRecording && <div className="absolute inset-0 rounded-full bg-primary/30 pulse-ring"></div>}
                <div className="absolute inset-1.5 rounded-full border border-white/10"></div>
                <Mic className="text-white z-10" size={24} />
              </button>

              {/* Type Answer Button */}
              <button
                onClick={() => setShowKeyboard(true)}
                disabled={submittingAnswer}
                className="flex items-center gap-2 px-6 py-3.5 rounded-full glass-panel hover:bg-white/10 active:scale-98 transition-all text-white font-mono text-xs uppercase tracking-wider border border-white/10"
              >
                <Keyboard size={14} />
                <span>Type Response</span>
              </button>
            </div>
          )}

          {/* Waveform indicator */}
          <div className="flex items-center justify-center gap-1.5 h-6 opacity-80 pt-2">
            {voiceVolume.map((vol, index) => (
              <span
                key={index}
                className="w-0.5 bg-primary/80 rounded-full transition-all duration-100"
                style={{ height: `${vol}%` }}
              ></span>
            ))}
          </div>

          <p className="text-[10px] text-on-surface-variant font-mono opacity-50 text-center mt-2 max-w-sm">
            {isRecording ? "Listening... Click microphone again to submit." : "Use microphone to dictate and auto-submit, or select keyboard to draft."}
          </p>
        </div>

      </main>
    </div>
  );
}

/* Sidebar slider drawer helper */
interface SidebarConfigDrawerProps {
  initialConfig: InterviewConfig;
  onUpdate: (config: InterviewConfig) => void;
  onClose: () => void;
}
function SidebarConfigDrawer({ initialConfig, onUpdate, onClose }: SidebarConfigDrawerProps) {
  const [localConfig, setLocalConfig] = useState<InterviewConfig>({ ...initialConfig });

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-primary flex items-center gap-2">
          <Settings size={18} />
          <span>Session Config</span>
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-on-surface-variant hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Job Requirements</label>
        <textarea
          value={localConfig.jobDescription}
          onChange={(e) => setLocalConfig((prev) => ({ ...prev, jobDescription: e.target.value }))}
          className="w-full h-40 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-primary outline-none transition-colors resize-none leading-relaxed"
          placeholder="Paste full Job Description requirements..."
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Experience Level</label>
        <select
          value={localConfig.experienceLevel}
          onChange={(e: any) => setLocalConfig((prev) => ({ ...prev, experienceLevel: e.target.value }))}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-primary outline-none transition-colors cursor-pointer"
        >
          <option value="Junior" className="bg-neutral-900">Junior</option>
          <option value="Mid" className="bg-neutral-900">Mid-Level</option>
          <option value="Senior" className="bg-neutral-900">Senior</option>
          <option value="Lead" className="bg-neutral-900">Lead Principal</option>
        </select>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Questions Pool</label>
          <span className="text-primary font-mono font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-md">
            {localConfig.numQuestions}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="10"
            value={Math.min(localConfig.numQuestions, 10)}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, numQuestions: parseInt(e.target.value) }))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <button
            type="button"
            onClick={() => setLocalConfig((prev) => ({ ...prev, numQuestions: 10 }))}
            className="text-[10px] text-primary hover:text-white font-mono opacity-85 hover:underline transition-all shrink-0 font-bold"
          >
            {localConfig.numQuestions >= 10 ? "Custom active" : "Custom"}
          </button>
        </div>

        {localConfig.numQuestions >= 10 && (
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4 transition-all">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white">Custom Limit</span>
              <span className="text-[9px] text-on-surface-variant opacity-80">Type any count:</span>
            </div>
            <input
              type="number"
              min="1"
              max="100"
              value={localConfig.numQuestions}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  setLocalConfig((prev) => ({ ...prev, numQuestions: Math.max(1, val) }));
                }
              }}
              className="w-14 bg-black/60 border border-white/20 rounded-lg p-1 text-center text-xs font-mono font-bold text-primary focus:border-primary outline-none"
            />
          </div>
        )}
      </div>

      <button
        onClick={() => onUpdate(localConfig)}
        className="mt-auto w-full py-3 bg-primary/25 hover:bg-primary/35 border border-primary/30 text-primary rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md"
      >
        Update Persona Questions
      </button>
    </div>
  );
}

/* ============================================================================
   VIEW 3: DASHBOARDVIEW (Performance Analysis Screen)
   ============================================================================ */
interface DashboardViewProps {
  session: Session;
  onNewSession: () => void;
  onViewHistory: () => void;
}

function DashboardView({ session, onNewSession, onViewHistory }: DashboardViewProps) {
  const [hoveredNode, setHoveredNode] = useState<{ index: number; score: number; question: string; feedback: string } | null>(null);

  // Safely compute average scores
  const totalRoundsWithEvaluation = session.rounds.filter((r) => r.evaluation);
  const count = totalRoundsWithEvaluation.length || 1;

  const avgTechnical = Math.round(
    totalRoundsWithEvaluation.reduce((acc, r) => acc + (r.evaluation?.technicalScore || 0), 0) / count
  );
  const avgCommunication = Math.round(
    totalRoundsWithEvaluation.reduce((acc, r) => acc + (r.evaluation?.communicationScore || 0), 0) / count
  );
  const avgConfidence = Math.round(
    totalRoundsWithEvaluation.reduce((acc, r) => acc + (r.evaluation?.confidenceScore || 0), 0) / count
  );
  
  const bodyLanguageScore = session.bodyLanguageScore || 85;

  const calculatedOverallScore = Math.round((avgTechnical + avgCommunication + avgConfidence + bodyLanguageScore) / 4);

  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<{text: string; type: "success" | "error"} | null>(null);
  const dashboardRef = useRef<HTMLElement>(null);

  const handleShareResults = async () => {
    if (!session.config.candidateEmail) {
      setShareMessage({text: "No email provided during setup. (Cannot share)", type: "error"});
      setTimeout(() => setShareMessage(null), 4000);
      return;
    }
    
    setIsSharing(true);
    setShareMessage({text: "Generating High-Res PDF...", type: "success"});
    try {
      if (!dashboardRef.current) throw new Error("Dashboard not rendered");
      
      const canvas = await html2canvas(dashboardRef.current, { scale: 1, useCORS: true, backgroundColor: "#050505" });
      const imgData = canvas.toDataURL("image/jpeg", 0.7);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, Math.min(pdfHeight, pdf.internal.pageSize.getHeight()));
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      
      setShareMessage({text: "Uploading and dispatching email...", type: "success"});
      const res = await fetch(`${API_BASE_URL}/api/share-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.config.candidateEmail,
          name: session.config.candidateName || "Candidate",
          company: session.config.companyName || "Your Target Company",
          pdfBase64: pdfBase64,
          score: calculatedOverallScore
        })
      });
      
      if (!res.ok) throw new Error("Backend API failed");
      
      setShareMessage({text: "PDF Results emailed successfully!", type: "success"});
      setTimeout(() => setShareMessage(null), 5000);
    } catch (e) {
      console.error(e);
      setShareMessage({text: "Error generating or sending PDF.", type: "error"});
      setTimeout(() => setShareMessage(null), 5000);
    } finally {
      setIsSharing(false);
    }
  };

  // Progress circle dashboard stroke offsets
  const getStrokeOffset = (score: number) => {
    // stroke-dasharray is 251.2 representing 100%
    const percentage = score / 100;
    return 251.2 - 251.2 * percentage;
  };

  // Trajectory SVG points plotter (Actual Question-by-Question Scores)
  const validRounds = session.rounds.filter(r => r.evaluation);
  const dataPoints = validRounds.length > 0 
    ? validRounds.map(r => Math.round(((r.evaluation?.technicalScore || 0) + (r.evaluation?.communicationScore || 0) + (r.evaluation?.confidenceScore || 0)) / 3))
    : [80, 85, 82, 88];
    
  const svgWidth = 800;
  const svgHeight = 200;
  
  const pathParts = dataPoints.map((val, idx) => {
    const cx = (svgWidth / dataPoints.length) * idx + (svgWidth / dataPoints.length / 2);
    const cy = svgHeight - (val * 1.8);
    return `${cx},${cy}`;
  });
  
  const linePath = `M0,180 L${pathParts[0]} ` + pathParts.map(p => `L${p}`).join(" ") + ` L800,180`;
  const areaPath = linePath + ` L800,200 L0,200 Z`;

  // Helper to get labels based on ratings
  const getSkillLabel = (score: number) => {
    if (score >= 90) return "Exceptional";
    if (score >= 80) return "Excellent";
    if (score >= 70) return "Good";
    return "Needs Work";
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col md:flex-row min-h-screen">
      {/* Side Navigation Bar matching provided dashboard mock */}
      <nav className="w-full md:w-64 flex flex-col py-6 bg-[#0e0e0e]/50 backdrop-blur-3xl border-r border-white/10 z-40 shrink-0">
        
        {/* Header Branding */}
        <div className="px-6 mb-8 flex items-center gap-3">
          <span className="font-display text-lg font-bold text-primary">Interview AI</span>
        </div>

        {/* Links */}
        <div className="flex-1 px-4 space-y-2">
          <button
            onClick={onNewSession}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all text-left"
          >
            <LayoutDashboard size={18} />
            <span className="font-mono text-xs uppercase tracking-wider font-bold">Home</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold transition-all text-left">
            <TrendingUp size={18} />
            <span className="font-mono text-xs uppercase tracking-wider">Analysis</span>
          </button>

          <button
            onClick={onViewHistory}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all text-left"
          >
            <History size={18} />
            <span className="font-mono text-xs uppercase tracking-wider font-bold">History</span>
          </button>
        </div>

        {/* Footer actions */}
        <div className="px-4 mt-auto space-y-2 pt-6 border-t border-white/5">
          <button
            onClick={onNewSession}
            className="w-full px-4 py-3 rounded-xl btn-primary flex items-center justify-center gap-2 text-white text-xs uppercase font-bold"
          >
            <Plus size={16} />
            <span>New Session</span>
          </button>

          <button
            onClick={onNewSession}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all text-left"
          >
            <LogOut size={16} />
            <span className="font-mono text-xs uppercase tracking-wider">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Analysis content area */}
      <main ref={dashboardRef} className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full space-y-12">
        {session.cheatReason ? (
          <div className="flex flex-col items-center justify-center text-center mt-12 max-w-2xl mx-auto min-h-[60vh]">
            <AlertTriangle size={80} className="text-red-500 mb-6 animate-pulse" />
            <h1 className="font-display text-4xl md:text-5xl font-extrabold text-red-500 tracking-tight mb-4 uppercase">
              Disqualified
            </h1>
            <p className="text-lg text-red-200/80 mb-8 leading-relaxed">
              This interview session was automatically terminated and scored a <span className="font-bold text-red-400">0</span> due to a violation of testing environment protocols. 
              <br/><br/>
              <span className="bg-red-950/50 px-4 py-2 rounded-lg border border-red-500/20 text-red-300 font-mono text-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                Violation: {session.violations && session.violations.length > 1 ? "Multiple Security Violations" : session.cheatReason}
              </span>
            </p>
            
            {session.violations && session.violations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
                {session.violations.map((v, idx) => (
                  <div key={idx} className="rounded-2xl overflow-hidden border-2 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.3)] bg-black w-full relative group">
                    <div className="absolute top-4 left-4 bg-red-950/90 text-white font-mono text-[10px] uppercase font-bold px-3 py-2 rounded-lg shadow-lg flex flex-col items-start gap-1 border border-red-500/50 backdrop-blur-md z-10">
                      <div className="flex items-center gap-2 text-red-400">
                        <Camera size={12} />
                        Strike {idx + 1} • {v.timestamp}
                      </div>
                      <span className="text-[11px] text-white/90 truncate max-w-[200px]" title={v.reason}>{v.reason}</span>
                    </div>
                    {v.evidence ? (
                      <img src={v.evidence} alt={`Violation ${idx + 1}`} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center text-red-500/50">No Photo Captured</div>
                    )}
                  </div>
                ))}
              </div>
            ) : session.cheatEvidence && (
              <div className="rounded-2xl overflow-hidden border-2 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.3)] bg-black w-full relative max-w-md mx-auto mt-4">
                <div className="absolute top-4 left-4 bg-red-500 text-white font-mono text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-2">
                   <Camera size={12} />
                   Photographic Evidence
                </div>
                <img src={session.cheatEvidence} alt="Violation Proof" className="w-full h-auto object-cover" />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Dynamic overall dashboard Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4.5xl font-extrabold text-white tracking-tight glow-text mb-2">
              Performance Dashboard
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-on-surface-variant font-mono text-xs opacity-80">
              <span className="flex items-center gap-1.5">
                <History size={14} className="text-primary" /> {session.date}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20"></span>
              <span className="flex items-center gap-1.5">
                <Timer size={14} className="text-primary" /> {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20"></span>
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" /> {session.config.experienceLevel} AI Interview
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 items-end">
            <div className="glass-panel rounded-2xl px-6 py-4 flex items-center gap-4 ambient-glow border border-white/10 shadow-xl">
              <div className="text-right">
                <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 font-mono">Overall Score</div>
                <div className="font-display text-3xl font-extrabold text-white">
                  {calculatedOverallScore}
                  <span className="text-on-surface-variant font-normal text-lg">/100</span>
                </div>
              </div>
              <div className="h-10 w-[1px] bg-white/10 mx-1"></div>
              <span className="material-symbols-outlined text-[#ffb595] text-3xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                trending_up
              </span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleShareResults}
                disabled={isSharing}
                className="px-6 py-3 bg-white/10 hover:bg-primary/20 text-white font-bold rounded-xl transition-all border border-white/20 hover:border-primary shadow-lg flex items-center gap-2"
              >
                {isSharing ? <Loader2 size={18} className="animate-spin text-primary" /> : <FileText size={18} className="text-primary" />}
                <span>{isSharing ? "Processing..." : "Share Results via Email"}</span>
              </button>
              {shareMessage && (
                <span className={`text-xs font-bold ${shareMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                  {shareMessage.text}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Progress Circular Indicators */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Circular card 1: Technical */}
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border border-white/10 bg-black/20 hover:border-primary/30 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all text-primary pointer-events-none">
              <BrainCircuit size={64} />
            </div>
            <h3 className="font-display text-base font-bold text-white mb-6 flex items-center gap-2.5">
              Technical Proficiency
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(173,198,255,0.8)] animate-pulse"></span>
            </h3>

            <div className="flex flex-col items-center mb-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-white/5 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="6"></circle>
                  <circle
                    className="text-primary stroke-current progress-ring__circle"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    strokeWidth="6"
                    strokeDasharray="251.2"
                    strokeDashoffset={getStrokeOffset(avgTechnical)}
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px rgba(173,198,255,0.4))" }}
                  ></circle>
                </svg>
                <div className="absolute font-display text-2xl font-extrabold text-white">{avgTechnical}%</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Core Architecture</span>
                <span className="text-primary font-bold font-mono text-[11px]">{getSkillLabel(avgTechnical)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">System Scalability</span>
                <span className="text-secondary font-bold font-mono text-[11px]">{avgTechnical > 80 ? "Excellent" : "Good"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Complexity Optimization</span>
                <span className="text-tertiary font-bold font-mono text-[11px]">{avgTechnical < 80 ? "Needs Work" : "Excellent"}</span>
              </div>
            </div>
          </div>

          {/* Circular card 2: Communication */}
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border border-white/10 bg-black/20 hover:border-secondary/30 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all text-secondary pointer-events-none">
              <MessageSquare size={64} />
            </div>
            <h3 className="font-display text-base font-bold text-white mb-6 flex items-center gap-2.5">
              Communication Clarity
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(194,193,255,0.8)] animate-pulse"></span>
            </h3>

            <div className="flex flex-col items-center mb-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-white/5 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="6"></circle>
                  <circle
                    className="text-secondary stroke-current progress-ring__circle"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    strokeWidth="6"
                    strokeDasharray="251.2"
                    strokeDashoffset={getStrokeOffset(avgCommunication)}
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px rgba(194,193,255,0.4))" }}
                  ></circle>
                </svg>
                <div className="absolute font-display text-2xl font-extrabold text-white">{avgCommunication}%</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Clarity & Layout</span>
                <span className="text-primary font-bold font-mono text-[11px]">{getSkillLabel(avgCommunication)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Conciseness</span>
                <span className="text-primary font-bold font-mono text-[11px]">Excellent</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Active Listening</span>
                <span className="text-secondary font-bold font-mono text-[11px]">Good</span>
              </div>
            </div>
          </div>

          {/* Circular card 3: Confidence */}
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border border-white/10 bg-black/20 hover:border-tertiary/30 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all text-tertiary pointer-events-none">
              <Sparkles size={64} />
            </div>
            <h3 className="font-display text-base font-bold text-white mb-6 flex items-center gap-2.5">
              Candidate Confidence
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(255,181,149,0.8)] animate-pulse"></span>
            </h3>

            <div className="flex flex-col items-center mb-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-white/5 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="6"></circle>
                  <circle
                    className="text-tertiary stroke-current progress-ring__circle"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    strokeWidth="6"
                    strokeDasharray="251.2"
                    strokeDashoffset={getStrokeOffset(avgConfidence)}
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px rgba(255,181,149,0.4))" }}
                  ></circle>
                </svg>
                <div className="absolute font-display text-2xl font-extrabold text-white">{avgConfidence}%</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Tempo & Pacing</span>
                <span className="text-secondary font-bold font-mono text-[11px]">{getSkillLabel(avgConfidence)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Tone Variance</span>
                <span className="text-secondary font-bold font-mono text-[11px]">Good</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Hesitation Count</span>
                <span className="text-tertiary font-bold font-mono text-[11px]">Minimal</span>
              </div>
            </div>
          </div>

          {/* Circular card 4: Body Language (Vision) */}
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border border-white/10 bg-black/20 hover:border-emerald-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all text-emerald-400 pointer-events-none">
              <Video size={64} />
            </div>
            <h3 className="font-display text-base font-bold text-white mb-6 flex items-center gap-2.5">
              Body Language
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
            </h3>

            <div className="flex flex-col items-center mb-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-white/5 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="6"></circle>
                  <circle
                    className="text-emerald-400 stroke-current progress-ring__circle"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    strokeWidth="6"
                    strokeDasharray="251.2"
                    strokeDashoffset={getStrokeOffset(bodyLanguageScore)}
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,0.4))" }}
                  ></circle>
                </svg>
                <div className="absolute font-display text-2xl font-extrabold text-white">{bodyLanguageScore}%</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Eye Contact</span>
                <span className="text-emerald-400 font-bold font-mono text-[11px]">{getSkillLabel(bodyLanguageScore)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-on-surface-variant font-medium">Posture</span>
                <span className="text-emerald-400 font-bold font-mono text-[11px]">{bodyLanguageScore > 80 ? "Excellent" : "Good"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Professionalism</span>
                <span className="text-emerald-400 font-bold font-mono text-[11px]">Solid</span>
              </div>
            </div>
          </div>
        </section>



        {/* Vision API Feedback Section */}
        {session.bodyLanguageFeedback && (
          <section className="glass-panel rounded-2xl p-8 border border-white/10 bg-black/15 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
            <h3 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2.5">
              <Video size={24} className="text-emerald-400" />
              <span>Vision API Analysis (Candidate Profile)</span>
            </h3>
            <div className="bg-white/5 border border-white/5 rounded-xl p-5">
              <p className="text-sm md:text-base text-on-surface-variant leading-relaxed">
                {session.bodyLanguageFeedback}
              </p>
            </div>
          </section>
        )}

        {/* Trajectory Timeline Curve and Key Takeaways */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
          
          {/* Timeline chart */}
          <div className="lg:col-span-8 glass-panel rounded-2xl p-6 border border-white/10 bg-black/10 relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <span>Session Trajectory</span>
              </h3>
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-[10px] text-on-surface-variant">
                Progressive Rounds
              </span>
            </div>

            {/* Interactive SVG Chart */}
            <div className="relative w-full h-64 mt-4 select-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
                {/* Grid guidelines */}
                <line x1="0" y1="50" x2="800" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <line x1="0" y1="150" x2="800" y2="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

                <defs>
                  <linearGradient id="glowChartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(75, 142, 255, 0.3)" />
                    <stop offset="100%" stopColor="rgba(75, 142, 255, 0)" />
                  </linearGradient>
                </defs>

                {/* Shaded Area */}
                <path d={areaPath} fill="url(#glowChartGradient)" />

                {/* Trajectory Line Curve */}
                <path d={linePath} fill="none" stroke="#adc6ff" strokeWidth="3.5" strokeLinecap="round" style={{ filter: "drop-shadow(0 4px 10px rgba(173,198,255,0.4))" }} />

                {/* Interactive Node Anchors */}
                {dataPoints.map((val, idx) => {
                  const cx = (svgWidth / dataPoints.length) * idx + (svgWidth / dataPoints.length / 2);
                  const cy = svgHeight - (val * 1.8);
                  const round = validRounds[idx];
                  const qText = round ? round.questionText : `Round ${idx + 1}`;
                  const fText = round?.evaluation?.feedback || "Answer processed with high conceptual value.";

                  return (
                    <g
                      key={idx}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredNode({ index: idx + 1, score: val, question: qText, feedback: fText })}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <circle cx={cx} cy={cy} r="8" fill="rgba(173,198,255,0.2)" className="transition-all duration-200 group-hover:scale-125" />
                      <circle cx={cx} cy={cy} r="4" fill="#white" stroke="#4b8eff" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 6px #adc6ff)" }} />
                    </g>
                  );
                })}
              </svg>

              {/* Time progression indicators */}
              <div className="absolute bottom-0 w-full flex justify-between transform translate-y-6 px-4 font-mono text-[10px] text-on-surface-variant font-bold opacity-75">
                <span>Start</span>
                <span>Midpoint</span>
                <span>Conclusion</span>
              </div>
            </div>

            {/* Hover Node Card Box */}
            <div className="mt-8 min-h-[80px] bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-center">
              {hoveredNode ? (
                <div className="space-y-1.5 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
                      Round {hoveredNode.index} Metric Spotlight
                    </span>
                    <span className="font-mono text-xs text-[#ffb595] font-bold">Score: {hoveredNode.score}/100</span>
                  </div>
                  <p className="text-[11px] text-white font-medium truncate">"{hoveredNode.question}"</p>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-2">{hoveredNode.feedback}</p>
                </div>
              ) : (
                <div className="text-center text-xs text-on-surface-variant italic py-2 flex items-center justify-center gap-2">
                  <Info size={14} className="text-primary" />
                  <span>Hover over trajectory points above to inspect minute-by-minute evaluation feedback details.</span>
                </div>
              )}
            </div>
          </div>

          {/* Key Insights takeaway container */}
          <div className="lg:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between border border-white/10 bg-black/15">
            <div>
              <h3 className="font-display text-base font-bold text-white mb-6 flex items-center gap-2.5">
                <Sparkles size={16} className="text-primary" />
                <span>Executive Insights</span>
              </h3>

              <div className="space-y-5">
                {/* Strengths */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <CheckCircle size={12} /> Key Strengths
                  </h4>
                  <ul className="space-y-2.5 text-xs text-on-surface-variant list-none pl-0">
                    {session.keyTakeaways?.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    )) || (
                      <li className="leading-relaxed">Strong technical articulation of system scaling constraints.</li>
                    )}
                  </ul>
                </div>

                {/* Opportunities */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Opportunities
                  </h4>
                  <ul className="space-y-2.5 text-xs text-on-surface-variant list-none pl-0">
                    {session.keyTakeaways?.opportunities.map((opp, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-yellow-500 font-bold shrink-0 mt-0.5">•</span>
                        <span>{opp}</span>
                      </li>
                    )) || (
                      <li className="leading-relaxed">Consider utilizing STAR communication models for brief behavioral scenarios.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 mt-8">
              <button
                onClick={onNewSession}
                className="w-full py-3.5 rounded-xl btn-primary text-white font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                <span>Start New Session</span>
              </button>
            </div>
          </div>

        </section>

        {/* Detailed Question Review List */}
        <section className="space-y-6 pb-12">
          <h3 className="font-display text-lg font-bold text-white border-b border-white/5 pb-4">
            Question-by-Question Evaluation Review
          </h3>
          <div className="space-y-4">
            {session.rounds.map((round, idx) => {
              const evalData = round.evaluation;
              return (
                <div
                  key={idx}
                  className="glass-panel rounded-xl p-5 border border-white/5 bg-black/5 hover:border-white/10 transition-all space-y-4"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono tracking-wider text-primary uppercase font-bold">
                        Round {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-white leading-relaxed">"{round.questionText}"</h4>
                    </div>
                    {evalData && (
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl font-mono text-xs shrink-0">
                        <span className="text-primary font-bold">Tech: {evalData.technicalScore}</span>
                        <span className="opacity-25">|</span>
                        <span className="text-secondary font-bold">Clarity: {evalData.communicationScore}</span>
                        <span className="opacity-25">|</span>
                        <span className="text-tertiary font-bold">Conf: {evalData.confidenceScore}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs pt-2 border-t border-white/5">
                    <div className="md:col-span-4 space-y-1">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                        Your Answer
                      </span>
                      <p className="text-white/80 leading-relaxed italic max-h-24 overflow-y-auto pr-1">
                        "{round.answerText || "No answer provided."}"
                      </p>
                    </div>

                    {evalData ? (
                      <>
                        <div className="md:col-span-4 space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                            Hiring Lead Feedback
                          </span>
                          <p className="text-on-surface-variant leading-relaxed max-h-24 overflow-y-auto pr-1">
                            {evalData.feedback}
                          </p>
                        </div>
                        <div className="md:col-span-4 space-y-1">
                          <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider font-mono">
                            How to Improve
                          </span>
                          <p className="text-on-surface-variant leading-relaxed max-h-24 overflow-y-auto pr-1">
                            {evalData.suggestions}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="md:col-span-8 flex items-center justify-center italic text-on-surface-variant py-4">
                        Evaluation data not processed for this skipped question.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

          </>
        )}
      </main>
    </div>
  );
}

// Chart offset computation
function trajectoryColorOffset(score: number): number {
  return score * 1.8;
}

/* ============================================================================
   VIEW 4: HISTORYLISTVIEW (View past mock interviews)
   ============================================================================ */
interface HistoryListViewProps {
  history: Session[];
  onSelect: (session: Session) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

function HistoryListView({ history, onSelect, onDelete, onBack }: HistoryListViewProps) {
  return (
    <div className="relative z-10 flex-1 flex flex-col min-h-screen">
      <header className="w-full flex justify-between items-center px-6 md:px-12 h-20 bg-[#050505]/40 backdrop-blur-3xl border-b border-white/10 shadow-[0_0_20px_rgba(173,198,255,0.05)]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-primary hover:text-white transition-all font-bold"
        >
          <ChevronLeft size={16} />
          <span>Back to Setup</span>
        </button>
        <span className="font-display text-xl font-bold tracking-tight text-white">Historical Logs</span>
        <div className="w-16"></div> {/* balance spacer */}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <History size={20} className="text-primary" />
              <span>Past Simulation Records</span>
            </h2>
            <span className="text-xs text-on-surface-variant font-mono font-bold bg-white/5 px-2.5 py-1 rounded-full">
              {history.length} Saved
            </span>
          </div>

          {history.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-white/5">
              <Sparkles size={36} className="text-primary/40 mx-auto animate-pulse" />
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">No completed interviews yet</h3>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                  Start your first mock interview simulation session, customize roles, and receive beautiful insights scorecards right here!
                </p>
              </div>
              <button
                onClick={onBack}
                className="mt-4 px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/90 transition-all font-mono tracking-wider uppercase"
              >
                Configure First Interview
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {history.map((session) => (
                <div
                  key={session.id}
                  className="glass-panel rounded-2xl p-5 border border-white/5 bg-black/20 hover:border-primary/20 transition-all duration-300 flex justify-between items-center gap-6 group"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono text-[9px] font-bold uppercase tracking-wider">
                        {session.config.experienceLevel}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono font-medium">{session.date}</span>
                    </div>

                    <h4 className="font-bold text-sm text-white line-clamp-1 leading-relaxed">
                      {session.config.jobDescription.slice(0, 120)}...
                    </h4>

                    <div className="flex items-center gap-4 text-xs text-on-surface-variant opacity-80">
                      <span>{session.config.numQuestions} Questions</span>
                      <span className="w-1 h-1 rounded-full bg-white/20"></span>
                      <span>{Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] text-on-surface-variant uppercase tracking-widest font-mono font-bold mb-0.5">Score</div>
                      <div className="font-display text-2xl font-extrabold text-white">
                        {session.overallScore || 80}
                        <span className="text-[11px] text-on-surface-variant font-medium">/100</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => onSelect(session)}
                        className="px-3.5 py-1.5 bg-primary/15 hover:bg-primary/25 border border-primary/20 text-primary rounded-xl text-xs font-bold transition-all"
                      >
                        Analysis
                      </button>
                      <button
                        onClick={() => onDelete(session.id)}
                        className="p-1.5 text-on-surface-variant hover:text-red-400 rounded-lg hover:bg-white/5 transition-all text-center flex items-center justify-center"
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
