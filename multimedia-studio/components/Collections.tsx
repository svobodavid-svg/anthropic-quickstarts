'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Plus, Trash2, Tag } from 'lucide-react';

const COLORS = ['red', 'blue', 'green', 'purple', 'yellow', 'pink', 'indigo', 'cyan'];

export default function Collections() {
  const { collections, addCollection, deleteCollection, images, videos } = useStudio();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (name.trim()) {
      addCollection({
        id: Math.random().toString(36).substr(2, 9),
        name,
        color,
        imageIds: [],
        videoIds: [],
        timestamp: Date.now(),
        itemCount: 0,
      });
      setName('');
      setShowNew(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Collections</h3>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      {showNew && (
        <div className="bg-slate-900/50 p-3 rounded border border-slate-600 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collection name..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full bg-${c}-500 ${color === c ? 'ring-2 ring-white' : ''}`}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm py-1.5 rounded transition-colors"
          >
            Create
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {collections.map((col) => (
          <div
            key={col.id}
            className={`bg-slate-900/50 p-3 rounded border border-l-4 border-l-${col.color}-500 border-r-slate-600 border-t-slate-600 border-b-slate-600 group hover:bg-slate-800/50 transition-colors`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white">{col.name}</span>
              <button
                onClick={() => deleteCollection(col.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="text-xs text-slate-400">
              <Tag className="w-3 h-3 inline mr-1" />
              {col.itemCount} items
            </div>
          </div>
        ))}
      </div>

      {collections.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">No collections yet</p>
      )}
    </div>
  );
}
