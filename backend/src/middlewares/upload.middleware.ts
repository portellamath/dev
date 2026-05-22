import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const UPLOAD_PATH = env.LOCAL_UPLOAD_PATH;
const MAX_SIZE_BYTES = env.UPLOAD_MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = env.UPLOAD_ALLOWED_TYPES.split(',');

// Garante que diretórios de upload existem
const ensureDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(UPLOAD_PATH, 'products');
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(UPLOAD_PATH, 'avatars');
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `avatar-${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    cb(
      new AppError(
        `Tipo de arquivo não permitido. Permitidos: ${ALLOWED_TYPES.join(', ')}`,
        400,
        'INVALID_FILE_TYPE',
      ),
    );
    return;
  }
  cb(null, true);
};

export const uploadProductImages = multer({
  storage: productStorage,
  limits: { fileSize: MAX_SIZE_BYTES, files: 10 },
  fileFilter,
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
  fileFilter,
});

// Helper para obter URL pública de um arquivo
export const getFileUrl = (filename: string, folder: string): string => {
  return `/uploads/${folder}/${filename}`;
};