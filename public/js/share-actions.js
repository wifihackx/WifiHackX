(function () {
  const sheet = createShareSheet();

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action="share"]');
    if (!target) return;
    event.preventDefault();

    const title = target.dataset.shareTitle || document.title;
    const text = target.dataset.shareText || '';
    const url = target.dataset.shareUrl || window.location.href;

    sheet.open({ title, text, url });
  });

  function createShareSheet() {
    const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
    const overlay = document.createElement('dialog');
    overlay.className = 'share-sheet-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="share-sheet" aria-label="Compartir">
        <div class="share-sheet-header">
          <div>
            <p class="share-sheet-title">Compartir</p>
            <p class="share-sheet-subtitle" data-share-subtitle>Elige una opción</p>
          </div>
          <button class="share-sheet-close" type="button" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18"></path>
              <path d="M6 6 18 18"></path>
            </svg>
          </button>
        </div>
        <div class="share-sheet-grid">
          ${canNativeShare ? getShareButton('native', 'Compartir') : ''}
          ${getShareButton('whatsapp', 'WhatsApp')}
          ${getShareButton('instagram', 'Instagram')}
          ${getShareButton('telegram', 'Telegram')}
          ${getShareButton('x', 'X')}
          ${getShareButton('facebook', 'Facebook')}
          ${getShareButton('linkedin', 'LinkedIn')}
          ${getShareButton('tiktok', 'TikTok')}
          ${getShareButton('email', 'Email')}
          ${getShareButton('copy', 'Copiar')}
        </div>
        <div class="share-sheet-toast" aria-live="polite" role="status"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('active');
      if (typeof overlay.close === 'function' && overlay.open) {
        overlay.close();
      }
      overlay.setAttribute('aria-hidden', 'true');
    };

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        close();
      }
    });

    overlay.querySelector('.share-sheet-close').addEventListener('click', close);

    const toast = overlay.querySelector('.share-sheet-toast');

    overlay.querySelectorAll('.share-sheet-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const channel = btn.dataset.channel;
        const { title, text, url } = overlay.dataset;

        if (channel === 'native' && navigator.share) {
          try {
            await navigator.share({ title, text, url });
          } catch (_e) {
            alert('No se pudo compartir');
          }
          return;
        }

        if (channel === 'copy') {
          const copied = await copyToClipboard(url);
          if (copied) {
            btn.querySelector('span').textContent = 'Copiado';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'Copiar';
            }, 1600);
            showToast(toast, 'Enlace copiado');
          }
          return;
        }

        if (channel === 'instagram') {
          const copied = await copyToClipboard(url);
          if (copied) {
            btn.querySelector('span').textContent = 'Copiado';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'Instagram';
            }, 1600);
            showToast(toast, 'Enlace copiado para Instagram');
          }
          window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
          return;
        }

        if (channel === 'tiktok') {
          const copied = await copyToClipboard(url);
          if (copied) {
            btn.querySelector('span').textContent = 'Copiado';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'TikTok';
            }, 1600);
            showToast(toast, 'Enlace copiado para TikTok');
          }
          window.open('https://www.tiktok.com/', '_blank', 'noopener,noreferrer');
          return;
        }

        const shareUrl = buildShareUrl(channel, { title, text, url });
        if (shareUrl) {
          window.open(shareUrl, '_blank', 'noopener,noreferrer');
        }
      });
    });

    return {
      open({ title, text, url }) {
        overlay.dataset.title = title;
        overlay.dataset.text = text;
        overlay.dataset.url = url;
        overlay.querySelector('[data-share-subtitle]').textContent = text || title;
        overlay.classList.add('active');
        if (typeof overlay.showModal === 'function' && !overlay.open) {
          overlay.showModal();
        }
        overlay.setAttribute('aria-hidden', 'false');
        showToast(toast, '');
      },
      close,
    };
  }

  function getShareButton(channel, label) {
    return `
      <button class="share-sheet-btn" type="button" data-channel="${channel}">
        ${getShareIcon(channel)}
        <span>${label}</span>
      </button>
    `;
  }

  function getShareIcon(channel) {
    switch (channel) {
      case 'native':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-6.34 3.17a3 3 0 1 0 0 5.66l6.34 3.17A3 3 0 1 0 16 14a3 3 0 0 0-.17 1l-6.34-3.17a3 3 0 0 0 0-1.66L15.83 7A3 3 0 0 0 18 8Z"/></svg>';
      case 'whatsapp':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.49A11.86 11.86 0 0 0 12.02 0 11.9 11.9 0 0 0 .1 11.89a11.82 11.82 0 0 0 1.64 6.03L0 24l6.32-1.66a11.9 11.9 0 0 0 5.7 1.45h.01A11.9 11.9 0 0 0 24 11.9a11.86 11.86 0 0 0-3.48-8.41Zm-8.5 18.4h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.65-.23-.38a9.88 9.88 0 1 1 8.38 4.64Zm5.45-7.46c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.47.13-.62.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.94-2.24-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35Z"/></svg>';
      case 'telegram':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 2.2a1.6 1.6 0 0 0-1.64-.27L2.4 9.4a1.6 1.6 0 0 0 .1 3.03l4.7 1.6 1.8 5.3a1.6 1.6 0 0 0 2.63.65l2.8-2.6 4.55 3.35a1.6 1.6 0 0 0 2.5-.95l2.5-15.4a1.6 1.6 0 0 0-.72-1.78ZM9.6 13.7l7.92-7.3-6.2 8.1-.23 3.16-1.05-3.1-3.4-1.12 8.1-3.22Z"/></svg>';
      case 'instagram':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm10 2H7a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-5 3.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5ZM17.6 7.3a.9.9 0 1 1-.9-.9.9.9 0 0 1 .9.9Z"/></svg>';
      case 'linkedin':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h3.96v12H3V9Zm7.5 0H14v1.64h.06c.48-.9 1.64-1.85 3.38-1.85 3.62 0 4.29 2.38 4.29 5.48V21H17.8v-5.35c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.82V21h-3.96V9Z"/></svg>';
      case 'tiktok':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 2c.4 2.1 1.8 3.5 4.1 3.7v3.2c-1.5.1-2.8-.3-4.1-1v6.4a6.3 6.3 0 1 1-6.3-6.3c.3 0 .6 0 .9.1v3.3a3 3 0 1 0 2.2 2.9V2h3.2Z"/></svg>';
      case 'x':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2h2.8l-6.1 7 7.2 13h-5.7l-4.5-7.3L6.6 22H3.8l6.6-7.6L3.2 2h5.8l4 6.7L18.9 2Zm-1 18.2h1.5L8 3.7H6.4l11.5 16.5Z"/></svg>';
      case 'facebook':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9c0-.9.2-1.5 1.5-1.5h1.7V4.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H7v3h3v8h3.5Z"/></svg>';
      case 'email':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 4.2 8 4.8 8-4.8V6l-8 4.8L4 6v2.2Z"/></svg>';
      case 'copy':
      default:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><rect x="3" y="3" width="13" height="13" rx="2"></rect></svg>';
    }
  }

  function buildShareUrl(channel, { title, text, url }) {
    const safeTitle = encodeURIComponent(title || '');
    const safeText = encodeURIComponent(text || title || '');
    const safeUrl = encodeURIComponent(url || '');

    switch (channel) {
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${safeText}%20${safeUrl}`;
      case 'telegram':
        return `https://t.me/share/url?url=${safeUrl}&text=${safeText}`;
      case 'x':
        return `https://twitter.com/intent/tweet?text=${safeText}&url=${safeUrl}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${safeUrl}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${safeUrl}`;
      case 'email':
        return `mailto:?subject=${safeTitle}&body=${safeText}%0A${safeUrl}`;
      default:
        return '';
    }
  }

  async function copyToClipboard(value) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      prompt('Copia el enlace:', value);
      return true;
    } catch (_e) {
      alert('No se pudo copiar el enlace');
      return false;
    }
  }

  function showToast(node, message) {
    if (!node) return;
    if (!message) {
      node.classList.remove('active');
      node.textContent = '';
      return;
    }
    node.textContent = message;
    node.classList.add('active');
    clearTimeout(node._toastTimer);
    node._toastTimer = setTimeout(() => {
      node.classList.remove('active');
    }, 1800);
  }
})();
