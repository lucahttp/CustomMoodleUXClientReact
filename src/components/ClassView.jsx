import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Logo, Sidebar, FilterPill, ResourceRowCard  } from "./ui"; // Assuming you split these out
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
const VIEW_MODULE = "module";


const ClassView = memo(({ onNavigate, currentCourse, courseLoading, onBookClick }) => {

  // Helper function to determine resource type based on module name





  // Helper to assign colors in a cycle

  const getResourceColor = (index) => {

    const colors = ['beige', 'purple', 'pink', 'green'];

    return colors[index % colors.length];

  };



  // Extract all course modules (resources) with section info

  const allResources = currentCourse?.cm || [];

  const sections = currentCourse?.section || [];

 

  // Filter visible resources (uservisible === true)

  const visibleResources = allResources.filter(resource => resource.uservisible !== false);

  const recentResources = visibleResources.slice(0, 6); // First 6 as "recent"



  // Group resources by section

  const resourcesBySection = sections

    .filter(section => section.visible && section.cmlist && section.cmlist.length > 0)

    .map(section => ({

      ...section,

      resources: section.cmlist

        .map(cmId => allResources.find(cm => cm.id === cmId.toString()))

        .filter(cm => cm && cm.uservisible !== false)

    }))

    .filter(section => section.resources.length > 0);



  const courseName = currentCourse?.fullname || 'unknown course';



  return (

    <div className="flex flex-col gap-8 animate-in slide-in-from-right-8 duration-500">

    <header className="flex items-center gap-6">

      <div className="hidden lg:block">

        <Logo onClick={() => onNavigate(VIEW_DASHBOARD)} />

      </div>

      <div className="flex flex-col">

        <button

          onClick={() => onNavigate(VIEW_DASHBOARD)}

          className="flex items-center text-stone-400 hover:text-stone-600 text-sm mb-1 transition-colors w-fit"

        >

          <ArrowLeft size={16} className="mr-1" /> Volver al inicio

        </button>

        <h1 className="text-3xl md:text-4xl font-bold text-stone-900">

          {courseName}

        </h1>

      </div>

    </header>



    {courseLoading ? (

      <div className="flex items-center justify-center py-12">

        <p className="text-stone-500">Cargando recursos del curso...</p>

      </div>

    ) : !currentCourse ? (

      <div className="flex items-center justify-center py-12">

        <p className="text-stone-500">No se pudo cargar el curso</p>

      </div>

    ) : (

      <>

        {/* Filter Bar */}

        <div className="flex flex-wrap gap-3 overflow-x-auto pb-2 no-scrollbar">

          <FilterPill icon={LayoutGrid} label="All" active />

          <FilterPill icon={Monitor} label="Clase Virtual" />

          <FilterPill icon={PlayCircle} label="Material" />

          <FilterPill icon={Briefcase} label="Tarea" />

          <FilterPill icon={Box} label="Interior" />

        </div>



        {/* Recent Resources Grid */}

        {recentResources.length > 0 && (

          <section>

            <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1">

              Últimos recursos vistos de la materia

            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {recentResources.map((resource, index) => (

                <ResourceRowCard

                  key={resource.id}

                  title={resource.name}

                  type={resource.module}

                  color={getResourceColor(index)}

                  onClick={() => {

                    if (resource.module === 'book') {

                      onNavigate(VIEW_MODULE);

                    } else if (resource.url) {

                      window.open(resource.url, '_blank');

                    }

                  }}

                />

              ))}

            </div>

          </section>

        )}



        {/* All Resources Grid - Organized by Sections */}

        <section className="space-y-8">

          <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1">

            Todos los recursos de la materia

          </h2>



          {resourcesBySection.length === 0 ? (

            <p className="text-stone-500">No hay recursos disponibles</p>

          ) : (

            resourcesBySection.map((section, sectionIndex) => (

              <div key={section.id} className="space-y-4">

                {/* Section Title */}

                <h3 className="text-stone-700 text-base font-semibold ml-1 flex items-center gap-2">

                  <span className="text-stone-400 font-normal text-sm">#{section.number}</span>

                  {section.title}

                </h3>

               

                {/* Section Resources */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {section.resources.map((resource, index) => (

                    <ResourceRowCard

                      key={resource.id}

                      title={resource.name}

                      type={resource.module}

                      color={getResourceColor(sectionIndex + index)}

                      onClick={() => {

                        if (resource.module === 'book') {

                          onBookClick(resource.id);

                          onNavigate(VIEW_MODULE);

                        } else if (resource.url) {

                          window.open(resource.url, '_blank');

                        }

                      }}

                    />

                  ))}

                </div>

              </div>

            ))

          )}

        </section>

      </>

    )}

  </div>

  );

});

export default ClassView;