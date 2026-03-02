"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.cloudinaryConfig = exports.deleteAttachment = exports.saveAttachment = exports.deleteImageFromCloudinary = exports.sendImageToCloudinary = void 0;
/* eslint-disable no-undef */
const cloudinary_1 = require("cloudinary");
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../config"));
const AppError_1 = __importDefault(require("../errors/AppError"));
cloudinary_1.v2.config({
    cloud_name: config_1.default.CLOUDINARY_CLOUD_NAME,
    api_key: config_1.default.CLOUDINARY_CLOUD_KEY,
    api_secret: config_1.default.CLOUDINARY_CLOUD_SECRET
});
/**
 * Upload a buffer to Cloudinary using a data URI
 * @param imageName - desired public id (Cloudinary will unique-ify if conflict)
 * @param buffer - Buffer from multer.memoryStorage()
 * @param mimetype - original file mimetype (e.g., 'image/jpeg')
 * @param folder - folder suffix under your base (e.g. 'image-gallery')
 */
const sendImageToCloudinary = (imageName, buffer, mimetype, folder) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
        // upload; add eager transformation for a thumbnail
        const result = yield cloudinary_1.v2.uploader.upload(dataUri, {
            public_id: imageName.trim().replace(/\s+/g, '_'),
            folder: `softypy/${folder}`,
            // produce a thumbnail eager result (200x200 thumb)
            eager: [{ width: 200, height: 200, crop: 'thumb', gravity: 'auto' }]
        });
        return result;
    }
    catch (error) {
        // bubble a helpful error
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to upload image to Cloudinary');
    }
});
exports.sendImageToCloudinary = sendImageToCloudinary;
const deleteImageFromCloudinary = (publicId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield cloudinary_1.v2.uploader.destroy(publicId);
        return result;
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to delete image from Cloudinary');
    }
});
exports.deleteImageFromCloudinary = deleteImageFromCloudinary;
/**
 * If you still need an attachment helper (same approach)
 */
const saveAttachment = (file_1, ...args_1) => __awaiter(void 0, [file_1, ...args_1], void 0, function* (file, folder = 'attachments') {
    try {
        return yield (0, exports.sendImageToCloudinary)(new Date().toISOString(), file.buffer, file.mimetype, folder);
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to upload attachment to Cloudinary');
    }
});
exports.saveAttachment = saveAttachment;
const deleteAttachment = (publicId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield (0, exports.deleteImageFromCloudinary)(publicId);
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to delete attachment from Cloudinary');
    }
});
exports.deleteAttachment = deleteAttachment;
exports.cloudinaryConfig = cloudinary_1.v2;
/**
 * Multer upload middleware (memory storage)
 * Note: limit fileSize is 2MB below (1024 * 1024 * 2)
 */
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 2, // 2MB
        files: 5
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const mimeType = allowedTypes.test(file.mimetype.toLowerCase());
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimeType && extname) {
            return cb(null, true);
        }
        cb(new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Only images are allowed. Supported formats are jpeg, jpg, png, webp and gif'));
    }
});
