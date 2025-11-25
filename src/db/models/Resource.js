import { Model } from '@nozbe/watermelondb'
import { field, text, relation } from '@nozbe/watermelondb/decorators'

export default class Resource extends Model {
  static table = 'resources'

  @text('name') name
  @text('type') type
  @text('url') url
  @text('content') content
  @text('section_name') sectionName
  
  @relation('courses', 'course_id') course
}
