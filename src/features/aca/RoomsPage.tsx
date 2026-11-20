import { useMemo } from 'react';
import { CrudPage } from '../../crud/CrudPage';
import { createCrudClient } from '../../crud/client';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { roomsDescriptor, type Room } from './rooms';

export function RoomsPage() {
  const { session } = useAuth();
  const client = useMemo(() => createCrudClient<Room, Record<string, unknown>>(session, API_BASE, roomsDescriptor.endpoint), [session]);
  return <CrudPage descriptor={roomsDescriptor} client={client} />;
}
