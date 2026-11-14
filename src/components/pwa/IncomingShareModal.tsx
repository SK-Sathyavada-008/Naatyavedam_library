import React, { useState } from 'react';
import { Music2, Check, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { DanceCategory } from '../../types';
import { deriveDisplayTitle, guessDanceCategory, isSupportedAudioFile } from '../../services/audioImporter';

export interface IncomingShareItem {
  id: string;
  blob: Blob | File;
  name: string;
  type: string;
  size: number;
}

export interface IncomingShareModalProps {
  isOpen: boolean;
  items: IncomingShareItem[];
  onConfirmImport: (itemsWithMetadata: { file: Blob | File; title: string; category: DanceCategory }[]) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES: DanceCategory[] = [
  'Pushpanjali',
  'Jatiswaram',
  'Shabdam',
  'Varnam',
  'Keerthanam',
  'Tarangam',
  'Thillana',
  'Slokam',
  'Practice / Talam',
  'Other',
];

export const IncomingShareModal: React.FC<IncomingShareModalProps> = ({
  isOpen,
  items,
  onConfirmImport,
  onCancel,
}) => {
  // State for editable titles and categories
  const [editedMetadata, setEditedMetadata] = useState<
    Record<string, { title: string; category: DanceCategory }>
  >(() => {
    const initial: Record<string, { title: string; category: DanceCategory }> = {};
    for (const item of items) {
      const derived = deriveDisplayTitle(item.name);
      initial[item.id] = {
        title: derived,
        category: guessDanceCategory(derived),
      };
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update metadata when items change
  React.useEffect(() => {
    const updated: Record<string, { title: string; category: DanceCategory }> = {};
    for (const item of items) {
      const derived = deriveDisplayTitle(item.name);
      updated[item.id] = {
        title: derived,
        category: guessDanceCategory(derived),
      };
    }
    setEditedMetadata(updated);
  }, [items]);

  const handleTitleChange = (id: string, title: string) => {
    setEditedMetadata((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        title,
      },
    }));
  };

  const handleCategoryChange = (id: string, category: DanceCategory) => {
    setEditedMetadata((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        category,
      },
    }));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const prepared = items.map((item) => ({
        file: item.blob,
        title: editedMetadata[item.id]?.title || deriveDisplayTitle(item.name),
        category: editedMetadata[item.id]?.category || 'Other',
      }));
      await onConfirmImport(prepared);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || items.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Shared Music Received"
      description={`Received ${items.length} audio file${items.length === 1 ? '' : 's'} via Android Share`}
    >
      <div className="space-y-4 py-2">
        <p className="text-xs text-charcoal-muted leading-relaxed">
          Verify the composition title and dance category before saving to your repertoire.
        </p>

        <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
          {items.map((item) => {
            const meta = editedMetadata[item.id] || {
              title: deriveDisplayTitle(item.name),
              category: 'Other',
            };
            const valid = isSupportedAudioFile(
              item.blob instanceof File ? item.blob : new File([item.blob], item.name, { type: item.type })
            );

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-border bg-canvas-card space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sage-light text-sage flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-charcoal truncate block">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-charcoal-muted">
                        {(item.size / 1024 / 1024).toFixed(2)} MB • {item.type || 'audio file'}
                      </span>
                    </div>
                  </div>
                  {valid.supported ? (
                    <Badge variant="sage" size="sm">Valid Audio</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">Warning</Badge>
                  )}
                </div>

                {!valid.supported && (
                  <div className="text-[11px] text-red-600 flex items-center gap-1 bg-red-50 p-1.5 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{valid.reason}</span>
                  </div>
                )}

                {/* Title Input */}
                <div>
                  <label className="text-[11px] font-semibold text-charcoal-muted block mb-1">
                    Composition Title
                  </label>
                  <Input
                    value={meta.title}
                    onChange={(e) => handleTitleChange(item.id, e.target.value)}
                    placeholder="e.g. Kalyani Jatiswaram"
                    className="text-xs py-1.5"
                  />
                </div>

                {/* Dance Category Select */}
                <div>
                  <label className="text-[11px] font-semibold text-charcoal-muted block mb-1">
                    Kuchipudi Category
                  </label>
                  <select
                    value={meta.category}
                    onChange={(e) => handleCategoryChange(item.id, e.target.value as DanceCategory)}
                    className="w-full text-xs bg-canvas border border-border text-charcoal rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sage"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Discard
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Importing...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save to Repertoire</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
