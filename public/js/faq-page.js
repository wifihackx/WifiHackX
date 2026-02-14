const baseEnglish = {
  faqTitle: 'Frequently Asked Questions (FAQ)',
  backToMain: '← Back to main page',
  faqQ1: "What happens if I don't use a compatible WiFi adapter?",
  faqA1:
    'If you do not use a compatible WiFi adapter, the tool may have issues such as not detecting networks, failing to start monitor mode, "interface not found" errors, disconnections, or Evil Twin attack not working. It is essential to use adapters with compatible chipsets (Atheros AR9271, Ralink RT3070, MediaTek MT7601, etc.) that support monitor mode and packet injection.',
  faqQ2: 'What is the most recommended chipset to avoid problems?',
  faqA2:
    'For maximum compatibility and to avoid problems, use a WiFi adapter with <b>Ralink RT3070</b> chipset. It is one of the most reliable and recognized in WiFi auditing, widely supported in Wifislax and other security distributions.<br><span class="professional-tip"><b>Professional tip:</b> If you want no hassle, always choose an RT3070 adapter.</span>',
  faqQ3: 'How many adapters do I need for captive portal attack?',
  faqA3:
    'To perform the <b>captive portal</b> attack stably and without errors, you must use <b>two WiFi adapters</b>.<br><span class="professional-tip">💡 <b>Professional tip:</b> To avoid compatibility issues and ensure success, use <b>two adapters with Ralink RT3070 chipset</b>. This way, one can create the fake AP and the other can monitor and capture packets without interference.</span>',
  faqQ4: 'Which WiFi adapters are recommended?',
  faqA4:
    'Some widely compatible models:<br>TP-Link TL-WN722N v1 (Atheros AR9271), Alfa AWUS036NHA (Atheros AR9271), Alfa AWUS036NH (Ralink RT3070), Alfa AWUS036ACH (RTL8812AU), Panda PAU06 (RT5372), Comfast CF-912AC (RTL8812AU), among others.<br><b>Note:</b> Avoid new versions of some models (e.g., TP-Link TL-WN722N v2/v3) as they change the chipset and lose compatibility. Always check the chipset before buying.',
  faqQ5: 'Which operating system is guaranteed to work?',
  faqA5:
    'Cyclone Professional Evil Tewin Attack Anonimous was designed and tested specifically on <b>Wifislax x64 4.0</b>. While it may work on other Linux distributions, full compatibility is only guaranteed on that environment. It is recommended to install it on Wifislax x64 4.0 for 100% functionality, as it is an XZM file, native to Wifislax.',
  faqQ6: 'What should I do if I have problems?',
  faqA6:
    'First, check that your WiFi adapter or its chipset is on the recommended compatible adapters list. If your adapter is on the list and you still have problems, contact our support at <a href="mailto:wifihackx@gmail.com">wifihackx@gmail.com</a> and tell us your adapter model, operating system, and a screenshot of the error.',
  faqQ7: "Why doesn't the Evil Twin attack work properly?",
  faqA7:
    'Usually, this happens due to a WiFi adapter not compatible with AP or monitor mode, poorly installed drivers, or conflicts with other network programs. Always check compatibility and drivers.',
  faqQ8: 'What common errors appear if the adapter is not suitable?',
  faqA8:
    'Some common messages: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found". If you see these errors, check your adapter\'s compatibility and consult the official documentation.'
};

const translations = {
  es: {
    faqTitle: 'Preguntas Frecuentes (FAQ)',
    backToMain: '← Volver a la pagina principal',
    faqQ1: '¿Que ocurre si no uso un adaptador WiFi compatible?',
    faqA1:
      'Si no utilizas un adaptador WiFi compatible, la herramienta puede presentar problemas como: no detectar redes, fallos al iniciar el modo monitor, errores de "interface not found", desconexiones, o que el ataque Evil Twin no funcione correctamente. Es fundamental usar adaptadores con chipsets compatibles (Atheros AR9271, Ralink RT3070, MediaTek MT7601, etc.) que soporten modo monitor e inyeccion de paquetes.',
    faqQ2: '¿Cual es el chipset mas recomendado para evitar problemas?',
    faqA2:
      'Si quieres asegurarte la maxima compatibilidad y evitar problemas, utiliza un adaptador WiFi con chipset <b>Ralink RT3070</b>. Es uno de los mas fiables y reconocidos en el mundo de la auditoria WiFi, ampliamente soportado en Wifislax y otras distribuciones de seguridad.<br><span class="professional-tip"><b>Recomendacion profesional:</b> Si no quieres complicaciones, elige siempre un adaptador con RT3070.</span>',
    faqQ3: '¿Cuantos adaptadores necesito para el ataque portal cautivo?',
    faqA3:
      'Para realizar el ataque de <b>portal cautivo</b> de forma estable y sin errores, es imprescindible utilizar <b>dos adaptadores WiFi</b>.<br><span class="professional-tip">💡 <b>Recomendacion profesional:</b> Para evitar problemas de compatibilidad y asegurar el exito del ataque, utiliza <b>dos adaptadores con chipset Ralink RT3070</b>. Asi garantizas que uno pueda crear el punto de acceso falso y el otro monitorizar y capturar paquetes sin interferencias.</span>',
    faqQ4: '¿Cuales son los adaptadores WiFi compatibles recomendados?',
    faqA4:
      'Algunos modelos ampliamente compatibles:<br>TP-Link TL-WN722N v1 (Atheros AR9271), Alfa AWUS036NHA (Atheros AR9271), Alfa AWUS036NH (Ralink RT3070), Alfa AWUS036ACH (RTL8812AU), Panda PAU06 (RT5372), Comfast CF-912AC (RTL8812AU), entre otros.<br><b>Nota:</b> Evita versiones nuevas de algunos modelos (por ejemplo, TP-Link TL-WN722N v2/v3) ya que cambian el chipset y pierden compatibilidad. Siempre verifica el chipset antes de comprar.',
    faqQ5: '¿En que sistema operativo se garantiza el funcionamiento?',
    faqA5:
      'Cyclone Professional Evil Tewin Attack Anonimous ha sido disenado y probado especificamente en <b>Wifislax x64 4.0</b>. Aunque puede funcionar en otras distribuciones Linux, solo se garantiza compatibilidad total en ese entorno. Se recomienda instalarlo en Wifislax x64 4.0 para asegurar funcionamiento al 100%, ya que es un archivo XZM, formato nativo de Wifislax.',
    faqQ6: '¿Que debo hacer si tengo problemas?',
    faqA6:
      'Primero, verifica que tu adaptador WiFi o el chipset que utiliza se encuentre en la lista de adaptadores compatibles recomendados. Si tu adaptador esta en la lista y sigues teniendo problemas, contacta con nuestro soporte en <a href="mailto:wifihackx@gmail.com">wifihackx@gmail.com</a> e indicanos el modelo de tu adaptador, sistema operativo y una captura del error.',
    faqQ7: '¿Por que el ataque Evil Twin no funciona correctamente?',
    faqA7:
      'Generalmente, esto ocurre por adaptador WiFi no compatible con modo AP o monitor, controladores mal instalados o conflictos con otros programas de red. Revisa siempre la compatibilidad y los drivers.',
    faqQ8: '¿Que errores comunes aparecen si el adaptador no es adecuado?',
    faqA8:
      'Algunos mensajes frecuentes: "No se detecto ninguna interfaz compatible", "Monitor mode not supported", "Injection test failed", "Device busy or not found". Si ves estos errores, revisa la compatibilidad de tu adaptador y consulta la documentacion oficial.'
  },
  en: baseEnglish,
  fr: { ...baseEnglish, faqTitle: 'Questions Frequentes (FAQ)', backToMain: '← Retour a la page principale' },
  it: { ...baseEnglish, faqTitle: 'Domande Frequenti (FAQ)', backToMain: '← Torna alla pagina principale' },
  de: { ...baseEnglish, faqTitle: 'Haufig gestellte Fragen (FAQ)', backToMain: '← Zuruck zur Hauptseite' },
  pt: { ...baseEnglish, faqTitle: 'Perguntas Frequentes (FAQ)', backToMain: '← Voltar para a pagina principal' },
  ru: { ...baseEnglish, faqTitle: 'FAQ - WifiHackX', backToMain: '← Vernutsya na glavnuyu' },
  zh: { ...baseEnglish, faqTitle: 'Chang jian wen ti (FAQ)', backToMain: '← Fan hui shou ye' },
  ja: { ...baseEnglish, faqTitle: 'Yoku aru shitsumon (FAQ)', backToMain: '← Toppu peji ni modoru' },
  ko: { ...baseEnglish, faqTitle: 'Jaju mukneun jilmun (FAQ)', backToMain: '← Meonchi peiji ro dolagalgi' }
};

const seoData = {
  es: {
    title: 'Preguntas Frecuentes (FAQ) - WifiHackX',
    description:
      'Resuelve tus dudas sobre compatibilidad, adaptadores y funcionamiento de WifiHackX. FAQ profesional multilingue.',
    ogLocale: 'es_ES'
  },
  en: {
    title: 'Frequently Asked Questions (FAQ) - WifiHackX',
    description:
      'Resolve your doubts about compatibility, adapters and operation of WifiHackX. Professional multilingual FAQ.',
    ogLocale: 'en_US'
  },
  de: {
    title: 'Haufig gestellte Fragen (FAQ) - WifiHackX',
    description:
      'Lose deine Zweifel uber Kompatibilitat, Adapter und Funktionsweise von WifiHackX. Professionelle mehrsprachige FAQ.',
    ogLocale: 'de_DE'
  },
  fr: {
    title: 'Questions Frequentes (FAQ) - WifiHackX',
    description:
      'Resolvez vos doutes sur la compatibilite, les adaptateurs et le fonctionnement de WifiHackX. FAQ professionnelle multilingue.',
    ogLocale: 'fr_FR'
  },
  it: {
    title: 'Domande Frequenti (FAQ) - WifiHackX',
    description:
      'Rispondi ai tuoi dubbi su compatibilita, adattatori e funzionamento di WifiHackX. FAQ professionale multilingue.',
    ogLocale: 'it_IT'
  },
  pt: {
    title: 'Perguntas Frequentes (FAQ) - WifiHackX',
    description:
      'Esclareca suas duvidas sobre compatibilidade, adaptadores e funcionamento do WifiHackX. FAQ profissional multilingue.',
    ogLocale: 'pt_PT'
  },
  ru: {
    title: 'FAQ - WifiHackX',
    description: 'Otvechaem na voprosy o sovmestimosti, adapterakh i rabote WifiHackX.',
    ogLocale: 'ru_RU'
  },
  zh: {
    title: '常见问题 (FAQ) - WifiHackX',
    description: '解答关于兼容性、适配器与 WifiHackX 运行方式的疑问。',
    ogLocale: 'zh_CN'
  },
  ja: {
    title: 'FAQ - WifiHackX',
    description: '互換性、アダプター、WifiHackX の動作に関する質問に回答します。',
    ogLocale: 'ja_JP'
  },
  ko: {
    title: '자주 묻는 질문 (FAQ) - WifiHackX',
    description: '호환성, 어댑터, WifiHackX 동작에 대한 질문을 해결합니다。',
    ogLocale: 'ko_KR'
  }
};

const storageKeys = ['selectedLanguage', 'wifiHackXLanguage', 'preferredLanguage'];
const appStateStorageKey = 'wifiHackX_state_i18n.currentLanguage';

const getStoredLanguage = () => {
  for (const key of storageKeys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return 'es';
};

const setStoredLanguage = lang => {
  storageKeys.forEach(key => localStorage.setItem(key, lang));
  localStorage.setItem(appStateStorageKey, JSON.stringify(lang));
};

let currentLang = getStoredLanguage();

const updateAbsoluteSeoUrls = () => {
  const fallbackOrigin = 'https://white-caster-466401-g0.web.app';
  const isLocalDev =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const origin = isLocalDev ? fallbackOrigin : window.location.origin;

  const canonicalLink = document.getElementById('canonical-link');
  if (canonicalLink) {
    canonicalLink.setAttribute('href', `${origin}/faq.html`);
  }

  const orgJsonLdScript = document.getElementById('org-jsonld');
  if (orgJsonLdScript?.textContent) {
    try {
      const orgData = JSON.parse(orgJsonLdScript.textContent);
      orgData.url = `${origin}/`;
      orgJsonLdScript.textContent = JSON.stringify(orgData, null, 2);
    } catch (_e) {
      // Ignore malformed JSON-LD and keep static fallback.
    }
  }
};

const updateSEO = lang => {
  const data = seoData[lang] || seoData.es;
  document.getElementById('dynamic-title').textContent = data.title;
  document.getElementById('meta-description').setAttribute('content', data.description);
  document.getElementById('og-title').setAttribute('content', data.title);
  document.getElementById('og-description').setAttribute('content', data.description);
  document.getElementById('og-locale').setAttribute('content', data.ogLocale);
};

const updateFAQJSONLD = lang => {
  const items = translations[lang] || translations.es;
  const qKeys = Object.keys(items).filter(key => key.startsWith('faqQ'));
  const aKeys = Object.keys(items).filter(key => key.startsWith('faqA'));
  if (!qKeys.length || !aKeys.length) return;

  const stripHtml = value => value.replace(/<[^>]*>/g, '');

  const faqs = qKeys.map((qk, index) => ({
    '@type': 'Question',
    name: stripHtml(items[qk] || ''),
    acceptedAnswer: {
      '@type': 'Answer',
      text: stripHtml(items[aKeys[index]] || '')
    }
  }));

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
  };

  document.getElementById('faq-jsonld').textContent = JSON.stringify(jsonld, null, 2);
};

const setLanguage = lang => {
  if (!translations[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  setStoredLanguage(lang);

  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.dataset.translate;
    const translation = translations[currentLang]?.[key] || translations.es[key];
    if (translation) {
      el.innerHTML = translation;
    }
  });

  document.querySelectorAll('#headerLangSelect .lang-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.lang === lang);
  });

  updateSEO(lang);
  updateFAQJSONLD(lang);
};

const syncLanguageFromStorage = reason => {
  const storedLang = getStoredLanguage();
  if (storedLang && storedLang !== currentLang) {
    setLanguage(storedLang);
  } else if (!currentLang && storedLang) {
    setLanguage(storedLang);
  }
};

const initLanguageSelector = () => {
  const container = document.getElementById('headerLangSelect');
  if (!container) return;

  container.querySelectorAll('.lang-chip').forEach(chip => {
    chip.addEventListener('click', () => setLanguage(chip.dataset.lang));
  });

  window.addEventListener('storage', event => {
    if (storageKeys.includes(event.key)) {
      setLanguage(event.newValue || 'es');
    }
  });
};

const initAccordion = () => {
  const faqItems = document.querySelectorAll('.faq-item');

  const openItem = (item, wrapper) => {
    const naturalHeight = wrapper.scrollHeight;
    wrapper.style.maxHeight = `${naturalHeight}px`;
    const onTransitionEnd = () => {
      if (item.classList.contains('active')) {
        wrapper.style.maxHeight = 'none';
      }
      wrapper.removeEventListener('transitionend', onTransitionEnd);
    };
    wrapper.addEventListener('transitionend', onTransitionEnd);
  };

  const closeItem = wrapper => {
    if (wrapper.style.maxHeight === 'none') {
      wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
      requestAnimationFrame(() => {
        wrapper.style.maxHeight = '0px';
      });
      return;
    }
    wrapper.style.maxHeight = '0px';
  };

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answerWrapper = item.querySelector('.faq-answer-wrapper');

    question.addEventListener('click', () => {
      const isExpanded = question.getAttribute('aria-expanded') === 'true';
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          closeItem(otherItem.querySelector('.faq-answer-wrapper'));
        }
      });

      item.classList.toggle('active');
      question.setAttribute('aria-expanded', (!isExpanded).toString());
      if (!isExpanded) {
        openItem(item, answerWrapper);
      } else {
        closeItem(answerWrapper);
      }
    });
  });

  window.addEventListener('resize', () => {
    faqItems.forEach(item => {
      if (item.classList.contains('active')) {
        const wrapper = item.querySelector('.faq-answer-wrapper');
        if (wrapper.style.maxHeight === 'none') {
          wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
          requestAnimationFrame(() => {
            if (item.classList.contains('active')) {
              wrapper.style.maxHeight = 'none';
            }
          });
          return;
        }
        wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
      }
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  updateAbsoluteSeoUrls();
  initAccordion();
  initLanguageSelector();
  setLanguage(currentLang);

  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      syncLanguageFromStorage('pageshow');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncLanguageFromStorage('visibilitychange');
    }
  });
});
