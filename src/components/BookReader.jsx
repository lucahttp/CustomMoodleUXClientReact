import React, { useMemo, useEffect, useState } from 'react';
import { MonitorPlay, Download, FileDown, Printer, LayoutList, Presentation, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import TurndownService from 'turndown';
import { parseBookContent } from "../utils/bookParser";
import "./BookReader.css";

const BookReader = ({ htmlContent, endpoint, anchorId, onBack }) => {
  const [viewMode, setViewMode] = useState('continuous'); // 'continuous' | 'slides'
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);

  // Parse HTML string into Data Object
  const bookData = useMemo(() => {
    return parseBookContent(htmlContent, endpoint);
  }, [htmlContent, endpoint]);

  // If anchorId changes, we might want to switch to continuous and scroll
  useEffect(() => {
    if (anchorId) {
      setViewMode('continuous');
      setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    }
  }, [anchorId, bookData]);

  const exportToMarkdown = () => {
    try {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });

      // Keep SVGs in Markdown as raw HTML (most modern viewers support this)
      turndownService.addRule('keep-svg', {
        filter: ['svg'],
        replacement: (content, node) => {
          return '\n\n' + node.outerHTML + '\n\n';
        }
      });
      
      let fullMarkdown = `# ${bookData.bookTitle}\n\n`;
      bookData.chapters.forEach(chapter => {
        fullMarkdown += `## ${chapter.title}\n\n`;
        fullMarkdown += turndownService.turndown(chapter.content) + '\n\n';
        fullMarkdown += '---\n\n'; // Slide separator
      });

      const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookData.bookTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
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

  const convertAllSlides = async () => {
    const buttons = Array.from(document.querySelectorAll('.gslide-convert-btn'));
    if (buttons.length === 0) {
      alert("No se encontraron Google Slides en esta unidad.");
      return;
    }

    setIsConvertingAll(true);
    let count = 0;
    
    for (const btn of buttons) {
      // If already converted (marked with checkmark), skip
      if (btn.innerText.includes('✓')) continue;
      
      btn.click();
      count++;
      setConversionProgress(Math.round((count / buttons.length) * 100));
      
      // Wait a bit for the extraction to finish or at least start processing
      await new Promise(r => setTimeout(r, 2000));
    }
    
    setIsConvertingAll(false);
    alert("Proceso de conversión masiva finalizado.");
  };

  const nextSlide = () => {
    if (currentSlide < bookData.chapters.length - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <div className="book-reader-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 print:hidden">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 hover:underline flex items-center gap-2 font-medium transition-colors w-fit">
          ← Volver
        </button>
        
        <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-xl">
           <button 
             onClick={() => setViewMode('continuous')}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'continuous' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
           >
             <LayoutList size={16} />
             <span>Continuo</span>
           </button>
           <button 
             onClick={() => setViewMode('slides')}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'slides' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
           >
             <Presentation size={16} />
             <span>Slides</span>
           </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportToMarkdown}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 shadow-sm rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95"
            title="Descargar como Markdown"
          >
            <FileDown className="w-4 h-4 text-indigo-500" />
            <span>Markdown</span>
          </button>
          
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 shadow-sm rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95"
            title="Guardar como PDF o Imprimir"
          >
            <Printer className="w-4 h-4 text-emerald-500" />
            <span>PDF</span>
          </button>

          <button 
            onClick={convertAllSlides}
            disabled={isConvertingAll}
            className={`flex items-center gap-2 px-3 py-2 border shadow-sm rounded-xl text-sm font-semibold transition-all active:scale-95 ${isConvertingAll ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'}`}
            title="Convertir todas las Google Slides a SVG para verlas sin internet"
          >
            <Sparkles className={`w-4 h-4 ${isConvertingAll ? 'animate-pulse text-indigo-600' : 'text-amber-500'}`} />
            <span>{isConvertingAll ? `Convirtiendo (${conversionProgress}%)` : 'Offline Slides'}</span>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-black text-stone-900 tracking-tight mb-2">{bookData.bookTitle}</h1>
        <div className="h-1.5 w-24 bg-indigo-500 rounded-full"></div>
      </div>

      {viewMode === 'continuous' ? (
        <div className="space-y-16 mt-8 pb-20">
          {bookData.chapters.map((chapter, index) => (
            <div key={index} id={chapter.id} className="chapter-block group animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-center gap-4 mb-6">
                 <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-100 text-stone-500 text-xs font-bold border border-stone-200">
                    {index + 1}
                 </span>
                 <h2 className="text-2xl font-bold text-stone-800">
                    {chapter.title}
                 </h2>
              </div>
              <div
                className="prose prose-lg max-w-none prose-stone prose-headings:text-stone-800 prose-p:text-stone-600 prose-strong:text-stone-900 bg-white p-8 lg:p-12 rounded-[2.5rem] shadow-sm border border-stone-100"
                dangerouslySetInnerHTML={{ __html: chapter.content }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="slides-container relative min-h-[600px] flex flex-col gap-6 pb-20">
            <div className="flex-1 flex flex-col">
                <div className="bg-white rounded-[3rem] shadow-xl border border-stone-100 overflow-hidden flex flex-col min-h-[500px] animate-in zoom-in-95 duration-300">
                    <div className="bg-stone-50 px-8 py-6 border-b border-stone-100 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-stone-800 line-clamp-1">
                            {bookData.chapters[currentSlide]?.title}
                        </h2>
                        <span className="text-stone-400 font-mono text-sm font-bold">
                            {currentSlide + 1} / {bookData.chapters.length}
                        </span>
                    </div>
                    
                    <div className="flex-1 p-8 lg:p-16 overflow-y-auto">
                        <div
                          className="prose prose-xl max-w-none prose-stone"
                          dangerouslySetInnerHTML={{ __html: bookData.chapters[currentSlide]?.content }}
                        />
                    </div>
                </div>
            </div>

            {/* Slide Navigation Overlay */}
            <div className="flex items-center justify-center gap-4 mt-4 print:hidden">
                <button 
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                  className="p-4 rounded-full bg-white shadow-lg border border-stone-100 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-50 transition-all active:scale-90"
                >
                    <ChevronLeft size={24} />
                </button>
                
                <div className="flex gap-1.5 px-4">
                    {bookData.chapters.map((_, i) => (
                        <div 
                          key={i} 
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-indigo-500' : 'w-2 bg-stone-200'}`}
                        />
                    ))}
                </div>

                <button 
                  onClick={nextSlide}
                  disabled={currentSlide === bookData.chapters.length - 1}
                  className="p-4 rounded-full bg-white shadow-lg border border-stone-100 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-50 transition-all active:scale-90"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default BookReader;