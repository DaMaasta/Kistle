import { api } from '../config/api';

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: Date;
}

export interface DocFile {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface FolderContents {
  folders: DocFolder[];
  files: DocFile[];
}

// ── Cache (stale-while-revalidate, persisted to localStorage) ─────────────────
const cache = new Map<string, FolderContents>();
const LS = 'kistle_doc2_';

type RawFolder = Record<string, unknown>;
type RawFile = Record<string, unknown>;

function deserializeFolder(f: RawFolder): DocFolder {
  return {
    id: f.id as string,
    name: f.name as string,
    parentId: (f.parentId ?? f.parent_id ?? null) as string | null,
    ownerId: (f.ownerId ?? f.owner_id ?? '') as string,
    createdAt: new Date((f.createdAt ?? f.created_at) as string),
  };
}

function deserializeFile(f: RawFile): DocFile {
  const filePath = (f.filePath ?? f.file_path ?? '') as string;
  return {
    id: f.id as string,
    name: f.name as string,
    parentId: (f.parentId ?? f.folder_id ?? null) as string | null,
    ownerId: (f.ownerId ?? f.owner_id ?? '') as string,
    url: ((f.url as string) || null) ?? (filePath ? `https://kistle.uk/api/documents/serve/${filePath.split('/').pop()}` : ''),
    mimeType: (f.mimeType ?? f.mime_type ?? '') as string,
    size: (f.size ?? 0) as number,
    createdAt: new Date((f.createdAt ?? f.created_at) as string),
  };
}

function deserializeContents(raw: FolderContents): FolderContents {
  return {
    folders: (raw.folders as unknown as RawFolder[]).map(deserializeFolder),
    files: (raw.files as unknown as RawFile[]).map(deserializeFile),
  };
}

function cacheKey(parentId: string | null): string {
  return `folder:${parentId ?? 'root'}`;
}

function cacheGet(key: string): FolderContents | null {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return null;
    const parsed = deserializeContents(JSON.parse(raw) as FolderContents);
    cache.set(key, parsed);
    return parsed;
  } catch { return null; }
}

function cacheSet(key: string, data: FolderContents): void {
  cache.set(key, data);
  try { localStorage.setItem(LS + key, JSON.stringify(data)); } catch { /* quota */ }
}

export function subscribeToFolderContents(
  _userId: string,
  parentId: string | null,
  callback: (contents: FolderContents) => void
): () => void {
  let active = true;
  const key = cacheKey(parentId);
  const cached = cacheGet(key);
  if (cached) callback(cached);

  async function load() {
    try {
      const [folders, files] = await Promise.all([
        api.get<RawFolder[]>(`/documents/folders?parentId=${parentId ?? ''}`),
        api.get<RawFile[]>(`/documents?folderId=${parentId ?? ''}`),
      ]);
      const contents: FolderContents = {
        folders: folders.map(deserializeFolder).sort((a, b) => a.name.localeCompare(b.name, 'de')),
        files: files.map(deserializeFile).sort((a, b) => a.name.localeCompare(b.name, 'de')),
      };
      cacheSet(key, contents);
      if (active) callback(contents);
    } catch { /* ignore */ }
  }
  load();
  const interval = setInterval(load, 8000);
  return () => { active = false; clearInterval(interval); };
}

export async function createFolder(
  _userId: string,
  name: string,
  parentId: string | null
): Promise<void> {
  const id = crypto.randomUUID();
  await api.post('/documents/folders', { id, name, parentId });
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  await api.put(`/documents/folders/${folderId}`, { name: newName });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await api.delete(`/documents/folders/${folderId}`);
}

export async function uploadFile(
  _userId: string,
  file: File,
  parentId: string | null,
  onProgress?: (pct: number) => void
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', file.name);
  formData.append('folderId', parentId ?? '');
  formData.append('id', crypto.randomUUID());
  onProgress?.(0);
  await api.upload('/documents/upload', formData);
  onProgress?.(100);
}

export async function deleteFile(fileId: string, _storageRefPath?: string): Promise<void> {
  await api.delete(`/documents/${fileId}`);
}
