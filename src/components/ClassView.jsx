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
import { dbService } from "../db/service";
import { parseZoomDate, agruparClasesPorFecha, formatearFechaClase } from "../utils/dateUtils";

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
  Video,
  Calendar
} from "lucide-react";

const VIEW_CLASS = "class";
const VIEW_DASHBOARD = "dashboard";
const VIEW_MODULE = "book";


const ClassView = memo(({ session, onNavigate, currentCourse, courseLoading, onResourceClick, onVideoClick }) => {

  const [activeFilter, setActiveFilter] = useState("All");
  const [zoomStatuses, setZoomStatuses] = useState({});

  const handleProcessZoom = async (e, resourceId, resourceName) => {
    e.stopPropagation();
    console.log(`[ClassView] 🖱️ Clicked "Procesar" on Zoom ID: ${resourceId} - ${resourceName}`);
    if (zoomStatuses[resourceId]?.loading) {
       console.log(`[ClassView] ⏳ Process already loading for ${resourceId}, ignoring click.`);
       return;
    }
    
    setZoomStatuses(prev => ({ ...prev, [resourceId]: { loading: true, status: 'Iniciando...' } }));
    
    // Process the video using the API
    console.log(`[ClassView] 🚀 Firing processZoomRecording for ${resourceId}...`);
    const result = await processZoomRecording(session.url, currentCourse?.id || '0', resourceId, currentCourse?.shortname || currentCourse?.fullname, resourceName, (status) => {
      console.log(`[ClassView] 🔄 Zoom Progress (${resourceId}): ${status}`);
      setZoomStatuses(prev => ({ ...prev, [resourceId]: { ...prev[resourceId], status } }));
    });
    
    console.log(`[ClassView] ✅ processZoomRecording returned:`, result);
    if (result.success) {
      // Save to database for persistence
      await dbService.updateResourceContent(resourceId, result.text, result.videoUrl, result.vttUrl);
      console.log(`[ClassView] 💾 Saved to DB. Now setting state with videoUrl:`, result.videoUrl);
      setZoomStatuses(prev => ({
        ...prev,
        [resourceId]: { loading: false, status: '¡Listo!', result: result.text, videoUrl: result.videoUrl, vttUrl: result.vttUrl }
      }));
      console.log(`[ClassView] 🎯 State set complete for ${resourceId}:`, { loading: false, status: '¡Listo!', videoUrl: result.videoUrl, vttUrl: result.vttUrl });
    } else {
      console.warn(`[ClassView] ❌ processZoomRecording failed:`, result.error);
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

  // Get all Zoom classes for the calendar view with parsed dates
  const zoomClasses = useMemo(() => {
    return visibleResources
      .filter(res => 
        res.module === 'zoomutnba' || 
        res.module === 'zoom' ||
        (res.name && res.name.toLowerCase().includes('clase en vivo'))
      )
      .map(res => ({
        ...res,
        fechaInfo: parseZoomDate(res.name)
      }))
      .sort((a, b) => {
        if (!a.fechaInfo || !b.fechaInfo) return 0;
        return a.fechaInfo.timestamp - b.fechaInfo.timestamp;
      });
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


        {/* Calendar / Timeline de Clases */}
        {zoomClasses.length > 0 && (
          <section>
            <h2 className="text-stone-600 text-sm font-semibold uppercase tracking-wider mb-6 ml-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Cronología de Clases
            </h2>
            
            {(() => {
              const { pasadas, futuras } = agruparClasesPorFecha(zoomClasses);
              
              return (
                <div className="space-y-6">
                  {/* Clases Pasadas */}
                  {pasadas.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 ml-1">
                        Clases grabadas ({pasadas.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pasadas.map((clase) => (
                          <ZoomClassCard 
                            key={clase.id} 
                            clase={clase} 
                            fechaInfo={clase.fechaInfo}
                            zoomStatus={zoomStatuses[clase.id]}
                            onProcess={handleProcessZoom}
                            onVideoClick={onVideoClick}
                            esPasada={true}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Clases Futuras */}
                  {futuras.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 ml-1">
                        Próximas clases ({futuras.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60">
                        {futuras.map((clase) => (
                          <ZoomClassCard 
                            key={clase.id} 
                            clase={clase} 
                            fechaInfo={clase.fechaInfo}
                            zoomStatus={null}
                            onProcess={null}
                            onVideoClick={null}
                            esPasada={false}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}


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
                      onResourceClick?.(resource);
                    } else if (resource.url) {
                      window.open(resource.url, '_blank');
                    }
                  }}
                >
                  {/* Zoom Action rendered inside children */}
                  {getTabCategoryForModule(resource.module).label === 'Clase Virtual' && (
                    <>
                        {console.log(`[ClassView] 🎬 Rendering buttons for resource ${resource.id}:`, resource.module, 'zoomStatuses:', zoomStatuses[resource.id])}
                        {zoomStatuses[resource.id]?.videoUrl ? (
                        <button 
                          className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVideoClick?.({
                              ...resource,
                              videoUrl: zoomStatuses[resource.id].videoUrl,
                              vttUrl: zoomStatuses[resource.id].vttUrl
                            });
                          }}
                        >
                          <PlayCircle size={14} />
                          Ver Video
                        </button>
                      ) : (
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
                    </>
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
                  {section.resources.filter(r => r.module !== 'zoomutnba').map((resource, index) => (
                    <div key={resource.id} className="flex flex-col gap-2">
                      <ResourceRowCard
                        title={resource.name}
                        type={resource.module}
                        color={getResourceColor(sectionIndex + index)}
                        onClick={() => {
                          if (resource.module === 'book') {
                            // onBookClick(resource.id); - removed since App handles it via onResourceClick
                            onResourceClick?.(resource);
                          } else if (resource.url) {
                            window.open(resource.url, '_blank');
                          }
                        }}
                      >
                       {resource.module === 'zoomutnba' && (
                              <>
                                 {console.log(`[ClassView] 🎬 Rendering buttons for resource ${resource.id} (zoomutnba):`, 'zoomStatuses:', zoomStatuses[resource.id])}
                                 {zoomStatuses[resource.id]?.videoUrl ? (
                                  <button 
                                    className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onVideoClick?.({
                                        ...resource,
                                        videoUrl: zoomStatuses[resource.id].videoUrl,
                                        vttUrl: zoomStatuses[resource.id].vttUrl
                                      });
                                    }}
                                  >
                                   <PlayCircle size={14} />
                                   Ver Video
                                 </button>
                               ) : (
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
                             </>
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

// Componente de tarjeta para clase en el calendario
const ZoomClassCard = memo(({ clase, fechaInfo, zoomStatus, onProcess, onVideoClick, esPasada }) => {
  const tituloCorto = clase.name?.replace(/\[Clase en vivo\]\s*/i, '') || clase.name;
  
  const bgClass = esPasada ? 'bg-white border-stone-200 hover:border-indigo-400' : 'bg-stone-50 border-stone-100';
  const textClass = esPasada ? 'text-stone-900' : 'text-stone-400';
  
  return (
    <div className={`p-4 rounded-xl border ${bgClass} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold text-sm leading-tight ${textClass} line-clamp-2`}>
            {tituloCorto}
          </h4>
          <p className={`text-xs mt-1 ${esPasada ? 'text-indigo-600' : 'text-stone-400'}`}>
            {fechaInfo ? formatearFechaClase(fechaInfo) : 'Sin fecha'}
          </p>
        </div>
        
        {esPasada && onProcess && (
          <div className="shrink-0">
            {zoomStatus?.videoUrl ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onVideoClick?.({
                    ...clase,
                    videoUrl: zoomStatus.videoUrl,
                    vttUrl: zoomStatus.vttUrl
                  });
                }}
                className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                title="Ver Video"
              >
                <PlayCircle size={16} />
              </button>
            ) : (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onProcess(e, clase.id, clase.name);
                }}
                disabled={zoomStatus?.loading}
                className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                title="Procesar"
              >
                {zoomStatus?.loading ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <Video size={16} />
                )}
              </button>
            )}
          </div>
        )}
        
        {!esPasada && (
          <div className="shrink-0 p-2 bg-stone-100 rounded-lg">
            <Clock size={16} className="text-stone-400" />
          </div>
        )}
      </div>
    </div>
  );
});

export default ClassView;