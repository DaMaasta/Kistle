export type UserRole = 'owner' | 'editor' | 'viewer';

export interface SpaceMember {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  type: 'room' | 'cabinet' | 'shelf' | 'box' | 'fridge' | 'other';
  parentId: string | null;
  ownerId: string;
  memberIds: string[];
  members: Record<string, SpaceMember>;
  icon: string;
  color: string;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductUnit = 'Stück' | 'kg' | 'g' | 'L' | 'ml' | 'Packung' | 'Flasche' | 'Dose' | 'Paar' | 'Box';

export interface Product {
  id: string;
  name: string;
  spaceId: string;
  quantity: number;
  minQuantity: number | null;
  unit: ProductUnit;
  category: string;
  description: string;
  barcode: string | null;
  imageUrl: string | null;
  lastModifiedBy: string;
  lastModifiedByEmail: string;
  lastModifiedAt: Date;
  createdAt: Date;
}

export interface CartItem {
  productId: string;
  productName: string;
  imageUrl: string | null;
  cartQuantity: number;
  maxQuantity: number;
  unit: ProductUnit;
  boxId: string;
  boxName: string;
  parentId: string | null;
  parentName: string;
}

export interface BookingItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  imageUrl: string | null;
  boxId: string;
  boxName: string;
  parentId: string | null;
  parentName: string;
}

export interface Booking {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  createdAt: Date;
  parentIds: string[];
  items: BookingItem[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
}
