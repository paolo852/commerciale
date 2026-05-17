interface AvatarProps {
  name: string;
  url?: string | null;
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
  fallbackClassName?: string;
  className?: string;
  title?: string;
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xxs: 'w-3.5 h-3.5 text-[8px]',
  xs:  'w-5 h-5 text-[10px]',
  sm:  'w-6 h-6 text-[10px]',
  md:  'w-7 h-7 text-xs',
  lg:  'w-9 h-9 text-sm',
};

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

export default function Avatar({
  name,
  url,
  size = 'md',
  fallbackClassName = 'bg-indigo-100 text-indigo-700',
  className = '',
  title,
}: AvatarProps) {
  const sizeClass = SIZES[size];
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        title={title ?? name}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }
  return (
    <span
      title={title ?? name}
      className={`${sizeClass} rounded-full font-bold flex items-center justify-center shrink-0 ${fallbackClassName} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
