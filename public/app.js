// ========================================
// VOISEE LANDING PAGE JAVASCRIPT
// ========================================

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile menu toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('nav-open');
        mobileMenuBtn.classList.toggle('active');
    });
}

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    } else {
        navbar.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
});

// ========================================
// ROOM CONNECTION LOGIC
// ========================================

/**
 * Show loading state on button
 */
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'Connecting...';
        button.style.opacity = '0.7';
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
        button.style.opacity = '1';
    }
}

/**
 * Show error message near form
 */
function showError(formElement, message) {
    // Remove any existing error messages
    const existingError = formElement.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #FEE2E2;
        border: 1px solid #EF4444;
        color: #991B1B;
        padding: 1rem;
        border-radius: 0.5rem;
        margin-top: 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
    `;
    errorDiv.textContent = message;
    
    formElement.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

/**
 * Verify room credentials and get room URL
 */
async function verifyAndConnect(roomName, password) {
    try {
        const response = await fetch('/api/verify-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                roomName: roomName.trim(),
                password: password
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to connect to room');
        }
        
        return data.roomUrl;
    } catch (error) {
        throw new Error(error.message || 'Connection failed. Please check your credentials and try again.');
    }
}

/**
 * Join as Caller (regular video call)
 */
async function joinAsCaller() {
    const roomInput = document.getElementById('caller-room');
    const passwordInput = document.getElementById('caller-password');
    const button = event.target;
    const formCard = button.closest('.mode-card');
    
    const roomName = roomInput.value.trim();
    const password = passwordInput.value;
    
    // Validation
    if (!roomName) {
        showError(formCard, 'Please enter a room name');
        roomInput.focus();
        return;
    }
    
    if (!password) {
        showError(formCard, 'Please enter a password');
        passwordInput.focus();
        return;
    }
    
    // Attempt connection
    setButtonLoading(button, true);
    
    try {
        const roomUrl = await verifyAndConnect(roomName, password);
        
        // Store connection info for potential reconnection
        sessionStorage.setItem('voisee_room', roomName);
        sessionStorage.setItem('voisee_mode', 'caller');
        
        // Redirect to Daily.co room
        window.location.href = roomUrl;
    } catch (error) {
        setButtonLoading(button, false);
        showError(formCard, error.message);
    }
}

/**
 * Join as Kiosk (auto-answer mode)
 */
async function joinAsKiosk() {
    const roomInput = document.getElementById('kiosk-room');
    const passwordInput = document.getElementById('kiosk-password');
    const button = event.target;
    const formCard = button.closest('.mode-card');
    
    const roomName = roomInput.value.trim();
    const password = passwordInput.value;
    
    // Validation
    if (!roomName) {
        showError(formCard, 'Please enter a room name');
        roomInput.focus();
        return;
    }
    
    if (!password) {
        showError(formCard, 'Please enter a password');
        passwordInput.focus();
        return;
    }
    
    // Attempt connection
    setButtonLoading(button, true);
    
    try {
        const roomUrl = await verifyAndConnect(roomName, password);
        
        // Persist credentials so kiosk auto-reconnects after returning from a call
        localStorage.setItem('voisee_kiosk_room', roomName);
        localStorage.setItem('voisee_kiosk_password', password);
        sessionStorage.setItem('voisee_room', roomName);
        sessionStorage.setItem('voisee_mode', 'kiosk');
        
        // Add kiosk mode parameter to URL
        const kioskUrl = `${roomUrl}?kiosk=true`;
        
        // Redirect to Daily.co room in kiosk mode
        window.location.href = kioskUrl;
    } catch (error) {
        setButtonLoading(button, false);
        showError(formCard, error.message);
    }
}

// ========================================
// FORM ENHANCEMENTS
// ========================================

// Add Enter key support for forms
document.querySelectorAll('.mode-card input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const button = input.closest('.mode-card').querySelector('button');
            if (button) {
                button.click();
            }
        }
    });
});

// Auto-focus on first input when scrolling to connect section
const observerOptions = {
    root: null,
    threshold: 0.5
};

const connectSection = document.getElementById('connect');
if (connectSection) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const firstInput = document.getElementById('caller-room');
                if (firstInput && document.activeElement.tagName !== 'INPUT') {
                    setTimeout(() => {
                        firstInput.focus();
                    }, 500);
                }
            }
        });
    }, observerOptions);
    
    observer.observe(connectSection);
}

// Add subtle animations on scroll
const animateOnScroll = () => {
    const elements = document.querySelectorAll('.feature-card, .step, .security-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });
};

// Initialize animations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateOnScroll);
} else {
    animateOnScroll();
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Check if user has previously connected
 */
function checkRecentConnection() {
    const recentRoom = sessionStorage.getItem('voisee_room');
    const recentMode = sessionStorage.getItem('voisee_mode');
    
    if (recentRoom) {
        // Pre-fill room name from recent session
        const callerRoom = document.getElementById('caller-room');
        const kioskRoom = document.getElementById('kiosk-room');
        
        if (recentMode === 'caller' && callerRoom && !callerRoom.value) {
            callerRoom.value = recentRoom;
        } else if (recentMode === 'kiosk' && kioskRoom && !kioskRoom.value) {
            kioskRoom.value = recentRoom;
        }
    }
}

/**
 * Initialize kiosk mode: hide marketing content, auto-connect if credentials are stored
 */
function initKioskMode() {
    document.body.classList.add('kiosk-mode');

    const savedRoom = localStorage.getItem('voisee_kiosk_room');
    const savedPassword = localStorage.getItem('voisee_kiosk_password');

    if (savedRoom && savedPassword) {
        const roomInput = document.getElementById('kiosk-room');
        const passwordInput = document.getElementById('kiosk-password');
        if (roomInput) roomInput.value = savedRoom;
        if (passwordInput) passwordInput.value = savedPassword;

        // Simulate a button click so joinAsKiosk() runs with proper event context
        const button = document.querySelector('.mode-card-featured button');
        if (button) button.click();
    }
}

// Check for recent connections on page load
checkRecentConnection();

// Activate kiosk mode when ?mode=kiosk is present in the URL
const _urlParams = new URLSearchParams(window.location.search);
if (_urlParams.get('mode') === 'kiosk') {
    initKioskMode();
}

// Log initialization
console.log('🎥 Voisee initialized - Stay connected to your loved ones');
