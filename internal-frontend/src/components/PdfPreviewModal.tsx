'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

function isPdfMime(mimeType: string | undefined, filename?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('pdf')) return true;
  if (filename && filename.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

interface PdfPreviewModalProps {
  open: boolean;
  title: string;
  blobUrl: string | null;
  mimeType?: string;
  filenameHint?: string;
  onClose: () => void;
  onDownload: () => void;
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  open,
  title,
  blobUrl,
  mimeType,
  filenameHint,
  onClose,
  onDownload,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const showPdf = Boolean(blobUrl) && isPdfMime(mimeType, filenameHint);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-[80vw] h-[80vh] max-w-none max-h-none flex flex-col overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 id="pdf-preview-title" className="text-sm font-bold text-slate-900 truncate pr-4">
            {title}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDownload}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-100">
          {showPdf ? (
            <iframe title={title} src={blobUrl!} className="w-full h-full border-0" />
          ) : blobUrl ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] px-6 text-center">
              <p className="text-sm text-slate-600 mb-4">
                Preview is only available for PDF files. Download the file to open it.
              </p>
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#0f2744] text-white hover:opacity-95"
              >
                Download
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[50vh] text-sm text-slate-500">
              Nothing to display.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfPreviewModal;
