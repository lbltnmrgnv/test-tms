import { useState, useEffect, useContext } from 'react';
import { TreeNodeData } from '@/types/folder';
import { FolderType, FoldersMessages } from '@/types/folder';
import { buildFolderTree } from '@/utils/buildFolderTree';
import { fetchCases } from '@/utils/caseControl';
import { TokenContext } from '@/utils/TokenProvider';
import FolderItem from './FolderItem';
import { fetchFolders } from './foldersControl';

type Props = {
  projectId: string;
  onCaseClick?: (caseId: number) => void;
};

export default function TreeView({ projectId, onCaseClick }: Props) {
  const context = useContext(TokenContext);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Загрузка корневых папок
  useEffect(() => {
    async function loadRootFolders() {
      if (!context.isSignedIn()) return;
      const folders = await fetchFolders(context.token.access_token, Number(projectId));
      const tree = buildFolderTree(folders);
      setTreeData(tree);
    }
    loadRootFolders();
  }, [projectId, context]);

  // Иммутабельное обновление одного узла
  const updateNodeDeep = (
    nodes: TreeNodeData[],
    id: string,
    patch: Partial<TreeNodeData>
  ): TreeNodeData[] => {
    return nodes.map(n => {
      if (n.id === id) return { ...n, ...patch };
      if (n.children.length > 0) {
        const updatedChildren = updateNodeDeep(n.children, id, patch);
        if (updatedChildren !== n.children) return { ...n, children: updatedChildren };
      }
      return n;
    });
  };

  // Загрузка кейсов для узла
  const loadCases = async (node: TreeNodeData) => {
    if (!context.isSignedIn() || node.isCasesLoaded) return;

    const cases = await fetchCases(context.token.access_token, Number(node.id));
    setTreeData(prev => updateNodeDeep(prev, node.id, { cases, isCasesLoaded: true }));
  };

  const findNodeById = (nodes: TreeNodeData[], id: string): TreeNodeData | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children.length > 0) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const toggleFolder = (nodeId: string) => {
    setExpandedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(nodeId)) updated.delete(nodeId);
      else updated.add(nodeId);
      return updated;
    });

    const node = findNodeById(treeData, nodeId);
    if (node && !node.isCasesLoaded) loadCases(node);
  };

  // Рендер дерева
  const renderTree = (nodes: TreeNodeData[]): JSX.Element => (
    <ul style={{ listStyle: 'none', paddingLeft: 16 }}>
      {nodes.map(node => (
        <li key={node.id}>
          <FolderItem
            node={node}
            isOpen={expandedIds.has(node.id)}
            toggle={() => toggleFolder(node.id)}
            style={{ paddingLeft: 8 }}
            projectId={projectId}
            selectedFolder={null}
            locale="en"
            messages={{} as FoldersMessages}
            openDialogForCreate={() => {}}
            onEditClick={() => {}}
            onDeleteClick={() => {}}
          />

          {expandedIds.has(node.id) && (
            <>
              {node.children.length > 0 && renderTree(node.children)}

              {node.cases?.map(c => (
                <div
                  key={c.id}
                  style={{ paddingLeft: 24, cursor: 'pointer' }}
                  onClick={() => onCaseClick?.(c.id)}
                >
                  📝 {c.title}
                </div>
              ))}
            </>
          )}
        </li>
      ))}
    </ul>
  );

  return <div>{renderTree(treeData)}</div>;
}