// Apartment listing - with working filters and language switching

let currentType = 'all';

async function loadFilters() {
  try {
    const [neighborhoods, features] = await Promise.all([
      fetch('/api/neighborhoods').then(r => r.json()),
      fetch('/api/features').then(r => r.json())
    ]);
    
    const neighborhoodSelect = document.getElementById('neighborhoodFilter');
    if (neighborhoodSelect) {
      while (neighborhoodSelect.options.length > 1) {
        neighborhoodSelect.remove(1);
      }
      neighborhoods.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        neighborhoodSelect.appendChild(opt);
      });
    }
    
    const featuresDiv = document.getElementById('featuresFilter');
    if (featuresDiv) {
      featuresDiv.innerHTML = '';
      features.forEach(f => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `feature_${f.name.replace(/\s/g, '_')}`;
        checkbox.value = f.name;
        checkbox.className = 'feature-checkbox';
        checkbox.style.display = 'none';
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.className = 'feature-label';
        label.textContent = f.name;
        
        label.addEventListener('click', () => {
          checkbox.checked = !checkbox.checked;
          label.classList.toggle('selected', checkbox.checked);
        });
        
        featuresDiv.appendChild(checkbox);
        featuresDiv.appendChild(label);
      });
    }
    
  } catch (error) {
    console.error('Error loading filters:', error);
  }
}

async function loadApartments() {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.classList.remove('hidden');
  
  const neighborhood = document.getElementById('neighborhoodFilter')?.value || '';
  const selectedFeatures = Array.from(document.querySelectorAll('.feature-checkbox:checked')).map(cb => cb.value);
  const priceRange = document.getElementById('priceFilter')?.value || '';
  
  let url = '/api/apartments?';
  if (neighborhood) url += `neighborhood=${encodeURIComponent(neighborhood)}&`;
  if (priceRange) url += `monthly_rent=${encodeURIComponent(priceRange)}&`;
  if (selectedFeatures.length) {
    selectedFeatures.forEach(f => {
      url += `feature=${encodeURIComponent(f)}&`;
    });
  }
  
  const container = document.getElementById('apartmentsList');
  container.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  
  try {
    const response = await fetch(url);
    const apartments = await response.json();
    
    const resultDiv = document.getElementById('resultCount');
    if (resultDiv) {
      resultDiv.innerHTML = `<i class="fas fa-building"></i> ${apartments.length} properties found`;
    }
    
    if (!apartments.length) {
      container.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><h3>No properties found</h3><p>Try different filters or <a href="#" onclick="resetFilters(); return false;">clear all</a></p></div>`;
      if (spinner) spinner.classList.add('hidden');
      return;
    }
    
    container.innerHTML = apartments.map(a => `
      <div class="apartment-card ${a.is_featured ? 'featured' : ''}">
        <div class="apartment-image">
          ${a.is_featured ? '<div class="featured-badge"><i class="fas fa-star"></i> ' + i18n.t('featured', 'Featured') + '</div>' : ''}
          <img src="${a.main_photo || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400'}" alt="${escapeHtml(a.name)}" loading="lazy">
        </div>
        <div class="apartment-info">
          <h3>${escapeHtml(a.name)}</h3>
          <p class="location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(a.neighborhood)}</p>
          <p class="rent"><i class="fas fa-dollar-sign"></i> ${escapeHtml(a.monthly_rent)} / month</p>
          <div class="contact-buttons">
            ${a.listing_type === 'rental' && a.landlord_whatsapp ? 
              `<a href="https://wa.me/${a.landlord_whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn-primary-action"><i class="fab fa-whatsapp"></i> ${i18n.t('contact_landlord', 'Contact Landlord')}</a>` : 
              `<a href="${a.external_booking_url || '#'}" target="_blank" class="btn-primary-action"><i class="fas fa-calendar-check"></i> ${i18n.t('check_availability', 'Check Availability')}</a>`
            }
          </div>
          <a href="/apartment.html?id=${a.id}" class="btn-details">${i18n.t('details', 'View Details')} →</a>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading apartments:', error);
    container.innerHTML = '<div class="error-message">Error loading properties. Please try again.</div>';
  }
  
  if (spinner) spinner.classList.add('hidden');
}

function resetFilters() {
  const neighborhoodSelect = document.getElementById('neighborhoodFilter');
  if (neighborhoodSelect) neighborhoodSelect.value = '';
  
  const priceFilter = document.getElementById('priceFilter');
  if (priceFilter) priceFilter.value = '';
  
  document.querySelectorAll('.feature-checkbox').forEach(cb => {
    cb.checked = false;
    const label = document.querySelector(`label[for="${cb.id}"]`);
    if (label) label.classList.remove('selected');
  });
  
  loadApartments();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', loadApartments);
  }
  loadFilters();
  loadApartments();
});

// Reload when language changes
window.addEventListener('languageChanged', () => {
  loadApartments();
  loadFilters();
});

window.resetFilters = resetFilters;