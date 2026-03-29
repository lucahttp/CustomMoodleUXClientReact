import { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "../api/moodle";
import { extractPastelColorFromImage } from "../utils/colors";
import { dbService } from "../db/service";
import { useObservable } from "./useObservable";

export const useMoodle = () => {
  const [session, setSession] = useState({ key: "", url: "" });
  const coursesObservable = useMemo(() => dbService.observeCourses(), []);
  const courses = useObservable(coursesObservable, []);
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
    // Trigger the fetch mechanism from the content script
    console.log(`[useMoodle] 📡 Dispatching getSessionObject to content script...`);
    window.dispatchEvent(new CustomEvent("getSessionObject", { detail: null }));
    return () => window.removeEventListener("variableValueRetrieved2", handleSessionKey);
  }, []);

  // 2. Fetch Courses when Session is ready
  useEffect(() => {
    if (!session.key) return;

    const loadCourses = async () => {
      console.log(`[useMoodle] 🎓 Session ready. Fetching enrolled courses via API...`);
      setLoading(true);
      try {
        const data = await api.fetchCourses(session.url, session.key);
        console.log(`[useMoodle] 🎓 Received ${data?.courses?.length || 0} courses from Moodle API`);
        // Save to DB
        dbService.saveCourses(data.courses);
        console.log(`[useMoodle] 💾 Saved courses to local WatermelonDB`);

        // Process Colors in background
        data.courses.forEach(async (c) => {
          if (c.courseimage) {
            const color = await extractPastelColorFromImage(c.courseimage);
            await dbService.updateCourseColor(c.id, color);
          }
        });
        /*
        */
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