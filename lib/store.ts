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
  starred?: boolean;
  /** Copy kept in the private cloud bucket (survives the provider's expiring links). */
  cloudPath?: string;
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
  cloudPath?: string;
  failureReason?: string;
  queuePosition?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SavedCharacter {
  id: string;
  name: string;
  note: string;
  imageId: string;
  url: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  goal: string;
  maxImages: number;
  maxVideos: number;
}

/** Export target chosen in the gallery; applied to the editor when media is handed over. */
export type EditorPreset = 'reel' | 'youtube' | 'post' | 'square' | null;

export type StudioTab = 'images' | 'videos' | 'editor' | 'chat' | 'agent';

interface StudioStore {
  apiKey: string;
  setApiKey: (key: string) => void;

  images: ImageItem[];
  addImage: (image: ImageItem) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
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
  /** Why the account could not be loaded, shown next to the balance. */
  accountError: string | null;
  setAccountError: (e: string | null) => void;
  accountReload: number;
  reloadAccount: () => void;
  setAccount: (account: Account | null) => void;

  /** Saved image picked in the gallery to be animated in the video form. */
  animateImageId: string | null;
  animateImage: (imageId: string | null) => void;

  /** Saved image whose character new generations should keep (AI Character). */
  characterImageId: string | null;
  setCharacter: (imageId: string | null) => void;

  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;

  // Media handed over from the gallery to the video editor.
  editorVideoUrl: string | null;
  editorImageUrls: string[];
  editorPreset: EditorPreset;
  exportPreset: EditorPreset;
  setExportPreset: (preset: EditorPreset) => void;
  openVideoInEditor: (url: string, preset?: EditorPreset) => void;
  openImagesInEditor: (urls: string[], preset?: EditorPreset) => void;

  autoCloud: boolean;
  setAutoCloud: (on: boolean) => void;

  lastImageCost: number | null;
  setLastImageCost: (gems: number) => void;

  characters: SavedCharacter[];
  saveCharacter: (c: SavedCharacter) => void;
  removeCharacter: (id: string) => void;

  templates: AgentTemplate[];
  saveTemplate: (t: AgentTemplate) => void;
  removeTemplate: (id: string) => void;
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
  updateImage: (id, updates) =>
    set((state) => ({ images: state.images.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
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
  accountError: null,
  setAccountError: (e) => set({ accountError: e }),
  accountReload: 0,
  reloadAccount: () => set((state) => ({ accountReload: state.accountReload + 1 })),
  setAccount: (account) => set(account ? { account, gems: account.gems } : { account }),

  characterImageId: null,
  setCharacter: (imageId) => set(imageId ? { characterImageId: imageId, activeTab: 'images' } : { characterImageId: null }),

  animateImageId: null,
  animateImage: (imageId) => set(imageId ? { animateImageId: imageId, activeTab: 'videos' } : { animateImageId: null }),

  activeTab: 'images',
  setActiveTab: (tab) => set({ activeTab: tab }),

  editorVideoUrl: null,
  editorImageUrls: [],
  editorPreset: null,
  exportPreset: null,
  setExportPreset: (preset) => set({ exportPreset: preset }),
  openVideoInEditor: (url, preset) =>
    set((state) => ({ editorVideoUrl: url, editorPreset: preset ?? state.exportPreset, activeTab: 'editor' })),
  openImagesInEditor: (urls, preset) =>
    set((state) => ({ editorImageUrls: urls, editorPreset: preset ?? state.exportPreset, activeTab: 'editor' })),
  clearEditorHandoff: () => set({ editorVideoUrl: null, editorImageUrls: [], editorPreset: null }),

  autoCloud: false,
  setAutoCloud: (on) => set({ autoCloud: on }),

  lastImageCost: null,
  setLastImageCost: (gems) => set({ lastImageCost: gems }),

  characters: [],
  saveCharacter: (c) => set((state) => ({ characters: [c, ...state.characters.filter((x) => x.imageId !== c.imageId)] })),
  removeCharacter: (id) => set((state) => ({ characters: state.characters.filter((c) => c.id !== id) })),

  templates: [],
  saveTemplate: (t) => set((state) => ({ templates: [t, ...state.templates.filter((x) => x.id !== t.id)] })),
  removeTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
    }),
    {
      name: 'multimedia-studio',
      // Keep the gallery across reloads. Only entries that are links are stored: images
      // returned inline (base64) would overflow localStorage, and the links themselves
      // expire at the provider (videos after 48 hours).
      partialize: (state) => ({
        images: state.images.filter((image) => image.url.startsWith('http')).slice(0, 60),
        videos: state.videos.slice(0, 60),
        autoCloud: state.autoCloud,
        lastImageCost: state.lastImageCost,
        characters: state.characters,
        templates: state.templates,
      }),
    }
  )
);
