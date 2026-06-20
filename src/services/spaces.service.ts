import { api } from '../config/api';
import type { Space } from '../types';

// ── Cache (stale-while-revalidate, persisted to localStorage) ─────────────────
const cache = new Map<string, Space[]>();
const LS = 'kistle_sc2_';

function cacheGet(key: string): Space[] | null {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return null;
    const parsed = (JSON.parse(raw) as Space[]).map(deserializeSpace);
    cache.set(key, parsed);
    return parsed;
  } catch { return null; }
}

function cacheSet(key: string, data: Space[]): void {
  cache.set(key, data);
  try { localStorage.setItem(LS + key, JSON.stringify(data)); } catch { /* quota */ }
}

// ── Optimistic state ──────────────────────────────────────────────────────────
const pendingUpdates = new Map<string, Partial<Space>>();
const pendingCreates = new Map<string, Space>();
const pendingDeletes = new Set<string>();
const activeLoaders  = new Set<() => void>();

function triggerReload() {
  activeLoaders.forEach(load => load());
}

function applyOptimistic(spaces: Space[]): Space[] {
  const result = spaces
    .filter(s => !pendingDeletes.has(s.id))
    .map(s => {
      const upd = pendingUpdates.get(s.id);
      return upd ? { ...s, ...upd } : s;
    });
  pendingCreates.forEach(s => {
    if (!result.find(r => r.id === s.id)) result.unshift(s);
  });
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function generateAccessCode(length: number): string {
  return Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join('');
}

function deserializeSpace(s: Space): Space {
  return { ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) };
}

const now = () => new Date();

// ── Subscriptions ─────────────────────────────────────────────────────────────
export function subscribeToUserSpaces(
  _userId: string,
  callback: (spaces: Space[]) => void
): () => void {
  let active = true;
  const cacheKey = 'user';
  const cached = cacheGet(cacheKey);
  if (cached) callback(applyOptimistic(cached));
  async function load() {
    try {
      const spaces = await api.get<Space[]>('/spaces');
      const deserialized = spaces.map(deserializeSpace);
      cacheSet(cacheKey, deserialized);
      if (active) callback(applyOptimistic(deserialized));
    } catch { /* ignore */ }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

export function subscribeToSpace(
  spaceId: string,
  callback: (space: Space | null) => void
): () => void {
  let active = true;
  const cacheKey = `space:${spaceId}`;
  const cachedArr = cacheGet(cacheKey);
  if (cachedArr?.[0]) {
    const upd = pendingUpdates.get(spaceId);
    callback(upd ? { ...cachedArr[0], ...upd } : cachedArr[0]);
  }
  async function load() {
    const space = await getSpace(spaceId);
    if (active) {
      if (!space) { callback(null); return; }
      cacheSet(cacheKey, [space]);
      const upd = pendingUpdates.get(spaceId);
      callback(upd ? { ...space, ...upd } : space);
    }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

export function subscribeToChildSpaces(
  parentId: string,
  callback: (spaces: Space[]) => void
): () => void {
  let active = true;
  const cacheKey = `children:${parentId}`;
  const cached = cacheGet(cacheKey);
  if (cached) callback(applyOptimistic(cached));
  async function load() {
    try {
      const spaces = await api.get<Space[]>(`/spaces?parentId=${parentId}`);
      const deserialized = spaces.map(deserializeSpace);
      cacheSet(cacheKey, deserialized);
      if (active) callback(applyOptimistic(deserialized));
    } catch { /* ignore */ }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

export function subscribeToSpacesByParentIds(
  parentIds: string[],
  callback: (spaces: Space[]) => void
): () => void {
  let active = true;
  const cacheKey = `parents:${parentIds.sort().join(',')}`;
  const cached = cacheGet(cacheKey);
  if (cached) callback(applyOptimistic(cached));
  async function load() {
    try {
      const all = await Promise.all(parentIds.map(id => api.get<Space[]>(`/spaces?parentId=${id}`)));
      const deserialized = all.flat().map(deserializeSpace);
      cacheSet(cacheKey, deserialized);
      if (active) callback(applyOptimistic(deserialized));
    } catch { /* ignore */ }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export async function createSpace(
  _userId: string,
  _userEmail: string,
  _userDisplayName: string,
  data: Partial<Omit<Space, 'id' | 'ownerId' | 'memberIds' | 'members' | 'createdAt' | 'updatedAt'>>
): Promise<string> {
  const id = crypto.randomUUID();
  const optimistic: Space = {
    id, ownerId: '', memberIds: [], members: {},
    createdAt: now(), updatedAt: now(),
    name: '', type: 'other', description: '', icon: '📦',
    color: '#2C2926', isGroup: false, parentId: null,
    ...data,
  };
  pendingCreates.set(id, optimistic);
  triggerReload();
  try {
    await api.post('/spaces', { id, ...data });
    return id;
  } catch (err) {
    pendingCreates.delete(id);
    triggerReload();
    throw err;
  } finally {
    pendingCreates.delete(id);
  }
}

export async function updateSpace(spaceId: string, data: Partial<Space>): Promise<void> {
  const previous = pendingUpdates.get(spaceId);
  pendingUpdates.set(spaceId, { ...previous, ...data });
  triggerReload();
  try {
    await api.put(`/spaces/${spaceId}`, data);
  } catch (err) {
    pendingUpdates.delete(spaceId);
    triggerReload();
    throw err;
  } finally {
    pendingUpdates.delete(spaceId);
  }
}

export async function deleteSpace(spaceId: string): Promise<void> {
  pendingDeletes.add(spaceId);
  triggerReload();
  try {
    await api.delete(`/spaces/${spaceId}`);
  } catch (err) {
    pendingDeletes.delete(spaceId);
    triggerReload();
    throw err;
  }
}

export async function getSpace(spaceId: string): Promise<Space | null> {
  try {
    const space = await api.get<Space>(`/spaces/${spaceId}`);
    return deserializeSpace(space);
  } catch {
    return null;
  }
}

export async function getSpaceContentCount(
  spaceId: string
): Promise<{ boxes: number; products: number }> {
  return api.get(`/spaces/${spaceId}/content-count`);
}

export async function joinGroup(
  spaceId: string,
  _userId: string,
  _userEmail: string,
  _userDisplayName: string
): Promise<void> {
  await api.post(`/spaces/${spaceId}/join`, {});
}

export async function regenerateAccessCode(spaceId: string, length: number): Promise<void> {
  await api.post(`/spaces/${spaceId}/access-code`, { length });
}

export async function ensureAccessCode(spaceId: string): Promise<void> {
  const space = await getSpace(spaceId);
  if (!space?.accessCode) await api.post(`/spaces/${spaceId}/access-code`, { length: 4 });
}

export async function removeAccessCode(spaceId: string): Promise<void> {
  await api.delete(`/spaces/${spaceId}/access-code`);
}

export async function addMember(spaceId: string, userId: string, displayName: string, email: string, role: string): Promise<void> {
  await api.post(`/spaces/${spaceId}/members`, { userId, displayName, email, role });
}

export async function updateMemberRole(spaceId: string, userId: string, role: string): Promise<void> {
  await api.put(`/spaces/${spaceId}/members/${userId}`, { role });
}

export async function removeMember(spaceId: string, userId: string): Promise<void> {
  await api.delete(`/spaces/${spaceId}/members/${userId}`);
}
