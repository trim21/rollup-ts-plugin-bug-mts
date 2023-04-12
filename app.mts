import { Client } from './src/main/minio.mjs'

const s3Client = new Client({})

// Reference: https://aws.amazon.com/blogs/storage/querying-data-without-servers-or-databases-using-amazon-s3-select/
const selectRequestConfig = {
  expression: `SELECT *
               FROM s3object s
               where s."Name" = 'Jane'`,
  expressionType: 'SQL',
  inputSerialization: {
    CSV: {
      FileHeaderInfo: 'Use',
      RecordDelimiter: '\n',
      FieldDelimiter: ',',
    },
    CompressionType: 'NONE',
  },
  outputSerialization: {
    CSV: {
      RecordDelimiter: '\n',
      FieldDelimiter: ',',
    },
  },
  requestProgress: { Enabled: true },
  // scanRange:{ start:50, end:100 }
}

const d = `
Name,PhoneNumber,City,Occupation
Sam,(949) 555-1234,Irvine,Solutions Architect
Vinod,(310) 555-1234,Los Angeles,Solutions Architect
Jeff,(206) 555-1234,Seattle,AWS Evangelist
Jane,(312) 555-1234,Chicago,Developer
Sean,(773) 555-1234,Chicago,Developer
Mary,(708) 555-1234,Chicago,Developer
Akira,(619) 555-1234,San Diego,Head of Marketing
Siyang,(720) 555-1234,Denver,AWS Evangelist
Casey,(512) 555-1234,Austin,Specialist Solutions Architect
Katerina,(917) 555-1234,New York,Software Development Manager
Onyx,(213) 555-1234,Los Angeles,Specialist Solutions Architect
Jinhyun,(617) 555-1234,Boston,AWS Evangelist
`.trim()

// await s3Client.putObject("bucket", "sample_data.csv", Buffer.from(d))

const o = await s3Client.selectObjectContent('bucket', 'sample_data.csv', selectRequestConfig)

console.log(o)
// console.log(o.records.toString());
