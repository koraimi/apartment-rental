const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { addAffiliateParams } = require('../utils/affiliate');
const { apiLimiter, submissionLimiter } = require('../middleware/rateLimiter');

// GET /api/apartments - list apartments with filters
router.get('/apartments', apiLimiter, async (req, res) => {
  try {
    
    
    
    const { neighborhood, feature, monthly_rent, type } = req.query;
    
    let query = `
      SELECT 
        a.id, a.name, a.neighborhood, a.monthly_rent, a.listing_type,
        a.landlord_whatsapp, a.landlord_email, a.external_booking_url,
        a.is_featured,
        (SELECT photo_url FROM apartment_photos WHERE apartment_id = a.id ORDER BY sort_order LIMIT 1) as main_photo
      FROM apartments a
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Neighborhood filter
    if (neighborhood && neighborhood !== '' && neighborhood !== 'undefined') {
      paramCount++;
      params.push(`%${neighborhood}%`);
      query += ` AND a.neighborhood ILIKE $${paramCount}`;
      console.log(`Added neighborhood filter: ${neighborhood}`);
    }
    
    // Monthly rent filter
    if (monthly_rent && monthly_rent !== '' && monthly_rent !== 'undefined') {
      paramCount++;
      params.push(monthly_rent);
      query += ` AND a.monthly_rent = $${paramCount}`;
      
    }
    
    // Listing type filter
    if (type && type !== 'all' && type !== '' && type !== 'undefined') {
      paramCount++;
      params.push(type);
      query += ` AND a.listing_type = $${paramCount}`;
      
    }
    
    // Feature filter
    if (feature && feature !== '' && feature !== 'undefined') {
      let features = Array.isArray(feature) ? feature : [feature];
      for (let f of features) {
        if (f && f !== '' && f !== 'undefined') {
          paramCount++;
          params.push(f);
          query += ` AND EXISTS (
            SELECT 1 FROM apartment_features af 
            JOIN features ft ON af.feature_id = ft.id 
            WHERE af.apartment_id = a.id AND ft.name = $${paramCount}
          )`;
      
        }
      }
    }
    
    query += ` ORDER BY a.is_featured DESC, a.id`;
    
    
    
    
    const result = await pool.query(query, params);
    
    // Apply affiliate parameters
    const processed = result.rows.map(apt => {
      if (apt.listing_type === 'affiliate' && apt.external_booking_url) {
        apt.external_booking_url = addAffiliateParams(apt.external_booking_url);
      }
      return apt;
    });
    
    res.json(processed);
  } catch (err) {
    console.error('Error in /api/apartments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/apartments/:id - single apartment details
router.get('/apartments/:id', apiLimiter, async (req, res) => {
  try {
    const aptId = req.params.id;
    const lang = req.query.lang || 'en';
    
    const aptRes = await pool.query('SELECT * FROM apartments WHERE id = $1', [aptId]);
    if (aptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Apartment not found' });
    }
    const apartment = aptRes.rows[0];
    
    // Get features
    const featuresRes = await pool.query(`
      SELECT array_agg(f.name) as features
      FROM features f
      INNER JOIN apartment_features af ON f.id = af.feature_id
      WHERE af.apartment_id = $1
    `, [aptId]);
    apartment.features = featuresRes.rows[0].features || [];
    
    // Language selection for description
    let description = apartment.description || '';
    if (lang === 'fr' && apartment.description_fr) {
      description = apartment.description_fr;
    } else if (lang === 'ar' && apartment.description_ar) {
      description = apartment.description_ar;
    }
    apartment.description = description;
    
    // Get photos
    const photosRes = await pool.query(
      'SELECT id, photo_url FROM apartment_photos WHERE apartment_id = $1 ORDER BY sort_order',
      [aptId]
    );
    apartment.photos = photosRes.rows;
    
    // Affiliate link processing
    if (apartment.listing_type === 'affiliate' && apartment.external_booking_url) {
      apartment.external_booking_url = addAffiliateParams(apartment.external_booking_url);
    }
    
    res.json(apartment);
  } catch (err) {
    console.error('Error in /api/apartments/:id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/neighborhoods
router.get('/neighborhoods', apiLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT neighborhood FROM apartments ORDER BY neighborhood');
    res.json(result.rows.map(r => r.neighborhood));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/features
router.get('/features', apiLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM features ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inquiry - send inquiry to landlord
router.post('/inquiry', submissionLimiter, async (req, res) => {
  const { apartment_id, name, email, phone, message } = req.body;
  if (!apartment_id || !name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const aptCheck = await pool.query('SELECT listing_type FROM apartments WHERE id = $1', [apartment_id]);
    if (aptCheck.rows[0]?.listing_type !== 'rental') {
      return res.status(400).json({ error: 'Inquiries only for rental listings' });
    }
    await pool.query(
      `INSERT INTO landlord_inquiries (apartment_id, name, email, phone, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [apartment_id, name, email, phone || null, message]
    );
    res.status(201).json({ message: 'Inquiry sent to landlord!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contact-owner - listing request
router.post('/contact-owner', submissionLimiter, async (req, res) => {
  const { name, email, phone, address, type, message } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    
    await pool.query(
      `INSERT INTO listing_requests (name, email, phone, address, listing_type, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, email, phone, address || null, type || null, message || null]
    );
    res.status(201).json({ message: 'Request sent! We will contact you soon.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;