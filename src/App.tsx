import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// Extend the Window interface to include 'M'
declare global {
    interface Window {
        M?: {
            cfg?: {
                sesskey?: string;
            };
        };
    }
}

const MOODLE_URL = 'https://vj.sied.utn.edu.ar/lib/ajax/service.php';

async function getCourses(sessionKey: string): Promise<any> {
    const response = await fetch(`${MOODLE_URL}?sesskey=${sessionKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
            {
                index: 0,
                methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
                args: {
                    offset: 0,
                    limit: 0,
                    classification: 'all',
                    sort: 'fullname',
                    customfieldname: '',
                    customfieldvalue: '',
                },
            },
        ]),
    });
    if (!response.ok) throw new Error('Failed to fetch courses');
    const data = await response.json();
    return data as CourseResponse[]; // Assert the type of the response
}

const injectSesskeyScript = () => {
    const script = document.createElement('script');
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
// Define the type for a single course object
interface Course {
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
// Define the type for the API response, which contains an array of courses
interface CourseResponse {
    courses: Course[];
}

const App: React.FC = () => {
    const [sessionKey, setSessionKey] = useState('');
    const [courses, setCourses] = useState<CourseResponse | null>(null); // Update the state type
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Listen for the custom event dispatched by the injected script


        console.log('Listening for session key...');
        //console.log('Session Key:', window.M.cfg.sesskey);


        const handleSessionKey = (event: Event) => {
            console.log('Session Key event triggered');
            console.log(event);
            const customEvent = event as CustomEvent;
            if (customEvent.detail) {
                setSessionKey(customEvent.detail);
                console.log('Session Key:', customEvent.detail);
                handleFetchCourses();
            } else {
                console.error('Session Key not found');
                setError('Session key not found. Please ensure you are logged in to Moodle.');
            }
        };

        window.addEventListener('variableValueRetrieved2', handleSessionKey);

        // Inject the script to retrieve the session key
        //injectSesskeyScript();
        //triggerSessionKeyEvent();
        // Cleanup the event listener on component unmount
        window.dispatchEvent(new CustomEvent('getSessionKey', { detail: null }));

        return () => {
            window.removeEventListener('variableValueRetrieved2', handleSessionKey);
        };
    }, []);

    const handleFetchCourses = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getCourses(sessionKey);
            if (result && result[0]?.data) {
                setCourses(result[0].data);
            } else {
                setCourses(null); // Set to empty array to indicate no courses
                setError("No courses found.  Verify that the session key is for a user with courses.courses.");
            }
        } catch (err: any) {
            setError(err.message);
            setCourses(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="App">
            <div className="min-h-screen bg-base-200 p-4">



                <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg rounded-xl py-4">
                    <div className="container mx-auto px-4 flex items-center justify-between">

                            <img
                                className="h-12 w-12 mr-4"
                                alt="Tailwind CSS Navbar component"
                                src={chrome.runtime.getURL("/assets/imgs/utn_logo.svg")} />


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
                                    ${loading ? 'opacity-70 cursor-not-allowed' : 'opacity-100'} transition-all duration-300
                                    shadow-lg hover:shadow-xl`}
                            >
                                {loading ? 'Loading...' : 'Fetch Courses'}
                            </button>
                        </div>
                    </div>
                </header>

                {(courses && courses.courses.length > 0) && <p className="text-gray-500 dark:text-gray-400">
                    {"course.shortname"}</p>}






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

                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Show Skeleton loading cards */}
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="card bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl shadow-md">
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
                                        <div className="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01] rounded-xl">
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
                </main>


                {courses && (
                    <pre
                        style={{
                            background: '#222',
                            color: '#0f0',
                            padding: 16,
                            marginTop: 16,
                            borderRadius: 8,
                            maxWidth: 600,
                            overflowX: 'auto',
                            textAlign: 'left',
                        }}
                    >
                        {JSON.stringify(courses, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
};

export default App;
