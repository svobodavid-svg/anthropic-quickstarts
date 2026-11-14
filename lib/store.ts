import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account, Catalog } from './promptchan-client';

export interface ImageItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  params: any;
  /** Promptchan image id; a saved image can be animated or used as a character. */
  imageId?: string;
  saved?: boolean;
}

export interface VideoItem {
  id: string;
  requestId: string;
  prompt: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  urls?: string[];
  params: any;
  /** Promptchan video id of a finished video, needed to extend it. */
  videoId?: string;
  failureReason?: string;
  queuePosition?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type StudioTab = 'images' | 'videos' | 'editor' | 'chat';

interface StudioStore {
  apiKey: string;
  setApiKey: (key: string) => void;

  images: ImageItem[];
  addImage: (image: ImageItem) => void;
  clearImages: () => void;

  videos: VideoItem[];
  addVideo: (video: VideoItem) => void;
  updateVideo: (id: string, updates: Partial<VideoItem>) => void;
  clearVideos: () => void;

  chatHistory: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  gems: number;
  setGems: (gems: number) => void;

  catalog: Catalog | null;
  setCatalog: (catalog: Catalog | null) => void;
  account: Account | null;
  setAccount: (account: Account | null) => void;

  /** Saved image picked in the gallery to be animated in the video form. */
  animateImageId: string | null;
  animateImage: (imageId: string | null) => void;

  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;

  // Media handed over from the gallery to the video editor.
  editorVideoUrl: string | null;
  editorImageUrls: string[];
  openVideoInEditor: (url: string) => void;
  openImagesInEditor: (urls: string[]) => void;
  clearEditorHandoff: () => void;
}

export const useStudio = create<StudioStore>()(
  persist(
    (set) => ({
  apiKey: typeof window !== 'undefined' ? localStorage.getItem('promptchan_api_key') || '' : '',
  setApiKey: (key) => {
    set({ apiKey: key });
    if (typeof window !== 'undefined') {
      localStorage.setItem('promptchan_api_key', key);
    }
  },

  images: [],
  addImage: (image) => set((state) => ({ images: [image, ...state.images] })),
  clearImages: () => set({ images: [] }),

  videos: [],
  addVideo: (video) => set((state) => ({ videos: [video, ...state.videos] })),
  updateVideo: (id, updates) =>
    set((state) => ({
      videos: state.videos.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    })),
  clearVideos: () => set({ videos: [] }),

  chatHistory: [],
  addChatMessage: (message) => set((state) => ({ chatHistory: [...state.chatHistory, message] })),
  clearChat: () => set({ chatHistory: [] }),

  gems: 0,
  setGems: (gems) => set({ gems }),

  catalog: null,
  setCatalog: (catalog) => set({ catalog }),
  account: null,
  setAccount: (account) => set(account ? { account, gems: account.gems } : { account }),

  animateImageId: null,
  animateImage: (imageId) => set(imageId ? { animateImageId: imageId, activeTab: 'videos' } : { animateImageId: null }),

  activeTab: 'images',
  setActiveTab: (tab) => set({ activeTab: tab }),

  editorVideoUrl: null,
  editorImageUrls: [],
  openVideoInEditor: (url) => set({ editorVideoUrl: url, activeTab: 'editor' }),
  openImagesInEditor: (urls) => set({ editorImageUrls: urls, activeTab: 'editor' }),
  clearEditorHandoff: () => set({ editorVideoUrl: null, editorImageUrls: [] }),
    }),
    {
      name: 'multimedia-studio',
      // Keep the gallery across reloads. Only entries that are links are stored: images
      // returned inline (base64) would overflow localStorage, and the links themselves
      // expire at the provider (videos after 48 hours).
      partialize: (state) => ({
        images: state.images.filter((image) => image.url.startsWith('http')).slice(0, 60),
        videos: state.videos.slice(0, 60),
      }),
    }
  )
);
