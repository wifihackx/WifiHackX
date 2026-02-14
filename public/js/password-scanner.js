(function () {
  const LOG10_2 = Math.log10(2);
  const LOG10_HALF = Math.log10(0.5);

  const CHARSETS = [
    { regex: /[a-z]/, size: 26 },
    { regex: /[A-Z]/, size: 26 },
    { regex: /[0-9]/, size: 10 },
    { regex: /[^A-Za-z0-9]/, size: 32 }
  ];

  const TIME_STEPS = [
    { label: 'SEGUNDOS', log10: Math.log10(60), divisor: 1 },
    { label: 'MINUTOS', log10: Math.log10(3600), divisor: 60 },
    { label: 'HORAS', log10: Math.log10(86400), divisor: 3600 },
    { label: 'DÍAS', log10: Math.log10(2629800), divisor: 86400 },
    { label: 'MESES', log10: Math.log10(31557600), divisor: 2629800 },
    { label: 'AÑOS', log10: Math.log10(31557600 * 100), divisor: 31557600 }
  ];

  const STATUS_BANDS = [
    { maxEntropy: 28, label: 'VULNERABLE', className: 'status-weak', color: 'var(--scanner-neon-red)' },
    { maxEntropy: 50, label: 'MODERADO', className: 'status-medium', color: 'var(--scanner-neon-gold)' },
    { maxEntropy: 70, label: 'SEGURO', className: 'status-strong', color: 'var(--scanner-neon-green)' },
    { maxEntropy: Infinity, label: 'IMPOSIBLE', className: 'status-god', color: 'var(--scanner-neon-cyan)' }
  ];

  function initPasswordScanner() {
    const input = document.getElementById('passwordInput');
    const bar = document.getElementById('strengthBar');
    const timeDisplay = document.getElementById('timeToCrack');
    const entropyDisplay = document.getElementById('entropyScore');
    const statusDisplay = document.getElementById('securityStatus');

    if (!input || !bar || !timeDisplay || !entropyDisplay || !statusDisplay) return;

    const resetScanner = () => {
      bar.style.width = '0%';
      timeDisplay.innerText = '--';
      entropyDisplay.innerText = '0 bits';
      statusDisplay.innerText = 'ESPERANDO INPUT...';
      statusDisplay.className = 'value status-text';
    };

    input.addEventListener('input', e => {
      const pwd = e.target.value || '';
      if (!pwd) {
        resetScanner();
        return;
      }

      const { entropy, score, timeLabel, status } = calculateStrength(pwd);
      updateUI({ entropy, score, timeLabel, status });
    });

    resetScanner();
  }

  function calculateStrength(password) {
    const length = password.length;
    const poolSize = CHARSETS.reduce((acc, set) => (set.regex.test(password) ? acc + set.size : acc), 0);
    const entropy = poolSize > 0 ? length * Math.log2(poolSize) : 0;

    const score = Math.max(0, Math.min(100, Math.round((entropy / 80) * 100)));
    const timeLabel = formatTimeToCrack(entropy);
    const status = resolveStatus(entropy);

    return { entropy, score, timeLabel, status };
  }

  function formatTimeToCrack(entropy, guessesPerSecond) {
    const rate = guessesPerSecond || 1e10;
    if (!entropy || entropy <= 0) return '--';

    const log10Seconds = LOG10_HALF + entropy * LOG10_2 - Math.log10(rate);

    if (log10Seconds < 0) return 'INSTANTÁNEO';

    for (const step of TIME_STEPS) {
      if (log10Seconds < step.log10) {
        const seconds = Math.pow(10, log10Seconds);
        const value = Math.max(1, Math.round(seconds / step.divisor));
        return `${value} ${step.label}`;
      }
    }

    const yearsLog10 = log10Seconds - Math.log10(31557600);
    if (yearsLog10 < 6) {
      const years = Math.round(Math.pow(10, yearsLog10));
      return `${years} AÑOS`;
    }

    return `~10^${Math.round(yearsLog10)} AÑOS`;
  }

  function resolveStatus(entropy) {
    return STATUS_BANDS.find(band => entropy <= band.maxEntropy) || STATUS_BANDS[STATUS_BANDS.length - 1];
  }

  function updateUI(payload) {
    const bar = document.getElementById('strengthBar');
    const timeDisplay = document.getElementById('timeToCrack');
    const entropyDisplay = document.getElementById('entropyScore');
    const statusDisplay = document.getElementById('securityStatus');

    if (!bar || !timeDisplay || !entropyDisplay || !statusDisplay) return;

    bar.style.width = `${payload.score}%`;
    bar.style.background = payload.status.color;
    bar.style.boxShadow = `0 0 15px ${payload.status.color}`;

    timeDisplay.innerText = payload.timeLabel;
    entropyDisplay.innerText = `${Math.round(payload.entropy)} bits`;
    statusDisplay.innerText = payload.status.label;
    statusDisplay.className = `value status-text ${payload.status.className}`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordScanner);
  } else {
    initPasswordScanner();
  }
})();
