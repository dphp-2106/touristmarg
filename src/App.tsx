/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  History, 
  BookOpen, 
  Info, 
  Volume2, 
  Download, 
  Library, 
  Users, 
  Home, 
  ChevronRight, 
  Loader2, 
  ArrowLeft,
  Globe,
  Play,
  Pause,
  Plus,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Language, HeritageInfo, CommunityStory } from './types';
import { analyzeHeritageImage, generateAudio, translateHeritageInfo } from './services/aiService';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LANGUAGES: { code: Language; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
];

type Page = 'home' | 'upload' | 'results' | 'library' | 'community';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [language, setLanguage] = useState<Language>('en');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'full' | 'specific'>('full');
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [results, setResults] = useState<HeritageInfo | null>(null);
  const [offlineGuides, setOfflineGuides] = useState<HeritageInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'mythology' | 'carving' | 'trivia'>('history');
  const [showDeepDive, setShowDeepDive] = useState<Record<string, boolean>>({
    history: false,
    mythology: false,
    carving: false
  });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load offline guides from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('stone_stories_offline');
    if (saved) {
      try {
        setOfflineGuides(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse offline guides", e);
      }
    }
  }, []);

  // Save offline guides to localStorage
  const saveOffline = (guide: HeritageInfo) => {
    const updated = [...offlineGuides, guide];
    setOfflineGuides(updated);
    localStorage.setItem('stone_stories_offline', JSON.stringify(updated));
  };

  const removeOffline = (id: string) => {
    const updated = offlineGuides.filter(g => g.id !== id);
    setOfflineGuides(updated);
    localStorage.setItem('stone_stories_offline', JSON.stringify(updated));
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelectedImage(dataUrl);
      stopCamera();
      setCurrentPage('upload');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setCurrentPage('upload');
      };
      reader.readAsDataURL(file);
    }
  };

  const startAnalysis = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    try {
      const info = await analyzeHeritageImage(selectedImage, uploadMode, language, siteName, location);
      setResults(info);
      setCurrentPage('results');
      setActiveTab('history');
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to read the stones. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAudioNarration = async () => {
    if (!results) return;
    
    if (audioUrl) {
      if (isPlaying) {
        audioRef.current?.pause();
      } else {
        audioRef.current?.play();
      }
      setIsPlaying(!isPlaying);
      return;
    }

    setIsPlaying(true); // Show loading state or similar if needed
    const textToSpeak = `
      ${results.name}. 
      History Summary: ${results.summaryHistory}. 
      Mythology Summary: ${results.summaryMythology}. 
      ${results.summaryCarving ? `Carving Summary: ${results.summaryCarving}` : ''}
      ${showDeepDive.history ? `Full History: ${results.fullHistory}` : ''}
      ${showDeepDive.mythology ? `Full Mythology: ${results.fullMythology}` : ''}
      ${showDeepDive.carving && results.fullCarving ? `Full Carving Details: ${results.fullCarving}` : ''}
    `;

    const url = await generateAudio(textToSpeak, results.language);
    if (url) {
      setAudioUrl(url);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    } else {
      setIsPlaying(false);
    }
  };

  const changeResultLanguage = async (newLang: Language) => {
    if (!results || isTranslating) return;
    if (results.language === newLang) return;

    setIsTranslating(true);
    try {
      // Stop audio if playing
      audioRef.current?.pause();
      setIsPlaying(false);
      setAudioUrl(null);

      const translated = await translateHeritageInfo(results, newLang);
      setResults(translated);
      setLanguage(newLang);
    } catch (error) {
      console.error("Translation failed", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleDeepDive = (tab: string) => {
    setShowDeepDive(prev => ({ ...prev, [tab]: !prev[tab] }));
    // Reset audio if deep dive changes to ensure it includes new content
    setAudioUrl(null);
    setIsPlaying(false);
    audioRef.current?.pause();
  };

  // Navigation
  const goTo = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-paper shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-black/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => goTo('home')}>
          <div className="w-8 h-8 bg-maroon rounded-lg flex items-center justify-center text-gold">
            <History size={18} />
          </div>
          <h1 className="text-xl font-serif font-bold text-maroon tracking-tight">StoneStories</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button className="p-2 rounded-full hover:bg-black/5 transition-colors">
              <Globe size={20} className="text-maroon" />
            </button>
            <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 hidden group-hover:block z-50 w-40">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    language === lang.code ? "bg-maroon text-white" : "hover:bg-black/5"
                  )}
                >
                  {lang.native}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => goTo('library')} className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <Library size={20} className="text-maroon" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-6 py-8 space-y-12"
            >
              {/* Hero */}
              <div className="space-y-4 text-center">
                <h2 className="text-4xl font-serif font-bold text-maroon leading-tight">
                  Every Stone Has a Story
                </h2>
                <p className="text-ink/70 text-lg">
                  Your personal AI expert for Indian heritage and temples.
                </p>
              </div>

              {/* Main Action */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <div className="absolute -inset-2 bg-maroon/10 rounded-3xl blur-lg group-hover:bg-maroon/20 transition-all"></div>
                  <button 
                    onClick={startCamera}
                    className="relative w-full bg-white border-2 border-sandstone rounded-3xl p-8 text-center cursor-pointer hover:border-maroon transition-all flex flex-col items-center gap-3"
                  >
                    <div className="w-12 h-12 bg-maroon/10 rounded-full flex items-center justify-center text-maroon">
                      <Camera size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-maroon">Live Camera</p>
                      <p className="text-[10px] text-ink/50">Snap a photo now</p>
                    </div>
                  </button>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-2 bg-gold/10 rounded-3xl blur-lg group-hover:bg-gold/20 transition-all"></div>
                  <label className="relative block bg-white border-2 border-sandstone rounded-3xl p-8 text-center cursor-pointer hover:border-maroon transition-all">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center text-maroon">
                        <Upload size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-maroon">Upload File</p>
                        <p className="text-[10px] text-ink/50">From your gallery</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-6">
                <h3 className="text-xl font-serif font-bold text-maroon border-b border-maroon/10 pb-2">How it works</h3>
                <div className="grid gap-6">
                  {[
                    { icon: <Camera />, title: "Photograph", desc: "Snap a photo of any heritage site or specific carving." },
                    { icon: <Loader2 />, title: "Analyze", desc: "Our AI reads the iconography and historical patterns." },
                    { icon: <BookOpen />, title: "Discover", desc: "Get detailed history, mythology, and hidden stories." }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="w-10 h-10 bg-sandstone/10 rounded-xl flex items-center justify-center text-maroon shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-maroon">{step.title}</h4>
                        <p className="text-sm text-ink/60">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-6 py-8 space-y-8"
            >
              <button onClick={() => goTo('home')} className="flex items-center gap-2 text-maroon font-medium">
                <ArrowLeft size={20} /> Back
              </button>

              <div className="heritage-card aspect-square relative">
                {selectedImage && <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />}
                <button 
                  onClick={() => setSelectedImage(null)} 
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-serif font-bold text-maroon">What are we looking at?</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-maroon uppercase tracking-wider">Site Name (Optional)</label>
                    <input 
                      type="text" 
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20 outline-none" 
                      placeholder="e.g. Somnath Temple" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-maroon uppercase tracking-wider">Location (Optional)</label>
                    <input 
                      type="text" 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20 outline-none" 
                      placeholder="e.g. Veraval, Gujarat" 
                    />
                  </div>
                  
                  <p className="text-[10px] text-ink/40 italic">Providing the name and location helps our AI give more accurate stories.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setUploadMode('full')}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-left space-y-2",
                      uploadMode === 'full' ? "border-maroon bg-maroon/5" : "border-black/5 bg-white"
                    )}
                  >
                    <Home className={uploadMode === 'full' ? "text-maroon" : "text-ink/30"} />
                    <div>
                      <p className="font-bold text-sm">Full Temple/Site</p>
                      <p className="text-xs text-ink/50">Overall history & info</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setUploadMode('specific')}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-left space-y-2",
                      uploadMode === 'specific' ? "border-maroon bg-maroon/5" : "border-black/5 bg-white"
                    )}
                  >
                    <Plus className={uploadMode === 'specific' ? "text-maroon" : "text-ink/30"} />
                    <div>
                      <p className="font-bold text-sm">Specific Part</p>
                      <p className="text-xs text-ink/50">Carving, wall, or art</p>
                    </div>
                  </button>
                </div>
              </div>

              <button 
                onClick={startAnalysis}
                disabled={isAnalyzing}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Reading the stones...
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    Analyze Site
                  </>
                )}
              </button>
            </motion.div>
          )}

          {currentPage === 'results' && results && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-0"
            >
              {/* Image Header */}
              <div className="relative h-72">
                <img src={results.imageUrl} alt={results.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <button 
                  onClick={() => goTo('home')} 
                  className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-md text-white rounded-full"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-3xl font-serif font-bold text-white leading-tight">{results.name}</h2>
                  {results.location && (
                    <p className="text-white/80 text-sm mt-1 flex items-center gap-1">
                      <Info size={14} /> {results.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-gold flex items-center gap-1 text-sm">
                      <Globe size={14} /> {LANGUAGES.find(l => l.code === results.language)?.native}
                    </p>
                    
                    {/* Inline Language Switcher */}
                    <div className="relative group">
                      <button className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white border border-white/20 flex items-center gap-1">
                        Change Language <ChevronRight size={12} />
                      </button>
                      <div className="absolute right-0 bottom-full mb-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 hidden group-hover:block z-50 w-40">
                        {LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => changeResultLanguage(lang.code)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                              results.language === lang.code ? "bg-maroon text-white" : "hover:bg-black/5 text-ink"
                            )}
                          >
                            {lang.native}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isTranslating && (
                <div className="bg-gold/20 px-6 py-2 flex items-center justify-center gap-2 text-maroon text-xs font-bold animate-pulse">
                  <Loader2 size={14} className="animate-spin" /> Translating stories...
                </div>
              )}

              {/* Actions Bar */}
              <div className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between sticky top-[57px] z-40">
                <button 
                  onClick={handleAudioNarration}
                  className="flex items-center gap-2 text-maroon font-medium"
                >
                  <div className="w-10 h-10 bg-maroon/10 rounded-full flex items-center justify-center">
                    {isPlaying ? <Pause size={20} /> : <Volume2 size={20} />}
                  </div>
                  Audio Guide
                </button>
                <button 
                  onClick={() => saveOffline(results)}
                  disabled={offlineGuides.some(g => g.id === results.id)}
                  className="flex items-center gap-2 text-maroon font-medium disabled:text-ink/30"
                >
                  <div className="w-10 h-10 bg-maroon/10 rounded-full flex items-center justify-center">
                    {offlineGuides.some(g => g.id === results.id) ? <CheckCircle2 size={20} /> : <Download size={20} />}
                  </div>
                  {offlineGuides.some(g => g.id === results.id) ? 'Saved' : 'Save Offline'}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex overflow-x-auto bg-white border-b border-black/5 px-4 no-scrollbar sticky top-[129px] z-40">
                {[
                  { id: 'history', label: 'History', icon: <History size={16} /> },
                  { id: 'mythology', label: 'Mythology', icon: <BookOpen size={16} /> },
                  ...(results.mode === 'specific' ? [{ id: 'carving', label: 'The Carving', icon: <Plus size={16} /> }] : []),
                  { id: 'trivia', label: 'Special Facts', icon: <Info size={16} /> }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all",
                      activeTab === tab.id ? "border-maroon text-maroon" : "border-transparent text-ink/40"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6 space-y-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="prose prose-stone prose-maroon max-w-none"
                  >
                    {activeTab === 'history' && (
                      <div className="space-y-6">
                        <div className="bg-maroon/5 p-4 rounded-2xl border border-maroon/10">
                          <h4 className="text-maroon font-bold text-sm uppercase tracking-wider mb-2">Quick Highlights</h4>
                          <p className="text-ink/80 leading-relaxed">{results.summaryHistory}</p>
                        </div>
                        
                        {!showDeepDive.history ? (
                          <button 
                            onClick={() => toggleDeepDive('history')}
                            className="w-full py-3 border-2 border-maroon/20 text-maroon font-bold rounded-xl hover:bg-maroon/5 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={18} /> Get More Information
                          </button>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between border-b border-maroon/10 pb-2">
                              <h4 className="text-maroon font-bold text-sm uppercase tracking-wider">Deep Dive History</h4>
                              <button onClick={() => toggleDeepDive('history')} className="text-xs text-maroon/60 hover:text-maroon">Show Less</button>
                            </div>
                            <div className="markdown-body">
                              <Markdown>{results.fullHistory}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'mythology' && (
                      <div className="space-y-6">
                        <div className="bg-maroon/5 p-4 rounded-2xl border border-maroon/10">
                          <h4 className="text-maroon font-bold text-sm uppercase tracking-wider mb-2">Quick Highlights</h4>
                          <p className="text-ink/80 leading-relaxed">{results.summaryMythology}</p>
                        </div>
                        
                        {!showDeepDive.mythology ? (
                          <button 
                            onClick={() => toggleDeepDive('mythology')}
                            className="w-full py-3 border-2 border-maroon/20 text-maroon font-bold rounded-xl hover:bg-maroon/5 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={18} /> Get More Information
                          </button>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between border-b border-maroon/10 pb-2">
                              <h4 className="text-maroon font-bold text-sm uppercase tracking-wider">Deep Dive Mythology</h4>
                              <button onClick={() => toggleDeepDive('mythology')} className="text-xs text-maroon/60 hover:text-maroon">Show Less</button>
                            </div>
                            <div className="markdown-body">
                              <Markdown>{results.fullMythology}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'carving' && results.summaryCarving && (
                      <div className="space-y-6">
                        <div className="bg-maroon/5 p-4 rounded-2xl border border-maroon/10">
                          <h4 className="text-maroon font-bold text-sm uppercase tracking-wider mb-2">Quick Highlights</h4>
                          <p className="text-ink/80 leading-relaxed">{results.summaryCarving}</p>
                        </div>
                        
                        {!showDeepDive.carving ? (
                          <button 
                            onClick={() => toggleDeepDive('carving')}
                            className="w-full py-3 border-2 border-maroon/20 text-maroon font-bold rounded-xl hover:bg-maroon/5 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={18} /> Get More Information
                          </button>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between border-b border-maroon/10 pb-2">
                              <h4 className="text-maroon font-bold text-sm uppercase tracking-wider">Deep Dive Details</h4>
                              <button onClick={() => toggleDeepDive('carving')} className="text-xs text-maroon/60 hover:text-maroon">Show Less</button>
                            </div>
                            <div className="markdown-body">
                              <Markdown>{results.fullCarving}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'trivia' && (
                      <div className="grid gap-4">
                        <h4 className="text-maroon font-bold text-sm uppercase tracking-wider border-b border-maroon/10 pb-2">Special Facts</h4>
                        {results.didYouKnow.map((fact, i) => (
                          <div key={i} className="bg-gold/10 border-l-4 border-gold p-4 rounded-r-xl">
                            <p className="text-maroon font-medium italic">"{fact}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {currentPage === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-maroon">Offline Library</h2>
                <span className="text-xs bg-maroon/10 text-maroon px-2 py-1 rounded-full font-bold">
                  {offlineGuides.length} SAVED
                </span>
              </div>

              {offlineGuides.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center text-ink/20 mx-auto">
                    <Download size={40} />
                  </div>
                  <p className="text-ink/50">No saved guides yet. Save a guide to access it without internet.</p>
                  <button onClick={() => goTo('home')} className="btn-secondary">Start Exploring</button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {offlineGuides.map((guide) => (
                    <div 
                      key={guide.id} 
                      className="heritage-card flex gap-4 p-3 cursor-pointer hover:bg-black/5 transition-colors"
                      onClick={() => {
                        setResults(guide);
                        setCurrentPage('results');
                      }}
                    >
                      <img src={guide.imageUrl} alt={guide.name} className="w-24 h-24 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h4 className="font-bold text-maroon line-clamp-1">{guide.name}</h4>
                          <p className="text-xs text-ink/50 mt-1">
                            Saved on {new Date(guide.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-gold">
                            {guide.mode === 'full' ? 'Full Site' : 'Carving'}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeOffline(guide.id);
                            }}
                            className="text-red-500 p-1 hover:bg-red-50 rounded-full"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {currentPage === 'community' && (
            <motion.div
              key="community"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-8 space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-serif font-bold text-maroon">Community Stories</h2>
                <p className="text-sm text-ink/60">Help us document lesser known temples and local folklore.</p>
              </div>

              <form className="space-y-4 bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-maroon uppercase tracking-wider">Site Name</label>
                  <input type="text" className="w-full bg-paper border-none rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20" placeholder="e.g. Local Shiva Temple, Hampi" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-maroon uppercase tracking-wider">Location</label>
                  <input type="text" className="w-full bg-paper border-none rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20" placeholder="City, State" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-maroon uppercase tracking-wider">The Story</label>
                  <textarea className="w-full bg-paper border-none rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20 h-32" placeholder="Share the legend or history..." />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-maroon uppercase tracking-wider">Your Name</label>
                  <input type="text" className="w-full bg-paper border-none rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20" placeholder="Credits will be given to you" />
                </div>
                <button type="button" className="w-full btn-primary" onClick={() => alert("Story submitted for review! Thank you for contributing.")}>
                  Submit Story
                </button>
              </form>

              <div className="space-y-4">
                <h3 className="text-lg font-serif font-bold text-maroon">Recent Contributions</h3>
                <div className="space-y-4">
                  {[
                    { title: "The Hidden Well of Mandu", author: "Rajesh Kumar", content: "Legend says this well was built in a single night..." },
                    { title: "Whispering Pillars of Vittala", author: "Ananya S.", content: "The musical pillars are not just stone, they are..." }
                  ].map((story, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-black/5">
                      <h4 className="font-bold text-maroon">{story.title}</h4>
                      <p className="text-sm text-ink/60 line-clamp-2 mt-1">{story.content}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
                        <span className="text-[10px] text-gold font-bold uppercase">By {story.author}</span>
                        <ChevronRight size={14} className="text-maroon" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-black/5 px-6 py-3 flex items-center justify-between z-50">
        {[
          { id: 'home', icon: <Home size={24} />, label: 'Home' },
          { id: 'library', icon: <Library size={24} />, label: 'Library' },
          { id: 'community', icon: <Users size={24} />, label: 'Community' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => goTo(item.id as Page)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              currentPage === item.id ? "text-maroon scale-110" : "text-ink/30 hover:text-maroon/50"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Camera Overlay */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex-1 relative flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none">
                <div className="w-full h-full border-2 border-white/30 rounded-3xl"></div>
              </div>
            </div>
            
            <div className="bg-black/80 backdrop-blur-xl p-8 flex items-center justify-around">
              <button 
                onClick={stopCamera}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                <X size={24} />
              </button>
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full bg-white p-1"
              >
                <div className="w-full h-full rounded-full border-4 border-black/10 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-maroon"></div>
                </div>
              </button>
              <div className="w-12 h-12"></div> {/* Spacer */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
    </div>
  );
}
