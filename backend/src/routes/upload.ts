import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import pdfParse from 'pdf-parse';

const router = Router();

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', (req as AuthRequest).user!.id);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf', '.md', '.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 上传文件
router.post('/file', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const fileInfo = {
      id: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      type: path.extname(req.file.originalname),
      path: req.file.path,
    };

    return res.json({ 
      success: true, 
      file: fileInfo 
    });
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ error: '文件上传失败' });
  }
});

// 解析文件内容
router.post('/parse', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = z.object({ fileId: z.string() }).parse(req.body);
    const userId = req.user!.id;
    
    const filePath = path.join(process.cwd(), 'uploads', userId, fileId);
    
    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: '文件不存在' });
    }

    const ext = path.extname(fileId).toLowerCase();
    let content = '';

    switch (ext) {
      case '.txt':
      case '.md':
        content = await fs.readFile(filePath, 'utf-8');
        break;
        
      case '.pdf':
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        content = pdfData.text;
        break;
        
      default:
        return res.status(400).json({ error: '不支持的文件类型' });
    }

    return res.json({ 
      success: true, 
      content,
      wordCount: content.length,
    });
  } catch (error) {
    console.error('File parse error:', error);
    return res.status(500).json({ error: '文件解析失败' });
  }
});

// 删除文件
router.delete('/:fileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user!.id;
    
    const filePath = path.join(process.cwd(), 'uploads', userId, fileId);
    
    await fs.unlink(filePath);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('File delete error:', error);
    return res.status(500).json({ error: '文件删除失败' });
  }
});

export default router;