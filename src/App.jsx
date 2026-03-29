import React, { useState, useCallback } from "react";
import { useMoodle } from "./hooks/useMoodle";
import { useWebMCP } from "./hooks/useWebMCP";
import DashboardView from "./components/DashboardView";
import ClassView from "./components/ClassView";
import BookReader from "./components/BookReader";
import { VideoPlayer } from "./components/VideoPlayer";
import { fetchCourseDetails, fetchBookContentHTML } from "./api/moodle";
import { processZoomRecording, findVideoInMinio } from "./api/zoomProcessor";
import { Logo, Sidebar, BackToMoodleButton } from "./components/ui"; // Assuming you split these out
import { Menu, X, Sparkles } from "lucide-react";

import { dbService } from "./db/service";
import { ingestMoodleBook, ingestZoomRecording } from "./db/pgliteIngest";

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
  const [videoResource, setVideoResource] = useState(null);
  const [uiLoading, setUiLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null); // { current: number, total: number }
  const [syncLogs, setSyncLogs] = useState([]); // Console mini logs
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
      const dbRes = await dbService.getResourceById(res.id);

      if (isBook) {
        console.log(`[App] 📖 Loading Book: ${res.id}`);
        const html = await fetchBookContentHTML(session.url, res.id);
        
        console.log(`[App] 💾 Ingesting Moodle Book into PGlite FTS...`);
        // The ingest engine internally truncates old chapters and replaces FTS records safely
        await ingestMoodleBook(res.id, res.course?.id || selectedCourse?.id || '0', session.url, res.name, html);
        
        setBookContent(html);
        setBookAnchor(startTime); // we reuse startTime param for anchor IDs
        setCurrentView(VIEWS.BOOK);
      } else if (isZoom) {
        // Support direct videoUrl from resource or from DB
        const videoUrl = res.videoUrl || dbRes?.videoUrl;
        const vttUrl = res.vttUrl || dbRes?.vttUrl;
        
        console.log(`[App] 🎥 Opening Zoom Player: ${res.id}. URL exists? ${!!videoUrl}`);
        if (videoUrl) {
          setVideoResource({ 
            ...res, 
            videoUrl: videoUrl, 
            vttUrl: vttUrl,
            startTime: startTime // Pass the timestamp here
          });
          setCurrentView(VIEWS.VIDEO);
        } else {
          try {
             let cName = selectedCourse?.fullname;
             if (!cName && res.course?.id) {
                try {
                   const c = await dbService.getCoursesCollection().find(res.course.id.toString());
                   if (c) cName = c.fullname;
                } catch(e) { }
             }
             console.log(`[App] 🕵️ Minio fallback search -> courseName: "${cName}", resource: "${res.name}"`);
             const foundUrls = await findVideoInMinio(cName, res.name, res.id);
          
             if (foundUrls) {
               console.log(`[App] ✨ Found in Minio Headless! URLs:`, foundUrls);
               try {
                  const vttRes = await fetch(foundUrls.vttUrl);
                  const text = vttRes.ok ? await vttRes.text() : '';
                  // Ingest direct
                  await ingestZoomRecording(res.id, res.course?.id || selectedCourse?.id || '0', res.name, null, text, "Auto-indexado remoto localmente");
                  
                  setVideoResource({ 
                    ...res, 
                    videoUrl: foundUrls.mp4Url, 
                    vttUrl: foundUrls.vttUrl,
                    startTime: startTime 
                  });
                  setCurrentView(VIEWS.VIDEO);
               } catch (e) {
                  console.error(`[App] ❌ Error syncing metadata after Minio hit`, e);
                  setVideoResource({ 
                    ...res, 
                    videoUrl: foundUrls.mp4Url, 
                    vttUrl: foundUrls.vttUrl,
                    startTime: startTime
                  });
                  setCurrentView(VIEWS.VIDEO);
               }
             } else {
               console.log(`[App] 🚫 Not found in Minio fallback.`);
               alert('Este video aún no ha sido sincronizado (procesado). Hacé click en el botón de la tarjeta o corré el Download All Content del Inicio.');
             }
          } catch(e) {
             console.error("[App] 🔥 Error minio query", e);
             alert("Error buscando el video en Minio.");
          }
        }
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
    if (!session.key) return;
    
    // Switch to non-blocking background mode
    setGlobalSyncing(true);
    setSyncStatus("Iniciando sincronización global...");
    setSyncLogs([]);
    
    const addSyncLog = (msg) => {
      setSyncLogs(prev => {
        const newLogs = [...prev, msg];
        return newLogs.slice(-4); // Keep only the last 4 logs
      });
    };
    
    let stats = { courses: 0, books: 0, zoomSuccess: 0, zoomFailed: 0, skipped: 0 };
    
    try {
      const dbCourses = await dbService.getCoursesCollection().query().fetch();
      setSyncProgress({ current: 0, total: dbCourses.length });
      
      for (let i = 0; i < dbCourses.length; i++) {
        const course = dbCourses[i];
        setSyncProgress({ current: i + 1, total: dbCourses.length });
        setSyncStatus(`Analizando materia: ${course.fullname}`);
        addSyncLog(`>> [${course.shortname}] Iniciando...`);
        const details = await fetchCourseDetails(session.url, session.key, course.id);
        
        stats.courses++;
        
        // Caching course tree
        await dbService.saveFullCourseData(course.id, details);

        console.log(`[SYNC DEBUG] Course ${course.id}: "${course.fullname}"`);
        if (details.cm) {
          for (const mod of details.cm) {
            const modLower = mod.modname?.toLowerCase() || '';
            const isBook = modLower.includes('book') || modLower.includes('libro');
            const isZoom = modLower.includes('zoom') || modLower.includes('clase en vivo');
            
            // Check delta sync
            if (isBook || isZoom) {
              const existingRes = await dbService.getResourceById(mod.id);
              if (existingRes && (existingRes.content || existingRes.videoUrl)) {
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
              const months = {
                enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
                julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
              };
              const match = mod.name.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})/i);
              
              if (match) {
                const day = parseInt(match[1], 10);
                const month = months[match[2].toLowerCase()];
                const year = parseInt(match[3], 10);
                const hour = parseInt(match[4], 10);
                const minute = parseInt(match[5], 10);
            
                const classDate = new Date(year, month, day, hour, minute);
                // Require the class to have finished (e.g. 2 hours after start) before processing
                const classEndTime = new Date(classDate.getTime() + 2 * 60 * 60 * 1000);
                if (classEndTime > new Date()) {
                  console.log(`[Sync All] ⏭️ Skipping future/ongoing Zoom class: "${mod.name}" (ID: ${mod.id}).`);
                  stats.skipped++;
                  continue;
                }
              }

              console.log(`[Sync All] 🎥 Processing Zoom: "${mod.name}" (ID: ${mod.id})`);
              setSyncStatus(`Transcribiendo Grabación: ${mod.name}`);
              addSyncLog(`🎥 [Zoom] Iniciando transcripción local...`);
              try {
                console.log(`[Sync All] 🚀 Firing processZoomRecording for ${mod.id}...`);
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
                
                console.log(`[Sync All] ✅ processZoomRecording result for ${mod.id}:`, result);
                if (result && result.success && result.text) {
                  // Ya no invocamos dbService.updateResourceContent aquí, processZoomRecording se encarga nativamente.
                  stats.zoomSuccess++;
                  addSyncLog(`✅ ¡Grabación procesada con éxito!`);
                } else {
                  console.warn(`[Sync All] ⚠️ Zoom failed for ${mod.id}:`, result.error || "No video available");
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
      alert(`¡Sincronización finalizada!\n\nMaterias revisadas: ${stats.courses}\nLibros descargados: ${stats.books}\nGrabaciones procesadas con éxito: ${stats.zoomSuccess}\nGrabaciones fallidas: ${stats.zoomFailed}`);
    } catch (e) {
      console.error(e);
      alert("La sincronización falló. Revisar consola.");
    } finally {
      setSyncStatus(null);
      setSyncProgress(null);
      setGlobalSyncing(false);
    }
  }, [session]);

  const handleCourseClick = useCallback(async (courseId) => {
    setUiLoading(true);
    try {
      const details = await fetchCourseDetails(session.url, session.key, courseId);

      // Save to DB for caching
      await dbService.saveFullCourseData(courseId, details);
      // filter courses by courseId and get fullname;
      const courseName = courses.find((course) => course.id === courseId)?.fullname;

      console.log("Course name: " + courseName);
      console.log("All Courses: " + courses);
      details.fullname = courseName;

      setSelectedCourse(details);
      setCurrentView(VIEWS.CLASS);
    } catch (e) {
      console.error(e);
    } finally {
      setUiLoading(false);
    }
  }, [session, courses]);

  // 4. WebMCP Integration
  useWebMCP({
    courses,
    session,
    handleCourseClick,
    handleSyncAll,
    dbService
  });

  // 4. Render
  return (
    <div className="min-h-screen bg-[#FEFDF9] text-stone-900 font-sans">

      {/* Mobile Header */}
      <div className="lg:hidden p-6 flex justify-between items-center sticky top-0 bg-[#FEFDF9]/90 backdrop-blur-md z-50">
        <Logo onClick={() => setCurrentView(VIEWS.DASHBOARD)} />
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen">

        {/* Main Content Area */}
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
                console.log(`[App] 🎬 Opening Video via onVideoClick:`, resource);
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

          {/* Give the dashboard a back button too, leading to normal moodle root */}
          {!uiLoading && currentView === VIEWS.DASHBOARD && (
            <BackToMoodleButton targetUrl={`${session?.url || ''}/my/index.php`} />
          )}
        </main>

        {/* Sidebar Component */}
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          currentView={currentView}
        />

      </div>
    </div>
  );
};

export default App;