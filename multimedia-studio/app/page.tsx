'use client';

import { useEffect, useState } from 'react';
import { useStudio } from '@/lib/store';
import Settings from '@/components/Settings';
import ImageGenerator from '@/components/ImageGenerator';
import VideoGenerator from '@/components/VideoGenerator';
import ChatInterface from '@/components/ChatInterface';
import Gallery from '@/components/Gallery';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { activeTab, setActiveTab, apiKey } = useStudio();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!apiKey) {
    return <Settings />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <header className="border-b border-slate-700/50 bg-slate-900/30 backdrop-blur-md sticky top-0 z-40">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🎬</div>
              <div>
                <h1 className="text-2xl font-bold text-white">Multimedia Studio</h1>
                <p className="text-sm text-slate-400">AI-powered creation platform</p>
              </div>
            </div>
            <Settings />
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="border-b border-slate-700/50 bg-slate-800/20 backdrop-blur-sm">
          <div className="px-6">
            <div className="flex gap-2">
              {(['images', 'videos', 'chat'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-4 font-semibold transition-all border-b-2 text-sm ${
                    activeTab === tab
                      ? 'text-blue-400 border-blue-400 bg-blue-400/5'
                      : 'text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-700/20'
                  }`}
                >
                  {tab === 'images' && '🖼️ Images'}
                  {tab === 'videos' && '🎥 Videos'}
                  {tab === 'chat' && '💬 Chat'}
                </button>
              ))}
            </div>
          </div>
        </nav>

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

          {activeTab === 'chat' && <ChatInterface />}
        </main>
      </div>
    </div>
  );
}
