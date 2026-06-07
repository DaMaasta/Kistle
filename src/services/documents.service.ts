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

function deserializeFolder(f: DocFolder): DocFolder {
  return { ...f, createdAt: new Date(f.createdAt) };
}

function deserializeFile(f: DocFile): DocFile {
  return { ...f, createdAt: new Date(f.createdAt) };
}

export function subscribeToFolderContents(
  _userId: string,
  parentId: string | null,
  callback: (contents: FolderContents) => void
): () => void {
  let active = true;
  async function load() {
    const [folders, files] = await Promise.all([
      api.get<DocFolder[]>(`/documents/folders?parentId=${parentId ?? ''}`),
      api.get<DocFile[]>(`/documents?folderId=${parentId ?? ''}`),
    ]);
    if (active) callback({
      folders: folders.map(deserializeFolder).sort((a, b) => a.name.localeCompare(b.name, 'de')),
      files: files.map(deserializeFile).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    });
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
