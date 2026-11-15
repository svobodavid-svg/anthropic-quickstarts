import { useEffect, useRef } from 'react';
import { createClient, describeError } from '@/lib/promptchan-client';
import { useStudio } from '@/lib/store';
import { saveToCloud, signedGalleryUrl } from '@/lib/cloudGallery';

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
  const setAccountError = useStudio((state) => state.setAccountError);
  const accountReload = useStudio((state) => state.accountReload);
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
    client
      .getAccount()
      .then((account) => {
        if (!active) return;
        setAccount(account);
        setAccountError(null);
      })
      .catch((err) => {
        if (!active) return;
        setAccount(null);
        setAccountError(describeError(err));
      });
    return () => {
      active = false;
    };
  }, [apiKey, accountReload, setCatalog, setAccount, setAccountError]);

  // Cloud copies carry week-long signed links: renew them on every start.
  useEffect(() => {
    const { images, videos, updateImage } = useStudio.getState();
    images.filter((i) => i.cloudPath).forEach((i) =>
      signedGalleryUrl(i.cloudPath!).then((url) => url && updateImage(i.id, { url }))
    );
    videos.filter((v) => v.cloudPath).forEach((v) =>
      signedGalleryUrl(v.cloudPath!).then((url) => url && updateVideo(v.id, { urls: [url] }))
    );
  }, [updateVideo]);

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
              if (useStudio.getState().autoCloud) {
                // Best effort: the link may be blocked by CORS; the manual button reports why.
                saveToCloud(result.video[0], 'video', video.id)
                  .then(({ path, signedUrl }) => updateVideo(video.id, { cloudPath: path, urls: [signedUrl] }))
                  .catch(() => undefined);
              }
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
