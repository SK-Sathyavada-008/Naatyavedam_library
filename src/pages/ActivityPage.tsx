import React, { useState } from 'react';
import {
  History,
  Upload,
  Edit3,
  Trash2,
  RotateCcw,
  RefreshCw,
  ArrowLeft,
  Play,
  Calendar,
  User,
} from 'lucide-react';
import type { ActivityLogEntry, Song, AppView } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { formatDate } from '../utils';

export interface ActivityPageProps {
  activityLogs: ActivityLogEntry[];
  librarySongs: Song[];
  onPlaySong?: (song: Song) => void;
  onNavigate: (view: AppView) => void;
  onRefreshLogs?: () => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({
  activityLogs,
  librarySongs,
  onPlaySong,
  onNavigate,
  onRefreshLogs,
}) => {
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshLogs) return;
    setIsRefreshing(true);
    try {
      await onRefreshLogs();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Filter logs
  const filteredLogs = activityLogs.filter((log) => {
    if (filterAction === 'ALL') return true;
    return log.action === filterAction;
  });

  const getActionDetails = (action: ActivityLogEntry['action']) => {
    switch (action) {
      case 'UPLOAD':
        return {
          label: 'Added Song',
          color: 'sage' as const,
          icon: <Upload className="w-3.5 h-3.5" />,
          bgColor: 'bg-sage-light text-sage',
        };
      case 'RENAME':
        return {
          label: 'Renamed',
          color: 'neutral' as const,
          icon: <Edit3 className="w-3.5 h-3.5" />,
          bgColor: 'bg-blue-50 text-blue-700',
        };
      case 'DELETE':
        return {
          label: 'Moved to Bin',
          color: 'warning' as const,
          icon: <Trash2 className="w-3.5 h-3.5" />,
          bgColor: 'bg-amber-50 text-amber-700',
        };
      case 'RESTORE':
        return {
          label: 'Restored',
          color: 'sage' as const,
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          bgColor: 'bg-sage-light text-sage',
        };
      default:
        return {
          label: action,
          color: 'neutral' as const,
          icon: <History className="w-3.5 h-3.5" />,
          bgColor: 'bg-canvas-subtle text-charcoal',
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 w-full space-y-5 animate-in fade-in duration-200">
      {/* Header with Back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('settings')}
            className="h-8 w-8 p-0 rounded-full flex items-center justify-center text-charcoal-muted hover:text-charcoal"
            title="Back to Settings"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-charcoal">
              Library Activity
            </h2>
            <p className="text-xs text-charcoal-muted">
              Recent repertoire changes, uploads, and edits
            </p>
          </div>
        </div>

        {onRefreshLogs && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs flex items-center gap-1.5 h-8 px-2.5"
            title="Refresh Activity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Refresh</span>
          </Button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: 'ALL', label: 'All Activity' },
          { id: 'UPLOAD', label: 'Uploads' },
          { id: 'RENAME', label: 'Renames' },
          { id: 'DELETE', label: 'Deletions' },
          { id: 'RESTORE', label: 'Restores' },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setFilterAction(chip.id)}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${
              filterAction === chip.id
                ? 'bg-sage text-canvas shadow-subtle'
                : 'bg-canvas-card border border-border text-charcoal-muted hover:text-charcoal'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline List */}
      {filteredLogs.length === 0 ? (
        <Card className="text-center py-12 px-4 space-y-3 border-dashed">
          <div className="w-12 h-12 rounded-2xl bg-canvas-subtle text-charcoal-muted flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-charcoal">No Activity Recorded</h4>
            <p className="text-xs text-charcoal-muted mt-1 max-w-sm mx-auto">
              {filterAction === 'ALL'
                ? 'When songs are uploaded, renamed, or restored, a chronological timeline of updates will appear here.'
                : `No activity found for "${filterAction.toLowerCase()}".`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const details = getActionDetails(log.action);
            const activeSong = librarySongs.find((s) => s.id === log.songId && !s.isDeleted);

            return (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-canvas-card border border-border/80 shadow-subtle hover:border-border transition-all flex items-start justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${details.bgColor}`}
                  >
                    {details.icon}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-charcoal truncate">
                        {log.songTitle || 'Classical Dance Track'}
                      </h4>
                      <Badge variant={details.color} size="sm">
                        {details.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-charcoal-muted">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-charcoal-muted" />
                        <span>@{log.performedBy || 'member'}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-charcoal-muted" />
                        <span>{formatDate(log.timestamp)}</span>
                      </span>
                    </div>

                    {log.details && (
                      <p className="text-[11px] text-charcoal-muted pt-0.5 italic">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Play if song is currently available */}
                {activeSong && onPlaySong && (
                  <Button
                    variant="sage-subtle"
                    size="sm"
                    onClick={() => onPlaySong(activeSong)}
                    className="h-8 w-8 p-0 rounded-full flex items-center justify-center flex-shrink-0"
                    title={`Play ${activeSong.title}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
