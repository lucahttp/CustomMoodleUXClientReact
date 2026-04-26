import React, { useMemo, useEffect } from 'react';
import { MonitorPlay, Download, FileDown, Printer } from 'lucide-react';
import TurndownService from 'turndown';
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

  const exportToMarkdown = () => {
    try {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });
      
      let fullMarkdown = `# ${bookData.title}\n\n`;
      bookData.chapters.forEach(chapter => {
        fullMarkdown += `## ${chapter.title}\n\n`;
        fullMarkdown += turndownService.turndown(chapter.content) + '\n\n';
      });

      const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export Markdown", err);
      alert("Hubo un error exportando el markdown.");
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="book-reader-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 print:hidden">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 hover:underline flex items-center gap-2 font-medium transition-colors w-fit">
          ← Volver
        </button>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToMarkdown}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 shadow-sm rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            title="Descargar como Markdown"
          >
            <FileDown className="w-4 h-4 text-indigo-500" />
            <span>Markdown</span>
          </button>
          
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 shadow-sm rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            title="Guardar como PDF o Imprimir"
          >
            <Printer className="w-4 h-4 text-emerald-500" />
            <span>PDF</span>
          </button>
        </div>
      </div>

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