/*
 * MinIO Javascript Library for Amazon S3 Compatible Cloud Storage, (C) 2016 MinIO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'events'

import { pipesetup, uriEscape } from '../helpers.mts'
import { DEFAULT_REGION } from '../s3-endpoints.mts'
import * as transformers from '../transformers.mts'
import type { IClient } from '../type.ts'
import type { NotificationEvent } from './events.mts'

// TODO: type this
type NotificationRecord = unknown

// Poll for notifications, used in #listenBucketNotification.
// Listening constitutes repeatedly requesting s3 whether or not any
// changes have occurred.
export class NotificationPoller extends EventEmitter {
  private client: IClient
  private bucketName: string
  private prefix: string
  private suffix: string
  private events: NotificationEvent[]
  private ending: boolean

  constructor(client: IClient, bucketName: string, prefix: string, suffix: string, events: NotificationEvent[]) {
    super()

    this.client = client
    this.bucketName = bucketName
    this.prefix = prefix
    this.suffix = suffix
    this.events = events

    this.ending = false
  }

  // Starts the polling.
  start() {
    this.ending = false

    process.nextTick(() => {
      this.checkForChanges()
    })
  }

  // Stops the polling.
  stop() {
    this.ending = true
  }

  checkForChanges() {
    // Don't continue if we're looping again but are cancelled.
    if (this.ending) {
      return
    }

    let method = 'GET'
    let queries = []
    if (this.prefix) {
      let prefix = uriEscape(this.prefix)
      queries.push(`prefix=${prefix}`)
    }
    if (this.suffix) {
      let suffix = uriEscape(this.suffix)
      queries.push(`suffix=${suffix}`)
    }
    if (this.events) {
      this.events.forEach((s3event) => queries.push('events=' + uriEscape(s3event)))
    }
    queries.sort()

    let query = ''
    if (queries.length > 0) {
      query = `${queries.join('&')}`
    }
    const region = this.client.region || DEFAULT_REGION
    this.client.makeRequest({ method, bucketName: this.bucketName, query }, '', [200], region, true, (e, response) => {
      if (e) {
        return this.emit('error', e)
      }

      let transformer = transformers.getNotificationTransformer()
      pipesetup(response, transformer)
        .on('data', (result) => {
          // Data is flushed periodically (every 5 seconds), so we should
          // handle it after flushing from the JSON parser.
          let records = result.Records
          // If null (= no records), change to an empty array.
          if (!records) {
            records = []
          }

          // Iterate over the notifications and emit them individually.
          records.forEach((record: NotificationRecord) => {
            this.emit('notification', record)
          })

          // If we're done, stop.
          if (this.ending) {
            response.destroy()
          }
        })
        .on('error', (e) => this.emit('error', e))
        .on('end', () => {
          // Do it again, if we haven't cancelled yet.
          process.nextTick(() => {
            this.checkForChanges()
          })
        })
    })
  }
}
