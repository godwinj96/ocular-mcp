import type { ReactNode } from 'react';

// LEFT-ALIGNED, no illustration, no icon. Centring an empty state inside a
// left-aligned app is a decoration tell -- the content suddenly sits somewhere
// nothing else on the page sits, which announces "this is a special screen"
// when the point is that it is an ordinary screen with nothing in it yet.
//
// The description must ADD information rather than restate the title, and there
// is at most one primary plus one secondary action. Where there is genuinely no
// action available, there is no button: inventing one gives the user something
// to click that cannot help them.
//
// Rendered OUTSIDE the table, never as an empty <tbody> -- per Geist. And per
// Geist again: a persistent warning must never live in an empty state, because
// it disappears the moment the list fills. The lapsed-subscription notice
// belongs at page level for exactly that reason.

interface EmptyStateProps {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="py-12">
      <p className="text-[15px] font-medium text-text-primary">{title}</p>
      <p className="mt-stack-1 max-w-[60ch] text-[15px] leading-[1.6] text-text-secondary">
        {description}
      </p>
      {action && <div className="mt-stack-2">{action}</div>}
    </div>
  );
}
