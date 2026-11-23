/**
 * Secure file uploads: MIME allow-list + magic-byte sniffing, size limit, random file names.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { ErrorCodes, ErrorMessages, UploadRules, UPLOADS_PUBLIC_PATH } from '../constants';
import { AppError } from '../utils/errors';
import { StatusCodes } from '../constants/api';
import type { UploadedFileInfo } from '../models';

interface MulterFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
};

/** Validates leading bytes so a renamed executable can't pass as an image. */
const sniff = (buf: Buffer): string | null => {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
};

const rejected = (msg: string = ErrorMessages.FILE_TYPE_NOT_ALLOWED) => new AppError(msg, StatusCodes.BAD_REQUEST, ErrorCodes.FILE_REJECTED);

/**
 * Accepts up to N files in memory, verifies them, then writes to UPLOAD_DIR/<folder>/.
 * Saved file info is placed on `req.body.__files`.
 */
export const uploadFiles = (folder: string, field: string, allowed: string[] = UploadRules.IMAGE_MIME_TYPES, maxFiles: number = UploadRules.MAX_FILES_PER_REQUEST) => {
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.upload.maxBytes, files: maxFiles },
    fileFilter: (_req, file, cb) => (allowed.includes(file.mimetype) ? cb(null, true) : cb(rejected())),
  }).array(field, maxFiles);

  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) return next(rejected(err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${Math.round(config.upload.maxBytes / 1048576)} MB)` : err.message));
        return next(err);
      }
      try {
        const files = (req.files as MulterFile[] | undefined) ?? [];
        const dir = path.resolve(config.upload.dir, folder);
        fs.mkdirSync(dir, { recursive: true });
        const saved: UploadedFileInfo[] = files.map((f) => {
          const real = sniff(f.buffer);
          if (!real || !allowed.includes(real)) throw rejected();
          const name = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${EXT[real]}`;
          fs.writeFileSync(path.join(dir, name), f.buffer, { mode: 0o640 });
          return { path: `${UPLOADS_PUBLIC_PATH}/${folder}/${name}`, mimeType: real, size: f.size };
        });
        res.locals.files = saved;
        next();
      } catch (e) {
        next(e);
      }
    });
  };
};
