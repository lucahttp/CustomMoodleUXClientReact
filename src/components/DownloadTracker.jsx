import React, { useState, useEffect } from 'react';
import { setJobProgressCallback } from '../api/handoffProxy';

export const DownloadTracker = () => {
    const [jobs, setJobs] = useState({});
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setJobProgressCallback((data) => {
            setJobs(prev => {
                const newJobs = { ...prev };
                newJobs[data.id] = {
                    id: data.id,
                    status: data.status,
                    progress: data.progress,
                    updatedAt: Date.now()
                };

                // Clear out completed jobs after 5 seconds
                if (data.progress >= 100) {
                    setTimeout(() => {
                        setJobs(curr => {
                            const updated = { ...curr };
                            delete updated[data.id];
                            return updated;
                        });
                    }, 5000);
                }

                return newJobs;
            });
            setIsOpen(true);
        });
    }, []);

    const activeJobs = Object.values(jobs).sort((a, b) => b.updatedAt - a.updatedAt);

    if (activeJobs.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out font-sans">
            <div className={`bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl overflow-hidden w-80 transition-all duration-300 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}`}>
                <div 
                    className="px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-100/50 flex justify-between items-center cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        <h3 className="font-semibold text-sm text-indigo-900">Bóveda Sync ({activeJobs.length})</h3>
                    </div>
                    <button className="text-indigo-400 hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {isOpen ? <polyline points="6 15 12 9 18 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
                        </svg>
                    </button>
                </div>

                <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-3 max-h-64 overflow-y-auto space-y-3 custom-scrollbar">
                        {activeJobs.map(job => (
                            <div key={job.id} className="bg-white/50 rounded-xl p-3 border border-indigo-50/50 shadow-sm relative overflow-hidden group">
                                {/* Progress background fill */}
                                <div 
                                    className="absolute inset-0 bg-indigo-50/50 transition-all duration-500 ease-out z-0"
                                    style={{ width: `${job.progress}%` }}
                                ></div>
                                
                                <div className="relative z-10 flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-stone-700 truncate pr-2" title={job.id}>
                                            {job.id}
                                        </span>
                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                            {job.progress}%
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-stone-500 flex items-center justify-between">
                                        <span className="truncate">{job.status}</span>
                                        {job.progress === 100 && (
                                            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Minimized Bubble (shows when minimized but jobs active) */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="absolute bottom-0 right-0 w-12 h-12 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-indigo-100 flex items-center justify-center hover:scale-105 transition-transform group"
                >
                    <div className="relative">
                        <svg className="w-5 h-5 text-indigo-600 group-hover:text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-white">
                            <span className="text-[8px] font-bold text-white">{activeJobs.length}</span>
                        </div>
                    </div>
                </button>
            )}
        </div>
    );
};
