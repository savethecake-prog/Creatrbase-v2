import { api } from './api';

export async function getMe() {
  try {
    return await api.get('/auth/me');
  } catch {
    return null;
  }
}

export async function logout() {
  await api.post('/auth/logout', {});
}
