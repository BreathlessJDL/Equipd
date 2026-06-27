import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getPasswordRequirementStatus, validatePassword } from '../_shared/passwordPolicy.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const body = await req.json()
    const password = body?.password

    const result = validatePassword(password)

    if (!result.valid) {
      return jsonResponse(
        {
          valid: false,
          error: result.error,
          requirements: getPasswordRequirementStatus(
            typeof password === 'string' ? password : '',
          ),
        },
        400,
      )
    }

    return jsonResponse({ valid: true })
  } catch {
    return errorResponse('Invalid request body', 400)
  }
})
