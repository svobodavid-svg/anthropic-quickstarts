import { create } from 'zustand';

// Core Data Types
export interface ImageItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  params: any;
  collectionId?: string;
  tags: string[];
  favorite: boolean;
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
  collectionId?: string;
  tags: string[];
  favorite: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// #2 Projects & Presets
export interface Preset {
  id: string;
  name: string;
  type: 'image' | 'video';
  params: any;
  thumbnail?: string;
  timestamp: number;
  favorite: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'image' | 'video';
  settings: any;
  timestamp: number;
  lastModified: number;
  color?: string;
}

// #6 Collections
export interface Collection {
  id: string;
  name: string;
  description?: string;
  imageIds: string[];
  videoIds: string[];
  color?: string;
  timestamp: number;
  itemCount: number;
}

// #5 Analytics
export interface AnalyticsData {
  totalGems: number;
  gemsByDate: { date: string; gems: number }[];
  generationCount: { images: number; videos: number };
  styleUsage: { [key: string]: number };
  filterUsage: { [key: string]: number };
}

// #3 Batch Jobs
export interface BatchJob {
  id: string;
  type: 'image' | 'video';
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  params: any[];
  timestamp: number;
}

interface StudioStore {
  // Auth & Core
  apiKey: string;
  setApiKey: (key: string) => void;

  // Content
  images: ImageItem[];
  addImage: (image: ImageItem) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  deleteImage: (id: string) => void;
  clearImages: () => void;

  videos: VideoItem[];
  addVideo: (video: VideoItem) => void;
  updateVideo: (id: string, updates: Partial<VideoItem>) => void;
  deleteVideo: (id: string) => void;
  clearVideos: () => void;

  chatHistory: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  gems: number;
  setGems: (gems: number) => void;
  gemsSpent: number;
  addGemsSpent: (amount: number) => void;

  // #2 Projects & Presets
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  presets: Preset[];
  addPreset: (preset: Preset) => void;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  togglePresetFavorite: (id: string) => void;

  // #3 Batch Generation
  batchJobs: BatchJob[];
  addBatchJob: (job: BatchJob) => void;
  updateBatchJob: (id: string, updates: Partial<BatchJob>) => void;
  deleteBatchJob: (id: string) => void;

  // #5 Analytics
  analytics: AnalyticsData;
  recordGeneration: (type: 'image' | 'video', cost: number, params: any) => void;

  // #6 Collections
  collections: Collection[];
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (collectionId: string, itemId: string, type: 'image' | 'video') => void;
  removeFromCollection: (collectionId: string, itemId: string) => void;

  // Search & Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;

  activeTab: 'images' | 'videos' | 'chat' | 'projects' | 'analytics' | 'collections';
  setActiveTab: (tab: any) => void;
}

export const useStudio = create<StudioStore>((set) => {
  const getStoredValue = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const saveToStorage = (key: string, value: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  return {
    // Auth & Core
    apiKey: getStoredValue('promptchan_api_key', ''),
    setApiKey: (key) => {
      set({ apiKey: key });
      saveToStorage('promptchan_api_key', key);
    },

    // Content
    images: getStoredValue('studio_images', []),
    addImage: (image) =>
      set((state) => {
        const newImages = [image, ...state.images];
        saveToStorage('studio_images', newImages);
        return { images: newImages };
      }),
    updateImage: (id, updates) =>
      set((state) => {
        const newImages = state.images.map((img) => (img.id === id ? { ...img, ...updates } : img));
        saveToStorage('studio_images', newImages);
        return { images: newImages };
      }),
    deleteImage: (id) =>
      set((state) => {
        const newImages = state.images.filter((img) => img.id !== id);
        saveToStorage('studio_images', newImages);
        return { images: newImages };
      }),
    clearImages: () => {
      set({ images: [] });
      saveToStorage('studio_images', []);
    },

    videos: getStoredValue('studio_videos', []),
    addVideo: (video) =>
      set((state) => {
        const newVideos = [video, ...state.videos];
        saveToStorage('studio_videos', newVideos);
        return { videos: newVideos };
      }),
    updateVideo: (id, updates) =>
      set((state) => {
        const newVideos = state.videos.map((v) => (v.id === id ? { ...v, ...updates } : v));
        saveToStorage('studio_videos', newVideos);
        return { videos: newVideos };
      }),
    deleteVideo: (id) =>
      set((state) => {
        const newVideos = state.videos.filter((v) => v.id !== id);
        saveToStorage('studio_videos', newVideos);
        return { videos: newVideos };
      }),
    clearVideos: () => {
      set({ videos: [] });
      saveToStorage('studio_videos', []);
    },

    chatHistory: [],
    addChatMessage: (message) => set((state) => ({ chatHistory: [...state.chatHistory, message] })),
    clearChat: () => set({ chatHistory: [] }),

    gems: 0,
    setGems: (gems) => set({ gems }),
    gemsSpent: getStoredValue('gems_spent', 0),
    addGemsSpent: (amount) =>
      set((state) => {
        const newTotal = state.gemsSpent + amount;
        saveToStorage('gems_spent', newTotal);
        return { gemsSpent: newTotal };
      }),

    // #2 Projects & Presets
    projects: getStoredValue('studio_projects', []),
    addProject: (project) =>
      set((state) => {
        const newProjects = [project, ...state.projects];
        saveToStorage('studio_projects', newProjects);
        return { projects: newProjects };
      }),
    updateProject: (id, updates) =>
      set((state) => {
        const newProjects = state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, lastModified: Date.now() } : p
        );
        saveToStorage('studio_projects', newProjects);
        return { projects: newProjects };
      }),
    deleteProject: (id) =>
      set((state) => {
        const newProjects = state.projects.filter((p) => p.id !== id);
        saveToStorage('studio_projects', newProjects);
        return { projects: newProjects };
      }),

    presets: getStoredValue('studio_presets', []),
    addPreset: (preset) =>
      set((state) => {
        const newPresets = [preset, ...state.presets];
        saveToStorage('studio_presets', newPresets);
        return { presets: newPresets };
      }),
    updatePreset: (id, updates) =>
      set((state) => {
        const newPresets = state.presets.map((p) => (p.id === id ? { ...p, ...updates } : p));
        saveToStorage('studio_presets', newPresets);
        return { presets: newPresets };
      }),
    deletePreset: (id) =>
      set((state) => {
        const newPresets = state.presets.filter((p) => p.id !== id);
        saveToStorage('studio_presets', newPresets);
        return { presets: newPresets };
      }),
    togglePresetFavorite: (id) =>
      set((state) => {
        const newPresets = state.presets.map((p) =>
          p.id === id ? { ...p, favorite: !p.favorite } : p
        );
        saveToStorage('studio_presets', newPresets);
        return { presets: newPresets };
      }),

    // #3 Batch Generation
    batchJobs: [],
    addBatchJob: (job) => set((state) => ({ batchJobs: [job, ...state.batchJobs] })),
    updateBatchJob: (id, updates) =>
      set((state) => ({
        batchJobs: state.batchJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
      })),
    deleteBatchJob: (id) =>
      set((state) => ({
        batchJobs: state.batchJobs.filter((j) => j.id !== id),
      })),

    // #5 Analytics
    analytics: getStoredValue('studio_analytics', {
      totalGems: 0,
      gemsByDate: [],
      generationCount: { images: 0, videos: 0 },
      styleUsage: {},
      filterUsage: {},
    }),
    recordGeneration: (type, cost, params) =>
      set((state) => {
        const today = new Date().toISOString().split('T')[0];
        const newAnalytics = { ...state.analytics };
        newAnalytics.totalGems += cost;
        newAnalytics.generationCount[type]++;

        const dateEntry = newAnalytics.gemsByDate.find((d) => d.date === today);
        if (dateEntry) {
          dateEntry.gems += cost;
        } else {
          newAnalytics.gemsByDate.push({ date: today, gems: cost });
        }

        if (params.style) {
          newAnalytics.styleUsage[params.style] =
            (newAnalytics.styleUsage[params.style] || 0) + 1;
        }
        if (params.filter) {
          newAnalytics.filterUsage[params.filter] =
            (newAnalytics.filterUsage[params.filter] || 0) + 1;
        }

        saveToStorage('studio_analytics', newAnalytics);
        return { analytics: newAnalytics };
      }),

    // #6 Collections
    collections: getStoredValue('studio_collections', []),
    addCollection: (collection) =>
      set((state) => {
        const newCollections = [collection, ...state.collections];
        saveToStorage('studio_collections', newCollections);
        return { collections: newCollections };
      }),
    updateCollection: (id, updates) =>
      set((state) => {
        const newCollections = state.collections.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        );
        saveToStorage('studio_collections', newCollections);
        return { collections: newCollections };
      }),
    deleteCollection: (id) =>
      set((state) => {
        const newCollections = state.collections.filter((c) => c.id !== id);
        saveToStorage('studio_collections', newCollections);
        return { collections: newCollections };
      }),
    addToCollection: (collectionId, itemId, type) =>
      set((state) => {
        const newCollections = state.collections.map((c) => {
          if (c.id === collectionId) {
            const ids = type === 'image' ? [...c.imageIds, itemId] : [...c.videoIds, itemId];
            return {
              ...c,
              [type === 'image' ? 'imageIds' : 'videoIds']: ids,
              itemCount: c.itemCount + 1,
            };
          }
          return c;
        });
        saveToStorage('studio_collections', newCollections);
        return { collections: newCollections };
      }),
    removeFromCollection: (collectionId, itemId) =>
      set((state) => {
        const newCollections = state.collections.map((c) => {
          if (c.id === collectionId) {
            return {
              ...c,
              imageIds: c.imageIds.filter((id) => id !== itemId),
              videoIds: c.videoIds.filter((id) => id !== itemId),
              itemCount: Math.max(0, c.itemCount - 1),
            };
          }
          return c;
        });
        saveToStorage('studio_collections', newCollections);
        return { collections: newCollections };
      }),

    // Search & Filter
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),
    selectedTags: [],
    toggleTag: (tag) =>
      set((state) => ({
        selectedTags: state.selectedTags.includes(tag)
          ? state.selectedTags.filter((t) => t !== tag)
          : [...state.selectedTags, tag],
      })),

    activeTab: 'images',
    setActiveTab: (tab) => set({ activeTab: tab }),
  };
});
