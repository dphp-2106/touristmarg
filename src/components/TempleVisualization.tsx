import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { HeritageInfo, StructurePart } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Info, Maximize2, RotateCcw, Eye, EyeOff, X, Box, Camera } from 'lucide-react';

const ModelViewer = 'model-viewer' as any;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TempleVisualizationProps {
  info: HeritageInfo;
}

const TEMPLE_COLORS = {
  sandstone: {
    light: '#D4956A',
    main: '#C4854A',
    dark: '#A36439',
    gold: '#D4A854'
  },
  ruin: {
    light: '#A3A3A3',
    main: '#737373',
    dark: '#525252',
    gold: '#A38A54'
  }
};

export const TempleVisualization: React.FC<TempleVisualizationProps> = ({ info }) => {
  const templeType = info.templeType || 'unknown';
  const parts = info.structureParts || [];
  const [view, setView] = useState<'front' | 'side' | 'top' | 'iso'>('iso');
  const [showOriginal, setShowOriginal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<StructurePart | null>(null);
  const [isIntroPlaying, setIsIntroPlaying] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [cameraOrbit, setCameraOrbit] = useState('0deg 75deg 2.5m');
  const [cameraTarget, setCameraTarget] = useState('0m 0.5m 0m');
  const modelViewerRef = useRef<any>(null);

  // Pre-calculate 3D positions for hotspots to ensure consistency and zoom targets
  const hotspots3D = useMemo(() => {
    return parts.map((part, i) => {
      const phi = (i / parts.length) * Math.PI * 2;
      const x = Math.cos(phi) * 0.5;
      const z = Math.sin(phi) * 0.5;
      const y = 0.5 + (i % 3) * 0.3;
      return {
        part,
        position: `${x}m ${y}m ${z}m`,
        normal: `${x}m ${y}m ${z}m`,
        orbit: `${phi}rad ${Math.PI / 3}rad 1.5m`
      };
    });
  }, [parts]);

  const selectedHotspot = useMemo(() => {
    if (!selectedPart) return null;
    return hotspots3D.find(h => h.part.part_name === selectedPart.part_name);
  }, [selectedPart, hotspots3D]);

  useEffect(() => {
    const timer = setTimeout(() => setIsIntroPlaying(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  // Handle smooth zoom when selectedPart changes
  useEffect(() => {
    if (show3D && modelViewerRef.current && selectedHotspot) {
      setCameraTarget(selectedHotspot.position);
      setCameraOrbit(selectedHotspot.orbit);
    } else if (show3D && modelViewerRef.current && !selectedPart) {
      setCameraTarget('0m 0.5m 0m');
      setCameraOrbit('0deg 75deg 2.5m');
    }
  }, [selectedPart, selectedHotspot, show3D]);

  useEffect(() => {
    const mv = modelViewerRef.current;
    if (!mv) return;

    const onCameraChange = () => {
      // Sync internal state with model-viewer for UI updates if needed
    };

    mv.addEventListener('camera-change', onCameraChange);
    return () => mv.removeEventListener('camera-change', onCameraChange);
  }, [show3D]);

  const renderTempleSVG = () => {
    const colors = showOriginal ? TEMPLE_COLORS.sandstone : (info.isRuins ? TEMPLE_COLORS.ruin : TEMPLE_COLORS.sandstone);
    
    // Animation variants for building up - more solid feel
    const buildUpVariants: Variants = {
      hidden: { scaleY: 0, opacity: 0, y: 50 },
      visible: (i: number) => ({
        scaleY: 1,
        opacity: 1,
        y: 0,
        transition: {
          scaleY: { delay: i * 0.2, duration: 0.8, ease: "easeOut" },
          opacity: { delay: i * 0.2, duration: 0.4 },
          y: { delay: i * 0.2, duration: 0.6 }
        }
      })
    };

    // Detailed Isometric Nagara Paths
    const nagaraPaths = [
      // Base/Adhisthana - Isometric Box
      { d: "M 50 350 L 250 350 L 350 300 L 150 300 Z", label: "Adhisthana", pos: "bottom", type: 'base' },
      { d: "M 50 350 L 50 370 L 250 370 L 250 350 Z", label: "Adhisthana Front", pos: "bottom", type: 'side' },
      { d: "M 250 350 L 250 370 L 350 320 L 350 300 Z", label: "Adhisthana Right", pos: "bottom", type: 'side' },
      
      // Mandapa - Tiered Isometric Box
      { d: "M 80 280 L 180 280 L 230 255 L 130 255 Z", label: "Mandapa", pos: "center_left", type: 'top' },
      { d: "M 80 280 L 80 350 L 180 350 L 180 280 Z", label: "Mandapa Front", pos: "center_left", type: 'side' },
      { d: "M 180 280 L 180 350 L 230 325 L 230 255 Z", label: "Mandapa Right", pos: "center_left", type: 'side' },
      
      // Shikhara (Tower) - Isometric Stepped Pyramid
      { d: "M 200 300 L 320 300 L 370 275 L 250 275 Z", label: "Shikhara Base", pos: "center_right", type: 'base' },
      { d: "M 200 300 L 200 150 Q 260 50 320 150 L 320 300 Z", label: "Shikhara Front", pos: "center_right", type: 'side' },
      { d: "M 320 300 L 320 150 Q 345 100 370 125 L 370 275 Z", label: "Shikhara Right", pos: "center_right", type: 'side' },
      
      // Amalaka (Top) - Detailed Ribbed Disk
      { d: "M 240 60 Q 260 40 280 60 Q 300 80 280 100 Q 260 120 240 100 Q 220 80 240 60", label: "Amalaka", pos: "top", type: 'top' }
    ];

    const dravidianPaths = [
      // Base
      { d: "M 50 350 L 250 350 L 350 300 L 150 300 Z", label: "Adhisthana", pos: "bottom", type: 'base' },
      { d: "M 50 350 L 50 370 L 250 370 L 250 350 Z", label: "Adhisthana Front", pos: "bottom", type: 'side' },
      
      // Mandapa
      { d: "M 80 300 L 180 300 L 230 275 L 130 275 Z", label: "Mandapa", pos: "center_left", type: 'top' },
      { d: "M 80 300 L 80 350 L 180 350 L 180 300 Z", label: "Mandapa Front", pos: "center_left", type: 'side' },
      
      // Vimana (Stepped Tower)
      { d: "M 200 300 L 320 300 L 370 275 L 250 275 Z", label: "Vimana Base", pos: "center_right", type: 'base' },
      { d: "M 200 300 L 200 250 L 320 250 L 320 300 Z", label: "Vimana Tier 1 Front", pos: "center_right", type: 'side' },
      { d: "M 320 300 L 320 250 L 370 225 L 370 275 Z", label: "Vimana Tier 1 Right", pos: "center_right", type: 'side' },
      { d: "M 215 250 L 215 200 L 305 200 L 305 250 Z", label: "Vimana Tier 2 Front", pos: "center_right", type: 'side' },
      { d: "M 305 250 L 305 200 L 345 180 L 345 230 Z", label: "Vimana Tier 2 Right", pos: "center_right", type: 'side' },
      
      // Stupi
      { d: "M 245 170 L 275 170 L 260 140 Z", label: "Stupi", pos: "top", type: 'top' }
    ];

    const stupaPaths = [
      // Base
      { d: "M 50 350 L 350 350 L 350 380 L 50 380 Z", label: "Medhi", pos: "bottom", type: 'base' },
      // Dome/Anda - 3D Sphere Effect
      { d: "M 80 350 A 120 120 0 0 1 320 350 Z", label: "Anda", pos: "center", type: 'side' },
      { d: "M 80 350 A 120 60 0 0 1 320 350 Z", label: "Anda Base", pos: "center", type: 'top' },
      // Harmika
      { d: "M 180 230 L 220 230 L 240 220 L 200 220 Z", label: "Harmika Top", pos: "top_center", type: 'top' },
      { d: "M 180 230 L 180 250 L 220 250 L 220 230 Z", label: "Harmika Front", pos: "top_center", type: 'side' }
    ];

    const mughalPaths = [
      // Base
      { d: "M 50 350 L 350 350 L 350 380 L 50 380 Z", label: "Plinth", pos: "bottom", type: 'base' },
      // Main Iwan
      { d: "M 120 200 L 280 200 L 280 350 L 120 350 Z", label: "Iwan Front", pos: "center", type: 'side' },
      { d: "M 280 200 L 280 350 L 320 330 L 320 180 Z", label: "Iwan Right", pos: "center", type: 'side' },
      // Dome
      { d: "M 140 200 Q 200 100 260 200 Z", label: "Dome Front", pos: "top_center", type: 'side' },
      { d: "M 140 200 Q 200 150 260 200 Z", label: "Dome Base", pos: "top_center", type: 'top' }
    ];

    let activePaths = nagaraPaths;
    if (templeType === 'dravidian') activePaths = dravidianPaths;
    if (templeType === 'buddhist_stupa') activePaths = stupaPaths;
    if (templeType === 'mughal') activePaths = mughalPaths;

    return (
      <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl overflow-visible">
        <defs>
          <linearGradient id="templeGradSide" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.main} />
            <stop offset="100%" stopColor={colors.dark} />
          </linearGradient>
          <linearGradient id="templeGradTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.light} />
            <stop offset="100%" stopColor={colors.main} />
          </linearGradient>
          
          <filter id="stoneTexture" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
            <feDiffuseLighting in="noise" lightingColor="white" surfaceScale="1" result="diffuse">
              <feDistantLight azimuth="45" elevation="60" />
            </feDiffuseLighting>
            <feComposite in="SourceGraphic" in2="diffuse" operator="arithmetic" k1="0.5" k2="0.5" k3="0" k4="0" />
          </filter>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feFlood floodColor={colors.gold} result="flood"/>
            <feComposite in="flood" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <AnimatePresence>
          {activePaths.map((path: any, i) => {
            const isSelected = selectedPart?.part_name.toLowerCase().includes(path.label.toLowerCase());
            const fill = path.type === 'top' ? "url(#templeGradTop)" : "url(#templeGradSide)";
            
            return (
              <motion.path
                key={path.label + i}
                d={path.d}
                fill={fill}
                stroke={colors.gold}
                strokeWidth={isSelected ? 2 : 0.5}
                strokeOpacity={isSelected ? 1 : 0.3}
                variants={buildUpVariants}
                initial="hidden"
                animate="visible"
                custom={i}
                filter={isSelected ? "url(#glow)" : "url(#stoneTexture)"}
                style={{ transformOrigin: 'bottom' }}
                className="cursor-pointer transition-all duration-500"
                onClick={() => {
                  const foundPart = parts.find(p => p.part_name.toLowerCase().includes(path.label.toLowerCase()));
                  if (foundPart) setSelectedPart(foundPart);
                }}
                onMouseEnter={() => {
                  const foundPart = parts.find(p => p.part_name.toLowerCase().includes(path.label.toLowerCase()));
                  if (foundPart) setSelectedPart(foundPart);
                }}
                whileHover={{ 
                  strokeOpacity: 1, 
                  strokeWidth: 3,
                  scale: 1.05,
                  transition: { duration: 0.2 }
                }}
              />
            );
          })}
        </AnimatePresence>

        {/* Labels with lines */}
        {activePaths.map((path, i) => {
          const isSelected = selectedPart?.part_name.toLowerCase().includes(path.label.toLowerCase());
          if (!isSelected) return null;
          
          return (
            <motion.g key={`label-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <line x1="200" y1="200" x2="350" y2="100" stroke={colors.gold} strokeWidth="1" strokeDasharray="4 2" />
              <circle cx="200" cy="200" r="4" fill={colors.gold} />
            </motion.g>
          );
        })}
      </svg>
    );
  };

  const renderVisualization = () => {
    if (show3D) {
      return (
        <div className="w-full h-full relative group/mv bg-gradient-to-b from-[#0E0804] to-[#1a120b]">
          <ModelViewer
            ref={modelViewerRef}
            src="https://modelviewer.dev/shared-assets/models/Astronaut.glb" 
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-placement="floor"
            ar-scale="auto"
            camera-controls
            enable-pan
            touch-action="none"
            camera-orbit={cameraOrbit}
            camera-target={cameraTarget}
            auto-rotate={!selectedPart}
            auto-rotate-delay={3000}
            rotation-speed="0.5"
            shadow-intensity="2"
            environment-image="neutral"
            exposure="1.2"
            shadow-softness="1"
            interpolation-decay="150"
            min-camera-orbit="auto auto 0.2m"
            max-camera-orbit="auto auto 15m"
            interaction-prompt="none"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
            className="transition-all duration-1000"
          >
            {/* Interactive Hotspots mapped to structure parts */}
            {hotspots3D.map((h, i) => {
              const isSelected = selectedPart?.part_name === h.part.part_name;

              return (
                <button
                  key={`hotspot-${i}`}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 border-white shadow-lg transition-all duration-500 flex items-center justify-center group/hotspot",
                    isSelected ? "bg-gold scale-125 z-50 animate-aura" : "bg-maroon/80 hover:bg-gold"
                  )}
                  slot={`hotspot-${i}`}
                  data-position={h.position}
                  data-normal={h.normal}
                  onClick={() => setSelectedPart(isSelected ? null : h.part)}
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full group-hover/hotspot:scale-150 transition-transform" />
                  
                  {/* Label that appears on hover or selection */}
                  <div className={cn(
                    "absolute left-1/2 -translate-x-1/2 bottom-full mb-4 px-4 py-2 bg-black/95 text-gold text-[10px] font-bold rounded-xl border border-gold/40 whitespace-nowrap pointer-events-none transition-all duration-500 shadow-2xl backdrop-blur-md z-[100]",
                    isSelected ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-90 group-hover/hotspot:opacity-100 group-hover/hotspot:translate-y-0 group-hover/hotspot:scale-100"
                  )}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                        {h.part.part_name}
                      </div>
                      {isSelected && (
                        <div className="text-[8px] text-gold/60 font-normal italic">Inspecting...</div>
                      )}
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black/95" />
                  </div>
                </button>
              );
            })}

            <div slot="poster" className="absolute inset-0 flex items-center justify-center bg-[#0E0804]">
              <div className="text-gold/40 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
                <p className="text-[10px] uppercase tracking-widest font-bold">Initializing Neural Render...</p>
              </div>
            </div>

            {/* Ground Pedestal */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-black/20 rounded-full blur-3xl pointer-events-none" />
          </ModelViewer>
          
          {/* 3D View HUD */}
          <div className="absolute top-16 left-4 right-4 flex justify-between items-start pointer-events-none">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/5 space-y-1"
            >
              <p className="text-[8px] text-gold/40 uppercase tracking-widest font-bold">Model Fidelity</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={cn("w-3 h-1 rounded-full", i <= 4 ? "bg-gold" : "bg-gold/20")} />
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-right flex flex-col items-end gap-2"
            >
              <div>
                <p className="text-[8px] text-gold/40 uppercase tracking-widest font-bold">Orientation</p>
                <p className="text-white/80 text-[10px] font-mono">360° AXIAL SCAN</p>
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full border border-gold/20 flex items-center justify-center">
                  <RotateCcw size={12} className="text-gold/40 animate-spin-slow" />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-white/80 font-bold uppercase tracking-tighter">Interactive 3D Active</span>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <div className="text-[8px] text-gold/40 uppercase tracking-widest">Controls</div>
              <div className="flex gap-3 text-[9px] text-white/60">
                <span className="flex items-center gap-1"><Info size={10} /> Drag to Rotate</span>
                <span className="flex items-center gap-1"><Info size={10} /> Scroll to Zoom</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (info.structureImageUrl) {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Pedestal Effect */}
          <div className="absolute bottom-10 w-64 h-8 bg-black/40 blur-xl rounded-[100%]" />
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ 
              opacity: 1,
              scale: selectedPart ? 1.5 : 1,
              x: selectedPart ? (50 - (selectedPart.x || 50)) * 2 : 0,
              y: selectedPart ? (50 - (selectedPart.y || 50)) * 2 : 0,
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="relative"
          >
            <img 
              src={info.structureImageUrl} 
              alt="3D Architectural Render" 
              className="max-h-[350px] w-auto drop-shadow-[0_20px_50px_rgba(212,149,106,0.3)] rounded-lg pointer-events-none"
              referrerPolicy="no-referrer"
            />
            
            {/* Hotspots */}
            {parts.map((part, i) => {
              // Fallback coordinates if missing
              const x = part.x ?? (20 + (i * 15) % 60);
              const y = part.y ?? (30 + (i * 10) % 50);
              
              return (
                <motion.button
                  key={part.part_name + i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPart(part);
                  }}
                  style={{ 
                    left: `${x}%`, 
                    top: `${y}%` 
                  }}
                  className={cn(
                    "absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white/80 flex items-center justify-center transition-all z-40 group",
                    selectedPart?.part_name === part.part_name ? "bg-gold scale-150 shadow-[0_0_35px_#D4A854] animate-aura" : "bg-gold/40 hover:bg-gold hover:scale-125"
                  )}
                  onMouseEnter={() => setSelectedPart(part)}
                >
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 p-3 bg-black/95 text-gold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 border border-gold/40 shadow-2xl font-serif translate-y-2 group-hover:translate-y-0">
                    <p className="font-bold text-xs mb-1 border-b border-gold/20 pb-1">{part.part_name}</p>
                    <p className="text-[9px] text-sandstone/80 leading-tight line-clamp-2">{part.description}</p>
                    <div className="mt-2 flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter text-gold/60">
                      <Info size={8} /> Tap for more
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Click to Explore Hint */}
          {!selectedPart && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-gold/40 text-[10px] tracking-widest uppercase pointer-events-none font-bold"
            >
              Tap the glowing points to zoom
            </motion.div>
          )}

          {selectedPart && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedPart(null)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gold text-maroon rounded-full text-[10px] font-bold tracking-widest uppercase shadow-lg z-50"
            >
              Reset View
            </motion.button>
          )}
        </div>
      );
    }
    return renderTempleSVG();
  };

  return (
    <div className="relative w-full h-[500px] bg-[#0E0804] rounded-3xl overflow-hidden border border-white/5 flex flex-col">
      {/* Cinematic Intro Overlay */}
      <AnimatePresence>
        {isIntroPlaying && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0E0804] flex items-center justify-center p-12 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1 }}
            >
              <h3 className="text-gold font-serif text-3xl mb-4">Architectural Vision</h3>
              <p className="text-sandstone/60 italic">Witness the structure rise from the earth...</p>
              <div className="mt-8 flex justify-center gap-2">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-gold"
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
        <div className="flex gap-2">
          <button 
            onClick={() => setShow3D(!show3D)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full font-serif text-sm transition-all border",
              show3D ? "bg-maroon text-white border-maroon shadow-[0_0_20px_rgba(128,0,0,0.3)]" : "bg-white/5 text-gold border-gold/30"
            )}
          >
            {show3D ? <EyeOff size={16} /> : <Box size={16} />}
            {show3D ? "EXIT 3D" : "REFINED 3D VIEW"}
          </button>

          {!show3D && !info.structureImageUrl && (
            <>
              <button 
                onClick={() => setView('iso')}
                className={cn("p-2 rounded-lg transition-all", view === 'iso' ? "bg-gold text-maroon" : "bg-white/5 text-gold")}
              >
                <Maximize2 size={18} />
              </button>
              <button 
                onClick={() => setView('front')}
                className={cn("p-2 rounded-lg transition-all", view === 'front' ? "bg-gold text-maroon" : "bg-white/5 text-gold")}
              >
                <RotateCcw size={18} className="rotate-90" />
              </button>
            </>
          )}
          {!show3D && info.structureImageUrl && (
            <div className="px-3 py-1 bg-gold/10 border border-gold/30 rounded-full text-gold text-[10px] tracking-widest uppercase font-bold">
              3D Architectural Render
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {show3D && (
            <div className="flex gap-2">
              <button 
                className="bg-white/10 hover:bg-white/20 text-gold p-2 rounded-full transition-all"
                title="Reset View"
                onClick={() => {
                  setSelectedPart(null);
                  setCameraTarget('0m 0.5m 0m');
                  setCameraOrbit('0deg 75deg 2.5m');
                }}
              >
                <RotateCcw size={16} />
              </button>
              <button 
                className="bg-gold text-maroon px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                onClick={() => {
                  const mv = document.querySelector('model-viewer') as any;
                  if (mv) mv.activateAR();
                }}
              >
                <Camera size={14} /> LAUNCH AR
              </button>
            </div>
          )}

          {info.isRuins && (
            <button 
              onClick={() => setShowOriginal(!showOriginal)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full font-serif text-sm transition-all border",
                showOriginal ? "bg-gold text-maroon border-gold" : "bg-white/5 text-gold border-gold/30"
              )}
            >
              {showOriginal ? <EyeOff size={16} /> : <Eye size={16} />}
              {showOriginal ? "SHOW RUINS" : "ORIGINAL GLORY"}
            </button>
          )}
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 relative flex items-center justify-center p-8">
        <motion.div 
          key={view + (info.structureImageUrl ? 'img' : 'svg')}
          initial={{ rotateY: view === 'iso' && !info.structureImageUrl ? 45 : 0, scale: 0.8, opacity: 0 }}
          animate={{ rotateY: view === 'iso' && !info.structureImageUrl ? 45 : 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-full h-full max-w-md"
        >
          {renderVisualization()}
        </motion.div>

        {/* Interactive Tooltip/Panel */}
        <AnimatePresence>
          {selectedPart && (
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                className="absolute right-4 top-20 bottom-4 w-72 bg-black/90 backdrop-blur-xl border border-gold/40 rounded-3xl p-6 overflow-y-auto no-scrollbar z-20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50" />
                
                <button 
                  onClick={() => setSelectedPart(null)}
                  className="absolute top-4 right-4 text-gold/50 hover:text-gold transition-colors"
                >
                  <X size={24} />
                </button>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-gold font-serif text-2xl mb-1 leading-tight">{selectedPart.part_name}</h4>
                    <p className="text-gold/40 text-[10px] uppercase tracking-[0.2em] font-bold">{selectedPart.local_name}</p>
                  </div>
                  
                  <div className="h-px bg-gold/10 w-full" />

                  <div className="space-y-6">
                    <section className="space-y-2">
                      <h5 className="text-gold/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 bg-gold rounded-full" />
                        The Architecture
                      </h5>
                      <p className="text-sandstone/80 text-sm leading-relaxed font-light italic">
                        {selectedPart.description}
                      </p>
                    </section>

                    <section className="space-y-2">
                      <h5 className="text-gold/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 bg-gold rounded-full" />
                        Sacred Purpose
                      </h5>
                      <div className="p-4 bg-gold/5 rounded-2xl border border-gold/10">
                        <p className="text-gold/90 text-xs leading-relaxed">
                          {selectedPart.ritual_significance}
                        </p>
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Info Bar */}
      <div className="bg-black/40 backdrop-blur-sm p-4 border-t border-white/5">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="text-gold font-serif text-xl capitalize">{templeType.replace('_', ' ')} Style</h3>
            <p className="text-sandstone/60 text-xs">{info.architecturalPeriod || 'Ancient Era'}</p>
          </div>
          <div className="text-right">
            <p className="text-gold/40 text-[10px] uppercase tracking-tighter">Current Condition</p>
            <p className="text-sandstone/80 text-xs">{info.currentCondition || 'Well Preserved'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
