import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { registry } from '../../shell/registry';
import { NAV_ICONS } from '../../shell/navIcons';
import { roomsDescriptor, type Room } from './rooms';

const row = {"id":"id-1","code":"R1","name":"Room 1","type":"classroom","capacity":30,"building":"Main","floor":null,"availableForTimetable":true,"displayOrder":1,"description":null,"status":"active"} as Room;

describe('rooms descriptor', () => {
  it('uses the aca.rooms permissions and the /rooms endpoint', () => {
    expect(roomsDescriptor.endpoint).toBe('/rooms');
    expect(Object.values(roomsDescriptor.permissions)).toEqual(['view', 'create', 'edit', 'delete'].map((a) => `aca.rooms.${a}`));
  });

  it('sends exactly the form fields, and a row round-trips through the form', () => {
    const keys = roomsDescriptor.fields.map((f) => f.key).sort();
    expect(Object.keys(roomsDescriptor.toInput(blankValues(roomsDescriptor.fields))).sort()).toEqual(keys);
    expect(Object.keys(roomsDescriptor.toForm(row)).sort()).toEqual(keys);
    expect(roomsDescriptor.toInput(roomsDescriptor.toForm(row))).toMatchObject({"name":"Room 1","code":"R1","type":"classroom"});
  });

  it('shows every column for a row and labels it for the delete question', () => {
    for (const c of roomsDescriptor.columns) expect(String(c.render ? c.render(row) : row[c.key as keyof Room] ?? '')).not.toBe('undefined');
    expect(roomsDescriptor.label(row)).toBe(row.name);
  });

  it('is registered with its permission, path and icon', () => {
    expect(registry.rooms?.permission).toBe('aca.rooms.view');
    expect(registry.rooms?.web?.path).toBe('/rooms');
    expect(NAV_ICONS.rooms).toBeDefined();
  });
});
