'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStudio } from '@/lib/store';
import Settings from '@/components/Settings';
import ImageGenerator from '@/components/ImageGenerator';
import VideoGenerator from '@/components/VideoGenerator';
import ChatInterface from '@/components/ChatInterface';
import Gallery from '@/components/Gallery';
import AuthGate from '@/components/AuthGate';

// FFmpeg (WebAssembly + Web Worker) only runs in the browser.
const VideoEditor = dynamic(() => import('@/components/VideoEditor'), { ssr: false });

function Studio() {
  const [mounted, setMounted] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);
  const { activeTab, setActiveTab, apiKey } = useStudio();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mount the editor on first visit, then keep it mounted so work survives tab switches.
  useEffect(() => {
    if (activeTab === 'editor') setEditorOpened(true);
  }, [activeTab]);

  if (!mounted) return null;

  if (!apiKey) {
    return <Settings />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎬</div>
              <div>
                <h1 className="text-2xl font-bold text-white">Multimedia Studio</h1>
                <p className="text-sm text-slate-400">Generování, střih a export na jednom místě</p>
              </div>
            </div>
            <Settings />
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto">
              {(['images', 'videos', 'editor', 'chat'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'text-blue-400 border-blue-400'
                      : 'text-slate-400 border-transparent hover:text-slate-300'
                  }`}
                >
                  {tab === 'images' && '🖼️ Obrázky'}
                  {tab === 'videos' && '🎥 Videa'}
                  {tab === 'editor' && '✂️ Editor'}
                  {tab === 'chat' && '💬 Chat'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="px-6 py-8">
          {activeTab === 'images' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ImageGenerator />
              </div>
              <div className="lg:col-span-2">
                <Gallery type="images" />
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <VideoGenerator />
              </div>
              <div className="lg:col-span-2">
                <Gallery type="videos" />
              </div>
            </div>
          )}

          {editorOpened && (
            <div className={activeTab === 'editor' ? '' : 'hidden'}>
              <VideoEditor />
            </div>
          )}

          {activeTab === 'chat' && <ChatInterface />}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <Studio />
    </AuthGate>
  );
}
