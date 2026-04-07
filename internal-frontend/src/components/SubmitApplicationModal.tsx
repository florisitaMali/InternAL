"use client";

import { useState } from "react";

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

interface SubmitApplicationModalProps {
  opportunity: Opportunity;
  student: Student;
  onClose: () => void;
  onSubmit: (data: ApplicationFormData) => void;
}

const APPLICATION_TYPES = ["Professional Practice", "Individual Growth"] as const;
type ApplicationType = (typeof APPLICATION_TYPES)[number];

export default function SubmitApplicationModal({
  opportunity,
  student,
  onClose,
  onSubmit,
}: SubmitApplicationModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedType, setSelectedType] = useState<ApplicationType>("Professional Practice");
  const [confirmed, setConfirmed] = useState(false);

  const canSubmit = confirmed && selectedType !== null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ phoneNumber, applicationType: selectedType, confirmed });
  };

  const ordinalYear = (n: number) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-2xl font-bold text-gray-900">Submit Application</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">

          {/* ── Section 1 — Application Details ── */}
          <div className="rounded-md border border-[#1B2A4A] overflow-hidden">
            <div className="bg-[#1B2A4A] px-4 py-1.5">
              <span className="text-white text-xs font-semibold tracking-widest uppercase">
                Application Details
              </span>
            </div>

            <div className="bg-white px-4 py-3 space-y-3">
              {/* Role / Company */}
              <div className="flex justify-between text-sm font-medium text-gray-900">
                <span>Role: {opportunity.title}</span>
                <span>Company: {opportunity.company}</span>
              </div>

              {/* 4-column info grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Full Name:</span>
                  <div className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 bg-gray-50">
                    {student.fullName}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Email:</span>
                  <div className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 bg-gray-50 truncate">
                    {student.email}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">University:</span>
                  <div className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 bg-gray-50 truncate">
                    {student.university}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">Phone Number:</span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="number"
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1B2A4A]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Sections 2 & 3 — side by side ── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Section 2 — Academic Standing */}
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

            {/* Section 3 + Section 5 stacked on the right */}
            <div className="flex flex-col gap-4">

              {/* Section 3 — CV Management */}
              <div className="rounded-md border border-gray-300 overflow-hidden">
                <div className="px-4 py-1.5 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-900">CV Management</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Current CV: </span>
                    <button className="text-[#1B2A4A] underline hover:opacity-75 text-sm">
                      {student.cvFileName}
                    </button>
                  </p>
                </div>
              </div>

              {/* Section 5 — Review and Consent */}
              <div className="rounded-md border border-gray-300 overflow-hidden">
                <div className="px-4 py-1.5 border-b border-gray-300">
                  <span className="text-sm font-semibold text-gray-900">Review and Consent</span>
                </div>
                <div className="px-4 py-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 accent-[#1B2A4A]"
                    />
                    <span className="text-xs text-gray-700">
                      I have read all pre-filled information and confirm it as accurate.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 4 — Application Type Checkboxes ── */}
          <div className="flex items-center gap-8 px-1">
            {APPLICATION_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applicationType"
                  value={type}
                  checked={selectedType === type}
                  onChange={() => setSelectedType(type)}
                  className="accent-[#1B2A4A]"
                />
                <span className="text-sm text-gray-800">{type}</span>
              </label>
            ))}
          </div>

          {/* ── Submit Button ── */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-[#1B2A4A] text-white font-semibold py-3 rounded-md hover:bg-[#162240] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Application
          </button>

        </div>
      </div>
    </div>
  );
}