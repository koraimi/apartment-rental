const urlParams = new URLSearchParams(window.location.search);
const apartmentId = urlParams.get('id');
let map = null;
let currentApartment = null;

async function loadApartment() {
  if (!apartmentId) {
    document.getElementById('apartmentDetail').innerHTML = `<div class="error-message">${i18n.t('no_id', 'No apartment ID specified.')} <a href="/">${i18n.t('back_to_listings')}</a></div>`;
    return;
  }

  try {
    const currentLang = i18n.currentLang ? i18n.currentLang() : 'en';
    const response = await fetch(`/api/apartments/${apartmentId}?lang=${currentLang}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    currentApartment = await response.json();
    renderApartment();
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('apartmentDetail').innerHTML = `<div class="error-message">${i18n.t('error_loading', 'Error loading property')}. <a href="/">${i18n.t('back_to_listings')}</a></div>`;
  }
}

function renderApartment() {
  const apt = currentApartment;
  if (!apt) return;
  const isRental = apt.listing_type === 'rental';

  let actionButton = '';
  if (isRental && apt.landlord_whatsapp) {
    actionButton = `<a href="https://wa.me/${apt.landlord_whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn-primary-action large"><i class="fab fa-whatsapp"></i> ${i18n.t('contact_landlord')}</a>`;
  } else if (!isRental && apt.external_booking_url) {
    actionButton = `<a href="${apt.external_booking_url}" target="_blank" class="btn-primary-action large"><i class="fas fa-calendar-check"></i> ${i18n.t('check_availability')}</a>`;
  }

  let photosHtml = '';
  if (apt.photos && apt.photos.length) {
    photosHtml = `<div class="gallery-grid">${apt.photos.map(p => `<div class="gallery-item"><img src="${p.photo_url}" class="gallery-img" onclick="openLightbox('${p.photo_url}')" alt="${escapeHtml(apt.name)}" loading="lazy"></div>`).join('')}</div>`;
  } else {
    photosHtml = `<div class="no-photos">${i18n.t('no_photos', 'No photos uploaded')}</div>`;
  }

  let featuresHtml = '';
  if (apt.features && apt.features.length) {
    featuresHtml = apt.features.map(f => `<span class="feature-item"><i class="fas fa-check-circle"></i> ${escapeHtml(f)}</span>`).join('');
  } else {
    featuresHtml = `<span class="text-gray-500">${i18n.t('no_features', 'No features listed')}</span>`;
  }

  const container = document.getElementById('apartmentDetail');
  container.innerHTML = `
    <div class="detail-container-inner">
      <h1 class="apartment-title">${escapeHtml(apt.name)}</h1>
      <div class="apartment-meta">
        <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(apt.neighborhood)}</span>
        <span>•</span>
        <span><i class="fas fa-dollar-sign"></i> ${escapeHtml(apt.monthly_rent)} / ${i18n.t('month')}</span>
        ${apt.is_featured ? `<span class="featured-tag"><i class="fas fa-star"></i> ${i18n.t('featured')}</span>` : ''}
      </div>
      <div class="action-section">${actionButton}</div>
      <div class="details-grid">
        <div class="details-info">
          <h2>${i18n.t('description')}</h2>
          <p>${escapeHtml(apt.description || i18n.t('no_description'))}</p>
          <h3>${i18n.t('amenities')}</h3>
          <div class="features-list-detail">${featuresHtml}</div>
          <div class="contact-info-detail">
            ${apt.phone ? `<p><i class="fas fa-phone"></i> ${escapeHtml(apt.phone)}</p>` : ''}
            ${apt.email ? `<p><i class="fas fa-envelope"></i> ${escapeHtml(apt.email)}</p>` : ''}
          </div>
        </div>
        <div class="details-gallery">
          <h2>${i18n.t('photo_gallery')}</h2>
          ${photosHtml}
        </div>
      </div>
    </div>
  `;

  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    if (apt.latitude && apt.longitude && typeof L !== 'undefined') {
      const lat = parseFloat(apt.latitude);
      const lng = parseFloat(apt.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        if (map) map.remove();
        mapContainer.innerHTML = '';
        map = L.map('map').setView([lat, lng], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        }).addTo(map);
        L.marker([lat, lng]).addTo(map).bindPopup(`<b>${escapeHtml(apt.name)}</b>`).openPopup();
      } else {
        mapContainer.innerHTML = `<div class="map-placeholder">${i18n.t('location_unavailable')}</div>`;
      }
    } else {
      mapContainer.innerHTML = `<div class="map-placeholder">${i18n.t('location_unavailable')}</div>`;
    }
  }

  const inquiryDiv = document.getElementById('inquirySection');
  if (inquiryDiv) {
    if (isRental) {
      inquiryDiv.style.display = 'block';
      inquiryDiv.innerHTML = `
        <div class="inquiry-container">
          <h2><i class="fas fa-paper-plane"></i> ${i18n.t('interested')}</h2>
          <p>${i18n.t('interested_subtitle')}</p>
          <form id="inquiryForm">
            <div class="form-row">
              <input type="text" id="inquiryName" placeholder="${i18n.t('your_name')}" required>
              <input type="email" id="inquiryEmail" placeholder="${i18n.t('your_email')}" required>
            </div>
            <div class="form-row">
              <input type="tel" id="inquiryPhone" placeholder="${i18n.t('your_phone')}">
            </div>
            <textarea id="inquiryMessage" placeholder="${i18n.t('your_message')}" rows="4" required></textarea>
            <button type="submit" class="btn-submit">${i18n.t('send_inquiry')}</button>
          </form>
        </div>
      `;
      document.getElementById('inquiryForm')?.addEventListener('submit', sendInquiry);
    } else {
      inquiryDiv.style.display = 'none';
    }
  }
}

async function sendInquiry(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = i18n.t('sending');

  const inquiryData = {
    apartment_id: apartmentId,
    name: document.getElementById('inquiryName').value,
    email: document.getElementById('inquiryEmail').value,
    phone: document.getElementById('inquiryPhone').value || null,
    message: document.getElementById('inquiryMessage').value
  };

  try {
    const response = await fetch('/api/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiryData)
    });
    if (response.ok) {
      alert(i18n.t('inquiry_sent'));
      e.target.reset();
    } else {
      const error = await response.json();
      alert(i18n.t('inquiry_error') + ': ' + (error.error || ''));
    }
  } catch (err) {
    alert(i18n.t('inquiry_error'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openLightbox(imgSrc) {
  const modal = document.createElement('div');
  modal.className = 'lightbox-modal';
  modal.onclick = () => modal.remove();
  const img = document.createElement('img');
  img.src = imgSrc;
  img.className = 'lightbox-image';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.className = 'lightbox-close';
  closeBtn.onclick = () => modal.remove();
  modal.appendChild(img);
  modal.appendChild(closeBtn);
  document.body.appendChild(modal);
}

window.openLightbox = openLightbox;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadApartment);
} else {
  loadApartment();
}

window.addEventListener('languageChanged', () => {
  if (currentApartment) {
    const currentLang = i18n.currentLang ? i18n.currentLang() : 'en';
    fetch(`/api/apartments/${apartmentId}?lang=${currentLang}`)
      .then(res => res.json())
      .then(apt => {
        currentApartment = apt;
        renderApartment();
      })
      .catch(err => console.error('Reload error:', err));
  } else {
    loadApartment();
  }
});