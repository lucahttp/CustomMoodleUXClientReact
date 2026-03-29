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
import { getPgliteInstance } from "../db/pgliteSync";
import { makeGlobalSearchQuery } from "../db/queries";

const VIEW_CLASS = "class";
const VIEW_DASHBOARD = "dashboard";

const DashboardView = memo(
  ({ session, onNavigate, courses, loading, onCourseClick, onSyncAll, onResourceClick }) => {
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
      console.log(`[Dashboard] 🖱️ handleCourseSelect ID: ${courseId}`);
      // Find course details to save to recents
      const course = courses?.find(c => c.id === courseId) || searchResults.courses.find(c => c.id === courseId);
      if (course) {
        console.log(`[Dashboard] 🕒 Updating recent courses with: ${course.fullname}`);
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
        console.log(`[Dashboard] 🛰️ Session confirmed. Fetching upcoming tasks...`);
        setLoadingTasks(true);
        fetchUpcomingTasks(session.url, session.key)
          .then(data => {
             console.log(`[Dashboard] 🛰️ Received ${data?.length || 0} tasks.`);
             setPendingTasks(data);
          })
          .catch(err => console.error("[Dashboard] 🔥 Error fetching tasks:", err))
          .finally(() => setLoadingTasks(false));
      }
    }, [session]);

    useEffect(() => {
      if (searchTerm.length > 2) {
        console.log(`[Dashboard] 🔎 Debouncing search for: "${searchTerm}"`);
        setIsSearching(true);
        const timeoutId = setTimeout(() => {
          console.log(`[Dashboard] 🔎 Executing DB search now...`);
          
          const runSearch = async () => {
            try {
              const db = await getPgliteInstance();
              const result = await db.query(makeGlobalSearchQuery(), [searchTerm]);
              
              // Formatting PGlite FTS output directly to UI expectations
              const resourcesTokens = result.rows.map(row => ({
                id: row.resource_id,
                name: row.resource_title,
                type: row.source_type === 'video' ? 'zoom' : 'book', // helps icon engine
                timestamp: row.source_type === 'video' ? row.deep_link_ref : null,
                anchor: row.source_type === 'book' ? row.deep_link_ref : null,
                snippet: row.snippet,
                rank: row.rank
              }));

              // We'll optionally keep course search from old dbService to not break everything while migrating
              let coursesOld = [];
              try {
                const oldRes = await dbService.search(searchTerm);
                coursesOld = oldRes.courses || [];
              } catch(e) {}

              console.log(`[Dashboard] 🔎 Search results received:`, { courses: coursesOld, resources: resourcesTokens });
              setSearchResults({ courses: coursesOld, resources: resourcesTokens });
            } catch (e) {
              console.error(`[Dashboard] 🔥 Search error:`, e);
            } finally {
               setIsSearching(false);
            }
          };
          runSearch();

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
                
                {searchResults.resources.map(r => {
                  return (
                    <div key={r.id} onClick={() => onResourceClick(r, r.timestamp || r.anchor)} className="p-5 flex items-start gap-4 bg-white border border-stone-200 rounded-xl cursor-pointer hover:border-violet-400 hover:shadow-md transition-all group">
                      <div className="p-3 bg-violet-50 text-violet-600 rounded-lg group-hover:bg-violet-100 transition-colors shrink-0">
                        {r.type.includes('zoom') || r.type.includes('clase') ? <MonitorPlay className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-stone-900 leading-tight truncate mr-2">{r.name}</h3>
                          {r.timestamp && (
                            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-bold tabular-nums">
                              <Clock className="w-3 h-3" />
                              {Number(r.timestamp).toFixed(1)}s
                            </span>
                          )}
                          {r.anchor && (
                            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold tabular-nums">
                              <BookOpen className="w-3 h-3" />
                              ir a sección
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-violet-600 uppercase font-semibold mt-1 tracking-wider">{r.type}</p>
                        
                        {r.snippet && (
                          <div 
                             className="mt-2 text-xs text-stone-500 italic bg-stone-50 p-2 rounded border border-stone-100 line-clamp-2"
                             dangerouslySetInnerHTML={{ __html: `...${r.snippet}...` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
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
