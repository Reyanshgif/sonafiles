const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Product Images Storage ────────────────────────────────
const productImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sonachandi/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  },
});

// ── Certificate Storage (BIS/Hallmark PDFs + Images) ─────
const certificateStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sonachandi/certificates',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto',
  },
});

const uploadProductImage  = multer({ storage: productImageStorage });
const uploadCertificate   = multer({ storage: certificateStorage, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { cloudinary, uploadProductImage, uploadCertificate };
