import {
  Group, Panel, Separator,
  type GroupProps, type PanelProps, type SeparatorProps,
} from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return <Group className={cn('flex size-full', className)} {...props} />;
}

export function ResizablePanel(props: PanelProps) {
  return <Panel {...props} />;
}

export function ResizableHandle({ className, ...props }: SeparatorProps) {
  return (
    <Separator
      className={cn(
        'relative z-10 w-1 shrink-0 bg-border/55 outline-none transition-colors',
        'hover:bg-primary/45 focus-visible:bg-primary/55 focus-visible:ring-1 focus-visible:ring-primary',
        className,
      )}
      {...props}
    />
  );
}
