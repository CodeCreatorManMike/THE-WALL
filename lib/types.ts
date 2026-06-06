export type AppState =
  | 'LOADING'
  | 'EDIT'
  | 'PLACING'
  | 'SAVED'
  | 'VIEW_ONLY'

export interface NoteData {
  id?: string
  variantKey: string
  color: string
  text: string
  worldX: number
  worldY: number
  rotation: number  // degrees
  zIndex: number
  imageData?: string  // base64 data URL — polaroid user photo (local session only)
  // runtime only
  screenX: number
  screenY: number
  isDragging?: boolean
}

export interface Camera {
  x: number
  y: number
}
