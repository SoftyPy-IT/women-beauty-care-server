/* eslint-disable no-undef */
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import httpStatus from 'http-status';
import config from '../config';
import AppError from '../errors/AppError';

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_CLOUD_KEY,
  api_secret: config.CLOUDINARY_CLOUD_SECRET
});

/**
 * Upload a buffer to Cloudinary using a data URI
 * @param imageName - desired public id (Cloudinary will unique-ify if conflict)
 * @param buffer - Buffer from multer.memoryStorage()
 * @param mimetype - original file mimetype (e.g., 'image/jpeg')
 * @param folder - folder suffix under your base (e.g. 'image-gallery')
 */
export const sendImageToCloudinary = async (
  imageName: string,
  buffer: Buffer,
  mimetype: string,
  folder: string
): Promise<UploadApiResponse> => {
  try {
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;

    // upload; add eager transformation for a thumbnail
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: imageName.trim().replace(/\s+/g, '_'),
      folder: `softypy/${folder}`,
      // produce a thumbnail eager result (200x200 thumb)
      eager: [{ width: 200, height: 200, crop: 'thumb', gravity: 'auto' }]
    });

    return result;
  } catch (error) {
    // bubble a helpful error
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload image to Cloudinary');
  }
};

export const deleteImageFromCloudinary = async (
  publicId: string
): Promise<UploadApiResponse | UploadApiErrorResponse> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete image from Cloudinary');
  }
};

/**
 * If you still need an attachment helper (same approach)
 */
export const saveAttachment = async (
  file: Express.Multer.File,
  folder = 'attachments'
): Promise<UploadApiResponse> => {
  try {
    return await sendImageToCloudinary(
      new Date().toISOString(),
      file.buffer,
      file.mimetype,
      folder
    );
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to upload attachment to Cloudinary'
    );
  }
};

export const deleteAttachment = async (
  publicId: string
): Promise<UploadApiResponse | UploadApiErrorResponse> => {
  try {
    return await deleteImageFromCloudinary(publicId);
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete attachment from Cloudinary'
    );
  }
};

export const cloudinaryConfig = cloudinary;

/**
 * Multer upload middleware (memory storage)
 * Note: limit fileSize is 2MB below (1024 * 1024 * 2)
 */
import multer from 'multer';
import path from 'path';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 2, // 2MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const mimeType = allowedTypes.test(file.mimetype.toLowerCase());
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimeType && extname) {
      return cb(null, true);
    }
    cb(
      new AppError(
        httpStatus.BAD_REQUEST,
        'Only images are allowed. Supported formats are jpeg, jpg, png, webp and gif'
      )
    );
  }
});
