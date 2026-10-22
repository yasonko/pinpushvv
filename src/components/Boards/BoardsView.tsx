import React, { useState } from 'react';
import { 
  FolderHeart, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Check, 
  X, 
  ExternalLink,
  Layers,
  AlertCircle
} from 'lucide-react';
import { Board, Pin, PinterestAccount } from '../../types';
import { pinterestService } from '../../services/pinterestApi';

interface BoardsViewProps {
  boards: Board[];
  pins: Pin[];
  pinterestAccount: PinterestAccount | null;
  onSaveBoard: (board: Board) => void;
  onSaveBoards: (boards: Board[]) => void;
  onDeleteBoard: (id: string) => void;
  onConnectPinterest: () => void;
}

export const BoardsView: React.FC<BoardsViewProps> = ({
  boards,
  pins,
  pinterestAccount,
  onSaveBoard,
  onSaveBoards,
  onDeleteBoard,
  onConnectPinterest,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pinterestBoardId, setPinterestBoardId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const startAdd = () => {
    setName('');
    setDescription('');
    setPinterestBoardId('');
    setIsAdding(true);
    setEditingId(null);
  };

  const startEdit = (b: Board) => {
    setName(b.name);
    setDescription(b.description || '');
    setPinterestBoardId(b.pinterestBoardId || '');
    setEditingId(b.id);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const board: Board = {
      id: editingId || `board_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      pinterestBoardId: pinterestBoardId.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onSaveBoard(board);
    setIsAdding(false);
    setEditingId(null);
  };

  // Sync boards with real Pinterest API
  const handleSyncPinterestBoards = async () => {
    if (!pinterestAccount || !pinterestAccount.accessToken || !pinterestAccount.isConnected) {
      onConnectPinterest();
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const fetchedBoards = await pinterestService.fetchBoards(pinterestAccount.accessToken);
      if (fetchedBoards.length > 0) {
        onSaveBoards(fetchedBoards);
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to sync Pinterest boards');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Bento Tile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs transition-colors amoled-card">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderHeart className="w-5 h-5 text-[#E60023] dark:text-red-400" />
            Pinterest Boards
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Organize destination boards and sync directly with your connected Pinterest business profile.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sync Button */}
          <button
            onClick={handleSyncPinterestBoards}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
              pinterestAccount?.isConnected
                ? 'bg-white dark:bg-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08] shadow-2xs'
                : 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-[#E60023] dark:text-red-400 border-red-200 dark:border-red-900/60'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#E60023]' : ''}`} />
            <span>
              {isSyncing ? 'Syncing...' : pinterestAccount?.isConnected ? 'Sync from Pinterest' : 'Connect to Sync Boards'}
            </span>
          </button>

          {/* Add Board */}
          <button
            onClick={startAdd}
            className="flex items-center gap-1.5 bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Board</span>
          </button>
        </div>
      </div>

      {syncError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-300 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#E60023] dark:text-red-400 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button onClick={() => setSyncError(null)} className="text-red-500 hover:text-red-800 dark:hover:text-red-300">✕</button>
        </div>
      )}

      {/* Add / Edit Form */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          className="bg-white/90 dark:bg-black/80 dark:backdrop-blur-2xl p-6 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-xs space-y-4 animate-in fade-in duration-150 amoled-card"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {editingId ? 'Edit Board' : 'Create New Board'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Board Name</label>
              <input
                type="text"
                placeholder="e.g. Back to School 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full text-xs p-3 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Pinterest Board ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 1029384756"
                value={pinterestBoardId}
                onChange={(e) => setPinterestBoardId(e.target.value)}
                className="w-full text-xs font-mono p-3 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="Brief description of ideas on this board..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-3 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#E60023] hover:bg-[#ad001a] text-white cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Board</span>
            </button>
          </div>
        </form>
      )}

      {/* Boards Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => {
          const pinCount = pins.filter(p => p.boardId === board.id).length;

          return (
            <div
              key={board.id}
              className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] shadow-xs flex flex-col justify-between space-y-3 transition-colors amoled-card"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#E60023] dark:text-red-400 flex items-center justify-center shrink-0 font-bold">
                      <FolderHeart className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{board.name}</h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(board)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-lg cursor-pointer transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteBoard(board.id)}
                      className="p-1.5 text-slate-400 hover:text-[#E60023] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {board.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{board.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{pinCount} Pins assigned</span>
                {board.pinterestBoardId && (
                  <span className="text-[10px] bg-[#F7F7F9] dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono border border-slate-200 dark:border-white/[0.08]">
                    ID: {board.pinterestBoardId}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
