import { useEffect } from "react";
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

/**
 * useWebMCP — Registers Moodle tools into navigator.modelContext (WebMCP).
 * Runs inside a react-frame-component iframe, so we use window.top to reach
 * the top-level page where modelContext lives.
 */
export const useWebMCP = ({ courses, session, handleCourseClick, handleSyncAll, dbService }) => {
  useEffect(() => {
    const mc = (window.top || window).navigator?.modelContext;
    if (!mc) {
      console.warn("[WebMCP] navigator.modelContext not available. Enable #enable-webmcp-testing in chrome://flags.");
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. list_courses
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "list_courses",
      description: "Returns all enrolled courses for the current user with their IDs, names and summaries.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => ({
        content: [{
          type: "text",
          text: JSON.stringify(
            courses.map(c => ({ id: c.id, fullname: c.fullname, shortname: c.shortname, summary: c.summary })),
            null, 2
          )
        }]
      })
    });

    // ─────────────────────────────────────────────────────────────
    // 2. get_course_content — sections + all modules (cm)
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "get_course_content",
      description: "Returns the full structure of a course: sections and all activity modules (books, assignments, quizzes, URLs, files, forums, etc.) with their IDs and types.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "string", description: "The course ID (from list_courses)." }
        },
        required: ["courseId"]
      },
      execute: async ({ courseId }) => {
        const details = await fetchCourseDetails(session.url, session.key, courseId);
        const summary = {
          sections: details.section?.map(s => ({ id: s.id, title: s.title, url: s.sectionurl })) ?? [],
          modules: details.cm?.map(m => ({ id: m.id, name: m.name, type: m.modname, url: m.url })) ?? [],
        };
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. read_book — full text of a Moodle Book resource
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "read_book",
      description: "Fetches and returns the full text content of a Moodle Book module. Use this to read study material, extract definitions, or answer questions from the course content.",
      inputSchema: {
        type: "object",
        properties: {
          bookId: { type: "string", description: "The course-module ID of the book (from get_course_content, type='book')." }
        },
        required: ["bookId"]
      },
      execute: async ({ bookId }) => {
        const html = await fetchBookContentHTML(session.url, bookId);
        // Strip HTML tags for cleaner text
        const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                         .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                         .replace(/<[^>]+>/g, " ")
                         .replace(/\s{2,}/g, " ")
                         .trim();
        return { content: [{ type: "text", text }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 4. list_assignments — all assignments in a course
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "list_assignments",
      description: "Lists all assignments in a course with due dates, descriptions and submission status. Use this to know what tasks are pending.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "string", description: "The course ID." }
        },
        required: ["courseId"]
      },
      execute: async ({ courseId }) => {
        const assignments = await fetchAssignments(session.url, session.key, courseId);
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
    });

    // ─────────────────────────────────────────────────────────────
    // 5. get_assignment_details — full rubric + submission state
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "get_assignment_details",
      description: "Returns the full details of an assignment including instructions, rubric criteria, and current submission status. Use this before writing an answer.",
      inputSchema: {
        type: "object",
        properties: {
          assignId: { type: "string", description: "The assignment CM ID (cmid from list_assignments)." }
        },
        required: ["assignId"]
      },
      execute: async ({ assignId }) => {
        const details = await fetchAssignmentDetails(session.url, session.key, assignId);
        return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 6. submit_assignment — submit a text answer to an assignment
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "submit_assignment",
      description: "Submits a text answer (HTML supported) to a Moodle assignment on behalf of the user. Always confirm with the user before calling this tool.",
      inputSchema: {
        type: "object",
        properties: {
          assignId: { type: "string", description: "The assignment ID (from list_assignments)." },
          text: { type: "string", description: "The answer text to submit. Can include HTML formatting." }
        },
        required: ["assignId", "text"]
      },
      execute: async ({ assignId, text }) => {
        const result = await submitAssignmentText(session.url, session.key, assignId, text);
        return { content: [{ type: "text", text: `Submission result: ${JSON.stringify(result)}` }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 7. get_quiz_questions — retrieve quiz questions for a quiz
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "get_quiz_questions",
      description: "Starts or resumes a quiz attempt and returns all questions on the first page. Use this to read quiz questions so you can answer them.",
      inputSchema: {
        type: "object",
        properties: {
          quizId: { type: "string", description: "The quiz ID (from get_course_content, type='quiz')." }
        },
        required: ["quizId"]
      },
      execute: async ({ quizId }) => {
        const data = await fetchQuizAttempt(session.url, session.key, quizId);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 8. get_grades — grade summary for a course
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "get_grades",
      description: "Returns the grade report for a course, including grades for all activities, weights and totals.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "string", description: "The course ID." }
        },
        required: ["courseId"]
      },
      execute: async ({ courseId }) => {
        const grades = await fetchGrades(session.url, session.key, courseId);
        return { content: [{ type: "text", text: JSON.stringify(grades, null, 2) }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 9. list_forums — forum discussions in a course
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "list_forums",
      description: "Lists all forum discussions in a course. Use this to find student discussions, find pending contributions or read what classmates wrote.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "string", description: "The course ID." }
        },
        required: ["courseId"]
      },
      execute: async ({ courseId }) => {
        const forums = await fetchForumDiscussions(session.url, session.key, courseId);
        const mapped = forums.map(f => ({ id: f.id, name: f.name, intro: f.intro?.replace(/<[^>]+>/g, " ").trim() }));
        return { content: [{ type: "text", text: JSON.stringify(mapped, null, 2) }] };
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 10. open_course / search / sync (originals)
    // ─────────────────────────────────────────────────────────────
    mc.registerTool({
      name: "open_course",
      description: "Navigates the UI to a specific course.",
      inputSchema: {
        type: "object",
        properties: { courseId: { type: "string" } },
        required: ["courseId"]
      },
      execute: async ({ courseId }) => {
        handleCourseClick(courseId);
        return { content: [{ type: "text", text: `Opened course ${courseId}` }] };
      }
    });

    mc.registerTool({
      name: "search_moodle",
      description: "Searches locally cached courses and resources by name.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      },
      execute: async ({ query }) => {
        const results = await dbService.search(query);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
    });

    mc.registerTool({
      name: "sync_all_courses",
      description: "Triggers a full sync of all courses and their resources from Moodle to the local cache.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        await handleSyncAll();
        return { content: [{ type: "text", text: "Sync completed." }] };
      }
    });

    // Cleanup
    return () => {
      [
        "list_courses", "get_course_content", "read_book",
        "list_assignments", "get_assignment_details", "submit_assignment",
        "get_quiz_questions", "get_grades", "list_forums",
        "open_course", "search_moodle", "sync_all_courses"
      ].forEach(name => mc.unregisterTool(name));
    };
  }, [courses, session, handleCourseClick, handleSyncAll, dbService]);
};
