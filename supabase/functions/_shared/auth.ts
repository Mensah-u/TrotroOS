/**
 * Ensures the caller owns userId.
 * Passengers: x-device-id header must match userId (passenger_profiles.device_id).
 * Mates / authenticated users: valid Supabase JWT whose sub matches userId.
 */
export async function verifyUserAccess(
  req: Request,
  userId: string,
  getUser: (token: string) => Promise<{ user: { id: string; email?: string | null } | null }>,
): Promise<string | null> {
  const deviceHeader =
    req.headers.get('x-device-id')?.trim() ||
    req.headers.get('X-Device-Id')?.trim() ||
    '';

  if (deviceHeader) {
    return deviceHeader === userId
      ? null
      : 'x-device-id does not match userId';
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return 'Missing x-device-id header or Authorization bearer token';
  }

  const { user } = await getUser(token);
  if (!user) {
    return 'Invalid or expired auth token';
  }

  if (user.id !== userId && user.email !== userId) {
    return 'Authenticated user does not match userId';
  }

  return null;
}
