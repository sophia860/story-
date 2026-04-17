export type StoryMode = 'single' | 'arc';
export type StoryTone = 'VERY GENTLE' | 'BALANCED' | 'HONEST AND BRAVE' | string;

export interface Story {
  id?: string;
  authorUid: string;
  childName: string;
  childAge: string;
  parentInput: string;
  mode: StoryMode;
  timeframe?: string;
  tone: StoryTone;
  coverImage?: string;
  title: string;
  content: string;
  parentScript?: string;
  createdAt: string;
  isArc: boolean;
  arcData?: string; // JSON string for Multi-Night Arc
}

export interface ArcNight {
  title: string;
  story: string;
  parentNote: string;
}

export interface StoryArc {
  title: string;
  parentNote: string;
  nights: ArcNight[];
}
