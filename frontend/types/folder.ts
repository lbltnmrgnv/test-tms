import { CaseType } from './case';

export type FolderType = {
  id: number;
  name: string;
  detail: string;
  projectId: number;
  parentFolderId: number | null;
  createdAt: string;
  updatedAt: string;
  Cases: CaseType[]; // additional property
};

export type FoldersMessages = {
  folder: string;
  newFolder: string;
  editFolder: string;
  deleteFolder: string;
  folderName: string;
  folderDetail: string;
  close: string;
  create: string;
  update: string;
  pleaseEnter: string;
  delete: string;
  areYouSure: string;
};

export type TreeNodeData = {
  id: string;
  name: string;
  detail?: string;
  parentFolderId: number | null;
  projectId: string | number;
  folderData: FolderType;
  children: TreeNodeData[];
  cases?: CaseType[];
  isCasesLoaded?: boolean; // флаг, что кейсы уже подгружены
};

