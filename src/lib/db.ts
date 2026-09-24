import { createFirebaseStore } from './firebase-store'
import { firebaseTransport } from './firebase-transport'

// Initialization is lazy: builds do not access Firebase or require credentials.
export const db = createFirebaseStore(firebaseTransport)
