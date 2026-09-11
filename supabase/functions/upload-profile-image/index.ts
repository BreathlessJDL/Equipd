import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import jsQR from 'npm:jsqr@1.4.0'
import jpeg from 'npm:jpeg-js@0.4.4'
import UPNG from 'npm:upng-js@2.1.0'

const PROFILE_IMAGES_BUCKET = 'profile-images'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png'])
const QR_REJECT_MESSAGE =
  "QR codes aren't permitted in profile images. For your security, payments and communication should remain within Equipd."

function decodeImageRgba(
  bytes: Uint8Array,
  contentType: string,
): { data: Uint8ClampedArray; width: number; height: number } | null {
  try {
    if (contentType === 'image/jpeg') {
      const decoded = jpeg.decode(bytes, { useTArray: true })
      return {
        data: new Uint8ClampedArray(decoded.data),
        width: decoded.width,
        height: decoded.height,
      }
    }

    if (contentType === 'image/png') {
      const png = UPNG.decode(bytes)
      const rgba = UPNG.toRGBA8(png)[0]
      return {
        data: new Uint8ClampedArray(rgba),
        width: png.width,
        height: png.height,
      }
    }
  } catch (error) {
    console.error('profile image decode failed', error)
  }
  return null
}

function containsQrCode(bytes: Uint8Array, contentType: string): boolean {
  const image = decodeImageRgba(bytes, contentType)
  if (!image) return false

  // Downscale large images for performance while preserving QR detectability.
  const maxDim = 800
  let { data, width, height } = image
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height)
    const tw = Math.max(1, Math.floor(width * scale))
    const th = Math.max(1, Math.floor(height * scale))
    const out = new Uint8ClampedArray(tw * th * 4)
    for (let y = 0; y < th; y += 1) {
      for (let x = 0; x < tw; x += 1) {
        const sx = Math.min(width - 1, Math.floor(x / scale))
        const sy = Math.min(height - 1, Math.floor(y / scale))
        const si = (sy * width + sx) * 4
        const ti = (y * tw + x) * 4
        out[ti] = data[si]
        out[ti + 1] = data[si + 1]
        out[ti + 2] = data[si + 2]
        out[ti + 3] = data[si + 3]
      }
    }
    data = out
    width = tw
    height = th
  }

  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  return Boolean(code?.data)
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const user = await getAuthenticatedUser(req)
    if (!user) return errorResponse('Unauthorized', 401)

    const admin = getSupabaseAdmin()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, is_suspended')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error(profileError.message)
      return errorResponse('Could not verify account status', 500)
    }

    if (profile?.is_suspended) {
      return errorResponse('Your account is suspended and cannot update profile images.', 403)
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return errorResponse('file is required', 400)
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return errorResponse('Only JPG and PNG images are allowed.', 400)
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return errorResponse('Profile image must be 5 MB or smaller.', 400)
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (containsQrCode(bytes, file.type)) {
      return errorResponse(QR_REJECT_MESSAGE, 400)
    }

    const extension = file.type === 'image/png' ? 'png' : 'jpg'
    const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await admin.storage
      .from(PROFILE_IMAGES_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error(uploadError.message)
      return errorResponse('Could not upload profile image.', 500)
    }

    const { data: publicData } = admin.storage
      .from(PROFILE_IMAGES_BUCKET)
      .getPublicUrl(storagePath)

    return jsonResponse({
      storagePath,
      publicUrl: publicData.publicUrl,
    })
  } catch (error) {
    console.error('upload-profile-image failed', error)
    return errorResponse('Could not upload profile image.', 500)
  }
})
