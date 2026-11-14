import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/promptchan-client';
import { useStudio } from '@/lib/store';

const POLL_MS = 5000;

/**
 * Studio-wide Promptchan state: loads the catalog and the account once the key is set,
 * and follows every unfinished video until it succeeds or fails. Mounted once, at the top
 * of the studio, so videos keep updating whichever tab is open.
 */
export const usePromptchan = () => {
  const apiKey = useStudio((state) => state.apiKey);
  const setCatalog = useStudio((state) => state.setCatalog);
  const setAccount = useStudio((state) => state.setAccount);
  const updateVideo = useStudio((state) => state.updateVideo);
  const setGems = useStudio((state) => state.setGems);
  const hasActiveVideos = useStudio((state) =>
    state.videos.some((video) => video.status === 'pending' || video.status === 'processing')
  );

  useEffect(() => {
    if (!apiKey) return;
    let active = true;
    const client = createClient(apiKey);
    // Either call may fail (offline, bad key); the forms fall back to built-in lists.
    client.getCatalog().then((catalog) => active && setCatalog(catalog)).catch(() => active && setCatalog(null));
    client.getAccount().then((account) => active && setAccount(account)).catch(() => active && setAccount(null));
    return () => {
      active = false;
    };
  }, [apiKey, setCatalog, setAccount]);

  const busy = useRef(false);
  useEffect(() => {
    if (!apiKey || !hasActiveVideos) return;
    const client = createClient(apiKey);

    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const pending = useStudio
          .getState()
          .videos.filter((video) => video.status === 'pending' || video.status === 'processing');

        for (const video of pending) {
          try {
            const result = await client.getVideoResult(video.requestId);
            if (result.video && result.video.length > 0) {
              updateVideo(video.id, {
                status: 'completed',
                progress: 1,
                urls: result.video,
                videoId: result.video_id,
              });
              if (typeof result.gems === 'number') setGems(result.gems);
              continue;
            }

            const status = await client.getVideoStatus(video.requestId);
            if (status.failure_reason || status.status === 'failed') {
              updateVideo(video.id, { status: 'failed', failureReason: status.failure_reason });
            } else {
              updateVideo(video.id, {
                status: 'processing',
                progress: status.progress ?? 0,
                queuePosition: status.current_queue_length,
              });
            }
          } catch {
            // A dropped request is not a failed video: keep polling.
          }
        }
      } finally {
        busy.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [apiKey, hasActiveVideos, updateVideo, setGems]);
};
