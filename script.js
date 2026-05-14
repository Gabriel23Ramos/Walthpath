// ════════════════════════════════════════════════════════
// MOBILE RESPONSIVENESS FIXES
// ════════════════════════════════════════════════════════

// Toggle sidebar on mobile
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
  if (overlay) {
    overlay.classList.toggle('open');
  }
}

// Close sidebar
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar) {
    sidebar.classList.remove('open');
  }
  if (overlay) {
    overlay.classList.remove('open');
  }
}

// Handle window resize to close sidebar on desktop
function handleResize() {
  if (window.innerWidth > 768) {
    closeSidebar();
  }
}

// Add event listener for window resize
window.addEventListener('resize', handleResize);

// Close sidebar when clicking on a navigation item
document.addEventListener('DOMContentLoaded', function() {
  const navItems = document.querySelectorAll('.nitem');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      closeSidebar();
    });
  });

  // Close sidebar when clicking overlay
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Handle hamburger button
  const hamBtn = document.getElementById('hamBtn');
  if (hamBtn) {
    hamBtn.addEventListener('click', toggleSidebar);
  }

  // Prevent body scroll when sidebar is open on mobile
  const sidebar = document.getElementById('sidebar');
  const observer = new MutationObserver(function() {
    if (sidebar && sidebar.classList.contains('open')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  if (sidebar) {
    observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  }
});

// Toast notification function
function showToast(message, type = 'ok') {
  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'ok' ? 'rgba(16,185,129,0.9)' : 'rgba(244,63,94,0.9)'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    z-index: 9999;
    animation: slideUp 0.3s ease;
    backdrop-filter: blur(10px);
    border: 1px solid ${type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'};
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add keyframe animations to document
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(20px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Prevent zoom on double tap (mobile optimization)
document.addEventListener('touchstart', function(event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

// Handle viewport meta tag for better mobile experience
function optimizeViewport() {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover';
}

optimizeViewport();

// Handle safe area insets for notched devices
function applySafeAreaInsets() {
  const style = document.createElement('style');
  style.textContent = `
    body {
      padding-left: max(0px, env(safe-area-inset-left));
      padding-right: max(0px, env(safe-area-inset-right));
      padding-top: max(0px, env(safe-area-inset-top));
      padding-bottom: max(0px, env(safe-area-inset-bottom));
    }
    
    .sidebar {
      padding-left: max(0px, env(safe-area-inset-left));
    }
    
    .topbar {
      padding-left: max(0px, env(safe-area-inset-left));
      padding-right: max(0px, env(safe-area-inset-right));
    }
  `;
  document.head.appendChild(style);
}

applySafeAreaInsets();

// Detect if device is in dark mode
function detectDarkMode() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    const theme = localStorage.getItem('ff_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
}

detectDarkMode();

// Listen for dark mode changes
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectDarkMode);
}

// Optimize touch interactions
function optimizeTouchInteractions() {
  const style = document.createElement('style');
  style.textContent = `
    @media (hover: none) and (pointer: coarse) {
      button, [role="button"], a {
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
      }
      
      .nitem:active {
        background: rgba(255,255,255,0.12);
      }
      
      .gcard:active {
        transform: scale(0.98);
      }
      
      .btn-new:active,
      .btn-export:active,
      .btn-profile:active {
        transform: scale(0.95);
      }
    }
  `;
  document.head.appendChild(style);
}

optimizeTouchInteractions();

// Handle orientation change
window.addEventListener('orientationchange', function() {
  closeSidebar();
  // Reload charts if they exist
  if (typeof renderCharts === 'function') {
    setTimeout(renderCharts, 300);
  }
});

// Smooth scroll behavior
document.addEventListener('DOMContentLoaded', function() {
  document.documentElement.style.scrollBehavior = 'smooth';
});

// Handle input focus on mobile (prevent zoom)
document.addEventListener('DOMContentLoaded', function() {
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      // Prevent automatic zoom on iOS
      if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        const fontSize = window.getComputedStyle(this).fontSize;
        if (parseInt(fontSize) < 16) {
          this.style.fontSize = '16px';
        }
      }
    });
    
    input.addEventListener('blur', function() {
      if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        this.style.fontSize = '';
      }
    });
  });
});

// Export functions for use in HTML
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showToast = showToast;
