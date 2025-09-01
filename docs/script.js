// BotBuilder Website JavaScript

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeNavigation();
  initializeScrollEffects();
  initializeScreenshotGallery();
  initializeSmoothScrolling();
});

// Navigation functionality
function initializeNavigation() {
  const hamburger = document.querySelector(".hamburger");
  const navMenu = document.querySelector(".nav-menu");
  const navLinks = document.querySelectorAll(".nav-link");

  // Mobile menu toggle
  if (hamburger && navMenu) {
    hamburger.addEventListener("click", function () {
      hamburger.classList.toggle("active");
      navMenu.classList.toggle("active");
    });
  }

  // Close mobile menu when clicking on a link
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (hamburger && navMenu) {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
      }
    });
  });

  // Close mobile menu when clicking outside
  document.addEventListener("click", function (event) {
    const isClickInsideNav =
      navMenu?.contains(event.target) || hamburger?.contains(event.target);

    if (!isClickInsideNav && navMenu?.classList.contains("active")) {
      hamburger?.classList.remove("active");
      navMenu?.classList.remove("active");
    }
  });
}

// Scroll effects and navigation highlighting
function initializeScrollEffects() {
  const navbar = document.querySelector(".navbar");
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  // Navbar scroll effect
  function handleNavbarScroll() {
    if (window.scrollY > 50) {
      navbar?.classList.add("scrolled");
    } else {
      navbar?.classList.remove("scrolled");
    }
  }

  // Active nav link highlighting
  function updateActiveNavLink() {
    let current = "";
    sections.forEach((section) => {
      const sectionTop = section.offsetTop - 200;
      const sectionHeight = section.offsetHeight;

      if (
        window.scrollY >= sectionTop &&
        window.scrollY < sectionTop + sectionHeight
      ) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === "#" + current) {
        link.classList.add("active");
      }
    });
  }

  // Throttled scroll handler for better performance
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () {
        handleNavbarScroll();
        updateActiveNavLink();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll);

  // Initial call
  handleNavbarScroll();
  updateActiveNavLink();
}

// Screenshot gallery functionality
const featureShowcase = []; //TODO: Add real screenshots here in the format below
// Example:
// {
//   fileName: "example-screenshot.png",
//   description: "Description of the screenshot"
// }

function initializeScreenshotGallery() {
  const galleryTrack = document.getElementById("gallery-track");
  const dotsContainer = document.getElementById("galleryDots");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (!galleryTrack || !dotsContainer || !prevBtn || !nextBtn) {
    console.warn("Gallery elements not found");
    return;
  }

  let currentSlide = 0;
  let screenshots = [];
  let autoSlideInterval = null;

  // Load screenshots
  loadScreenshots()
    .then((loadedScreenshots) => {
      screenshots = loadedScreenshots;
      if (screenshots.length > 0) {
        renderGallery();
        setupGalleryControls();
        startAutoSlide();
      } else {
        showNoScreenshots();
      }
    })
    .catch((error) => {
      console.log("Loading real screenshots failed");
    });

  // Load screenshots from the screenshots folder
  async function loadScreenshots() {
    const commonFilenames = featureShowcase.map((s) => s.fileName);

    const screenshots = [];

    for (const filename of commonFilenames) {
      try {
        const img = new Image();
        const loaded = await new Promise((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = `screenshots/${filename}`;
        });

        if (loaded) {
          screenshots.push({
            src: `screenshots/${filename}`,
            title: formatTitle(filename),
            description: getDescriptionForImage(filename),
          });
        }

        // Limit to 8 screenshots for better performance
        if (screenshots.length >= 8) break;
      } catch (error) {
        console.log(`Failed to load ${filename}`);
      }
    }

    if (screenshots.length === 0) {
      throw new Error("No screenshots found");
    }

    return screenshots;
  }

  // Format filename to title
  function formatTitle(filename) {
    const name = filename.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "");
    return name
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Get description for image based on filename
  function getDescriptionForImage(filename) {
    const descriptions = featureShowcase.reduce((acc, curr) => {
      acc[
        curr.fileName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "").toLowerCase()
      ] = curr.description;
      return acc;
    }, {});

    const lower = filename.toLowerCase();
    for (const [key, description] of Object.entries(descriptions)) {
      if (lower.includes(key)) {
        return description;
      }
    }
    return "BotBuilder feature showcase";
  }

  // Render the gallery
  function renderGallery() {
    galleryTrack.innerHTML = screenshots
      .map(
        (screenshot, index) => `
            <div class="gallery-slide" data-slide="${index}">
                <img src="${screenshot.src}" alt="${screenshot.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/1000x500/1e293b/06d6a0?text=Image+Not+Found'">
                <div class="slide-caption">
                    <h3>${screenshot.title}</h3>
                    <p>${screenshot.description}</p>
                </div>
            </div>
        `
      )
      .join("");

    // Render dots
    dotsContainer.innerHTML = screenshots
      .map(
        (_, index) =>
          `<span class="dot ${
            index === 0 ? "active" : ""
          }" data-slide="${index}" aria-label="Go to slide ${
            index + 1
          }"></span>`
      )
      .join("");
  }

  // Show no screenshots message
  function showNoScreenshots() {
    galleryTrack.innerHTML = `
            <div class="no-screenshots">
                <h3>Screenshots Coming Soon</h3>
                <p>We're working on adding screenshots of BotBuilder in action. Check back soon!</p>
            </div>
        `;
    dotsContainer.innerHTML = "";
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  // Setup gallery controls
  function setupGalleryControls() {
    if (screenshots.length <= 1) {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      return;
    }

    // Previous button
    prevBtn.addEventListener("click", () => {
      currentSlide =
        currentSlide > 0 ? currentSlide - 1 : screenshots.length - 1;
      updateGallery();
      resetAutoSlide();
    });

    // Next button
    nextBtn.addEventListener("click", () => {
      currentSlide =
        currentSlide < screenshots.length - 1 ? currentSlide + 1 : 0;
      updateGallery();
      resetAutoSlide();
    });

    // Dot navigation
    dotsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("dot")) {
        currentSlide = parseInt(e.target.dataset.slide);
        updateGallery();
        resetAutoSlide();
      }
    });

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        currentSlide =
          currentSlide > 0 ? currentSlide - 1 : screenshots.length - 1;
        updateGallery();
        resetAutoSlide();
      } else if (e.key === "ArrowRight") {
        currentSlide =
          currentSlide < screenshots.length - 1 ? currentSlide + 1 : 0;
        updateGallery();
        resetAutoSlide();
      }
    });

    // Touch/swipe support
    let startX = 0;
    let startY = 0;

    galleryTrack.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );

    galleryTrack.addEventListener(
      "touchend",
      (e) => {
        if (!startX || !startY) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = startX - endX;
        const diffY = startY - endY;

        // Only swipe if horizontal movement is greater than vertical
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
          if (diffX > 0) {
            // Swipe left - next slide
            currentSlide =
              currentSlide < screenshots.length - 1 ? currentSlide + 1 : 0;
          } else {
            // Swipe right - previous slide
            currentSlide =
              currentSlide > 0 ? currentSlide - 1 : screenshots.length - 1;
          }
          updateGallery();
          resetAutoSlide();
        }

        startX = 0;
        startY = 0;
      },
      { passive: true }
    );
  }

  // Update gallery position and dots
  function updateGallery() {
    galleryTrack.style.transform = `translateX(-${currentSlide * 100}%)`;

    // Update dots
    document.querySelectorAll(".dot").forEach((dot, index) => {
      dot.classList.toggle("active", index === currentSlide);
    });
  }

  // Auto-slide functionality
  function startAutoSlide() {
    if (screenshots.length <= 1) return;

    autoSlideInterval = setInterval(() => {
      currentSlide =
        currentSlide < screenshots.length - 1 ? currentSlide + 1 : 0;
      updateGallery();
    }, 5000);
  }

  // Reset auto-slide when user interacts
  function resetAutoSlide() {
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      startAutoSlide();
    }
  }

  // Pause auto-slide when gallery is not visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        startAutoSlide();
      } else {
        if (autoSlideInterval) {
          clearInterval(autoSlideInterval);
          autoSlideInterval = null;
        }
      }
    });
  });

  observer.observe(galleryTrack);
}

// Smooth scrolling for anchor links
function initializeSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar

        window.scrollTo({
          top: offsetTop,
          behavior: "smooth",
        });
      }
    });
  });
}

// Utility functions for enhanced user experience
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

// Add loading states for better UX
function showLoading(element) {
  if (element) {
    element.innerHTML = '<div class="loading-spinner"></div>';
  }
}

// Intersection Observer for animations (optional enhancement)
function initializeAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  // Observe elements that should animate in
  document
    .querySelectorAll(".feature-card, .step, .support-card")
    .forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      observer.observe(el);
    });
}

// Enhanced error handling for images
function handleImageErrors() {
  document.addEventListener(
    "error",
    function (e) {
      if (e.target.tagName === "IMG") {
        e.target.src =
          "https://via.placeholder.com/1000x500/1e293b/06d6a0?text=Image+Not+Available";
      }
    },
    true
  );
}

// Performance optimization: Lazy load images
function initializeLazyLoading() {
  if ("IntersectionObserver" in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove("lazy");
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll("img[data-src]").forEach((img) => {
      imageObserver.observe(img);
    });
  }
}

// Add copy to clipboard functionality for code blocks
function initializeCopyButtons() {
  document.querySelectorAll(".code-block").forEach((codeBlock) => {
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.innerHTML = "📋";
    copyButton.title = "Copy to clipboard";
    copyButton.setAttribute("aria-label", "Copy code to clipboard");

    copyButton.addEventListener("click", async () => {
      const code = codeBlock.querySelector("code");
      if (code) {
        try {
          await navigator.clipboard.writeText(code.textContent);

          // Add visual feedback
          copyButton.classList.add("copying");
          copyButton.innerHTML = "✅";
          copyButton.title = "Copied!";

          setTimeout(() => {
            copyButton.classList.remove("copying");
            copyButton.innerHTML = "📋";
            copyButton.title = "Copy to clipboard";
          }, 2000);

          // Track the copy event
          trackEvent("code_copied", {
            code_snippet: code.textContent.substring(0, 50) + "...",
          });
        } catch (err) {
          console.error("Failed to copy text: ", err);

          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = code.textContent;
          document.body.appendChild(textArea);
          textArea.select();

          try {
            document.execCommand("copy");
            copyButton.innerHTML = "✅";
            copyButton.title = "Copied!";

            setTimeout(() => {
              copyButton.innerHTML = "📋";
              copyButton.title = "Copy to clipboard";
            }, 2000);
          } catch (fallbackErr) {
            console.error("Fallback copy also failed: ", fallbackErr);
            copyButton.innerHTML = "❌";
            setTimeout(() => {
              copyButton.innerHTML = "📋";
            }, 2000);
          }

          document.body.removeChild(textArea);
        }
      }
    });

    // Make the code block container positioned relative for absolute positioning of button
    codeBlock.style.position = "relative";
    codeBlock.appendChild(copyButton);
  });
}

// Theme detection and adaptation (if needed in future)
function detectTheme() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  // This website is already dark-themed, but this could be useful for future enhancements
  return prefersDark ? "dark" : "light";
}

// Analytics tracking (placeholder for future implementation)
function trackEvent(eventName, properties = {}) {
  // This is where you would integrate with analytics services like GA4, Mixpanel, etc.
  console.log(`Event: ${eventName}`, properties);
}

// Initialize all enhancements when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  // Core functionality (already initialized above)

  // Enhanced functionality
  initializeAnimations();
  handleImageErrors();
  initializeLazyLoading();
  initializeCopyButtons();

  // Track page load
  trackEvent("page_load", {
    page: "home",
    timestamp: new Date().toISOString(),
  });
});

// Handle window resize for responsive adjustments
window.addEventListener(
  "resize",
  debounce(() => {
    // Any resize-specific logic can go here
    console.log("Window resized");
  }, 250)
);

// Service worker registration for PWA capabilities (optional future enhancement)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    // navigator.serviceWorker.register('/sw.js')
    //     .then(registration => console.log('SW registered'))
    //     .catch(error => console.log('SW registration failed'));
  });
}

// Export functions for potential external use
window.BotBuilderWebsite = {
  initializeScreenshotGallery,
  initializeNavigation,
  initializeScrollEffects,
  trackEvent,
};
