export type AppState =
  | 'LOADING'
  | 'EDIT'
  | 'PLACING'
  | 'SAVED'
  | 'VIEW_ONLY'

export interface NoteData {
  id?: string
  variantKey: string
  color: 'yellow' | 'blue' | 'red'
  text: string
  worldX: number
  worldY: number
  rotation: number  // degrees
  zIndex: number
  // runtime only
  screenX: number
  screenY: number
  isDragging?: boolean
}

export interface Camera {
  x: number
  y: number
}
