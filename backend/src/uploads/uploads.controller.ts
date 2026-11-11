import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UPLOADS_DIR } from './uploads.constants';

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };

/**
 * MVP image storage: files go to backend/uploads/ on local disk and are served
 * at /uploads/<name>. Swap for S3 (see README) before running more than one
 * server instance.
 */
@ApiTags('Uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Post('images')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one image (field "file", max 5 MB); returns its URL path' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, !!IMAGE_TYPES[file.mimetype]),
    storage: diskStorage({
      destination: UPLOADS_DIR,
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${IMAGE_TYPES[file.mimetype] ?? extname(file.originalname)}`),
    }),
  }))
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Send one JPEG, PNG, WebP or HEIC image in the "file" field (max 5 MB)');
    return { url: `/uploads/${file.filename}` };
  }
}
