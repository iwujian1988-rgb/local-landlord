import { useEffect } from 'react';

interface GuideVideo {
  id: string;
  title: string;
  description: string;
  src: string;
  poster?: string;
}

// 暂时只搭好结构。后续收到视频名称和 COS 地址后，只改这里，不动页面布局。
const GUIDE_VIDEOS: GuideVideo[] = [
  { id: 'guide-1', title: '视频一', description: '使用说明视频，内容待补充', src: '' },
  { id: 'guide-2', title: '视频二', description: '使用说明视频，内容待补充', src: '' },
  { id: 'guide-3', title: '视频三', description: '使用说明视频，内容待补充', src: '' },
];

export default function GuidePage() {
  useEffect(() => {
    document.title = '使用说明｜五联人家';
  }, []);

  return (
    <main className="guide-page">
      <header className="guide-header">
        <div className="guide-brand-mark">五联人家</div>
        <div className="guide-kicker">房东使用说明</div>
        <h1>看一遍，就会用</h1>
        <p>按下面的视频一步一步来，房间、租客和收租都能管清楚。</p>
      </header>

      <section className="guide-notice" aria-label="观看提示">
        <span className="guide-notice-icon">i</span>
        <p>第一次使用？建议从第一个视频开始看。</p>
      </section>

      <section className="guide-video-list" aria-label="使用说明视频">
        {GUIDE_VIDEOS.map((video, index) => (
          <article className="guide-video-card" key={video.id}>
            <div className="guide-video-topline">
              <span className="guide-video-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{video.title}</h2>
                <p>{video.description}</p>
              </div>
            </div>
            {video.src ? (
              <video className="guide-video" controls playsInline preload="metadata" poster={video.poster} src={video.src} />
            ) : (
              <div className="guide-video-placeholder">
                <span className="guide-play">▶</span>
                <span>视频准备中</span>
              </div>
            )}
          </article>
        ))}
      </section>

      <p className="guide-footer">有不清楚的地方，回到小程序再试一次。</p>
    </main>
  );
}
