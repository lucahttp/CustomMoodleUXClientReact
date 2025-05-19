import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

// Extend the Window interface to include 'M'
/* declare global {
  interface Window {
    M?: {
      cfg?: {
        sesskey?: string;
      };
    };
  }
} */

//const MOODLE_URL = "https://vj.sied.utn.edu.ar/lib/ajax/service.php";

async function getCourses(moodleEndpoint: string,sessionKey: string): Promise<any> {
  const response = await fetch(`${moodleEndpoint}?sesskey=${sessionKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        index: 0,
        methodname:
          "core_course_get_enrolled_courses_by_timeline_classification",
        args: {
          offset: 0,
          limit: 0,
          classification: "all",
          sort: "fullname",
          customfieldname: "",
          customfieldvalue: "",
        },
      },
    ]),
  });
  if (!response.ok) throw new Error("Failed to fetch courses");
  const data = await response.json();
  return data as CourseResponse[]; // Assert the type of the response
}

// Add a function to fetch a single course's details
async function getCourse(moodleEndpoint: string,sessionKey: string, courseId: number): Promise<any> {
  const response = await fetch(`${moodleEndpoint}?sesskey=${sessionKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        index: 0,
        methodname: "core_courseformat_get_state",
        args: { courseid: courseId },
      },
    ]),
  });
  if (!response.ok) throw new Error("Failed to fetch course");
  const data = await response.json();

  if (data && !data[0]?.error) {
    const httpResponse: HttpResponse = JSON.parse(data[0].data);
    console.log(httpResponse);

    // Example of accessing data:
    console.log("Course ID:", httpResponse.course.id);
    console.log("Number of Sections:", httpResponse.course.numsections);
    console.log("First Section Title:", httpResponse.section[0].title);
    console.log("First CM Name:", httpResponse.cm[0].name);
    console.log("First Section URL", httpResponse.section[0].sectionurl);

    return httpResponse; // The response is an array as in your example
  } else {
    console.log("Failed to load course details.");
  }
}


async function getBookContent(moodleEndpoint: string,bookId: string) {
  //book_content
//https://vj.sied.utn.edu.ar/mod/book/view.php?id=1805&chapterid=580
// https://vj.sied.utn.edu.ar/mod/book/tool/print/index.php?id=1805
// https://vj.sied.utn.edu.ar/mod/book/view.php?id=1805&chapterid=578

  //const MOODLE_SITE_URL = "https://vj.sied.utn.edu.ar";

  const response = await fetch(
    `${moodleEndpoint}/mod/book/view.php?id=${bookId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          index: 0,
          methodname: "mod_book_get_book_contents",
          args: { bookid: bookId },
        },
      ]),
    }
  );
}

const injectSesskeyScript = () => {
  const script = document.createElement("script");
  script.textContent = `
    try {
      var value = (window.M && window.M.cfg && window.M.cfg.sesskey) ? window.M.cfg.sesskey : null;
      window.dispatchEvent(new CustomEvent('variableValueRetrieved', { detail: value }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('variableValueRetrieved', { detail: null }));
    }
  `;
  document.documentElement.appendChild(script);
  script.remove();
};

interface HttpResponse {
  course: Course;
  section: Section[];
  cm: Cm[];
}

// Define the type for a single course object
interface Courses {
  id: number;
  fullname: string;
  shortname: string;
  idnumber: string;
  summary: string;
  summaryformat: number;
  startdate: number;
  enddate: number;
  visible: boolean;
  showactivitydates: boolean;
  showcompletionconditions: boolean;
  fullnamedisplay: string;
  viewurl: string;
  courseimage?: string; // The '?' makes it optional
  progress?: number;
  hasprogress?: boolean;
  isfavourite?: boolean;
  hidden?: boolean;
  showshortname?: boolean;
  coursecategory?: string;
}

interface Course {
  id: string;
  numsections: number;
  sectionlist: string[];
  editmode: boolean;
  highlighted: string;
  maxsections: string;
  baseurl: string;
  statekey: string;
}

interface Section {
  id: string;
  section: number;
  number: number;
  title: string;
  hassummary: boolean;
  rawtitle: string;
  cmlist: string[];
  visible: boolean;
  sectionurl: string;
  current: boolean;
  indexcollapsed: boolean;
  contentcollapsed: boolean;
  hasrestrictions: boolean;
}

interface Cm {
  id: string;
  anchor: string;
  name: string;
  visible: boolean;
  stealth: boolean;
  sectionid: string;
  sectionnumber: number;
  uservisible: boolean;
  hascmrestrictions: boolean;
  module: string;
  plugin: string;
  indent: number;
  accessvisible: boolean;
  url: string;
  istrackeduser: boolean;
  completionstate?: number | string; // completionstate can be a number or a string
}
// Define the type for the API response, which contains an array of courses
interface CourseResponse {
  courses: Courses[];
}

const App: React.FC = () => {
  const [sessionKey, setSessionKey] = useState("");
  const [moodleEndpoint, setMoodleEndpoint] = useState("");

  const [courses, setCourses] = useState<CourseResponse | null>(null); // Update the state type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for course view
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);

  useEffect(() => {
    // Listen for the custom event dispatched by the injected script

    console.log("Listening for session key...");
    //console.log('Session Key:', window.M.cfg.sesskey);

    const handleSessionKey = (event: Event) => {
      console.log("Session Key event triggered");
      console.log(event);
      const customEvent = event as CustomEvent;
      if (customEvent.detail.sesskey) {
        setSessionKey(customEvent.detail.sesskey);
        console.log("Session Key:", customEvent.detail.sesskey);
        handleFetchCourses();
      } else {
        console.error("Session Key not found");
        setError(
          "Session key not found. Please ensure you are logged in to Moodle."
        );
      }


      if (customEvent.detail.wwwroot) {
        setMoodleEndpoint(customEvent.detail.wwwroot);
        console.log("Session Key:", customEvent.detail.wwwroot);
        handleFetchCourses();
      } else {
        console.error("Session Key not found");
        setError(
          "Session key not found. Please ensure you are logged in to Moodle."
        );
      }
    };

    window.addEventListener("variableValueRetrieved2", handleSessionKey);

    // Inject the script to retrieve the session key
    //injectSesskeyScript();
    //triggerSessionKeyEvent();
    // Cleanup the event listener on component unmount
    window.dispatchEvent(new CustomEvent("getSessionObject", { detail: null }));

    return () => {
      window.removeEventListener("variableValueRetrieved2", handleSessionKey);
    };
  }, []);

  const handleFetchCourses = async () => {
    setLoading(true);
    setError(null);
    setSelectedCourse(null); // Reset course view if coming back
    try {
      const result = await getCourses(`${moodleEndpoint}/lib/ajax/service.php`,sessionKey);
      if (result && result[0]?.data) {
        setCourses(result[0].data as CourseResponse);
      } else {
        setCourses(null); // Set to empty array to indicate no courses
        setError(
          "No courses found.  Verify that the session key is for a user with courses.courses."
        );
      }
    } catch (err: any) {
      setError(err.message);
      setCourses(null);
    } finally {
      setLoading(false);
    }
  };

  // Handler for clicking a course
  const handleCourseClick = async (courseId: number) => {
    setCourseLoading(true);
    setError(null);
    try {
      const result = await getCourse(`${moodleEndpoint}/lib/ajax/service.php`,sessionKey, courseId);
      if (result) {
        setSelectedCourse(result);
      } else {
        setError("Failed to load course details.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCourseLoading(false);
    }
  };

  // Handler to go back to courses list
  const handleBackToCourses = () => {
    setSelectedCourse(null);
  };

  return (
    <div className="App">
      <div className="min-h-screen bg-base-200 p-4">
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg rounded-xl py-4">
          <div className="container mx-auto px-4 flex items-center justify-between">
            <img
              className="h-12 w-12 mr-4"
              alt="Tailwind CSS Navbar component"
              src={chrome.runtime.getURL("/assets/imgs/utn_logo.svg")}
            />

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              UTN T.U.V
            </h1>
            {/* Session Key Input (for testing) */}
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Enter sessionKey"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                className="input w-64 bg-white/90 dark:bg-gray-700/90 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                disabled={loading}
              />
              <button
                onClick={handleFetchCourses}
                disabled={loading || !sessionKey}
                className={`btn bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-xl
                                    ${
                                      loading
                                        ? "opacity-70 cursor-not-allowed"
                                        : "opacity-100"
                                    } transition-all duration-300
                                    shadow-lg hover:shadow-xl`}
              >
                {loading ? "Loading..." : "Fetch Courses"}
              </button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="alert alert-error mb-8 rounded-xl shadow-md"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 shrink-0 stroke-current"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l6-6m-6-6l6 6m7-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="font-semibold">Error</h3>
                  <p>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Course details view */}
          {selectedCourse ? (
            <div>
              <button
                className="btn btn-secondary mb-4"
                onClick={handleBackToCourses}
                disabled={courseLoading}
              >
                ← Back to Courses
              </button>
              {courseLoading ? (
                <div>Loading course...</div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {selectedCourse.course?.id}:{" "}
                    {selectedCourse.course?.baseurl}
                  </h2>
                  <div className="mb-4">
                    <strong>Sections:</strong>
                    <ul className="list-disc ml-6">
                      {selectedCourse.section?.map((section: any) => (
                        <li key={section.id}>
                          <strong>{section.title}</strong> ({section.sectionurl}
                          )
                          {section.cmlist && section.cmlist.length > 0 && (
                            <ul className="list-square ml-4">
                              {section.cmlist.map((cmid: string) => {
                                const cm = selectedCourse.cm?.find(
                                  (c: any) => c.id === cmid
                                );
                                return cm ? (
                                  <li key={cm.id}>
                                    {cm.name} [{cm.module}]
                                    {cm.url && (
                                      <a
                                        href={cm.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 text-blue-500 underline"
                                      >
                                        Abrir
                                      </a>
                                    )}
                                  </li>
                                ) : null;
                              })}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <pre
                    style={{
                      background: "#222",
                      color: "#0f0",
                      padding: 16,
                      marginTop: 16,
                      borderRadius: 8,
                      maxWidth: 600,
                      overflowX: "auto",
                      textAlign: "left",
                    }}
                  >
                    {JSON.stringify(selectedCourse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <>
              {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Show Skeleton loading cards */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="card bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl shadow-md"
                    >
                      <div className="card-body">
                        <div className="skeleton h-8 w-3/4 mb-4 rounded-md"></div>
                        <div className="skeleton h-4 w-full mb-2 rounded-md"></div>
                        <div className="skeleton h-4 w-full mb-2 rounded-md"></div>
                        <div className="skeleton h-4 w-1/2 rounded-md"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && courses && courses.courses.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12 rounded-xl">
                  No courses found.
                </div>
              )}

              {!loading && courses && courses.courses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {courses.courses.map((course: any) => (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div
                          className="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01] rounded-xl cursor-pointer"
                          onClick={() => handleCourseClick(course.id)}
                        >
                          <div className="card-body">
                            {course.courseimage && (
                              <div className="mb-4">
                                <img
                                  src={course.courseimage}
                                  alt={course.fullname}
                                  className="rounded-md max-w-[200px] h-[100px] object-cover"
                                />
                              </div>
                            )}
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white card-title">
                              {course.fullname}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400">
                              {course.shortname}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 mb-4">
                              {course.summary}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Enrolled Users: {course.enrolledusercount}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
        {courses && (
          <pre
            style={{
              background: "#222",
              color: "#0f0",
              padding: 16,
              marginTop: 16,
              borderRadius: 8,
              maxWidth: 600,
              overflowX: "auto",
              textAlign: "left",
            }}
          >
            {JSON.stringify(courses, null, 2)}
          </pre>
        )}
            </>
          )}
        </main>

      </div>
    </div>
  );
};

export default App;
