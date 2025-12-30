/**
 * TreeNode - Component for rendering individual tree nodes (folders and cases)
 */
'use client';
import { NodeApi } from 'react-arborist';
import { Folder, ChevronRight, ChevronDown, Bot, Hand } from 'lucide-react';
import { CaseType } from '@/types/case';
import { NodeData } from '../types';

interface TreeNodeProps {
  node: NodeApi<NodeData>;
  style: React.CSSProperties;
  dragHandle: any;
  selectedCaseId?: number;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  onClick: (node: NodeApi<NodeData>) => void;
  onContextMenu: (e: React.MouseEvent, node: NodeApi<NodeData>) => void;
  onCheckboxToggle: (node: NodeApi<NodeData>) => void;
}

const renderCaseIcon = (caseData: CaseType) =>
  caseData.automationStatus === 1 ? <Bot size={16} strokeWidth={1.5} /> : <Hand size={16} strokeWidth={1.5} />;

export const TreeNode = ({
  node,
  style,
  dragHandle,
  selectedCaseId,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameKeyDown,
  onClick,
  onContextMenu,
  onCheckboxToggle,
}: TreeNodeProps) => {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flex: '1 1 auto',
        paddingLeft: node.level * 12,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      className={`tree-row ${node.data.isCase && node.data.caseData?.id === selectedCaseId ? 'selected-case' : ''}`}
      onClick={() => onClick(node)}
      onContextMenu={(e) => onContextMenu(e, node)}
      ref={dragHandle}
    >
      <input
        type="checkbox"
        checked={node.data.checked || false}
        ref={(el) => {
          if (el) el.indeterminate = node.data.indeterminate || false;
        }}
        onClick={(e) => {
          e.stopPropagation();
          onCheckboxToggle(node);
        }}
        className="checkbox-input"
      />
      <div className="icon-wrap">
        {node.data.isCase && node.data.caseData ? (
          renderCaseIcon(node.data.caseData)
        ) : (
          <>
            <Folder className="folder-icon" size={17} strokeWidth={1.4} />
            {!node.isOpen ? (
              <ChevronRight className="hover-icon" size={17} strokeWidth={1.6} />
            ) : (
              <ChevronDown className="hover-icon" size={17} strokeWidth={1.6} />
            )}
          </>
        )}
      </div>
      {isRenaming ? (
        <input
          type="text"
          value={renameValue}
          onChange={(e) => onRenameValueChange(e.target.value)}
          onKeyDown={onRenameKeyDown}
          onBlur={onRenameSubmit}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          className="title"
          style={{
            border: '1px solid #3b82f6',
            outline: 'none',
            padding: '0 4px',
            borderRadius: '2px',
          }}
        />
      ) : (
        <span className="title">{node.data.name}</span>
      )}
    </div>
  );
};
