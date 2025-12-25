export default function FoldersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
