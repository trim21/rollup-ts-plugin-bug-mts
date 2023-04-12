import crc32 from 'buffer-crc32'

import { SelectResults } from '../SelectResults.mts'

class ReadableBuffer {
  private buf: Buffer

  public readLoc: number

  constructor(buf: Buffer) {
    this.buf = buf
    this.readLoc = 0
  }

  read(size: number): Buffer {
    const sub = this.buf.subarray(this.readLoc, this.readLoc + size)
    this.readLoc += size
    return sub
  }

  notEnd(): boolean {
    return this.readLoc < this.buf.length
  }
}

export function parseSelectObjectContentResponse(res: Buffer): SelectResults {
  // extractHeaderType extracts the first half of the header message, the header type.
  function extractHeaderType(stream: ReadableBuffer) {
    const headerNameLen = stream.read(1).readUInt8()
    const headerNameWithSeparator = stream.read(headerNameLen).toString()

    const splitBySeparator = (headerNameWithSeparator || '').split(':')

    return splitBySeparator.length >= 1 ? splitBySeparator[1] : ''
  }

  function extractHeaderValue(stream: ReadableBuffer) {
    const bodyLen = stream.read(2).readUInt16BE()
    return stream.read(bodyLen).toString()
  }

  const selectResults = new SelectResults({}) // will be returned

  const responseStream = new ReadableBuffer(res) // convert byte array to a readable responseStream
  while (responseStream.notEnd()) {
    // Top level responseStream read tracker.
    let msgCrcAccumulator // accumulate from start of the message till the message crc start.

    const totalByteLengthBuffer = responseStream.read(4)
    msgCrcAccumulator = crc32(totalByteLengthBuffer)

    const headerBytesBuffer = responseStream.read(4)
    msgCrcAccumulator = crc32(headerBytesBuffer, msgCrcAccumulator)

    const calculatedPreludeCrc = msgCrcAccumulator.readInt32BE() // use it to check if any CRC mismatch in header itself.

    const preludeCrcBuffer = responseStream.read(4) // read 4 bytes    i.e 4+4 =8 + 4 = 12 ( prelude + prelude crc)
    msgCrcAccumulator = crc32(preludeCrcBuffer, msgCrcAccumulator)

    const totalMsgLength = totalByteLengthBuffer.readInt32BE()
    const headerLength = headerBytesBuffer.readInt32BE()
    const preludeCrcByteValue = preludeCrcBuffer.readInt32BE()

    if (preludeCrcByteValue !== calculatedPreludeCrc) {
      // Handle Header CRC mismatch Error
      throw new Error(
        `Header Checksum Mismatch, Prelude CRC of ${preludeCrcByteValue} does not equal expected CRC of ${calculatedPreludeCrc}`
      )
    }

    const headers: Record<string, string> = {}

    if (headerLength > 0) {
      const headerBytes = responseStream.read(headerLength)
      msgCrcAccumulator = crc32(headerBytes, msgCrcAccumulator)
      const headerReaderStream = new ReadableBuffer(headerBytes)
      while (headerReaderStream.notEnd()) {
        let headerTypeName = extractHeaderType(headerReaderStream)
        headerReaderStream.read(1) // just read and ignore it.
        headers[headerTypeName] = extractHeaderValue(headerReaderStream)
      }
    }

    let payloadStream: ReadableBuffer
    const payLoadLength = totalMsgLength - headerLength - 16
    if (payLoadLength > 0) {
      const payLoadBuffer = responseStream.read(payLoadLength)
      msgCrcAccumulator = crc32(payLoadBuffer, msgCrcAccumulator)
      // read the checksum early and detect any mismatch so we can avoid unnecessary further processing.
      const messageCrcByteValue = responseStream.read(4).readInt32BE()
      const calculatedCrc = msgCrcAccumulator.readInt32BE()
      // Handle message CRC Error
      if (messageCrcByteValue !== calculatedCrc) {
        throw new Error(
          `Message Checksum Mismatch, Message CRC of ${messageCrcByteValue} does not equal expected CRC of ${calculatedCrc}`
        )
      }
      payloadStream = new ReadableBuffer(payLoadBuffer)
    }

    const messageType = headers['message-type']

    switch (messageType) {
      case 'error': {
        const errorMessage = headers['error-code'] + ':"' + headers['error-message'] + '"'
        throw new Error(errorMessage)
      }
      case 'event': {
        const contentType = headers['content-type']
        const eventType = headers['event-type']

        switch (eventType) {
          case 'End': {
            selectResults.setResponse(res)
            return selectResults
          }

          case 'Records': {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const readData = payloadStream.read(payLoadLength)
            selectResults.setRecords(readData)
            break
          }

          case 'Progress':
            {
              switch (contentType) {
                case 'text/xml': {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  const progressData = payloadStream.read(payLoadLength)
                  selectResults.setProgress(progressData.toString())
                  break
                }
                default: {
                  const errorMessage = `Unexpected content-type ${contentType} sent for event-type Progress`
                  throw new Error(errorMessage)
                }
              }
            }
            break
          case 'Stats':
            {
              switch (contentType) {
                case 'text/xml': {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  const statsData = payloadStream.read(payLoadLength)
                  selectResults.setStats(statsData.toString())
                  break
                }
                default: {
                  const errorMessage = `Unexpected content-type ${contentType} sent for event-type Stats`
                  throw new Error(errorMessage)
                }
              }
            }
            break
          default: {
            // Continuation message: Not sure if it is supported. did not find a reference or any message in response.
            // It does not have a payload.
            const warningMessage = `Un implemented event detected  ${messageType}.`
            // eslint-disable-next-line no-console
            console.warn(warningMessage)
          }
        } // eventType End
      } // Event End
    } // messageType End
  } // Top Level Stream End

  throw new Error('unexpected end of stream')
}
