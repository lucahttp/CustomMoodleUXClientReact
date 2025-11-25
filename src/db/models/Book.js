import { Model } from '@nozbe/watermelondb'
import { field, text, children, relation } from '@nozbe/watermelondb/decorators'

export default class Book extends Model {
  static table = 'books'

  @text('name') name
  @text('intro') intro
  
  @relation('courses', 'course_id') course
  @children('book_chapters') chapters
}
