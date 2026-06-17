/**
 * Generic modal dialog. Built on the shadcn/Radix Dialog primitive, so it
 * handles focus-trapping, scroll-lock, Escape, and backdrop-click close for
 * free. The `{ title, onClose, children }` API is kept stable so existing
 * callers (New/Rename/Delete/Category dialogs) need no changes.
 */
import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from './ui/dialog';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[440px] gap-0 p-0">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}
