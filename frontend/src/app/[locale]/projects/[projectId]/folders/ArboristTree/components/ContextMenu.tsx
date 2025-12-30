/**
 * ContextMenu - Component for displaying context menu
 */
'use client';
import { ContextMenuState } from '../types';

interface ContextMenuProps {
  contextMenu: ContextMenuState;
  onSelect: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export const ContextMenu = ({ contextMenu, onSelect, onRename, onMove, onDelete }: ContextMenuProps) => {
  if (!contextMenu.visible || !contextMenu.node) {
    return null;
  }

  return (
    <div
      className="context-menu"
      style={{
        position: 'fixed',
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="context-menu-item" onClick={onSelect}>
        Select
      </button>
      <button className="context-menu-item" onClick={onRename}>
        Rename
      </button>
      <button className="context-menu-item" onClick={onMove}>
        Move
      </button>
      <button className="context-menu-item context-menu-item-danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
};
