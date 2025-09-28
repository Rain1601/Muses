import '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bilibiliVideo: {
      /**
       * 插入 Bilibili 视频
       */
      setBilibiliVideo: (options: { src: string; width?: number; height?: number }) => ReturnType;
    };
    youtube: {
      /**
       * 插入 YouTube 视频
       */
      setYoutubeVideo: (options: { src: string; width?: number; height?: number }) => ReturnType;
    };
  }
}