export const MOODLE_SERVICE_URL = "/lib/ajax/service.php";

const moodlePost = async (endpoint, sessionKey, calls) => {
  console.log(`[API] 📡 POST ${endpoint}${MOODLE_SERVICE_URL} | Payload:`, calls);
  try {
    const response = await fetch(`${endpoint}${MOODLE_SERVICE_URL}?sesskey=${sessionKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calls),
    });
    if (!response.ok) {
       console.error(`[API] ❌ Moodle POST failed: ${response.status} ${response.statusText}`);
       throw new Error("Moodle API request failed");
    }
    const json = await response.json();
    console.log(`[API] ✅ Moodle POST response:`, json);
    return json;
  } catch (e) {
    console.error(`[API] 🔥 Error executing moodlePost:`, e);
    throw e;
  }
};

export const fetchCourses = async (endpoint, sessionKey) => {
  console.log(`[API] 📚 Fetching user enrolled courses...`);
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "core_course_get_enrolled_courses_by_timeline_classification",
    args: { offset: 0, limit: 0, classification: "all", sort: "fullname" },
  }]);
  console.log(`[API] 📚 Fetched ${data[0]?.data?.courses?.length || 0} courses.`);
  return data[0]?.data;
};

export const fetchCourseDetails = async (endpoint, sessionKey, courseId) => {
  console.log(`[API] 📖 Fetching details for Course ID: ${courseId}`);
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "core_courseformat_get_state",
    args: { courseid: courseId },
  }]);

  if (data && !data[0]?.error) {
    const httpResponse = JSON.parse(data[0].data);
    console.log(`[API] 📖 Course details parsed! Found ${httpResponse.cm?.length || 0} course modules.`);
    return httpResponse;
  }
  console.error(`[API] ❌ Failed to load course details:`, data[0]?.error);
  throw new Error("Failed to load course details.");
};

export const fetchBookContentHTML = async (endpoint, bookId) => {
  const url = `${endpoint}/mod/book/tool/print/index.php?id=${bookId}`;
  console.log(`[API] 📑 Fetching book HTML from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
       console.error(`[API] ❌ Fetch book failed: ${response.status}`);
       throw new Error("Failed to load book");
    }
    const html = await response.text();
    console.log(`[API] 📑 Book downloaded (Size: ${Math.round(html.length / 1024)}KB)`);
    return html;
  } catch(e) {
    console.error(`[API] 🔥 Error downloading book:`, e);
    throw e;
  }
};

/** Fetch assignments for a course */
export const fetchAssignments = async (endpoint, sessionKey, courseId) => {
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "mod_assign_get_assignments",
    args: { courseids: [courseId] },
  }]);
  if (data[0]?.error) throw new Error(data[0].error.message);
  return data[0]?.data?.courses?.[0]?.assignments ?? [];
};

/** Fetch upcoming actionable tasks (like unsubmitted assignments) */
export const fetchUpcomingTasks = async (endpoint, sessionKey) => {
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "core_calendar_get_action_events_by_timesort",
    args: {
      timesortfrom: Math.floor(Date.now() / 1000), // from now
      limitnum: 15 // next 15 actionable items
    },
  }]);
  if (data[0]?.error) throw new Error(data[0].error.message);
  return data[0]?.data?.events ?? [];
};

/** Fetch assignment submission status and instructions */
export const fetchAssignmentDetails = async (endpoint, sessionKey, assignId) => {
  const [statusData, infoData] = await Promise.all([
    moodlePost(endpoint, sessionKey, [{
      index: 0,
      methodname: "mod_assign_get_submission_status",
      args: { assignid: assignId },
    }]),
    moodlePost(endpoint, sessionKey, [{
      index: 0,
      methodname: "core_course_get_course_module",
      args: { cmid: assignId },
    }]),
  ]);
  return {
    status: statusData[0]?.data ?? null,
    info: infoData[0]?.data ?? null,
  };
};

/** Fetch quiz questions for a quiz cm */
export const fetchQuizAttempt = async (endpoint, sessionKey, quizId) => {
  // 1. Start/resume attempt
  const attemptData = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "mod_quiz_start_attempt",
    args: { quizid: quizId, forcenew: false },
  }]);
  const attempt = attemptData[0]?.data?.attempt;
  if (!attempt) throw new Error("Could not retrieve quiz attempt.");

  // 2. Get questions
  const questionsData = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "mod_quiz_get_attempt_data",
    args: { attemptid: attempt.id, page: 0 },
  }]);
  return {
    attempt,
    questions: questionsData[0]?.data?.questions ?? [],
  };
};

/** Submit text answer to an assignment */
export const submitAssignmentText = async (endpoint, sessionKey, assignId, text) => {
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "mod_assign_save_submission",
    args: {
      assignmentid: assignId,
      plugindata: {
        onlinetext_editor: {
          text,
          format: 1, // HTML
          itemid: 0,
        },
      },
    },
  }]);
  if (data[0]?.error) throw new Error(data[0].error.message);
  return data[0]?.data;
};

/** Fetch forum discussions in a course */
export const fetchForumDiscussions = async (endpoint, sessionKey, courseId) => {
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "mod_forum_get_forums_by_courses",
    args: { courseids: [courseId] },
  }]);
  if (data[0]?.error) throw new Error(data[0].error.message);
  return data[0]?.data ?? [];
};

/** Fetch grades for the current user in a course */
export const fetchGrades = async (endpoint, sessionKey, courseId) => {
  const data = await moodlePost(endpoint, sessionKey, [{
    index: 0,
    methodname: "gradereport_user_get_grade_items",
    args: { courseid: courseId },
  }]);
  if (data[0]?.error) throw new Error(data[0].error.message);
  return data[0]?.data ?? [];
};