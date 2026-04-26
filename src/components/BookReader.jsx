import React, { useMemo, useEffect, useState } from 'react';
import { MonitorPlay, Download, FileDown, Printer, LayoutList, Presentation, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import TurndownService from 'turndown';
import { parseBookContent } from "../utils/bookParser";
import "./BookReader.css";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BookReader = ({ htmlContent, endpoint, anchorId, onBack }) => {
  const [viewMode, setViewMode] = useState('continuous'); // 'continuous' | 'slides'
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Helper to convert images to Base64
  const convertImagesToBase64 = async (container) => {
    const images = Array.from(container.querySelectorAll('img'));
    const promises = images.map(async (img) => {
      try {
        if (img.src.startsWith('data:')) return;
        
        const response = await fetch(img.src);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            img.src = reader.result;
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn("Could not convert image to base64", img.src, err);
      }
    });
    await Promise.all(promises);
  };

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

  // Hydrate Google Slides buttons after render
  useEffect(() => {
    const buttons = document.querySelectorAll('.gslide-convert-btn');
    const handlers = [];

    buttons.forEach(btn => {
      const iframeId = btn.getAttribute('data-iframe-id');
      const renderId = btn.getAttribute('data-render-id');
      const containerId = btn.getAttribute('data-container-id');
      
      const clickHandler = (e) => {
        e?.preventDefault();
        if (btn.disabled) return;
        
        const innerFrame = document.getElementById(iframeId);
        const renderDiv = document.getElementById(renderId);
        const iframeContainer = document.getElementById(containerId);
        const wrapper = btn.closest('.moodle-google-slides-wrapper');

        if (!innerFrame || !renderDiv) return;

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
            if (iframeContainer) iframeContainer.style.display = 'none';

            // Add a "Show Original" button if it doesn't exist
            if (!wrapper.querySelector('.gslide-show-original-btn')) {
              const showOriginalBtn = document.createElement('button');
              showOriginalBtn.className = 'gslide-show-original-btn';
              showOriginalBtn.innerHTML = 'Ver Interactivo';
              showOriginalBtn.style.cssText = 'cursor: pointer; background: #fff; color: #6b7280; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-family: inherit; font-size: 13px; border: 1px solid #e5e7eb; transition: all 0.2s; margin-left: 8px;';
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
      };

      btn.addEventListener('click', clickHandler);
      handlers.push({ btn, clickHandler });
    });

    return () => {
      handlers.forEach(({ btn, clickHandler }) => {
        btn.removeEventListener('click', clickHandler);
      });
    };
  }, [bookData, viewMode, currentSlide]);

  const exportToMarkdown = async () => {
    setIsExporting(true);
    try {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });

      // Keep SVGs in Markdown as raw HTML
      turndownService.addRule('keep-svg', {
        filter: ['svg'],
        replacement: (content, node) => {
          return '\n\n' + node.outerHTML + '\n\n';
        }
      });
      
      let fullMarkdown = `# ${bookData.bookTitle}\n\n`;
      
      for (const chapter of bookData.chapters) {
        fullMarkdown += `## ${chapter.title}\n\n`;
        
        // Try to get content from DOM to capture converted SVGs
        const domChapter = document.getElementById(chapter.id);
        const contentHtml = domChapter ? domChapter.querySelector('.prose').innerHTML : chapter.content;

        // Create a temporary element to process images
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        
        // Convert images to base64 within this chapter
        await convertImagesToBase64(tempDiv);
        
        fullMarkdown += turndownService.turndown(tempDiv.innerHTML) + '\n\n';
        fullMarkdown += '---\n\n'; 
      }

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
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      // Create a full representation of the book for the PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'fixed';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '800px'; // Standard width for PDF rendering
      pdfContainer.style.backgroundColor = 'white';
      pdfContainer.style.padding = '40px';
      pdfContainer.className = 'prose prose-lg max-w-none';
      
      pdfContainer.innerHTML = `
        <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 20px;">${bookData.bookTitle}</h1>
        <hr style="margin-bottom: 40px;"/>
      `;
      
      for (const chapter of bookData.chapters) {
        const chapterDiv = document.createElement('div');
        // Try to get content from DOM to capture converted SVGs
        const domChapter = document.getElementById(chapter.id);
        const contentHtml = domChapter ? domChapter.querySelector('.prose').innerHTML : chapter.content;
        
        chapterDiv.innerHTML = `
          <h2 style="font-size: 24px; font-weight: 700; margin-top: 40px; margin-bottom: 20px;">${chapter.title}</h2>
          <div class="chapter-content">${contentHtml}</div>
          <div style="page-break-after: always;"></div>
        `;
        pdfContainer.appendChild(chapterDiv);
      }
      
      document.body.appendChild(pdfContainer);

      // Process images to base64 before rendering
      await convertImagesToBase64(pdfContainer);

      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Handle multiple pages if needed
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${bookData.bookTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      document.body.removeChild(pdfContainer);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("Hubo un error generando el PDF.");
    } finally {
      setIsExporting(false);
    }
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
      await new Promise(r => setTimeout(r, 4000)); // Increased wait time for batch
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
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 shadow-sm rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95 disabled:opacity-50"
            title="Descargar como Markdown"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <FileDown className="w-4 h-4 text-indigo-500" />}
            <span>Markdown</span>
          </button>
          
          <button 
            onClick={exportToPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 shadow-sm rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95 disabled:opacity-50"
            title="Generar PDF Offline"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <Printer className="w-4 h-4 text-emerald-500" />}
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