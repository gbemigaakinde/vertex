/* ══════════════════════════════════════════════════════
   VERTEX CBT — News Ticker
   Fixed: HTML injection, animation, speed, hidden conflict
══════════════════════════════════════════════════════ */

// ── Configuration ────────────────────────────────────
const tickerConfig = {
    newsItems: [
        "Welcome to Vertex Tutorial CBT System!",
        "If you had already registered, then login with your email and password. Otherwise, click Register to register",
        "If you do not have an email address, use yourname@vertex.com (e.g. tosin@vertex.com) as your email",
        "Use a password that you will never forget",
        "Select at least 2 subjects to start your exam",
        "Good luck with your tests!"
    ],

    // Animation speed: 'slow', 'normal', or 'fast'
    speed: 'slow',

    // Colors
    backgroundColor: '#c62828',
    textColor: '#ffffff',

    // Separator between items
    separator: '|'
};

// ── Inject ticker HTML into the page ────────────────
function _buildTickerHTML() {
    return `
      <div class="news-ticker-container" id="newsTicker" role="marquee" aria-live="off">
        <div class="ticker-wrapper">
          <div class="ticker-label">
            <span class="ticker-label-icon">📢</span>
            <span>Notice</span>
          </div>
          <div class="ticker-content">
            <div class="ticker-text" id="tickerScroll"></div>
          </div>
          <button class="ticker-close" onclick="closeTicker()" aria-label="Close ticker" title="Close">&#x2715;</button>
        </div>
      </div>
    `;
}

// ── Inject into document body ────────────────────────
function _injectTicker() {
    // Don't inject twice
    if (document.getElementById('newsTicker')) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = _buildTickerHTML().trim();
    document.body.appendChild(wrapper.firstChild);
}

// ── Populate the scrolling text ──────────────────────
function updateTickerContent() {
    var tickerScroll = document.getElementById('tickerScroll');
    if (!tickerScroll) return;

    var sep = ' <span class="ticker-separator">' + tickerConfig.separator + '</span> ';
    // Single copy — the animation handles the loop by starting off-screen right
    tickerScroll.innerHTML = tickerConfig.newsItems.join(sep);
}

// ── Apply colour + speed from config ────────────────
function updateTickerStyles() {
    var container = document.getElementById('newsTicker');
    var tickerScroll = document.getElementById('tickerScroll');
    if (!container || !tickerScroll) return;

    container.style.backgroundColor = tickerConfig.backgroundColor;
    container.style.color           = tickerConfig.textColor;

    tickerScroll.className = 'ticker-text speed-' + tickerConfig.speed;
}

// ── Close: hide the ticker bar ───────────────────────
function closeTicker() {
    var container = document.getElementById('newsTicker');
    if (container) {
        // Use our own class — avoids conflict with main.css .hidden
        container.classList.add('ticker-hidden');
    }
}

// ── Show: reveal the ticker bar ─────────────────────
function showTicker() {
    var container = document.getElementById('newsTicker');
    if (container) {
        container.classList.remove('ticker-hidden');
    }
}

// ── Dynamic update (for admin / future use) ──────────
function updateTicker(newItems, speed, bgColor, txtColor) {
    if (newItems && Array.isArray(newItems)) tickerConfig.newsItems = newItems;
    if (speed)   tickerConfig.speed           = speed;
    if (bgColor) tickerConfig.backgroundColor = bgColor;
    if (txtColor) tickerConfig.textColor      = txtColor;

    updateTickerContent();
    updateTickerStyles();
}

// ── Main init ────────────────────────────────────────
function initTicker() {
    _injectTicker();
    updateTickerContent();
    updateTickerStyles();
}

// ── Boot ─────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicker);
} else {
    initTicker();
}
