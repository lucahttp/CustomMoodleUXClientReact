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
             const src = iframe.getAttribute("src") || "";
             if (src.includes("docs.google.com/presentation/d/")) {
                 const presentationIdMatch = src.match(/\/d\/([a-zA-Z0-9-_]+)/);
                 if (presentationIdMatch && presentationIdMatch[1]) {
                     const presentationId = presentationIdMatch[1];
                     // Fallback variables for GoogleSlides API
                     const SLIDES_API_URL = import.meta.env.VITE_SLIDES_API || 'http://127.0.0.1:8000';
                     const pdfExportUrl = `${SLIDES_API_URL}/api/slides/${presentationId}/pdf`;
                     const svgViewerUrl = `${SLIDES_API_URL}/api/slides/${presentationId}/view`;
                     const originalGoogle = src;
                     
                     // Minimal, glassmorphism UI for slides
                     const slideButtonId = `btn-slide-${presentationId}`;
                     const iframeId = `iframe-slide-${presentationId}`;
                     
                     // Attach an ID to the original iframe so we can target it
                     iframe.id = iframeId;
                     iframe.style.width = "100%";
                     iframe.style.height = "100%";
                     iframe.style.position = "absolute";
                     iframe.style.top = "0";
                     iframe.style.left = "0";

                     const overlayUI = `
                        <div class="moodle-google-slides-wrapper" data-presentation-id="${presentationId}" style="border: 1px solid #e5e7eb; background: #fff; padding: 12px; margin: 24px 0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); position: relative; z-index: 10;">
                            <div class="slides-toolbar" style="display: flex; gap: 12px; margin-bottom: 12px; justify-content: center; flex-wrap: wrap;">
                                <button id="${slideButtonId}" class="gslide-convert-btn" style="cursor: pointer; background: rgba(99, 102, 241, 0.1); color: #4f46e5; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-family: inherit; font-size: 13px; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(99, 102, 241, 0.2); transition: all 0.2s;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Convertir a SVG (Offline)
                                </button>
                            </div>
                            
                            <div id="iframe-container-${slideButtonId}" style="position: relative; overflow: hidden; width: 100%; aspect-ratio: 16/9; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); background: #f9fafb;">
                            </div>

                            <div id="render-${slideButtonId}" class="slides-svg-container" style="display: none; flex-direction: column; gap: 16px; align-items: center; width: 100%; margin-top: 16px;"></div>
                        </div>
                     `;
                     
                     iframe.insertAdjacentHTML("afterend", overlayUI);
                     
                     // Move the iframe into our clean UI container
                     const iframeContainer = document.getElementById(`iframe-container-${slideButtonId}`);
                     if (iframeContainer) {
                         // Reset iframe styles to be relative to our new container
                         iframe.style.position = "absolute";
                         iframe.style.top = "0";
                         iframe.style.left = "0";
                         iframe.style.width = "100%";
                         iframe.style.height = "100%";
                         iframe.style.border = "none";
                         iframeContainer.appendChild(iframe);
                     }

                     setTimeout(() => {
                         const btn = document.getElementById(slideButtonId);
                         const renderDiv = document.getElementById(`render-${slideButtonId}`);
                         const innerFrame = document.getElementById(iframeId);
                         const wrapper = btn.closest('.moodle-google-slides-wrapper');
                         
                         if (btn && innerFrame) {
                             btn.addEventListener('click', (e) => {
                                 e?.preventDefault();
                                 if (btn.disabled) return;

                                 btn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Procesando...`;
                                 btn.disabled = true;
                                 
                                 renderDiv.style.display = "flex";
                                 renderDiv.innerHTML = `
                                    <div class="w-full flex flex-col gap-4 animate-pulse px-2">
                                       <div class="w-full aspect-video bg-indigo-50 rounded-xl"></div>
                                    </div>
                                 `;
                                 
                                 innerFrame.contentWindow.postMessage({ type: "getText" }, "*");
                                 
                                 const resultListener = (event) => {
                                     if (event.data && event.data.type === "SLIDES_EXTRACTED") {
                                         btn.innerHTML = "✓ Convertido";
                                         btn.style.background = "#ecfdf5";
                                         btn.style.color = "#059669";
                                         btn.style.borderColor = "#10b981";

                                         const svgHtml = event.data.data.map(svg => `<div class="gslide-svg-item" style="width: 100%; border: 1px solid #eee; background: white; border-radius: 12px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${svg}</div>`).join('');
                                         renderDiv.innerHTML = svgHtml;
                                         iframeContainer.style.display = 'none';

                                         // Add a "Show Original" button if it doesn't exist
                                         if (!wrapper.querySelector('.gslide-show-original-btn')) {
                                             const showOriginalBtn = document.createElement('button');
                                             showOriginalBtn.className = 'gslide-show-original-btn';
                                             showOriginalBtn.innerHTML = 'Ver Interactivo';
                                             showOriginalBtn.style.cssText = 'cursor: pointer; background: #fff; color: #6b7280; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-family: inherit; font-size: 13px; border: 1px solid #e5e7eb; transition: all 0.2s;';
                                             showOriginalBtn.onclick = () => {
                                                 const isShowingIframe = iframeContainer.style.display !== 'none';
                                                 iframeContainer.style.display = isShowingIframe ? 'none' : 'block';
                                                 renderDiv.style.display = isShowingIframe ? 'flex' : 'none';
                                                 showOriginalBtn.innerHTML = isShowingIframe ? 'Ver Interactivo' : 'Ver Estático (SVG)';
                                             };
                                             wrapper.querySelector('.slides-toolbar').appendChild(showOriginalBtn);
                                         }
                                         
                                         // Dispatch event to persist in PGlite
                                         const chapterEl = wrapper.closest('.book_chapter');
                                         if (chapterEl) {
                                             window.dispatchEvent(new CustomEvent('MOODLE_CHAPTER_UPDATED', {
                                                 detail: {
                                                     chapterId: chapterEl.id,
                                                     newHtml: chapterEl.innerHTML
                                                 }
                                             }));
                                         }

                                         window.removeEventListener("message", resultListener);
                                     } else if (event.data && event.data.type === "SLIDES_ERROR") {
                                         btn.innerHTML = "Error";
                                         btn.disabled = false;
                                         window.removeEventListener("message", resultListener);
                                     }
                                 };
                                 
                                 window.addEventListener("message", resultListener);
                             });
                         }
                     }, 100);
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
