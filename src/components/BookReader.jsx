import React, { useMemo, useEffect } from 'react';
import { MonitorPlay } from 'lucide-react';
import { parseBookContent } from "../utils/bookParser";
import "./BookReader.css";

const BookReader = ({ htmlContent, onBack }) => {
  console.log("BookReader rendering");

  // Parse HTML string into Data Object
  const bookData = useMemo(() => {
    console.log("Parsing book content...");
    return parseBookContent(htmlContent);
  }, [htmlContent]);

  useEffect(() => {
    console.log("BookReader mounted");
    return () => console.log("BookReader unmounted");
  }, []);

  return (
    <div className="book-reader-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={onBack} className="mb-4 text-stone-500 hover:underline">
        ← Volver
      </button>

      <h1 className="text-4xl font-bold mb-2">{bookData.title}</h1>

      <div className="space-y-12 mt-8">
        {bookData.chapters.map((chapter, index) => (
          <div key={index} className="chapter-block">
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