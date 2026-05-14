import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Booking, BookingItem, CartItem } from '../types';
import { updateQuantity } from './products.service';

type FirestoreData = Record<string, unknown>;

function toBooking(id: string, data: FirestoreData): Booking {
  return {
    id,
    userId: data.userId as string,
    userDisplayName: (data.userDisplayName as string) || '',
    userEmail: (data.userEmail as string) || '',
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
    parentIds: (data.parentIds as string[]) || [],
    items: (data.items as BookingItem[]) || [],
  };
}

export async function createBooking(
  userId: string,
  userDisplayName: string,
  userEmail: string,
  cartItems: CartItem[]
): Promise<void> {
  const items: BookingItem[] = cartItems.map((ci) => ({
    productId: ci.productId,
    productName: ci.productName,
    quantity: ci.cartQuantity,
    unit: ci.unit,
    imageUrl: null,
    boxId: ci.boxId,
    boxName: ci.boxName,
    parentId: ci.parentId,
    parentName: ci.parentName,
  }));

  const parentIds = [...new Set(cartItems.map((ci) => ci.parentId).filter(Boolean) as string[])];

  // Mengen in den Boxen verringern
  await Promise.all(
    cartItems.map((ci) =>
      updateQuantity(
        ci.productId,
        userId,
        userEmail,
        Math.max(0, ci.maxQuantity - ci.cartQuantity)
      )
    )
  );

  // Abbuchung speichern
  await addDoc(collection(db, 'bookings'), {
    userId,
    userDisplayName,
    userEmail,
    parentIds,
    items,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToGroupBookings(
  groupId: string,
  callback: (bookings: Booking[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'bookings'),
    where('parentIds', 'array-contains', groupId)
  );
  return onSnapshot(q, (snap) => {
    const bookings = snap.docs
      .map((d) => toBooking(d.id, d.data() as FirestoreData))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(bookings);
  });
}
