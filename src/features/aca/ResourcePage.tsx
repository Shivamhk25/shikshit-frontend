import { useCallback, useMemo } from 'react';
import { CrudPage } from '../../crud/CrudPage';
import { createCrudClient } from '../../crud/client';
import type { CrudDescriptor } from '../../crud/descriptor';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';

/** One page for any descriptor-driven resource: builds its API client and renders the CRUD page. */
export function ResourcePage<T extends { id: string }>({ descriptor }: { descriptor: CrudDescriptor<T> }) {
  const { session } = useAuth();
  const client = useMemo(() => createCrudClient<T, Record<string, unknown>>(session, API_BASE, descriptor.endpoint), [session, descriptor.endpoint]);
  const optionsClient = useCallback((endpoint: string) => createCrudClient<Record<string, unknown> & { id: string }, never>(session, API_BASE, endpoint), [session]);
  return <CrudPage descriptor={descriptor} client={client} optionsClient={optionsClient} />;
}
