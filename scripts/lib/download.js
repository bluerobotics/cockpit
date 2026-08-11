/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const https = require('https')
const fs = require('fs')

/**
 * Download a file from a URL, following redirects. The bytes land in a `.part`
 * file that is only renamed once the whole body arrived, so a failed download
 * never leaves behind a file that the next run mistakes for a finished one and
 * skips.
 * @param {string} url
 * @param {string} outputPath
 */
function downloadFile(url, outputPath) {
  const partPath = `${outputPath}.part`

  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`)

    const file = fs.createWriteStream(partPath)
    const fail = (error) => file.close(() => fs.unlink(partPath, () => reject(error)))

    https
      .get(url, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          const nextUrl = new URL(response.headers.location, url).toString()
          response.resume()
          file.close(() => fs.unlink(partPath, () => downloadFile(nextUrl, outputPath).then(resolve).catch(reject)))
          return
        }

        if (response.statusCode !== 200) {
          response.resume()
          fail(new Error(`Failed to download: ${response.statusCode}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0

        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          if (totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1)
            process.stdout.write(`\rDownloading... ${percent}%`)
          }
        })
        response.on('error', fail)

        response.pipe(file)

        file.on('finish', () => {
          file.close(() => {
            if (totalSize > 0 && downloadedSize !== totalSize) {
              fs.unlink(partPath, () =>
                reject(new Error(`Truncated download: got ${downloadedSize} of ${totalSize} bytes`))
              )
              return
            }
            fs.rename(partPath, outputPath, (error) => {
              if (error) {
                reject(error)
                return
              }
              console.log('\nDownload completed!')
              resolve()
            })
          })
        })
      })
      .on('error', fail)
  })
}

module.exports = { downloadFile }
