/**
 * Affiliate link processor for apartment rentals
 * Supports Booking.com, Airbnb, Expedia for travel stay affiliates
 */

const AFFILIATE_ENABLED = process.env.AFFILIATE_ENABLED !== 'false';
const BOOKING_COM_AFFILIATE_ID = process.env.BOOKING_COM_AFFILIATE_ID || '';
const AIRBNB_AFFILIATE_ID = process.env.AIRBNB_AFFILIATE_ID || '';
const EXPEDIA_AFFILIATE_ID = process.env.EXPEDIA_AFFILIATE_ID || '';

function addAffiliateParams(url) {
  if (!AFFILIATE_ENABLED) return url;
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('booking.com') && BOOKING_COM_AFFILIATE_ID) {
      urlObj.searchParams.set('aid', BOOKING_COM_AFFILIATE_ID);
      return urlObj.toString();
    }
    
    if (hostname.includes('airbnb.com') && AIRBNB_AFFILIATE_ID) {
      urlObj.searchParams.set('affiliate_id', AIRBNB_AFFILIATE_ID);
      return urlObj.toString();
    }
    
    if (hostname.includes('expedia.com') && EXPEDIA_AFFILIATE_ID) {
      urlObj.searchParams.set('affiliateId', EXPEDIA_AFFILIATE_ID);
      return urlObj.toString();
    }
    
    return url;
  } catch (error) {
    console.error('Affiliate error:', error.message);
    return url;
  }
}

function getAffiliateStats(apartments) {
  if (!apartments || !apartments.length) return { total: 0, affiliate: 0, rental: 0 };
  
  const stats = {
    total: apartments.length,
    rental: apartments.filter(a => a.listing_type === 'rental').length,
    affiliate: apartments.filter(a => a.listing_type === 'affiliate').length,
    featured: apartments.filter(a => a.is_featured).length
  };
  
  return stats;
}

module.exports = { addAffiliateParams, getAffiliateStats };