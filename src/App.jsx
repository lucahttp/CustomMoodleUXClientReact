import React, { useState, useCallback } from "react";
import { useMoodle } from "./hooks/useMoodle";
import  DashboardView from "./components/DashboardView";
import ClassView from "./components/ClassView";
import BookReader from "./components/BookReader";
import { fetchCourseDetails, fetchBookContentHTML } from "./api/moodle";
import { Logo, Sidebar } from "./components/ui"; // Assuming you split these out
import { Menu, X } from "lucide-react";

// View Constants
const VIEWS = { DASHBOARD: "dashboard", CLASS: "class", BOOK: "book" };

const App = () => {
  // 1. Data & State
  const { session, courses, courseColors, loading } = useMoodle();
  
  // 2. Navigation State
  const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [bookContent, setBookContent] = useState(null);
  const [uiLoading, setUiLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 3. Handlers
  const handleCourseClick = useCallback(async (courseId) => {
    setUiLoading(true);
    try {
      const details = await fetchCourseDetails(session.url, session.key, courseId);
      setSelectedCourse(details);
      setCurrentView(VIEWS.CLASS);
    } catch (e) {
      console.error(e);
    } finally {
      setUiLoading(false);
    }
  }, [session]);

  const handleBookClick = useCallback(async (bookId) => {
    setUiLoading(true);
    try {
      const html = await fetchBookContentHTML(bookId);
      setBookContent(html);
      setCurrentView(VIEWS.BOOK);
    } catch (e) {
      console.error(e);
    } finally {
      setUiLoading(false);
    }
  }, []);

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
            <div className="flex h-full items-center justify-center">
              <span className="loading loading-spinner loading-lg text-stone-400"></span>
            </div>
          )}

          {!uiLoading && currentView === VIEWS.DASHBOARD  && (
            <DashboardView 
              courses={courses} 
              colors={courseColors} 
              loading={loading}
              onCourseClick={handleCourseClick} 
            />
          )}

          {!uiLoading && currentView === VIEWS.CLASS && selectedCourse && (
            <ClassView 
              onNavigate={setCurrentView}
              currentCourse={selectedCourse} 
              onBack={() => setCurrentView(VIEWS.DASHBOARD)}
              onBookClick={handleBookClick}
            />
          )}

          {!uiLoading && currentView === VIEWS.BOOK && bookContent && (
            <BookReader 
              htmlContent={bookContent}
              onBack={() => setCurrentView(VIEWS.CLASS)}
            />
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