import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Product } from '../types';

type FirestoreData = Record<string, unknown>;

function toProduct(id: string, data: FirestoreData): Product {
  return {
    id,
    name: data.name as string,
    spaceId: data.spaceId as string,
    quantity: (data.quantity as number) ?? 0,
    minQuantity: (data.minQuantity as number | null) ?? null,
    unit: (data.unit as Product['unit']) || 'Stück',
    category: (data.category as string) || '',
    description: (data.description as string) || '',
    barcode: (data.barcode as string | null) ?? null,
    imageUrl: (data.imageUrl as string | null) ?? null,
    lastModifiedBy: (data.lastModifiedBy as string) || '',
    lastModifiedByEmail: (data.lastModifiedByEmail as string) || '',
    lastModifiedAt: (data.lastModifiedAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
  };
}

export async function createProduct(
  spaceId: string,
  userId: string,
  userEmail: string,
  data: Omit<Product, 'id' | 'spaceId' | 'lastModifiedBy' | 'lastModifiedByEmail' | 'lastModifiedAt' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'products'), {
    ...data,
    spaceId,
    lastModifiedBy: userId,
    lastModifiedByEmail: userEmail,
    lastModifiedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  productId: string,
  userId: string,
  userEmail: string,
  data: Partial<Omit<Product, 'id' | 'spaceId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'products', productId), {
    ...data,
    lastModifiedBy: userId,
    lastModifiedByEmail: userEmail,
    lastModifiedAt: serverTimestamp(),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, 'products', productId));
}

export async function updateQuantity(
  productId: string,
  userId: string,
  userEmail: string,
  quantity: number
): Promise<void> {
  await updateDoc(doc(db, 'products', productId), {
    quantity,
    lastModifiedBy: userId,
    lastModifiedByEmail: userEmail,
    lastModifiedAt: serverTimestamp(),
  });
}

export function subscribeToSpaceProducts(
  spaceId: string,
  callback: (products: Product[]) => void
): Unsubscribe {
  const q = query(collection(db, 'products'), where('spaceId', '==', spaceId));
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map((d) => toProduct(d.id, d.data() as FirestoreData));
    callback(products.sort((a, b) => {
      if ((a.quantity === 0) !== (b.quantity === 0)) return a.quantity === 0 ? 1 : -1;
      return a.name.localeCompare(b.name);
    }));
  });
}

export function subscribeToAllProducts(
  callback: (products: Product[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'products'), (snapshot) => {
    const products = snapshot.docs.map((d) => toProduct(d.id, d.data() as FirestoreData));
    callback(products.sort((a, b) => a.name.localeCompare(b.name)));
  });
}
