export type Language = 'en' | 'hi' | 'gu' | 'ta' | 'bn' | 'mr' | 'te' | 'kn' | 'as' | 'ml' | 'or' | 'pa';

export type Page = 'home' | 'upload' | 'results' | 'library' | 'community' | 'journey';

export type TempleType = 'nagara' | 'dravidian' | 'cave' | 'mughal' | 'buddhist_stupa' | 'jain' | 'unknown';

export interface StructurePart {
  part_name: string;
  local_name: string;
  description: string;
  ritual_significance: string;
  x: number; // 0-100 normalized coordinate
  y: number; // 0-100 normalized coordinate
}

export interface ChatMessage {
  role: 'user' | 'stone';
  content: string;
}

export interface HeritageInfo {
  id: string;
  firestoreId?: string;
  name: string;
  location?: string;
  summaryHistory: string;
  fullHistory: string;
  summaryMythology: string;
  fullMythology: string;
  summaryCarving?: string;
  fullCarving?: string;
  didYouKnow: string[];
  suggestedQuestions: string[];
  greeting?: string;
  chatHistory?: ChatMessage[];
  imageUrl: string;
  timestamp: number;
  mode: 'full' | 'specific';
  language: Language;
  
  // Architectural Visualization Fields
  templeType?: TempleType;
  architecturalPeriod?: string;
  structureParts?: StructurePart[];
  isRuins?: boolean;
  originalDescription?: string;
  currentCondition?: string;
  structureImageUrl?: string;
  historicalImages?: string[];
  coordinates?: { lat: number; lon: number };
  wikipediaSummary?: string;
  wikiThumbnail?: string;
  identifiedDeity?: string | null;
}

export interface CommunityStory {
  id: string;
  title: string;
  author: string;
  content: string;
  location: string;
  timestamp: number;
  upvotes: number;
}
