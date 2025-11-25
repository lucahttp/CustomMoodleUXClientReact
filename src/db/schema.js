import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'courses',
      columns: [
        { name: 'fullname', type: 'string' },
        { name: 'shortname', type: 'string' },
        { name: 'summary', type: 'string', isOptional: true },
        { name: 'courseimage', type: 'string', isOptional: true },
        { name: 'color', type: 'string', isOptional: true }, // For the pastel color
        { name: 'last_synced_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'resources',
      columns: [
        { name: 'course_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' }, // 'url', 'resource', 'book', etc.
        { name: 'url', type: 'string', isOptional: true },
        { name: 'content', type: 'string', isOptional: true }, // Cached HTML content
        { name: 'section_name', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'books',
      columns: [
        { name: 'course_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'intro', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'book_chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'content', type: 'string' }, // HTML content
      ]
    }),
  ]
})
