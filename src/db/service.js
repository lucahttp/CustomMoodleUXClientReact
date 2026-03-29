import { Q } from '@nozbe/watermelondb'
import database from './index'

export const dbService = {
  // --- Courses ---
  getCoursesCollection: () => database.collections.get('courses'),

  observeCourses: () => database.collections.get('courses').query().observe(),

  async saveCourses(apiCourses) {
    console.log(`[DB] 📚 saveCourses: syncing ${apiCourses?.length || 0} courses...`);
    const coursesCollection = database.collections.get('courses');

    await database.write(async () => {
      const batchOperations = [];

      for (const apiCourse of apiCourses) {
        const existing = await coursesCollection.query(Q.where('id', apiCourse.id.toString())).fetch();

        if (existing.length > 0) {
          const course = existing[0];
          batchOperations.push(
            course.prepareUpdate(c => {
              c.fullname = apiCourse.fullname;
              c.shortname = apiCourse.shortname;
              c.summary = apiCourse.summary;
              c.courseimage = apiCourse.courseimage;
            })
          );
        } else {
          batchOperations.push(
            coursesCollection.prepareCreate(c => {
              c._raw.id = apiCourse.id.toString(); 
              c.fullname = apiCourse.fullname;
              c.shortname = apiCourse.shortname;
              c.summary = apiCourse.summary;
              c.courseimage = apiCourse.courseimage;
            })
          );
        }
      }

      await database.batch(...batchOperations);
      console.log(`[DB] ✅ saveCourses complete.`);
    });
  },

  async updateCourseColor(courseId, color) {
    const coursesCollection = database.collections.get('courses');
    const course = await coursesCollection.find(courseId.toString());
    await database.write(async () => {
      await course.update(c => {
        c.color = color;
      });
    });
  },

  async updateResourceContent(resourceId, contentStr, videoUrl = null, vttUrl = null) {
    console.log(`[DB] 📀 updateResourceContent ID: ${resourceId} | hasContent: ${!!contentStr}, videoUrl: ${videoUrl}`);
    const resourcesCollection = database.collections.get('resources');
    const existing = await resourcesCollection.query(Q.where('id', resourceId.toString())).fetch();
    if (existing.length > 0) {
      const resource = existing[0];
      await database.write(async () => {
        await resource.update(r => {
          if (contentStr !== null) r.content = contentStr;
          if (videoUrl !== null) r.videoUrl = videoUrl;
          if (vttUrl !== null) r.vttUrl = vttUrl;
        });
        console.log(`[DB] ✅ updateResourceContent Success for ${resourceId}`);
      });
    } else {
      console.warn(`[DB] ⚠️ updateResourceContent: Resource ${resourceId} not found in DB!`);
    }
  },

  // --- Resources & Details ---

  async getResourceById(resourceId) {
    console.log(`[DB] 🔍 getResourceById: ${resourceId}`);
    const resourcesCollection = database.collections.get('resources');
    const existing = await resourcesCollection.query(Q.where('id', resourceId.toString())).fetch();
    const found = existing.length > 0 ? existing[0] : null;
    console.log(`[DB] 🔍 getResourceById result: ${found ? 'FOUND' : 'MISSING'}`);
    return found;
  },

  async saveFullCourseData(courseId, data) {
    console.log(`[DB] 🗃️ saveFullCourseData for Course ${courseId}. Modules to process: ${data.cm?.length || 0}`);
    const resourcesCollection = database.collections.get('resources');

    await database.write(async () => {
      const batchOperations = [];

      if (data.cm) {
        for (const mod of data.cm) {
          const existing = await resourcesCollection.query(
            Q.where('id', mod.id.toString())
          ).fetch();

          if (existing.length > 0) {
            batchOperations.push(existing[0].prepareUpdate(r => {
              r.name = mod.name;
              r.type = mod.modname; 
              r.url = mod.url;
              r.course.id = courseId.toString();
            }));
          } else {
            batchOperations.push(resourcesCollection.prepareCreate(r => {
              r._raw.id = mod.id.toString();
              r.name = mod.name;
              r.type = mod.modname;
              r.url = mod.url;
              r.course.id = courseId.toString();
            }));
          }
        }
      }

      await database.batch(...batchOperations);
      console.log(`[DB] ✅ saveFullCourseData complete for ${courseId}.`);
    });
  },

  // --- Search ---

  async search(text) {
    console.log(`[DB] 🔎 Search query: "${text}"`);
    if (!text || text.trim() === '') {
      return { courses: [], resources: [] };
    }

    const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    const courseConditions = tokens.map(token => 
      Q.or(
        Q.where('fullname', Q.like(`%${token}%`)),
        Q.where('shortname', Q.like(`%${token}%`)),
        Q.where('summary', Q.like(`%${token}%`))
      )
    );

    const resourceConditions = tokens.map(token =>
      Q.or(
        Q.where('name', Q.like(`%${token}%`)),
        Q.where('content', Q.like(`%${token}%`))
      )
    );

    const courses = await database.collections.get('courses').query(
      Q.and(...courseConditions)
    ).fetch();

    const resources = await database.collections.get('resources').query(
      Q.and(...resourceConditions)
    ).fetch();

    // Enhancing resources with match info if it came from content (VTT)
    const enrichedResources = resources.map(r => {
      if (!r.content) return r;

      const contentLower = r.content.toLowerCase();
      const firstToken = tokens[0];
      const matchIndex = contentLower.indexOf(firstToken);

      if (matchIndex === -1) return r;

      // Try to find the timestamp in the VTT format
      // Format: HH:MM:SS.mmm --> HH:MM:SS.mmm
      // We look backwards from the matchIndex for the closest timestamp
      const contentBefore = r.content.substring(0, matchIndex);
      const linesBefore = contentBefore.split('\n');
      
      let timestamp = null;
      // Regex for VTT timestamp line
      const vttRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
      
      for (let i = linesBefore.length - 1; i >= 0; i--) {
        const line = linesBefore[i].trim();
        const match = line.match(vttRegex);
        if (match) {
          timestamp = match[1]; // Start time
          break;
        }
      }

      // Extract snippet
      const snippetStart = Math.max(0, matchIndex - 60);
      const snippetEnd = Math.min(r.content.length, matchIndex + 100);
      let snippet = r.content.substring(snippetStart, snippetEnd);
      
      // Clean up snippets if they contain timestamps
      snippet = snippet.replace(vttRegex, '').replace(/-->/g, '').trim();

      return {
        ...r,
        _raw: {
            ...r._raw,
            snippet: snippet,
            timestamp: timestamp
        },
        snippet: snippet,
        timestamp: timestamp
      };
    });

    console.log(`[DB] 🔎 Search results: ${courses.length} courses, ${enrichedResources.length} resources.`);
    return { courses, resources: enrichedResources };
  },

  // --- Sync All ---
  async syncAll(sessionUrl, sessionKey, fetchCourseDetailsFn) {
    // 1. Get all courses from DB (assuming they are already synced via useMoodle)
    const courses = await database.collections.get('courses').query().fetch();

    for (const course of courses) {
      try {
        // Fetch details
        const details = await fetchCourseDetailsFn(sessionUrl, sessionKey, course.id);

        // Save details
        if (details) {
          // We need to adapt the data structure here to match what saveFullCourseData expects
          // In api/moodle.js, fetchCourseDetails returns httpResponse which has { course, section, cm }
          await this.saveFullCourseData(course.id, details);
        }
      } catch (e) {
        console.error(`Failed to sync course ${course.id}`, e);
      }
    }
  },
  /*
*/
  // --- Future Proofing / Abstraction ---
  // If we switch to RxDB, we replace the implementation of these methods.
  // The React components should only use `dbService.observeCourses()` or `dbService.search()`.
}
