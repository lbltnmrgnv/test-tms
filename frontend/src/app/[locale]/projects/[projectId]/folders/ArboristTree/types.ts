/**
 * Type definitions for ArboristTree component
 */
import { CaseType, CasesMessages } from '@/types/case';
import { FilterOptions } from '@/types/filter';

export type CreateMode = 'folder' | 'case';

export interface NodeData {
  id: string;
  name: string;
  children: NodeData[];
  isCase?: boolean;
  caseData?: CaseType;
  folderId?: number;
  loaded?: boolean;
  parentFolderId?: number | null;
  checked?: boolean;
  indeterminate?: boolean;
  open?: boolean;
  isCreateNode?: boolean;
  createParentId?: number;
}

export interface ArboristTreeProps {
  projectId: string;
  messages: CasesMessages;
  selectedCaseId?: number;
  onCaseClick?: (caseData: CaseType) => void;
  onCaseUpdated?: (updatedCase: CaseType) => void;
  filter?: FilterOptions;
  onFilterCount?: (count: number) => void;
  updatedCase?: CaseType;
  onSelectionChange?: (selectedCount: number) => void;
  triggerBulkDelete?: boolean;
  onBulkDeleteComplete?: () => void;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: any | null; // NodeApi<NodeData> from react-arborist
}
