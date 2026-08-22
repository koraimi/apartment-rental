// Translation manager
const i18n = (function() {
  let currentLang = 'en';
  let translations = {};
  const supportedLangs = ['en', 'fr', 'ar'];

  function detectLanguage() {
    const browserLang = navigator.language.split('-')[0];
    return supportedLangs.includes(browserLang) ? browserLang : 'en';
  }

  async function loadLanguage(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
      translations = await response.json();
      currentLang = lang;
      localStorage.setItem('preferredLang', lang);
      
      if (lang === 'ar') {
        document.documentElement.setAttribute('dir', 'rtl');
        document.body.style.textAlign = 'right';
      } else {
        document.documentElement.setAttribute('dir', 'ltr');
        document.body.style.textAlign = 'left';
      }
      
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
      return true;
    } catch (error) {
      console.error('Translation error:', error);
      return false;
    }
  }

  function t(key, fallback = '') {
    return translations[key] || fallback || key;
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = t(key);
      }
    });
  }

  async function init() {
    const savedLang = localStorage.getItem('preferredLang');
    const langToLoad = savedLang && supportedLangs.includes(savedLang) ? savedLang : detectLanguage();
    await loadLanguage(langToLoad);
    translatePage();
  }

  async function setLanguage(lang) {
    if (!supportedLangs.includes(lang)) return false;
    await loadLanguage(lang);
    translatePage();
    return true;
  }

  return { init, setLanguage, t, currentLang: () => currentLang };
})();

document.addEventListener('DOMContentLoaded', () => i18n.init());