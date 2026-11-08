import { request } from '../../../shared/api/httpClient';

export interface Profile {
  name: string;
  email: string;
}

export interface Session extends Profile {
  token: string;
}

export function signIn(email: string, password: string) {
  return request<Session>('/sessions', 'POST', { email, password });
}

export function register(name: string, email: string, password: string) {
  return request<Session>('/accounts', 'POST', { name, email, password });
}

export function getProfile(token: string) {
  return request<Profile>('/sessions/current', 'GET', undefined, token);
}

export function signOut(token: string) {
  return request<void>('/sessions/current', 'DELETE', undefined, token);
}
