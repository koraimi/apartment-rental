-- ============================================
-- APARTMENT RENTAL + AFFILIATE COMBO DATABASE
-- ============================================

-- Apartments table (rental listings)
CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  neighborhood VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  email VARCHAR(100),
  monthly_rent VARCHAR(50) CHECK (monthly_rent IN ('Under $500', '$500–$1000', '$1000+')),
  description TEXT,
  description_fr TEXT,
  description_ar TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  is_featured BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMP,
  listing_type VARCHAR(20) DEFAULT 'rental',
  external_booking_url TEXT,
  landlord_whatsapp VARCHAR(50),
  landlord_email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint to prevent duplicate names in same neighborhood
ALTER TABLE apartments ADD CONSTRAINT unique_apartment_location UNIQUE (name, neighborhood);

-- Features table (amenities)
CREATE TABLE IF NOT EXISTS features (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- Apartment features junction
CREATE TABLE IF NOT EXISTS apartment_features (
  apartment_id INT REFERENCES apartments(id) ON DELETE CASCADE,
  feature_id INT REFERENCES features(id) ON DELETE CASCADE,
  PRIMARY KEY (apartment_id, feature_id)
);

-- Apartment photos
CREATE TABLE IF NOT EXISTS apartment_photos (
  id SERIAL PRIMARY KEY,
  apartment_id INT REFERENCES apartments(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Landlord inquiries (for rental listings)
CREATE TABLE IF NOT EXISTS landlord_inquiries (
  id SERIAL PRIMARY KEY,
  apartment_id INT REFERENCES apartments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rental payments (for featured listings)
CREATE TABLE IF NOT EXISTS rental_payments (
  id SERIAL PRIMARY KEY,
  apartment_id INT REFERENCES apartments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  duration_months INT DEFAULT 1,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(200),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- Listing requests (from contact form)
CREATE TABLE IF NOT EXISTS listing_requests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  listing_type VARCHAR(50),
  message TEXT,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default features
INSERT INTO features (name) VALUES 
('Generator'), ('Furnished'), ('24hr Security'), ('Parking'), 
('Water Tank'), ('AC'), ('Internet'), ('Swimming Pool')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_apartments_neighborhood ON apartments(neighborhood);
CREATE INDEX IF NOT EXISTS idx_apartments_featured ON apartments(is_featured);
CREATE INDEX IF NOT EXISTS idx_apartments_featured_until ON apartments(featured_until);
CREATE INDEX IF NOT EXISTS idx_apartments_listing_type ON apartments(listing_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_apartment ON landlord_inquiries(apartment_id);
CREATE INDEX IF NOT EXISTS idx_payments_apartment ON rental_payments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_listing_requests_processed ON listing_requests(is_processed);