export const MOODLE_SERVICE_URL = "/lib/ajax/service.php";

export const fetchCourses = async (endpoint, sessionKey) => {
  const response = await fetch(`${endpoint}${MOODLE_SERVICE_URL}?sesskey=${sessionKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{
      index: 0,
      methodname: "core_course_get_enrolled_courses_by_timeline_classification",
      args: { offset: 0, limit: 0, classification: "all", sort: "fullname" },
    }]),
  });
  if (!response.ok) throw new Error("Failed to fetch courses");
  const data = await response.json();
  return data[0]?.data; // Return the inner data directly
};

export const fetchCourseDetails = async (endpoint, sessionKey, courseId) => {

  const response = await fetch(`${endpoint}${MOODLE_SERVICE_URL}?sesskey=${sessionKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        index: 0,
        methodname: "core_courseformat_get_state",
        args: { courseid: courseId },
      },
    ]),
  });
  if (!response.ok) throw new Error("Failed to fetch course");
  const data = await response.json();

  if (data && !data[0]?.error) {
    const httpResponse = JSON.parse(data[0].data);
    console.log(httpResponse);

    // Example of accessing data:
    console.log("Course ID:", httpResponse.course.id);
    console.log("Number of Sections:", httpResponse.course.numsections);
    console.log("First Section Title:", httpResponse.section[0].title);
    console.log("First CM Name:", httpResponse.cm[0].name);
    console.log("First Section URL", httpResponse.section[0].sectionurl);

    return httpResponse; // The response is an array as in your example
  } else {
    console.log("Failed to load course details.");
  }
}








export const fetchBookContentHTML = async (bookId) => {
   // Fetch the raw HTML string for the book print view
   const url = `https://vj.sied.utn.edu.ar/mod/book/tool/print/index.php?id=${bookId}`;
   const response = await fetch(url);
   if (!response.ok) throw new Error("Failed to load book");
   return await response.text();
};



async function getBookContent(moodleEndpoint, bookId) {
  //book_content
  //https://vj.sied.utn.edu.ar/mod/book/view.php?id=1805&chapterid=580
  // https://vj.sied.utn.edu.ar/mod/book/tool/print/index.php?id=1805
  // https://vj.sied.utn.edu.ar/mod/book/view.php?id=1805&chapterid=578

  //const MOODLE_SITE_URL = "https://vj.sied.utn.edu.ar";
  /*
  const response = await fetch(
    `${moodleEndpoint}/mod/book/view.php?id=${bookId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          index: 0,
          methodname: "mod_book_get_book_contents",
          args: { bookid: bookId },
        },
      ]),
    }
  );
  */

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
   * Includes YouTube video cleanup and basic content sanitization.
   * @param {string} htmlString The full HTML content.
   * @returns {ParsedBook} An object containing the book title and chapters.
   */
  const parseBookContentConsole = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

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
        // This ensures the custom CSS takes full control of the appearance.
        titleEl.removeAttribute("style");
        titleEl
          .querySelectorAll("span, strong")
          .forEach((el) => el.removeAttribute("style"));
        // Remove the title element to avoid duplication in content
        titleEl.remove();
      }

      // 4. Content Cleanup/Fixes

      // **A. YouTube Video Cleanup (FIXED LOGIC)**
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
                // Use a dedicated class for styling the responsive container
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

  // -----------------------------------------------------------------------------------

  /**
   * Renders the structured book data to the current page's body with a modern, clean aesthetic.
   * @param {ParsedBook} data - The object containing bookTitle and chapters.
   */
  const renderParsedBookToBody = (data) => {
    // 1. Clear the current body content
    document.body.innerHTML = "";

    // 2. Define Modern Styles using Custom Properties (Best Practice for Theming)
    const styleSheet = `
        <style>
            /* CSS Custom Properties for easy theming (e.g., future dark mode) */
            :root {
                --color-text: #1f2937; /* Dark Gray */
                --color-background: #f9fafb; /* Light Gray */
                --color-primary: #10b981; /* Emerald Green for accents/links */
                --color-border: #e5e7eb; /* Light border */
                --max-width: 800px;
                --spacing-unit: 1.5rem;
            }

            body {
                background-color: var(--color-background);
                color: var(--color-text);
                /* Professional, accessible font stack */
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                line-height: 1.7; /* Increased for better reading */
                font-size: 1.125rem; /* Larger base font for readability */
                padding: 0;
            }

            #parsed-book-container {
                max-width: var(--max-width);
                padding: 4rem 2rem;
                margin: 0 auto;
                background: white; /* Content container visually separates from background */
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* Subtle shadow */
            }

            /* --- Headings --- */
            h1 {
                font-size: 2.5rem;
                font-weight: 800;
                color: #000;
                margin-bottom: 0;
            }
            .book-subtitle {
                font-size: 1.25rem;
                color: #6b7280;
                margin-bottom: 3rem;
                font-weight: 300;
            }

            /* Overriding problematic inline styles from source for clean hierarchy */
            #parsed-book-container h1, 
            #parsed-book-container h2, 
            #parsed-book-container h3, 
            #parsed-book-container h4 {
                color: inherit !important;
                font-size: unset !important;
                font-weight: unset !important;
                margin-top: 2rem;
                margin-bottom: 1rem;
            }
            
            /* Chapter Title (H2 equivalent) */
            .chapter-title {
                font-size: 2rem;
                font-weight: 700;
                color: var(--color-text);
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--color-border);
                margin-top: 4rem; /* More space between chapters */
            }

            /* Section Title (H3 equivalent) */
            .section-title {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--color-text);
                margin-top: 3rem;
            }


            /* --- Content --- */
            #parsed-book-container p, 
            #parsed-book-container li {
                margin-bottom: 1.2rem;
                font-family: inherit !important;
                font-size: 1.125rem;
            }
            #parsed-book-container ul, 
            #parsed-book-container ol {
                padding-left: 1.5rem;
                margin-bottom: 2rem;
            }
            
            /* Links */
            #parsed-book-container a {
                color: var(--color-primary);
                text-decoration: none;
                transition: color 0.2s;
            }
            #parsed-book-container a:hover {
                text-decoration: underline;
                color: #059669; /* Slightly darker shade on hover */
            }
            
            /* Responsive Video Embed */
            .responsive-video-container {
                position: relative;
                width: 100%;
                padding-bottom: 56.25%; /* 16:9 aspect ratio */
                height: 0;
                overflow: hidden;
                margin: 2rem 0;
                background: #000;
            }
            .responsive-video-container iframe {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: 0;
            }
        </style>
    `;

    document.head.insertAdjacentHTML("beforeend", styleSheet);

    // 3. Create the main container
    const bookContainer = document.createElement("div");
    bookContainer.id = "parsed-book-container";

    // 4. Add the main Book Title and Subtitle
    const titleHeader = document.createElement("h1");
    titleHeader.textContent = data.bookTitle;
    bookContainer.appendChild(titleHeader);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Rendered for optimal readability.";
    subtitle.className = "book-subtitle";
    bookContainer.appendChild(subtitle);

    // 5. Loop through and add each chapter
    data.chapters.forEach((chapter) => {
      const chapterDiv = document.createElement("div");
      chapterDiv.id = `ch-${chapter.id}`;

      // Use a generic class for consistent styling
      const chapterTitle = document.createElement("h2");
      chapterTitle.textContent = chapter.title;
      chapterTitle.className = "chapter-title";
      chapterDiv.appendChild(chapterTitle);

      // Chapter Content insertion
      chapterDiv.insertAdjacentHTML("beforeend", chapter.content);

      bookContainer.appendChild(chapterDiv);
    });

    // 6. Append the final container to the document body
    document.body.appendChild(bookContainer);

    console.log(
      `✅ Successfully rendered "${data.bookTitle}" with ${data.chapters.length} chapters in a modern format.`
    );
  };

  // -----------------------------------------------------------------------------------

  // --- EXECUTION BLOCK: FETCH, PARSE, and RENDER ---

  (async () => {
    // URL targeting the print view of the Moodle book module
    const url = `https://vj.sied.utn.edu.ar/mod/book/tool/print/index.php?id=${bookId}`;
    console.log(`Fetching content from: ${url}`);

    try {
      const response = await fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const htmlContent = await response.text();
      console.log("Fetch successful. Starting parsing and cleanup...");

      const parsedBookData = parseBookContentConsole(htmlContent);

      console.log("--- ✅ PARSING COMPLETE ---");

      // 1. Store data globally for debugging
      window.parsedBookData = parsedBookData;

      // 2. Render the cleaned content to the page
      renderParsedBookToBody(parsedBookData);
      return parsedBookData;
    } catch (error) {
      console.error(
        "❌ An error occurred during fetch, parsing, or rendering:",
        error
      );
    }
  })();
}