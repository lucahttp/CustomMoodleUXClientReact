import { useState, useEffect } from "react";
import * as api from "../api/moodle";
import { extractPastelColorFromImage } from "../utils/colors";

export const useMoodle = () => {
  const [session, setSession] = useState({ key: "", url: "" });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Listen for the Extension Injection Event
  useEffect(() => {
    console.log(`[useMoodle] 🔌 Initializing extension session listener...`);
    const handleSessionKey = (event) => {
      console.log(`[useMoodle] 🔑 Received session key event! key exists? ${!!event.detail.sesskey}`);
      if (event.detail.sesskey) {
        setSession({
          key: event.detail.sesskey,
          url: event.detail.wwwroot || ""
        });
      }
    };
    window.addEventListener("variableValueRetrieved2", handleSessionKey);
    console.log(`[useMoodle] 📡 Dispatching getSessionObject to content script...`);
    window.dispatchEvent(new CustomEvent("getSessionObject", { detail: null }));
    return () => window.removeEventListener("variableValueRetrieved2", handleSessionKey);
  }, []);

  // 2. Fetch Courses (Offline First via PGlite)
  useEffect(() => {
    if (!session.key) return;

    const loadCourses = async () => {
      console.log(`[useMoodle] 🎓 Session ready. Fetching enrolled courses via API...`);
      setLoading(true);
      try {
        const data = await api.fetchCourses(session.url, session.key);
        const apiCourses = data?.courses || [];
        console.log(`[useMoodle] 🎓 Received ${apiCourses.length} courses from Moodle API`);
        
        // Save to PGlite and process colors
        for (const c of apiCourses) {
            if (c.courseimage) {
               try {
                  c.color = await extractPastelColorFromImage(c.courseimage);
               } catch (e) {
                  console.warn("Failed to extract color for", c.fullname);
               }
            }
        }

        setCourses(apiCourses);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [session]);

  return { session, courses, loading, error };
};