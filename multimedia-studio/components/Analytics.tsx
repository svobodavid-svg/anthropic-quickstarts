'use client';

import { useStudio } from '@/lib/store';
import { TrendingUp, Image, Video, Zap } from 'lucide-react';

export default function Analytics() {
  const { analytics, images, videos } = useStudio();

  const topStyles = Object.entries(analytics.styleUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topFilters = Object.entries(analytics.filterUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Gems Spent</span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white">{analytics.totalGems}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Images Generated</span>
            <Image className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{analytics.generationCount.images}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Videos Generated</span>
            <Video className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{analytics.generationCount.videos}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Items</span>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{images.length + videos.length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Styles */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Most Used Styles</h3>
          <div className="space-y-2">
            {topStyles.length > 0 ? (
              topStyles.map(([style, count]) => (
                <div key={style} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{style}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${(count / Math.max(...Object.values(analytics.styleUsage))) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-4">{count}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No data yet</p>
            )}
          </div>
        </div>

        {/* Top Filters */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Most Used Filters</h3>
          <div className="space-y-2">
            {topFilters.length > 0 ? (
              topFilters.map(([filter, count]) => (
                <div key={filter} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{filter}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{
                          width: `${(count / Math.max(...Object.values(analytics.filterUsage))) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-4">{count}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Gems Over Time */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Gems Over Time</h3>
        <div className="text-xs text-slate-400 space-y-1">
          {analytics.gemsByDate.slice(-7).map((d) => (
            <div key={d.date} className="flex items-center justify-between">
              <span>{d.date}</span>
              <span className="font-semibold text-yellow-400">{d.gems} gems</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
