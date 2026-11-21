import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { registry } from '../../shell/registry';
import { addressesDescriptor, enrollmentsDescriptor, guardiansDescriptor, studentGuardiansDescriptor, studentsDescriptor } from './students';

const all = [studentsDescriptor, enrollmentsDescriptor, guardiansDescriptor, studentGuardiansDescriptor, addressesDescriptor];

describe('student descriptors', () => {
  it('every field has a starting value and every endpoint has a registry entry', () => {
    for (const d of all) {
      expect(Object.keys(blankValues(d.fields)).sort()).toEqual(d.fields.map((f) => f.key).sort());
    }
    const paths = Object.values(registry).map((r) => r.web?.path);
    for (const d of all) expect(paths).toContain(d.endpoint);
  });

  it('the phone reads students, enrollments and parents; guardians on their own and addresses stay on the web', () => {
    for (const id of ['students', 'student_enrollments', 'student_guardians']) {
      expect(registry[id]).toMatchObject({ module: 'stu', parity: 'Companion' });
      expect(registry[id].mobile?.route).toBe(registry[id].web?.path);
    }
    for (const id of ['guardians', 'student_addresses']) {
      expect(registry[id]).toMatchObject({ module: 'stu', parity: 'Web-only' });
      expect(registry[id].mobile).toBeUndefined();
    }
  });

  it('a student sends blank optional fields as null and trims the code', () => {
    const v = { ...blankValues(studentsDescriptor.fields), registrationCode: ' R-1 ', firstName: 'Asha', gender: 'female', dateOfBirth: '2015-06-01' };
    expect(studentsDescriptor.toInput(v)).toEqual({
      registrationCode: 'R-1', firstName: 'Asha', middleName: null, lastName: null, gender: 'female', dateOfBirth: '2015-06-01', admissionDate: null,
      mobile: null, parentEmail: null, studentEmail: null, apaarId: null, status: 'active', remarks: null,
    });
  });

  it('the pickers that point at students and guardians search instead of loading a list', () => {
    for (const [d, key] of [[enrollmentsDescriptor, 'studentId'], [studentGuardiansDescriptor, 'studentId'], [studentGuardiansDescriptor, 'guardianId'], [addressesDescriptor, 'studentId']] as const) {
      expect(d.fields.find((f) => f.key === key)!.remote?.search).toBe(true);
    }
    // classes, sections and years are short lists
    expect(enrollmentsDescriptor.fields.find((f) => f.key === 'classId')!.remote?.search).toBeUndefined();
  });

  it('links and addresses default to the school-friendly values', () => {
    expect(blankValues(studentGuardiansDescriptor.fields)).toMatchObject({ isPrimary: false, isLegalCustody: false, canPickup: true });
    expect(blankValues(addressesDescriptor.fields)).toMatchObject({ country: 'India' });
    expect(studentGuardiansDescriptor.toInput({ ...blankValues(studentGuardiansDescriptor.fields), studentId: 's', guardianId: 'g', relation: 'mother' })).toMatchObject({ canPickup: true, isPrimary: false });
  });
});
