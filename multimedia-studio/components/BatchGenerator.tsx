'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { Plus, Trash2, Play } from 'lucide-react';

export default function BatchGenerator() {
  const { batchJobs, addBatchJob, updateBatchJob, deleteBatchJob } = useStudio();
  const [showNew, setShowNew] = useState(false);
  const [prompts, setPrompts] = useState('');
  const [batchType, setBatchType] = useState<'image' | 'video'>('image');

  const handleCreateBatch = () => {
    if (prompts.trim()) {
      const promptList = prompts.split('\n').filter((p) => p.trim());
      const job = {
        id: Math.random().toString(36).substr(2, 9),
        type: batchType,
        status: 'pending' as const,
        total: promptList.length,
        completed: 0,
        params: promptList.map((p) => ({ prompt: p })),
        timestamp: Date.now(),
      };
      addBatchJob(job);
      setPrompts('');
      setShowNew(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Batch Jobs</h3>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          New Batch
        </button>
      </div>

      {showNew && (
        <div className="bg-slate-900/50 p-4 rounded border border-slate-600 space-y-3">
          <select
            value={batchType}
            onChange={(e) => setBatchType(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-400"
          >
            <option value="image">Image Batch</option>
            <option value="video">Video Batch</option>
          </select>

          <textarea
            value={prompts}
            onChange={(e) => setPrompts(e.target.value)}
            placeholder="Enter prompts (one per line)..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none h-24"
          />

          <button
            onClick={handleCreateBatch}
            disabled={!prompts.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm py-1.5 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-3 h-3" />
            Start Batch
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {batchJobs.map((job) => (
          <div
            key={job.id}
            className="bg-slate-900/50 p-3 rounded border border-slate-600 group hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium text-white">
                  {job.type === 'image' ? '🖼️' : '🎥'} Batch #{job.id.slice(0, 4)}
                </div>
                <div className="text-xs text-slate-400">
                  {job.completed}/{job.total} completed
                </div>
              </div>
              <button
                onClick={() => deleteBatchJob(job.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  job.status === 'completed'
                    ? 'bg-green-500'
                    : job.status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${(job.completed / job.total) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {batchJobs.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">No batch jobs yet</p>
      )}
    </div>
  );
}
