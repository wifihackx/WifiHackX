/**
 * event-delegation.js
 * Adaptador de compatibilidad para usar EventDelegationManager
 * Mantiene la interfaz antigua pero delega en el nuevo sistema robusto.
 */

'use strict';

function setupEventDelegationAdapter() {

  // Si EventDelegationManager ya existe, conectamos con él
  if (window.EventDelegationManager) {
    if (!window.EventDelegation) {
      window.EventDelegation = {
        registerHandler: (action, handler) => {
          window.EventDelegationManager.register(action, handler);
        },
        init: () => {
          console.log(
            '[EventDelegation] Adapter: System already initialized via Manager'
          );
        },
        // Mapear otros métodos si es necesario
        executeAction: (action, element) => {
          // Simular trigger
          const handler = window.EventDelegationManager.handlers.get(action);
          if (handler) handler(null, element);
        },
      };
    } else {
      // Si ya existe (puesto por el manager), aseguramos que tenga init para no romper
      if (!window.EventDelegation.init) {
        window.EventDelegation.init = () => {
          console.log(
            '[EventDelegation] Adapter: System already initialized via Manager'
          );
        };
      }
    }
    console.log('[EventDelegation] Adapter loaded (delegating to Manager)');
    return;
  }

  // Fallback: Si el manager no está, advertir (debería cargarse antes)
  console.warn(
    '[EventDelegation] EventDelegationManager not found. Please load event-delegation-manager.js first.'
  );
}

function initEventDelegationAdapter() {
  if (window.__EVENT_DELEGATION_ADAPTER_INITED__) {
    return;
  }

  window.__EVENT_DELEGATION_ADAPTER_INITED__ = true;
  setupEventDelegationAdapter();
}

if (typeof window !== 'undefined' && !window.__EVENT_DELEGATION_ADAPTER_NO_AUTO__) {
  initEventDelegationAdapter();
}

