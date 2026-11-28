import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { registry } from '../../shell/registry';
import { NAV_ICONS } from '../../shell/navIcons';
import { attendanceStatusesDescriptor, type AttendanceStatus } from './attendanceStatuses';

const row = {"id":"id-1","code":"P","name":"Present","shortName":"P","category":"present","color":"#2E7D32","isDefault":true,"displayOrder":1,"description":null,"status":"active"} as AttendanceStatus;

describe('attendanceStatuses descriptor', () => {
  it('uses the att.attendance_statuses permissions and the /attendance-statuses endpoint', () => {
    expect(attendanceStatusesDescriptor.endpoint).toBe('/attendance-statuses');
    expect(Object.values(attendanceStatusesDescriptor.permissions)).toEqual(['view', 'create', 'edit', 'delete'].map((a) => `att.attendance_statuses.${a}`));
  });

  it('sends exactly the form fields, and a row round-trips through the form', () => {
    const keys = attendanceStatusesDescriptor.fields.map((f) => f.key).sort();
    expect(Object.keys(attendanceStatusesDescriptor.toInput(blankValues(attendanceStatusesDescriptor.fields))).sort()).toEqual(keys);
    expect(Object.keys(attendanceStatusesDescriptor.toForm(row)).sort()).toEqual(keys);
    expect(attendanceStatusesDescriptor.toInput(attendanceStatusesDescriptor.toForm(row))).toMatchObject({"code":"P","name":"Present","shortName":"P"});
  });

  it('shows every column for a row and labels it for the delete question', () => {
    for (const c of attendanceStatusesDescriptor.columns) expect(String(c.render ? c.render(row) : row[c.key as keyof AttendanceStatus] ?? '')).not.toBe('undefined');
    expect(attendanceStatusesDescriptor.label(row)).toBe(row.name);
  });

  it('is registered with its permission, path and icon', () => {
    expect(registry.attendance_statuses?.permission).toBe('att.attendance_statuses.view');
    expect(registry.attendance_statuses?.web?.path).toBe('/attendance-statuses');
    expect(NAV_ICONS.attendance_statuses).toBeDefined();
  });
});
