import React, { HTMLAttributes, forwardRef } from 'react';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded' | 'square';
  status?: 'online' | 'offline' | 'busy' | 'away';
  statusPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const sizeClasses = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const statusSizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

const statusPositionClasses = {
  'bottom-right': 'bottom-0 end-0',
  'bottom-left': 'bottom-0 start-0',
  'top-right': 'top-0 end-0',
  'top-left': 'top-0 start-0',
};

const statusColorClasses = {
  online: 'bg-success',
  offline: 'bg-secondary',
  busy: 'bg-danger',
  away: 'bg-warning',
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      shape = 'circle',
      status,
      statusPosition = 'bottom-right',
      className = '',
      ...props
    },
    ref
  ) => {
    const shapeClasses = {
      circle: 'rounded-circle',
      rounded: 'rounded-4',
      square: '',
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const initials = name ? getInitials(name) : '?';
    const bgColor = name
      ? `hsl(${name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360}, 70%, 45%)`
      : '#6c757d';

    return (
      <div
        ref={ref}
        className={`d-inline-flex align-items-center justify-content-center ${sizeClasses[size]} ${shapeClasses[shape]} ${className}`}
        style={{ backgroundColor: bgColor, color: 'white', overflow: 'hidden', flexShrink: 0, position: 'relative' }}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-100 h-100 object-fit-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span className="fw-medium">{initials}</span>
        )}
        {status && (
          <span
            className={`position-absolute border-3 border-white ${statusSizeClasses[size]} rounded-circle ${statusColorClasses[status]} ${statusPositionClasses[statusPosition]}`}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export const AvatarGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { max?: number }>(
  ({ children, max = 5, className = '', ...props }, ref) => {
    const kids = Array.isArray(children) ? children : [children];
    const visible = kids.slice(0, max);
    const remaining = kids.length - max;

    return (
      <div ref={ref} className={`d-inline-flex ${className}`} {...props}>
        {visible.map((child, index) => React.cloneElement(child as React.ReactElement, {
          key: index,
          className: `${(child as React.ReactElement).props.className || ''} ms-n2 border-2 border-white`.trim(),
          style: { zIndex: max - index, ...(child as React.ReactElement).props.style },
        }))}
        {remaining > 0 && (
          <div
            className={`d-inline-flex align-items-center justify-content-center ${sizeClasses.md} ms-n2 border-2 border-white rounded-circle bg-secondary bg-opacity-25 text-secondary fw-medium`}
            style={{ zIndex: 0 }}
          >
            +{remaining}
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';