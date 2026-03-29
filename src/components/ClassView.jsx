import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { 
  Logo, 
  Sidebar, 
  FilterPill, 
  ResourceRowCard, 
  getTabCategoryForModule, 
  BackToMoodleButton 
} from "./ui";
import { processZoomRecording } from "../api/zoomProcessor";

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
  Video
} from "lucide-react";

const VIEW_CLASS = "class";
const VIEW_DASHBOARD = "dashboard";
const VIEW_MODULE = "module";


const ClassView = memo(({ session, onNavigate, currentCourse, courseLoading, onBookClick }) => {

  const [activeFilter, setActiveFilter] = useState("All");
  const [zoomStatuses, setZoomStatuses] = useState({});

  const handleProcessZoom = async (e, resourceId, resourceName) => {
    e.stopPropagation();
    if (zoomStatuses[resourceId]?.loading) return;
    
    setZoomStatuses(prev => ({ ...prev, [resourceId]: { loading: true, status: 'Iniciando...' } }));
    
    // Process the video using the API
    const result = await processZoomRecording(session.url, resourceId, currentCourse?.shortname || currentCourse?.fullname, resourceName, (status) => {
      setZoomStatuses(prev => ({ ...prev, [resourceId]: { ...prev[resourceId], status } }));
    });
    
    if (result.success) {
      setZoomStatuses(prev => ({
        ...prev,
        [resourceId]: { loading: false, status: '¡Listo!', result: result.text }
      }));
    } else {
      setZoomStatuses(prev => ({
        ...prev,
        [resourceId]: { loading: false, status: 'Error', error: result.error }
      }));
    }
  };

  const getResourceColor = (index) => {
    const colors = ['beige', 'purple', 'pink', 'green'];
    return colors[index % colors.length];
  };

  const allResources = currentCourse?.cm || [];
  const sections = currentCourse?.section || [];

 

  const visibleResources = allResources.filter(resource => resource.uservisible !== false);

  // Derive dynamic filter categories
  const filterCategories = useMemo(() => {
    const categoryMap = new Map();
    visibleResources.forEach(res => {
      const cat = getTabCategoryForModule(res.module);
      if (!categoryMap.has(cat.label)) {
        categoryMap.set(cat.label, cat);
      }
    });
    return Array.from(categoryMap.values());
  }, [visibleResources]);

  // Filter the lists based on active tab
  const filteredVisibleResources = useMemo(() => {
    if (activeFilter === "All") return visibleResources;
    return visibleResources.filter(res => getTabCategoryForModule(res.module).label === activeFilter);
  }, [visibleResources, activeFilter]);

  const recentResources = filteredVisibleResources.slice(0, 6); // First 6 as "recent"

  const resourcesBySection = useMemo(() => {
    return sections
      .filter(section => section.visible && section.cmlist && section.cmlist.length > 0)
      .map(section => ({
        ...section,
        resources: section.cmlist
          .map(cmId => filteredVisibleResources.find(cm => cm.id === cmId.toString()))
          .filter(Boolean)
      }))
      .filter(section => section.resources.length > 0);
  }, [sections, filteredVisibleResources]);



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
          <div onClick={() => setActiveFilter("All")}>
            <FilterPill icon={LayoutGrid} label="All" active={activeFilter === "All"} />
          </div>
          {filterCategories.map((cat, idx) => (
            <div key={idx} onClick={() => setActiveFilter(cat.label)}>
               <FilterPill icon={cat.icon} label={cat.label} active={activeFilter === cat.label} />
            </div>
          ))}
        </div>



        {/* Recent Resources Grid */}
        {recentResources.length > 0 && activeFilter === "All" && (
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
                >
                  {/* Zoom Action rendered inside children */}
                  {getTabCategoryForModule(resource.module).label === 'Clase Virtual' && (
                    <button 
                      className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                      onClick={(e) => handleProcessZoom(e, resource.id, resource.name)}
                      disabled={zoomStatuses[resource.id]?.loading}
                    >
                      {zoomStatuses[resource.id]?.loading ? (
                         <span className="loading loading-spinner loading-xs"></span>
                      ) : <Video size={14} />}
                      {zoomStatuses[resource.id]?.status || "Procesar Grabación"}
                    </button>
                  )}
                </ResourceRowCard>
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
                    <div key={resource.id} className="flex flex-col gap-2">
                      <ResourceRowCard
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
                      >
                         {resource.module === 'zoomutnba' && (
                            <button 
                              className="px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                              onClick={(e) => handleProcessZoom(e, resource.id, resource.name)}
                              disabled={zoomStatuses[resource.id]?.loading}
                            >
                              {zoomStatuses[resource.id]?.loading ? (
                                 <span className="loading loading-spinner loading-xs"></span>
                              ) : <Video size={14} />}
                              {zoomStatuses[resource.id]?.status || "Procesar Grabación"}
                            </button>
                         )}
                      </ResourceRowCard>

                      {/* Render transcription if completed */}
                      {zoomStatuses[resource.id]?.result && (
                         <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl mt-1 text-sm text-stone-700 shadow-inner max-h-40 overflow-y-auto">
                            <strong>Transcripción:</strong> <br/>
                            {zoomStatuses[resource.id].result}
                         </div>
                      )}
                      
                      {zoomStatuses[resource.id]?.error && (
                         <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs mt-1 border border-red-200">
                           {zoomStatuses[resource.id].error}
                         </div>
                      )}
                    </div>
                  ))}
                </div>

              </div>

            ))

          )}

        </section>

      </>

    )}

  {/* Contextual Back To Moodle button */}
  {currentCourse?.id && (
    <BackToMoodleButton targetUrl={`${session?.url || ''}/course/view.php?id=${currentCourse.id}`} />
  )}
  </div>
  );
});

export default ClassView;