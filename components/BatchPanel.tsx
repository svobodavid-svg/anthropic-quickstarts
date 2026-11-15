'use client';

import { useRef, useState } from 'react';
import { Layers, Loader, Square } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { createClient, describeError, type Aspect } from '@/lib/promptchan-client';

const MAX_BATCH = 12;

/**
 * Batch generation: one prompt per line, run one after another (the API limits parallel
 * requests). Every result lands in the gallery; star the best ones there.
 */
export default function BatchPanel() {
  const { apiKey, catalog, characterImageId, addImage, setGems, setLastImageCost, gems, lastImageCost } = useStudio();
  const [text, setText] = useState('');
  const [aspect, setAspect] = useState<Aspect>('Portrait');
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const stop = useRef(false);

  const prompts = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, MAX_BATCH);
  const model = catalog?.image_models?.find((m) => m.allowed && m.available) ?? null;
  const estimate = lastImageCost ? prompts.length * lastImageCost : null;

  const run = async () => {
    if (!prompts.length || running) return;
    if (estimate !== null && estimate > gems) {
      setError(`Odhad ${estimate} gemů, na účtu je ${gems}.`);
      return;
    }
    setRunning(true);
    setError('');
    setDone(0);
    stop.current = false;
    const client = createClient(apiKey);
    const useChar = !!characterImageId && !!model && model.character_versions.length > 0;

    for (const prompt of prompts) {
      if (stop.current) break;
      try {
        const result = await client.generateImage({
          model: model?.name ?? 'Default',
          prompt,
          aspect: model?.aspects.includes(aspect) ? aspect : model?.aspects[0] ?? aspect,
          save_to_gallery: true,
          ...(useChar
            ? {
                character_image_id: characterImageId!,
                character_version: model!.character_versions.includes('v2') ? 'v2' : model!.character_versions[0],
              }
            : {}),
        });
        const urls = result.image_urls?.length
          ? result.image_urls
          : (result.images?.length ? result.images : result.image ? [result.image] : []).map(
              (d) => `data:image/jpeg;base64,${d}`
            );
        urls.forEach((url, i) =>
          addImage({
            id: `${Date.now()}-b${i}`,
            url,
            prompt,
            timestamp: Date.now(),
            params: { model: result.model, aspect, seed: result.seed, batch: true },
            imageId: result.image_ids?.[i],
            saved: result.saved,
          })
        );
        if (typeof result.gems === 'number') setGems(result.gems);
        if (typeof result.gems_cost === 'number') setLastImageCost(result.gems_cost);
      } catch (err) {
        setError(`„${prompt.slice(0, 40)}…“: ${describeError(err)}`);
        break;
      }
      setDone((d) => d + 1);
    }
    setRunning(false);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3 mt-6">
      <h3 className="text-white font-bold flex items-center gap-2">
        <Layers size={18} /> Dávka (jeden prompt na řádek, max {MAX_BATCH})
      </h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        placeholder={'fictional hiker at sunrise, cinematic\nfictional hiker by a campfire, night'}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 h-28 resize-none focus:outline-none focus:border-blue-400"
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)} disabled={running}
          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white">
          <option value="Portrait">Na výšku</option>
          <option value="Wide">Na šířku</option>
          <option value="Square">Čtverec</option>
        </select>
        <span>
          {prompts.length} promptů{estimate !== null ? ` · odhad ~${estimate} gemů (máš ${gems})` : ''}
          {characterImageId ? ' · s postavou' : ''}
        </span>
        {running ? (
          <button onClick={() => (stop.current = true)} className="ml-auto flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded">
            <Square size={14} /> Zastavit ({done}/{prompts.length})
          </button>
        ) : (
          <button onClick={run} disabled={!prompts.length} className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-1 rounded">
            Spustit dávku
          </button>
        )}
        {running && <Loader className="animate-spin" size={16} />}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
