import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Logo, Sidebar, CourseCard } from "./ui"; // Assuming you split these out

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

const COURSES_RECENT = [
  { id: 1, title: "CCNA 2020 200-125 Video Boot Camp", color: "pink" },

  { id: 2, title: "Diseño 2D", color: "beige", onClickView: VIEW_CLASS }, // Link to Class View
];

const DashboardView = memo(
  ({ onNavigate, courses, loading, onCourseClick, onSyncAll }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState({ courses: [], resources: [] });

    useEffect(() => {
      if (searchTerm.length > 2) {
        dbService.search(searchTerm).then(setSearchResults);
      } else {
        setSearchResults({ courses: [], resources: [] });
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
                className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        {searchTerm.length > 2 && (
          <section>
            <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1">
              Search Results
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {searchResults.courses.map(c => (
                <div key={c.id} onClick={() => onCourseClick(c.id)} className="p-4 bg-white border border-stone-200 rounded-lg cursor-pointer hover:border-stone-400">
                  <h3 className="font-bold">{c.fullname}</h3>
                  <p className="text-sm text-stone-500">Curso</p>
                </div>
              ))}
              {searchResults.resources.map(r => (
                <div key={r.id} onClick={() => onCourseClick(r.course.id)} className="p-4 bg-white border border-stone-200 rounded-lg cursor-pointer hover:border-stone-400">
                  <h3 className="font-bold">{r.name}</h3>
                  <p className="text-sm text-stone-500">Recurso de {courses.find((course) => course.id === r.course.id)?.fullname}</p>
                </div>
              ))}
              {searchResults.courses.length === 0 && searchResults.resources.length === 0 && (
                <p className="text-stone-500">No se encontraron resultados.</p>
              )}
            </div>
          </section>
        )}

        {!searchTerm && (
          <>
            <section>
              <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1">
                Ultimos cursos vistos
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {COURSES_RECENT.map((course) => (
                  <CourseCard
                    key={course.id}
                    {...course}
                    onClick={() =>
                      course.onClickView ? onNavigate(course.onClickView) : null
                    }
                  />
                ))}
              </div>
            </section>
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
                          onClick={() => onCourseClick(course.id)}
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
