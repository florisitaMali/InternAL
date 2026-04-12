'use client';

import React, { Fragment } from 'react';
import { cn } from '@/src/lib/utils';
import type { AppNotification } from '@/src/types';
import { formatRelativeTime, splitNotificationMessage } from '@/src/lib/notifications/display';

function bodyWithBold(text: string, emphasisClass: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className={cn('font-bold', emphasisClass)}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type NotificationItemRowProps = {
  n: AppNotification;
  onClick?: () => void;
  /** Tighter padding for dropdown panel */
  compact?: boolean;
};

const NotificationItemRow: React.FC<NotificationItemRowProps> = ({ n, onClick, compact }) => {
  const { title, body } = splitNotificationMessage(n.message);
  const unread = !n.isRead;

  return (
    <li className="border-b border-slate-200/90 last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex text-left transition-all duration-200',
          compact ? 'min-h-0' : '',
          unread ? 'focus-visible:ring-2 focus-visible:ring-[#0d9488]/40 focus-visible:ring-inset' : ''
        )}
      >
        <div
          className={cn(
            'shrink-0 self-stretch min-h-[3rem]',
            unread ? 'w-1.5 bg-[#0d9488]' : 'w-0'
          )}
          aria-hidden
        />
        <div
          className={cn(
            'flex-1 min-w-0 transition-colors',
            compact ? 'px-3 py-3.5' : 'px-5 py-4',
            unread ? 'bg-sky-50' : 'bg-white hover:bg-slate-50'
          )}
        >
          <p
            className={cn(
              'text-sm font-bold leading-snug',
              unread ? 'text-[#002B5B]' : 'text-[#1e3a5f]'
            )}
          >
            {bodyWithBold(
              title,
              unread ? 'text-[#0f766e]' : 'text-[#002B5B]'
            )}
          </p>
          {body ? (
            <p className="text-sm text-slate-600 leading-relaxed mt-1.5 whitespace-pre-wrap">
              {bodyWithBold(
                body,
                unread ? 'text-[#0d9488]' : 'text-[#0369a1]'
              )}
            </p>
          ) : null}
          <p
            className={cn(
              'text-xs mt-2.5 font-semibold tabular-nums',
              unread ? 'text-teal-700/90' : 'text-slate-400'
            )}
          >
            {formatRelativeTime(n.createdAt)}
          </p>
        </div>
      </button>
    </li>
  );
};

export default NotificationItemRow;
