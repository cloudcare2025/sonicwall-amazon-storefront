/**
 * SonicWall Amazon Storefront - Main TypeScript
 * Round 4: Dropdown nav + button ripple + product card hover + enhanced scroll selectors
 */

// Interfaces & Types
// ============================================================================

interface ToggleConfig {
  readonly buttonId: string;
  readonly containerId: string;
}

interface CategoryMapping {
  readonly index: number;
  readonly section: string;
  readonly name: string;
}

type ScrollTargetResolver = () => HTMLElement | null;

type DebouncedFunction<T extends (...args: never[]) => void> = (...args: Parameters<T>) => void;

// ============================================================================
// IIFE — Keeps all state private, identical runtime behavior to original JS
// ============================================================================

(function (): void {

  // ==========================================================================
  // STATE & CONFIGURATION
  // ==========================================================================

  let currentTestimonialIndex: number = 0;
  let testimonialInterval: ReturnType<typeof setInterval> | null = null;
  let touchStartX: number = 0;
  let touchEndX: number = 0;

  const TESTIMONIAL_INTERVAL_MS = 5000 as const;
  const SCROLL_OBSERVER_THRESHOLD = 0.15 as const;
  const CART_ANIMATION_DURATION = 300 as const;
  const STICKY_HEADER_HEIGHT = 84 as const;
  const PRODUCT_STAGGER_DELAY = 100 as const;
  const TOUCH_SWIPE_THRESHOLD = 75 as const;
  const EASING_BOUNCE: string = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const EASING_SMOOTH: string = 'cubic-bezier(0.4, 0, 0.2, 1)';

  // Store observers for cleanup
  const observers: IntersectionObserver[] = [];

  // Detect reduced motion preference (live — updates if user changes setting)
  let prefersReducedMotion: boolean = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionQuery: MediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', (e: MediaQueryListEvent): void => {
    prefersReducedMotion = e.matches;
  });

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Returns a scoped rAF-based throttle function.
   * Each call to createThrottle() produces an independent gate,
   * so multiple consumers (sticky header, comparison table, etc.)
   * never block each other.
   */
  function createThrottle(): (callback: () => void) => void {
    let ticking: boolean = false;
    return function throttle(callback: () => void): void {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame((): void => {
        callback();
        ticking = false;
      });
    };
  }

  function smoothScrollTo(element: Element, offset: number = STICKY_HEADER_HEIGHT): void {
    if (!element) return;

    const elementPosition: number = element.getBoundingClientRect().top + window.scrollY;
    const offsetPosition: number = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  function debounce<T extends (...args: never[]) => void>(func: T, wait: number): DebouncedFunction<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function executedFunction(this: unknown, ...args: Parameters<T>): void {
      const later = (): void => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ==========================================================================
  // TAB NAVIGATION
  // ==========================================================================

  function initTabNavigation(): void {
    const tabs: NodeListOf<Element> = document.querySelectorAll('.brand-nav__tab');
    // Only observe actual page sections, not nav elements that happen to have data-section
    const sections: NodeListOf<Element> = document.querySelectorAll(
      'section[data-section], div[data-section]:not(.brand-nav__tab):not(.brand-nav__dropdown-link)'
    );

    if (!tabs.length) return;

    // Add tablist role to the container
    const tabContainer: HTMLElement | null = document.querySelector('.brand-header__nav, .brand-nav');
    if (tabContainer) {
      tabContainer.setAttribute('role', 'tablist');
    }

    // Add keyboard navigation support with roving tabindex
    tabs.forEach((tab: Element, index: number): void => {
      tab.setAttribute('role', 'tab');
      // Only the active tab (or first tab if none active) gets tabindex 0
      const isActive: boolean = tab.classList.contains('brand-nav__tab--active');
      tab.setAttribute('tabindex', isActive || (index === 0 && !document.querySelector('.brand-nav__tab--active')) ? '0' : '-1');

      // Click handler
      tab.addEventListener('click', (e: Event): void => {
        const href: string | null = (tab as HTMLAnchorElement).getAttribute('href');
        // If href points to another page, allow default browser navigation
        if (href && !href.startsWith('#')) {
          const currentPage: string = window.location.pathname.split('/').pop() || 'index.html';
          const linkPage: string = href.split('#')[0];
          if (linkPage && linkPage !== currentPage) {
            return; // Allow navigation to other page
          }
        }
        e.preventDefault();
        activateTab(tab);
      });

      // Keyboard handler
      tab.addEventListener('keydown', (e: Event): void => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          activateTab(tab);
        }

        // Arrow key navigation with roving tabindex
        if (keyEvent.key === 'ArrowRight') {
          keyEvent.preventDefault();
          const nextTab: Element = tabs[index + 1] || tabs[0];
          tab.setAttribute('tabindex', '-1');
          nextTab.setAttribute('tabindex', '0');
          (nextTab as HTMLElement).focus();
        }
        if (keyEvent.key === 'ArrowLeft') {
          keyEvent.preventDefault();
          const prevTab: Element = tabs[index - 1] || tabs[tabs.length - 1];
          tab.setAttribute('tabindex', '-1');
          prevTab.setAttribute('tabindex', '0');
          (prevTab as HTMLElement).focus();
        }
      });
    });

    function activateTab(tab: Element): void {
      const targetSection: string | null = tab.getAttribute('data-section');

      // Update active tab with roving tabindex
      tabs.forEach((t: Element): void => {
        t.classList.remove('brand-nav__tab--active');
        t.setAttribute('aria-selected', 'false');
        t.setAttribute('tabindex', '-1');
      });
      tab.classList.add('brand-nav__tab--active');
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');

      // Scroll to section (use specific selector to avoid matching nav elements)
      if (targetSection) {
        const section: Element | null = document.querySelector(
          `section[data-section="${targetSection}"], div[data-section="${targetSection}"]:not(.brand-nav__tab)`
        );
        if (section) {
          smoothScrollTo(section);
        }
      }
    }

    // Update active tab on scroll with improved threshold
    const sectionObserver: IntersectionObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => {
        entries.forEach((entry: IntersectionObserverEntry): void => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const sectionName: string | null = entry.target.getAttribute('data-section');
            const activeTab: Element | null = document.querySelector(
              `.brand-nav__tab[data-section="${sectionName}"]`
            );

            if (activeTab) {
              tabs.forEach((t: Element): void => {
                t.classList.remove('brand-nav__tab--active');
                t.setAttribute('aria-selected', 'false');
                t.setAttribute('tabindex', '-1');
              });
              activeTab.classList.add('brand-nav__tab--active');
              activeTab.setAttribute('aria-selected', 'true');
              activeTab.setAttribute('tabindex', '0');
            }
          }
        });
      },
      {
        threshold: [0.5, 0.75],
        rootMargin: `-${STICKY_HEADER_HEIGHT + 20}px 0px -30% 0px`
      }
    );

    sections.forEach((section: Element): void => {
      sectionObserver.observe(section);
    });

    observers.push(sectionObserver);

    // HANDLE INITIAL SCROLL POSITION - Set correct active tab on page load
    function setInitialActiveTab(): void {
      const scrollY: number = window.scrollY;

      // If page is scrolled on load, find which section is visible
      if (scrollY > 100) {
        let activeSection: Element | null = null;
        let maxVisibility: number = 0;

        sections.forEach((section: Element): void => {
          const rect: DOMRect = section.getBoundingClientRect();
          const viewportHeight: number = window.innerHeight;
          const visibleHeight: number = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
          const visibilityRatio: number = visibleHeight / viewportHeight;

          if (visibilityRatio > maxVisibility) {
            maxVisibility = visibilityRatio;
            activeSection = section;
          }
        });

        if (activeSection) {
          const sectionName: string | null = (activeSection as Element).getAttribute('data-section');
          const correspondingTab: Element | null = document.querySelector(
            `.brand-nav__tab[data-section="${sectionName}"]`
          );

          if (correspondingTab) {
            tabs.forEach((t: Element): void => {
              t.classList.remove('brand-nav__tab--active');
              t.setAttribute('aria-selected', 'false');
              t.setAttribute('tabindex', '-1');
            });
            correspondingTab.classList.add('brand-nav__tab--active');
            correspondingTab.setAttribute('aria-selected', 'true');
            correspondingTab.setAttribute('tabindex', '0');
          }
        }
      }
    }

    // Run on load and after a brief delay to handle browser scroll restoration
    setInitialActiveTab();
    setTimeout(setInitialActiveTab, 100);
  }

  // ==========================================================================
  // "SEE MORE PRODUCTS" TOGGLE
  // ==========================================================================

  function initProductToggles(): void {
    const toggleConfigs: readonly ToggleConfig[] = [
      { buttonId: 'tz-see-more', containerId: 'tz-products' },
      { buttonId: 'nsa-see-more', containerId: 'nsa-products' }
    ];

    toggleConfigs.forEach(({ buttonId, containerId }: ToggleConfig): void => {
      const button: HTMLElement | null = document.getElementById(buttonId);
      const container: HTMLElement | null = document.getElementById(containerId);

      if (!button || !container) return;

      const gen7Products: NodeListOf<Element> = container.querySelectorAll('.product-card--gen7');
      let isExpanded: boolean = false;
      let isAnimating: boolean = false;

      // Set initial ARIA state
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', containerId);

      // Click handler — isAnimating guard prevents double-fire (no debounce needed)
      const handleToggle = (): void => {
        if (isAnimating) return;
        isAnimating = true;

        isExpanded = !isExpanded;
        button.setAttribute('aria-expanded', isExpanded.toString());
        (button as HTMLButtonElement).disabled = true; // Disable during animation

        if (isExpanded) {
          // Batch all display changes first to avoid layout thrashing
          gen7Products.forEach((card: Element): void => {
            (card as HTMLElement).style.display = 'block';
          });

          // Read layout ONCE after all display changes are applied
          const parent: HTMLElement | null = gen7Products.length
            ? (gen7Products[0] as HTMLElement).parentElement
            : null;
          const computedStyle: CSSStyleDeclaration | null = parent
            ? window.getComputedStyle(parent)
            : null;
          const colString: string = computedStyle?.gridTemplateColumns || '';
          const gridCols: number = colString ? colString.split(' ').length : 5;

          // Show products with grid-aware staggered animation
          gen7Products.forEach((card: Element, cardIndex: number): void => {
            const htmlCard = card as HTMLElement;
            const columnIndex: number = cardIndex % gridCols;

            setTimeout((): void => {
              if (prefersReducedMotion) {
                htmlCard.style.opacity = '1';
                htmlCard.style.transform = 'translateY(0)';
              } else {
                htmlCard.classList.add('fade-in-up', 'visible');
              }
            }, columnIndex * PRODUCT_STAGGER_DELAY);
          });

          button.textContent = 'Show fewer products';

          // Re-enable button after all column animations finish
          const maxDelay: number = ((gridCols - 1) * PRODUCT_STAGGER_DELAY) + 400;
          setTimeout((): void => {
            isAnimating = false;
            (button as HTMLButtonElement).disabled = false;
          }, maxDelay);

        } else {
          // Hide products with reverse stagger
          const totalCards: number = gen7Products.length;
          const lastCardDelay: number = (totalCards - 1) * 40;

          gen7Products.forEach((card: Element, index: number): void => {
            const htmlCard = card as HTMLElement;
            setTimeout((): void => {
              htmlCard.classList.remove('visible');
              if (prefersReducedMotion) {
                // Reset inline styles set during expand
                htmlCard.style.opacity = '';
                htmlCard.style.transform = '';
                htmlCard.style.display = 'none';
              }
            }, index * 40);
          });

          button.textContent = 'See more products';

          // Re-enable AFTER all individual card animations complete
          const hideDelay: number = Math.max(lastCardDelay + 300, 500);
          setTimeout((): void => {
            gen7Products.forEach((card: Element): void => {
              const htmlCard = card as HTMLElement;
              htmlCard.style.display = 'none';
              // Reset stale inline styles so next expand starts clean
              htmlCard.style.opacity = '';
              htmlCard.style.transform = '';
            });
            isAnimating = false;
            (button as HTMLButtonElement).disabled = false;
          }, hideDelay);
        }
      };

      button.addEventListener('click', handleToggle);
    });
  }

  // ==========================================================================
  // SCROLL ANIMATIONS
  // ==========================================================================

  function initScrollAnimations(): void {
    const animatedElements: NodeListOf<Element> = document.querySelectorAll(
      '.story-card, .category-tile, .product-card:not(.product-card--gen7), .stat-item, .testimonial, .peace-of-mind, .contact-cta, .from-manufacturer__item, .cert-badge, .category-banner, .btn--modern, .btn--gradient'
    );

    if (!animatedElements.length) return;

    // Skip animations if reduced motion is preferred
    if (prefersReducedMotion) {
      animatedElements.forEach((element: Element): void => {
        const htmlEl = element as HTMLElement;
        htmlEl.style.opacity = '1';
        htmlEl.style.transform = 'none';
      });
      return;
    }

    // WRITE PASS: add fade-in-up class to all elements first
    animatedElements.forEach((element: Element): void => {
      (element as HTMLElement).classList.add('fade-in-up');
    });

    // READ PASS: calculate grid-aware stagger delays (separated to prevent layout thrashing)
    requestAnimationFrame((): void => {
      animatedElements.forEach((element: Element): void => {
        const htmlEl = element as HTMLElement;
        const parent: HTMLElement | null = htmlEl.parentElement;

        if (parent?.classList.contains('story-cards') ||
            parent?.classList.contains('category-grid') ||
            parent?.classList.contains('product-grid') ||
            parent?.classList.contains('stats-grid') ||
            parent?.classList.contains('from-manufacturer__grid') ||
            parent?.classList.contains('certifications-bar__badges')) {

          // Get all visible siblings (not display:none)
          const siblings: Element[] = Array.from(parent.children).filter((child: Element): boolean => {
            return window.getComputedStyle(child).display !== 'none';
          });

          const siblingIndex: number = siblings.indexOf(element);

          // Calculate column position for responsive grids
          const computedStyle: CSSStyleDeclaration = window.getComputedStyle(parent);
          const colString: string = computedStyle.gridTemplateColumns || '';
          const gridCols: number = colString ? colString.split(' ').length : 3;
          const columnIndex: number = siblingIndex % gridCols;

          // Stagger by column position (not total index)
          htmlEl.style.transitionDelay = `${columnIndex * 0.08}s`;
        }
      });
    });

    // IntersectionObserver for triggering animations
    const observer: IntersectionObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => {
        entries.forEach((entry: IntersectionObserverEntry): void => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: SCROLL_OBSERVER_THRESHOLD,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    animatedElements.forEach((element: Element): void => observer.observe(element));
    observers.push(observer);

    // HANDLE INITIAL VIEWPORT - Trigger animations for elements already visible on page load
    requestAnimationFrame((): void => {
      animatedElements.forEach((element: Element): void => {
        const rect: DOMRect = element.getBoundingClientRect();
        const isInViewport: boolean = rect.top < window.innerHeight && rect.bottom > 0;

        if (isInViewport) {
          element.classList.add('visible');
        }
      });
    });
  }

  // ==========================================================================
  // STICKY BRAND HEADER
  // ==========================================================================

  function initStickyHeader(): void {
    const brandHeaderEl: HTMLElement | null = document.querySelector('.brand-header');
    const amazonHeader: HTMLElement | null = document.querySelector('.amazon-header');

    if (!brandHeaderEl || !amazonHeader) return;
    const brandHeader: HTMLElement = brandHeaderEl;

    // Cache measurements — recalculated on resize
    let stickyThreshold: number = amazonHeader.offsetHeight;
    let brandHeaderHeight: number = brandHeader.offsetHeight;
    let isSticky: boolean = false;

    const throttle = createThrottle();

    // Apply sticky styles via JS since no CSS rule exists for brand-header--sticky
    function applySticky(): void {
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

    function removeSticky(): void {
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

    const handleScroll = (): void => {
      throttle((): void => {
        if (window.scrollY > stickyThreshold) {
          applySticky();
        } else {
          removeSticky();
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Recalculate cached measurements on resize
    const handleResize = debounce((): void => {
      const wasSticky: boolean = isSticky;
      if (wasSticky) removeSticky();
      stickyThreshold = amazonHeader.offsetHeight;
      brandHeaderHeight = brandHeader.offsetHeight;
      if (wasSticky && window.scrollY > stickyThreshold) applySticky();
    }, 200);
    window.addEventListener('resize', handleResize as EventListener, { passive: true });

    // Check on init in case page loaded already scrolled
    if (window.scrollY > stickyThreshold) {
      applySticky();
    }
  }

  // ==========================================================================
  // BACK TO TOP
  // ==========================================================================

  function initBackToTop(): void {
    const backToTopLink: Element | null = document.querySelector('.footer__back-to-top-link');

    if (!backToTopLink) return;

    backToTopLink.addEventListener('click', (e: Event): void => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ==========================================================================
  // CART COUNTER ANIMATION
  // ==========================================================================

  function initCartCounter(): void {
    const cartCount: HTMLElement | null = document.querySelector('.amazon-header__cart-count');
    // Only target "Add to Cart" buttons in product cards and FBT,
    // NOT the comparison table "See options" buttons
    const optionButtons: NodeListOf<Element> = document.querySelectorAll(
      '.product-card .btn--amazon, .fbt-pricing > .btn--amazon'
    );

    if (!cartCount || !optionButtons.length) return;

    let currentCount: number = parseInt(cartCount.textContent ?? '0', 10) || 0;

    // Provide a live region for screen readers
    cartCount.setAttribute('aria-live', 'polite');
    cartCount.setAttribute('aria-atomic', 'true');

    optionButtons.forEach((button: Element): void => {
      button.addEventListener('click', (e: Event): void => {
        e.preventDefault();
        currentCount++;
        cartCount.textContent = String(currentCount);

        if (prefersReducedMotion) {
          // Simple color flash only
          cartCount.style.color = '#ff9900';
          setTimeout((): void => {
            cartCount.style.color = '';
          }, CART_ANIMATION_DURATION);
        } else {
          // Premium bounce animation with proper easing
          cartCount.style.transition = `transform 0.15s ${EASING_BOUNCE}, color 0.15s ${EASING_SMOOTH}`;
          cartCount.style.transform = 'scale(1.15)';
          cartCount.style.color = '#ff9900';

          setTimeout((): void => {
            cartCount.style.transform = 'scale(1)';
            cartCount.style.color = '';
          }, CART_ANIMATION_DURATION);
        }
      });
    });
  }

  // ==========================================================================
  // TESTIMONIAL CAROUSEL
  // ==========================================================================

  function initTestimonialCarousel(): void {
    const dots: NodeListOf<Element> = document.querySelectorAll('.dot');
    const testimonialSection: Element | null = document.querySelector('.testimonials-section');

    if (!dots.length) return;

    // Add ARIA attributes -- dots act as tab-like controls
    const dotsContainer: HTMLElement | null = document.querySelector('.dots-container, .testimonial-dots');
    if (dotsContainer) {
      dotsContainer.setAttribute('role', 'tablist');
      dotsContainer.setAttribute('aria-label', 'Testimonial navigation');
    }

    dots.forEach((dot: Element, index: number): void => {
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Show testimonial ${index + 1}`);
      dot.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    function updateActiveDot(index: number): void {
      dots.forEach((dot: Element, i: number): void => {
        dot.classList.toggle('dot--active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
        dot.setAttribute('tabindex', i === index ? '0' : '-1');
      });
    }

    function nextTestimonial(): void {
      currentTestimonialIndex = (currentTestimonialIndex + 1) % dots.length;
      updateActiveDot(currentTestimonialIndex);
    }

    function prevTestimonial(): void {
      currentTestimonialIndex = (currentTestimonialIndex - 1 + dots.length) % dots.length;
      updateActiveDot(currentTestimonialIndex);
    }

    function resetInterval(): void {
      if (testimonialInterval) {
        clearInterval(testimonialInterval);
      }
      // Respect reduced motion - disable auto-advance
      if (!prefersReducedMotion) {
        testimonialInterval = setInterval(nextTestimonial, TESTIMONIAL_INTERVAL_MS);
      }
    }

    // Dot click/keyboard handlers
    dots.forEach((dot: Element, index: number): void => {
      dot.addEventListener('click', (): void => {
        currentTestimonialIndex = index;
        updateActiveDot(index);
        resetInterval();
      });

      dot.addEventListener('keydown', (e: Event): void => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          currentTestimonialIndex = index;
          updateActiveDot(index);
          resetInterval();
        }
        // Arrow key navigation between dots
        if (keyEvent.key === 'ArrowRight') {
          keyEvent.preventDefault();
          const nextIndex: number = (index + 1) % dots.length;
          (dots[nextIndex] as HTMLElement).focus();
          currentTestimonialIndex = nextIndex;
          updateActiveDot(nextIndex);
          resetInterval();
        }
        if (keyEvent.key === 'ArrowLeft') {
          keyEvent.preventDefault();
          const prevIndex: number = (index - 1 + dots.length) % dots.length;
          (dots[prevIndex] as HTMLElement).focus();
          currentTestimonialIndex = prevIndex;
          updateActiveDot(prevIndex);
          resetInterval();
        }
      });
    });

    // TOUCH SWIPE SUPPORT for mobile
    if (testimonialSection) {
      // Touch handlers
      testimonialSection.addEventListener('touchstart', (e: Event): void => {
        const touchEvent = e as TouchEvent;
        touchStartX = touchEvent.changedTouches[0].screenX;
      }, { passive: true });

      testimonialSection.addEventListener('touchend', (e: Event): void => {
        const touchEvent = e as TouchEvent;
        touchEndX = touchEvent.changedTouches[0].screenX;
        handleSwipe();
      }, { passive: true });

      function handleSwipe(): void {
        const swipeDistance: number = touchEndX - touchStartX;

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
      testimonialSection.addEventListener('mouseenter', (): void => {
        if (testimonialInterval) {
          clearInterval(testimonialInterval);
        }
      });

      testimonialSection.addEventListener('mouseleave', (): void => {
        resetInterval();
      });
    }

    // Start auto-advance
    resetInterval();
  }

  // ==========================================================================
  // VIDEO THUMBNAILS & LOADING STATE
  // ==========================================================================

  function initVideoThumbnails(): void {
    const thumbnails: NodeListOf<Element> = document.querySelectorAll('.video-thumbnail');
    const mainVideoContainer: HTMLIFrameElement | null = document.querySelector('.video-section__main iframe');
    const videoWrapper: HTMLElement | null = document.querySelector('.video-section__main');

    if (!thumbnails.length || !mainVideoContainer) return;

    // Add loading state handler for iframe
    const loadingIndicator: HTMLDivElement = document.createElement('div');
    loadingIndicator.className = 'video-loading';
    loadingIndicator.setAttribute('aria-hidden', 'true');
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
    const videoUrls: readonly string[] = [
      'https://players.brightcove.net/5380177764001/default_default/index.html?videoId=6372048292112',
      'https://players.brightcove.net/5380177764001/default_default/index.html?videoId=6372048292112'
    ];

    // Show loading state on iframe load
    mainVideoContainer.addEventListener('load', (): void => {
      loadingIndicator.style.opacity = '0';
    });

    thumbnails.forEach((thumbnail: Element, index: number): void => {
      const htmlThumbnail = thumbnail as HTMLElement;

      // Add keyboard accessibility
      htmlThumbnail.setAttribute('role', 'button');
      htmlThumbnail.setAttribute('tabindex', '0');
      htmlThumbnail.setAttribute('aria-label', `Play video ${index + 1}`);

      const clickHandler = (): void => {
        if (mainVideoContainer && videoUrls[index]) {
          // Show loading indicator
          loadingIndicator.style.opacity = '1';

          // Change iframe source
          mainVideoContainer.src = videoUrls[index];
        }

        // Visual feedback with smooth easing
        if (!prefersReducedMotion) {
          htmlThumbnail.style.transition = `transform 0.2s ${EASING_SMOOTH}, opacity 0.2s ${EASING_SMOOTH}`;
          htmlThumbnail.style.transform = 'scale(0.95)';
          htmlThumbnail.style.opacity = '0.7';

          setTimeout((): void => {
            htmlThumbnail.style.transform = 'scale(1)';
            htmlThumbnail.style.opacity = '1';
          }, 200);
        }
      };

      htmlThumbnail.addEventListener('click', clickHandler);
      htmlThumbnail.addEventListener('keydown', (e: Event): void => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          clickHandler();
        }
      });
    });
  }

  // ==========================================================================
  // CATEGORY TILE NAVIGATION
  // ==========================================================================

  function initCategoryTiles(): void {
    const categoryTiles: NodeListOf<Element> = document.querySelectorAll('.category-tile');

    if (!categoryTiles.length) return;

    // Map category tiles to their corresponding sections
    const categoryMapping: readonly CategoryMapping[] = [
      { index: 0, section: 'firewalls', name: 'TZ Series' },        // Entry-Level Firewalls
      { index: 1, section: 'firewalls', name: 'NSa Series' },       // Mid-Range Firewalls (NSa section exists)
      { index: 2, section: 'firewalls', name: 'NSsp Series' },      // High-End Firewalls
      { index: 3, section: 'cloud-edge', name: 'Virtual Firewalls' }, // Virtual Firewalls
      { index: 4, section: 'networking', name: 'Switches' },        // Switches & Wireless
      { index: 5, section: 'cloud-edge', name: 'Cloud Edge' }       // Cloud Secure Edge
    ];

    categoryTiles.forEach((tile: Element, index: number): void => {
      const htmlTile = tile as HTMLElement;

      // Add keyboard accessibility
      htmlTile.setAttribute('role', 'button');
      htmlTile.setAttribute('tabindex', '0');
      const mapping: CategoryMapping | undefined = categoryMapping[index];

      if (mapping) {
        htmlTile.setAttribute('aria-label', `View ${mapping.name} products`);
      }

      // Add smooth hover transitions
      if (!prefersReducedMotion) {
        htmlTile.style.transition = `transform 0.3s ${EASING_SMOOTH}, box-shadow 0.3s ${EASING_SMOOTH}`;
      }

      const clickHandler = (): void => {
        const tileMapping: CategoryMapping | undefined = categoryMapping[index];
        if (tileMapping) {
          const targetSection: Element | null = document.querySelector(
            `[data-section="${tileMapping.section}"]`
          );
          if (targetSection) {
            smoothScrollTo(targetSection);

            // Update active tab if exists
            const correspondingTab: Element | null = document.querySelector(
              `.brand-nav__tab[data-section="${tileMapping.section}"]`
            );
            if (correspondingTab) {
              const allTabs: NodeListOf<Element> = document.querySelectorAll('.brand-nav__tab');
              allTabs.forEach((t: Element): void => {
                t.classList.remove('brand-nav__tab--active');
                t.setAttribute('aria-selected', 'false');
              });
              correspondingTab.classList.add('brand-nav__tab--active');
              correspondingTab.setAttribute('aria-selected', 'true');
            }
          }
        }
      };

      htmlTile.addEventListener('click', clickHandler);
      htmlTile.addEventListener('keydown', (e: Event): void => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          clickHandler();
        }
      });
    });
  }

  // ==========================================================================
  // MOBILE NAVIGATION SCROLL INDICATORS
  // ==========================================================================

  function initMobileNavScrollIndicators(): void {
    const brandNav: HTMLElement | null = document.querySelector('.brand-header__nav');

    if (!brandNav) return;

    const navContainerMaybe: HTMLElement | null = brandNav.querySelector('.brand-header__container');
    if (!navContainerMaybe) return;
    const navContainer: HTMLElement = navContainerMaybe;

    // Create visual scroll indicators
    const leftIndicator: HTMLDivElement = document.createElement('div');
    leftIndicator.className = 'nav-scroll-indicator nav-scroll-indicator--left';
    leftIndicator.setAttribute('aria-hidden', 'true');
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

    const rightIndicator: HTMLDivElement = document.createElement('div');
    rightIndicator.className = 'nav-scroll-indicator nav-scroll-indicator--right';
    rightIndicator.setAttribute('aria-hidden', 'true');
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

    // Use rAF-based throttle for smooth indicator updates during scroll
    const scrollThrottle = createThrottle();

    function updateScrollIndicators(): void {
      const isScrollable: boolean = navContainer.scrollWidth > navContainer.clientWidth;
      const scrollLeft: number = navContainer.scrollLeft;
      const maxScroll: number = navContainer.scrollWidth - navContainer.clientWidth;

      if (isScrollable) {
        // Show left indicator if scrolled right
        leftIndicator.style.opacity = scrollLeft > 10 ? '1' : '0';

        // Show right indicator if not at end
        rightIndicator.style.opacity = scrollLeft < maxScroll - 10 ? '1' : '0';
      } else {
        leftIndicator.style.opacity = '0';
        rightIndicator.style.opacity = '0';
      }
    }

    navContainer.addEventListener('scroll', (): void => {
      scrollThrottle(updateScrollIndicators);
    }, { passive: true });

    window.addEventListener('resize', (): void => {
      scrollThrottle(updateScrollIndicators);
    }, { passive: true });

    // Initial check -- call directly, no delay needed
    requestAnimationFrame(updateScrollIndicators);
  }

  // ==========================================================================
  // IMAGE ERROR HANDLING
  // ==========================================================================

  function initImageErrorHandling(): void {
    const images: NodeListOf<HTMLImageElement> = document.querySelectorAll('img');

    images.forEach((img: HTMLImageElement): void => {
      // Skip if already loaded
      if (img.complete && img.naturalHeight !== 0) return;

      img.addEventListener('error', function (this: HTMLImageElement): void {
        // Add error class for styling
        this.classList.add('image-error');
        this.alt = this.alt || 'Image failed to load';

        // Set a minimal fallback background
        this.style.backgroundColor = '#f0f0f0';
        this.style.minHeight = '200px';
      }, { once: true });
    });
  }

  // ==========================================================================
  // LAZY LOADING
  // ==========================================================================

  function initLazyLoading(): void {
    // Add loading="lazy" to images below the fold
    const images: NodeListOf<HTMLImageElement> = document.querySelectorAll('img:not([loading])');

    images.forEach((img: HTMLImageElement, index: number): void => {
      // First 3 images are likely above fold (hero, story cards)
      if (index > 3) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  function cleanup(): void {
    // Clear testimonial interval
    if (testimonialInterval) {
      clearInterval(testimonialInterval);
    }

    // Disconnect all observers
    observers.forEach((observer: IntersectionObserver): void => {
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
      }
    });
  }

  // ==========================================================================
  // GLOBAL BUTTON HOVER POLISH
  // ==========================================================================

  function initButtonHoverPolish(): void {
    if (prefersReducedMotion) return;

    const buttons: NodeListOf<Element> = document.querySelectorAll(
      'button, .btn, .brand-nav__tab, .category-tile'
    );

    buttons.forEach((button: Element): void => {
      const htmlButton = button as HTMLElement;

      // Skip if already has transition
      const currentTransition: string = window.getComputedStyle(htmlButton).transition;
      if (currentTransition && currentTransition !== 'none' && currentTransition !== 'all 0s ease 0s') return;

      // Only animate visual properties -- avoid 'all' which can cause layout jank
      htmlButton.style.transition = `opacity 0.2s ${EASING_SMOOTH}, box-shadow 0.2s ${EASING_SMOOTH}, background-color 0.2s ${EASING_SMOOTH}, color 0.2s ${EASING_SMOOTH}, border-color 0.2s ${EASING_SMOOTH}`;
    });
  }

  // ==========================================================================
  // HERO VIDEO BACKGROUND -- Auto-playing looping video
  // ==========================================================================

  function initHeroVideo(): void {
    const videoEl: HTMLVideoElement | null = document.querySelector('.hero__bg-video');
    if (!videoEl) return;
    const video: HTMLVideoElement = videoEl;

    // Deferred video loading: wait 3s or first user interaction, whichever comes first.
    // Video has preload="none" so the poster image shows immediately without competing bandwidth.
    function loadAndPlay(): void {
      if (video.preload !== 'none') return; // Already loaded
      video.preload = 'auto';
      video.load();
      video.play().catch((): void => {
        // Autoplay blocked -- poster image shown as fallback
      });
    }

    const timer: ReturnType<typeof setTimeout> = setTimeout(loadAndPlay, 3000);

    const interactionEvents: readonly string[] = ['scroll', 'mousemove', 'touchstart', 'keydown'];
    function onInteraction(): void {
      clearTimeout(timer);
      interactionEvents.forEach((evt: string): void => {
        window.removeEventListener(evt, onInteraction);
      });
      loadAndPlay();
    }

    interactionEvents.forEach((evt: string): void => {
      window.addEventListener(evt, onInteraction, { once: true, passive: true });
    });
  }

  // ==========================================================================
  // COMPARISON TABLE -- Column hover highlighting + "See options" scroll targets
  // ==========================================================================

  function initComparisonTable(): void {
    const table: HTMLTableElement | null = document.querySelector('.comparison-table');

    if (!table) return;

    const thead: HTMLTableSectionElement | null = table.querySelector('thead');
    const tbody: HTMLTableSectionElement | null = table.querySelector('tbody');

    if (!thead || !tbody) return;

    // --- Column hover highlighting ---
    const allRows: NodeListOf<HTMLTableRowElement> = table.querySelectorAll('tr');

    // Add/remove highlight class on all cells in a column
    function highlightColumn(colIndex: number, active: boolean): void {
      allRows.forEach(function (row: HTMLTableRowElement): void {
        const cell: Element | undefined = row.children[colIndex];
        if (cell) {
          if (active) {
            (cell as HTMLElement).style.backgroundColor = 'rgba(255, 110, 66, 0.06)';
          } else {
            (cell as HTMLElement).style.backgroundColor = '';
          }
        }
      });
    }

    // Attach hover listeners to every cell (skip col 0 -- that's the label column)
    allRows.forEach(function (row: HTMLTableRowElement): void {
      Array.from(row.children).forEach(function (cell: Element, colIndex: number): void {
        if (colIndex === 0) return;

        cell.addEventListener('mouseenter', function (): void {
          highlightColumn(colIndex, true);
        });

        cell.addEventListener('mouseleave', function (): void {
          highlightColumn(colIndex, false);
        });
      });
    });

    // --- Sticky thead within wrapper on scroll ---
    const wrapper: HTMLElement | null = document.querySelector('.comparison-table-wrapper');

    if (wrapper && thead) {
      const tableThrottle = createThrottle();
      wrapper.addEventListener('scroll', function (): void {
        tableThrottle(function (): void {
          const scrollTop: number = wrapper.scrollTop;
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
    const lastRow: HTMLTableRowElement | null = tbody.querySelector('tr:last-child');

    if (!lastRow) return;

    const seeOptionsButtons: NodeListOf<Element> = lastRow.querySelectorAll('.btn--amazon');

    // Map each button to the section it should scroll to
    // Columns 1-2 = TZ series (id="firewalls"), Columns 3-4 = NSa series (class="featured-products--nsa")
    const scrollTargets: readonly ScrollTargetResolver[] = [
      function (): HTMLElement | null { return document.getElementById('firewalls'); },             // TZ280W -> TZ section
      function (): HTMLElement | null { return document.getElementById('firewalls'); },             // TZ480 -> TZ section
      function (): HTMLElement | null { return document.querySelector('.featured-products--nsa'); }, // NSa 2800 -> NSa section
      function (): HTMLElement | null { return document.querySelector('.featured-products--nsa'); }  // NSa 4800 -> NSa section
    ];

    seeOptionsButtons.forEach(function (btn: Element, index: number): void {
      if (!scrollTargets[index]) return;

      btn.addEventListener('click', function (e: Event): void {
        e.preventDefault();
        e.stopPropagation(); // Prevent cart counter from firing

        const target: HTMLElement | null = scrollTargets[index]();
        if (target) {
          smoothScrollTo(target);
        }
      });
    });
  }

  // ==========================================================================
  // FREQUENTLY BOUGHT TOGETHER -- Checkbox interactivity with price recalc
  // ==========================================================================

  function initFrequentlyBoughtTogether(): void {
    const containerEl: HTMLElement | null = document.querySelector('.frequently-bought-together');

    if (!containerEl) return;
    const container: HTMLElement = containerEl;

    const checkboxes: NodeListOf<HTMLInputElement> = container.querySelectorAll(
      '.fbt-checkbox input[type="checkbox"]'
    );
    const products: NodeListOf<Element> = container.querySelectorAll('.fbt-product');
    const totalPriceMaybe: HTMLElement | null = container.querySelector('.fbt-price-amount');
    const addToCartBtnMaybe: HTMLButtonElement | null = container.querySelector('.fbt-pricing > .btn--amazon');

    if (!checkboxes.length || !totalPriceMaybe || !addToCartBtnMaybe) return;
    const totalPriceEl: HTMLElement = totalPriceMaybe;
    const addToCartBtn: HTMLButtonElement = addToCartBtnMaybe;

    // Extract prices from checkbox labels -- format: "Product Name - $XX.XX"
    const prices: number[] = [];
    checkboxes.forEach(function (checkbox: HTMLInputElement): void {
      const label: HTMLElement | null = checkbox.parentElement;
      const text: string = label ? label.textContent ?? '' : '';
      const match: RegExpMatchArray | null = text.match(/\$([0-9,]+\.?\d*)/);
      prices.push(match ? parseFloat(match[1].replace(',', '')) : 0);
    });

    // Cache plus signs once -- they don't change
    const plusSigns: NodeListOf<Element> = container.querySelectorAll('.fbt-plus');

    function updateFBT(): void {
      let total: number = 0;
      let checkedCount: number = 0;

      checkboxes.forEach(function (checkbox: HTMLInputElement, index: number): void {
        const isChecked: boolean = checkbox.checked;

        if (isChecked) {
          total += prices[index];
          checkedCount++;
        }

        // Dim/brighten the corresponding product visual
        const product: Element | undefined = products[index];
        if (product) {
          const htmlProduct = product as HTMLElement;
          if (isChecked) {
            htmlProduct.style.opacity = '1';
            htmlProduct.style.filter = '';
            htmlProduct.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
          } else {
            htmlProduct.style.opacity = '0.4';
            htmlProduct.style.filter = 'grayscale(100%)';
            htmlProduct.style.transition = 'opacity 0.3s ease, filter 0.3s ease';
          }
        }
      });

      // Update plus-sign opacity ONCE (outside the checkbox loop)
      plusSigns.forEach(function (plus: Element, plusIndex: number): void {
        const leftChecked: boolean = checkboxes[plusIndex] ? checkboxes[plusIndex].checked : false;
        const rightChecked: boolean = checkboxes[plusIndex + 1] ? checkboxes[plusIndex + 1].checked : false;

        if (leftChecked && rightChecked) {
          (plus as HTMLElement).style.opacity = '1';
        } else {
          (plus as HTMLElement).style.opacity = '0.3';
        }
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
    checkboxes.forEach(function (checkbox: HTMLInputElement): void {
      checkbox.addEventListener('change', updateFBT);
    });

    // Set initial state (all checked by default from HTML)
    updateFBT();
  }

  // ==========================================================================
  // DROPDOWN NAVIGATION -- Keyboard, touch & accessibility support
  // ==========================================================================

  function initDropdownNavigation(): void {
    const dropdownWrappers: NodeListOf<Element> = document.querySelectorAll('.brand-nav__tab-wrapper');

    if (!dropdownWrappers.length) return;

    dropdownWrappers.forEach((wrapper: Element): void => {
      const tab: Element | null = wrapper.querySelector('.brand-nav__tab--has-dropdown');
      const dropdown: Element | null = wrapper.querySelector('.brand-nav__dropdown');

      if (!tab || !dropdown) return;

      // Set ARIA attributes
      tab.setAttribute('aria-haspopup', 'true');
      tab.setAttribute('aria-expanded', 'false');

      // Click toggle (mobile/touch)
      tab.addEventListener('click', (e: Event): void => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen: boolean = tab.getAttribute('aria-expanded') === 'true';
        closeAllDropdowns();
        if (!isOpen) {
          tab.setAttribute('aria-expanded', 'true');
          wrapper.classList.add('brand-nav__tab-wrapper--open');
        }
      });

      // Keyboard: Enter/Space toggles, Escape closes, ArrowDown enters dropdown
      tab.addEventListener('keydown', (e: Event): void => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          const isOpen: boolean = tab.getAttribute('aria-expanded') === 'true';
          closeAllDropdowns();
          if (!isOpen) {
            tab.setAttribute('aria-expanded', 'true');
            wrapper.classList.add('brand-nav__tab-wrapper--open');
            // Focus first dropdown link
            const firstLink: HTMLElement | null = dropdown.querySelector('.brand-nav__dropdown-link');
            if (firstLink) firstLink.focus();
          }
        }
        if (keyEvent.key === 'ArrowDown') {
          keyEvent.preventDefault();
          tab.setAttribute('aria-expanded', 'true');
          wrapper.classList.add('brand-nav__tab-wrapper--open');
          const firstLink: HTMLElement | null = dropdown.querySelector('.brand-nav__dropdown-link');
          if (firstLink) firstLink.focus();
        }
      });

      // Arrow key navigation within dropdown items
      const links: NodeListOf<HTMLElement> = dropdown.querySelectorAll('.brand-nav__dropdown-link');
      links.forEach((link: HTMLElement, linkIndex: number): void => {
        link.addEventListener('keydown', (e: Event): void => {
          const keyEvent = e as KeyboardEvent;
          if (keyEvent.key === 'ArrowDown') {
            keyEvent.preventDefault();
            const next: HTMLElement = links[linkIndex + 1] || links[0];
            next.focus();
          }
          if (keyEvent.key === 'ArrowUp') {
            keyEvent.preventDefault();
            const prev: HTMLElement = links[linkIndex - 1] || links[links.length - 1];
            prev.focus();
          }
          if (keyEvent.key === 'Escape') {
            closeAllDropdowns();
            (tab as HTMLElement).focus();
          }
        });

        // Dropdown link clicks -- navigate to page or scroll to section
        link.addEventListener('click', (e: Event): void => {
          const href: string | null = link.getAttribute('href');
          if (href) {
            const currentPage: string = window.location.pathname.split('/').pop() || 'index.html';
            const [linkPage, hash] = href.split('#');
            // If link points to another page, allow default navigation
            if (linkPage && linkPage !== currentPage) {
              closeAllDropdowns();
              return; // Allow browser navigation
            }
            // Same-page hash link -- scroll to section
            if (hash) {
              e.preventDefault();
              const section: Element | null = document.getElementById(hash)
                || document.querySelector(`section[data-section="${hash}"], [data-section="${hash}"]`);
              if (section && section.tagName !== 'A' && section.tagName !== 'BUTTON') {
                smoothScrollTo(section);
              }
            }
          }
          closeAllDropdowns();
        });
      });
    });

    // Close all dropdowns
    function closeAllDropdowns(): void {
      dropdownWrappers.forEach((wrapper: Element): void => {
        const tab: Element | null = wrapper.querySelector('.brand-nav__tab--has-dropdown');
        if (tab) tab.setAttribute('aria-expanded', 'false');
        wrapper.classList.remove('brand-nav__tab-wrapper--open');
      });
    }

    // Close on outside click
    document.addEventListener('click', (e: Event): void => {
      const mouseEvent = e as MouseEvent;
      if (!(mouseEvent.target as Element)?.closest('.brand-nav__tab-wrapper')) {
        closeAllDropdowns();
      }
    });

    // Close on Escape (global)
    document.addEventListener('keydown', (e: Event): void => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Escape') closeAllDropdowns();
    });
  }

  // ==========================================================================
  // MODERN BUTTON RIPPLE EFFECT
  // ==========================================================================

  function initButtonRippleEffect(): void {
    if (prefersReducedMotion) return;

    const buttons: NodeListOf<Element> = document.querySelectorAll(
      '.btn--modern, .btn--gradient, .btn--outline-dark, .btn--outline-light'
    );

    if (!buttons.length) return;

    buttons.forEach((button: Element): void => {
      button.addEventListener('click', function (this: HTMLElement, e: Event): void {
        const mouseEvent = e as MouseEvent;
        const ripple: HTMLSpanElement = document.createElement('span');
        const rect: DOMRect = this.getBoundingClientRect();
        const size: number = Math.max(rect.width, rect.height);
        const x: number = mouseEvent.clientX - rect.left - size / 2;
        const y: number = mouseEvent.clientY - rect.top - size / 2;

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

        setTimeout((): void => ripple.remove(), 600);
      });
    });

    // Add ripple keyframes if not already present
    if (!document.querySelector('#ripple-styles')) {
      const style: HTMLStyleElement = document.createElement('style');
      style.id = 'ripple-styles';
      style.textContent = `
        @keyframes rippleEffect {
          to { transform: scale(4); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ==========================================================================
  // PRODUCT CARD HOVER ENHANCEMENT -- Image zoom on hover
  // ==========================================================================

  function initProductCardEnhancements(): void {
    if (prefersReducedMotion) return;

    const cards: NodeListOf<Element> = document.querySelectorAll('.product-card');

    if (!cards.length) return;

    cards.forEach((card: Element): void => {
      const img: HTMLElement | null = card.querySelector('.product-card__image img, .product-card__image');

      if (img) {
        card.addEventListener('mouseenter', (): void => {
          img.style.transition = `transform 0.4s ${EASING_SMOOTH}`;
          img.style.transform = 'scale(1.05)';
        });

        card.addEventListener('mouseleave', (): void => {
          img.style.transform = 'scale(1)';
        });
      }
    });
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  function init(): void {
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
    initHeroVideo();
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
