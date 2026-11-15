import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

export async function iniciarSesionGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  const u = cred.user;
  if (u && u.emailVerified) {
    const path = `users/${u.uid}`;
    try {
      await setDoc(
        doc(db, 'users', u.uid),
        {
          uid: sanitizeId(u.uid),
          email: (u.email ?? 'usuario@local.dev').slice(0, 256),
          displayName: (u.displayName ?? u.email ?? 'Investigador').slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
  return u;
}

export async function cerrarSesionGoogle(): Promise<void> {
  await signOut(auth);
}

export interface FirestoreWhitelistItem {
  id: string;
  domain: string;
  label: string;
  category: 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial';
  active: boolean;
  ownerUid: string;
}

export interface FirestoreKnowledgeEntry {
  id: string;
  ownerUid: string;
  tipo: 'clima' | 'similitud';
  sitio: string;
  sourceUrl: string;
  sourceDomain: string;
  whitelisted: boolean;
  autoApproved: boolean;
  verifiedBySearch: boolean;
  verificationSummary: string;
  status: 'aprobado' | 'pendiente' | 'rechazado';
  temperatura: number;
  presion: number;
  viento: number;
  luz: number;
}

export async function guardarDominioFirestore(
  user: User,
  params: {
    domain: string;
    label: string;
    category: 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial';
    active: boolean;
  }
): Promise<void> {
  const id = sanitizeId(`wl-${params.domain.toLowerCase()}`);
  const path = `whitelistDomains/${id}`;
  try {
    await setDoc(doc(db, 'whitelistDomains', id), {
      id,
      domain: params.domain.trim().toLowerCase().slice(0, 160),
      label: params.label.trim().slice(0, 120) || params.domain.slice(0, 120),
      category: params.category,
      active: Boolean(params.active),
      ownerUid: sanitizeId(user.uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleDominioFirestore(
  id: string,
  active: boolean
): Promise<void> {
  const path = `whitelistDomains/${id}`;
  try {
    await updateDoc(doc(db, 'whitelistDomains', id), {
      active: Boolean(active),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function eliminarDominioFirestore(id: string): Promise<void> {
  const path = `whitelistDomains/${id}`;
  try {
    await deleteDoc(doc(db, 'whitelistDomains', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function guardarEntradaFirestore(
  user: User,
  entry: Omit<FirestoreKnowledgeEntry, 'id' | 'ownerUid'>
): Promise<void> {
  const id = sanitizeId(`obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const path = `knowledgeEntries/${id}`;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

  try {
    await setDoc(doc(db, 'knowledgeEntries', id), {
      id,
      ownerUid: sanitizeId(user.uid),
      tipo: entry.tipo === 'similitud' ? 'similitud' : 'clima',
      sitio: entry.sitio.trim().slice(0, 140) || 'Tierra (Atacama, 2400 m)',
      sourceUrl: entry.sourceUrl.trim().slice(0, 500) || 'https://nasa.gov',
      sourceDomain: entry.sourceDomain.trim().slice(0, 160) || 'nasa.gov',
      whitelisted: Boolean(entry.whitelisted),
      autoApproved: Boolean(entry.autoApproved),
      verifiedBySearch: Boolean(entry.verifiedBySearch),
      verificationSummary: entry.verificationSummary.trim().slice(0, 1200),
      status: entry.status,
      temperatura: clamp(entry.temperatura, 0, 1000),
      presion: clamp(entry.presion, 0, 10000000),
      viento: clamp(entry.viento, 0, 150),
      luz: clamp(entry.luz, 0, 1500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function suscribirDatosUsuario(
  user: User,
  callbacks: {
    onWhitelist: (items: FirestoreWhitelistItem[]) => void;
    onEntries: (items: FirestoreKnowledgeEntry[]) => void;
    onError: (msg: string) => void;
  }
): Unsubscribe {
  const qWl = query(
    collection(db, 'whitelistDomains'),
    where('ownerUid', '==', user.uid)
  );
  const qKn = query(
    collection(db, 'knowledgeEntries'),
    where('ownerUid', '==', user.uid)
  );

  const unsub1 = onSnapshot(
    qWl,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as FirestoreWhitelistItem);
      callbacks.onWhitelist(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'whitelistDomains');
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : 'Error leyendo whitelist Firestore');
      }
    }
  );

  const unsub2 = onSnapshot(
    qKn,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as FirestoreKnowledgeEntry);
      callbacks.onEntries(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'knowledgeEntries');
      } catch (e) {
        callbacks.onError(e instanceof Error ? e.message : 'Error leyendo registros Firestore');
      }
    }
  );

  return () => {
    unsub1();
    unsub2();
  };
}
