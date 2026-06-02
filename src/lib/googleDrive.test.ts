import { describe, it, expect } from 'vitest'
import {
  mimeKind,
  formatBytes,
  folderListQuery,
  nameSearchQuery,
  isFolder,
} from './googleDrive'

describe('googleDrive helpers', () => {
  it('mimeKind 分類', () => {
    expect(mimeKind('application/vnd.google-apps.folder')).toBe('folder')
    expect(mimeKind('application/pdf')).toBe('pdf')
    expect(mimeKind('application/vnd.google-apps.document')).toBe('doc')
    expect(mimeKind('application/vnd.google-apps.presentation')).toBe('slides')
    expect(mimeKind('application/vnd.google-apps.spreadsheet')).toBe('sheet')
    expect(mimeKind('video/mp4')).toBe('video')
    expect(mimeKind('image/png')).toBe('image')
    expect(mimeKind('text/plain')).toBe('file')
  })

  it('isFolder', () => {
    expect(isFolder('application/vnd.google-apps.folder')).toBe(true)
    expect(isFolder('application/pdf')).toBe(false)
  })

  it('formatBytes', () => {
    expect(formatBytes(undefined)).toBe('')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('folderListQuery：parent + 去 trash', () => {
    expect(folderListQuery('ABC')).toBe("'ABC' in parents and trashed = false")
  })

  it('nameSearchQuery：escape 單引號', () => {
    expect(nameSearchQuery("a'b")).toBe("name contains 'a\\'b' and trashed = false")
  })
})
