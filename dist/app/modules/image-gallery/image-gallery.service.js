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
exports.imageGalleryService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const path_1 = __importDefault(require("path"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const cloudinary_1 = require("../../utils/cloudinary");
const helper_1 = require("../../utils/helper");
const image_gallery_model_1 = require("./image-gallery.model");
const getAllImages = (req) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const query = req.query;
        const galleryQuery = new QueryBuilder_1.default(image_gallery_model_1.ImageGalleryModel.find(), query)
            .filter()
            .sort()
            .paginate();
        const meta = yield galleryQuery.countTotal();
        const result = yield galleryQuery.queryModel;
        return { result, meta };
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message);
    }
});
const getImagesByFolder = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const { folder } = req.params;
    const limit = parseInt(req.query.limit, 10) || 10;
    const page = parseInt(req.query.page, 10) || 1;
    try {
        const folderExist = yield image_gallery_model_1.FolderModel.findOne({ _id: folder });
        if (!folderExist) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Folder not found');
        }
        const totalImages = yield image_gallery_model_1.ImageGalleryModel.countDocuments({
            folder: folderExist._id
        });
        const images = yield image_gallery_model_1.ImageGalleryModel.find({
            folder: folderExist._id
        })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });
        return {
            images,
            folder: folderExist.name,
            meta: {
                total: totalImages,
                page,
                limit,
                totalPages: Math.ceil(totalImages / limit)
            }
        };
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message);
    }
});
// Function to create and upload images
const createImage = (req) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // If you use upload.array('images') multer will set req.files as Express.Multer.File[]
        const files = req.files;
        const { folder } = req.body;
        if (!files || files.length === 0) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Please upload an image');
        }
        if (!folder) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Please provide a folder id');
        }
        // Check folder existence
        const folderDoc = yield image_gallery_model_1.FolderModel.findById(folder);
        if (!folderDoc) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Folder not found');
        }
        const uploadedImages = [];
        for (const file of files) {
            // validate using your existing validator which expects size and type
            const validationError = (0, helper_1.imageValidator)(file.size, file.mimetype);
            if (validationError) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, validationError);
            }
            // send buffer + mimetype to Cloudinary
            const uploadResult = yield (0, cloudinary_1.sendImageToCloudinary)(
            // Use original name (without path), but trim & replace spaces
            `${path_1.default.parse(file.originalname).name}_${Date.now()}`, file.buffer, file.mimetype, 'image-gallery' // this will put images under softypy/image-gallery
            );
            const url = uploadResult.secure_url;
            // eager thumbnail if present
            const thumbnailUrl = (uploadResult.eager && ((_a = uploadResult.eager[0]) === null || _a === void 0 ? void 0 : _a.secure_url)) || url;
            const publicId = uploadResult.public_id;
            uploadedImages.push({
                url,
                thumbnail_url: thumbnailUrl,
                public_id: publicId,
                folder: folderDoc._id
            });
        }
        // Insert and update folder ref
        if (uploadedImages.length > 0) {
            const insertedImages = yield image_gallery_model_1.ImageGalleryModel.insertMany(uploadedImages);
            yield image_gallery_model_1.FolderModel.findByIdAndUpdate(folderDoc._id, {
                $addToSet: { images: { $each: insertedImages.map((img) => img._id) } }
            });
        }
        return 'Images uploaded successfully';
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || "Couldn't upload images");
    }
});
// Function to delete an image
const deleteImage = (req) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, public_id } = req.body;
        const image = yield image_gallery_model_1.ImageGalleryModel.findById(id);
        if (!image) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Image not found');
        }
        // prefer DB public_id if caller didn't give one
        const publicIdToDelete = public_id || image.public_id;
        if (!publicIdToDelete) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing public_id for Cloudinary deletion');
        }
        yield (0, cloudinary_1.deleteImageFromCloudinary)(publicIdToDelete);
        yield image_gallery_model_1.ImageGalleryModel.findByIdAndDelete(id);
        // Also optionally remove reference from FolderModel.images
        yield image_gallery_model_1.FolderModel.findByIdAndUpdate(image.folder, {
            $pull: { images: image._id }
        });
        return 'Image deleted successfully';
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || 'Could not delete image');
    }
});
const getFolders = (req) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchableFields = ['name'];
        const query = Object.assign(Object.assign({}, req.query), { type: req.query.type || 'image' || null });
        const folderQuery = new QueryBuilder_1.default(image_gallery_model_1.FolderModel.find(), query)
            .search(searchableFields)
            .filter()
            .sort()
            .paginate();
        const meta = yield folderQuery.countTotal();
        const result = yield folderQuery.queryModel;
        return {
            meta,
            result
        };
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || 'Could not get folders');
    }
});
const getFolderById = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const folder = yield image_gallery_model_1.FolderModel.findById(id);
        if (!folder) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Folder not found');
        }
        return folder;
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || 'Could not get folder');
    }
});
const updateFolder = (req) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const folder = yield image_gallery_model_1.FolderModel.findById(id);
        if (!folder) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Folder not found');
        }
        yield image_gallery_model_1.FolderModel.findByIdAndUpdate(id, { name });
        return 'Folder updated successfully';
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || 'Could not update folder');
    }
});
// Function to create a folder
const createFolder = (req) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, type } = req.body;
        if (!name) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Please provide a folder name');
        }
        const folder = yield image_gallery_model_1.FolderModel.create({ name, type: type || 'image' });
        return folder;
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || 'Could not create folder');
    }
});
// Function to delete a folder
const deleteFolder = (req) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // check if folder has images if yes, then show error message else delete folder
        const folder = yield image_gallery_model_1.FolderModel.findById(id);
        if (!folder) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Folder not found');
        }
        //  Check if folder has images in image model
        const images = yield image_gallery_model_1.ImageGalleryModel.find({ folder: id });
        if (images.length > 0) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Folder has images, please delete them first');
        }
        yield image_gallery_model_1.FolderModel.findByIdAndDelete(id);
        return 'Folder deleted successfully';
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, error.message || 'Could not delete folder');
    }
});
exports.imageGalleryService = {
    getAllImages,
    getImagesByFolder,
    createImage,
    deleteImage,
    createFolder,
    deleteFolder,
    getFolders,
    updateFolder,
    getFolderById
};
