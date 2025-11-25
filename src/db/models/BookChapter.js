import { Model } from '@nozbe/watermelondb'
import { field, text, relation } from '@nozbe/watermelondb/decorators'

export default class BookChapter extends Model {
  static table = 'book_chapters'

  @text('title') title
  @text('content') content
  
  @relation('books', 'book_id') book
}
