import React, { useState, useCallback } from "react";
import { useMoodle } from "./hooks/useMoodle";
import { useWebMCP } from "./hooks/useWebMCP";
import DashboardView from "./components/DashboardView";
import ClassView from "./components/ClassView";
import BookReader from "./components/BookReader";
import { fetchCourseDetails, fetchBookContentHTML } from "./api/moodle";
import { processZoomRecording } from "./api/zoomProcessor";
import { Logo, Sidebar, BackToMoodleButton } from "./components/ui"; // Assuming you split these out
import { Menu, X, Sparkles } from "lucide-react";

import { dbService } from "./db/service";

// View Constants
const VIEWS = { DASHBOARD: "dashboard", CLASS: "class", BOOK: "book" };

const App = () => {
  // 1. Data & State
  const { session, courses, loading } = useMoodle();

  // 2. Navigation State
  const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [bookContent, setBookContent] = useState(null);
  const [uiLoading, setUiLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null); // { current: number, total: number }
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleBookClick = useCallback(async (bookId) => {
    setUiLoading(true);
    try {
      const html = await fetchBookContentHTML(session.url, bookId);
      setBookContent(html);
      setCurrentView(VIEWS.BOOK);
    } catch (e) {
      console.error(e);
    } finally {
      setUiLoading(false);
    }
  }, [session]);

  // 3. Handlers
  const handleSyncAll = useCallback(async () => {
    if (!session.key) return;
    
    // Switch to non-blocking background mode
    setGlobalSyncing(true);
    setSyncStatus("Iniciando sincronización global...");
    
    let stats = { courses: 0, books: 0, zoomSuccess: 0, zoomFailed: 0 };
    
    try {
      const dbCourses = await dbService.getCoursesCollection().query().fetch();
      setSyncProgress({ current: 0, total: dbCourses.length });
      
      for (let i = 0; i < dbCourses.length; i++) {
        const course = dbCourses[i];
        setSyncProgress({ current: i + 1, total: dbCourses.length });
        setSyncStatus(`Sincronizando materia: ${course.fullname}`);
        const details = await fetchCourseDetails(session.url, session.key, course.id);
        
        stats.courses++;
        
        // Caching course tree
        await dbService.saveFullCourseData(course.id, details);

        console.log(`[SYNC DEBUG] Course ${course.id}: "${course.fullname}"`);
        if (details.cm) {
          console.log(`[SYNC DEBUG] -> has ${details.cm.length} modules to scan.`);
          for (const mod of details.cm) {
            console.log(`[SYNC DEBUG]   -> Module: "${mod.name}" | Type: "${mod.modname}"`);
            
            const modLower = mod.modname?.toLowerCase() || '';
            const isBook = modLower.includes('book') || modLower.includes('libro');
            const isZoom = modLower.includes('zoom') || modLower.includes('clase en vivo');
            
            if (isBook) {
              setSyncStatus(`Descargando Libro: ${mod.name}`);
              try {
                // Fetch the HTML and strip it to save pure text for the full-text search engine
                const bookHtml = await fetchBookContentHTML(session.url, mod.id);
                if (bookHtml) {
                  const plainText = bookHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                            .replace(/<[^>]+>/g, ' ')
                                            .replace(/\s{2,}/g, ' ')
                                            .trim();
                  await dbService.updateResourceContent(mod.id, plainText);
                  stats.books++;
                }
              } catch (e) {
                console.error(`Error fetching book ${mod.id}`, e);
              }
            } else if (isZoom) {
              setSyncStatus(`Descargando Grabación: ${mod.name}`);
              try {
                // Wait for the entire transcribing process sequentially to not fry the GPU
                const result = await processZoomRecording(
                  session.url, 
                  mod.id, 
                  course.fullname, 
                  mod.name, 
                  (status) => {
                    setSyncStatus(`Grabación ${mod.name}: ${status}`);
                  }
                );
                
                // If we successfully received the transcribed VTT text, save it to the DB for full-text search
                if (result && result.success && result.text) {
                  await dbService.updateResourceContent(mod.id, result.text, result.videoUrl, result.vttUrl);
                  stats.zoomSuccess++;
                } else {
                  stats.zoomFailed++;
                  // pause 2 seconds so the user can read the error message on screen
                  await new Promise(r => setTimeout(r, 2000));
                }
              } catch (e) {
                console.error(`Error processing zoom ${mod.id}`, e);
                stats.zoomFailed++;
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
                <div className="absolute -top-2 -right-2 text-indigo-400 rotate-12">
                   <Sparkles className="w-5 h-5 animate-pulse" />
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
            />
          )}

          {!uiLoading && currentView === VIEWS.CLASS && selectedCourse && (
            <ClassView
              session={session}
              onNavigate={setCurrentView}
              currentCourse={selectedCourse}
              onBack={() => setCurrentView(VIEWS.DASHBOARD)}
              onBookClick={handleBookClick}
            />
          )}

          {!uiLoading && currentView === VIEWS.BOOK && bookContent && (
            <BookReader
              htmlContent={bookContent}
              endpoint={session.url}
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