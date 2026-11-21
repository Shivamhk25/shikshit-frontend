import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { registry } from '../../shell/registry';
import { chaptersDescriptor, classSectionsDescriptor, subjectClassesDescriptor, textbooksDescriptor } from './mappings';

const all = [classSectionsDescriptor, subjectClassesDescriptor, textbooksDescriptor, chaptersDescriptor];

describe('mapping and textbook descriptors', () => {
  it('every field has a starting value, and each permission is in the registry', () => {
    for (const d of all) {
      expect(Object.keys(blankValues(d.fields)).sort()).toEqual(d.fields.map((f) => f.key).sort());
    }
    const perms = Object.values(registry).map((r) => r.permission);
    for (const d of all) expect(perms).toContain(d.permissions.view);
  });

  it('a class section sends an empty capacity, room and remarks as null', () => {
    const v = { ...blankValues(classSectionsDescriptor.fields), yearId: 'y', classId: 'c', sectionId: 's' };
    expect(classSectionsDescriptor.toInput(v)).toEqual({ yearId: 'y', classId: 'c', sectionId: 's', capacity: null, roomId: null, remarks: null });
    expect(classSectionsDescriptor.toInput({ ...v, capacity: '40' })).toMatchObject({ capacity: 40 });
  });

  it('a class subject with no section means the whole class, and its flags start as the server defaults', () => {
    const blank = blankValues(subjectClassesDescriptor.fields);
    expect(blank).toMatchObject({ isElective: false, isExamined: true, isAssessed: true, isGradeOnly: false, hasPractical: false, onReportCard: true, sectionId: '' });
    expect(subjectClassesDescriptor.toInput({ ...blank, yearId: 'y', classId: 'c', subjectId: 's' })).toMatchObject({ sectionId: null, periodsPerWeek: null });
    const row = { id: '1', yearId: 'y', yearName: 'Y', classId: 'c', className: 'V', subjectId: 's', subjectName: 'Maths', sectionId: 'a', sectionName: 'A', periodsPerWeek: 0, isElective: true, isExamined: false, isAssessed: true, isGradeOnly: false, hasPractical: true, onReportCard: false };
    expect(subjectClassesDescriptor.toInput(subjectClassesDescriptor.toForm(row))).toMatchObject({ sectionId: 'a', periodsPerWeek: 0, isElective: true, isExamined: false, onReportCard: false });
  });

  it('a textbook keeps its optional links and codes null when blank', () => {
    const v = { ...blankValues(textbooksDescriptor.fields), code: 'T1', title: 'Maths', classId: 'c', subjectId: 's', bookUrl: ' https://example.org/b ' };
    expect(textbooksDescriptor.toInput(v)).toMatchObject({ code: 'T1', isbn: null, publisher: null, bookUrl: 'https://example.org/b', status: 'active' });
  });

  it('a chapter keeps page 0-free numbers as integers and an unset period as null', () => {
    const v = { ...blankValues(chaptersDescriptor.fields), textbookId: 'b', title: 'Numbers', fromPage: '1', toPage: '20' };
    expect(chaptersDescriptor.toInput(v)).toMatchObject({ sortOrder: 0, chapterNo: null, periods: null, fromPage: 1, toPage: 20, isOptional: false });
    expect(chaptersDescriptor.label({ ...({} as never), chapterNo: '2', title: 'Fractions' })).toBe('2. Fractions');
  });
});
