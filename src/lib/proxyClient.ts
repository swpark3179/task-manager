import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types';

// =============================================
// Proxy Client - Routes Supabase requests through
// Tauri Rust backend when proxy mode is enabled
// =============================================

type ProxyRequestParams = Record<string, unknown>;

export async function proxyRequest(
  url: string,
  method: string,
  body: string | null,
  headers: Record<string, string>,
  settings: AppSettings
): Promise<string> {
  if (!settings.proxy.enabled) {
    throw new Error('Proxy is not enabled');
  }

  const params: ProxyRequestParams = {
    url,
    method,
    headers,
    proxy_host: settings.proxy.host,
    proxy_port: settings.proxy.port,
    ...(body ? { body } : {}),
  };

  return await invoke<string>('proxy_request', params);
}

// Build Supabase REST API URL
export function buildSupabaseRestUrl(
  table: string,
  query?: string
): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  let url = `${baseUrl}/rest/v1/${table}`;
  if (query) {
    url += `?${query}`;
  }
  return url;
}

// Build headers for Supabase REST API
export function buildSupabaseHeaders(accessToken?: string): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const headers: Record<string, string> = {
    'apikey': anonKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    headers['Authorization'] = `Bearer ${anonKey}`;
  }

  return headers;
}
