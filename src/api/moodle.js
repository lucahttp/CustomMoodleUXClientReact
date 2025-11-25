export const MOODLE_SERVICE_URL = "/lib/ajax/service.php";

export const fetchCourses = async (endpoint, sessionKey) => {
  const response = await fetch(`${endpoint}${MOODLE_SERVICE_URL}?sesskey=${sessionKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{
      index: 0,
      methodname: "core_course_get_enrolled_courses_by_timeline_classification",
      args: { offset: 0, limit: 0, classification: "all", sort: "fullname" },
    }]),
  });
  if (!response.ok) throw new Error("Failed to fetch courses");
  const data = await response.json();
  return data[0]?.data; // Return the inner data directly
};

export const fetchCourseDetails = async (endpoint, sessionKey, courseId) => {

  const response = await fetch(`${endpoint}${MOODLE_SERVICE_URL}?sesskey=${sessionKey}`, {
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
    const httpResponse = JSON.parse(data[0].data);
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








export const fetchBookContentHTML = async (bookId) => {
  // Fetch the raw HTML string for the book print view
  const url = `https://vj.sied.utn.edu.ar/mod/book/tool/print/index.php?id=${bookId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load book");
  return await response.text();
};