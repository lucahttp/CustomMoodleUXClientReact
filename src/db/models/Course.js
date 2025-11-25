import { Model } from '@nozbe/watermelondb'
import { field, children, date, text } from '@nozbe/watermelondb/decorators'

export default class Course extends Model {
  static table = 'courses'

  @text('fullname') fullname
  @text('shortname') shortname
  @text('summary') summary
  @text('courseimage') courseimage
  @text('color') color
  @date('last_synced_at') lastSyncedAt

  @children('resources') resources
  @children('books') books
}
