export type Language = 'en' | 'hi' | 'gu' | 'ta' | 'bn' | 'mr' | 'te' | 'kn';

export interface HeritageInfo {
  id: string;
  name: string;
  location?: string;
  summaryHistory: string;
  fullHistory: string;
  summaryMythology: string;
  fullMythology: string;
  summaryCarving?: string;
  fullCarving?: string;
  didYouKnow: string[];
  imageUrl: string;
  timestamp: number;
  mode: 'full' | 'specific';
  language: Language;
}

export interface CommunityStory {
  id: string;
  title: string;
  author: string;
  content: string;
  location: string;
  timestamp: number;
}
