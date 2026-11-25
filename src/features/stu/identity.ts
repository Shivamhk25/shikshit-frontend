import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

/**
 * STU-01 Student identity (backend api/openapi/modules/stu-identity.yaml, `student_identity` screen). Search for a
 * student, then read one identity card. Guardian phone numbers and email addresses come back as `null` when the role
 * lacks `stu.student_contacts.view`; the card then says "Hidden", never a blank.
 */

export type IdentityStatus = 'active' | 'paused' | 'transferred' | 'alumni';

export interface IdentityMatch {
  id: string;
  registrationCode: string;
  fullName: string;
  status: IdentityStatus;
  className: string | null;
  sectionName: string | null;
  hasPhoto: boolean;
}

export interface IdentityGuardian {
  id: string;
  name: string;
  relation: string;
  isPrimary: boolean;
  isLegalCustody: boolean;
  canPickup: boolean;
  phone: string | null;
  email: string | null;
}

export interface IdCardPreview {
  instituteName: string;
  studentName: string;
  registrationCode: string;
  classSection: string | null;
  rollNumber: string | null;
  dateOfBirth: string;
  academicYear: string | null;
  validUntil: string | null;
  primaryGuardianName: string | null;
  emergencyPhone: string | null;
}

export interface IdentityCard {
  id: string;
  registrationCode: string;
  fullName: string;
  status: IdentityStatus;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  hasPhoto: boolean;
  contactsVisible: boolean;
  enrollment: { academicYear: string; className: string; sectionName: string; rollNumber: string | null } | null;
  guardians: IdentityGuardian[];
  idCard: IdCardPreview;
}

export const MIN_QUERY = 2;
export const MAX_QUERY = 100;
export const SEARCH_LIMIT = 10;
export const DEBOUNCE_MS = 300;

export const STATUS_LABELS: Record<IdentityStatus, string> = { active: 'Active', paused: 'Paused', transferred: 'Transferred', alumni: 'Alumni' };
export const GENDER_LABELS: Record<IdentityCard['gender'], string> = { male: 'Male', female: 'Female', other: 'Other' };

/** The text to search for, or null while it is too short to send (the server needs 2 to 100 characters). */
export function searchTerm(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ');
  return t.length < MIN_QUERY ? null : t.slice(0, MAX_QUERY);
}

export function searchPath(term: string, limit = SEARCH_LIMIT): string {
  return `/student-identity?${new URLSearchParams({ q: term, limit: String(limit) }).toString()}`;
}

/** "Class 5 A", or "Not enrolled this year" when the student has no class. */
export function classLabel(className: string | null | undefined, sectionName: string | null | undefined): string {
  if (!className) return 'Not enrolled this year';
  return sectionName ? `${className} ${sectionName}` : className;
}

/** A contact value for the screen. `null` is "Hidden" when the role may not see contacts, and "Not recorded" when it may. */
export function contactText(value: string | null, contactsVisible: boolean): string {
  if (value && value.trim()) return value;
  return contactsVisible ? 'Not recorded' : 'Hidden';
}

export function relationLabel(relation: string): string {
  const t = relation.replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Guardian';
}

/** The permissions a guardian holds, as short words for the card. */
export function guardianTags(g: IdentityGuardian): string[] {
  return [g.isPrimary ? 'Primary contact' : '', g.isLegalCustody ? 'Legal custody' : '', g.canPickup ? 'May collect the child' : ''].filter(Boolean);
}

export class IdentityError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function failure(res: Response): Promise<IdentityError> {
  let detail = '';
  try {
    detail = ((await res.json()) as { detail?: string }).detail ?? '';
  } catch {
    /* not JSON */
  }
  if (res.status === 403) return new IdentityError(403, 'You do not have permission to view student identity.');
  if (res.status === 404) return new IdentityError(404, 'This student was not found, or is not in your classes.');
  return new IdentityError(res.status, detail || 'Something went wrong. Please try again.');
}

export function createIdentityApi(session: Session) {
  const get = async <T>(path: string): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`);
    } catch {
      throw new IdentityError(0, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await failure(res);
    return (await res.json()) as T;
  };
  return {
    search: async (term: string) => (await get<{ items: IdentityMatch[] }>(searchPath(term))).items,
    card: (studentId: string) => get<IdentityCard>(`/student-identity/${encodeURIComponent(studentId)}`),
    /** A short-lived link to the photo, or null when there is none (or it cannot be shown). */
    photo: async (studentId: string): Promise<string | null> => {
      try {
        const res = await session.fetch(`${API_BASE}/students/${encodeURIComponent(studentId)}/photo`);
        return res.ok ? ((await res.json()) as { url: string }).url : null;
      } catch {
        return null;
      }
    },
  };
}
export type IdentityApi = ReturnType<typeof createIdentityApi>;
