/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  CheckCircle2,
  X,
  MessageSquare,
  ChevronRight,
  Loader2, 
  ArrowLeft,
  Globe,
  Play,
  Pause,
  Plus,
  History as HistoryIcon,
  BookOpen,
  Info,
  Volume2,
  Download,
  Library,
  Users,
  Home,
  Camera,
  Upload,
  Layout,
  Search,
  MapPin,
  Box,
  FileText,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import '@google/model-viewer';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Language, HeritageInfo, CommunityStory, ChatMessage, Page } from './types';
import { analyzeHeritageImage, generateAudio, translateHeritageInfo, chatWithStoneStream, streamHeritageGreeting, fetchDeepDiveData, identifyHeritageQuick } from './services/aiService';
import { compressImage, generateHash } from './utils/imageUtils';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { auth, firestore, loginWithGoogle, logout, onAuthStateChanged, User, saveUserHistory, checkHistoryCache, updateUserHistory } from './firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit, getDocFromServer, doc } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Clock, AlertCircle } from 'lucide-react';

const ModelViewer = 'model-viewer' as any;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 13);
  return null;
}

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
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<HeritageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [language, setLanguage] = useState<Language>('en');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'full' | 'specific'>('full');
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeepDiving, setIsDeepDiving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [results, setResults] = useState<HeritageInfo | null>(null);
  const [offlineGuides, setOfflineGuides] = useState<HeritageInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'mythology' | 'carving' | 'trivia' | 'chat' | 'structure'>('history');
  const [showDeepDive, setShowDeepDive] = useState<Record<string, boolean>>({
    history: false,
    mythology: false,
    carving: false
  });
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [journeySearch, setJourneySearch] = useState('');
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const LOADING_MESSAGES = [
    "Identifying sacred geometry...",
    "Consulting the ancient archives...",
    "Reading the whispers of the stone...",
    "Reconstructing historical memories...",
    "Unveiling the divine essence...",
    "Translating the language of the gods...",
    "Almost there, traveler..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [newStory, setNewStory] = useState({ title: '', content: '', author: '', location: '' });
  const [communityStories, setCommunityStories] = useState<CommunityStory[]>([
    {
      id: '1',
      title: 'The Hidden Tunnel of Somnath',
      author: 'Pandit Ramesh Sharma',
      content: 'Local legends say there was a secret tunnel leading from the main sanctum to the sea, used by the priests to protect the sacred relics during invasions. My grandfather, who was also a priest here, once showed me the sealed entrance near the northern wall.',
      location: 'Somnath Temple, Gujarat',
      timestamp: Date.now() - 86400000 * 5,
      upvotes: 124
    },
    {
      id: '2',
      title: 'The Singing Pillars of Vittala',
      author: 'Ananya Rao',
      content: 'The 56 musical pillars in the Vittala Temple are not just architectural wonders. Each pillar represents a different musical instrument. If you tap them gently, they emit the exact frequency of that instrument. It took me three visits to finally hear the flute pillar clearly.',
      location: 'Hampi, Karnataka',
      timestamp: Date.now() - 86400000 * 2,
      upvotes: 89
    }
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Ducking Logic
  useEffect(() => {
    const bgAudio = document.getElementById('bg-atmosphere') as HTMLAudioElement;
    if (!bgAudio) return;

    if (isPlaying) {
      // Duck background music to 20%
      bgAudio.volume = 0.2;
    } else {
      // Fade back to 80%
      bgAudio.volume = 0.8;
    }
  }, [isPlaying]);

  // Haptic Feedback
  useEffect(() => {
    if (results && !isAnalyzing) {
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    }
  }, [results, isAnalyzing]);

  // Export as Scroll
  const exportAsScroll = async () => {
    if (!results || !scrollRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(scrollRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f2ed'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${results.name.replace(/\s+/g, '_')}_Scroll.pdf`);
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  const loadFromHistory = (item: any) => {
    // Map Firestore item back to HeritageInfo
    const historyResults: HeritageInfo = {
      id: item.id,
      name: item.context.siteName,
      location: item.context.locationName,
      summaryHistory: item.content.fullStoryText.substring(0, 200) + "...",
      fullHistory: item.content.fullStoryText,
      summaryMythology: item.content.fullMythologyText?.substring(0, 200) + "..." || "Mythological context from history.",
      fullMythology: item.content.fullMythologyText || "Mythological details saved in history.",
      didYouKnow: [],
      suggestedQuestions: item.content.suggestedQuestions || [],
      greeting: item.content.greeting,
      chatHistory: [],
      imageUrl: item.media.uploadedImageURL,
      timestamp: item.meta.timestamp?.seconds * 1000 || Date.now(),
      mode: 'full',
      language: item.meta.languageUsed as Language,
      wikiThumbnail: item.media.wikiThumbnail,
      wikipediaSummary: item.content.wikipediaSummary,
      structureParts: item.content.structureParts,
      originalDescription: item.content.originalDescription,
      currentCondition: item.content.currentCondition,
      identifiedDeity: item.content.identifiedDeity,
      coordinates: item.context.coordinates
    };
    
    setResults(historyResults);
    setCurrentPage('results');
    setActiveTab('history');
  };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [results?.chatHistory, isChatting]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Firestore History listener
  useEffect(() => {
    if (!user) {
      setCloudHistory([]);
      return;
    }

    const q = query(
      collection(firestore, 'user_history'),
      where('user.uid', '==', user.uid),
      orderBy('meta.timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCloudHistory(history);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_history');
    });

    return () => unsubscribe();
  }, [user]);

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

  const handleLocationChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocation(value);
    if (value.length > 2) {
      try {
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5`);
        const data = await response.json();
        setLocationSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Location fetch failed", error);
      }
    } else {
      setLocationSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectLocation = (feature: any) => {
    const [lon, lat] = feature.geometry.coordinates;
    const name = feature.properties.name + (feature.properties.city ? `, ${feature.properties.city}` : '') + (feature.properties.state ? `, ${feature.properties.state}` : '');
    setLocation(name);
    setSelectedCoords({ lat, lon });
    setShowSuggestions(false);
  };

  const startAnalysis = async () => {
    if (!selectedImage) return;
    
    setIsAnalyzing(true);
    const startTime = Date.now();
    setAnalysisStartTime(startTime);

    try {
      // 1. Minimal Image Pre-processing
      const thumbnail = await compressImage(selectedImage, 256, 0.5);
      
      // 2. Zero Initial Dependencies: Call Gemini 3 Flash only for a 3-sentence visual description
      // DO NOT call Wikipedia, Photon, or any other API in the first step.
      const info = await identifyHeritageQuick(thumbnail, language);
      
      // 3. Set results with minimal data
      const quickResults: HeritageInfo = {
        id: crypto.randomUUID(),
        name: info.name || "Heritage Site",
        summaryHistory: info.summaryHistory || "",
        fullHistory: info.fullHistory || "",
        summaryMythology: "",
        fullMythology: "",
        didYouKnow: [],
        suggestedQuestions: [],
        imageUrl: selectedImage, // Use original for display
        timestamp: Date.now(),
        mode: uploadMode,
        language: language,
        chatHistory: []
      };

      setResults(quickResults);
      setCurrentPage('results');
      setActiveTab('history');

      // 4. Disable Auto-Save: Commented out for speed reset
      /*
      if (user) {
        const imageHash = await generateHash(thumbnail);
        const timeSpent = Math.round((Date.now() - startTime) / 1000);
        await saveUserHistory({
          user: { uid: user.uid, userEmail: user.email, displayName: user.displayName },
          context: { siteName: quickResults.name, locationName: "Unknown", coordinates: { lat: 0, lng: 0 } },
          content: { 
            fullStoryText: quickResults.fullHistory,
            greeting: "",
            summaryHistory: quickResults.summaryHistory
          },
          media: { uploadedImageURL: selectedImage },
          meta: { languageUsed: language, timeSpent, timestamp: null, imageHash }
        });
      }
      */

    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to read the stones. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepDive = async () => {
    if (!results || isDeepDiving) return;
    setIsDeepDiving(true);

    try {
      const deepDiveData = await fetchDeepDiveData(results.imageUrl, results.name, language, uploadMode);
      setResults(prev => prev ? { ...prev, ...deepDiveData } : null);

      // Update Firestore with deep dive data
      if (user && results.firestoreId) {
        await updateUserHistory(results.firestoreId, {
          content: {
            fullStoryText: deepDiveData.fullHistory,
            fullMythologyText: deepDiveData.fullMythology,
            wikipediaSummary: deepDiveData.wikipediaSummary,
            structureParts: deepDiveData.structureParts,
            originalDescription: deepDiveData.originalDescription,
            currentCondition: deepDiveData.currentCondition
          },
          media: {
            wikiThumbnail: deepDiveData.wikiThumbnail
          }
        });
      }
    } catch (error) {
      console.error("Deep dive failed", error);
      alert("Failed to reveal ancient secrets. Please try again.");
    } finally {
      setIsDeepDiving(false);
    }
  };

  const handleAudioNarration = async () => {
    if (!results) return;
    
    if (audioUrl) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }

    setIsPlaying(true);
    
    // Speak the name and the content of the active tab
    let contentToSpeak = `${results.name}. `;
    
    if (activeTab === 'history') {
      contentToSpeak += `History. ${results.summaryHistory}. `;
      if (showDeepDive.history) contentToSpeak += results.fullHistory;
    } else if (activeTab === 'mythology') {
      contentToSpeak += `Mythology. ${results.summaryMythology}. `;
      if (showDeepDive.mythology) contentToSpeak += results.fullMythology;
    } else if (activeTab === 'carving' && results.summaryCarving) {
      contentToSpeak += `Carving Details. ${results.summaryCarving}. `;
      if (showDeepDive.carving && results.fullCarving) contentToSpeak += results.fullCarving;
    } else if (activeTab === 'structure') {
      contentToSpeak += `Architectural Structure. ${results.originalDescription || ''}. ${results.currentCondition || ''}. `;
      if (results.structureParts) {
        contentToSpeak += "Key parts include: " + results.structureParts.map(p => `${p.part_name}, which is ${p.description}`).join(". ");
      }
    } else {
      contentToSpeak += `Special Facts. ${results.didYouKnow.join('. ')}`;
    }

    const url = await generateAudio(contentToSpeak, results.language);
    if (url) {
      setAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(err => {
          console.error("Playback failed", err);
          setIsPlaying(false);
        });
      }
    } else {
      setIsPlaying(false);
      alert("Could not generate audio guide for this section.");
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

  const handleChat = async (message?: string) => {
    const input = message || chatInput;
    if (!input.trim() || !results || isChatting) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    let updatedHistory = [...(results.chatHistory || []), userMsg];
    
    // Trim history if it's too long
    const MAX_HISTORY = 10;
    if (updatedHistory.length > MAX_HISTORY) {
      updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY);
    }

    setResults({ ...results, chatHistory: updatedHistory });
    setChatInput('');
    setIsChatting(true);

    try {
      // Streaming Response for 'Living Stone'
      let streamingAnswer = "";
      const stoneMsg: ChatMessage = { role: 'stone', content: "" };
      
      // Add a placeholder message for the stone
      setResults(prev => {
        if (!prev) return null;
        return { ...prev, chatHistory: [...(prev.chatHistory || []), stoneMsg] };
      });

      const stream = chatWithStoneStream(results, input, updatedHistory);
      
      for await (const chunk of stream) {
        streamingAnswer += chunk;
        setResults(prev => {
          if (!prev) return null;
          const newHistory = [...prev.chatHistory];
          newHistory[newHistory.length - 1] = { ...stoneMsg, content: streamingAnswer };
          return { ...prev, chatHistory: newHistory };
        });
      }

      // After streaming, fetch suggested questions (optional, can be a separate call or static)
      // For now, we'll just keep the existing questions or use a default set
    } catch (error) {
      console.error("Chat failed", error);
    } finally {
      setIsChatting(false);
    }
  };

  const submitStory = () => {
    if (!newStory.title || !newStory.content || !newStory.author) return;
    const story: CommunityStory = {
      id: crypto.randomUUID(),
      ...newStory,
      timestamp: Date.now(),
      upvotes: 0
    };
    setCommunityStories([story, ...communityStories]);
    setShowStoryForm(false);
    setNewStory({ title: '', content: '', author: '', location: '' });
  };

  // Navigation
  const goTo = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-paper shadow-2xl relative overflow-hidden">
      {/* Background Atmosphere */}
      <audio id="bg-atmosphere" loop autoPlay muted={false}>
        <source src="https://assets.mixkit.co/music/preview/mixkit-zen-meditation-109.mp3" type="audio/mpeg" />
      </audio>

      {/* Parchment Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-30 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/parchment.png')]"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-black/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => goTo('home')}>
          <div className="w-8 h-8 bg-maroon rounded-lg flex items-center justify-center text-gold">
            <HistoryIcon size={18} />
          </div>
          <h1 className="text-xl font-serif font-bold text-maroon tracking-tight">StoneStories</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auth Button */}
          {user ? (
            <div className="relative group">
              <button className="w-10 h-10 rounded-full border-2 border-maroon overflow-hidden">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-full h-full object-cover" />
              </button>
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-black/5 p-2 hidden group-hover:block z-50 w-48">
                <div className="px-3 py-2 border-b border-black/5 mb-1">
                  <p className="text-xs font-bold text-maroon truncate">{user.displayName}</p>
                  <p className="text-[10px] text-ink/50 truncate">{user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-maroon/5 text-maroon flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={loginWithGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-maroon text-white rounded-full text-xs font-bold hover:shadow-lg transition-all"
            >
              <LogIn size={14} /> Login
            </button>
          )}

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
              className="px-6 py-8 space-y-12 relative"
            >
              {/* Hero */}
              <div className="space-y-4 text-center relative z-10">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1 }}
                  className="inline-block mb-2"
                >
                  <Sparkles className="text-gold animate-pulse" size={32} />
                </motion.div>
                <h2 className="text-4xl font-serif font-bold text-maroon leading-tight">
                  The Living Stones
                </h2>
                <p className="text-ink/70 text-lg italic font-serif">
                  "I have stood for a thousand years. Let me tell you what I have seen."
                </p>
              </div>

              {/* Main Action */}
              <div className="grid grid-cols-2 gap-4 relative z-10">
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

              {/* Sanskrit Verse Section */}
              <div className="pt-12 border-t border-black/5 text-center space-y-6">
                <div className="inline-block px-4 py-1 bg-maroon/5 rounded-full">
                  <p className="text-[10px] font-bold text-maroon uppercase tracking-[0.2em]">प्राचीनं वैभवम्</p>
                </div>
                <div className="space-y-4">
                  <p className="text-2xl font-serif text-maroon italic leading-relaxed px-4">
                    "शिलापि वदति गाथाम्, <br />
                    या प्रसुप्ता अस्ति हृदये।"
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-8 h-[1px] bg-gold/30"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gold/50"></div>
                    <div className="w-8 h-[1px] bg-gold/30"></div>
                  </div>
                  <p className="text-xs text-ink/50 font-medium tracking-wide max-w-[280px] mx-auto leading-relaxed">
                    "Even the stone tells a story, <br />
                    that lies dormant within its heart."
                  </p>
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

                  <div className="space-y-2 relative">
                    <label className="text-xs font-bold text-maroon uppercase tracking-wider">Location (Optional)</label>
                    <input 
                      type="text" 
                      value={location}
                      onChange={handleLocationChange}
                      onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                      className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 focus:ring-2 ring-maroon/20 outline-none" 
                      placeholder="e.g. Veraval, Gujarat" 
                    />
                    <AnimatePresence>
                      {showSuggestions && locationSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-black/5 z-50 overflow-hidden"
                        >
                          {locationSuggestions.map((feature, idx) => (
                            <button
                              key={idx}
                              onClick={() => selectLocation(feature)}
                              className="w-full text-left px-4 py-3 hover:bg-maroon/5 transition-colors text-sm border-b border-black/5 last:border-0"
                            >
                              <p className="font-bold text-maroon">{feature.properties.name}</p>
                              <p className="text-[10px] text-ink/50">
                                {[feature.properties.city, feature.properties.state, feature.properties.country].filter(Boolean).join(', ')}
                              </p>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {selectedCoords && (
                      <div className="mt-4 h-32 w-full rounded-xl overflow-hidden border border-black/5">
                        <MapContainer center={[selectedCoords.lat, selectedCoords.lon]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={[selectedCoords.lat, selectedCoords.lon]} />
                          <ChangeView center={[selectedCoords.lat, selectedCoords.lon]} />
                        </MapContainer>
                      </div>
                    )}
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

          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="relative w-full max-w-xs aspect-square mb-8 overflow-hidden rounded-2xl border-2 border-maroon/50 shadow-xl">
                {selectedImage && <img src={selectedImage} alt="Analyzing" className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-maroon/20 mix-blend-overlay animate-pulse"></div>
              </div>

              <Loader2 className="animate-spin text-gold mb-4" size={40} />
              <h3 className="text-2xl font-serif text-white mb-2">Analyzing...</h3>
              <p className="text-white/60 text-sm">Identifying heritage in seconds</p>
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

              {/* AI Greeting Section (Immediate Feedback) */}
              {results.greeting && (
                <div className="px-6 py-8 bg-maroon/5 border-b border-maroon/10">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-maroon rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-maroon/20">
                      <Sparkles size={24} className="text-gold" />
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-maroon uppercase tracking-widest">The Living Stone Speaks</h5>
                      <div className="text-ink font-serif italic text-lg leading-relaxed">
                        <Markdown>{results.greeting}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Deep Dive Action (Triggered Deep-Dive) */}
              {!results.wikipediaSummary && (
                <div className="px-6 py-8 bg-gold/10 border-b border-gold/20 text-center space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center text-maroon">
                      <Search size={32} />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-maroon">Ready for a Deep Dive?</h3>
                    <p className="text-sm text-ink/60 max-w-xs mx-auto">
                      Reveal hidden historical records, Wikipedia archives, and detailed iconography analysis.
                    </p>
                  </div>
                  <button 
                    onClick={handleDeepDive}
                    disabled={isDeepDiving}
                    className="w-full py-5 bg-maroon text-white font-bold rounded-2xl shadow-xl shadow-maroon/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeepDiving ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        Consulting Ancient Archives...
                      </>
                    ) : (
                      <>
                        <Sparkles size={24} className="text-gold" />
                        Reveal Ancient Secrets
                      </>
                    )}
                  </button>
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
                  { id: 'history', label: 'History', icon: <HistoryIcon size={16} /> },
                  { id: 'mythology', label: 'Mythology', icon: <BookOpen size={16} /> },
                  { id: 'structure', label: 'Structure', icon: <Layout size={16} /> },
                  ...(results.mode === 'specific' ? [{ id: 'carving', label: 'The Carving', icon: <Plus size={16} /> }] : []),
                  { id: 'chat', label: 'Ask the Stone', icon: <MessageSquare size={16} /> },
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
                      <div className="space-y-8">
                        {/* Historical Gallery */}
                        {results.historicalImages && results.historicalImages.length > 0 && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-maroon uppercase tracking-widest">Historical Gallery</h5>
                            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                              {results.historicalImages.map((img, idx) => (
                                <motion.div 
                                  key={idx}
                                  whileHover={{ scale: 1.05 }}
                                  className="flex-shrink-0 w-48 h-32 rounded-2xl overflow-hidden border border-black/5 shadow-md"
                                >
                                  <img src={img} alt={`Historical ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Map Integration */}
                        {results.coordinates && (
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-maroon uppercase tracking-widest">Sacred Geography</h5>
                            <div className="h-48 w-full rounded-3xl overflow-hidden border border-black/5 shadow-inner relative group">
                              <MapContainer center={[results.coordinates.lat, results.coordinates.lon]} zoom={15} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <Marker position={[results.coordinates.lat, results.coordinates.lon]}>
                                  <Popup>{results.name}</Popup>
                                </Marker>
                              </MapContainer>
                              <div className="absolute top-2 right-2 z-[1000] bg-white/80 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-maroon border border-black/5">
                                {results.coordinates.lat.toFixed(4)}, {results.coordinates.lon.toFixed(4)}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="relative p-6 bg-maroon/5 rounded-3xl border border-maroon/10 overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <HistoryIcon size={80} />
                          </div>
                          <h4 className="text-maroon font-serif font-bold text-lg mb-3 flex items-center gap-2">
                            <Info size={18} className="text-gold" /> Quick Highlights
                          </h4>
                          <p className="text-ink/70 italic leading-relaxed relative z-10">{results.summaryHistory}</p>
                        </div>
                        
                        {results.wikipediaSummary ? (
                          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="p-6 bg-white rounded-3xl border border-black/5 shadow-sm space-y-4">
                              <h4 className="text-maroon font-serif font-bold text-lg flex items-center gap-2">
                                <Globe size={18} className="text-gold" /> From the Archives
                              </h4>
                              <div className="text-ink/80 leading-relaxed text-sm">
                                <Markdown>{results.wikipediaSummary}</Markdown>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-maroon font-serif font-bold text-lg">The Full Chronicle</h4>
                              <div className="text-ink/80 leading-relaxed">
                                <Markdown>{results.fullHistory}</Markdown>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 border-2 border-dashed border-maroon/10 rounded-3xl bg-maroon/5">
                            <p className="text-sm text-ink/40 font-medium">Detailed historical records are locked.</p>
                            <p className="text-xs text-ink/30 mt-1">Use the "Reveal Ancient Secrets" button above to unlock.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'mythology' && (
                      <div className="space-y-8">
                        <div className="relative p-6 bg-gold/5 rounded-3xl border border-gold/20 overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10 text-gold">
                            <BookOpen size={80} />
                          </div>
                          <h4 className="text-maroon font-serif font-bold text-lg mb-3 flex items-center gap-2">
                            <Globe size={18} className="text-gold" /> Divine Essence
                          </h4>
                          <p className="text-ink/70 italic leading-relaxed relative z-10">{results.summaryMythology}</p>
                        </div>
                        
                        {results.wikipediaSummary ? (
                          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="space-y-4">
                              <h4 className="text-maroon font-serif font-bold text-lg">Sacred Lore</h4>
                              <div className="text-ink/80 leading-relaxed">
                                <Markdown>{results.fullMythology}</Markdown>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 border-2 border-dashed border-gold/20 rounded-3xl bg-gold/5">
                            <p className="text-sm text-maroon/60 font-medium">Sacred legends are veiled.</p>
                            <p className="text-xs text-maroon/40 mt-1">Use the "Reveal Ancient Secrets" button above to unlock.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'carving' && results.summaryCarving && (
                      <div className="space-y-8">
                        <div className="relative p-6 bg-maroon/5 rounded-3xl border border-maroon/10 overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Plus size={80} />
                          </div>
                          <h4 className="text-maroon font-serif font-bold text-lg mb-3 flex items-center gap-2">
                            <Info size={18} className="text-gold" /> Artistic Vision
                          </h4>
                          <p className="text-ink/70 italic leading-relaxed relative z-10">{results.summaryCarving}</p>
                        </div>
                        
                        {!showDeepDive.carving ? (
                          <div className="text-center space-y-4">
                            <p className="text-xs text-ink/40 uppercase tracking-widest font-bold">Decode the stone?</p>
                            <button 
                              onClick={() => toggleDeepDive('carving')}
                              className="w-full py-4 bg-maroon text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-maroon/20 transition-all flex items-center justify-center gap-2 group"
                            >
                              <Plus size={20} className="group-hover:scale-110 transition-transform" /> 
                              Reveal Carving Secrets
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between border-b border-maroon/10 pb-4">
                              <h4 className="text-maroon font-serif font-bold text-2xl">The Artisan's Hand</h4>
                              <button onClick={() => toggleDeepDive('carving')} className="text-xs bg-maroon/10 text-maroon px-3 py-1 rounded-full font-bold hover:bg-maroon/20 transition-colors">Collapse</button>
                            </div>
                            <div className="markdown-body">
                              <Markdown>{results.fullCarving}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'structure' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-maroon font-serif font-bold text-2xl">Temple Structure</h4>
                          <span className="text-xs bg-maroon/10 text-maroon px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                            {results.templeType || 'Ancient'} Style
                          </span>
                        </div>
                        
                        {results.structureParts && results.structureParts.length > 0 ? (
                          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-6 bg-maroon/5 rounded-3xl border border-maroon/10">
                                <h5 className="text-maroon font-serif font-bold mb-2">Original Glory</h5>
                                <p className="text-ink/70 text-sm leading-relaxed">{results.originalDescription || 'The original structure was a masterpiece of its era.'}</p>
                              </div>
                              <div className="p-6 bg-gold/5 rounded-3xl border border-gold/20">
                                <h5 className="text-maroon font-serif font-bold mb-2">Current State</h5>
                                <p className="text-ink/70 text-sm leading-relaxed">{results.currentCondition || 'The site stands as a testament to time and history.'}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 border-2 border-dashed border-maroon/10 rounded-3xl bg-maroon/5 space-y-4">
                            <div className="w-16 h-16 bg-maroon/10 rounded-full flex items-center justify-center mx-auto text-maroon">
                              <Layout size={32} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm text-ink/60 font-medium">Architectural blueprints are locked.</p>
                              <p className="text-xs text-ink/40">Use the "Reveal Ancient Secrets" button above to reconstruct the structure.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'chat' && (
                      <div className="space-y-6">
                        <div className="bg-maroon/5 p-4 rounded-2xl border border-maroon/10 space-y-4">
                          <div className="flex items-center gap-2 text-maroon">
                            <Plus size={18} />
                            <h4 className="font-bold text-sm uppercase tracking-wider">Ask the Stone</h4>
                          </div>
                          <p className="text-xs text-ink/60 italic">"I have stood here for centuries. Ask me anything about my secrets, my creators, or the gods I guard."</p>
                        </div>

                        <div 
                          ref={chatScrollRef}
                          className="space-y-4 max-h-[400px] overflow-y-auto p-2 no-scrollbar scroll-smooth"
                        >
                          {results.chatHistory?.map((msg, i) => (
                            <div key={i} className={cn(
                              "flex flex-col gap-1 max-w-[85%]",
                              msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                            )}>
                              <div className={cn(
                                "px-4 py-2 rounded-2xl text-sm",
                                msg.role === 'user' ? "bg-maroon text-white rounded-tr-none" : "bg-sandstone/20 text-ink rounded-tl-none"
                              )}>
                                <div className="markdown-body chat-markdown">
                                  <Markdown>{msg.content}</Markdown>
                                </div>
                              </div>
                              <span className="text-[10px] text-ink/40 uppercase tracking-tighter">
                                {msg.role === 'user' ? 'You' : results.name}
                              </span>
                            </div>
                          ))}
                          {isChatting && (
                            <div className="mr-auto items-start flex flex-col gap-1">
                              <div className="bg-sandstone/20 px-4 py-2 rounded-2xl rounded-tl-none animate-pulse">
                                <Loader2 size={14} className="animate-spin text-maroon" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {results.suggestedQuestions.map((q, i) => (
                              <button
                                key={i}
                                onClick={() => handleChat(q)}
                                className="text-[10px] bg-maroon/5 border border-maroon/10 text-maroon px-3 py-1 rounded-full hover:bg-maroon/10 transition-colors"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                              placeholder="Type your question..."
                              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-maroon transition-colors"
                            />
                            <button
                              onClick={() => handleChat()}
                              disabled={!chatInput.trim() || isChatting}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-maroon disabled:text-ink/20"
                            >
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        </div>
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

          {currentPage === 'journey' && (
            <motion.div
              key="journey"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col bg-paper relative"
            >
              {/* Scroll Background Effect */}
              <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/old-map.png')]"></div>
              </div>

              <div className="relative z-10 p-6 space-y-6 flex-1 flex flex-col">
                <div className="space-y-4">
                  <h2 className="text-3xl font-serif font-bold text-maroon text-center">My Heritage Journey</h2>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-maroon/40" size={18} />
                    <input 
                      type="text"
                      placeholder="Search your journey..."
                      value={journeySearch}
                      onChange={(e) => setJourneySearch(e.target.value)}
                      className="w-full bg-white/80 backdrop-blur-sm border border-maroon/20 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-maroon shadow-sm"
                    />
                  </div>
                </div>

                {/* Timeline Scroll */}
                <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                  <div className="relative pl-8 space-y-8">
                    {/* Timeline Line */}
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-maroon/40 via-maroon/10 to-transparent"></div>

                    {cloudHistory
                      .filter(item => 
                        item.context.siteName.toLowerCase().includes(journeySearch.toLowerCase()) ||
                        item.context.locationName.toLowerCase().includes(journeySearch.toLowerCase())
                      )
                      .map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="relative"
                        >
                          {/* Timeline Dot */}
                          <div className="absolute -left-[25px] top-6 w-4 h-4 rounded-full bg-maroon border-4 border-paper shadow-md z-10"></div>

                          {/* History Card */}
                          <div 
                            onClick={() => {
                              // Quick-Load Action: Populate main states, disable Gemini call
                              const loadedResults: HeritageInfo = {
                                id: item.id,
                                name: item.context.siteName,
                                location: item.context.locationName,
                                summaryHistory: item.content.fullStoryText.substring(0, 200) + "...",
                                fullHistory: item.content.fullStoryText,
                                summaryMythology: "Mythology from history...",
                                fullMythology: "Full mythology from history...",
                                didYouKnow: [],
                                suggestedQuestions: item.content.suggestedQuestions || [],
                                imageUrl: item.media.uploadedImageURL,
                                timestamp: item.meta.timestamp?.toMillis() || Date.now(),
                                mode: 'full',
                                language: item.meta.languageUsed as any,
                                coordinates: item.context.coordinates,
                                wikiThumbnail: item.media.wikiThumbnail,
                                identifiedDeity: item.content.identifiedDeity
                              };
                              setResults(loadedResults);
                              setCurrentPage('results');
                              setActiveTab('history');
                            }}
                            className="bg-white rounded-2xl p-4 border-2 border-maroon/10 shadow-sm hover:shadow-md hover:border-maroon/30 transition-all cursor-pointer group"
                          >
                            <div className="flex gap-4">
                              <div className="relative w-20 h-20 shrink-0">
                                <img 
                                  src={item.media.wikiThumbnail || item.media.uploadedImageURL} 
                                  alt={item.context.siteName}
                                  className="w-full h-full object-cover rounded-xl border border-black/5"
                                />
                                {item.media.wikiThumbnail && (
                                  <div className="absolute -bottom-1 -right-1 bg-gold text-maroon p-1 rounded-md shadow-sm">
                                    <Info size={10} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <h4 className="font-serif font-bold text-maroon text-lg truncate group-hover:text-gold transition-colors">
                                  {item.context.siteName}
                                </h4>
                                <p className="text-[10px] text-ink/60 flex items-center gap-1 truncate">
                                  <MapPin size={10} /> {item.context.locationName}
                                </p>
                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-maroon/40">
                                    {item.meta.timestamp ? new Date(item.meta.timestamp.toMillis()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}
                                  </span>
                                  <ChevronRight size={16} className="text-maroon/20 group-hover:text-maroon transition-colors" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                    {cloudHistory.length === 0 && (
                      <div className="text-center py-20 space-y-4 pr-8">
                        <div className="w-16 h-16 bg-maroon/5 rounded-full flex items-center justify-center mx-auto text-maroon/20">
                          <HistoryIcon size={32} />
                        </div>
                        <p className="text-ink/40 text-sm italic">Your journey is waiting to be written...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'community' && (
            <motion.div
              key="community"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-6 py-8 space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-bold text-maroon">Community Stories</h2>
                <p className="text-ink/60 text-sm">Knowledge shared by priests, elders, and travelers.</p>
              </div>

              <button 
                onClick={() => setShowStoryForm(true)}
                className="w-full py-4 border-2 border-dashed border-maroon/20 rounded-2xl text-maroon font-bold flex items-center justify-center gap-2 hover:bg-maroon/5 transition-all"
              >
                <Plus size={20} /> Share a Story
              </button>

              <div className="space-y-6">
                {communityStories.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-3xl border border-black/5">
                    <p className="text-ink/40 text-sm italic">No stories shared yet. Be the first to tell a legend!</p>
                  </div>
                ) : (
                  communityStories.map((story) => (
                    <div key={story.id} className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gold/20 rounded-full flex items-center justify-center text-maroon">
                            <Users size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-maroon">{story.author}</p>
                            <p className="text-[10px] text-ink/40">{new Date(story.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-maroon">
                          <CheckCircle2 size={14} className="text-gold" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-serif font-bold text-lg text-maroon">{story.title}</h4>
                        <p className="text-sm text-ink/70 leading-relaxed">{story.content}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-black/5">
                        <p className="text-[10px] text-ink/40 flex items-center gap-1">
                          <Info size={10} /> {story.location}
                        </p>
                        <button 
                          onClick={() => {
                            const updated = communityStories.map(s => s.id === story.id ? { ...s, upvotes: s.upvotes + 1 } : s);
                            setCommunityStories(updated);
                          }}
                          className="flex items-center gap-1 text-maroon text-xs font-bold hover:scale-105 transition-transform"
                        >
                          <Plus size={14} /> {story.upvotes} Upvotes
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-black/5 px-6 py-3 flex items-center justify-between z-50">
        {[
          { id: 'home', icon: <Home size={24} />, label: 'Home' },
          { id: 'journey', icon: <HistoryIcon size={24} />, label: 'Journey' },
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

      {/* Story Form Modal */}
      <AnimatePresence>
        {showStoryForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-paper w-full max-w-sm rounded-3xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-serif font-bold text-maroon">Share a Story</h3>
                <button onClick={() => setShowStoryForm(false)} className="text-ink/40 hover:text-maroon">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Story Title"
                  value={newStory.title}
                  onChange={e => setNewStory({...newStory, title: e.target.value})}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-maroon"
                />
                <textarea 
                  placeholder="The story, legend, or secret..."
                  rows={4}
                  value={newStory.content}
                  onChange={e => setNewStory({...newStory, content: e.target.value})}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-maroon resize-none"
                />
                <input 
                  type="text" 
                  placeholder="Your Name (e.g. Pandit Ramesh)"
                  value={newStory.author}
                  onChange={e => setNewStory({...newStory, author: e.target.value})}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-maroon"
                />
                <input 
                  type="text" 
                  placeholder="Location (e.g. Somnath Temple)"
                  value={newStory.location}
                  onChange={e => setNewStory({...newStory, location: e.target.value})}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-maroon"
                />
              </div>

              <button 
                onClick={submitStory}
                className="w-full btn-primary"
              >
                Submit Story
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
