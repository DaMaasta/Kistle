import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Space, SpaceMember, UserRole } from '../types';

type FirestoreData = Record<string, unknown>;

function toSpace(id: string, data: FirestoreData): Space {
  return {
    id,
    name: data.name as string,
    description: (data.description as string) || '',
    type: (data.type as Space['type']) || 'room',
    parentId: (data.parentId as string | null) ?? null,
    ownerId: data.ownerId as string,
    memberIds: (data.memberIds as string[]) || [],
    members: (data.members as Record<string, SpaceMember>) || {},
    icon: (data.icon as string) || '📦',
    color: (data.color as string) || '#3b82f6',
    isGroup: (data.isGroup as boolean) ?? false,
    createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
  };
}

export async function createSpace(
  userId: string,
  userEmail: string,
  userDisplayName: string,
  data: Partial<Omit<Space, 'id' | 'ownerId' | 'memberIds' | 'members' | 'createdAt' | 'updatedAt'>>
): Promise<string> {
  const member: SpaceMember = {
    userId,
    email: userEmail,
    displayName: userDisplayName,
    role: 'owner',
  };
  const ref = await addDoc(collection(db, 'spaces'), {
    ...data,
    ownerId: userId,
    memberIds: [userId],
    members: { [userId]: member },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSpace(spaceId: string, data: Partial<Space>): Promise<void> {
  await updateDoc(doc(db, 'spaces', spaceId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSpace(spaceId: string): Promise<void> {
  await deleteDoc(doc(db, 'spaces', spaceId));
}

export async function getSpaceContentCount(spaceId: string): Promise<{ boxes: number; products: number }> {
  const [boxSnap, productSnap] = await Promise.all([
    getDocs(query(collection(db, 'spaces'), where('parentId', '==', spaceId))),
    getDocs(query(collection(db, 'products'), where('parentIds', 'array-contains', spaceId))),
  ]);
  return { boxes: boxSnap.size, products: productSnap.size };
}

export async function getSpace(spaceId: string): Promise<Space | null> {
  const snap = await getDoc(doc(db, 'spaces', spaceId));
  if (!snap.exists()) return null;
  return toSpace(snap.id, snap.data() as FirestoreData);
}

export function subscribeToUserSpaces(
  userId: string,
  callback: (spaces: Space[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'spaces'),
    where('memberIds', 'array-contains', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const spaces = snapshot.docs.map((d) => toSpace(d.id, d.data() as FirestoreData));
    callback(spaces);
  });
}

export function subscribeToAllSpaces(
  callback: (spaces: Space[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'spaces'), (snapshot) => {
    callback(snapshot.docs.map((d) => toSpace(d.id, d.data() as FirestoreData)));
  });
}

export function subscribeToChildSpaces(
  parentId: string,
  callback: (spaces: Space[]) => void
): Unsubscribe {
  const q = query(collection(db, 'spaces'), where('parentId', '==', parentId));
  return onSnapshot(q, (snapshot) => {
    const spaces = snapshot.docs.map((d) => toSpace(d.id, d.data() as FirestoreData));
    callback(spaces.sort((a, b) => a.name.localeCompare(b.name)));
  });
}

export function subscribeToSpace(
  spaceId: string,
  callback: (space: Space | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'spaces', spaceId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(toSpace(snap.id, snap.data() as FirestoreData));
  });
}

export async function addMember(
  spaceId: string,
  targetEmail: string,
  role: UserRole
): Promise<void> {
  const q = query(collection(db, 'users'), where('email', '==', targetEmail));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Benutzer nicht gefunden. Die Person muss zuerst ein Konto erstellen.');
  const userData = snap.docs[0].data() as { uid: string; email: string; displayName: string };
  const member: SpaceMember = {
    userId: userData.uid,
    email: userData.email,
    displayName: userData.displayName,
    role,
  };
  await updateDoc(doc(db, 'spaces', spaceId), {
    [`members.${userData.uid}`]: member,
    memberIds: arrayUnion(userData.uid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeMember(spaceId: string, userId: string): Promise<void> {
  const space = await getSpace(spaceId);
  if (!space) return;
  const newMemberIds = space.memberIds.filter((id) => id !== userId);
  const newMembers = { ...space.members };
  delete newMembers[userId];
  await updateDoc(doc(db, 'spaces', spaceId), {
    memberIds: newMemberIds,
    members: newMembers,
    updatedAt: serverTimestamp(),
  });
}
