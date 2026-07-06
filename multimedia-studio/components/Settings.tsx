'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Settings as SettingsIcon, LogOut, Gem, ArrowRight, Shield } from 'lucide-react';

export default function Settings() {
  const { apiKey, setApiKey, gems } = useStudio();
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000"></div>
        </div>

        <div className="relative bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4 inline-block">🎬</div>
            <h1 className="text-3xl font-bold text-white mb-2">Multimedia Studio</h1>
            <p className="text-slate-400">AI-powered image, video & chat</p>
          </div>

          <div className="space-y-5">
            {/* Steps */}
            <div className="space-y-3 bg-slate-900/50 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</div>
                <div>
                  <p className="text-sm text-white font-medium">Get API Key</p>
                  <a href="https://promptchan.com/settings" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">promptchan.com/settings</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</div>
                <div>
                  <p className="text-sm text-white font-medium">Enter Key Below</p>
                  <p className="text-xs text-slate-400">Stored securely in browser</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</div>
                <div>
                  <p className="text-sm text-white font-medium">Buy Gems</p>
                  <a href="https://promptchan.com/gems" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">promptchan.com/gems</a>
                </div>
              </div>
            </div>

            {/* API Key Input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                API Key
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="sk_live_..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition"
              />
              <p className="text-xs text-slate-400 mt-1">Your key is never sent to our servers</p>
            </div>

            {/* Connect Button */}
            <button
              onClick={() => {
                if (tempKey.trim()) {
                  setApiKey(tempKey);
                }
              }}
              disabled={!tempKey.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 group"
            >
              Connect Studio
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {gems > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-700 rounded text-sm">
            <Gem className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-semibold">{gems}</span>
          </div>
        )}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-slate-700 rounded transition-colors"
        >
          <SettingsIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-white mb-4">Settings</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">API Key</label>
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="px-3 py-2 hover:bg-slate-700 rounded text-slate-400 text-sm"
                  >
                    {showKey ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {gems >= 0 && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Gems Balance</label>
                  <div className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white flex items-center gap-2">
                    <Gem className="w-4 h-4 text-yellow-400" />
                    <span>{gems}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (tempKey.trim()) {
                    setApiKey(tempKey);
                  }
                  setShowSettings(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setApiKey('');
                  setShowSettings(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
