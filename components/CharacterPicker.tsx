'use client';

import { useState } from 'react';
import { Save, Trash2, User, X } from 'lucide-react';
import { useStudio } from '@/lib/store';

interface CharacterPickerProps {
  disabled?: boolean;
  /** Character versions the chosen model supports; empty hides the version choice. */
  versions?: string[];
  version?: string;
  onVersionChange?: (version: string) => void;
}

/**
 * AI Character: keep the same generated person across new images and videos. Only images
 * made on Promptchan and saved to its gallery qualify; the API accepts no uploads.
 */
export default function CharacterPicker({ disabled, versions = [], version, onVersionChange }: CharacterPickerProps) {
  const { images, characterImageId, setCharacter, characters, saveCharacter, removeCharacter } = useStudio();
  const [name, setName] = useState('');
  const candidates = images.filter((image) => image.saved && image.imageId);
  const current = candidates.find((image) => image.imageId === characterImageId);
  // `current` is only set while the image is still in the gallery; the library survives without it.

  const inLibrary = characters.some((c) => c.imageId === characterImageId);

  return (
    <div className="p-3 bg-slate-900 border border-slate-600 rounded space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <User className="w-4 h-4" />
        Postava (zachovat stejnou osobu)
      </div>

      {candidates.length === 0 ? (
        <p className="text-xs text-slate-400">
          Nejdřív vygenerujte obrázek s volbou „Uložit do galerie na Promptchanu“. Uložený obrázek pak půjde vybrat
          jako postava. Vlastní fotky API nepřijímá.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {candidates.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setCharacter(image.imageId === characterImageId ? null : image.imageId!)}
              disabled={disabled}
              aria-pressed={image.imageId === characterImageId}
              aria-label={`Postava z obrázku: ${image.prompt}`}
              className={`w-14 h-14 rounded overflow-hidden border-2 transition-all disabled:opacity-50 ${
                image.imageId === characterImageId ? 'border-blue-400' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed remote link */}
              <img src={image.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {current && (
            <button
              type="button"
              onClick={() => setCharacter(null)}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white"
            >
              <X className="w-3 h-3" />
              Bez postavy
            </button>
          )}
        </div>
      )}

      {characters.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Knihovna postav</p>
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => (
              <span
                key={c.id}
                className={`flex items-center gap-1 pl-1 pr-2 py-1 rounded text-xs border ${
                  c.imageId === characterImageId ? 'border-blue-400 text-white' : 'border-slate-600 text-slate-300'
                }`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setCharacter(c.imageId === characterImageId ? null : c.imageId)}
                  title={c.note || c.name}
                  className="flex items-center gap-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote link */}
                  <img src={c.url} alt="" className="w-6 h-6 rounded object-cover" />
                  {c.name}
                </button>
                <button type="button" onClick={() => removeCharacter(c.id)} aria-label={`Smazat ${c.name}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {current && !inLibrary && (
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jméno postavy"
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
          />
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              saveCharacter({
                id: `${Date.now()}`,
                name: name.trim(),
                note: current.prompt.slice(0, 120),
                imageId: current.imageId!,
                url: current.url,
              });
              setName('');
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 disabled:opacity-50 text-white rounded"
          >
            <Save className="w-3 h-3" /> Do knihovny
          </button>
        </div>
      )}

      {current && versions.length > 0 && onVersionChange && (
        <div className="flex items-center gap-2">
          <label htmlFor="character-version" className="text-xs text-slate-400">
            Verze
          </label>
          <select
            id="character-version"
            value={version}
            onChange={(e) => onVersionChange(e.target.value)}
            disabled={disabled}
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
          >
            {versions.map((v) => (
              <option key={v} value={v}>
                {v === 'v3' ? 'v3 (celá postava, +3 gemy)' : v}
              </option>
            ))}
          </select>
        </div>
      )}

      {current && <p className="text-xs text-slate-400">AI Character je jen v tarifu Pro a stojí gemy navíc.</p>}
    </div>
  );
}
