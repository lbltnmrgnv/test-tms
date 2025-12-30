/**
 * Hook for managing context menu state and actions
 */
import { useState, useEffect } from 'react';
import { NodeApi } from 'react-arborist';
import { NodeData, ContextMenuState } from '../types';

interface UseContextMenuProps {
  onSelect: (node: NodeApi<NodeData>) => void;
  onRenameStart: (nodeId: string, currentName: string) => void;
  onMove: (node: NodeApi<NodeData>) => void;
  onDelete: (node: NodeApi<NodeData>) => void;
}

export const useContextMenu = ({
  onSelect,
  onRenameStart,
  onMove,
  onDelete,
}: UseContextMenuProps) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  const handleContextMenu = (e: React.MouseEvent, node: NodeApi<NodeData>) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't show context menu for create nodes
    if (node.data.isCreateNode) return;

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  const handleContextSelect = () => {
    if (contextMenu.node) {
      onSelect(contextMenu.node);
    }
    closeContextMenu();
  };

  const handleContextRename = () => {
    if (contextMenu.node) {
      onRenameStart(contextMenu.node.data.id, contextMenu.node.data.name);
    }
    closeContextMenu();
  };

  const handleContextMove = () => {
    if (contextMenu.node) {
      onMove(contextMenu.node);
    }
    closeContextMenu();
  };

  const handleContextDelete = () => {
    if (contextMenu.node) {
      onDelete(contextMenu.node);
    }
    closeContextMenu();
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (contextMenu.visible) {
      const handleClickOutside = () => closeContextMenu();
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
    handleContextSelect,
    handleContextRename,
    handleContextMove,
    handleContextDelete,
  };
};
