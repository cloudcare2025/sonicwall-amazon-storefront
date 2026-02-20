/**
 * SonicWall Amazon Storefront - Main JavaScript
 * Round 4: Dropdown nav + button ripple + product card hover + enhanced scroll selectors
 */

(function() {
  'use strict';

  // ============================================================================
  // STATE & CONFIGURATION
  // ============================================================================

  let isScrolling = false;
  let currentTestimonialIndex = 0;
  let testimonialInterval = null;
  let touchStartX = 0;
  let touchEndX = 0;
  const TESTIMONIAL_INTERVAL_MS = 5000;
  const SCROLL_OBSERVER_THRESHOLD = 0.15;
  const CART_ANIMATION_DURATION = 300;
  const STICKY_HEADER_HEIGHT = 84; // Brand header sticky height
  const PRODUCT_STAGGER_DELAY = 100; // Grid stagger timing
  const TOUCH_SWIPE_THRESHOLD = 75; // Minimum swipe distance in px
  const EASING_BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const EASING_SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';

  // Store observers for cleanup
  const observers = [];

  // Detect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function throttle(callback) {
    if (isScrolling) return;
    isScrolling = true;
    requestAnimationFrame(() => {
      callback();
      isScrolling = false;
    });
  }

  function smoothScrollTo(element, offset = STICKY_HEADER_HEIGHT) {
    if (!element) return;

    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ============================================================================
  // TAB NAVIGATION
  // ============================================================================

  function initTabNavigation() {
    const tabs = document.querySelectorAll('.brand-nav__tab');
    const sections = document.querySelectorAll('[data-section]');

    if (!tabs.length) return;

    // Add keyboard navigation support
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('tabindex', '0');

      // Click handler
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab(tab);
      });

      // Keyboard handler
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateTab(tab);
        }

        // Arrow key navigation
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextTab = tabs[index + 1] || tabs[0];
          nextTab.focus();
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevTab = tabs[index - 1] || tabs[tabs.length - 1];
          prevTab.focus();
        }
      });
    });

    function activateTab(tab) {
      const targetSection = tab.getAttribute('data-section');

      // Update active tab
      tabs.forEach(t => {
        t.classList.remove('brand-nav__tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('brand-nav__tab--active');
      tab.setAttribute('aria-selected', 'true');

      // Scroll to section
      const section = document.querySelector(`[data-section="${targetSection}"]`);
      if (section && section.tagName !== 'BUTTON') {
        smoothScrollTo(section);
      }
    }

    // Update active tab on scroll with improved threshold
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const sectionName = entry.target.getAttribute('data-section');
          const activeTab = document.querySelector(`.brand-nav__tab[data-section="${sectionName}"]`);

          if (activeTab) {
            tabs.forEach(t => {
              t.classList.remove('brand-nav__tab--active');
              t.setAttribute('aria-selected', 'false');
            });
            activeTab.classList.add('brand-nav__tab--active');
            activeTab.setAttribute('aria-selected', 'true');
          }
        }
      });
    }, {
      threshold: [0.5, 0.75],
      rootMargin: `-${STICKY_HEADER_HEIGHT + 20}px 0px -30% 0px`
    });

    sections.forEach(section => {
      if (section.tagName !== 'BUTTON') {
        sectionObserver.observe(section);
      }
    });

    observers.push(sectionObserver);

    // HANDLE INITIAL SCROLL POSITION - Set correct active tab on page load
    function setInitialActiveTab() {
      const scrollY = window.scrollY;

      // If page is scrolled on load, find which section is visible
      if (scrollY > 100) {
        let activeSection = null;
        let maxVisibility = 0;

        sections.forEach(section => {
          if (section.tagName === 'BUTTON') return;

          const rect = section.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
          const visibilityRatio = visibleHeight / viewportHeight;

          if (visibilityRatio > maxVisibility) {
            maxVisibility = visibilityRatio;
            activeSection = section;
          }
        });

        if (activeSection) {
          const sectionName = activeSection.getAttribute('data-section');
          const correspondingTab = document.querySelector(`.brand-nav__tab[data-section="${sectionName}"]`);

          if (correspondingTab) {
            tabs.forEach(t => {
              t.classList.remove('brand-nav__tab--active');
              t.setAttribute('aria-selected', 'false');
            });
            correspondingTab.classList.add('brand-nav__tab--active');
            correspondingTab.setAttribute('aria-selected', 'true');
          }
        }
      }
    }

    // Run on load and after a brief delay to handle browser scroll restoration
    setInitialActiveTab();
    setTimeout(setInitialActiveTab, 100);
  }

  // ============================================================================
  // "SEE MORE PRODUCTS" TOGGLE
  // ============================================================================

  function initProductToggles() {
    const toggleConfigs = [
      { buttonId: 'tz-see-more', containerId: 'tz-products' },
      { buttonId: 'nsa-see-more', containerId: 'nsa-products' }
    ];

    toggleConfigs.forEach(({ buttonId, containerId }) => {
      const button = document.getElementById(buttonId);
      const container = document.getElementById(containerId);

      if (!button || !container) return;

      const gen7Products = container.querySelectorAll('.product-card--gen7');
      let isExpanded = false;
      let isAnimating = false;

      // Set initial ARIA state
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', containerId);

      // Debounced click handler
      const handleToggle = debounce(() => {
        if (isAnimating) return;
        isAnimating = true;

        isExpanded = !isExpanded;
        button.setAttribute('aria-expanded', isExpanded.toString());
        button.disabled = true; // Disable during animation

        if (isExpanded) {
          // Show products with grid-aware staggered animation
          gen7Products.forEach((card, index) => {
            card.style.display = 'block';

            // Calculate grid column position (typically 3-5 columns)
            const parent = card.parentElement;
            const visibleCards = Array.from(parent.children).filter(c =>
              window.getComputedStyle(c).display !== 'none'
            );
            const columnIndex = visibleCards.indexOf(card) % 5; // 5-column grid max

            setTimeout(() => {
              if (prefersReducedMotion) {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
              } else {
                card.classList.add('fade-in-up', 'visible');
              }
            }, columnIndex * PRODUCT_STAGGER_DELAY);
          });

          button.textContent = 'Show fewer products';

          // Re-enable button after animation
          setTimeout(() => {
            isAnimating = false;
            button.disabled = false;
          }, PRODUCT_STAGGER_DELAY * 5 + 400);

        } else {
          // Hide products with reverse stagger
          gen7Products.forEach((card, index) => {
            setTimeout(() => {
              card.classList.remove('visible');
              if (prefersReducedMotion) {
                card.style.display = 'none';
              }
            }, index * 40);
          });

          button.textContent = 'See more products';

          // Re-enable button after animation
          setTimeout(() => {
            gen7Products.forEach(card => {
              card.style.display = 'none';
            });
            isAnimating = false;
            button.disabled = false;
          }, 500);
        }
      }, 100);

      button.addEventListener('click', handleToggle);
    });
  }

  // ============================================================================
  // SCROLL ANIMATIONS
  // ============================================================================

  function initScrollAnimations() {
    const animatedElements = document.querySelectorAll(
      '.story-card, .category-tile, .product-card:not(.product-card--gen7), .stat-item, .testimonial, .peace-of-mind, .contact-cta, .from-manufacturer__item, .cert-badge, .category-banner, .btn--modern, .btn--gradient'
    );

    if (!animatedElements.length) return;

    // Skip animations if reduced motion is preferred
    if (prefersReducedMotion) {
      animatedElements.forEach(element => {
        element.style.opacity = '1';
        element.style.transform = 'none';
      });
      return;
    }

    // Calculate grid-aware stagger delays based on column position
    animatedElements.forEach((element) => {
      element.classList.add('fade-in-up');

      const parent = element.parentElement;
      if (parent?.classList.contains('story-cards') ||
          parent?.classList.contains('category-grid') ||
          parent?.classList.contains('product-grid') ||
          parent?.classList.contains('stats-grid') ||
          parent?.classList.contains('from-manufacturer__grid') ||
          parent?.classList.contains('certifications-bar__badges')) {

        // Get all visible siblings (not display:none)
        const siblings = Array.from(parent.children).filter(child => {
          return window.getComputedStyle(child).display !== 'none';
        });

        const siblingIndex = siblings.indexOf(element);

        // Calculate column position for responsive grids
        const computedStyle = window.getComputedStyle(parent);
        const gridCols = computedStyle.gridTemplateColumns?.split(' ').length || 3;
        const columnIndex = siblingIndex % gridCols;

        // Stagger by column position (not total index)
        element.style.transitionDelay = `${columnIndex * 0.08}s`;
      }
    });

    // IntersectionObserver for triggering animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: SCROLL_OBSERVER_THRESHOLD,
      rootMargin: '0px 0px -100px 0px'
    });

    animatedElements.forEach(element => observer.observe(element));
    observers.push(observer);

    // HANDLE INITIAL VIEWPORT - Trigger animations for elements already visible on page load
    requestAnimationFrame(() => {
      animatedElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

        if (isInViewport) {
          element.classList.add('visible');
        }
      });
    });
  }

  // ============================================================================
  // STICKY BRAND HEADER
  // ============================================================================

  function initStickyHeader() {
    const brandHeader = document.querySelector('.brand-header');
    const amazonHeader = document.querySelector('.amazon-header');

    if (!brandHeader || !amazonHeader) return;

    // Cache measurements to avoid layout thrashing
    const stickyThreshold = amazonHeader.offsetHeight;
    const brandHeaderHeight = brandHeader.offsetHeight;
    let isSticky = false;

    // Apply sticky styles via JS since no CSS rule exists for brand-header--sticky
    function applySticky() {
      if (isSticky) return;
      isSticky = true;
      brandHeader.classList.add('brand-header--sticky');
      brandHeader.style.position = 'fixed';
      brandHeader.style.top = '0';
      brandHeader.style.left = '0';
      brandHeader.style.width = '100%';
      brandHeader.style.zIndex = '999';
      brandHeader.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      document.body.style.paddingTop = brandHeaderHeight + 'px';
    }

    function removeSticky() {
      if (!isSticky) return;
      isSticky = false;
      brandHeader.classList.remove('brand-header--sticky');
      brandHeader.style.position = '';
      brandHeader.style.top = '';
      brandHeader.style.left = '';
      brandHeader.style.width = '';
      brandHeader.style.zIndex = '';
      brandHeader.style.boxShadow = '';
      document.body.style.paddingTop = '0';
    }

    const handleScroll = () => {
      throttle(() => {
        if (window.scrollY > stickyThreshold) {
          applySticky();
        } else {
          removeSticky();
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Check on init in case page loaded already scrolled
    if (window.scrollY > stickyThreshold) {
      applySticky();
    }
  }

  // ============================================================================
  // BACK TO TOP
  // ============================================================================

  function initBackToTop() {
    const backToTopLink = document.querySelector('.footer__back-to-top-link');

    if (!backToTopLink) return;

    backToTopLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============================================================================
  // CART COUNTER ANIMATION
  // ============================================================================

  function initCartCounter() {
    const cartCount = document.querySelector('.amazon-header__cart-count');
    // FIX: Correct selector - buttons use .btn--amazon class
    const optionButtons = document.querySelectorAll('.btn--amazon');

    if (!cartCount || !optionButtons.length) return;

    let currentCount = parseInt(cartCount.textContent) || 0;

    optionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        currentCount++;
        cartCount.textContent = currentCount;

        if (prefersReducedMotion) {
          // Simple color flash only
          cartCount.style.color = '#ff9900';
          setTimeout(() => {
            cartCount.style.color = '';
          }, CART_ANIMATION_DURATION);
        } else {
          // Premium bounce animation with proper easing
          cartCount.style.transition = `transform 0.15s ${EASING_BOUNCE}, color 0.15s ${EASING_SMOOTH}`;
          cartCount.style.transform = 'scale(1.15)';
          cartCount.style.color = '#ff9900';

          setTimeout(() => {
            cartCount.style.transform = 'scale(1)';
            cartCount.style.color = '';
          }, CART_ANIMATION_DURATION);
        }
      });
    });
  }

  // ============================================================================
  // TESTIMONIAL CAROUSEL
  // ============================================================================

  function initTestimonialCarousel() {
    const dots = document.querySelectorAll('.dot');
    const testimonialSection = document.querySelector('.testimonials-section');

    if (!dots.length) return;

    // Add ARIA attributes
    dots.forEach((dot, index) => {
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-label', `Show testimonial ${index + 1}`);
      dot.setAttribute('tabindex', '0');
    });

    function updateActiveDot(index) {
      dots.forEach((dot, i) => {
        dot.classList.toggle('dot--active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    }

    function nextTestimonial() {
      currentTestimonialIndex = (currentTestimonialIndex + 1) % dots.length;
      updateActiveDot(currentTestimonialIndex);
    }

    function prevTestimonial() {
      currentTestimonialIndex = (currentTestimonialIndex - 1 + dots.length) % dots.length;
      updateActiveDot(currentTestimonialIndex);
    }

    function resetInterval() {
      if (testimonialInterval) {
        clearInterval(testimonialInterval);
      }
      // Respect reduced motion - disable auto-advance
      if (!prefersReducedMotion) {
        testimonialInterval = setInterval(nextTestimonial, TESTIMONIAL_INTERVAL_MS);
      }
    }

    // Dot click/keyboard handlers
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        currentTestimonialIndex = index;
        updateActiveDot(index);
        resetInterval();
      });

      dot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          currentTestimonialIndex = index;
          updateActiveDot(index);
          resetInterval();
        }
      });
    });

    // TOUCH SWIPE SUPPORT for mobile
    if (testimonialSection) {
      // Touch handlers
      testimonialSection.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      testimonialSection.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }, { passive: true });

      function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;

        if (Math.abs(swipeDistance) > TOUCH_SWIPE_THRESHOLD) {
          if (swipeDistance > 0) {
            // Swipe right - previous
            prevTestimonial();
          } else {
            // Swipe left - next
            nextTestimonial();
          }
          resetInterval();
        }
      }

      // Pause on hover
      testimonialSection.addEventListener('mouseenter', () => {
        if (testimonialInterval) {
          clearInterval(testimonialInterval);
        }
      });

      testimonialSection.addEventListener('mouseleave', () => {
        resetInterval();
      });
    }

    // Start auto-advance
    resetInterval();
  }

  // ============================================================================
  // VIDEO THUMBNAILS & LOADING STATE
  // ============================================================================

  function initVideoThumbnails() {
    const thumbnails = document.querySelectorAll('.video-thumbnail');
    const mainVideoContainer = document.querySelector('.video-section__main iframe');
    const videoWrapper = document.querySelector('.video-section__main');

    if (!thumbnails.length || !mainVideoContainer) return;

    // Add loading state handler for iframe
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'video-loading';
    loadingIndicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      z-index: 1;
    `;
    loadingIndicator.textContent = 'Loading video...';

    if (videoWrapper) {
      videoWrapper.style.position = 'relative';
      videoWrapper.appendChild(loadingIndicator);
    }

    // Video URLs mapped to thumbnails (in order)
    const videoUrls = [
      'https://players.brightcove.net/5380177764001/default_default/index.html?videoId=6372048292112',
      'https://players.brightcove.net/5380177764001/default_default/index.html?videoId=6372048292112'
    ];

    // Show loading state on iframe load
    mainVideoContainer.addEventListener('load', () => {
      if (loadingIndicator) {
        loadingIndicator.style.opacity = '0';
      }
    });

    thumbnails.forEach((thumbnail, index) => {
      // Add keyboard accessibility
      thumbnail.setAttribute('role', 'button');
      thumbnail.setAttribute('tabindex', '0');
      thumbnail.setAttribute('aria-label', `Play video ${index + 1}`);

      const clickHandler = () => {
        if (mainVideoContainer && videoUrls[index]) {
          // Show loading indicator
          if (loadingIndicator) {
            loadingIndicator.style.opacity = '1';
          }

          // Change iframe source
          mainVideoContainer.src = videoUrls[index];
        }

        // Visual feedback with smooth easing
        if (!prefersReducedMotion) {
          thumbnail.style.transition = `transform 0.2s ${EASING_SMOOTH}, opacity 0.2s ${EASING_SMOOTH}`;
          thumbnail.style.transform = 'scale(0.95)';
          thumbnail.style.opacity = '0.7';

          setTimeout(() => {
            thumbnail.style.transform = 'scale(1)';
            thumbnail.style.opacity = '1';
          }, 200);
        }
      };

      thumbnail.addEventListener('click', clickHandler);
      thumbnail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      });
    });
  }

  // ============================================================================
  // CATEGORY TILE NAVIGATION
  // ============================================================================

  function initCategoryTiles() {
    const categoryTiles = document.querySelectorAll('.category-tile');

    if (!categoryTiles.length) return;

    // Map category tiles to their corresponding sections
    const categoryMapping = [
      { index: 0, section: 'firewalls', name: 'TZ Series' },        // Entry-Level Firewalls
      { index: 1, section: 'firewalls', name: 'NSa Series' },       // Mid-Range Firewalls (NSa section exists)
      { index: 2, section: 'firewalls', name: 'NSsp Series' },      // High-End Firewalls
      { index: 3, section: 'cloud-edge', name: 'Virtual Firewalls' }, // Virtual Firewalls
      { index: 4, section: 'networking', name: 'Switches' },        // Switches & Wireless
      { index: 5, section: 'cloud-edge', name: 'Cloud Edge' }       // Cloud Secure Edge
    ];

    categoryTiles.forEach((tile, index) => {
      // Add keyboard accessibility
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
      const mapping = categoryMapping[index];

      if (mapping) {
        tile.setAttribute('aria-label', `View ${mapping.name} products`);
      }

      // Add smooth hover transitions
      if (!prefersReducedMotion) {
        tile.style.transition = `transform 0.3s ${EASING_SMOOTH}, box-shadow 0.3s ${EASING_SMOOTH}`;
      }

      const clickHandler = () => {
        const mapping = categoryMapping[index];
        if (mapping) {
          const targetSection = document.querySelector(`[data-section="${mapping.section}"]`);
          if (targetSection) {
            smoothScrollTo(targetSection);

            // Update active tab if exists
            const correspondingTab = document.querySelector(`.brand-nav__tab[data-section="${mapping.section}"]`);
            if (correspondingTab) {
              const allTabs = document.querySelectorAll('.brand-nav__tab');
              allTabs.forEach(t => {
                t.classList.remove('brand-nav__tab--active');
                t.setAttribute('aria-selected', 'false');
              });
              correspondingTab.classList.add('brand-nav__tab--active');
              correspondingTab.setAttribute('aria-selected', 'true');
            }
          }
        }
      };

      tile.addEventListener('click', clickHandler);
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      });
    });
  }

  // ============================================================================
  // MOBILE NAVIGATION SCROLL INDICATORS
  // ============================================================================

  function initMobileNavScrollIndicators() {
    const brandNav = document.querySelector('.brand-header__nav');

    if (!brandNav) return;

    const navContainer = brandNav.querySelector('.brand-header__container');
    if (!navContainer) return;

    // Create visual scroll indicators
    const leftIndicator = document.createElement('div');
    leftIndicator.className = 'nav-scroll-indicator nav-scroll-indicator--left';
    leftIndicator.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 40px;
      background: linear-gradient(to right, rgba(255,255,255,0.95), transparent);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 2;
    `;

    const rightIndicator = document.createElement('div');
    rightIndicator.className = 'nav-scroll-indicator nav-scroll-indicator--right';
    rightIndicator.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 40px;
      background: linear-gradient(to left, rgba(255,255,255,0.95), transparent);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 2;
    `;

    brandNav.style.position = 'relative';
    brandNav.appendChild(leftIndicator);
    brandNav.appendChild(rightIndicator);

    const updateScrollIndicators = debounce(() => {
      const isScrollable = navContainer.scrollWidth > navContainer.clientWidth;
      const scrollLeft = navContainer.scrollLeft;
      const maxScroll = navContainer.scrollWidth - navContainer.clientWidth;

      if (isScrollable) {
        // Show left indicator if scrolled right
        leftIndicator.style.opacity = scrollLeft > 10 ? '1' : '0';

        // Show right indicator if not at end
        rightIndicator.style.opacity = scrollLeft < maxScroll - 10 ? '1' : '0';
      } else {
        leftIndicator.style.opacity = '0';
        rightIndicator.style.opacity = '0';
      }
    }, 50);

    navContainer.addEventListener('scroll', updateScrollIndicators, { passive: true });
    window.addEventListener('resize', updateScrollIndicators, { passive: true });

    // Initial check
    requestAnimationFrame(() => {
      updateScrollIndicators();
    });
  }

  // ============================================================================
  // IMAGE ERROR HANDLING
  // ============================================================================

  function initImageErrorHandling() {
    const images = document.querySelectorAll('img');

    images.forEach(img => {
      // Skip if already loaded
      if (img.complete && img.naturalHeight !== 0) return;

      img.addEventListener('error', function() {
        // Add error class for styling
        this.classList.add('image-error');
        this.alt = this.alt || 'Image failed to load';

        // Set a minimal fallback background
        this.style.backgroundColor = '#f0f0f0';
        this.style.minHeight = '200px';
      }, { once: true });
    });
  }

  // ============================================================================
  // LAZY LOADING
  // ============================================================================

  function initLazyLoading() {
    // Add loading="lazy" to images below the fold
    const images = document.querySelectorAll('img:not([loading])');

    images.forEach((img, index) => {
      // First 3 images are likely above fold (hero, story cards)
      if (index > 3) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  function cleanup() {
    // Clear testimonial interval
    if (testimonialInterval) {
      clearInterval(testimonialInterval);
    }

    // Disconnect all observers
    observers.forEach(observer => {
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
      }
    });
  }

  // ============================================================================
  // GLOBAL BUTTON HOVER POLISH
  // ============================================================================

  function initButtonHoverPolish() {
    if (prefersReducedMotion) return;

    const buttons = document.querySelectorAll('button, .btn, .brand-nav__tab, .category-tile');

    buttons.forEach(button => {
      // Skip if already has transition
      const currentTransition = window.getComputedStyle(button).transition;
      if (currentTransition && currentTransition !== 'none' && currentTransition !== 'all 0s ease 0s') return;

      button.style.transition = `all 0.2s ${EASING_SMOOTH}`;
    });
  }

  // ============================================================================
  // HERO WAVE BACKGROUND — Sine-wave displacement on background image
  // ============================================================================

  function initHeroWaveBackground() {
    const hero = document.querySelector('.hero');
    const canvas = document.querySelector('.hero__wave-canvas');
    const bgImage = document.querySelector('.hero__bg-image');

    if (!canvas || !hero || !bgImage) return;

    // Skip if reduced motion preferred
    if (prefersReducedMotion) {
      canvas.style.display = 'none';
      return;
    }

    const ctx = canvas.getContext('2d');
    let animFrameId = null;
    let img = new Image();
    img.crossOrigin = 'anonymous';
    let imageLoaded = false;

    // Wave parameters
    const WAVE_AMPLITUDE = 6;       // How far pixels shift (px)
    const WAVE_FREQUENCY = 0.012;    // Wave tightness
    const WAVE_SPEED = 0.0015;       // How fast waves move
    const SLICE_HEIGHT = 2;          // Draw in 2px horizontal strips
    let time = 0;

    // Mouse interaction — waves intensify near cursor
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    let mouseAmplitudeBoost = 0;
    let targetMouseBoost = 0;

    // Size canvas to hero
    function resizeCanvas() {
      const rect = hero.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 200));

    // Load the hero image for canvas drawing
    // Try crossOrigin first, fall back to non-CORS
    function loadImage() {
      img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = function() {
        imageLoaded = true;
        hero.classList.add('hero--wave-active');
        if (!animFrameId) animate();
      };

      img.onerror = function() {
        // Retry without crossOrigin (some CDNs don't support it)
        const fallbackImg = new Image();
        fallbackImg.onload = function() {
          img = fallbackImg;
          imageLoaded = true;
          hero.classList.add('hero--wave-active');
          if (!animFrameId) animate();
        };
        fallbackImg.onerror = function() {
          // Canvas wave won't work — static image stays visible
          canvas.style.display = 'none';
        };
        fallbackImg.src = bgImage.src;
      };

      img.src = bgImage.src;
    }

    // Wait for the original image to load first
    if (bgImage.complete && bgImage.naturalHeight > 0) {
      loadImage();
    } else {
      bgImage.addEventListener('load', loadImage, { once: true });
      bgImage.addEventListener('error', () => {
        canvas.style.display = 'none';
      }, { once: true });
    }

    // Animation loop — draws image in horizontal slices offset by sine wave
    function animate() {
      if (!imageLoaded) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Smooth mouse tracking
      mouseX += (targetMouseX - mouseX) * 0.03;
      mouseY += (targetMouseY - mouseY) * 0.03;
      mouseAmplitudeBoost += (targetMouseBoost - mouseAmplitudeBoost) * 0.05;

      time += WAVE_SPEED;

      // Calculate image draw dimensions (cover behavior)
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = w / h;
      let drawW, drawH, offsetX, offsetY;

      if (canvasAspect > imgAspect) {
        drawW = w;
        drawH = w / imgAspect;
        offsetX = 0;
        offsetY = (h - drawH) / 2;
      } else {
        drawH = h;
        drawW = h * imgAspect;
        offsetX = (w - drawW) / 2;
        offsetY = 0;
      }

      // Draw image in horizontal slices with sine displacement
      const totalSlices = Math.ceil(h / SLICE_HEIGHT);

      for (let i = 0; i < totalSlices; i++) {
        const y = i * SLICE_HEIGHT;

        // Multiple wave layers for organic motion
        const wave1 = Math.sin(y * WAVE_FREQUENCY + time * 40) * WAVE_AMPLITUDE;
        const wave2 = Math.sin(y * WAVE_FREQUENCY * 0.7 + time * 25 + 1.5) * (WAVE_AMPLITUDE * 0.5);
        const wave3 = Math.sin(y * WAVE_FREQUENCY * 1.3 + time * 55 + 3.0) * (WAVE_AMPLITUDE * 0.3);

        // Mouse proximity boost — waves get stronger near cursor
        const distFromMouse = Math.abs((y / h) - mouseY);
        const proximityFactor = 1 + mouseAmplitudeBoost * (1 - Math.min(distFromMouse * 2.5, 1));

        const xOffset = (wave1 + wave2 + wave3) * proximityFactor;

        // Source rectangle from original image
        const srcY = ((y - offsetY) / drawH) * img.naturalHeight;
        const srcH = (SLICE_HEIGHT / drawH) * img.naturalHeight;

        // Only draw if source is within image bounds
        if (srcY >= 0 && srcY + srcH <= img.naturalHeight) {
          ctx.drawImage(
            img,
            0, srcY, img.naturalWidth, srcH,                          // source
            offsetX + xOffset, y, drawW, SLICE_HEIGHT + 1             // dest (+1 to avoid gaps)
          );
        }
      }

      animFrameId = requestAnimationFrame(animate);
    }

    // Mouse interaction
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      targetMouseX = (e.clientX - rect.left) / rect.width;
      targetMouseY = (e.clientY - rect.top) / rect.height;
      targetMouseBoost = 1.5; // Amplify waves on hover
    });

    hero.addEventListener('mouseleave', () => {
      targetMouseX = 0.5;
      targetMouseY = 0.5;
      targetMouseBoost = 0;
    });

    // Pause when hero not visible (performance)
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!animFrameId && imageLoaded) animate();
        } else {
          if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
          }
        }
      });
    }, { threshold: 0 });

    heroObserver.observe(hero);
    observers.push(heroObserver);
  }

  // ============================================================================
  // COMPARISON TABLE — Column hover highlighting + "See options" scroll targets
  // ============================================================================

  function initComparisonTable() {
    const table = document.querySelector('.comparison-table');

    if (!table) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (!thead || !tbody) return;

    // --- Column hover highlighting ---
    const allRows = table.querySelectorAll('tr');
    const columnCount = thead.querySelectorAll('th').length;

    // Add/remove highlight class on all cells in a column
    function highlightColumn(colIndex, active) {
      allRows.forEach(function(row) {
        const cell = row.children[colIndex];
        if (cell) {
          if (active) {
            cell.style.backgroundColor = 'rgba(255, 110, 66, 0.06)';
          } else {
            cell.style.backgroundColor = '';
          }
        }
      });
    }

    // Attach hover listeners to every cell (skip col 0 — that's the label column)
    allRows.forEach(function(row) {
      Array.from(row.children).forEach(function(cell, colIndex) {
        if (colIndex === 0) return;

        cell.addEventListener('mouseenter', function() {
          highlightColumn(colIndex, true);
        });

        cell.addEventListener('mouseleave', function() {
          highlightColumn(colIndex, false);
        });
      });
    });

    // --- Sticky thead within wrapper on scroll ---
    const wrapper = document.querySelector('.comparison-table-wrapper');

    if (wrapper && thead) {
      wrapper.addEventListener('scroll', function() {
        throttle(function() {
          var scrollTop = wrapper.scrollTop;
          if (scrollTop > 0) {
            thead.style.position = 'sticky';
            thead.style.top = '0';
            thead.style.zIndex = '2';
          }
        });
      }, { passive: true });

      // Set sticky by default (works if wrapper has overflow-y)
      thead.style.position = 'sticky';
      thead.style.top = '0';
      thead.style.zIndex = '2';
    }

    // --- "See options" buttons scroll to product sections ---
    // The last row of the tbody has 4 "See options" buttons
    // Column order: TZ280W, TZ480, NSa 2800, NSa 4800
    var lastRow = tbody.querySelector('tr:last-child');

    if (!lastRow) return;

    var seeOptionsButtons = lastRow.querySelectorAll('.btn--amazon');

    // Map each button to the section it should scroll to
    // Columns 1-2 = TZ series (id="firewalls"), Columns 3-4 = NSa series (class="featured-products--nsa")
    var scrollTargets = [
      function() { return document.getElementById('firewalls'); },             // TZ280W -> TZ section
      function() { return document.getElementById('firewalls'); },             // TZ480 -> TZ section
      function() { return document.querySelector('.featured-products--nsa'); }, // NSa 2800 -> NSa section
      function() { return document.querySelector('.featured-products--nsa'); }  // NSa 4800 -> NSa section
    ];

    seeOptionsButtons.forEach(function(btn, index) {
      if (!scrollTargets[index]) return;

      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent cart counter from firing

        var target = scrollTargets[index]();
        if (target) {
          smoothScrollTo(target);
        }
      });
    });
  }

  // ============================================================================
  // FREQUENTLY BOUGHT TOGETHER — Checkbox interactivity with price recalculation
  // ============================================================================

  function initFrequentlyBoughtTogether() {
    var container = document.querySelector('.frequently-bought-together');

    if (!container) return;

    var checkboxes = container.querySelectorAll('.fbt-checkbox input[type="checkbox"]');
    var products = container.querySelectorAll('.fbt-product');
    var totalPriceEl = container.querySelector('.fbt-price-amount');
    var addToCartBtn = container.querySelector('.fbt-pricing > .btn--amazon');

    if (!checkboxes.length || !totalPriceEl || !addToCartBtn) return;

    // Extract prices from checkbox labels — format: "Product Name - $XX.XX"
    var prices = [];
    checkboxes.forEach(function(checkbox) {
      var label = checkbox.parentElement;
      var text = label ? label.textContent : '';
      var match = text.match(/\$([0-9,]+\.?\d*)/);
      prices.push(match ? parseFloat(match[1].replace(',', '')) : 0);
    });

    function updateFBT() {
      var total = 0;
      var checkedCount = 0;

      checkboxes.forEach(function(checkbox, index) {
        var isChecked = checkbox.checked;

        if (isChecked) {
          total += prices[index];
          checkedCount++;
        }

        // Dim/brighten the corresponding product visual
        var product = products[index];
        if (product) {
          if (isChecked) {
            product.style.opacity = '1';
            product.style.filter = '';
            product.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
          } else {
            product.style.opacity = '0.4';
            product.style.filter = 'grayscale(100%)';
            product.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
          }
        }

        // Also dim/brighten the "+" separator between products
        var plusSigns = container.querySelectorAll('.fbt-plus');
        plusSigns.forEach(function(plus, plusIndex) {
          // Show plus as dimmed if either adjacent product is unchecked
          var leftChecked = checkboxes[plusIndex] ? checkboxes[plusIndex].checked : false;
          var rightChecked = checkboxes[plusIndex + 1] ? checkboxes[plusIndex + 1].checked : false;

          if (leftChecked && rightChecked) {
            plus.style.opacity = '1';
          } else {
            plus.style.opacity = '0.3';
          }
        });
      });

      // Update total price
      totalPriceEl.textContent = '$' + total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

      // Update button text
      if (checkedCount === 0) {
        addToCartBtn.textContent = 'Select items to add';
        addToCartBtn.disabled = true;
        addToCartBtn.style.opacity = '0.5';
        addToCartBtn.style.cursor = 'not-allowed';
      } else {
        addToCartBtn.textContent = checkedCount === checkboxes.length
          ? 'Add all ' + checkboxes.length + ' to Cart'
          : 'Add ' + checkedCount + ' to Cart';
        addToCartBtn.disabled = false;
        addToCartBtn.style.opacity = '';
        addToCartBtn.style.cursor = '';
      }
    }

    // Attach change listeners
    checkboxes.forEach(function(checkbox) {
      checkbox.addEventListener('change', updateFBT);
    });

    // Set initial state (all checked by default from HTML)
    updateFBT();
  }

  // ============================================================================
  // DROPDOWN NAVIGATION — Keyboard, touch & accessibility support
  // ============================================================================

  function initDropdownNavigation() {
    const dropdownWrappers = document.querySelectorAll('.brand-nav__tab-wrapper');

    if (!dropdownWrappers.length) return;

    dropdownWrappers.forEach(wrapper => {
      const tab = wrapper.querySelector('.brand-nav__tab--has-dropdown');
      const dropdown = wrapper.querySelector('.brand-nav__dropdown');

      if (!tab || !dropdown) return;

      // Set ARIA attributes
      tab.setAttribute('aria-haspopup', 'true');
      tab.setAttribute('aria-expanded', 'false');

      // Click toggle (mobile/touch)
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = tab.getAttribute('aria-expanded') === 'true';
        closeAllDropdowns();
        if (!isOpen) {
          tab.setAttribute('aria-expanded', 'true');
          wrapper.classList.add('brand-nav__tab-wrapper--open');
        }
      });

      // Keyboard: Enter/Space toggles, Escape closes, ArrowDown enters dropdown
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = tab.getAttribute('aria-expanded') === 'true';
          closeAllDropdowns();
          if (!isOpen) {
            tab.setAttribute('aria-expanded', 'true');
            wrapper.classList.add('brand-nav__tab-wrapper--open');
            // Focus first dropdown link
            const firstLink = dropdown.querySelector('.brand-nav__dropdown-link');
            if (firstLink) firstLink.focus();
          }
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          tab.setAttribute('aria-expanded', 'true');
          wrapper.classList.add('brand-nav__tab-wrapper--open');
          const firstLink = dropdown.querySelector('.brand-nav__dropdown-link');
          if (firstLink) firstLink.focus();
        }
      });

      // Arrow key navigation within dropdown items
      const links = dropdown.querySelectorAll('.brand-nav__dropdown-link');
      links.forEach((link, linkIndex) => {
        link.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = links[linkIndex + 1] || links[0];
            next.focus();
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = links[linkIndex - 1] || links[links.length - 1];
            prev.focus();
          }
          if (e.key === 'Escape') {
            closeAllDropdowns();
            tab.focus();
          }
        });

        // Dropdown link clicks — scroll to section and close
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetSection = link.getAttribute('data-section');
          if (targetSection) {
            const section = document.querySelector(`section[data-section="${targetSection}"], [data-section="${targetSection}"]`);
            if (section && section.tagName !== 'A' && section.tagName !== 'BUTTON') {
              smoothScrollTo(section);
            }
          }
          closeAllDropdowns();
        });
      });
    });

    // Close all dropdowns
    function closeAllDropdowns() {
      dropdownWrappers.forEach(wrapper => {
        const tab = wrapper.querySelector('.brand-nav__tab--has-dropdown');
        if (tab) tab.setAttribute('aria-expanded', 'false');
        wrapper.classList.remove('brand-nav__tab-wrapper--open');
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.brand-nav__tab-wrapper')) {
        closeAllDropdowns();
      }
    });

    // Close on Escape (global)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllDropdowns();
    });
  }

  // ============================================================================
  // MODERN BUTTON RIPPLE EFFECT
  // ============================================================================

  function initButtonRippleEffect() {
    if (prefersReducedMotion) return;

    const buttons = document.querySelectorAll('.btn--modern, .btn--gradient, .btn--outline-dark, .btn--outline-light');

    if (!buttons.length) return;

    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
          position: absolute;
          width: ${size}px; height: ${size}px;
          left: ${x}px; top: ${y}px;
          background: rgba(255,255,255,0.3);
          border-radius: 50%;
          transform: scale(0);
          animation: rippleEffect 0.6s ease-out;
          pointer-events: none;
        `;

        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
      });
    });

    // Add ripple keyframes if not already present
    if (!document.querySelector('#ripple-styles')) {
      const style = document.createElement('style');
      style.id = 'ripple-styles';
      style.textContent = `
        @keyframes rippleEffect {
          to { transform: scale(4); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ============================================================================
  // PRODUCT CARD HOVER ENHANCEMENT — Image zoom on hover
  // ============================================================================

  function initProductCardEnhancements() {
    if (prefersReducedMotion) return;

    const cards = document.querySelectorAll('.product-card');

    if (!cards.length) return;

    cards.forEach(card => {
      const img = card.querySelector('.product-card__image img, .product-card__image');

      if (img) {
        card.addEventListener('mouseenter', () => {
          img.style.transition = `transform 0.4s ${EASING_SMOOTH}`;
          img.style.transform = 'scale(1.05)';
        });

        card.addEventListener('mouseleave', () => {
          img.style.transform = 'scale(1)';
        });
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    initTabNavigation();
    initDropdownNavigation();
    initProductToggles();
    initScrollAnimations();
    initStickyHeader();
    initBackToTop();
    initCartCounter();
    initTestimonialCarousel();
    initVideoThumbnails();
    initCategoryTiles();
    initMobileNavScrollIndicators();
    initImageErrorHandling();
    initLazyLoading();
    initButtonHoverPolish();
    initButtonRippleEffect();
    initHeroWaveBackground();
    initComparisonTable();
    initFrequentlyBoughtTogether();
    initProductCardEnhancements();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

})();
