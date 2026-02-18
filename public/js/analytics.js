/**
 * GTM Event Tracking Helpers
 */
'use strict';

function trackEvent(eventName, eventCategory, eventLabel, eventValue) {
  if (typeof window.dataLayer === 'undefined') return;
  window.dataLayer.push({
    event: eventName,
    eventCategory,
    eventLabel,
    eventValue,
  });
}

function trackPageView(pagePath, pageTitle) {
  if (typeof window.dataLayer === 'undefined') return;
  window.dataLayer.push({
    event: 'pageview',
    page: {
      path: pagePath,
      title: pageTitle,
    },
  });
}

function trackEcommerce(action, products, transactionId, revenue) {
  if (typeof window.dataLayer === 'undefined') return;
  window.dataLayer.push({
    event: 'ecommerce',
    ecommerce: {
      [action]: {
        actionField: {
          id: transactionId,
          revenue,
        },
        products,
      },
    },
  });
}

if (typeof window !== 'undefined') {
  const previous = window.Analytics || {};
  window.Analytics = {
    ...previous,
    trackEvent,
    trackPageView,
    trackEcommerce,
  };
}

