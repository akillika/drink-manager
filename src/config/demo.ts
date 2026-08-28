/**
 * Demo mode — set VITE_DEV_DEMO=true in .env.local to skip Firebase auth and
 * render every page against realistic in-memory data. All writes are no-ops.
 *
 * Do NOT set VITE_DEV_DEMO in production.
 */
export const DEMO_MODE =
  import.meta.env.VITE_DEV_DEMO === 'true' ||
  import.meta.env.VITE_DEV_DEMO === '1';

// A User-shaped object that satisfies our components without Firebase.
export const DEMO_USER = {
  uid: 'demo-user',
  displayName: 'Akil',
  email: 'akil@akil.codes',
  emailVerified: true,
  isAnonymous: false,
  photoURL: null,
  providerId: 'demo',
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'demo-token',
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
} as any;
