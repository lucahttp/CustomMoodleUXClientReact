import React, { useMemo, useEffect } from 'react';
import { MonitorPlay } from 'lucide-react';
import { parseBookContent } from "../utils/bookParser";
import "./BookReader.css";

const BookReader = ({ htmlContent, endpoint, anchorId, onBack }) => {
  console.log("BookReader rendering");

  // Parse HTML string into Data Object
  const bookData = useMemo(() => {
    console.log("Parsing book content...");
    return parseBookContent(htmlContent, endpoint);
  }, [htmlContent, endpoint]);

  useEffect(() => {
    console.log("BookReader mounted, checking for deep link...");
    if (anchorId) {
        // Small delay to ensure the browser painted the parsed heights
        setTimeout(() => {
            const el = document.getElementById(anchorId);
            if (el) {
                console.log(`[BookReader] 📜 Scrolling to anchor: ${anchorId}`);
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
               console.warn(`[BookReader] ⚠️ Target anchor #${anchorId} not found in DOM.`);
            }
        }, 300);
    }
    return () => console.log("BookReader unmounted");
  }, [anchorId, bookData]);

  return (
    <div className="book-reader-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="mb-4 text-stone-500 hover:underline">
        ← Volver
      </button>

      <h1 className="text-4xl font-bold mb-2">{bookData.title}</h1>

      <div className="space-y-12 mt-8">
        {bookData.chapters.map((chapter, index) => (
          <div key={index} id={chapter.id} className="chapter-block">
            <h2 className="text-2xl font-semibold border-b pb-2 mb-4">
              {chapter.title}
            </h2>
            {/* Safe rendering of cleaned HTML */}
            <div
              className="prose prose-lg max-w-none prose-stone"
              dangerouslySetInnerHTML={{ __html: chapter.content }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookReader;