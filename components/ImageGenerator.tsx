'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader, Zap } from 'lucide-react';
import { createClient, describeError, type Aspect, type CatalogImageModel } from '@/lib/promptchan-client';
import { useStudio } from '@/lib/store';
import CharacterPicker from './CharacterPicker';

/** Used until the catalog loads, or when it cannot be loaded. */
const FALLBACK_MODELS: CatalogImageModel[] = ['Hyperreal XL+', 'Photo XL+', 'Cinematic XL', 'Anime XL', 'Cinematic'].map(
  (name) => ({
    name,
    engine: 'standard',
    min_plan: 'Free',
    allowed: true,
    available: true,
    qualities: ['Ultra', 'Extreme', 'Max'],
    aspects: ['Portrait', 'Wide', 'Square'],
    max_images: 1,
    character_versions: [],
    filters: ['Default'],
  })
);

const ASPECT_LABEL: Record<Aspect, string> = { Portrait: 'Na výšku', Wide: 'Na šířku', Square: 'Čtverec' };

const fieldClass =
  'w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-400 disabled:opacity-50';
const labelClass = 'block text-sm font-medium text-slate-300 mb-2';

export default function ImageGenerator() {
  const { apiKey, addImage, setGems, catalog, characterImageId } = useStudio();
  const models = useMemo(
    () => (catalog?.image_models?.length ? catalog.image_models : FALLBACK_MODELS),
    [catalog]
  );

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [modelName, setModelName] = useState('');
  const [pose, setPose] = useState('Default');
  const [filter, setFilter] = useState('Default');
  const [emotion, setEmotion] = useState('Default');
  const [quality, setQuality] = useState('');
  const [aspect, setAspect] = useState<Aspect>('Portrait');
  const [count, setCount] = useState(1);
  const [save, setSave] = useState(false);
  const [characterVersion, setCharacterVersion] = useState('v2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const usable = (model: CatalogImageModel) => model.allowed && model.available;
  const model = models.find((m) => m.name === modelName) ?? models.find(usable) ?? models[0];
  const poses = catalog?.poses?.[model.engine] ?? ['Default'];
  const emotions = catalog?.emotions ?? ['Default'];

  // Keep the dependent choices valid when the model changes.
  useEffect(() => {
    if (!model.filters.includes(filter)) setFilter(model.filters[0] ?? 'Default');
    // Always start from the model's base quality so a switch never adds Gems unasked.
    setQuality(model.qualities[0] ?? '');
    if (!model.aspects.includes(aspect)) setAspect(model.aspects[0] ?? 'Portrait');
    if (!poses.includes(pose)) setPose('Default');
    if (count > model.max_images) setCount(1);
    if (!model.character_versions.includes(characterVersion)) {
      setCharacterVersion(model.character_versions.includes('v2') ? 'v2' : model.character_versions[0] ?? 'v2');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.name]);

  // A character only applies on models that support it.
  const character = model.character_versions.length > 0 ? characterImageId : null;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Zadejte prompt');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const result = await createClient(apiKey).generateImage({
        model: model.name,
        prompt: prompt.trim(),
        ...(negativePrompt.trim() ? { negative_prompt: negativePrompt.trim() } : {}),
        poses: [pose],
        filter,
        emotion,
        ...(quality ? { quality } : {}),
        aspect,
        // Several images per request are not available together with a character.
        ...(count > 1 && !character ? { count } : {}),
        ...(character ? { character_image_id: character, character_version: characterVersion } : {}),
        ...(save ? { save_to_gallery: true } : {}),
      });

      // Saved images come back as links, the others inline.
      const urls = result.image_urls?.length
        ? result.image_urls
        : (result.images?.length ? result.images : result.image ? [result.image] : []).map(
            (data) => `data:image/jpeg;base64,${data}`
          );

      urls.forEach((url, i) =>
        addImage({
          id: `${Date.now()}-${i}`,
          url,
          prompt: prompt.trim(),
          timestamp: Date.now(),
          params: { model: result.model, pose, filter, emotion, quality, aspect, seed: result.seed },
          imageId: result.image_ids?.[i],
          saved: result.saved,
        })
      );
      if (typeof result.gems === 'number') setGems(result.gems);
      if (urls.length === 0) setError('Služba nevrátila žádný obrázek.');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const select = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { value: string; label: string; disabled?: boolean }[]
  ) => (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">🖼️ Generátor obrázků</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="image-prompt" className={labelClass}>
            Prompt
          </label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Popište obrázek, který chcete vygenerovat..."
            maxLength={4000}
            disabled={loading}
            className={`${fieldClass} py-3 resize-none h-24 placeholder-slate-500`}
          />
        </div>

        <div>
          <label htmlFor="image-negative" className={labelClass}>
            Čemu se vyhnout (volitelné)
          </label>
          <input
            id="image-negative"
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            maxLength={4000}
            disabled={loading}
            className={fieldClass}
          />
        </div>

        {select(
          'image-model',
          'Model',
          model.name,
          setModelName,
          models.map((m) => ({
            value: m.name,
            label: !m.allowed ? `${m.name} (tarif ${m.min_plan})` : !m.available ? `${m.name} (teď nedostupný)` : m.name,
            disabled: !usable(m),
          }))
        )}

        <div className="grid grid-cols-2 gap-4">
          {select('image-pose', 'Póza', pose, setPose, poses.map((p) => ({ value: p, label: p })))}
          {select('image-filter', 'Filtr', filter, setFilter, model.filters.map((f) => ({ value: f, label: f })))}
          {select('image-emotion', 'Výraz', emotion, setEmotion, emotions.map((e) => ({ value: e, label: e })))}
          {select(
            'image-aspect',
            'Poměr stran',
            aspect,
            (value) => setAspect(value as Aspect),
            model.aspects.map((a) => ({ value: a, label: ASPECT_LABEL[a] ?? a }))
          )}
          {model.qualities.length > 0 &&
            select('image-quality', 'Kvalita', quality, setQuality, model.qualities.map((q) => ({ value: q, label: q })))}
          {model.max_images > 1 &&
            select(
              'image-count',
              'Počet obrázků',
              String(count),
              (value) => setCount(Number(value)),
              Array.from({ length: model.max_images }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
            )}
        </div>

        {model.character_versions.length > 0 ? (
          <CharacterPicker
            disabled={loading}
            versions={model.character_versions}
            version={characterVersion}
            onVersionChange={setCharacterVersion}
          />
        ) : (
          characterImageId && <p className="text-xs text-slate-400">Tento model postavu nepodporuje.</p>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
            disabled={loading}
            className="mt-0.5 w-4 h-4 rounded"
          />
          <span>
            Uložit do galerie na Promptchanu
            <span className="block text-xs text-slate-400">
              Jen placené tarify. Uložený obrázek jde potom rozpohybovat ve videu a zůstane v galerii studia i po
              obnovení stránky.
            </span>
          </span>
        </label>

        {error && (
          <div role="alert" className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Generuji...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Vygenerovat obrázek
            </>
          )}
        </button>
      </div>
    </div>
  );
}
