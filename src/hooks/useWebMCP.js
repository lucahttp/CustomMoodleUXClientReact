import { useEffect } from "react";

/**
 * Hook to register WebMCP tools for the Moodle client.
 * 
 * @param {Object} props
 * @param {Array} props.courses - List of enrolled courses.
 * @param {Object} props.session - Current Moodle session (url, key).
 * @param {Function} props.handleCourseClick - Function to open a course.
 * @param {Function} props.handleSyncAll - Function to trigger a sync.
 * @param {Object} props.dbService - The database service for searches.
 */
export const useWebMCP = ({ courses, session, handleCourseClick, handleSyncAll, dbService }) => {
    useEffect(() => {
        // Check if WebMCP is available
        const modelContext = (window.top || window).navigator?.modelContext;

        if (!modelContext) {
            console.warn("WebMCP (navigator.modelContext) is not available. Please enable #enable-webmcp-testing in chrome://flags.");
            return;
        }


        // 1. list_courses: Returns the list of enrolled courses
        modelContext.registerTool({
            name: "list_courses",
            description: "Returns a list of all enrolled courses for the current user, including their IDs and names.",
            inputSchema: {
                type: "object",
                properties: {},
            },
            execute: async () => {
                const courseData = courses.map(c => ({
                    id: c.id,
                    fullname: c.fullname,
                    shortname: c.shortname,
                    summary: c.summary
                }));
                return {
                    content: [{ type: "text", text: JSON.stringify(courseData, null, 2) }]
                };
            }
        });

        // 2. open_course: Navigates to a specific course
        modelContext.registerTool({
            name: "open_course",
            description: "Navigates the user to a specific course based on its ID.",
            inputSchema: {
                type: "object",
                properties: {
                    courseId: {
                        type: "string",
                        description: "The unique identifier of the course to open."
                    }
                },
                required: ["courseId"]
            },
            execute: async ({ courseId }) => {
                handleCourseClick(courseId);
                return {
                    content: [{ type: "text", text: `Successfully opened course with ID: ${courseId}` }]
                };
            }
        });

        // 3. sync_all_courses: Triggers a manual sync
        modelContext.registerTool({
            name: "sync_all_courses",
            description: "Triggers a full synchronization of all courses and their resources from Moodle.",
            inputSchema: {
                type: "object",
                properties: {},
            },
            execute: async () => {
                try {
                    await handleSyncAll();
                    return {
                        content: [{ type: "text", text: "Synchronization initiated successfully." }]
                    };
                } catch (error) {
                    return {
                        content: [{ type: "text", text: `Synchronization failed: ${error.message}` }]
                    };
                }
            }
        });

        // 4. search_moodle: Search through courses and resources
        modelContext.registerTool({
            name: "search_moodle",
            description: "Searches for courses and downloadable resources using a text query.",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The text to search for."
                    }
                },
                required: ["query"]
            },
            execute: async ({ query }) => {
                try {
                    const results = await dbService.search(query);
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
                    };
                } catch (error) {
                    return {
                        content: [{ type: "text", text: `Search failed: ${error.message}` }]
                    };
                }
            }
        });

        // Cleanup: Unregister tools when component unmounts or deps change
        return () => {
            modelContext.unregisterTool("list_courses");
            modelContext.unregisterTool("open_course");
            modelContext.unregisterTool("sync_all_courses");
            modelContext.unregisterTool("search_moodle");
        };
    }, [courses, session, handleCourseClick, handleSyncAll, dbService]);
};
