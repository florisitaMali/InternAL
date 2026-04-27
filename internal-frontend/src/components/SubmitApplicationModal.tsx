"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ApplicationFormData {
  phoneNumber: string;
  applicationType: string;
  confirmed: boolean;
}

interface Opportunity {
  title: string;
  company: string;
}

interface Student {
  fullName: string;
  email: string;
  university: string;
  department: string;
  studyField: string;
  studyYear: number;
  cgpa: number;
  cvFileName: string;
}

export type SubmitApplicationModalMode = "submit" | "view";

export interface ApplicationViewReview {
  applicationId: number | null;
  status: string | null;
  createdAt: string | null;
  isApprovedByPPA: boolean | null;
  isApprovedByCompany: boolean | null;
}

export interface ApplicationViewFields {
  phoneNumber?: string | null;
  applicationType: string | null;
  accuracyConfirmed: boolean | null;
}

interface SubmitApplicationModalProps {
  opportunity: Opportunity;
  student: Student;
  onClose: () => void;
  onSubmit?: (data: ApplicationFormData) => void;
  mode?: SubmitApplicationModalMode;
  viewReview?: ApplicationViewReview;
  viewFields?: ApplicationViewFields;
  /** Shown below the form in view mode (e.g. listing details). */
  listingDetails?: ReactNode;
}

const APPLICATION_TYPES = ["Professional Practice", "Individual Growth"] as const;
type ApplicationType = (typeof APPLICATION_TYPES)[number];

function apiApplicationTypeToFormValue(api: string | null | undefined): ApplicationType {
  if (!api) return "Professional Practice";
  const n = api.toUpperCase().replace(/\s+/g, "_");
  if (n.includes("INDIVIDUAL")) return "Individual Growth";
  return "Professional Practice";
}

function formatSubmittedDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatAppId(id: number | null): string {
  return id != null ? `APP${String(id).padStart(3, "0")}` : "—";
}

function approvalLabel(approved: boolean | null, status: string | null): string {
  if (approved === true) return "Approved";
  if (approved === false) return "Rejected";
  if (status === "WAITING") return "Waiting";
  return "Pending";
}

export default function SubmitApplicationModal({
  opportunity,
  student,
  onClose,
  onSubmit,
  mode = "submit",
  viewReview,
  viewFields,
  listingDetails,
}: SubmitApplicationModalProps) {
  const isView = mode === "view";

  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedType, setSelectedType] = useState<ApplicationType>("Professional Practice");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!isView || !viewFields) return;
    setPhoneNumber(viewFields.phoneNumber?.trim() ?? "");
    setSelectedType(apiApplicationTypeToFormValue(viewFields.applicationType));
    setConfirmed(viewFields.accuracyConfirmed === true);
  }, [isView, viewFields]);

  const canSubmit = confirmed && selectedType !== null;

  const handleSubmit = () => {
    if (!canSubmit || !onSubmit) return;
    onSubmit({ phoneNumber, applicationType: selectedType, confirmed });
  };

  const ordinalYear = (n: number) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };

  const fieldReadOnly = isView ? "bg-gray-100 text-gray-800 cursor-default" : "bg-gray-50";
  const inputDisabled = isView;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-application-modal-title"
    >
      {/* Top-aligned + scroll: avoids clipping header/X when modal is taller than the viewport (centered flex pushes top above fold). */}
      <div className="flex min-h-full justify-center px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-20 sm:pt-8">
        <div className="relative w-full max-w-5xl rounded-lg bg-white shadow-xl sm:my-4">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id="submit-application-modal-title" className="text-2xl font-bold text-gray-900 pr-2 min-w-0">
            {isView ? "Your application" : "Submit Application"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 active:bg-gray-200"
          >
            <X size={22} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {isView && viewReview ? (
            <div className="rounded-md border border-gray-200 bg-slate-50 px-4 py-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-gray-700">
                  <span className="font-semibold text-gray-900">ID:</span> {formatAppId(viewReview.applicationId)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
                    viewReview.status === "APPROVED"
                      ? "bg-emerald-600 text-white"
                      : viewReview.status === "REJECTED"
                        ? "bg-red-600 text-white"
                        : "bg-[#1B2A4A] text-white"
                  }`}
                >
                  {viewReview.status ?? "PENDING"}
                </span>
              </div>
              <div className="text-gray-600">
                <span className="font-medium text-gray-800">Submitted:</span>{" "}
                {formatSubmittedDate(viewReview.createdAt)}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-700">
                <span>
                  <span className="font-medium text-gray-800">PPA:</span>{" "}
                  {approvalLabel(viewReview.isApprovedByPPA ?? null, viewReview.status)}
                </span>
                <span>
                  <span className="font-medium text-gray-800">Company:</span>{" "}
                  {approvalLabel(viewReview.isApprovedByCompany ?? null, viewReview.status)}
                </span>
              </div>
            </div>
          ) : null}

          {/* ── Section 1 — Application Details ── */}
          <div className="rounded-md border border-[#1B2A4A] overflow-hidden">
            <div className="bg-[#1B2A4A] px-4 py-1.5">
              <span className="text-white text-xs font-semibold tracking-widest uppercase">
                Application Details
              </span>
            </div>

            <div className="bg-white px-4 py-3 space-y-3">
              <div className="flex justify-between text-sm font-medium text-gray-900 gap-4 flex-wrap">
                <span>Role: {opportunity.title}</span>
                <span>Company: {opportunity.company}</span>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Full Name:</span>
                  <div className={`border border-gray-300 rounded px-2 py-1 text-sm ${fieldReadOnly}`}>
                    {student.fullName}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Email:</span>
                  <div
                    className={`border border-gray-300 rounded px-2 py-1 text-sm truncate ${fieldReadOnly}`}
                  >
                    {student.email}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">University:</span>
                  <div
                    className={`border border-gray-300 rounded px-2 py-1 text-sm truncate ${fieldReadOnly}`}
                  >
                    {student.university}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Phone Number:</span>
                  {isView ? (
                    <div className={`border border-gray-300 rounded px-2 py-1 text-sm ${fieldReadOnly}`}>
                      {phoneNumber.trim() ? phoneNumber : "—"}
                    </div>
                  ) : (
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="number"
                      className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1B2A4A]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Sections 2 & 3 — side by side ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-gray-300 overflow-hidden">
              <div className="px-4 py-1.5 border-b border-gray-300">
                <span className="text-sm font-semibold text-gray-900">Academic Standing</span>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">Study Field:</span>
                  <span className="text-gray-700">{student.studyField}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">Current Study Year:</span>
                  <span className="bg-gray-200 text-gray-700 rounded-full px-3 py-0.5 text-xs font-medium">
                    {ordinalYear(student.studyYear)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">CGPA:</span>
                  <span className="bg-gray-200 text-gray-700 rounded-full px-3 py-0.5 text-xs font-medium">
                    {student.cgpa} / 4
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-300 overflow-hidden">
                <div className="px-4 py-1.5 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-900">CV Management</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Current CV: </span>
                    {isView ? (
                      <span className="text-[#1B2A4A]">{student.cvFileName}</span>
                    ) : (
                      <button type="button" className="text-[#1B2A4A] underline hover:opacity-75 text-sm">
                        {student.cvFileName}
                      </button>
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-gray-300 overflow-hidden">
                <div className="px-4 py-1.5 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-900">Review and Consent</span>
                </div>
                <div className="px-4 py-3">
                  <label
                    className={`flex items-start gap-2 ${inputDisabled ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={inputDisabled}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 accent-[#1B2A4A] disabled:opacity-100"
                    />
                    <span className="text-xs text-gray-700">
                      I have read all pre-filled information and confirm it as accurate.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 4 — Application Type ── */}
          <div className="flex items-center gap-8 px-1 flex-wrap">
            {APPLICATION_TYPES.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 ${inputDisabled ? "cursor-default" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name="applicationType"
                  value={type}
                  checked={selectedType === type}
                  disabled={inputDisabled}
                  onChange={() => setSelectedType(type)}
                  className="accent-[#1B2A4A] disabled:opacity-100"
                />
                <span className="text-sm text-gray-800">{type}</span>
              </label>
            ))}
          </div>

          {isView && listingDetails ? (
            <div className="pt-2 border-t border-gray-200">{listingDetails}</div>
          ) : null}

          {!isView ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-[#1B2A4A] text-white font-semibold py-3 rounded-md hover:bg-[#162240] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Application
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-[#1B2A4A] text-white font-semibold py-3 rounded-md hover:bg-[#162240] transition-colors"
            >
              Close
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
