'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, Copy, RefreshCw } from 'lucide-react';

interface PromptMasterProps {
  onApply: (enhancedPrompt: string) => void;
  type: 'image' | 'video';
}

const PROMPT_TEMPLATES = {
  image: [
    {
      category: '🎨 Styl',
      options: ['ultra-detailed', 'hyperrealistic', 'artistic', 'cinematic', 'illustration style', 'digital painting'],
    },
    {
      category: '💡 Kvalita',
      options: ['masterpiece', 'high quality', '8k', '4k', 'detailed', 'intricate'],
    },
    {
      category: '⚡ Efekty',
      options: ['dramatic lighting', 'volumetric lighting', 'ray tracing', 'bokeh', 'motion blur', 'glow'],
    },
    {
      category: '🎭 Nálada',
      options: ['moody', 'vibrant', 'dark', 'bright', 'mysterious', 'serene', 'energetic'],
    },
  ],
  video: [
    {
      category: '🎬 Pohyb',
      options: ['smooth camera pan', 'dynamic motion', 'slow motion', 'tracking shot', 'zoom in', 'spinning'],
    },
    {
      category: '⏱️ Rytmus',
      options: ['fast paced', 'slow build', 'steady', 'pulsing', 'accelerating'],
    },
    {
      category: '🎵 Atmosféra',
      options: ['energetic', 'calm', 'dramatic', 'epic', 'playful', 'intense'],
    },
  ],
};

const ENHANCEMENT_TIPS = {
  image: [
    'Přidej konkrétní materiály (gold, velvet, glass, stone)',
    'Specifikuj osvětlení (backlighting, rim light, soft light)',
    'Přidej detaily na pozadí (forest, city, abstract)',
    'Napiš emoci/náladu (joyful, melancholic, mysterious)',
    'Specifikuj perspektivu (close-up, wide shot, bird\'s eye)',
  ],
  video: [
    'Přidej pohybové instrukce (zoom, pan, rotate)',
    'Specifikuj délku nebo tempo (fast, slow, dynamic)',
    'Napiš atmosféru (epic, calm, chaotic)',
    'Přidej zvukové prvky (música, ambient, futuristic)',
    'Specifikuj přechody (fade, cut, morph)',
  ],
};

export default function PromptMaster({ onApply, type }: PromptMasterProps) {
  const [basePrompt, setBasePrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  const [showTips, setShowTips] = useState(false);
  const [copied, setCopied] = useState(false);

  const templates = PROMPT_TEMPLATES[type];
  const tips = ENHANCEMENT_TIPS[type];

  const enhancePrompt = () => {
    if (!basePrompt.trim()) return;

    let enhanced = basePrompt;

    // Přidej vybrané vylepšení
    if (selectedEnhancements.length > 0) {
      enhanced += ', ' + selectedEnhancements.join(', ');
    }

    // Přidej kvalitní suffixes
    if (type === 'image') {
      enhanced += ', professional, award-winning, stunning, beautiful';
    } else {
      enhanced += ', cinematic quality, smooth, professional production';
    }

    setEnhancedPrompt(enhanced);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(enhancedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addEnhancement = (enhancement: string) => {
    if (selectedEnhancements.includes(enhancement)) {
      setSelectedEnhancements(selectedEnhancements.filter((e) => e !== enhancement));
    } else {
      setSelectedEnhancements([...selectedEnhancements, enhancement]);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-bold text-blue-300">✨ Prompt Master</h3>
      </div>

      {/* Base Prompt Input */}
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-2">Co chceš vytvořit?</label>
        <textarea
          value={basePrompt}
          onChange={(e) => setBasePrompt(e.target.value)}
          placeholder="Popi své přání jednoduše..."
          className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none h-16"
        />
      </div>

      {/* Templates */}
      <div>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg hover:bg-slate-800/50 transition-colors text-sm"
        >
          <span className="text-slate-300">📚 Šablony & Styly</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
        </button>

        {showTemplates && (
          <div className="mt-2 space-y-3">
            {templates.map((template) => (
              <div key={template.category} className="bg-slate-900/50 p-3 rounded-lg border border-slate-600">
                <p className="text-xs font-semibold text-slate-300 mb-2">{template.category}</p>
                <div className="flex flex-wrap gap-2">
                  {template.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => addEnhancement(option)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        selectedEnhancements.includes(option)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div>
        <button
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg hover:bg-slate-800/50 transition-colors text-sm"
        >
          <span className="text-slate-300">💡 Tipy pro lepší prompt</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showTips ? 'rotate-180' : ''}`} />
        </button>

        {showTips && (
          <div className="mt-2 bg-slate-900/50 p-3 rounded-lg border border-slate-600 space-y-2">
            {tips.map((tip, i) => (
              <p key={i} className="text-xs text-slate-300">
                • {tip}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Enhance Button */}
      <button
        onClick={enhancePrompt}
        disabled={!basePrompt.trim()}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Vylepšit Prompt
      </button>

      {/* Enhanced Prompt Display */}
      {enhancedPrompt && (
        <div className="bg-slate-900/50 border border-blue-600/50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-slate-400">Vylepšený prompt:</p>
          <p className="text-sm text-white leading-relaxed">{enhancedPrompt}</p>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Zkopírováno!' : 'Kopírovat'}
            </button>
            <button
              onClick={() => onApply(enhancedPrompt)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded font-semibold transition-colors"
            >
              Použít ✓
            </button>
          </div>
        </div>
      )}

      {/* Reset Button */}
      {basePrompt && (
        <button
          onClick={() => {
            setBasePrompt('');
            setEnhancedPrompt('');
            setSelectedEnhancements([]);
          }}
          className="w-full text-slate-400 hover:text-slate-300 text-xs py-1 flex items-center justify-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Nový prompt
        </button>
      )}
    </div>
  );
}
