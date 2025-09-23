"""
Text chunking module for semantic splitting.
文本分块模块，进行语义化切分。
"""

from typing import List, Dict, Optional
import re


class TextChunker:
    """文本分块器，支持多种切分策略"""

    def __init__(self,
                 chunk_size: int = 500,
                 chunk_overlap: int = 100,
                 separator: str = "\n\n"):
        """
        初始化分块器

        Args:
            chunk_size: 块大小（字符数）
            chunk_overlap: 块之间的重叠大小
            separator: 优先分割符
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separator = separator

    def chunk_text(self, text: str, metadata: Optional[Dict] = None) -> List[Dict]:
        """
        将文本分成语义块

        Args:
            text: 输入文本
            metadata: 附加元数据

        Returns:
            块列表，每个块包含text和metadata
        """
        if not text:
            return []

        chunks = []
        base_metadata = metadata or {}

        # 按段落分割
        paragraphs = text.split(self.separator)
        current_chunk = ""
        current_length = 0

        for para in paragraphs:
            para_length = len(para)

            # 如果段落本身太长，需要进一步分割
            if para_length > self.chunk_size:
                # 按句子分割
                sentences = self._split_sentences(para)
                for sentence in sentences:
                    if current_length + len(sentence) > self.chunk_size and current_chunk:
                        chunks.append({
                            "text": current_chunk.strip(),
                            "metadata": {
                                **base_metadata,
                                "chunk_index": len(chunks),
                                "chunk_size": len(current_chunk)
                            }
                        })
                        # 保留重叠部分
                        overlap_text = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else current_chunk
                        current_chunk = overlap_text + " " + sentence
                        current_length = len(current_chunk)
                    else:
                        current_chunk += " " + sentence if current_chunk else sentence
                        current_length = len(current_chunk)
            else:
                # 尝试将段落添加到当前块
                if current_length + para_length > self.chunk_size and current_chunk:
                    chunks.append({
                        "text": current_chunk.strip(),
                        "metadata": {
                            **base_metadata,
                            "chunk_index": len(chunks),
                            "chunk_size": len(current_chunk)
                        }
                    })
                    current_chunk = para
                    current_length = para_length
                else:
                    current_chunk += self.separator + para if current_chunk else para
                    current_length = len(current_chunk)

        # 添加最后一个块
        if current_chunk:
            chunks.append({
                "text": current_chunk.strip(),
                "metadata": {
                    **base_metadata,
                    "chunk_index": len(chunks),
                    "chunk_size": len(current_chunk)
                }
            })

        return chunks

    def chunk_markdown(self, markdown: str, metadata: Optional[Dict] = None) -> List[Dict]:
        """
        针对Markdown文本的智能分块

        Args:
            markdown: Markdown格式文本
            metadata: 附加元数据

        Returns:
            块列表
        """
        chunks = []
        base_metadata = metadata or {}

        # 按标题层级分割
        sections = self._split_by_headers(markdown)

        for section in sections:
            section_metadata = {
                **base_metadata,
                "section_title": section.get("title", ""),
                "section_level": section.get("level", 0)
            }

            # 如果节内容太长，进一步分块
            if len(section["content"]) > self.chunk_size:
                sub_chunks = self.chunk_text(section["content"], section_metadata)
                chunks.extend(sub_chunks)
            else:
                chunks.append({
                    "text": section["content"],
                    "metadata": {
                        **section_metadata,
                        "chunk_index": len(chunks),
                        "chunk_size": len(section["content"])
                    }
                })

        return chunks

    def _split_sentences(self, text: str) -> List[str]:
        """
        按句子分割文本

        Args:
            text: 输入文本

        Returns:
            句子列表
        """
        # 中文和英文句子分割
        sentence_endings = re.compile(r'[.!?。！？]+')
        sentences = sentence_endings.split(text)

        # 保留句尾标点
        result = []
        endings = sentence_endings.findall(text)

        for i, sentence in enumerate(sentences):
            if sentence.strip():
                if i < len(endings):
                    result.append(sentence + endings[i])
                else:
                    result.append(sentence)

        return result

    def _split_by_headers(self, markdown: str) -> List[Dict]:
        """
        按Markdown标题分割

        Args:
            markdown: Markdown文本

        Returns:
            节列表
        """
        # 匹配Markdown标题
        header_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
        sections = []
        last_pos = 0
        last_title = ""
        last_level = 0

        for match in header_pattern.finditer(markdown):
            # 保存上一节内容
            if last_pos > 0 or (last_pos == 0 and match.start() > 0):
                content = markdown[last_pos:match.start()].strip()
                if content:
                    sections.append({
                        "title": last_title,
                        "level": last_level,
                        "content": content
                    })

            # 更新位置和标题
            last_pos = match.end()
            last_level = len(match.group(1))
            last_title = match.group(2)

        # 添加最后一节
        if last_pos < len(markdown):
            content = markdown[last_pos:].strip()
            if content:
                sections.append({
                    "title": last_title,
                    "level": last_level,
                    "content": content
                })

        # 如果没有找到标题，整个文本作为一节
        if not sections and markdown.strip():
            sections.append({
                "title": "",
                "level": 0,
                "content": markdown.strip()
            })

        return sections