import React, { useMemo } from 'react';
import { MonitorPlay } from 'lucide-react';
import "./BookReader.css"; // Move your large <style> string into a real CSS file

const BookReader = ({ htmlContent, onBack }) => {
  
  // Parse HTML string into Data Object
  const bookData = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    
    // ... Insert your existing 'parseBookContentConsole' logic here ...
    // BUT return the array of chapters instead of appending to body.
    
    const chapters = Array.from(doc.querySelectorAll(".book_chapter")).map(el => {
       // ... cleanup logic ...
       return { 
         id: el.id, 
         title: el.querySelector("h1, h2")?.textContent || "Chapter", 
         content: el.innerHTML 
       };
    });

    return { 
        title: doc.querySelector(".book_title")?.textContent || "Book", 
        chapters 
    };
  }, [htmlContent]);

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