const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} apartmentId - Apartment ID for folder organization
 * @returns {Promise<Object>} - Cloudinary upload result with secure_url
 */
async function uploadToCloudinary(fileBuffer, apartmentId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `apartment-rental/apartments/${apartmentId}`,
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
          { width: 1200, crop: 'limit' }
        ],
        allowed_formats: ['jpg', 'png', 'gif', 'webp', 'jpeg']
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
}

/**
 * Delete an image from Cloudinary by its public ID
 * @param {string} publicId - The Cloudinary public ID of the image
 */
async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary image URL
 * @returns {string} - Public ID
 */
function getPublicIdFromUrl(url) {
  // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image.jpg
  const parts = url.split('/upload/');
  if (parts.length > 1) {
    const pathParts = parts[1].split('/');
    // Remove version prefix (v1234567890) if present
    const startIndex = pathParts[0].startsWith('v') ? 1 : 0;
    return pathParts.slice(startIndex).join('/').split('.')[0];
  }
  return null;
}

module.exports = { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl };