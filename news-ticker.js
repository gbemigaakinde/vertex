// News Ticker Configuration
// CUSTOMIZE YOUR TICKER HERE

const tickerConfig = {
    // Add your news items here (each item is a separate news headline)
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
    
    // Colors (use hex codes)
    backgroundColor: '#c62828',  // Ticker background color
    textColor: '#ffffff',        // Ticker text color
    
    // Separator between news items
    separator: '|'
};

// Initialize ticker on page load
function initTicker() {
    updateTickerContent();
    updateTickerStyles();
}

// Update ticker content with news items
function updateTickerContent() {
    const tickerScroll = document.getElementById('tickerScroll');
    
    if (!tickerScroll) {
        console.error('Ticker element not found. Make sure the HTML is included.');
        return;
    }
    
    // Join news items with separator
    const newsText = tickerConfig.newsItems.join(` <span class="ticker-separator">${tickerConfig.separator}</span> `);
    
    // Duplicate content for seamless loop
    tickerScroll.innerHTML = newsText + ` <span class="ticker-separator">${tickerConfig.separator}</span> ` + newsText;
}

// Update ticker styles based on configuration
function updateTickerStyles() {
    const container = document.querySelector('.news-ticker-container');
    const tickerScroll = document.getElementById('tickerScroll');
    
    if (!container || !tickerScroll) {
        return;
    }
    
    // Apply background and text colors
    container.style.backgroundColor = tickerConfig.backgroundColor;
    container.style.color = tickerConfig.textColor;
    
    // Apply speed class
    tickerScroll.className = `ticker-text speed-${tickerConfig.speed}`;
}

// Close/hide the ticker
function closeTicker() {
    const container = document.querySelector('.news-ticker-container');
    if (container) {
        container.classList.add('hidden');
    }
}

// Show the ticker (if you want to programmatically show it)
function showTicker() {
    const container = document.querySelector('.news-ticker-container');
    if (container) {
        container.classList.remove('hidden');
    }
}

// Update ticker dynamically (useful for admin panels)
function updateTicker(newItems, speed, bgColor, txtColor) {
    if (newItems && Array.isArray(newItems)) {
        tickerConfig.newsItems = newItems;
    }
    if (speed) {
        tickerConfig.speed = speed;
    }
    if (bgColor) {
        tickerConfig.backgroundColor = bgColor;
    }
    if (txtColor) {
        tickerConfig.textColor = txtColor;
    }
    
    updateTickerContent();
    updateTickerStyles();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicker);
} else {
    // DOM is already loaded
    initTicker();
}