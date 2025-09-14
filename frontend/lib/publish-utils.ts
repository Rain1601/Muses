/**
 * 发布工具函数
 * 处理文章发布到GitHub时的图片提取、路径转换等功能
 */

interface ExtractedImage {
  originalSrc: string;
  fileName: string;
  base64Data: string;
  newPath: string;
}

interface ProcessedArticle {
  content: string;
  images: ExtractedImage[];
  frontmatter: string;
}

/**
 * 从文章内容中提取Base64图片
 */
export function extractImagesFromContent(content: string, articlePath: string): ProcessedArticle {
  const images: ExtractedImage[] = [];
  let processedContent = content;

  // 匹配所有Base64图片
  const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/g;
  let match;
  let imageIndex = 0;

  while ((match = base64ImageRegex.exec(content)) !== null) {
    imageIndex++;
    const fullMatch = match[0];
    const altText = match[1];
    const dataUrl = match[2];
    const imageType = match[3];
    const base64Data = match[4];

    // 生成图片文件名
    const fileName = `image-${imageIndex}.${imageType}`;
    const newPath = `./images/${fileName}`;

    images.push({
      originalSrc: dataUrl,
      fileName,
      base64Data,
      newPath
    });

    // 替换内容中的Base64为相对路径
    processedContent = processedContent.replace(fullMatch, `![${altText}](${newPath})`);
  }

  return {
    content: processedContent,
    images,
    frontmatter: ''
  };
}

/**
 * 生成文章的Frontmatter
 */
export function generateFrontmatter(
  title: string,
  tags: string[] = [],
  categories: string[] = [],
  summary?: string
): string {
  const date = new Date().toISOString().split('T')[0];

  const frontmatter = `---
title: "${title}"
date: "${date}"
tags: ${JSON.stringify(tags)}
categories: ${JSON.stringify(categories)}
author: "Muses"
${summary ? `summary: "${summary}"` : ''}
---

`;

  return frontmatter;
}

/**
 * 准备发布到GitHub的文件列表
 */
export interface GitHubFile {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export function prepareFilesForGitHub(
  articleTitle: string,
  articleContent: string,
  basePath: string,
  tags: string[] = [],
  categories: string[] = []
): GitHubFile[] {
  const files: GitHubFile[] = [];

  // 处理文章内容和图片
  const processed = extractImagesFromContent(articleContent, basePath);

  // 生成Frontmatter
  const frontmatter = generateFrontmatter(articleTitle, tags, categories);

  // 主文章文件
  files.push({
    path: `${basePath}/index.md`,
    content: frontmatter + processed.content,
    encoding: 'utf-8'
  });

  // 图片文件
  processed.images.forEach(image => {
    files.push({
      path: `${basePath}/images/${image.fileName}`,
      content: image.base64Data,
      encoding: 'base64'
    });
  });

  return files;
}

/**
 * 将Base64数据转换为二进制
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}