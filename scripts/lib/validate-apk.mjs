import fs from 'fs'

const ZIP_LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const ZIP_END_OF_CENTRAL_DIRECTORY = Buffer.from([0x50, 0x4b, 0x05, 0x06])
const MAX_EOCD_SCAN_BYTES = 22 + 0xffff

export function validateApkFile (apkPath) {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK file not found: ${apkPath}`)
  }

  const fileBuffer = fs.readFileSync(apkPath)
  if (fileBuffer.length < 22) {
    throw new Error(`APK file is too small: ${apkPath}`)
  }

  if (!fileBuffer.subarray(0, 4).equals(ZIP_LOCAL_FILE_HEADER)) {
    throw new Error(`APK is not a ZIP/APK file: ${apkPath}`)
  }

  const scanStart = Math.max(0, fileBuffer.length - MAX_EOCD_SCAN_BYTES)
  const endSection = fileBuffer.subarray(scanStart)
  if (endSection.indexOf(ZIP_END_OF_CENTRAL_DIRECTORY) === -1) {
    throw new Error(`APK appears truncated or corrupted (missing ZIP end record): ${apkPath}`)
  }

  return {
    size: fileBuffer.length
  }
}
