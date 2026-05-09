'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import StudentProfileView from '@/src/components/StudentProfileView';
import type { Student } from '@/src/types';
import {
  mapStudentProfileToStudent,
  fetchStudentProfileBlob,
  downloadStudentProfileFile,
} from '@/src/lib/auth/userAccount';
import { fetchViewerStudentProfile, type ViewerApiSegment } from '@/src/lib/auth/studentViewer';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import Logo from '@/src/components/Logo';

type Props = {
  studentId: number | null;
  onClose: () => void;
  apiSegment: ViewerApiSegment;
  /** Prefer shell token (e.g. company dashboard ref) when provided. */
  resolveAccessToken?: () => Promise<string | null>;
  /** Matches app shell sidebar width so fixed overlay does not cover nav (md+). */
  sidebarExpanded?: boolean;
};

export default function ViewerStudentProfileOverlay({
  studentId,
  onClose,
  apiSegment,
  resolveAccessToken,
  sidebarExpanded = true,
}: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);

  const getToken = useCallback(async () => {
    if (resolveAccessToken) {
      const t = await resolveAccessToken();
      if (t?.trim()) return t.trim();
    }
    return getSessionAccessToken();
  }, [resolveAccessToken]);

  useEffect(() => {
    if (studentId == null) {
      setStudent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      let token: string | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        token = await getToken();
        if (token) break;
        await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
      }
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          toast.error('Not signed in.');
        }
        return;
      }
      let { data, errorMessage } = await fetchViewerStudentProfile(token, apiSegment, studentId);
      if (
        errorMessage &&
        (errorMessage.includes('Authentication required') || errorMessage.includes('Bearer'))
      ) {
        const retryToken = await getSessionAccessToken();
        if (retryToken?.trim() && retryToken !== token) {
          ({ data, errorMessage } = await fetchViewerStudentProfile(retryToken.trim(), apiSegment, studentId));
        }
      }
      if (cancelled) return;
      setLoading(false);
      if (!data || errorMessage) {
        toast.error(errorMessage || 'Could not load profile.');
        setStudent(null);
        return;
      }
      setStudent(mapStudentProfileToStudent(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, apiSegment, getToken]);

  if (studentId == null) return null;

  const fallbackCvPath = `/api/${apiSegment}/students/${studentId}/profile/cv`;

  return (
    <div
      className={cn(
        'fixed top-0 right-0 bottom-0 z-[120] flex flex-col bg-[#F9FAFB]',
        'max-md:left-0',
        sidebarExpanded ? 'md:left-72' : 'md:left-16'
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Logo size="md" showText={false} className="shrink-0 md:hidden" />
          <div className="hidden md:flex items-center scale-75 origin-left">
            <Logo />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#002B5B]/30 border-t-[#002B5B]" />
          </div>
        ) : student ? (
          <StudentProfileView
            readOnly
            student={student}
            projects={student.projects ?? []}
            onEdit={() => {}}
            onDownloadCv={() => {
              void (async () => {
                const token = await getToken();
                if (!token) return;
                const path = student.extendedProfile?.cvFile?.downloadUrl || fallbackCvPath;
                const name =
                  student.extendedProfile?.cvFile?.originalFilename ||
                  student.extendedProfile?.cvFilename ||
                  'cv.pdf';
                const { errorMessage } = await downloadStudentProfileFile(token, path, name);
                if (errorMessage) toast.error(errorMessage);
              })();
            }}
            onPreviewCv={() => {
              void (async () => {
                const token = await getToken();
                if (!token) return;
                const path = student.extendedProfile?.cvFile?.downloadUrl || fallbackCvPath;
                const { blob, errorMessage } = await fetchStudentProfileBlob(token, path);
                if (!blob || errorMessage) {
                  toast.error(errorMessage || 'Could not open file.');
                  return;
                }
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank', 'noopener,noreferrer');
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
              })();
            }}
            onDownloadCertification={(file) => {
              void (async () => {
                const token = await getToken();
                if (!token) return;
                const path =
                  file.downloadUrl ||
                  (file.certificationId != null
                    ? `/api/${apiSegment}/students/${studentId}/profile/certifications/${file.certificationId}`
                    : '');
                if (!path) {
                  toast.error('Missing certification link.');
                  return;
                }
                const name = file.displayName || file.originalFilename;
                const { errorMessage } = await downloadStudentProfileFile(token, path, name);
                if (errorMessage) toast.error(errorMessage);
              })();
            }}
            onPreviewCertification={(file) => {
              void (async () => {
                const token = await getToken();
                if (!token) return;
                const path =
                  file.downloadUrl ||
                  (file.certificationId != null
                    ? `/api/${apiSegment}/students/${studentId}/profile/certifications/${file.certificationId}`
                    : '');
                if (!path) {
                  toast.error('Missing certification link.');
                  return;
                }
                const { blob, errorMessage } = await fetchStudentProfileBlob(token, path);
                if (!blob || errorMessage) {
                  toast.error(errorMessage || 'Could not open file.');
                  return;
                }
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank', 'noopener,noreferrer');
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
              })();
            }}
          />
        ) : (
          <p className="text-center text-sm text-slate-500">Could not load profile.</p>
        )}
      </div>
    </div>
  );
}
