import { supabase } from './supabase'

const BUCKET = 'product-images'
const MAX_DIM = 800

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image compression failed'))), 'image/jpeg', 0.82)
  )
}

export async function uploadProductImage(file: File, shopId: string): Promise<string> {
  let blob: Blob = file
  let contentType = file.type || 'image/jpeg'
  try {
    blob = await compress(file)
    contentType = 'image/jpeg'
  } catch {
    // fall back to uploading the original file
  }
  const path = `${shopId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, cacheControl: '3600' })
  if (error) {
    if (/bucket/i.test(error.message)) {
      throw new Error(`Storage bucket "${BUCKET}" not found. Run supabase-storage-setup.sql in your Supabase SQL editor.`)
    }
    throw error
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
