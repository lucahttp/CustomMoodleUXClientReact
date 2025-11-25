import { Q } from '@nozbe/watermelondb'
import database from './index'

export const dbService = {
  // --- Courses ---
  getCoursesCollection: () => database.collections.get('courses'),
  
  observeCourses: () => database.collections.get('courses').query().observe(),

  async saveCourses(apiCourses) {
    const coursesCollection = database.collections.get('courses');
    
    await database.write(async () => {
      const batchOperations = [];
      
      // We need to check which courses already exist to update them, and which are new
      // For simplicity in this example, we'll iterate. 
      // In a large app, you'd fetch all IDs first.
      
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
              // Don't overwrite color if it exists, or do? Let's keep it if we calculated it.
            })
          );
        } else {
          batchOperations.push(
            coursesCollection.prepareCreate(c => {
              c._raw.id = apiCourse.id.toString(); // WatermelonDB uses string IDs
              c.fullname = apiCourse.fullname;
              c.shortname = apiCourse.shortname;
              c.summary = apiCourse.summary;
              c.courseimage = apiCourse.courseimage;
            })
          );
        }
      }
      
      await database.batch(...batchOperations);
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

  // --- Resources & Details ---
  
  async saveFullCourseData(courseId, data) {
    // data = { course, section, cm }
    const resourcesCollection = database.collections.get('resources');
    
    await database.write(async () => {
      const batchOperations = [];
      
      // 1. Update Course details if needed
      // We could update the course summary or other details from data.course
      
      // 2. Sync Resources (Modules)
      if (data.cm) {
        for (const mod of data.cm) {
           // Check if exists
           const existing = await resourcesCollection.query(
             Q.where('id', mod.id.toString())
           ).fetch();

           if (existing.length > 0) {
             batchOperations.push(existing[0].prepareUpdate(r => {
               r.name = mod.name;
               r.type = mod.modname; // e.g. 'url', 'book', 'resource'
               r.url = mod.url;
               r.course.id = courseId.toString();
               // r.sectionName = ... find section name by mod.section (id)
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
    });
  },

  // --- Search ---
  
  async search(text) {
    // Simple search implementation
    // 1. Search Courses
    const courses = await database.collections.get('courses').query(
      Q.or(
        Q.where('fullname', Q.like(`%${text}%`)),
        Q.where('shortname', Q.like(`%${text}%`))
      )
    ).fetch();
    
    // 2. Search Resources
    const resources = await database.collections.get('resources').query(
      Q.where('name', Q.like(`%${text}%`))
    ).fetch();
    
    return { courses, resources };
  },
  
  // --- Sync All ---
  /*
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
*/
  // --- Future Proofing / Abstraction ---
  // If we switch to RxDB, we replace the implementation of these methods.
  // The React components should only use `dbService.observeCourses()` or `dbService.search()`.
}
