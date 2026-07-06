'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Star, Trash2, Plus, Save } from 'lucide-react';

export default function Presets() {
  const { presets, addPreset, deletePreset, togglePresetFavorite } = useStudio();
  const [showSave, setShowSave] = useState(false);
  const [presetName, setPresetName] = useState('');

  const favoritePresets = presets.filter((p) => p.favorite);

  const handleSavePreset = (type: 'image' | 'video', params: any) => {
    if (presetName.trim()) {
      addPreset({
        id: Math.random().toString(36).substr(2, 9),
        name: presetName,
        type,
        params,
        timestamp: Date.now(),
        favorite: false,
      });
      setPresetName('');
      setShowSave(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Quick Presets</h3>
        <button
          onClick={() => setShowSave(!showSave)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Save Preset
        </button>
      </div>

      {showSave && (
        <div className="bg-slate-900/50 p-3 rounded border border-slate-600">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {favoritePresets.map((preset) => (
          <div key={preset.id} className="bg-slate-900/50 p-3 rounded border border-slate-600 hover:border-slate-500 group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-slate-300 truncate">{preset.name}</span>
              <button
                onClick={() => togglePresetFavorite(preset.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
              </button>
            </div>
            <button
              onClick={() => deletePreset(preset.id)}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        ))}
      </div>

      {presets.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">No presets saved yet</p>
      )}
    </div>
  );
}
