'use client';

import Image from 'next/image';

export default function OpportunityCard({
  title,
  subtitle,
  imageUrl,
  footer,
  action,
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {imageUrl ? (
        <div className="relative h-36 w-full bg-gray-100">
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="400px" unoptimized />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-50" />
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
