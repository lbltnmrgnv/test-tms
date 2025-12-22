// Updated code with folder reload on each click
'use client';
import { Tree, NodeApi } from "react-arborist";
import { useState, useEffect, useContext } from "react";
import { TokenContext } from "@/utils/TokenProvider";
import { fetchFolders } from "./foldersControl";
import { fetchCases, moveCases } from "@/utils/caseControl";
import { FolderType } from "@/types/folder";
import { CaseType, CasesMessages } from "@/types/case";
import { Folder, ChevronRight, ChevronDown } from "lucide-react";
import CaseDialog from '@/src/app/[locale]/projects/[projectId]/folders/[folderId]/cases/CaseMoveDialog';

interface NodeData {
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
}

interface Props {
  projectId: string;
  messages: CasesMessages;
  onCaseClick?: (caseData: CaseType) => void;
}

export default function ArboristTree({ projectId, messages, onCaseClick }: Props) {
  const ctx = useContext(TokenContext);
  const [treeData, setTreeData] = useState<NodeData[]>([]);
  const [allFolders, setAllFolders] = useState<FolderType[]>([]);

  // Dialog
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [casesToMove, setCasesToMove] = useState<NodeData[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!ctx.isSignedIn()) return;

    fetchFolders(ctx.token.access_token, Number(projectId)).then(folders => {
      setAllFolders(folders);
      const roots = folders
        .filter((f: FolderType) => f.parentFolderId === null)
        .map((f: FolderType) => ({
          id: `folder-${f.id}`,
          name: f.name,
          children: [],
          folderId: f.id,
          loaded: false,
          parentFolderId: null,
          checked: false,
          indeterminate: false,
        }));
      setTreeData(roots);
    });
  }, [projectId, ctx]);

  // FORCE RELOAD on every click → always fetch fresh cases
  const loadFolder = async (folder: NodeData) => {
    const subFolders = allFolders.filter(f => f.parentFolderId === folder.folderId);
    const cases = await fetchCases(ctx.token.access_token, Number(folder.folderId));

    const children: NodeData[] = [
      ...subFolders.map(f => ({
        id: `folder-${f.id}`,
        name: f.name,
        children: [],
        folderId: f.id,
        parentFolderId: f.parentFolderId,
        loaded: false,
        checked: false,
        indeterminate: false,
      })),
      ...cases.map((c: CaseType) => ({
        id: `case-${c.id}`,
        name: c.title,
        children: [],
        isCase: true,
        caseData: c,
        folderId: folder.folderId,
        loaded: true,
        checked: false,
        indeterminate: false,
      })),
    ];

    const update = (nodes: NodeData[]): NodeData[] =>
      nodes.map(n =>
        n.id === folder.id
          ? { ...n, children, loaded: true }
          : { ...n, children: update(n.children) }
      );

    setTreeData(update(treeData));
  };

  const handleClick = async (node: NodeApi<NodeData>) => {
    const d = node.data;

    if (d.isCase && d.caseData) {
      onCaseClick?.(d.caseData);
      return;
    }

    node.toggle();
    await loadFolder(d); // ALWAYS reload folder
  };

  const toggleCheck = (node: NodeApi<NodeData>) => {
    const newState = !node.data.checked;

    const updateChildren = (nodes: NodeData[], state: boolean): NodeData[] =>
      nodes.map(n => ({ ...n, checked: state, indeterminate: false, children: updateChildren(n.children, state) }));

    const applyUpdate = (nodes: NodeData[]): NodeData[] =>
      nodes.map(n =>
        n.id === node.data.id
          ? { ...n, checked: newState, indeterminate: false, children: updateChildren(n.children, newState) }
          : { ...n, children: applyUpdate(n.children) }
      );

    const updateParents = (nodes: NodeData[]): NodeData[] => {
      const process = (n: NodeData): NodeData => {
        if (!n.children.length) return n;
        const children = n.children.map(process);
        const allChecked = children.every(c => c.checked);
        const noneChecked = children.every(c => !c.checked && !c.indeterminate);
        return { ...n, children, checked: allChecked, indeterminate: !allChecked && !noneChecked };
      };
      return nodes.map(process);
    };

    setTreeData(updateParents(applyUpdate(treeData)));
  };

  const getNodesByIds = (ids: string[], nodes: NodeData[]): NodeData[] => {
    let result: NodeData[] = [];
    for (const n of nodes) {
      if (ids.includes(n.id)) result.push(n);
      result = result.concat(getNodesByIds(ids, n.children));
    }
    return result;
  };

  const handleMove = async ({ dragIds, parentNode }: { dragIds: string[]; parentNode: NodeApi<NodeData> | null }) => {
    if (!parentNode?.data.folderId) return;

    const targetId = parentNode.data.folderId;

    const getCheckedCases = (nodes: NodeData[]): NodeData[] => {
      let result: NodeData[] = [];
      for (const n of nodes) {
        if (n.isCase && n.checked) result.push(n);
        result = result.concat(getCheckedCases(n.children));
      }
      return result;
    };

    const selectedCases = getCheckedCases(treeData);
    const dragCases = getNodesByIds(dragIds, treeData).filter(n => n.isCase);
    const finalCases = selectedCases.length ? selectedCases : dragCases;

    if (!finalCases.length) return;

    setCasesToMove(finalCases);
    setTargetFolderId(targetId);
    setIsMoveDialogOpen(true);
  };

  const handleMoved = async () => {
    if (!targetFolderId) return;

    const caseIds = casesToMove.map(c => c.caseData!.id);
    const success = await moveCases(ctx.token.access_token, caseIds, targetFolderId, Number(projectId));

    if (!success) return;

    const removeNodes = (nodes: NodeData[]): NodeData[] =>
      nodes
        .map(n => ({ ...n, children: removeNodes(n.children) }))
        .filter(n => !caseIds.includes(n.caseData?.id ?? -1));

    setTreeData(removeNodes(treeData));
    setIsMoveDialogOpen(false);
  };

  return (
    <>
      <Tree
        data={treeData}
        childrenAccessor="children"
        openByDefault={false}
        onMove={handleMove}
        disableDrag={node => !node.isCase}
        disableDrop={({ parentNode }) => !parentNode?.data.folderId}
      >
        {({ node, style, dragHandle }) => (
          <div
            style={{ ...style, paddingLeft: node.level * 12 }}
            className="tree-row"
            onClick={() => handleClick(node)}
            ref={dragHandle}
          >
            <input
              type="checkbox"
              checked={node.data.checked || false}
              ref={el => { if (el) el.indeterminate = node.data.indeterminate || false; }}
              onClick={e => { e.stopPropagation(); toggleCheck(node); }}
              className="checkbox-input"
            />
            <div className="icon-wrap">
              {node.data.isCase ? "📝" : (
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
            <span className="title">{node.data.name}</span>
          </div>
        )}
      </Tree>

      {isMoveDialogOpen && (
        <CaseDialog
          isOpen={isMoveDialogOpen}
          testCaseIds={casesToMove.map(c => c.caseData!.id)}
          projectId={projectId}
          targetFolderId={targetFolderId}
          isDisabled={!ctx.isProjectDeveloper(Number(projectId))}
          onCancel={() => setIsMoveDialogOpen(false)}
          onMoved={handleMoved}
          messages={messages}
          token={ctx.token.access_token}
        />
      )}
    </>
  );
}