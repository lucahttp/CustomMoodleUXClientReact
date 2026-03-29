import React, { memo, useEffect, useState, useRef } from 'react';
import { Plyr } from 'plyr-react';
import 'plyr/dist/plyr.css';
import { ArrowLeft, Clock } from 'lucide-react';
import { getFileFromOPFS } from '../db/opfs';
import { getPgliteInstance } from '../db/pgliteSync';

export const VideoPlayer = memo(({ resource, onBack }) => {
  const [videoSrc, setVideoSrc] = useState(null);
  const [vttSrc, setVttSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef(null);

  // Helper to convert HH:MM:SS.mmm to seconds
  const timeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    try {
      const parts = timeStr.split(':');
      if (parts.length !== 3) return 0;
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      return h * 3600 + m * 60 + s;
    } catch (e) {
      return 0;
    }
  };

  useEffect(() => {
    console.log(`[VideoPlayer] 🎬 Mounting player for: "${resource.name}" (ID: ${resource.id})`);
    if (resource.startTime) console.log(`[VideoPlayer] ⏱️ Targeted startTime: ${resource.startTime}`);
    
    async function loadVideo() {
      try {
        // Si proviene del Sync Local DB:
        if (resource.videoUrl && String(resource.videoUrl).startsWith('blob://')) {
          const db = await getPgliteInstance();
          
          // 1. Obtener MP4 de OPFS
          const videoFile = await getFileFromOPFS(`zoom-${resource.id}.mp4`);
          if (videoFile) {
             setVideoSrc(URL.createObjectURL(videoFile));
          }

          // 2. Reconstruir VTT desde los fragmentos FTS indexados para mostrar los subtitulos en Plymouth
          const vttRows = await db.query(`SELECT start_time, text_content FROM transcripciones_video WHERE video_id = $1 ORDER BY start_time ASC`, [String(resource.id)]);
          if (vttRows.rows.length > 0) {
              let vttText = "WEBVTT\n\n";
              for (let i = 0; i < vttRows.rows.length; i++) {
                  const row = vttRows.rows[i];
                  // Si no hay end_time (por chunking lazy), usamos el start_time del siguiente fragmento o 1 hora mas para el ultimo
                  const nextRow = vttRows.rows[i+1];
                  let endTime = nextRow ? nextRow.start_time : "99:59:59.999";
                  
                  vttText += `${row.start_time} --> ${endTime}\n${row.text_content}\n\n`;
              }
              const vttBlob = new Blob([vttText], { type: 'text/vtt' });
              setVttSrc(URL.createObjectURL(vttBlob));
          }
        } else {
          setVideoSrc(resource.videoUrl);
          setVttSrc(resource.vttUrl);
        }
      } catch (e) {
        console.error(`[VideoPlayer] ❌ Error loading video:`, e);
      } finally {
        setLoading(false);
      }
    }
    
    loadVideo();
  }, [resource]);

  // Handle seeking when player is ready
  useEffect(() => {
    if (!loading && resource.startTime && playerRef.current?.plyr) {
      const seconds = timeToSeconds(resource.startTime);
      console.log(`[VideoPlayer] 🚀 Seeking to ${seconds}s (from ${resource.startTime})`);
      
      const seekWhenReady = () => {
        playerRef.current.plyr.currentTime = seconds;
        // Also ensure captions are visible if we came from a search
        playerRef.current.plyr.captions.active = true;
      };

      if (playerRef.current.plyr.ready) {
        seekWhenReady();
      } else {
        playerRef.current.plyr.on('ready', seekWhenReady);
      }
    }
  }, [loading, resource.startTime]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-stone-950 text-stone-100 items-center justify-center">
        <span className="loading loading-spinner loading-lg text-indigo-400"></span>
        <p className="mt-4 text-stone-400">Cargando video...</p>
      </div>
    );
  }

  const videoOptions = {
    type: 'video',
    title: resource.name,
    sources: [
      {
        src: videoSrc,
        type: 'video/mp4',
      },
    ],
    tracks: vttSrc ? [
      {
        kind: 'captions',
        label: 'Español (Auto-generado)',
        srclang: 'es',
        src: vttSrc,
        default: true,
      },
    ] : [],
  };

  const plyrProps = {
    source: videoOptions,
    options: {
      captions: { active: true, update: true, language: 'es' },
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      settings: ['captions', 'quality', 'speed', 'loop']
    }
  };

  return (
    <div className="flex flex-col h-screen bg-stone-950 text-stone-100 animate-in fade-in duration-300">
      <header className="px-6 py-4 flex items-center gap-4 bg-stone-900 shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10 shrink-0">
        <button
          onClick={onBack}
          className="p-2.5 bg-stone-800 hover:bg-stone-700 rounded-full transition-all flex items-center justify-center"
          title="Volver a los contenidos"
        >
          <ArrowLeft size={18} className="text-stone-300" />
        </button>
        <div className="flex-1 min-w-0 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-0.5">
            <h1 className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.2em] truncate">
              Grabación de Clase
            </h1>
            {resource.startTime && (
               <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[9px] font-bold border border-indigo-500/30 animate-pulse">
                 <Clock className="w-2.5 h-2.5" />
                 LINK DIRECTO: {resource.startTime.split('.')[0]}
               </span>
            )}
          </div>
          <h2 className="text-base font-bold text-white truncate">{resource.name}</h2>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center pb-12 pt-6 px-4 md:px-8 max-w-[1240px] w-full mx-auto overflow-hidden">
        <div className="w-full bg-black rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] border border-stone-800/80 ring-1 ring-white/10 video-container-plyr">
          <Plyr {...plyrProps} ref={playerRef} />
        </div>
        <div className="mt-8 text-center text-stone-500 text-xs max-w-2xl px-4">
          <p>Esta grabación ha sido procesada mediante <b>Moodle UX</b>. Los subtítulos fueron generados automáticamente con IA en tu equipo en tiempo real.</p>
        </div>
      </main>

      <style>{`
        /* Minimal custom overrides for Plyr theme matching */
        .plyr--full-ui input[type=range] { color: #6366f1; }
        .plyr__control--overlaid { background: rgba(99, 102, 241, 0.8) !important; }
        .plyr__control--overlaid:hover { background: #4f46e5 !important; }
        .video-container-plyr .plyr__video-wrapper {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
});