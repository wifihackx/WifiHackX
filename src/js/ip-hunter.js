(function () {
  const ids = {
    map: 'hunterMap',
    scrim: 'mapScrim',
    ip: 'ipValue',
    isp: 'ispValue',
    loc: 'locValue',
    region: 'regionValue',
    tz: 'tzValue',
    status: 'statusValue',
    scanBtn: 'scanBtn',
    retryBtn: 'retryBtn',
    protectBtn: 'protectBtn',
    providerSelect: 'providerSelect',
    confidenceBadge: 'confidenceBadge',
    downloadLogBtn: 'downloadLogBtn',
    downloadCsvBtn: 'downloadCsvBtn',
    clearLogBtn: 'clearLogBtn',
    toggleLogBtn: 'toggleLogBtn',
    logList: 'logList',
    logSearch: 'logSearch',
    logFilter: 'logFilter',
    logCount: 'logCount'
  };

  const el = Object.fromEntries(
    Object.entries(ids).map(([key, value]) => [key, document.getElementById(value)])
  );

  if (!el.map || !el.ip || !el.isp || !el.loc || !el.region || !el.tz || !el.status) return;

  let mapInstance = null;
  let marker = null;
  let inflight = false;

  const LOG_KEY = 'ipHunterLogs';
  const MAX_LOGS = 30;

  const providers = {
    ipapi: {
      label: 'ipapi.co',
      confidence: 'high',
      url: 'https://ipapi.co/json/',
      map: data => ({
        ip: data.ip,
        isp: data.org || data.asn,
        city: data.city,
        region: data.region || data.region_code,
        country: data.country_name || data.country_code,
        timezone: data.timezone,
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude)
      })
    },
    ipwhois: {
      label: 'ipwho.is',
      confidence: 'medium',
      url: 'https://ipwho.is/',
      map: data => ({
        ip: data.ip,
        isp: data.connection && data.connection.isp ? data.connection.isp : data.isp,
        city: data.city,
        region: data.region,
        country: data.country,
        timezone: data.timezone && data.timezone.id ? data.timezone.id : data.timezone,
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude)
      }),
      successCheck: data => data && data.success !== false
    },
    local: {
      label: 'Solo local',
      confidence: 'high'
    }
  };

  const setStatus = (text, color) => {
    el.status.textContent = text;
    if (color) {
      el.status.style.color = color;
      el.status.style.textShadow = `0 0 10px ${color}`;
    }
  };

  const setPlaceholder = () => {
    el.ip.textContent = 'ESCANEANDO...';
    el.isp.textContent = '--';
    el.loc.textContent = '--';
    el.region.textContent = '--';
    el.tz.textContent = '--';
    setStatus('ANALIZANDO', '#ffbd2e');
  };

  const setIdle = () => {
    el.ip.textContent = 'LISTO';
    el.isp.textContent = '--';
    el.loc.textContent = '--';
    el.region.textContent = '--';
    el.tz.textContent = '--';
    setStatus('EN ESPERA', '#00f3ff');
  };

  const ensureMap = () => {
    if (mapInstance || !window.L) return mapInstance;

    mapInstance = window.L.map(ids.map, {
      zoomControl: false,
      attributionControl: false
    }).setView([20, 0], 2);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(mapInstance);

    return mapInstance;
  };

  const updateMap = (lat, lng, label) => {
    const map = ensureMap();
    if (!map) return;

    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      map.setView([20, 0], 2);
      return;
    }

    const customIcon = window.L.divIcon({
      className: 'custom-pin',
      html: '<div style="width: 18px; height: 18px; background: #ff003c; border-radius: 50%; box-shadow: 0 0 16px #ff003c; border: 2px solid white;"></div>'
    });

    map.flyTo([lat, lng], 13, { animate: true, duration: 2.8 });

    if (marker) {
      marker.remove();
    }

    marker = window.L.marker([lat, lng], { icon: customIcon })
      .addTo(map)
      .bindPopup(`<b style="color:#00f3ff">Ubicación aproximada</b><br>${label}`)
      .openPopup();
  };

  const fetchWithTimeout = (url, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { signal: controller.signal })
      .finally(() => clearTimeout(timer));
  };

  const setLoading = isLoading => {
    inflight = isLoading;
    if (el.scanBtn) el.scanBtn.disabled = isLoading;
    if (el.retryBtn) el.retryBtn.disabled = isLoading;
    if (el.scrim) el.scrim.classList.toggle('is-hidden', !isLoading);
  };

  const applyData = (data, providerName) => {
    const ip = data.ip || 'NO DISPONIBLE';
    const isp = data.isp || 'Desconocido';
    const city = data.city || 'Ciudad desconocida';
    const region = data.region || 'Región desconocida';
    const country = data.country || 'País';
    const timezone = data.timezone || 'Sin datos';
    const label = `${city}, ${country}`;

    el.ip.textContent = ip;
    el.isp.textContent = isp;
    el.loc.textContent = label;
    el.region.textContent = region;
    el.tz.textContent = timezone;
    setStatus('VISIBLE', '#ff003c');

    updateMap(data.lat, data.lng, label);
    appendLog({
      provider: providerName,
      ip,
      isp,
      location: label,
      region,
      timezone
    });
    renderLogs();
  };

  const applyLocalMode = () => {
    el.ip.textContent = 'XXX.XXX.XXX.XXX';
    el.isp.textContent = 'Modo local';
    el.loc.textContent = 'Ubicación privada';
    el.region.textContent = '--';
    el.tz.textContent = '--';
    setStatus('PROTEGIDO', '#05ffa1');
    updateMap(20, 0, '');
    appendLog({
      provider: 'local',
      ip: 'masked',
      isp: 'local',
      location: 'privada',
      region: '--',
      timezone: '--'
    });
    renderLogs();
  };

  const handleError = () => {
    el.ip.textContent = 'OCULTA';
    el.isp.textContent = 'Protegido';
    el.loc.textContent = 'Ubicación privada';
    el.region.textContent = '--';
    el.tz.textContent = '--';
    setStatus('SEGURO', '#00f3ff');
    updateMap(20, 0, '');
  };

  const resolveProviderList = () => {
    const selected = el.providerSelect ? el.providerSelect.value : 'auto';
    if (selected && selected !== 'auto' && selected !== 'local' && providers[selected]) {
      return [providers[selected]];
    }
    return [providers.ipapi, providers.ipwhois];
  };

  const tryProvider = provider =>
    fetchWithTimeout(provider.url, 8000)
      .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(data => {
        if (provider.successCheck && !provider.successCheck(data)) {
          return Promise.reject('invalid');
        }
        return { mapped: provider.map(data), provider };
      });

  const updateConfidence = () => {
    if (!el.confidenceBadge || !el.providerSelect) return;
    const selected = el.providerSelect.value || 'auto';
    const provider = providers[selected] || providers.ipapi;
    const level = provider.confidence || 'high';
    const label = level === 'high' ? 'Alta' : level === 'medium' ? 'Media' : 'Baja';

    el.confidenceBadge.dataset.level = level;
    el.confidenceBadge.textContent = `Confianza: ${label}`;
  };

  const getLogs = () => {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    } catch (_e) {
      return [];
    }
  };

  const appendLog = entry => {
    try {
      const existing = getLogs();
      const logItem = {
        ts: new Date().toISOString(),
        ...entry
      };
      const next = [logItem, ...existing].slice(0, MAX_LOGS);
      localStorage.setItem(LOG_KEY, JSON.stringify(next));
    } catch (_e) {}
  };

  const downloadLogs = () => {
    const logs = getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ip-hunter-log.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const logs = getLogs();
    const header = ['timestamp', 'provider', 'ip', 'isp', 'location', 'region', 'timezone'];
    const rows = logs.map(item => [
      item.ts,
      item.provider,
      item.ip,
      item.isp,
      item.location,
      item.region,
      item.timezone
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ip-hunter-log.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    localStorage.removeItem(LOG_KEY);
    renderLogs();
  };

  const matchesFilter = item => {
    const term = (el.logSearch && el.logSearch.value ? el.logSearch.value : '').toLowerCase().trim();
    const filter = el.logFilter && el.logFilter.value ? el.logFilter.value : 'all';
    const providerMatch = filter === 'all' || item.provider === filter;
    if (!providerMatch) return false;
    if (!term) return true;
    return [item.ip, item.location, item.region, item.timezone]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(term));
  };

  const renderLogs = () => {
    if (!el.logList) return;
    const logs = getLogs().filter(matchesFilter);
    el.logList.innerHTML = '';
    if (el.logCount) {
      el.logCount.textContent = logs.length.toString();
    }
    if (logs.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'log-item';
      empty.textContent = 'Sin registros por ahora.';
      el.logList.appendChild(empty);
      return;
    }

    logs.forEach(item => {
      const li = document.createElement('li');
      li.className = 'log-item';
      li.innerHTML = `
        <div><strong>${item.ip}</strong> · ${item.location}</div>
        <div class="log-meta">
          <span>${item.provider}</span>
          <span>${item.region}</span>
          <span>${item.timezone}</span>
          <span>${new Date(item.ts).toLocaleString()}</span>
        </div>
      `;
      el.logList.appendChild(li);
    });
  };

  const toggleLogs = () => {
    if (!el.logList || !el.toggleLogBtn) return;
    const isHidden = el.logList.hasAttribute('hidden');
    if (isHidden) {
      el.logList.removeAttribute('hidden');
      el.toggleLogBtn.textContent = 'Ocultar';
      renderLogs();
    } else {
      el.logList.setAttribute('hidden', '');
      el.toggleLogBtn.textContent = 'Mostrar';
    }
  };

  const startScan = () => {
    if (inflight) return;

    const selected = el.providerSelect ? el.providerSelect.value : 'auto';
    if (selected === 'local') {
      setLoading(true);
      setPlaceholder();
      ensureMap();
      setTimeout(() => {
        applyLocalMode();
        setLoading(false);
        if (el.retryBtn) el.retryBtn.disabled = false;
      }, 400);
      return;
    }

    setLoading(true);
    setPlaceholder();
    ensureMap();

    const list = resolveProviderList();
    let chain = Promise.reject();

    list.forEach(provider => {
      chain = chain.catch(() => tryProvider(provider));
    });

    chain
      .then(result => applyData(result.mapped, result.provider.label))
      .catch(() => handleError())
      .finally(() => {
        setLoading(false);
        if (el.retryBtn) el.retryBtn.disabled = false;
      });
  };

  if (el.scanBtn) {
    el.scanBtn.addEventListener('click', startScan);
  }

  if (el.retryBtn) {
    el.retryBtn.addEventListener('click', startScan);
  }

  if (el.protectBtn) {
    el.protectBtn.addEventListener('click', () => {
      setStatus('PROTEGIDO', '#05ffa1');
    });
  }

  if (el.providerSelect) {
    const saved = localStorage.getItem('ipHunterProvider');
    if (saved && el.providerSelect.querySelector(`option[value="${saved}"]`)) {
      el.providerSelect.value = saved;
    }
    el.providerSelect.addEventListener('change', () => {
      localStorage.setItem('ipHunterProvider', el.providerSelect.value);
      updateConfidence();
      renderLogs();
    });
  }

  if (el.downloadLogBtn) {
    el.downloadLogBtn.addEventListener('click', downloadLogs);
  }

  if (el.downloadCsvBtn) {
    el.downloadCsvBtn.addEventListener('click', downloadCsv);
  }

  if (el.clearLogBtn) {
    el.clearLogBtn.addEventListener('click', clearLogs);
  }

  if (el.toggleLogBtn) {
    el.toggleLogBtn.addEventListener('click', toggleLogs);
  }

  if (el.logSearch) {
    el.logSearch.addEventListener('input', () => renderLogs());
  }

  if (el.logFilter) {
    el.logFilter.addEventListener('change', () => renderLogs());
  }

  updateConfidence();
  setIdle();
})();
