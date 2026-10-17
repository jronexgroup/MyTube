import { ElectronAPI } from '@electron-toolkit/preload'
import 'mytube/content/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
  }
}
