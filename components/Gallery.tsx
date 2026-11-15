'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Cloud, Download, FastForward, Film, Play, Scissors, Sparkles, Star, User } from 'lucide-react';
import { cloudEnabled, saveToCloud } from '@/lib/cloudGallery';
import { createClient, describeError } from '@/lib/promptchan-client';

interface GalleryProps {
  type: 'images' | 'videos';
}

export default function Gallery({ type }: GalleryProps) {
  const { apiKey, images, videos, addVideo, clearImages, clearVideos, openVideoInEditor, openImagesInEditor, animateImage, setCharacter,
    updateImage, updateVideo, exportPreset, setExportPreset, autoCloud, setAutoCloud } = useStudio();
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  /** Continue a finished video by about six seconds; the new part arrives as its own video. */
  const handleExtend = async (item: { videoId?: string; prompt: string }) => {
    if (!item.videoId) return;
    setNotice('');
    try {
      const result = await createClient(apiKey).extendVideo({ video_id: item.videoId, mode: 'continue' });
      addVideo({
        id: `${Date.now()}`,
        requestId: result.request_id,
        prompt: `Pokračování: ${item.prompt}`,
        timestamp: Date.now(),
        status: 'pending',
        progress: 0,
        params: { extend: item.videoId },
      });
    } catch (err) {
      setNotice(describeError(err));
    }
  };

  const items = (type === 'images' ? (onlyStarred ? images.filter((i) => i.starred) : images) : videos) as any[];

  const handleCloud = async (item: any) => {
    setNotice('');
    try {
      const src = type === 'images' ? item.url : item.urls[0];
      const { path, signedUrl } = await saveToCloud(src, type === 'images' ? 'image' : 'video', item.id);
      if (type === 'images') updateImage(item.id, { cloudPath: path, url: signedUrl });
      else updateVideo(item.id, { cloudPath: path, urls: [signedUrl] });
      setNotice('Uloženo do cloudu.');
    } catch (err: any) {
      setNotice(err.message ?? String(err));
    }
  };

  if (items.length === 0 && !onlyStarred) {
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
          <select
            value={exportPreset ?? ''}
            onChange={(e) => setExportPreset((e.target.value || null) as any)}
            className="text-xs bg-slate-800 border border-slate-600 text-white rounded px-2 py-1"
            title="Formát, který se nastaví v editoru"
          >
            <option value="">Editor: původní formát</option>
            <option value="reel">Editor: Reels 9:16</option>
            <option value="youtube">Editor: YouTube 16:9</option>
            <option value="post">Editor: příspěvek 4:5</option>
            <option value="square">Editor: čtverec 1:1</option>
          </select>
          {cloudEnabled && (
            <label className="flex items-center gap-1 text-xs text-slate-200" title="Hotová videa se sama uloží do cloudu">
              <input type="checkbox" checked={autoCloud} onChange={(e) => setAutoCloud(e.target.checked)} />
              Auto cloud
            </label>
          )}
          {type === 'images' && (
            <button
              onClick={() => setOnlyStarred(!onlyStarred)}
              aria-pressed={onlyStarred}
              className={`flex items-center gap-1 text-xs px-3 py-1 rounded ${onlyStarred ? 'bg-yellow-500 text-black' : 'bg-slate-600 text-white'}`}
            >
              <Star className="w-3 h-3" /> Výběr
            </button>
          )}
          {type === 'images' && images.length >= 2 && (
            <button
              onClick={() => openImagesInEditor((onlyStarred ? images.filter((i) => i.starred) : images).map((image) => image.url))}
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

      {notice && (
        <div role="alert" className="m-4 mb-0 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {notice}
        </div>
      )}

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
                        : item.queuePosition
                        ? `Ve frontě: ${item.queuePosition}`
                        : `${Math.round((item.progress || 0) * 100)}%`}
                    </span>
                  </div>
                </div>
              )}

              {/* Overlay */}
              {selectedId === item.id && (
                <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center gap-2">
                  {type === 'images' ? (
                    <>
                      <a
                        href={item.url}
                        download={`image-${item.id}.jpg`}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                        onClick={(e) => e.stopPropagation()}
                        title="Stáhnout"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        className={`p-2 rounded text-white ${item.starred ? 'bg-yellow-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateImage(item.id, { starred: !item.starred });
                        }}
                        title="Označit jako nejlepší"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                      {cloudEnabled && !item.cloudPath && (
                        <button
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloud(item);
                          }}
                          title="Uložit do cloudu"
                        >
                          <Cloud className="w-4 h-4" />
                        </button>
                      )}
                      {item.saved && item.imageId && (
                        <button
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            animateImage(item.imageId);
                          }}
                          title="Rozpohybovat ve videu"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      )}
                      {item.saved && item.imageId && (
                        <button
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCharacter(item.imageId);
                          }}
                          title="Použít jako postavu"
                        >
                          <User className="w-4 h-4" />
                        </button>
                      )}
                    </>
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
                      {cloudEnabled && !item.cloudPath && (
                        <button
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloud(item);
                          }}
                          title="Uložit do cloudu (odkaz od Promptchanu po 48 h vyprší)"
                        >
                          <Cloud className="w-4 h-4" />
                        </button>
                      )}
                      {item.videoId && (
                        <button
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExtend(item);
                          }}
                          title="Prodloužit o cca 6 s (15 gemů a víc)"
                        >
                          <FastForward className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {/* Prompt Tooltip */}
              {selectedId === item.id && (
                <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200 z-10 max-h-20 overflow-y-auto">
                  {item.prompt}
                  {item.failureReason && <span className="block text-red-300">{item.failureReason}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
