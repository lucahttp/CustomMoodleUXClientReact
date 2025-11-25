import { useState, useEffect, useCallback } from "react";
import * as api from "../api/moodle";
import { extractPastelColorFromImage } from "../utils/colors";

export const useMoodle = () => {
  const [session, setSession] = useState({ key: "", url: "" });
  const [courses, setCourses] = useState([]);
  const [courseColors, setCourseColors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Listen for the Extension Injection Event
  useEffect(() => {
    const handleSessionKey = (event) => {
      if (event.detail.sesskey) {
        setSession({ 
            key: event.detail.sesskey, 
            url: event.detail.wwwroot || "" 
        });
      }
    };
    window.addEventListener("variableValueRetrieved2", handleSessionKey);
    // Trigger the fetch mechanism from the content script
    window.dispatchEvent(new CustomEvent("getSessionObject", { detail: null }));
    return () => window.removeEventListener("variableValueRetrieved2", handleSessionKey);
  }, []);

  // 2. Fetch Courses when Session is ready
  useEffect(() => {
    if (!session.key) return;

    const loadCourses = async () => {
      setLoading(true);
      try {
        const data = await api.fetchCourses(session.url, session.key);
        setCourses(data.courses);
        console.log("Fetched Courses:", data.courses);
        
        // Process Colors in background
        data.courses.forEach(async (c) => {
          if (c.courseimage) {
            const color = await extractPastelColorFromImage(c.courseimage);
            setCourseColors(prev => ({ ...prev, [c.id]: color }));
          }
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, [session]);

  return { session, courses, courseColors, loading, error };
};