import React, { useState, useCallback } from "react";
import { useMoodle } from "./hooks/useMoodle";
import { useWebMCP } from "./hooks/useWebMCP";

import DashboardView from "./components/DashboardView";
import ClassView from "./components/ClassView";
import BookReader from "./components/BookReader";
import { VideoPlayer } from "./components/VideoPlayer";
import { fetchCourseDetails, fetchBookContentHTML } from "./api/moodle";
import { processZoomRecording } from "./api/zoomProcessor";
import { Logo, Sidebar, BackToMoodleButton } from "./components/ui"; 
import { DownloadTracker } from "./components/DownloadTracker";
import { Menu, X, Sparkles } from "lucide-react";

import { ingestMoodleBook, ingestZoomRecording } from "./db/pgliteIngest";
import { getPgliteInstance } from "./db/pgliteSync";

// View Constants
const VIEWS = { DASHBOARD: "dashboard", CLASS: "class", BOOK: "book", VIDEO: "video" };

const App = () => {
  // 1. Data & State
  const { session, courses, loading } = useMoodle();

  // 2. Navigation State
  const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [bookContent, setBookContent] = useState(null);
  const [bookAnchor, setBookAnchor] = useState(null);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [videoResource, setVideoResource] = useState(null);
  const [uiLoading, setUiLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null); 
  const [syncLogs, setSyncLogs] = useState([]); 
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleResourceClick = useCallback(async (res, startTime = null) => {
    console.log(`[App] 🖱️ Clicked resource: "${res.name}" (ID: ${res.id})`);
    if (startTime) console.log(`[App] ⏱️ Seeking to timestamp: ${startTime}`);
    
    setUiLoading(true);
    try {
      const isBook = res.modname?.toLowerCase().includes('book') || res.modname?.toLowerCase().includes('libro') || res.module?.toLowerCase().includes('book');
      const isZoom = res.modname?.toLowerCase().includes('zoom') || res.modname?.toLowerCase().includes('clase en vivo') || res.module?.toLowerCase().includes('zoom') || res.type?.includes('zoom');
      
      console.log(`[App] 🔍 identified type: isBook=${isBook}, isZoom=${isZoom}`);

      if (isBook) {
        console.log(`[App] 📖 Loading Book: ${res.id}`);
        const db = await getPgliteInstance();
        const local = await db.query(`SELECT content_html FROM recursos WHERE id = $1`, [String(res.id)]);
        
        let html;
        if (local.rows && local.rows[0]?.content_html) {
          console.log(`[App] ⚡ Using local PGlite content for book ${res.id}`);
          html = local.rows[0].content_html;
        } else {
          console.log(`[App] 🌐 Fetching book content from Moodle...`);
          html = await fetchBookContentHTML(session.url, res.id);
          console.log(`[App] 💾 Ingesting Moodle Book into PGlite FTS...`);
          await ingestMoodleBook(res.id, res.course?.id || selectedCourse?.id || '0', session.url, res.name, html);
        }
        
        setBookContent(html);
        setBookAnchor(startTime); 
        setSelectedBookId(res.id);
        setCurrentView(VIEWS.BOOK);
      } else if (isZoom) {
        console.log(`[App] 🎥 Opening Zoom Player: ${res.id}`);
        setVideoResource({ 
          ...res, 
          videoUrl: `local://${res.id}`,  
          vttUrl: null,
          startTime: startTime,
          sessionUrl: session.url,          
          course: { id: res.course?.id || selectedCourse?.id, fullname: selectedCourse?.fullname }
        });
        setCurrentView(VIEWS.VIDEO);
      } else {
        if (res.url) {
           console.log(`[App] 🔗 External link click: ${res.url}`);
           window.open(res.url, '_blank');
        }
      }
    } catch (e) {
      console.error(`[App] 🔥 handleResourceClick Fatal Error:`, e);
      alert("Error abriendo recurso.");
    } finally {
      setUiLoading(false);
    }
  }, [session, selectedCourse]);

  // 3. Handlers
  const handleSyncAll = useCallback(async () => {
    if (!session.key || !courses || courses.length === 0) return;
    
    setGlobalSyncing(true);
    setSyncStatus("Iniciando sincronización global...");
    setSyncLogs([]);
    
    const addSyncLog = (msg) => {
      setSyncLogs(prev => {
        const newLogs = [...prev, msg];
        return newLogs.slice(-4); 
      });
    };
    
    let stats = { courses: 0, books: 0, zoomSuccess: 0, zoomFailed: 0, skipped: 0 };
    
    try {
      const db = await getPgliteInstance();
      setSyncProgress({ current: 0, total: courses.length });
      
      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        setSyncProgress({ current: i + 1, total: courses.length });
        setSyncStatus(`Analizando materia: ${course.fullname}`);
        addSyncLog(`>> [${course.shortname}] Iniciando...`);
        const details = await fetchCourseDetails(session.url, session.key, course.id);
        
        stats.courses++;
        
        console.log(`[SYNC DEBUG] Course ${course.id}: "${course.fullname}"`);
        if (details.cm) {
          for (const mod of details.cm) {
            const modLower = mod.modname?.toLowerCase() || '';
            const isBook = modLower.includes('book') || modLower.includes('libro');
            const isZoom = modLower.includes('zoom') || modLower.includes('clase en vivo');
            
            // Check delta sync
            if (isBook || isZoom) {
               const existing = await db.query(`SELECT id FROM recursos WHERE id = $1`, [String(mod.id)]);
               if (existing.rows && existing.rows.length > 0) {
                  console.log(`[Sync All] ⏭️ Skipping ${mod.modname} "${mod.name}" (ID: ${mod.id}). Already in local DB.`);
                  stats.skipped++;
                  continue;
               }
            }
            
            if (isBook) {
              console.log(`[Sync All] 📖 Processing Book: "${mod.name}" (ID: ${mod.id})`);
              setSyncStatus(`Descargando Libro: ${mod.name}`);
              addSyncLog(`📝 [Libro] ${mod.name}`);
              try {
                const html = await fetchBookContentHTML(session.url, mod.id);
                await ingestMoodleBook(mod.id, course.id, session.url, mod.name, html);
                stats.books++;
                console.log(`[Sync All] ✅ Book "${mod.name}" synced.`);
              } catch (e) {
                console.error(`[Sync All] ❌ Error fetching book ${mod.id}`, e);
                addSyncLog(`❌ Error en libro: ${mod.name}`);
              }
            } else if (isZoom) {
              console.log(`[Sync All] 🎥 Processing Zoom: "${mod.name}" (ID: ${mod.id})`);
              setSyncStatus(`Transcribiendo Grabación: ${mod.name}`);
              addSyncLog(`🎥 [Zoom] Iniciando transcripción local...`);
              try {
                const result = await processZoomRecording(
                  session.url,
                  course.id, 
                  mod.id, 
                  course.fullname, 
                  mod.name, 
                  (p) => {
                     console.log(`[Sync All] 🔄 Zoom Sub-progress (${mod.id}): ${p}`);
                     addSyncLog(`  - ${p}`);
                  }
                );
                
                if (result && result.success) {
                  stats.zoomSuccess++;
                  addSyncLog(`✅ Grabación descargada.`);
                } else {
                  console.warn(`[Sync All] ⚠️ Zoom failed for ${mod.id}:`, result?.error);
                  stats.zoomFailed++;
                  addSyncLog(`⚠️ Grabación fallida/no disponible.`);
                }
              } catch (e) {
                console.error(`[Sync All] 🔥 Fatal Error in Zoom Loop for ${mod.id}`, e);
                stats.zoomFailed++;
                addSyncLog(`❌ Error extremo.`);
              }
            }
          }
        }
      }
      alert(`¡Sincronización finalizada!\n\nMaterias revisadas: ${stats.courses}\nLibros descargados: ${stats.books}\nGrabaciones procesadas: ${stats.zoomSuccess}\nFallidas: ${stats.zoomFailed}\nOmitidas: ${stats.skipped}`);
    } catch (e) {
      console.error(e);
      alert("La sincronización falló. Revisar consola.");
    } finally {
      setSyncStatus(null);
      setSyncProgress(null);
      setGlobalSyncing(false);
    }
  }, [session, courses]);

  const handleCourseClick = useCallback(async (courseId) => {
    setUiLoading(true);
    try {
      const details = await fetchCourseDetails(session.url, session.key, courseId);
      const courseName = courses.find((course) => String(course.id) === String(courseId))?.fullname;

      details.fullname = courseName;
      setSelectedCourse(details);
      setCurrentView(VIEWS.CLASS);
    } catch (e) {
      console.error(e);
    } finally {
      setUiLoading(false);
    }
  }, [session, courses]);

  // 5. DB Persistence for Chapter Updates (Slides -> SVG)
  React.useEffect(() => {
    const handleChapterUpdate = async (e) => {
      const { chapterId, newHtml } = e.detail;
      if (!selectedBookId) return;

      try {
        const db = await getPgliteInstance();
        // 1. Update the fragmented chapter for search
        await db.query(`
          UPDATE capitulos_libros 
          SET content_html = $1 
          WHERE libro_id = $2 AND anchor_id = $3
        `, [newHtml, String(selectedBookId), chapterId]);

        // 2. Update the full book HTML in 'recursos' so it persists between sessions
        // We fetch the current full HTML, find the element, and replace it.
        const res = await db.query(`SELECT content_html FROM recursos WHERE id = $1`, [String(selectedBookId)]);
        if (res.rows && res.rows[0]?.content_html) {
           const parser = new DOMParser();
           const doc = parser.parseFromString(res.rows[0].content_html, 'text/html');
           const target = doc.getElementById(chapterId);
           if (target) {
              target.innerHTML = newHtml;
              const updatedFullHtml = doc.body.innerHTML;
              await db.query(`UPDATE recursos SET content_html = $1 WHERE id = $2`, [updatedFullHtml, String(selectedBookId)]);
              
              // Update local state so UI is reactive and exports include the new SVGs
              setBookContent(updatedFullHtml);
              
              console.log(`[App] ✅ Persisted SVG extraction for chapter ${chapterId} in book ${selectedBookId}`);
           }
        }
      } catch (err) {
        console.error("[App] Error persisting chapter update", err);
      }
    };

    window.addEventListener('MOODLE_CHAPTER_UPDATED', handleChapterUpdate);
    return () => window.removeEventListener('MOODLE_CHAPTER_UPDATED', handleChapterUpdate);
  }, [selectedBookId]);

  // 6. MCP Integrations (WebMCP)
  useWebMCP({ courses, session, handleCourseClick, handleSyncAll });

  // 7. Render
  return (
    <div className="min-h-screen bg-[#FEFDF9] text-stone-900 font-sans">
      <div className="lg:hidden p-6 flex justify-between items-center sticky top-0 bg-[#FEFDF9]/90 backdrop-blur-md z-50">
        <Logo onClick={() => setCurrentView(VIEWS.DASHBOARD)} />
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        <main className="col-span-1 lg:col-span-8 p-6 lg:p-12 pb-32">
          {uiLoading && (
            <div className="flex flex-col h-full items-center justify-center gap-6 animate-in fade-in duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center relative z-10 border border-indigo-50">
                   <span className="loading loading-spinner text-indigo-600 w-8 h-8"></span>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-stone-800">Cargando Moodle UX...</h3>
              </div>
            </div>
          )}

          {!uiLoading && currentView === VIEWS.DASHBOARD && (
            <DashboardView
              session={session}
              courses={courses}
              loading={loading}
              onCourseClick={handleCourseClick}
              onSyncAll={handleSyncAll}
              onResourceClick={handleResourceClick}
            />
          )}

          {!uiLoading && currentView === VIEWS.CLASS && selectedCourse && (
            <ClassView
              session={session}
              onNavigate={setCurrentView}
              currentCourse={selectedCourse}
              onBack={() => setCurrentView(VIEWS.DASHBOARD)}
              onResourceClick={handleResourceClick}
              onVideoClick={(resource) => {
                setVideoResource({
                  ...resource,
                  videoUrl: resource.videoUrl,
                  vttUrl: resource.vttUrl
                });
                setCurrentView(VIEWS.VIDEO);
              }}
            />
          )}

          {!uiLoading && currentView === VIEWS.BOOK && bookContent && (
            <BookReader
              htmlContent={bookContent}
              endpoint={session.url}
              anchorId={bookAnchor}
              onBack={() => setCurrentView(VIEWS.CLASS)}
            />
          )}

          {!uiLoading && currentView === VIEWS.VIDEO && videoResource && (
            <VideoPlayer
              resource={videoResource}
              onBack={() => setCurrentView(VIEWS.CLASS)}
            />
          )}

          {!uiLoading && currentView === VIEWS.DASHBOARD && (
            <BackToMoodleButton targetUrl={`${session?.url || ''}/my/index.php`} />
          )}
        </main>

        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          courseId={selectedCourse?.id}
          onResourceClick={handleResourceClick}
        />

        <DownloadTracker />
      </div>
    </div>
  );
};

export default App;