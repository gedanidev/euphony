import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import es from './locales/es.json'
import en from './locales/en.json'
import ja from './locales/ja.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      ja: { translation: ja },
    },
    lng: localStorage.getItem('euphony-language') || 'es',
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
