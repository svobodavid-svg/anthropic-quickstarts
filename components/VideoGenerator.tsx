'use client';

import { useEffect, useState } from 'react';
import { Loader, X, Zap } from 'lucide-react';
import { createClient, describeError, type Aspect, type VideoModel, type VideoRequest } from '@/lib/promptchan-client';
import { useStudio } from '@/lib/store';
import CharacterPicker from './CharacterPicker';

const ASPECT_LABEL: Record<Aspect, string> = { Portrait: 'Na výšku', Wide: 'Na šířku', Square: 'Čtverec' };
const MODEL_LABEL: Record<VideoModel, string> = {
  auto: 'Automaticky',
  v4: 'v4 (nejsilnější pohyb)',
  'v4-voice': 'v4-voice (mluvené, se zvukem)',
};

/** Used until the catalog loads. */
const FALLBACK_VOICE = {
  aspects: ['Portrait', 'Wide'] as Aspect[],
  lengths: [6, 10],
  fps: [24, 48],
  resolutions: ['standard', 'high'],
  dialogue_speakers: ['woman', 'man'],
  dialogue_tones: ['neutral', 'seductive', 'whisper', 'playful'],
  dialogue_accents: ['default', 'american', 'british', 'australian', 'latin', 'french'],
};

const fieldClass =
  'w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-400 disabled:opacity-50';
const labelClass = 'block text-sm font-medium text-slate-300 mb-2';

export default function VideoGenerator() {
  const { apiKey, addVideo, catalog, images, animateImageId, animateImage, characterImageId } = useStudio();

  const [videoModel, setVideoModel] = useState<VideoModel>('auto');
  const [prompt, setPrompt] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [pose, setPose] = useState('Default');
  const [aspect, setAspect] = useState<Aspect>('Portrait');
  const [quality, setQuality] = useState<'Standard' | 'High'>('Standard');
  const [loop, setLoop] = useState(false);
  const [audio, setAudio] = useState(false);
  const [dialogue, setDialogue] = useState('');
  const [speaker, setSpeaker] = useState('woman');
  const [tone, setTone] = useState('neutral');
  const [accent, setAccent] = useState('default');
  const [length, setLength] = useState(6);
  const [fps, setFps] = useState(24);
  const [resolution, setResolution] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const voiceOptions = catalog?.video?.['v4-voice'] ?? FALLBACK_VOICE;
  const videoModels: VideoModel[] = catalog?.video?.models ?? ['auto', 'v4', 'v4-voice'];
  const imageModels = (catalog?.image_models ?? []).filter((m) => m.allowed && m.available);
  const firstFrameModel = imageModels.find((m) => m.name === imageModel) ?? imageModels[0];
  const poses = (firstFrameModel && catalog?.poses?.[firstFrameModel.engine]) || ['Default'];

  // `auto` speaks when there is a line to say.
  const voice = videoModel === 'v4-voice' || (videoModel === 'auto' && dialogue.trim().length > 0);
  const aspects: Aspect[] = voice ? voiceOptions.aspects : catalog?.video?.v4?.aspects ?? ['Portrait', 'Wide', 'Square'];
  const sourceImage = images.find((image) => image.imageId && image.imageId === animateImageId);

  useEffect(() => {
    if (!aspects.includes(aspect)) setAspect(aspects[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice]);

  const handleGenerate = async () => {
    if (!prompt.trim() && !animateImageId) {
      setError('Zadejte prompt, nebo vyberte uložený obrázek k rozpohybování.');
      return;
    }
    setLoading(true);
    setError('');

    const request: VideoRequest = {
      video_model: videoModel,
      ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
      // An animated image brings its own model, pose and shape.
      ...(animateImageId
        ? { image_id: animateImageId }
        : {
            aspect,
            pose,
            ...(firstFrameModel ? { model: firstFrameModel.name } : {}),
            ...(characterImageId ? { character_image_id: characterImageId } : {}),
          }),
      ...(voice
        ? {
            ...(dialogue.trim()
              ? { dialogue: dialogue.trim(), dialogue_speaker: speaker, dialogue_tone: tone, dialogue_accent: accent }
              : {}),
            length,
            fps,
            resolution,
          }
        : { quality, loop, audio }),
    };

    try {
      const result = await createClient(apiKey).submitVideo(request);
      addVideo({
        id: `${Date.now()}`,
        requestId: result.request_id,
        prompt: prompt.trim() || sourceImage?.prompt || 'Video z obrázku',
        timestamp: Date.now(),
        status: 'pending',
        progress: 0,
        params: request,
      });
      setPrompt('');
      setDialogue('');
      animateImage(null);
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
    options: { value: string; label: string }[]
  ) => (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const plain = (values: (string | number)[]) => values.map((v) => ({ value: String(v), label: String(v) }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">🎥 Generátor videí</h2>

      <div className="space-y-4">
        {animateImageId && (
          <div className="flex items-center gap-3 p-3 bg-slate-900 border border-blue-500/50 rounded">
            {sourceImage && (
              // eslint-disable-next-line @next/next/no-img-element -- signed remote link
              <img src={sourceImage.url} alt="" className="w-12 h-12 rounded object-cover" />
            )}
            <p className="flex-1 text-sm text-slate-200">
              Rozpohybuje se uložený obrázek. Model, póza a poměr stran se převezmou z něj.
            </p>
            <button
              onClick={() => animateImage(null)}
              aria-label="Zrušit výběr obrázku"
              className="p-2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div>
          <label htmlFor="video-prompt" className={labelClass}>
            {animateImageId ? 'Co se má dít (volitelné)' : 'Prompt'}
          </label>
          <textarea
            id="video-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Popište video, které chcete vygenerovat..."
            maxLength={4000}
            disabled={loading}
            className={`${fieldClass} py-3 resize-none h-24 placeholder-slate-500`}
          />
        </div>

        {select(
          'video-model',
          'Video model',
          videoModel,
          (value) => setVideoModel(value as VideoModel),
          videoModels.map((m) => ({ value: m, label: MODEL_LABEL[m] ?? m }))
        )}

        {!animateImageId && (
          <div className="grid grid-cols-2 gap-4">
            {imageModels.length > 0 &&
              select(
                'video-image-model',
                'Model prvního snímku',
                firstFrameModel?.name ?? '',
                setImageModel,
                imageModels.map((m) => ({ value: m.name, label: m.name }))
              )}
            {select('video-pose', 'Póza', pose, setPose, plain(poses))}
            {select(
              'video-aspect',
              'Poměr stran',
              aspect,
              (value) => setAspect(value as Aspect),
              aspects.map((a) => ({ value: a, label: ASPECT_LABEL[a] ?? a }))
            )}
          </div>
        )}

        {!animateImageId && <CharacterPicker disabled={loading} />}

        {videoModel !== 'v4' && (
          <div>
            <label htmlFor="video-dialogue" className={labelClass}>
              Mluvená věta (volitelné)
            </label>
            <input
              id="video-dialogue"
              type="text"
              value={dialogue}
              onChange={(e) => setDialogue(e.target.value)}
              maxLength={400}
              placeholder="Do 6 s se vejde asi 14 slov"
              disabled={loading}
              className={`${fieldClass} placeholder-slate-500`}
            />
          </div>
        )}

        {voice ? (
          <div className="grid grid-cols-2 gap-4">
            {dialogue.trim() && (
              <>
                {select('video-speaker', 'Mluvčí', speaker, setSpeaker, plain(voiceOptions.dialogue_speakers))}
                {select('video-tone', 'Tón', tone, setTone, plain(voiceOptions.dialogue_tones))}
                {select('video-accent', 'Přízvuk', accent, setAccent, plain(voiceOptions.dialogue_accents))}
              </>
            )}
            {select('video-length', 'Délka (s)', String(length), (v) => setLength(Number(v)), plain(voiceOptions.lengths))}
            {select('video-fps', 'Snímků za sekundu', String(fps), (v) => setFps(Number(v)), plain(voiceOptions.fps))}
            {select('video-resolution', 'Rozlišení', resolution, setResolution, plain(voiceOptions.resolutions))}
          </div>
        ) : (
          <div className="space-y-3">
            {select('video-quality', 'Kvalita', quality, (v) => setQuality(v as 'Standard' | 'High'), [
              { value: 'Standard', label: 'Standard' },
              { value: 'High', label: 'High (zvětšené, bez příplatku)' },
            ])}
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={audio}
                onChange={(e) => setAudio(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded"
              />
              Se zvukem (+3 gemy)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded"
              />
              Smyčka
            </label>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Video lze odeslat jednou za minutu. Hotový odkaz platí 48 hodin; za nepovedené video se gemy vrací.
        </p>

        {error && (
          <div role="alert" className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || (!prompt.trim() && !animateImageId)}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Odesílám...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Vygenerovat video
            </>
          )}
        </button>
      </div>
    </div>
  );
}
