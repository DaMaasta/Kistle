import { api } from '../config/api';

export const publishUnlock = () => api.post<{ ok: boolean }>('/nuki/unlock', {});
export const publishLock   = () => api.post<{ ok: boolean }>('/nuki/lock',   {});
