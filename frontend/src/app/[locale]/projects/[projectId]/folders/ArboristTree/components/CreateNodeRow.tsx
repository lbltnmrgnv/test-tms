/**
 * CreateNodeRow - Component for creating new folders and test cases
 */
'use client';
import { useState, useRef, useContext } from 'react';
import { Folder, Plus } from 'lucide-react';
import { CaseType } from '@/types/case';
import { TokenContext } from '@/utils/TokenProvider';
import { createCase } from '@/utils/caseControl';
import { createFolder } from '../../foldersControl';
import { CreateMode, NodeData } from '../types';

interface CreateNodeRowProps {
  parentFolderId: number | null;
  projectId: string;
  style: React.CSSProperties;
  level: number;
  isRootLevel?: boolean;
  onFolderCreated: (parentFolderId: number | null, newFolder: NodeData, folderData?: any) => void;
  onCaseCreated: (parentFolderId: number, newCase: NodeData, caseData: CaseType) => void;
}

export const CreateNodeRow = ({
  parentFolderId,
  projectId,
  style,
  level,
  isRootLevel = false,
  onFolderCreated,
  onCaseCreated,
}: CreateNodeRowProps) => {
  const ctx = useContext(TokenContext);
  const [mode, setMode] = useState<CreateMode>('folder');
  const [value, setValue] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleModeSwitch = (newMode: CreateMode) => {
    setMode(newMode);
    setValue('');
    inputRef.current?.focus();
  };

  const handleCreate = async () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    if (mode === 'folder') {
      const newFolder = await createFolder(
        ctx.token.access_token,
        trimmedValue,
        '',
        projectId,
        parentFolderId
      );

      if (newFolder) {
        const folderNode: NodeData = {
          id: `folder-${newFolder.id}`,
          name: newFolder.name,
          children: [],
          folderId: newFolder.id,
          parentFolderId: newFolder.parentFolderId,
          loaded: false,
          checked: false,
          indeterminate: false,
          open: false,
        };

        // Pass the complete folder data from the API response
        onFolderCreated(parentFolderId, folderNode, newFolder);
      }
    } else {
      // Cases can only be created inside folders
      if (parentFolderId === null) return;

      const newCase = await createCase(ctx.token.access_token, String(parentFolderId), trimmedValue, '');

      if (newCase) {
        const caseNode: NodeData = {
          id: `case-${newCase.id}`,
          name: newCase.title,
          isCase: true,
          caseData: newCase,
          folderId: parentFolderId,
          children: [],
          loaded: true,
        };

        onCaseCreated(parentFolderId, caseNode, newCase);
      }
    }

    setValue('');
    setMode('folder');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setValue('');
      setMode('folder');
      inputRef.current?.blur();
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        display: 'flex',
        flex: '1 1 auto',
        paddingLeft: level * 12,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        alignItems: 'center',
        gap: '4px',
      }}
      className="tree-row create-node-row"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleContainerClick}
    >
      <div className="icon-wrap">
        {mode === 'folder' ? <Folder size={17} strokeWidth={1.4} /> : <Plus size={17} strokeWidth={1.4} />}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          // Check if focus moved outside the container
          const relatedTarget = e.relatedTarget as Node | null;
          if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
            return;
          }

          if (!value.trim()) {
            setValue('');
            setMode('folder');
          }
        }}
        placeholder={mode === 'folder' ? 'Folder' : 'Test Case'}
        className="create-node-input"
        style={{
          flex: '0 0 auto',
          width: value ? 'auto' : mode === 'folder' ? '6ch' : '9ch',
          minWidth: mode === 'folder' ? '6ch' : '9ch',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 'inherit',
        }}
      />
      {isHovered && !value && !isRootLevel && (
        <>
          <span className="hint-text">or create</span>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleModeSwitch(mode === 'folder' ? 'case' : 'folder');
            }}
            className="mode-switch-button"
          >
            <Plus size={14} strokeWidth={2} />
            {mode === 'folder' ? 'Test Case' : 'Folder'}
          </button>
        </>
      )}
    </div>
  );
};
