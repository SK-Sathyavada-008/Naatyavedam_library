import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileArchive,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  exportLibraryBackup,
  importLibraryBackup,
  type ImportBackupResult,
} from '../../services/backupService';
import type { UserProfile } from '../../types';

export interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLibraryRestored?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  user,
  onLibraryRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    pct: number;
    message: string;
  } | null>(null);
  const [exportSuccessFilename, setExportSuccessFilename] = useState<string | null>(null);

  // Import State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    pct: number;
    message: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportBackupResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Handle Export
  const handleStartExport = async () => {
    setIsExporting(true);
    setExportProgress({ pct: 0, message: 'Preparing library export...' });
    setExportSuccessFilename(null);

    try {
      const { blob, filename } = await exportLibraryBackup(user, (current, total, message) => {
        setExportProgress({ pct: Math.round((current / total) * 100), message });
      });

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setExportSuccessFilename(filename);
    } catch (err: unknown) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Handle File Selection for Import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    setImportProgress({ pct: 5, message: 'Reading archive...' });

    try {
      const result = await importLibraryBackup(file, (current, total, message) => {
        setImportProgress({ pct: Math.round((current / total) * 100), message });
      });

      setImportResult(result);
      if (result.success && onLibraryRestored) {
        onLibraryRestored();
      }
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Library Backup & Recovery"
      description="Export your complete repertoire archive or restore previous backups."
    >
      <div className="space-y-4 py-1">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border text-xs font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-sage text-sage-hover'
                : 'border-transparent text-charcoal-muted hover:text-charcoal'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup (.zip)</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-sage text-sage-hover'
                : 'border-transparent text-charcoal-muted hover:text-charcoal'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore Backup</span>
          </button>
        </div>

        {/* TAB 1: EXPORT */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-canvas-subtle border border-border/80 space-y-2">
              <div className="flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-sage" />
                <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                  Portable Offline Backup
                </h4>
              </div>
              <p className="text-xs text-charcoal-muted leading-relaxed">
                Creates a standard, structured <strong>.zip archive</strong> containing all your dance music recordings, original filenames, Raagam &amp; Taalam metadata, favorites, and performance sequences.
              </p>
              <ul className="text-[11px] text-charcoal-muted space-y-1 list-disc list-inside pt-1">
                <li>Contains high-quality audio files and JSON metadata</li>
                <li>Can be archived to Google Drive, USB drives, or computers</li>
                <li>Fully independent of network connectivity</li>
              </ul>
            </div>

            {/* Export Progress */}
            {isExporting && exportProgress && (
              <div className="space-y-2 p-3 bg-sage-light/40 border border-sage/30 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-charcoal">
                  <span>{exportProgress.message}</span>
                  <span>{exportProgress.pct}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sage h-2 rounded-full transition-all duration-200"
                    style={{ width: `${exportProgress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Export Success Feedback */}
            {exportSuccessFilename && !isExporting && (
              <div className="p-3 rounded-xl bg-sage-light border border-sage text-xs text-sage-hover flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <div>
                  <strong>Export Successful!</strong> Downloaded: {exportSuccessFilename}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleStartExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 font-semibold text-xs"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Archive...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Full Library Backup (.zip)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: IMPORT / RESTORE */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="p-3.5 rounded-2xl bg-canvas-subtle border border-border/80 space-y-2">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-sage" />
                <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                  Restore from Backup File
                </h4>
              </div>
              <p className="text-xs text-charcoal-muted leading-relaxed">
                Select a previously exported <code>.zip</code> or <code>.json</code> backup. The system validates the archive manifest and safely restores your dance songs and performance programs without corrupting existing records.
              </p>
            </div>

            {/* Import Progress */}
            {isImporting && importProgress && (
              <div className="space-y-2 p-3 bg-sage-light/40 border border-sage/30 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-charcoal">
                  <span>{importProgress.message}</span>
                  <span>{importProgress.pct}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sage h-2 rounded-full transition-all duration-200"
                    style={{ width: `${importProgress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Import Error Message */}
            {importError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <div>
                  <strong>Restore Error:</strong> {importError}
                </div>
              </div>
            )}

            {/* Import Result Summary */}
            {importResult && (
              <div className="p-3.5 rounded-xl bg-canvas-card border border-border space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-charcoal">
                  {importResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-sage" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span>{importResult.success ? 'Restore Complete' : 'Restore Finished with Warnings'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-charcoal-muted">
                  <div className="p-2 rounded-lg bg-canvas-subtle">
                    <span className="font-semibold text-charcoal block text-sm">
                      {importResult.importedSongs}
                    </span>
                    <span>Songs Restored</span>
                  </div>
                  <div className="p-2 rounded-lg bg-canvas-subtle">
                    <span className="font-semibold text-charcoal block text-sm">
                      {importResult.importedPrograms}
                    </span>
                    <span>Programs Restored</span>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="pt-2 text-[11px] text-red-600 space-y-1">
                    <span className="font-semibold block">Notes &amp; Warnings:</span>
                    {importResult.errors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 font-semibold text-xs"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Restoring Repertoire...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select Backup Archive (.zip / .json)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
