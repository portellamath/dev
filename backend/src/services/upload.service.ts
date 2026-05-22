import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { ProcessedImage } from '../types';
import { env } from '../config/env';

export class UploadService {
  private getPublicUrl(filename: string, folder: string): string {
    return `/uploads/${folder}/${filename}`;
  }

  async processAndSaveImage(
    file: Express.Multer.File,
    folder: string,
    options?: { width?: number; height?: number; quality?: number },
  ): Promise<ProcessedImage> {
    const outputFilename = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
    const outputPath = path.join(path.dirname(file.path), outputFilename);

    // Processa com sharp
    const sharpInstance = sharp(file.path);

    if (options?.width || options?.height) {
      sharpInstance.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const info = await sharpInstance
      .webp({ quality: options?.quality ?? 85 })
      .toFile(outputPath);

    // Remove arquivo original (foi convertido para webp)
    if (file.path !== outputPath && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return {
      url: this.getPublicUrl(outputFilename, folder),
      filename: outputFilename,
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
      mimeType: 'image/webp',
    };
  }

  async attachImagesToProduct(
    productId: string,
    files: Express.Multer.File[],
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) {
      // Remove uploads temporários
      files.forEach((f) => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      throw AppError.notFound('Produto não encontrado');
    }

    const existingCount = await prisma.image.count({ where: { productId } });
    const isPrimaryExists = existingCount > 0;

    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await this.processAndSaveImage(file, 'products', {
        width: 1200,
        height: 1200,
        quality: 85,
      });

      const image = await prisma.image.create({
        data: {
          productId,
          url: processed.url,
          altText: product.name,
          category: 'PRODUCT',
          sortOrder: existingCount + i,
          isPrimary: !isPrimaryExists && i === 0,
          width: processed.width,
          height: processed.height,
          sizeBytes: processed.sizeBytes,
          mimeType: processed.mimeType,
        },
      });

      created.push(image);
    }

    return created;
  }

  async attachImagesToVariant(
    variantId: string,
    files: Express.Multer.File[],
  ) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) {
      files.forEach((f) => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      throw AppError.notFound('Variante não encontrada');
    }

    const existingCount = await prisma.image.count({ where: { variantId } });
    const created = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await this.processAndSaveImage(file, 'products', {
        width: 800,
        height: 800,
        quality: 85,
      });

      const image = await prisma.image.create({
        data: {
          variantId,
          url: processed.url,
          altText: variant.name,
          category: 'VARIANT',
          sortOrder: existingCount + i,
          isPrimary: existingCount === 0 && i === 0,
          width: processed.width,
          height: processed.height,
          sizeBytes: processed.sizeBytes,
          mimeType: processed.mimeType,
        },
      });

      created.push(image);
    }

    return created;
  }

  async deleteImage(imageId: string) {
    const image = await prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw AppError.notFound('Imagem não encontrada');

    // Remove arquivo físico
    const filePath = path.join(env.LOCAL_UPLOAD_PATH, image.url.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.image.delete({ where: { id: imageId } });
  }

  async reorderImages(imageIds: string[]) {
    await prisma.$transaction(
      imageIds.map((id, index) =>
        prisma.image.update({
          where: { id },
          data: { sortOrder: index, isPrimary: index === 0 },
        }),
      ),
    );
  }
}