/**
 * @typedef {Object} BookChapter
 * @property {string} id - The ID of the chapter element.
 * @property {string} title - The title of the chapter.
 * @property {string} content - The HTML content of the chapter.
 */

/**
 * @typedef {Object} ParsedBook
 * @property {string} bookTitle - The title of the entire book/document.
 * @property {BookChapter[]} chapters - An array of structured chapter objects.
 */

/**
 * Parses chapter and book title content from a provided HTML string.
 * Includes YouTube video cleanup, basic content sanitization, and URL correction.
 * @param {string} htmlString The full HTML content.
 * @returns {ParsedBook} An object containing the book title and chapters.
 */
export const parseBookContent = (htmlString, endpoint) => {
    const MOODLE_BASE_URL = endpoint;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

    // --- URL CORRECTION ---
    // Fix relative URLs for images and links to point to the Moodle server
    doc.querySelectorAll('img[src], a[href], source[src]').forEach(el => {
        try {
            if (el.hasAttribute('src')) {
                const src = el.getAttribute('src');
                if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('javascript:')) {
                    el.setAttribute('src', new URL(src, MOODLE_BASE_URL).href);
                }
            }
            if (el.hasAttribute('href')) {
                const href = el.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('javascript:')) {
                    el.setAttribute('href', new URL(href, MOODLE_BASE_URL).href);
                }
            }
        } catch (e) {
            console.warn('Failed to fix URL:', e);
        }
    });


    const chapters = [];
    let bookTitle = "Untitled Book";

    // --- BOOK TITLE EXTRACTION ---
    const bookTitleEl = doc.querySelector(".book_title h1");
    if (bookTitleEl) {
        bookTitle = bookTitleEl.textContent?.trim() || bookTitle;
    }

    const chapterElements = Array.from(doc.querySelectorAll(".book_chapter"));

    chapterElements.forEach((chapterEl) => {
        const id = chapterEl.id || `chapter-${chapters.length + 1}`;

        let title = "Untitled Chapter";
        const titleEl = chapterEl.querySelector("h1, h2, h3");
        if (titleEl) {
            title = titleEl.textContent?.trim() || title;

            // OPTIMIZATION: Aggressively strip Moodle-specific inline styles from the title element.
            titleEl.removeAttribute("style");
            titleEl
                .querySelectorAll("span, strong")
                .forEach((el) => el.removeAttribute("style"));
            // Remove the title element to avoid duplication in content
            titleEl.remove();
        }

        // 4. Content Cleanup/Fixes

        // **A. YouTube Video Cleanup**
        chapterEl
            .querySelectorAll(".mediaplugin_videojs [data-setup-lazy]")
            .forEach((playerContainer) => {
                try {
                    const dataAttr = playerContainer.getAttribute("data-setup-lazy");
                    if (!dataAttr) return;

                    const cleanDataAttr = dataAttr.replace(/&quot;/g, '"');
                    const setupData = JSON.parse(cleanDataAttr);

                    const youtubeUrl = setupData.sources?.[0]?.src;

                    if (youtubeUrl) {
                        const url = new URL(youtubeUrl);
                        const videoId = url.searchParams.get("v");

                        if (videoId) {
                            const iframeHTML = `
                          <div class="responsive-video-container">
                              <iframe 
                                  src="https://www.youtube.com/embed/${videoId}" 
                                  frameborder="0" 
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                  allowfullscreen 
                                  title="Embedded YouTube Video">
                              </iframe>
                          </div>
                      `;

                            const wrapperEl = playerContainer.closest(
                                ".mediaplugin_videojs"
                            );

                            if (wrapperEl) {
                                wrapperEl.insertAdjacentHTML("afterend", iframeHTML.trim());
                                wrapperEl.remove();
                            }
                        }
                    }
                } catch (e) {
                    console.warn(
                        "Could not process video element. Keeping original HTML.",
                        e
                    );
                }
            });

        // **B. General Content Sanitation:** Remove common Moodle/old inline styles from content elements.
        chapterEl.querySelectorAll("p, li, span").forEach((el) => {
            el.removeAttribute("style");
            // Remove redundant styling classes, leaving only structural ones
            el.removeAttribute("class");
        });

        // **C. Fix images:** Ensure responsiveness and remove inline sizing, letting CSS handle it.
        chapterEl.querySelectorAll("img").forEach((img) => {
            img.removeAttribute("width");
            img.removeAttribute("height");
            img.setAttribute(
                "style",
                "max-width: 100%; height: auto; display: block; margin: 1.5rem auto;"
            );
        });

        // **D. Enhanced Google Slides Embeds via GooGleSlidesToPDF:** Use external API parser when requested
        chapterEl.querySelectorAll("iframe").forEach((iframe) => {
             let src = iframe.getAttribute("src") || "";
             if (src.includes("docs.google.com/presentation/d/")) {
                 // Force https:// to avoid protocol-relative or extension-relative issues
                 if (src.startsWith("//")) src = "https:" + src;
                 else if (!src.startsWith("http")) src = "https://" + src;
                 iframe.setAttribute("src", src);
                 
                 const presentationIdMatch = src.match(/\/d\/([a-zA-Z0-9-_]+)/);
                 if (presentationIdMatch && presentationIdMatch[1]) {
                     const presentationId = presentationIdMatch[1];
                     // Fallback variables for GoogleSlides API
                     const SLIDES_API_URL = import.meta.env.VITE_SLIDES_API || 'http://127.0.0.1:8000';
                     const pdfExportUrl = `${SLIDES_API_URL}/api/slides/${presentationId}/pdf`;
                     const svgViewerUrl = `${SLIDES_API_URL}/api/slides/${presentationId}/view`;
                     const originalGoogle = src;
                     
                     // Minimal, glassmorphism UI for slides
                     // Create IDs for coordination
                     const iframeId = `gslide-iframe-${presentationId}`;
                     const slideButtonId = `gslide-btn-${presentationId}`;
                     const renderDivId = `render-${presentationId}`;
                     const containerId = `iframe-container-${presentationId}`;

                     iframe.id = iframeId;
                     iframe.classList.add('gslide-iframe');

                     const overlayUI = `
                        <div class="moodle-google-slides-wrapper" data-presentation-id="${presentationId}" style="border: 1px solid #e5e7eb; background: #fff; padding: 12px; margin: 24px 0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); position: relative; z-index: 10;">
                            <div class="slides-toolbar" style="display: flex; gap: 12px; margin-bottom: 12px; justify-content: center; flex-wrap: wrap;">
                                <button id="${slideButtonId}" class="gslide-convert-btn" data-iframe-id="${iframeId}" data-render-id="${renderDivId}" data-container-id="${containerId}" style="cursor: pointer; background: rgba(99, 102, 241, 0.1); color: #4f46e5; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-family: inherit; font-size: 13px; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(99, 102, 241, 0.2); transition: all 0.2s;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Convertir a SVG (Offline)
                                </button>
                            </div>
                            
                            <div id="${containerId}" class="gslide-iframe-container" style="position: relative; overflow: hidden; width: 100%; aspect-ratio: 16/9; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); background: #f9fafb;">
                            </div>

                            <div id="${renderDivId}" class="slides-svg-container" style="display: none; flex-direction: column; gap: 16px; align-items: center; width: 100%; margin-top: 16px;"></div>
                        </div>
                     `;
                     
                     iframe.insertAdjacentHTML("afterend", overlayUI);
                     
                     // Find container within the 'doc' fragment, not the main document
                     const iframeContainer = doc.getElementById(containerId);
                     if (iframeContainer) {
                         // Style the iframe to be relative to our new container
                         iframe.style.position = "absolute";
                         iframe.style.top = "0";
                         iframe.style.left = "0";
                         iframe.style.width = "100%";
                         iframe.style.height = "100%";
                         iframe.style.border = "none";
                         iframeContainer.appendChild(iframe);
                     }
                 }
             }
        });

        // 5. Extract the final cleaned content
        const content = chapterEl.innerHTML;

        chapters.push({
            id,
            title,
            content,
        });
    });

    return {
        bookTitle,
        chapters,
    };
};

/**
 * Utility to fetch and inline SVGs in a book's chapters.
 * This is async and should be called during ingestion.
 */
export const inlineSVGsInChapters = async (chapters) => {
    const updatedChapters = [];
    
    for (const chapter of chapters) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(chapter.content, "text/html");
        const images = Array.from(doc.querySelectorAll('img[src$=".svg"]'));
        
        for (const img of images) {
            try {
                const src = img.getAttribute('src');
                const response = await fetch(src);
                if (response.ok) {
                    const svgText = await response.text();
                    // Basic cleanup of the fetched SVG
                    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                    const svgEl = svgDoc.querySelector('svg');
                    if (svgEl) {
                        // Transfer style/classes from img to svg
                        const style = img.getAttribute('style');
                        if (style) svgEl.setAttribute('style', style);
                        
                        img.replaceWith(svgEl);
                    }
                }
            } catch (e) {
                console.warn('Failed to inline SVG:', e);
            }
        }
        
        updatedChapters.push({
            ...chapter,
            content: doc.body.innerHTML
        });
    }
    
    return updatedChapters;
};
