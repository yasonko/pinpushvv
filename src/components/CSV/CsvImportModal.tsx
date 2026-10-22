import React, { useState, useRef } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Check, 
  Download,
  Info
} from 'lucide-react';
import { Pin, Board, Website } from '../../types';
import { 
  parsePinterestBulkUploadCSV, 
  parseCSV, 
  validateCsvRows, 
  CsvRowValidation,
  PINTEREST_CSV_HEADER_ROW 
} from '../../services/csvEngine';

interface CsvImportModalProps {
  boards: Board[];
  websites: Website[];
  isOpen: boolean;
  onClose: () => void;
  onImportPins: (pins: Pin[], newBoards: Board[]) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  boards,
  websites,
  isOpen,
  onClose,
  onImportPins,
}) => {
  const [rawCsvText, setRawCsvText] = useState('');
  const [validations, setValidations] = useState<CsvRowValidation[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pinterestParsedResult, setPinterestParsedResult] = useState<ReturnType<typeof parsePinterestBulkUploadCSV> | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawCsvText(content);
      validateContent(content);
    };
    reader.readAsText(file);
  };

  const validateContent = (text?: string | null) => {
    setHeaderError(null);
    if (!text || !text.trim()) {
      setValidations(null);
      setPinterestParsedResult(null);
      return;
    }

    // Try official Pinterest parser first
    const pinterestResult = parsePinterestBulkUploadCSV(text, boards);
    if (pinterestResult.success && pinterestResult.pins.length > 0) {
      setPinterestParsedResult(pinterestResult);
      // Map to UI row validation
      const rowVals: CsvRowValidation[] = pinterestResult.pins.map((pin, idx) => ({
        rowIndex: idx + 1,
        data: {
          filename: pin.filename,
          imageUrl: pin.imageUrl,
          title: pin.title,
          description: pin.description,
          altText: pin.altText,
          destinationUrl: pin.destinationUrl,
          board: (pin.boardId && boards.find(b => b.id === pin.boardId)?.name) || 
                 (pinterestResult.newBoardsToCreate.find(b => b.id === pin.boardId)?.name) || '',
          scheduledDate: pin.scheduledAt ? pin.scheduledAt.split('T')[0] : '',
          scheduledTime: pin.scheduledAt ? pin.scheduledAt.substring(11, 16) : '',
        },
        isValid: true,
        errors: [],
        warnings: !pin.imageUrl ? ['No image URL provided'] : []
      }));
      setValidations(rowVals);
      return;
    }

    // If Pinterest format failed with explicit header error, check if user intended generic CSV
    const rows = parseCSV(text);
    if (rows.length === 0) {
      setHeaderError(pinterestResult.error || 'CSV is empty or invalid.');
      setValidations([]);
      return;
    }

    const results = validateCsvRows(rows, boards);
    setValidations(results);
    setPinterestParsedResult(null);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value || '';
    setRawCsvText(val);
    if (val.trim()) validateContent(val);
    else {
      setValidations(null);
      setPinterestParsedResult(null);
      setHeaderError(null);
    }
  };

  const loadSamplePinterestTemplate = () => {
    const sample = `Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords
Matcha Latte Recipe,https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800,Matcha Recipes,,Creamy iced matcha latte with oat milk and honey,https://example.com/matcha-latte,2026-08-25 09:00 AM,"matcha, latte, recipe, healthy drinks"
Healthy Meal Prep Bowls,https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800,Healthy Food,,15-minute high protein meal prep bowls,https://example.com/meal-prep,2026-08-25 01:30 PM,"meal prep, healthy recipes, dinner"
Aesthetic Desk Setup,https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800,Home Office Ideas,,Minimalist study and work desk aesthetic,https://example.com/desk-setup,2026-08-26 06:00 PM,"desk setup, home office, minimalist"`;
    setRawCsvText(sample);
    setFileName('pinterest-bulk-upload.csv');
    validateContent(sample);
  };

  const handleCommitImport = () => {
    // If we have direct Pinterest parsed pins, commit them
    if (pinterestParsedResult && pinterestParsedResult.pins.length > 0) {
      onImportPins(pinterestParsedResult.pins, pinterestParsedResult.newBoardsToCreate);
      onClose();
      return;
    }

    if (!validations || validations.length === 0) return;

    const safeBoards = Array.isArray(boards) ? boards : [];
    const boardMap = new Map<string, string>(
      safeBoards
        .filter(b => b && typeof b.name === 'string')
        .map(b => [(b.name || '').toLowerCase().trim(), b.id || ''])
    );
    const newBoardsToCreate: Board[] = [];
    const newPins: Pin[] = [];
    const now = new Date().toISOString();

    validations.forEach((rowVal, idx) => {
      const data = rowVal.data;
      let targetBoardId = '';

      if (data.board) {
        const lowerName = data.board.toLowerCase().trim();
        if (boardMap.has(lowerName)) {
          targetBoardId = boardMap.get(lowerName)!;
        } else {
          // Create new board
          const newB: Board = {
            id: `board_csv_${Date.now()}_${idx}`,
            name: data.board,
            createdAt: now,
          };
          newBoardsToCreate.push(newB);
          boardMap.set(lowerName, newB.id);
          targetBoardId = newB.id;
        }
      }

      // Schedule parsing
      let scheduledAt: string | null = null;
      let status: Pin['status'] = 'draft';
      if (data.scheduledDate) {
        const time = data.scheduledTime || '12:00';
        try {
          const d = new Date(`${data.scheduledDate}T${time}:00`);
          if (!isNaN(d.getTime())) {
            scheduledAt = d.toISOString();
            status = 'scheduled';
          }
        } catch {
          // keep as draft
        }
      }

      // Dummy canvas placeholder if image_url not available
      let imageUrl = data.imageUrl;
      let thumbnailUrl = data.imageUrl;
      if (!imageUrl) {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(0, 0, 400, 600);
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(data.title || data.filename || 'CSV Pin', 30, 200);
          imageUrl = canvas.toDataURL('image/jpeg', 0.8);
          thumbnailUrl = imageUrl;
        }
      }

      const pin: Pin = {
        id: `pin_csv_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        filename: data.filename || `${(data.title || 'pin').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.jpg`,
        imageUrl: imageUrl || '',
        thumbnailUrl: thumbnailUrl || imageUrl || '',
        title: data.title || data.filename || `Pin #${idx + 1}`,
        description: data.description || '',
        altText: data.altText || data.title || '',
        tags: (rowVal.data as any).tags 
          ? (Array.isArray((rowVal.data as any).tags) 
              ? (rowVal.data as any).tags 
              : String((rowVal.data as any).tags).split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)) 
          : [],
        destinationUrl: data.destinationUrl || '',
        boardId: targetBoardId || undefined,
        status,
        aiStatus: data.title && data.description ? 'completed' : 'pending',
        aiGenerated: false,
        titleManuallyEdited: !!data.title,
        descriptionManuallyEdited: !!data.description,
        tagsManuallyEdited: false,
        scheduledAt,
        publishedAt: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      };

      newPins.push(pin);
    });

    onImportPins(newPins, newBoardsToCreate);
    onClose();
  };

  const validCount = validations?.filter(v => v.isValid).length || 0;
  const invalidCount = validations?.filter(v => !v.isValid).length || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Import Pins from CSV</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk import Pins using standard Pinterest CSV or custom metadata spreadsheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          {/* Official Format Badge */}
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 min-w-0">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">
                Supported columns: <strong className="font-mono text-[11px]">Title, Media URL, Pinterest board, Thumbnail, Description, Link, Publish date, Keywords</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={loadSamplePinterestTemplate}
              className="text-xs text-blue-700 dark:text-blue-400 hover:underline font-bold shrink-0 cursor-pointer"
            >
              Load Sample Template
            </button>
          </div>

          {/* Upload Area */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 shadow-2xs transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Choose CSV File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              {fileName && (
                <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-bold bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                  {fileName}
                </span>
              )}
            </div>

            <span className="text-xs text-slate-400">
              UTF-8 CSV with commas, quotes, and newlines supported
            </span>
          </div>

          {/* Direct CSV Textarea Paste */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Or Paste CSV Data Directly
            </label>
            <textarea
              rows={4}
              value={rawCsvText}
              onChange={handleTextChange}
              placeholder="Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords..."
              className="w-full text-xs font-mono p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            />
          </div>

          {/* Header Structure Error Notice */}
          {headerError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Invalid Pinterest CSV format</span>
              </div>
              <p className="text-rose-700 dark:text-rose-400 whitespace-pre-line font-mono text-[11px]">
                {headerError}
              </p>
            </div>
          )}

          {/* Validation & Preview Table */}
          {validations && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Validation Preview ({validations.length} Pins detected)
                </h3>
                <div className="flex gap-2 text-xs font-bold font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400">{validCount} Valid</span>
                  {invalidCount > 0 && <span className="text-rose-600 dark:text-rose-400">{invalidCount} Errors</span>}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5 w-10">#</th>
                      <th className="p-2.5 min-w-[160px]">Title</th>
                      <th className="p-2.5 min-w-[140px]">Media URL</th>
                      <th className="p-2.5 w-36">Pinterest Board</th>
                      <th className="p-2.5 min-w-[150px]">Link</th>
                      <th className="p-2.5 w-28">Publish Date</th>
                      <th className="p-2.5 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {validations.map((v) => (
                      <tr
                        key={v.rowIndex}
                        className={v.isValid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-rose-50/60 dark:bg-rose-950/40'}
                      >
                        <td className="p-2.5 font-mono text-slate-400 dark:text-slate-500">{v.rowIndex}</td>
                        <td className="p-2.5 font-medium truncate max-w-[180px] text-slate-900 dark:text-white" title={v.data.title}>
                          {v.data.title || '-'}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] truncate max-w-[140px] text-slate-500" title={v.data.imageUrl}>
                          {v.data.imageUrl || '-'}
                        </td>
                        <td className="p-2.5 truncate max-w-[130px] font-semibold">{v.data.board || '-'}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]" title={v.data.destinationUrl}>
                          {v.data.destinationUrl || '-'}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {v.data.scheduledDate ? `${v.data.scheduledDate} ${v.data.scheduledTime || ''}` : '-'}
                        </td>
                        <td className="p-2.5">
                          {v.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-400 font-bold" title={v.errors.join(', ')}>
                              <AlertCircle className="w-3.5 h-3.5" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCommitImport}
            disabled={!validations || validCount === 0}
            className="flex items-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>Import {validCount} Valid Pin{validCount === 1 ? '' : 's'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
