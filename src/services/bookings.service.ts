import { api } from '../config/api';
import type { Booking, BookingItem, CartItem } from '../types';

function deserializeBooking(b: Booking): Booking {
  return { ...b, createdAt: new Date(b.createdAt) };
}

export async function createBooking(
  _userId: string,
  _userDisplayName: string,
  _userEmail: string,
  cartItems: CartItem[]
): Promise<string> {
  const id = crypto.randomUUID();
  const items: BookingItem[] = cartItems.map(i => ({
    productId:   i.productId,
    productName: i.productName,
    quantity:    i.cartQuantity,
    unit:        i.unit,
    imageUrl:    i.imageUrl,
    boxId:       i.boxId,
    boxName:     i.boxName,
    parentId:    i.parentId,
    parentName:  i.parentName,
  }));
  const parentIds = [...new Set(items.map(i => i.parentId).filter(Boolean))];
  const { id: returnedId } = await api.post<{ id: string }>('/bookings', { id, items, parentIds });
  return returnedId;
}

export async function returnBooking(bookingId: string): Promise<string> {
  const { id } = await api.post<{ id: string }>(`/bookings/${bookingId}/return`, {});
  return id;
}

export function subscribeToGroupBookings(
  groupId: string,
  callback: (bookings: Booking[]) => void
): () => void {
  let active = true;
  async function load() {
    try {
      const bookings = await api.get<Booking[]>(`/bookings?groupId=${groupId}`);
      if (active) callback(bookings.map(deserializeBooking));
    } catch { /* ignore */ }
  }
  load();
  const interval = setInterval(load, 8000);
  return () => { active = false; clearInterval(interval); };
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  try {
    const booking = await api.get<Booking>(`/bookings/${bookingId}`);
    return deserializeBooking(booking);
  } catch {
    return null;
  }
}

export async function createReturnBooking(
  originalBookingId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  await api.post(`/bookings/${originalBookingId}/return`, { items });
}
