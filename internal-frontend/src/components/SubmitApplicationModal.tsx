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
  /** Extra actions in view mode (e.g. PPA approve/reject), above Close. */
  viewExtraActions?: ReactNode;
  /** Shown in the navy header row next to the close control (e.g. ⋮ menu). */
  viewHeaderActions?: ReactNode;
  /** When false, application type choice is hidden and submit uses Individual Growth. */
  canApplyForPP?: boolean;
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
  viewExtraActions,
  viewHeaderActions,
  canApplyForPP = true,
}: SubmitApplicationModalProps) {
  const isView = mode === "view";
  const showApplicationTypeChoice = isView || canApplyForPP;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedType, setSelectedType] = useState<ApplicationType>("Professional Practice");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!isView || !viewFields) return;
    setPhoneNumber(viewFields.phoneNumber?.trim() ?? "");
    setSelectedType(apiApplicationTypeToFormValue(viewFields.applicationType));
    setConfirmed(viewFields.accuracyConfirmed === true);
  }, [isView, viewFields]);

  useEffect(() => {
    if (isView || canApplyForPP) return;
    setSelectedType("Individual Growth");
  }, [isView, canApplyForPP]);

  const canSubmit = confirmed && selectedType !== null;
  const inputDisabled = isView;
  const status = viewReview?.status ?? "PENDING";
  const isIndividualGrowthOnly = !isView && !canApplyForPP;
  const isIndividualGrowthApplication = selectedType === "Individual Growth";

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

  const statusClass =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "REJECTED"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-blue-50 text-[#1B2A4A] ring-blue-200";

  const approvalClass = (approved: boolean | null, currentStatus: string | null) => {
    if (approved === true) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (approved === false) return "border-red-200 bg-red-50 text-red-700";
    if (currentStatus === "WAITING") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  const DetailField = ({
    label,
    value,
    className = "",
  }: {
    label: string;
    value: ReactNode;
    className?: string;
  }) => (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 min-h-5 truncate text-[13px] font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-slate-950/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-application-modal-title"
    >
      <div className="flex min-h-full justify-center px-3 pb-12 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-16 sm:pt-8">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-white/10 sm:my-4">
          <div className="bg-[#1B2A4A] px-5 py-4 text-white sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100">
                  {isView ? "Application review" : "Application form"}
                </p>
                <h2 id="submit-application-modal-title" className="mt-1 truncate text-xl font-bold leading-snug sm:text-[1.35rem]">
                  {opportunity.title}
                </h2>
                <p className="mt-1 text-xs text-blue-100/95 sm:text-sm">{opportunity.company}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isView && viewHeaderActions ? viewHeaderActions : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X size={22} strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            </div>

            {isView && viewReview ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">Application ID</div>
                  <div className="mt-1 text-[13px] font-bold">{formatAppId(viewReview.applicationId)}</div>
                </div>
                <div className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">Submitted</div>
                  <div className="mt-1 text-[13px] font-bold">{formatSubmittedDate(viewReview.createdAt)}</div>
                </div>
                <div className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">Current Status</div>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${statusClass}`}>
                    {status}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 sm:text-[0.95rem]">Application information</h3>
                  <p className="text-xs text-slate-500 sm:text-[13px]">
                    Profile, academic standing, CV, and consent are grouped here for review.
                  </p>
                </div>
                {isView ? (
                  <span className="mt-2 inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:mt-0">
                    Read-only review
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                <div>
                  <h4 className="text-[13px] font-bold text-slate-800">Student profile</h4>
                  <div className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Full name" value={student.fullName} />
                    <DetailField label="Email" value={student.email} />
                    <DetailField label="University" value={student.university} />
                    <div className="min-w-0">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Phone number
                      </label>
                      {isView ? (
                        <div className="mt-1 min-h-5 text-[13px] font-semibold text-slate-900">
                          {phoneNumber.trim() ? phoneNumber : "-"}
                        </div>
                      ) : (
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="Enter phone number"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1B2A4A] focus:bg-white focus:ring-2 focus:ring-[#1B2A4A]/15"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <h4 className="text-[13px] font-bold text-slate-800">Academic and documents</h4>
                  <div className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-1">
                  <DetailField label="Study field" value={student.studyField} />
                  <DetailField label="Study year" value={ordinalYear(student.studyYear)} />
                  <DetailField label="CGPA" value={`${student.cgpa} / 4`} />
                    <DetailField label="Current CV" value={<span className="text-[#1B2A4A]">{student.cvFileName}</span>} />
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <label
                  className={`flex gap-3 rounded-xl px-3 py-3 ${
                    inputDisabled
                      ? "cursor-default bg-slate-50"
                      : "cursor-pointer bg-blue-50/40 transition hover:bg-blue-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={inputDisabled}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#1B2A4A] disabled:opacity-100"
                  />
                  <span className="text-[13px] text-slate-700">
                    I have reviewed the pre-filled information and confirm it is accurate.
                    {isView ? (
                      <span className="mt-1 block text-xs font-medium text-slate-500">
                        Confirmation recorded: {confirmed ? "Yes" : "No"}
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 sm:text-[0.95rem]">Application type</h3>
                  <p className="text-xs text-slate-500 sm:text-[13px]">
                    {isView
                      ? "This is the type saved for your submitted application."
                      : canApplyForPP
                        ? "Choose where this application should be routed."
                        : "This application will be submitted as Individual Growth."}
                  </p>
                </div>
                {isIndividualGrowthOnly ? (
                  <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    Individual Growth only
                  </span>
                ) : null}
              </div>

              {isView ? (
                <div className={`mt-4 grid gap-4 border-t border-slate-100 pt-4 ${isIndividualGrowthApplication ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                  <DetailField label="Submitted type" value={selectedType} />
                  {viewReview ? (
                    <>
                      {!isIndividualGrowthApplication ? (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PPA review</div>
                          <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${approvalClass(viewReview.isApprovedByPPA ?? null, viewReview.status)}`}>
                            {approvalLabel(viewReview.isApprovedByPPA ?? null, viewReview.status)}
                          </span>
                        </div>
                      ) : null}
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Company review</div>
                        <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${approvalClass(viewReview.isApprovedByCompany ?? null, viewReview.status)}`}>
                          {approvalLabel(viewReview.isApprovedByCompany ?? null, viewReview.status)}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : showApplicationTypeChoice ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {APPLICATION_TYPES.map((type) => {
                    const checked = selectedType === type;
                    return (
                      <label
                        key={type}
                        className={`rounded-xl border px-4 py-3 transition ${
                          checked
                            ? "border-[#1B2A4A] bg-blue-50 ring-2 ring-[#1B2A4A]/15"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        } ${inputDisabled ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="applicationType"
                            value={type}
                            checked={checked}
                            disabled={inputDisabled}
                            onChange={() => setSelectedType(type)}
                            className="mt-1 accent-[#1B2A4A] disabled:opacity-100"
                          />
                          <span>
                            <span className="block text-[13px] font-bold text-slate-950">{type}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              {type === "Professional Practice"
                                ? "Send to PPA for professional practice review."
                                : "Send directly as an individual growth application."}
                            </span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                  Your profile is not eligible for Professional Practice selection, so this application will be saved as
                  Individual Growth automatically.
                </div>
              )}
            </section>

            {isView && listingDetails ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{listingDetails}</section>
            ) : null}

            {isView && viewExtraActions ? (
              <div className="flex flex-wrap gap-2">{viewExtraActions}</div>
            ) : null}

            {!isView ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full rounded-xl bg-[#1B2A4A] py-3 text-[13px] font-bold text-white shadow-lg shadow-[#1B2A4A]/20 transition hover:bg-[#162240] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
              >
                Submit Application
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-[#1B2A4A] py-3 text-[13px] font-bold text-white shadow-lg shadow-[#1B2A4A]/20 transition hover:bg-[#162240]"
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
