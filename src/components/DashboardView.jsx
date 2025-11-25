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

const VIEW_CLASS = "class";
const VIEW_DASHBOARD = "dashboard";

const COURSES_RECENT = [
  { id: 1, title: "CCNA 2020 200-125 Video Boot Camp", color: "pink" },

  { id: 2, title: "Diseño 2D", color: "beige", onClickView: VIEW_CLASS }, // Link to Class View
];

const DashboardView = memo(
  ({ onNavigate, courses, loading, courseColors, onCourseClick }) => (
    <div className="flex flex-col gap-12 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row gap-6 items-start md:items-center">
        <div className="hidden lg:block">
          <Logo onClick={() => onNavigate(VIEW_DASHBOARD)} />
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold uppercase tracking-tight text-stone-900 leading-tight max-w-3xl">
            Tecnicatura Universitaria en Desarrollo y Producción de Videojuegos
          </h1>
        </div>
      </header>

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
                    color={"#F5E1C0"}
                    onClick={() => onCourseClick(course.id)}
                  />
                )) ||
                COURSES_ALL.map((course) => (
                  <CourseCard key={course.id} {...course} />
                ))
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
);

export default DashboardView;
