'use client';

import Image from 'next/image';

export default function OpportunityCard({
  title,
  subtitle,
  imageUrl,
  footer,
  action,
  onClick,
  compact,
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
  /** List-style row: no hero image block (avoids large placeholders when images are omitted). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <article
        className={`rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm ${
          onClick ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''
        }`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{title}</h3>
        {subtitle ? <p className="text-[11px] text-travel-muted mt-0.5 leading-snug">{subtitle}</p> : null}
        {footer ? <div className="mt-2">{footer}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </article>
    );
  }

  return (
    <article
      className={`rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm ${
        onClick ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {imageUrl ? (
        <div className="relative h-48 w-full bg-gray-100">
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="400px" unoptimized />
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-50" />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>
        {subtitle ? <p className="text-sm text-travel-muted mt-1">{subtitle}</p> : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </article>
  );
}
