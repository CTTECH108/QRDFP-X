/** MongoDB connection status indicator */
export function MongoDBBadge() {
  return (
    <div className="flex items-center gap-1.5 font-mono-cyber text-xs">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-green opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-green" />
      </span>
      <span className="text-cyber-green text-[10px]">MONGODB ATLAS</span>
    </div>
  );
}
