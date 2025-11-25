import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

import schema from './schema'
import Course from './models/Course'
import Resource from './models/Resource'
import Book from './models/Book'
import BookChapter from './models/BookChapter'

const adapter = new LokiJSAdapter({
  schema,
  // migrations, // we'll skip migrations for now
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  // dbName: 'myapp', // optional db name
  // onQuotaExceededError: (error) => { ... }
})

const database = new Database({
  adapter,
  modelClasses: [
    Course,
    Resource,
    Book,
    BookChapter,
  ],
})

export default database
