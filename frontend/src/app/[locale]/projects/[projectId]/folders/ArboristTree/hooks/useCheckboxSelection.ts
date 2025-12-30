/**
 * Hook for managing checkbox selection state in the tree
 */
import { useEffect } from 'react';
import { NodeApi } from 'react-arborist';
import { NodeData } from '../types';
import { countSelectedCases } from '../utils';

interface UseCheckboxSelectionProps {
  treeData: NodeData[];
  setTreeData: React.Dispatch<React.SetStateAction<NodeData[]>>;
  onSelectionChange?: (selectedCount: number) => void;
  loadFolderRecursively: (folder: NodeData) => Promise<void>;
}

export const useCheckboxSelection = ({
  treeData,
  setTreeData,
  onSelectionChange,
  loadFolderRecursively,
}: UseCheckboxSelectionProps) => {
  // Notify parent of selection changes (only case count)
  useEffect(() => {
    const selectedCasesCount = countSelectedCases(treeData);
    onSelectionChange?.(selectedCasesCount);
  }, [treeData, onSelectionChange]);

  const toggleCheck = async (node: NodeApi<NodeData>) => {
    const newState = !node.data.checked;

    // Auto-load folder and all nested children when checking an unloaded folder
    if (newState && !node.data.isCase && !node.data.loaded) {
      await loadFolderRecursively(node.data);
    }

    // Recursively update state of all loaded child nodes
    const updateChildren = (nodes: NodeData[], state: boolean): NodeData[] =>
      nodes.map((n) => ({
        ...n,
        checked: state,
        indeterminate: false,
        children: updateChildren(n.children, state),
      }));

    // Apply update to target node and its loaded children
    const applyUpdate = (nodes: NodeData[]): NodeData[] =>
      nodes.map((n) => {
        if (n.id === node.data.id) {
          return {
            ...n,
            checked: newState,
            indeterminate: false,
            children: updateChildren(n.children, newState),
          };
        }

        return {
          ...n,
          children: applyUpdate(n.children),
        };
      });

    // Update parent nodes state (indeterminate/checked)
    const updateParents = (nodes: NodeData[]): NodeData[] => {
      const process = (n: NodeData): NodeData => {
        if (!n.children.length) return n;

        const children = n.children.map(process);
        const allChecked = children.every((c) => c.checked);
        const noneChecked = children.every((c) => !c.checked && !c.indeterminate);

        return {
          ...n,
          children,
          checked: allChecked,
          indeterminate: !allChecked && !noneChecked,
        };
      };
      return nodes.map(process);
    };

    setTreeData((prev) => updateParents(applyUpdate(prev)));
  };

  return {
    toggleCheck,
  };
};
