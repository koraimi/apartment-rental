// Get token from localStorage
let token = localStorage.getItem('adminToken');

async function apiCall(method, url, body = null) {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    console.error('No token found');
    return null;
  }
  
  const opts = {
    method,
    headers: { 
      'Authorization': `Bearer ${token}`, 
      'Content-Type': 'application/json' 
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(url, opts);
    if (res.status === 401 || res.status === 403) {
      alert('Session expired. Please login again.');
      window.location.href = '/admin/login.html';
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('API call error:', err);
    return null;
  }
}

// ============ LOGIN PAGE ============
if (window.location.pathname.includes('login.html')) {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.token) {
          localStorage.setItem('adminToken', data.token);
          window.location.href = '/admin/dashboard.html';
        } else {
          document.getElementById('error').innerText = data.error || 'Invalid credentials';
        }
      } catch (err) {
        document.getElementById('error').innerText = 'Connection error';
      }
    });
  }
}

// ============ DASHBOARD PAGE ============
if (window.location.pathname.includes('dashboard.html')) {
  // Check if logged in
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/admin/login.html';
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login.html';
    });
  }
  
  // Add property button
  const addBtn = document.getElementById('addApartmentBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      window.location.href = '/admin/apartment-form.html';
    });
  }
  
  // Load all data
  loadStats();
  loadPropertiesTable();
  loadInquiriesTable();
  
  async function loadStats() {
    const stats = await apiCall('GET', '/admin/stats');
    if (stats) {
      document.getElementById('totalCount').innerText = stats.total_apartments || 0;
      document.getElementById('rentalCount').innerText = stats.rental_listings || 0;
      document.getElementById('affiliateCount').innerText = stats.affiliate_listings || 0;
      document.getElementById('featuredCount').innerText = stats.featured_listings || 0;
      document.getElementById('inquiryCount').innerText = stats.unread_inquiries || 0;
    }
  }
  
  async function loadPropertiesTable() {
    const properties = await apiCall('GET', '/admin/apartments');
    const container = document.getElementById('propertiesTable');
    
    if (!properties || !properties.length) {
      container.innerHTML = '<div class="text-center py-10">No properties found. Click "Add New Property" to create one.</div>';
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr><th>ID</th><th>Name</th><th>Neighborhood</th><th>Rent</th><th>Type</th><th>Featured</th><th>Actions</th></tr>
        </thead>
        <tbody>
    `;
    
    for (const p of properties) {
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.neighborhood)}</td>
          <td>${escapeHtml(p.monthly_rent)}</td>
          <td>${p.listing_type === 'rental' ? '🏡 Rental' : '⭐ Affiliate'}</td>
          <td>
            <button onclick="window.toggleFeatured(${p.id}, ${p.is_featured || false})" 
              class="${p.is_featured ? 'bg-yellow-500' : 'bg-gray-400'} text-white px-2 py-1 rounded text-sm">
              ${p.is_featured ? '⭐ Featured' : '☆ Make Featured'}
            </button>
          </td>
          <td>
            <button onclick="window.editProperty(${p.id})" class="bg-blue-500 text-white px-2 py-1 rounded">Edit</button>
            <button onclick="window.deleteProperty(${p.id})" class="bg-red-500 text-white px-2 py-1 rounded ml-2">Delete</button>
          </td>
        </tr>
      `;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  async function loadInquiriesTable() {
    const inquiries = await apiCall('GET', '/admin/inquiries');
    const container = document.getElementById('inquiriesTable');
    
    if (!inquiries || !inquiries.length) {
      container.innerHTML = '<div class="text-center py-10">No inquiries yet.</div>';
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr><th>Property</th><th>Name</th><th>Email</th><th>Message</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
    `;
    
    for (const i of inquiries) {
      html += `
        <tr>
          <td>${escapeHtml(i.apartment_name)}</td>
          <td>${escapeHtml(i.name)}</td>
          <td>${escapeHtml(i.email)}</td>
          <td>${escapeHtml(i.message.substring(0, 80))}${i.message.length > 80 ? '...' : ''}</td>
          <td>${i.is_read ? '✅ Read' : '⏳ New'}</td>
          <td>
            <button onclick="window.markInquiryRead(${i.id})" class="bg-green-500 text-white px-2 py-1 rounded">Mark Read</button>
          </td>
        </tr>
      `;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  // Make functions global for onclick
  window.toggleFeatured = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    if (confirm(`Mark this property as ${newStatus ? 'featured' : 'regular'}?`)) {
      await apiCall('PATCH', `/admin/apartments/${id}/featured`, { is_featured: newStatus });
      loadPropertiesTable();
      loadStats();
    }
  };
  
  window.markInquiryRead = async (id) => {
    await apiCall('PUT', `/admin/inquiries/${id}/read`);
    loadInquiriesTable();
    loadStats();
  };
  
  window.editProperty = (id) => {
    window.location.href = `/admin/apartment-form.html?id=${id}`;
  };
  
  window.deleteProperty = async (id) => {
    if (confirm('Delete this property? All photos and inquiries will be lost.')) {
      await apiCall('DELETE', `/admin/apartments/${id}`);
      loadPropertiesTable();
      loadStats();
    }
  };
}

// ============ APARTMENT FORM PAGE ============
if (window.location.pathname.includes('apartment-form.html')) {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/admin/login.html';
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const editingId = urlParams.get('id');
  let allFeatures = [];
  
  async function init() {
    // Load features
    const featuresRes = await fetch('/api/features');
    allFeatures = await featuresRes.json();
    
    const checkboxesDiv = document.getElementById('featuresCheckboxes');
    if (checkboxesDiv) {
      checkboxesDiv.innerHTML = allFeatures.map(f => `
        <label style="margin-right: 10px;">
          <input type="checkbox" value="${f.name}" class="feature-cb"> ${f.name}
        </label>
      `).join('');
    }
    
    if (editingId) {
      document.getElementById('formTitle').innerText = 'Edit Property';
      const property = await apiCall('GET', `/api/apartments/${editingId}`);
      if (property) {
        document.getElementById('apartmentId').value = property.id;
        document.getElementById('name').value = property.name;
        document.getElementById('neighborhood').value = property.neighborhood;
        document.getElementById('address').value = property.address || '';
        document.getElementById('phone').value = property.phone || '';
        document.getElementById('whatsapp').value = property.whatsapp || '';
        document.getElementById('email').value = property.email || '';
        document.getElementById('monthly_rent').value = property.monthly_rent;
        document.getElementById('listing_type').value = property.listing_type || 'rental';
        document.getElementById('external_booking_url').value = property.external_booking_url || '';
        document.getElementById('landlord_whatsapp').value = property.landlord_whatsapp || '';
        document.getElementById('landlord_email').value = property.landlord_email || '';
        document.getElementById('description').value = property.description || '';
        document.getElementById('description_fr').value = property.description_fr || '';
        document.getElementById('description_ar').value = property.description_ar || '';
        document.getElementById('latitude').value = property.latitude || '';
        document.getElementById('longitude').value = property.longitude || '';
        
        document.querySelectorAll('.feature-cb').forEach(cb => {
          if (property.features && property.features.includes(cb.value)) cb.checked = true;
        });
        
        // Show existing photos
        const existingDiv = document.getElementById('existingPhotos');
        if (existingDiv && property.photos) {
          existingDiv.innerHTML = '<div class="mt-2 font-bold">Existing Photos:</div>';
          property.photos.forEach(p => {
            existingDiv.innerHTML += `
              <div class="flex items-center gap-2 mt-1" id="photo-row-${p.id}">
                <img src="${p.photo_url}" class="w-16 h-16 object-cover rounded">
                <button type="button" class="delete-photo text-red-500" data-id="${p.id}">❌ Delete</button>
              </div>
            `;
          });
          
          document.querySelectorAll('.delete-photo').forEach(btn => {
            btn.addEventListener('click', async () => {
              const photoId = btn.dataset.id;
              if (confirm('Delete this photo?')) {
                await apiCall('DELETE', `/admin/photos/${photoId}`);
                btn.closest('[id^="photo-row"]').remove();
              }
            });
          });
        }
      }
    }
    
    // Toggle rental/affiliate fields
    const listingType = document.getElementById('listing_type');
    const rentalDiv = document.getElementById('rentalFields');
    const affiliateDiv = document.getElementById('affiliateFields');
    
    function toggleFields() {
      if (listingType.value === 'rental') {
        if (rentalDiv) rentalDiv.style.display = 'block';
        if (affiliateDiv) affiliateDiv.style.display = 'none';
      } else {
        if (rentalDiv) rentalDiv.style.display = 'none';
        if (affiliateDiv) affiliateDiv.style.display = 'block';
      }
    }
    
    if (listingType) {
      listingType.addEventListener('change', toggleFields);
      toggleFields();
    }
  }
  
  // Form submission
  const form = document.getElementById('propertyForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const propertyData = {
        name: document.getElementById('name').value,
        neighborhood: document.getElementById('neighborhood').value,
        address: document.getElementById('address').value,
        phone: document.getElementById('phone').value,
        whatsapp: document.getElementById('whatsapp').value,
        email: document.getElementById('email').value,
        monthly_rent: document.getElementById('monthly_rent').value,
        listing_type: document.getElementById('listing_type').value,
        external_booking_url: document.getElementById('external_booking_url').value,
        landlord_whatsapp: document.getElementById('landlord_whatsapp').value,
        landlord_email: document.getElementById('landlord_email').value,
        description: document.getElementById('description').value,
        description_fr: document.getElementById('description_fr').value,
        description_ar: document.getElementById('description_ar').value,
        latitude: parseFloat(document.getElementById('latitude').value) || null,
        longitude: parseFloat(document.getElementById('longitude').value) || null,
        features: Array.from(document.querySelectorAll('.feature-cb:checked')).map(cb => cb.value)
      };
      
      let url = '/admin/apartments';
      let method = 'POST';
      if (editingId) {
        url = `/admin/apartments/${editingId}`;
        method = 'PUT';
      }
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(propertyData)
        });
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to save');
        }
        
        const result = await res.json();
        const newId = editingId || result.id;
        
        // Upload photos
        const files = document.getElementById('photoUpload').files;
        if (files.length > 0) {
          for (const file of files) {
            const formData = new FormData();
            formData.append('photo', file);
            await fetch(`/admin/apartments/${newId}/photos`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });
          }
        }
        
        alert('Property saved successfully!');
        window.location.href = '/admin/dashboard.html';
      } catch (err) {
        alert('Error: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Property';
      }
    });
  }
  
  init();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}