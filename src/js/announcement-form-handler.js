/**
 * announcement-form-handler.js
 * Gestión completa del formulario de creación/edición de anuncios
 */

function setupAnnouncementFormHandler() {
  // Guard pattern: Prevenir carga duplicada
  if (
    window.isScriptLoaded &&
    window.isScriptLoaded('announcement-form-handler')
  ) {
    console.log('announcement-form-handler already loaded, skipping');
    return;
  }

  // Fallback para Logger si no está disponible
  if (typeof Logger === 'undefined') {
    window.Logger = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
    };
  }

  class AnnouncementFormHandler {
    constructor(adminDataManager) {
      this.dataManager = adminDataManager;
      this.form = null;
      this.currentAnnouncementId = null;
      this.mode = 'create'; // 'create' o 'edit'
    }

    /**
     * Inicializa el FormHandler con el formulario especificado
     * @param {string} formId - ID del formulario
     * @returns {boolean} - true si se inicializó correctamente
     */
    initialize(formId) {
      try {
        this.form = document.getElementById(formId);

        if (!this.form) {
          Logger.error(`Form with id "${formId}" not found`);
          return false;
        }

        // Configurar event listeners
        this.setupEventListeners();

        // Configurar validación
        this.setupFormValidation();

        // Configurar manejo de archivos
        this.setupFileUploads();

        Logger.info(
          `AnnouncementFormHandler initialized with form: ${formId}`,
          'INIT'
        );
        return true;
      } catch (error) {
        Logger.error('Error initializing AnnouncementFormHandler:', error);
        return false;
      }
    }

    /**
     * Configura los event listeners del formulario
     */
    setupEventListeners() {
      // Listener para el botón de guardar
      const saveButton = this.form.querySelector(
        '[data-action="handleSaveAnnouncement"]'
      );
      if (saveButton) {
        saveButton.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation(); // Prevenir doble disparo por events.js

          if (typeof window.handleSaveAnnouncement === 'function') {
            window.handleSaveAnnouncement();
          } else {
            this.saveForm();
          }
        });
      }

      // Listener para el botón de preview
      const previewButton = this.form.querySelector(
        '[data-action="previewAnnouncement"]'
      );
      if (previewButton) {
        previewButton.addEventListener('click', e => {
          e.preventDefault();
          this.previewAnnouncement();
        });
      }

      // Listener para el botón de reset
      const resetButton = this.form.querySelector(
        '[data-action="resetAnnouncementForm"]'
      );
      if (resetButton) {
        resetButton.addEventListener('click', e => {
          e.preventDefault();
          this.clearForm();
        });
      }

      // Registrar en EventDelegation para evitar warnings y soportar elementos dinámicos
      if (window.EventDelegation) {
        window.EventDelegation.registerHandler('handleSaveAnnouncement', () => {
          if (typeof window.handleSaveAnnouncement === 'function') {
            window.handleSaveAnnouncement();
          } else {
            this.saveForm();
          }
        });

        window.EventDelegation.registerHandler('resetAnnouncementForm', () => {
          this.clearForm();
        });

        window.EventDelegation.registerHandler('previewAnnouncement', () => {
          this.previewAnnouncement();
        });

        window.EventDelegation.registerHandler('testAnnouncementHTML', () => {
          // Implementación básica si no existe externa
          if (window.testAnnouncementHTML) {
            window.testAnnouncementHTML();
          } else {
            console.log('Test HTML action triggered');
          }
        });
      }
    }

    /**
     * Configura la validación del formulario
     */
    setupFormValidation() {
      // Validación en tiempo real para campos requeridos
      const requiredFields = this.form.querySelectorAll('[required]');

      requiredFields.forEach(field => {
        field.addEventListener('blur', () => {
          this.validateField(field);
        });

        field.addEventListener('input', () => {
          // Limpiar error cuando el usuario empieza a escribir
          this.clearFieldError(field);
        });
      });
    }

    /**
     * Configura el manejo de subida de archivos
     */
    setupFileUploads() {
      // Manejo de imagen
      const imageInput = this.form.querySelector('#announcementImage');
      if (imageInput) {
        imageInput.addEventListener('change', e => {
          this.handleImageUpload(e.target.files[0]);
        });
      }

      // Manejo de video
      const videoInput = this.form.querySelector('#announcementVideo');
      if (videoInput) {
        videoInput.addEventListener('change', e => {
          this.handleVideoUpload(e.target.files[0]);
        });
      }
    }

    /**
     * Valida un campo individual
     * @param {HTMLElement} field - Campo a validar
     * @returns {boolean} - true si es válido
     */
    validateField(field) {
      const value = field.value.trim();
      const fieldName = field.name || field.id;

      // Validar campo requerido
      if (field.hasAttribute('required') && !value) {
        this.showFieldError(field, `${fieldName} es requerido`);
        return false;
      }

      // Validar longitud mínima
      const minLength = field.getAttribute('minlength');
      if (minLength && value.length < parseInt(minLength)) {
        this.showFieldError(field, `Mínimo ${minLength} caracteres`);
        return false;
      }

      // Validar longitud máxima
      const maxLength = field.getAttribute('maxlength');
      if (maxLength && value.length > parseInt(maxLength)) {
        this.showFieldError(field, `Máximo ${maxLength} caracteres`);
        return false;
      }

      // Validar tipo number
      if (field.type === 'number') {
        const numValue = parseFloat(value);
        const min = field.getAttribute('min');
        const max = field.getAttribute('max');

        if (min && numValue < parseFloat(min)) {
          this.showFieldError(field, `Valor mínimo: ${min}`);
          return false;
        }

        if (max && numValue > parseFloat(max)) {
          this.showFieldError(field, `Valor máximo: ${max}`);
          return false;
        }
      }

      this.clearFieldError(field);
      return true;
    }

    /**
     * Muestra un error en un campo
     * @param {HTMLElement} field - Campo con error
     * @param {string} message - Mensaje de error
     */
    showFieldError(field, message) {
      field.classList.add('error');

      // Buscar o crear elemento de error
      let errorElement = field.parentElement.querySelector('.field-error');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        field.parentElement.appendChild(errorElement);
      }

      errorElement.textContent = message;
      if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
        window.DOMUtils.setDisplay(errorElement, 'block');
      } else {
        errorElement.classList.remove('hidden');
      }
    }

    /**
     * Limpia el error de un campo
     * @param {HTMLElement} field - Campo a limpiar
     */
    clearFieldError(field) {
      field.classList.remove('error');

      const errorElement = field.parentElement.querySelector('.field-error');
      if (errorElement) {
        if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
          window.DOMUtils.setDisplay(errorElement, 'none');
        } else {
          errorElement.classList.add('hidden');
        }
      }
    }

    /**
     * Valida todo el formulario
     * @returns {Object} - {valid: boolean, errors: Array}
     */
    async validateForm() {
      const errors = [];
      const requiredFields = this.form.querySelectorAll('[required]');

      requiredFields.forEach(field => {
        if (!this.validateField(field)) {
          errors.push(`${field.name || field.id} es inválido`);
        }
      });

      return {
        valid: errors.length === 0,
        errors: errors,
      };
    }

    /**
     * Obtiene los datos del formulario
     * @returns {Object} - Datos del formulario
     */
    getFormData() {
      const formData = new FormData(this.form);
      const data = {};

      // Convertir FormData a objeto y normalizar claves
      for (const [key, value] of formData.entries()) {
        let cleanValue = value;

        // Aplicar saneamiento básico si es string
        if (typeof cleanValue === 'string' && window.XSSProtection) {
          cleanValue = window.XSSProtection.sanitizeSafe(cleanValue);
        }

        if (key.startsWith('announcement')) {
          const newKey = key.replace('announcement', '');
          const camelKey = newKey.charAt(0).toLowerCase() + newKey.slice(1);

          if (camelKey === 'price') {
            data[camelKey] = parseFloat(cleanValue) || 0;
          } else {
            data[camelKey] = cleanValue;
          }
        } else {
          if (key === 'price') {
            data[key] = parseFloat(cleanValue) || 0;
          } else {
            data[key] = cleanValue;
          }
        }
      }

      // Agregar campos adicionales
      const activeInput = this.form.querySelector('#announcementActive');
      // FIX: Default to true if input is missing to prevent invisible announcements
      data.active = activeInput ? activeInput.checked : true;

      const featuredInput = this.form.querySelector('#announcementFeatured');
      data.featured = featuredInput ? featuredInput.checked : false;

      return data;
    }

    /**
     * Carga un anuncio en el formulario para edición
     * @param {string} id - ID del anuncio
     */
    async loadAnnouncement(id) {
      try {
        Logger.info(`Loading announcement ${id} for editing...`, 'ADMIN');

        const announcement = await this.dataManager.getAnnouncementById(id);

        if (!announcement) {
          throw new Error(`Anuncio con ID ${id} no encontrado`);
        }

        this.populateForm(announcement);
        this.currentAnnouncementId = id;
        this.mode = 'edit';

        Logger.info(`Announcement ${id} loaded for editing`, 'ADMIN');
      } catch (error) {
        Logger.error('Error loading announcement:', error);
        if (window.NotificationSystem) {
          NotificationSystem.error('Error al cargar el anuncio');
        }
      }
    }

    /**
     * Llena el formulario con datos de un anuncio
     * @param {Object} data - Datos del anuncio
     */
    populateForm(data) {
      // Llenar campos de texto
      const fields = [
        'announcementName',
        'announcementPrice',
        'announcementDescription',
        'announcementCategory',
        'announcementImageUrl',
        'announcementYoutubeUrl',
        'announcementStripeId',
        'announcementDownloadUrl',
      ];

      fields.forEach(fieldId => {
        const field = this.form.querySelector(`#${fieldId}`);

        // Get base key (e.g. 'announcementName' -> 'Name')
        const keyBase = fieldId.replace('announcement', '');

        // Calculate potential keys in data
        // 1. camelCase (e.g. 'stripeId', 'imageUrl')
        const camelKey = keyBase.charAt(0).toLowerCase() + keyBase.slice(1);
        // 2. lowercase (e.g. 'name', 'price', 'imageurl')
        const lowerKey = keyBase.toLowerCase();

        let value = undefined;
        if (data[camelKey] !== undefined) value = data[camelKey];
        else if (data[lowerKey] !== undefined) value = data[lowerKey];

        if (field && value !== undefined) {
          field.value = value;
        }
      });

      // Llenar checkboxes
      const activeCheckbox = this.form.querySelector('#announcementActive');
      if (activeCheckbox) {
        activeCheckbox.checked = data.active || false;
      }

      const featuredCheckbox = this.form.querySelector('#announcementFeatured');
      if (featuredCheckbox) {
        featuredCheckbox.checked = data.featured || false;
      }

      // Mostrar preview de imagen si existe
      if (data.imageurl || data.imageUrl) {
        this.showImagePreview(data.imageurl || data.imageUrl);
      }
    }

    /**
     * Maneja la subida de imagen
     * @param {File} file - Archivo de imagen
     */
    async handleImageUpload(file) {
      if (!file) return;

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        if (window.NotificationSystem) {
          NotificationSystem.error(
            'Por favor selecciona un archivo de imagen válido'
          );
        }
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        if (window.NotificationSystem) {
          NotificationSystem.error('La imagen no debe superar 5MB');
        }
        return;
      }

      try {
        // Mostrar indicador de carga
        if (window.NotificationSystem) {
          NotificationSystem.info('Subiendo imagen...');
        }

        // Subir imagen usando AdminDataManager
        const result = await this.dataManager.uploadImage(file);

        if (result && result.url) {
          // Actualizar campo de URL
          const imageUrlField = this.form.querySelector(
            '#announcementImageUrl'
          );
          if (imageUrlField) {
            imageUrlField.value = result.url;
          }

          // Mostrar preview
          this.showImagePreview(result.url);

          if (window.NotificationSystem) {
            NotificationSystem.success('Imagen subida correctamente');
          }
        }
      } catch (error) {
        Logger.error('Error uploading image:', error);
        if (window.NotificationSystem) {
          NotificationSystem.error('Error al subir la imagen');
        }
      }
    }

    /**
     * Muestra preview de imagen
     * @param {string} url - URL de la imagen
     */
    showImagePreview(url) {
      // Buscar o crear contenedor de preview
      let previewContainer = this.form.querySelector(
        '.image-preview-container'
      );
      if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';

        const imageInput = this.form.querySelector('#announcementImage');
        if (imageInput && imageInput.parentElement) {
          imageInput.parentElement.appendChild(previewContainer);
        }
      }

      const previewUrl = window.XSSProtection
        ? window.XSSProtection.sanitizeURL(url)
        : url;

      if (window.XSSProtection) {
        window.XSSProtection.setInnerHTML(
          previewContainer,
          `
                  <img src="${previewUrl}" alt="Preview" class="image-preview" />
                  <button type="button" class="remove-preview" data-action="removeImagePreview">
                    <i data-lucide="x"></i> Eliminar
                  </button>
                `
        );
      } else {
        previewContainer.innerHTML = `
                  <img src="${previewUrl}" alt="Preview" class="image-preview" />
                  <button type="button" class="remove-preview" data-action="removeImagePreview">
                    <i data-lucide="x"></i> Eliminar
                  </button>
                `;
      }

      // Inicializar iconos de Lucide
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    /**
     * Guarda el formulario (crear o actualizar)
     */
    async saveForm() {
      try {
        // Validar formulario
        const validation = await this.validateForm();

        if (!validation.valid) {
          if (window.NotificationSystem) {
            NotificationSystem.warning(
              'Por favor completa todos los campos requeridos'
            );
          }
          return;
        }

        // Obtener datos del formulario
        let data = this.getFormData();

        // Limpiar datos para Firestore
        if (typeof window.cleanDataForFirestore === 'function') {
          data = window.cleanDataForFirestore(data);
        }

        // Mostrar indicador de carga
        if (window.NotificationSystem) {
          NotificationSystem.info('Guardando anuncio...');
        }

        let result;

        // Ensure we use the safe manager
        const safeManager =
          this.dataManager ||
          new (window.SafeAdminDataManager || window.AdminDataManager)();

        if (this.mode === 'edit' && this.currentAnnouncementId) {
          // Actualizar anuncio existente
          console.log(
            '[AnnouncementFormHandler] Updating announcement:',
            this.currentAnnouncementId
          );
          result = await safeManager.updateAnnouncement(
            this.currentAnnouncementId,
            data
          );
        } else {
          // Create new announcement
          console.log('[AnnouncementFormHandler] Creating new announcement');
          result = await safeManager.createAnnouncement(data);
        }

        console.log('[AnnouncementFormHandler] Save result:', result);

        if (result && result.success) {
          if (window.NotificationSystem) {
            const msg =
              this.mode === 'edit'
                ? 'Anuncio actualizado correctamente'
                : 'Anuncio creado correctamente';
            NotificationSystem.success(msg);
          }

          // Limpiar formulario
          this.clearForm();

          // DISABLED: No llamar renderAll() automáticamente para evitar duplicados
          // El sistema de coordinación (AnnouncementLoadingCoordinator) maneja el renderizado
          // a través de listeners en tiempo real de Firestore
          console.log(
            '[AnnouncementFormHandler] Anuncio guardado. El coordinador actualizará la lista automáticamente.'
          );

          // SOLO para panel admin: forzar actualización manual si estamos en la sección de anuncios
          // Re-enabled safely for AdminAnnouncementsRenderer
          const announcementsSection = document.getElementById(
            'announcementsSection'
          );
          if (
            window.adminAnnouncementsRenderer &&
            announcementsSection &&
            announcementsSection.classList.contains('active')
          ) {
            console.log(
              '[AnnouncementFormHandler] Actualizando lista de admin...'
            );
            const triggerRender = () => {
              // Pequeño delay para permitir que Firestore propague cambios
              setTimeout(() => {
                window.adminAnnouncementsRenderer.renderAll();
              }, 1500);
            };

            if (window.AdminLoader && window.AdminLoader.ensureBundle) {
              window.AdminLoader.ensureBundle('announcements', { skipAuthCheck: true })
                .then(triggerRender)
                .catch(triggerRender);
            } else {
              triggerRender();
            }
          }
        } else {
          console.error('[AnnouncementFormHandler] Result failed:', result);
          throw new Error(
            result
              ? result.error || JSON.stringify(result)
              : 'Unknown error from dataManager (result is null/undefined)'
          );
        }
      } catch (error) {
        console.error(
          '[AnnouncementFormHandler] Error saving announcement:',
          error
        );

        // Detailed error logging
        if (error.stack) {
          console.error('[AnnouncementFormHandler] Error stack:', error.stack);
        }

        if (window.NotificationSystem) {
          let errorMsg = 'Error desconocido';
          if (typeof error === 'string') errorMsg = error;
          else if (error && error.message) errorMsg = error.message;

          NotificationSystem.error('Error al guardar: ' + errorMsg);
        }
      }
    }

    /**
     * Muestra preview del anuncio
     */
    previewAnnouncement() {
      const data = this.getFormData();
      const rawName = data.announcementName || 'Sin título';
      const rawDescription = data.announcementDescription || 'Sin descripción';
      const rawCategory = data.announcementCategory || 'Sin categoría';
      const rawImageUrl = data.announcementImageUrl || '';
      const rawVideoUrl = data.announcementYoutubeUrl || '';

      const escapeText = value => {
        if (window.XSSProtection && typeof XSSProtection.escape === 'function') {
          return XSSProtection.escape(String(value));
        }
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const sanitizeUrl = value => {
        if (window.XSSProtection && typeof XSSProtection.sanitizeURL === 'function') {
          return XSSProtection.sanitizeURL(String(value));
        }
        return String(value);
      };

      const sanitizeDescription = value => {
        if (globalThis.DOMPurify && typeof globalThis.DOMPurify.sanitize === 'function') {
          return globalThis.DOMPurify.sanitize(String(value), {
            ALLOWED_TAGS: [
              'strong',
              'em',
              'b',
              'i',
              'u',
              'p',
              'br',
              'ul',
              'ol',
              'li',
              'h3',
              'h4',
              'code',
              'span',
              'div',
              'a',
            ],
            ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
            ALLOW_DATA_ATTR: false,
          });
        }
        if (window.XSSProtection && typeof XSSProtection.sanitizeSafe === 'function') {
          return XSSProtection.sanitizeSafe(String(value));
        }
        return escapeText(value).replace(/\n/g, '<br>');
      };

      const safeName = escapeText(rawName);
      const safeCategory = escapeText(rawCategory);
      const safeDescription = sanitizeDescription(rawDescription);
      const safeImageUrl = sanitizeUrl(rawImageUrl);
      const safeVideoUrl = sanitizeUrl(rawVideoUrl);

      // Crear modal de preview
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'previewAnnouncementModal';

      modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Vista Previa del Anuncio</h3>
          <button class="modal-close" data-action="closeModal" data-params="previewAnnouncementModal">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="announcement-preview">
            ${safeImageUrl ? `<img src="${safeImageUrl}" alt="${safeName}" class="preview-image" />` : ''}
            <h4>${safeName}</h4>
            <p class="preview-price">€${data.announcementPrice || '0.00'}</p>
            <p class="preview-description">${safeDescription}</p>
            <p class="preview-category"><strong>Categoría:</strong> ${safeCategory}</p>
            ${safeVideoUrl ? `<p><strong>Video:</strong> <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">Ver video</a></p>` : ''}
            <p><strong>Estado:</strong> ${data.active ? 'Activo' : 'Inactivo'}</p>
            <p><strong>Destacado:</strong> ${data.featured ? 'Sí' : 'No'}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="admin-btn" data-action="closeModal" data-params="previewAnnouncementModal">
            Cerrar
          </button>
        </div>
      </div>
    `;

      document.body.appendChild(modal);

      // Inicializar iconos de Lucide
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Mostrar modal
      setTimeout(() => {
        modal.classList.add('modal-show');
      }, 10);

      // Agregar listener para cerrar
      modal.addEventListener('click', e => {
        if (
          e.target === modal ||
          e.target.closest('[data-action="closeModal"]')
        ) {
          modal.classList.remove('modal-show');
          setTimeout(() => modal.remove(), 300);
        }
      });
    }

    /**
     * Limpia el formulario
     */
    clearForm() {
      this.form.reset();
      this.currentAnnouncementId = null;
      this.mode = 'create';

      // Limpiar errores
      const errorFields = this.form.querySelectorAll('.error');
      errorFields.forEach(field => this.clearFieldError(field));

      // Limpiar preview de imagen
      const previewContainer = this.form.querySelector(
        '.image-preview-container'
      );
      if (previewContainer) {
        previewContainer.innerHTML = '';
      }

      Logger.info('Form cleared', 'ADMIN');
    }
  }

  // Exponer globalmente
  window.AnnouncementFormHandler = AnnouncementFormHandler;

  // Exponer función global para el botón "Guardar Anuncio"
  window.handleSaveAnnouncement = function () {
    console.log('[Global] handleSaveAnnouncement called');
    if (
      window.announcementFormHandler &&
      typeof window.announcementFormHandler.saveForm === 'function'
    ) {
      window.announcementFormHandler.saveForm();
    } else {
      console.error('[Global] announcementFormHandler not initialized');
      if (window.NotificationSystem) {
        window.NotificationSystem.error(
          'Error: Sistema de formularios no inicializado'
        );
      }
    }
  };

  window.resetAnnouncementForm = function () {
    if (window.announcementFormHandler) {
      window.announcementFormHandler.clearForm();
    }
  };

  window.previewAnnouncement = function () {
    if (window.announcementFormHandler) {
      window.announcementFormHandler.previewAnnouncement();
    }
  };

  if (typeof Logger !== 'undefined') {
    Logger.info('AnnouncementFormHandler loaded', 'INIT');
  }

  // Mark as loaded
  if (window.markScriptLoaded) {
    window.markScriptLoaded('announcement-form-handler');
  }
}

export function initAnnouncementFormHandler() {
  if (window.__ANNOUNCEMENT_FORM_HANDLER_INITED__) {
    return;
  }

  window.__ANNOUNCEMENT_FORM_HANDLER_INITED__ = true;
  setupAnnouncementFormHandler();
}

if (typeof window !== 'undefined' && !window.__ANNOUNCEMENT_FORM_HANDLER_NO_AUTO__) {
  initAnnouncementFormHandler();
}
