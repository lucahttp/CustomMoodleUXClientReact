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

        // **D. Enhanced Google Slides Embeds:** Allow Native PDF Export or Original view
        chapterEl.querySelectorAll("iframe").forEach((iframe) => {
             const src = iframe.getAttribute("src") || "";
             if (src.includes("docs.google.com/presentation/d/")) {
                 const presentationIdMatch = src.match(/\/d\/([a-zA-Z0-9-_]+)/);
                 if (presentationIdMatch && presentationIdMatch[1]) {
                     const presentationId = presentationIdMatch[1];
                     const pdfExportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/pdf`;
                     
                     const overlayUI = `
                        <div class="moodle-google-slides-wrapper" style="border: 2px dashed #4ade80; padding: 10px; margin-bottom: 20px; border-radius: 8px;">
                            <div class="slides-toolbar" style="display: flex; gap: 10px; margin-bottom: 10px; justify-content: center;">
                                <a href="${pdfExportUrl}" target="_blank" style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 50px; text-decoration: none; font-weight: bold; font-family: sans-serif;">Descargar como PDF 📄</a>
                                <a href="${src}" target="_blank" style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 50px; text-decoration: none; font-weight: bold; font-family: sans-serif;">Abrir Presentación Original 🔗</a>
                            </div>
                            <div class="iframe-container" style="position: relative; overflow: hidden; padding-top: 56.25%;">
                                <iframe src="${src}" frameborder="0" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
                            </div>
                        </div>
                     `;
                     
                     iframe.insertAdjacentHTML("afterend", overlayUI);
                     iframe.remove();
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
