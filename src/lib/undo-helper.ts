import { toast } from "sonner";

type UndoItem<T = unknown> = {
  id: string;
  collection: string;
  item: T;
  deletedAt: number;
};

let undoStack: UndoItem[] = [];
const UNDO_TIMEOUT = 5000;

export function showUndoToast(message: string, undoItem: UndoItem, onUndo: (item: UndoItem) => void) {
  const id = toast.success(message, {
    duration: UNDO_TIMEOUT,
    action: {
      label: "Urungkan",
      onClick: () => {
        onUndo(undoItem);
        toast.dismiss(id);
      },
    },
  });
  return id;
}

export function addToUndoStack(item: UndoItem) {
  undoStack.push(item);
  setTimeout(() => {
    undoStack = undoStack.filter(u => u.deletedAt !== item.deletedAt);
  }, UNDO_TIMEOUT);
}

export function createUndoItem<T>(id: string, collection: string, item: T): UndoItem<T> {
  return { id, collection, item: item as T, deletedAt: Date.now() };
}
