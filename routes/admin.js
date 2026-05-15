const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require('../utils/cloudinary');

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password_hash FROM admins WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.use(verifyJWT);

router.get('/apartments', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, neighborhood, monthly_rent, listing_type, is_featured FROM apartments ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/apartments', async (req, res) => {
  const { name, neighborhood, monthly_rent, listing_type, external_booking_url, landlord_whatsapp, landlord_email, description, description_fr, description_ar, features } = req.body;
  if (!name || !neighborhood || !monthly_rent) {
    return res.status(400).json({ error: 'Name, neighborhood and monthly rent are required' });
  }
  try {
    const duplicateCheck = await pool.query('SELECT id FROM apartments WHERE name = $1 AND neighborhood = $2', [name, neighborhood]);
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'An apartment with this name and neighborhood already exists.' });
    }
    const result = await pool.query(
      `INSERT INTO apartments (name, neighborhood, monthly_rent, listing_type, external_booking_url, landlord_whatsapp, landlord_email, description, description_fr, description_ar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [name, neighborhood, monthly_rent, listing_type || 'rental', external_booking_url || null, landlord_whatsapp || null, landlord_email || null, description || null, description_fr || null, description_ar || null]
    );
    const apartmentId = result.rows[0].id;
    
    if (Array.isArray(features) && features.length) {
      for (let featureName of features) {
        const featureRes = await pool.query('SELECT id FROM features WHERE name = $1', [featureName]);
        if (featureRes.rows.length) {
          await pool.query('INSERT INTO apartment_features (apartment_id, feature_id) VALUES ($1, $2)', [apartmentId, featureRes.rows[0].id]);
        }
      }
    }
    
    res.status(201).json({ id: apartmentId });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Duplicate apartment.' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/apartments/:id', async (req, res) => {
  const id = req.params.id;
  const { name, neighborhood, monthly_rent, listing_type, external_booking_url,
          landlord_whatsapp, landlord_email, description, description_fr, description_ar,
          features, is_featured, latitude, longitude } = req.body;

  if (!name || !neighborhood || !monthly_rent) {
    return res.status(400).json({ error: 'Name, neighborhood and monthly rent are required' });
  }

  try {
    const duplicateCheck = await pool.query(
      'SELECT id FROM apartments WHERE name = $1 AND neighborhood = $2 AND id != $3',
      [name, neighborhood, id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Another apartment with this name and neighborhood already exists.' });
    }

    await pool.query(
      `UPDATE apartments SET 
        name=$1, neighborhood=$2, monthly_rent=$3, listing_type=$4,
        external_booking_url=$5, landlord_whatsapp=$6, landlord_email=$7,
        description=$8, description_fr=$9, description_ar=$10,
        is_featured=$11, latitude=$12, longitude=$13,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=$14`,
      [name, neighborhood, monthly_rent, listing_type, external_booking_url,
       landlord_whatsapp, landlord_email, description || null, description_fr || null, description_ar || null,
       is_featured || false, latitude || null, longitude || null, id]
    );

    await pool.query('DELETE FROM apartment_features WHERE apartment_id = $1', [id]);
    if (Array.isArray(features) && features.length) {
      for (let featureName of features) {
        const fRes = await pool.query('SELECT id FROM features WHERE name = $1', [featureName]);
        if (fRes.rows.length) {
          await pool.query('INSERT INTO apartment_features (apartment_id, feature_id) VALUES ($1, $2)', [id, fRes.rows[0].id]);
        }
      }
    }
    res.json({ message: 'Apartment updated successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Duplicate apartment.' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/apartments/:id/featured', async (req, res) => {
  const id = req.params.id;
  const { is_featured } = req.body;
  try {
    await pool.query('UPDATE apartments SET is_featured = $1 WHERE id = $2', [is_featured, id]);
    if (is_featured) {
      await pool.query(`INSERT INTO rental_payments (apartment_id, amount, duration_months, status) VALUES ($1, 50, 1, 'completed')`, [id]);
    }
    res.json({ message: `Featured status updated to ${is_featured}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/apartments/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM apartments WHERE id = $1', [id]);
    res.json({ message: 'Apartment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/apartments/:id/photos', upload.single('photo'), async (req, res) => {
  const aptId = req.params.id;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, aptId);
    
    // Get sort order for database
    const orderRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM apartment_photos WHERE apartment_id = $1',
      [aptId]
    );
    const sortOrder = orderRes.rows[0].next_order;
    
    // Save to database
    await pool.query(
      'INSERT INTO apartment_photos (apartment_id, photo_url, sort_order) VALUES ($1, $2, $3)',
      [aptId, result.secure_url, sortOrder]
    );
    
    res.json({ 
      photoUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Failed to upload image: ' + err.message });
  }
});

router.delete('/photos/:id', async (req, res) => {
  const photoId = req.params.id;
  
  try {
    // Get photo URL from database
    const photoRes = await pool.query('SELECT photo_url FROM apartment_photos WHERE id = $1', [photoId]);
    
    if (photoRes.rows.length) {
      const photoUrl = photoRes.rows[0].photo_url;
      
      // Extract public ID and delete from Cloudinary
      const publicId = getPublicIdFromUrl(photoUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId);
        } catch (cloudErr) {
          console.warn('Cloudinary delete warning:', cloudErr.message);
          // Continue with database deletion even if Cloudinary delete fails
        }
      }
    }
    
    // Delete from database
    await pool.query('DELETE FROM apartment_photos WHERE id = $1', [photoId]);
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inquiries', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.name, i.email, i.phone, i.message, i.is_read, i.created_at, a.name as apartment_name
      FROM landlord_inquiries i
      JOIN apartments a ON i.apartment_id = a.id
      ORDER BY i.is_read ASC, i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/inquiries/:id/read', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('UPDATE landlord_inquiries SET is_read = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Inquiry marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, a.name as apartment_name
      FROM rental_payments p
      JOIN apartments a ON p.apartment_id = a.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalRes = await pool.query('SELECT COUNT(*) FROM apartments');
    const rentalRes = await pool.query("SELECT COUNT(*) FROM apartments WHERE listing_type = 'rental'");
    const affiliateRes = await pool.query("SELECT COUNT(*) FROM apartments WHERE listing_type = 'affiliate'");
    const featuredRes = await pool.query('SELECT COUNT(*) FROM apartments WHERE is_featured = true');
    const inquiryRes = await pool.query('SELECT COUNT(*) FROM landlord_inquiries WHERE is_read = false');
    const revenueRes = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM rental_payments WHERE status = 'completed'");
    res.json({
      total_apartments: parseInt(totalRes.rows[0].count) || 0,
      rental_listings: parseInt(rentalRes.rows[0].count) || 0,
      affiliate_listings: parseInt(affiliateRes.rows[0].count) || 0,
      featured_listings: parseInt(featuredRes.rows[0].count) || 0,
      unread_inquiries: parseInt(inquiryRes.rows[0].count) || 0,
      total_revenue: parseFloat(revenueRes.rows[0].total) || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/listing-requests', async (req, res) => {
  try {
    
    const result = await pool.query(`
      SELECT id, name, email, phone, address, listing_type, message, is_processed, created_at
      FROM listing_requests
      ORDER BY is_processed ASC, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/listing-requests/:id/process', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('UPDATE listing_requests SET is_processed = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Request marked as processed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;