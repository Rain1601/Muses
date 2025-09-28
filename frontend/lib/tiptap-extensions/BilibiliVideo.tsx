import { Node, mergeAttributes } from '@tiptap/core';

export interface BilibiliVideoOptions {
  inline: boolean;
  width: number;
  height: number;
  allowFullscreen: boolean;
  autoplay: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bilibiliVideo: {
      setBilibiliVideo: (options: { src: string; width?: number; height?: number }) => ReturnType;
    };
  }
}

// 从 Bilibili URL 提取视频 ID (BV号或av号)
const getBilibiliVideoId = (url: string): string | null => {
  if (!url) return null;

  // 支持 BV 号
  const bvMatch = url.match(/(?:bilibili\.com\/video\/)?(BV[a-zA-Z0-9]+)/);
  if (bvMatch) {
    return bvMatch[1];
  }

  // 支持 av 号
  const avMatch = url.match(/(?:bilibili\.com\/video\/)?av(\d+)/);
  if (avMatch) {
    return `av${avMatch[1]}`;
  }

  return null;
};

// 转换为嵌入 URL
const getBilibiliEmbedUrl = (videoId: string): string => {
  // 参数说明:
  // - high_quality=1: 默认最高清晰度（非大会员最高，如1080p）
  // - danmaku=0: 关闭弹幕
  // - as_wide=1: 宽屏模式
  // - autoplay=0: 禁止自动播放
  if (videoId.startsWith('BV')) {
    return `https://player.bilibili.com/player.html?bvid=${videoId}&high_quality=1&danmaku=0&as_wide=1&autoplay=0`;
  } else if (videoId.startsWith('av')) {
    const aid = videoId.substring(2);
    return `https://player.bilibili.com/player.html?aid=${aid}&high_quality=1&danmaku=0&as_wide=1&autoplay=0`;
  }
  return '';
};

const BilibiliVideo = Node.create<BilibiliVideoOptions>({
  name: 'bilibiliVideo',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      inline: false,
      width: 640,
      height: 480,
      allowFullscreen: true,
      autoplay: false,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
      },
      width: {
        default: this.options.width,
        parseHTML: (element) => element.getAttribute('width'),
      },
      height: {
        default: this.options.height,
        parseHTML: (element) => element.getAttribute('height'),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src*="player.bilibili.com"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // src 已经是 videoId (BV号或av号)，不需要再次提取
    const videoId = HTMLAttributes.src;
    const embedUrl = getBilibiliEmbedUrl(videoId);

    return [
      'div',
      { class: 'video-wrapper', style: 'position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 1rem 0;' },
      [
        'iframe',
        mergeAttributes(
          this.options.HTMLAttributes,
          {
            src: embedUrl,
            width: '100%',
            height: '100%',
            style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 0.5rem;',
            allowfullscreen: this.options.allowFullscreen ? 'true' : 'false',
            scrolling: 'no',
            border: '0',
            frameborder: 'no',
            framespacing: '0',
            // 关键：sandbox 属性允许脚本和表单，使画质切换功能可用
            sandbox: 'allow-top-navigation allow-same-origin allow-forms allow-scripts allow-popups',
          }
        ),
      ],
    ];
  },

  addCommands() {
    return {
      setBilibiliVideo:
        (options) =>
        ({ commands }) => {
          const videoId = getBilibiliVideoId(options.src);
          if (!videoId) {
            console.error('无法从链接中提取 Bilibili 视频 ID:', options.src);
            return false;
          }

          console.log('插入 Bilibili 视频:', videoId);
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: videoId,
              width: options.width || this.options.width,
              height: options.height || this.options.height,
            },
          });
        },
    };
  },
});

export { BilibiliVideo };
export default BilibiliVideo;