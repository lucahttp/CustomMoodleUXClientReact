import {
    fetchCourseDetails,
    fetchBookContentHTML,
    fetchAssignments,
    fetchAssignmentDetails,
    fetchQuizAttempt,
    submitAssignmentText,
    fetchForumDiscussions,
    fetchGrades,
} from "../api/moodle";
import { processZoomRecording } from "../api/zoomProcessor";

export const getToolsList = (hasSession) => {
    const activateTool = {
        name: "activate_extension",
        description: "Activates the Moodle extension by dispatching a session request. Must be called first before any other endpoints become available.",
        inputSchema: { type: "object", properties: {} }
    };

    if (!hasSession) {
        return [activateTool];
    }

    return [
        activateTool,
        {
        name: "list_courses",
        description: "Returns all enrolled courses for the current user with their IDs, names and summaries.",
        inputSchema: { type: "object", properties: {} }
        },
        {
        name: "get_course_content",
        description: "Returns the full structure of a course: sections and all activity modules (books, assignments, quizzes, URLs, files, forums, etc.) with their IDs and types.",
        inputSchema: {
            type: "object",
            properties: {
            courseId: { type: "string", description: "The course ID (from list_courses)." }
            },
            required: ["courseId"]
        }
        },
        {
        name: "read_book",
        description: "Fetches and returns the full text content of a Moodle Book module. Use this to read study material, extract definitions, or answer questions from the course content.",
        inputSchema: {
            type: "object",
            properties: {
            bookId: { type: "string", description: "The course-module ID of the book (from get_course_content, type='book')." }
            },
            required: ["bookId"]
        }
        },
        {
        name: "list_assignments",
        description: "Lists all assignments in a course with due dates, descriptions and submission status. Use this to know what tasks are pending.",
        inputSchema: {
            type: "object",
            properties: {
            courseId: { type: "string", description: "The course ID." }
            },
            required: ["courseId"]
        }
        },
        {
        name: "get_assignment_details",
        description: "Returns the full details of an assignment including instructions, rubric criteria, and current submission status. Use this before writing an answer.",
        inputSchema: {
            type: "object",
            properties: {
            assignId: { type: "string", description: "The assignment CM ID (cmid from list_assignments)." }
            },
            required: ["assignId"]
        }
        },
        {
        name: "submit_assignment",
        description: "Submits a text answer (HTML supported) to a Moodle assignment on behalf of the user. Always confirm with the user before calling this tool.",
        inputSchema: {
            type: "object",
            properties: {
            assignId: { type: "string", description: "The assignment ID (from list_assignments)." },
            text: { type: "string", description: "The answer text to submit. Can include HTML formatting." }
            },
            required: ["assignId", "text"]
        }
        },
        {
        name: "get_quiz_questions",
        description: "Starts or resumes a quiz attempt and returns all questions on the first page. Use this to read quiz questions so you can answer them.",
        inputSchema: {
            type: "object",
            properties: {
            quizId: { type: "string", description: "The quiz ID (from get_course_content, type='quiz')." }
            },
            required: ["quizId"]
        }
        },
        {
        name: "get_grades",
        description: "Returns the grade report for a course, including grades for all activities, weights and totals.",
        inputSchema: {
            type: "object",
            properties: {
            courseId: { type: "string", description: "The course ID." }
            },
            required: ["courseId"]
        }
        },
        {
        name: "list_forums",
        description: "Lists all forum discussions in a course. Use this to find student discussions, find pending contributions or read what classmates wrote.",
        inputSchema: {
            type: "object",
            properties: {
            courseId: { type: "string", description: "The course ID." }
            },
            required: ["courseId"]
        }
        },
        {
        name: "open_course",
        description: "Navigates the UI to a specific course.",
        inputSchema: {
            type: "object",
            properties: { courseId: { type: "string" } },
            required: ["courseId"]
        }
        },
        {
        name: "search_moodle",
        description: "Searches locally cached courses and resources by name.",
        inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"]
        }
        },
        {
        name: "sync_all_courses",
        description: "Triggers a full sync of all courses and their resources from Moodle to the local cache.",
        inputSchema: { type: "object", properties: {} }
        },
        {
        name: "process_zoom_recording",
        description: "Process a Zoom class recording. It downloads the video, uploads it to Minio, transcribes it to VTT format using Vibe API, and uploads the `.vtt` file to Minio. Useful for generating automated lecture notes.",
        inputSchema: {
            type: "object",
            properties: {
            courseId: { type: "string", description: "The course ID to which this resource belongs." },
            resourceId: { type: "string", description: "The resource ID (cmid) of the Zoom class (module type 'zoomutnba')." },
            resourceName: { type: "string", description: "The name of the class or resource for the filename." }
            },
            required: ["courseId", "resourceId"]
        }
        }
    ];
};

export const executeTool = async (name, args, context) => {
    const { courses, session, handleCourseClick, handleSyncAll, activateExtension } = context;

    switch (name) {
        case "activate_extension": {
            if (activateExtension) {
                activateExtension();
            }
            return {
                content: [{
                    type: "text",
                    text: "Activation signal sent. Wait a few moments for the session to initialize, and the other tools will become available."
                }]
            };
        }

        case "list_courses":
            return {
                content: [{
                type: "text",
                text: JSON.stringify(
                    courses.map(c => ({ id: c.id, fullname: c.fullname, shortname: c.shortname, summary: c.summary })),
                    null, 2
                )
                }]
            };

        case "get_course_content": {
            const details = await fetchCourseDetails(session.url, session.key, args.courseId);
            const summary = {
                sections: details.section?.map(s => ({ id: s.id, title: s.title, url: s.sectionurl })) ?? [],
                modules: details.cm?.map(m => ({ id: m.id, name: m.name, type: m.modname, url: m.url })) ?? [],
            };
            return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
        }

        case "read_book": {
            const html = await fetchBookContentHTML(session.url, args.bookId);
            const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s{2,}/g, " ")
                            .trim();
            return { content: [{ type: "text", text }] };
        }

        case "list_assignments": {
            const assignments = await fetchAssignments(session.url, session.key, args.courseId);
            const mapped = assignments.map(a => ({
                id: a.id,
                cmid: a.cmid,
                name: a.name,
                duedate: a.duedate ? new Date(a.duedate * 1000).toLocaleString() : "No due date",
                allowsubmissionsfromdate: a.allowsubmissionsfromdate,
                intro: a.intro?.replace(/<[^>]+>/g, " ").trim(),
                submissionstatus: a.submissionstatus,
            }));
            return { content: [{ type: "text", text: JSON.stringify(mapped, null, 2) }] };
        }

        case "get_assignment_details": {
            const details = await fetchAssignmentDetails(session.url, session.key, args.assignId);
            return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] };
        }

        case "submit_assignment": {
            const result = await submitAssignmentText(session.url, session.key, args.assignId, args.text);
            return { content: [{ type: "text", text: `Submission result: ${JSON.stringify(result)}` }] };
        }

        case "get_quiz_questions": {
            const data = await fetchQuizAttempt(session.url, session.key, args.quizId);
            return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        case "get_grades": {
            const grades = await fetchGrades(session.url, session.key, args.courseId);
            return { content: [{ type: "text", text: JSON.stringify(grades, null, 2) }] };
        }

        case "list_forums": {
            const forums = await fetchForumDiscussions(session.url, session.key, args.courseId);
            const mapped = forums.map(f => ({ id: f.id, name: f.name, intro: f.intro?.replace(/<[^>]+>/g, " ").trim() }));
            return { content: [{ type: "text", text: JSON.stringify(mapped, null, 2) }] };
        }

        case "open_course": {
            handleCourseClick(args.courseId);
            return { content: [{ type: "text", text: `Opened course ${args.courseId}` }] };
        }

        case "search_moodle": {
            const results = []; // Temporarily disabled while migrating to PGlite
            return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }

        case "sync_all_courses": {
            await handleSyncAll();
            return { content: [{ type: "text", text: "Sync completed." }] };
        }

        case "process_zoom_recording": {
            const course = courses.find(c => c.id == args.courseId);
            const courseName = course ? (course.shortname || course.fullname) : 'uncategorized';

            const result = await processZoomRecording(session.url, args.resourceId, courseName, args.resourceName || `zoom-${args.resourceId}`, (status) => {
                console.log(`[process_zoom_recording] Status: ${status}`);
            });

            if (result.success) {
                return {
                    content: [{
                    type: "text",
                    text: `Success! \nVideo uploaded to Minio: ${result.videoUrl} \nVTT Uploaded to Minio: ${result.vttUrl} \n\nTranscription:\n${result.text}`
                    }]
                };
            } else {
                throw new Error(`Zoom processing failed: ${result.error}`);
            }
        }

        default:
            throw new Error(`Tool not found: ${name}`);
    }
};
