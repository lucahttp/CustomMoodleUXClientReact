import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Logo, Sidebar, CourseCard } from "./ui"; // Assuming you split these out
import { fetchUpcomingTasks } from "../api/moodle";

import { motion, AnimatePresence } from "framer-motion";

import {
  Search,
  Clock,
  BookOpen,
  Menu,
  X,
  ChevronRight,
  LayoutGrid,
  Monitor,
  PlayCircle,
  Briefcase,
  Box,
  ArrowLeft,
  Folder,
  FileEdit,
  Headphones,
  MessagesSquare,
  Bug,
  Tag,
  MonitorPlay,
} from "lucide-react";

import { dbService } from "../db/service";

const VIEW_CLASS = "class";
const VIEW_DASHBOARD = "dashboard";

const DashboardView = memo(
  ({ session, onNavigate, courses, loading, onCourseClick, onSyncAll }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState({ courses: [], resources: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    // Initialize recent courses from localStorage
    const [recentCourses, setRecentCourses] = useState(() => {
      try {
        const saved = localStorage.getItem('mux-recent-courses');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    });

    const handleCourseSelect = useCallback((courseId) => {
      // Find course details to save to recents
      const course = courses?.find(c => c.id === courseId) || searchResults.courses.find(c => c.id === courseId);
      if (course) {
        setRecentCourses(prev => {
          const newRecent = [
            { id: course.id, title: course.fullname, color: course.color || "#F5E1C0", onClickView: VIEW_CLASS },
            ...prev.filter(c => c.id !== course.id)
          ].slice(0, 4); // Keep top 4 recent courses
          localStorage.setItem('mux-recent-courses', JSON.stringify(newRecent));
          return newRecent;
        });
      }
      onCourseClick(courseId);
    }, [courses, searchResults, onCourseClick]);

    useEffect(() => {
      if (session?.url && session?.key) {
        setLoadingTasks(true);
        fetchUpcomingTasks(session.url, session.key)
          .then(data => setPendingTasks(data))
          .catch(err => console.error("Error fetching tasks:", err))
          .finally(() => setLoadingTasks(false));
      }
    }, [session]);

    useEffect(() => {
      if (searchTerm.length > 2) {
        setIsSearching(true);
        const timeoutId = setTimeout(() => {
          dbService.search(searchTerm).then(results => {
            setSearchResults(results);
            setIsSearching(false);
          }).catch(() => {
            setIsSearching(false);
          });
        }, 300);
        return () => clearTimeout(timeoutId);
      } else {
        setSearchResults({ courses: [], resources: [] });
        setIsSearching(false);
      }
    }, [searchTerm]);

    return (
      <div className="flex flex-col gap-12 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex flex-col gap-6 items-start md:items-center md:flex-row">
            <div className="hidden lg:block">
              <Logo onClick={() => onNavigate(VIEW_DASHBOARD)} />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold uppercase tracking-tight text-stone-900 leading-tight max-w-3xl">
                Tecnicatura Universitaria en Desarrollo y Producción de Videojuegos
              </h1>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={onSyncAll}
              className="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              Download All Content
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search courses & resources..."
                className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 w-64 md:w-80 shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {searchTerm.length > 2 && (
          <section className="bg-stone-50/50 p-6 rounded-2xl border border-stone-100">
            <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2">
              <Search className="w-4 h-4" /> 
              Resultados de Búsqueda para "{searchTerm}"
            </h2>
            
            {isSearching ? (
              <div className="flex items-center gap-3 text-stone-500 py-4">
                <span className="loading loading-spinner loading-sm"></span>
                <span>Buscando...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.courses.map(c => (
                  <div key={c.id} onClick={() => handleCourseSelect(c.id)} className="p-5 flex items-start gap-4 bg-white border border-stone-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 leading-tight">{c.fullname}</h3>
                      <p className="text-xs text-indigo-600 uppercase font-semibold mt-1 tracking-wider">Materia</p>
                    </div>
                  </div>
                ))}
                
                {searchResults.resources.map(r => (
                  <div key={r.id} onClick={() => handleCourseSelect(r.course.id)} className="p-5 flex items-start gap-4 bg-white border border-stone-200 rounded-xl cursor-pointer hover:border-violet-400 hover:shadow-md transition-all group">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-lg group-hover:bg-violet-100 transition-colors">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 leading-tight">{r.name}</h3>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                        Recurso de <span className="font-medium text-violet-600">{courses.find((course) => course.id === r.course.id)?.fullname || "la materia"}</span>
                      </p>
                    </div>
                  </div>
                ))}
                
                {searchResults.courses.length === 0 && searchResults.resources.length === 0 && (
                  <div className="col-span-1 md:col-span-2 py-10 text-center text-stone-500 bg-white rounded-xl border border-stone-100">
                    <Search className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                    No se encontraron resultados para esta búsqueda.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {!searchTerm && (
          <>
            {/* Pending Tasks Section */}
            {(pendingTasks.length > 0 || loadingTasks) && (
              <section className="mb-4">
                <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Tareas Pendientes
                </h2>
                
                {loadingTasks ? (
                  <div className="flex items-center gap-3 text-stone-500 py-4">
                     <span className="loading loading-spinner loading-sm"></span>
                     <span>Cargando tareas...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingTasks.map(task => (
                      <div key={task.id} className="p-5 bg-white border border-orange-200 rounded-xl hover:border-orange-400 hover:shadow-md transition-all flex flex-col gap-2 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-stone-900 leading-tight line-clamp-2 pr-4 text-sm">{task.name}</h3>
                          <div className="p-1.5 bg-orange-50 text-orange-600 rounded">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <p className="text-xs text-stone-500 line-clamp-1 mt-auto">{task.course?.fullname || "Materia"}</p>
                        <p className="text-xs font-semibold text-orange-600">
                          Vence: {new Date(task.timesort * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {recentCourses.length > 0 && (
              <section>
                <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1">
                  Últimos cursos vistos
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recentCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      {...course}
                      onClick={() =>
                        course.onClickView ? handleCourseSelect(course.id) : null
                      }
                    />
                  ))}
                </div>
              </section>
            )}
            {!loading && (
              <section>
                <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1">
                  Todos los cursos
                </h2>

                {!loading && courses && courses.length === 0 ? (
                  <p className="text-stone-500">No hay cursos disponibles.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {loading ? (
                      <p className="text-stone-500">Cargando cursos...</p>
                    ) : (
                      courses?.map((course) => (
                        <CourseCard
                          key={course.id}
                          title={course.fullname}
                          color={course.color || "#F5E1C0"}
                          onClick={() => handleCourseSelect(course.id)}
                        />
                      ))
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    );
  });

export default DashboardView;
