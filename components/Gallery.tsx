'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Download, Film, Play, Scissors } from 'lucide-react';

interface GalleryProps {
  type: 'images' | 'videos';
}

export default function Gallery({ type }: GalleryProps) {
  const { images, videos, clearImages, clearVideos, openVideoInEditor, openImagesInEditor } = useStudio();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = type === 'images' ? images : videos;

  if (items.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
        <div className="text-4xl mb-3">{type === 'images' ? '🖼️' : '🎥'}</div>
        <p className="text-slate-400">
          {type === 'images' ? 'Zatím žádné obrázky.' : 'Zatím žádná videa.'} Vygenerujte první a objeví se tady.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-700 p-4 border-b border-slate-600 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          {type === 'images' ? '🖼️ Vygenerované obrázky' : '🎥 Vygenerovaná videa'} ({items.length})
        </h2>
        <div className="flex items-center gap-2">
          {type === 'images' && images.length >= 2 && (
            <button
              onClick={() => openImagesInEditor(images.map((image) => image.url))}
              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
              title="Vytvořit z obrázků video v editoru"
            >
              <Film className="w-3 h-3" />
              Vytvořit video
            </button>
          )}
          <button
            onClick={() => (type === 'images' ? clearImages() : clearVideos())}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
          >
            Vymazat
          </button>
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item: any) => (
            <div
              key={item.id}
              onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
              className="relative group cursor-pointer"
            >
              {type === 'images' ? (
                <img
                  src={item.url}
                  alt={item.prompt}
                  className="w-full h-32 object-cover rounded bg-slate-700 group-hover:opacity-80 transition-opacity"
                />
              ) : (
                <div className="w-full h-32 bg-slate-700 rounded flex items-center justify-center group-hover:opacity-80 transition-opacity">
                  <div className="text-center">
                    <Play className="w-8 h-8 text-white mx-auto mb-1" />
                    <span
                      className={`text-xs font-semibold ${
                        item.status === 'completed'
                          ? 'text-green-400'
                          : item.status === 'failed'
                          ? 'text-red-400'
                          : 'text-blue-400'
                      }`}
                    >
                      {item.status === 'completed'
                        ? 'Hotovo'
                        : item.status === 'failed'
                        ? 'Chyba'
                        : `${item.progress || 0}%`}
                    </span>
                  </div>
                </div>
              )}

              {/* Overlay */}
              {selectedId === item.id && (
                <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center gap-2">
                  {type === 'images' ? (
                    <a
                      href={item.url}
                      download={`image-${item.id}.png`}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : item.status === 'completed' && item.urls ? (
                    <>
                      <a
                        href={item.urls[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                        onClick={(e) => e.stopPropagation()}
                        title="Přehrát"
                      >
                        <Play className="w-4 h-4" />
                      </a>
                      <button
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVideoInEditor(item.urls[0]);
                        }}
                        title="Upravit v editoru"
                      >
                        <Scissors className="w-4 h-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {/* Prompt Tooltip */}
              {selectedId === item.id && (
                <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 z-10 max-h-20 overflow-y-auto">
                  {item.prompt}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
