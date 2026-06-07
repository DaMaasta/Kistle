import { api } from '../config/api';
import type { Product } from '../types';

// ── Cache (stale-while-revalidate, persisted to localStorage) ─────────────────
const cache = new Map<string, Product[]>();
const LS = 'kistle_pc_';

function cacheGet(key: string): Product[] | null {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return null;
    const parsed = (JSON.parse(raw) as Product[]).map(deserializeProduct);
    cache.set(key, parsed);
    return parsed;
  } catch { return null; }
}

function cacheSet(key: string, data: Product[]): void {
  cache.set(key, data);
  try { localStorage.setItem(LS + key, JSON.stringify(data)); } catch { /* quota */ }
}

// ── Optimistic state ──────────────────────────────────────────────────────────
const pendingUpdates = new Map<string, Partial<Product>>();
const pendingCreates = new Map<string, Product>();
const pendingDeletes = new Set<string>();
const activeLoaders  = new Set<() => void>();

function triggerReload() {
  activeLoaders.forEach(load => load());
}

function applyOptimistic(products: Product[]): Product[] {
  const result = products
    .filter(p => !pendingDeletes.has(p.id))
    .map(p => {
      const upd = pendingUpdates.get(p.id);
      return upd ? { ...p, ...upd } : p;
    });
  pendingCreates.forEach(p => {
    if (!result.find(r => r.id === p.id)) result.unshift(p);
  });
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deserializeProduct(p: Product): Product {
  return { ...p, lastModifiedAt: new Date(p.lastModifiedAt), createdAt: new Date(p.createdAt) };
}

function sortProducts(products: Product[]): Product[] {
  return products.sort((a, b) => {
    if ((a.quantity === 0) !== (b.quantity === 0)) return a.quantity === 0 ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

const now = () => new Date();

// ── Subscriptions ─────────────────────────────────────────────────────────────
export function subscribeToSpaceProducts(
  spaceId: string,
  callback: (products: Product[]) => void
): () => void {
  let active = true;
  const cacheKey = `space:${spaceId}`;
  const cached = cacheGet(cacheKey);
  if (cached) callback(sortProducts(applyOptimistic(cached)));
  async function load() {
    try {
      const products = await api.get<Product[]>(`/products?spaceId=${spaceId}`);
      const deserialized = products.map(deserializeProduct);
      cacheSet(cacheKey, deserialized);
      if (active) callback(sortProducts(applyOptimistic(deserialized)));
    } catch { /* ignore — optimistic state stays visible */ }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

export function subscribeToAllProducts(
  callback: (products: Product[]) => void
): () => void {
  let active = true;
  const cacheKey = 'all';
  const cached = cacheGet(cacheKey);
  if (cached) callback(sortProducts(applyOptimistic(cached)));
  async function load() {
    try {
      const products = await api.get<Product[]>('/products');
      const deserialized = products.map(deserializeProduct);
      cacheSet(cacheKey, deserialized);
      if (active) callback(sortProducts(applyOptimistic(deserialized)));
    } catch { /* ignore */ }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

export function subscribeToProductsInSpaces(
  spaceIds: string[],
  callback: (products: Product[]) => void
): () => void {
  let active = true;
  const cacheKey = `spaces:${spaceIds.sort().join(',')}`;
  const cached = cacheGet(cacheKey);
  if (cached) callback(sortProducts(applyOptimistic(cached)));
  async function load() {
    try {
      const all = await Promise.all(spaceIds.map(id => api.get<Product[]>(`/products?spaceId=${id}`)));
      const deserialized = all.flat().map(deserializeProduct);
      cacheSet(cacheKey, deserialized);
      if (active) callback(sortProducts(applyOptimistic(deserialized)));
    } catch { /* ignore */ }
  }
  activeLoaders.add(load);
  load();
  const interval = setInterval(load, 6000);
  return () => { active = false; clearInterval(interval); activeLoaders.delete(load); };
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export async function createProduct(
  spaceId: string,
  _userId: string,
  _userEmail: string,
  data: Omit<Product, 'id' | 'spaceId' | 'lastModifiedBy' | 'lastModifiedByEmail' | 'lastModifiedAt' | 'createdAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  const optimistic: Product = {
    id, spaceId, lastModifiedBy: '', lastModifiedByEmail: '',
    lastModifiedAt: now(), createdAt: now(), ...data,
  };
  pendingCreates.set(id, optimistic);
  triggerReload();
  try {
    await api.post('/products', { id, ...data, spaceId });
    return id;
  } catch (err) {
    pendingCreates.delete(id);
    triggerReload();
    throw err;
  } finally {
    pendingCreates.delete(id);
  }
}

export async function updateProduct(
  productId: string,
  _userId: string,
  _userEmail: string,
  data: Partial<Omit<Product, 'id' | 'spaceId' | 'createdAt'>>
): Promise<void> {
  const previous = pendingUpdates.get(productId);
  pendingUpdates.set(productId, { ...previous, ...data });
  triggerReload();
  try {
    await api.put(`/products/${productId}`, data);
  } catch (err) {
    pendingUpdates.delete(productId);
    triggerReload();
    throw err;
  } finally {
    pendingUpdates.delete(productId);
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  pendingDeletes.add(productId);
  triggerReload();
  try {
    await api.delete(`/products/${productId}`);
  } catch (err) {
    pendingDeletes.delete(productId);
    triggerReload();
    throw err;
  }
}

export async function updateQuantity(
  productId: string,
  userId: string,
  userEmail: string,
  quantity: number
): Promise<void> {
  await updateProduct(productId, userId, userEmail, { quantity });
}

export async function returnItems(
  userId: string,
  userEmail: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  await Promise.all(
    items.map(item => updateProduct(item.productId, userId, userEmail, { quantity: undefined }))
  );
}

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const { url } = await api.upload<{ url: string }>('/images', formData);
  return url;
}
