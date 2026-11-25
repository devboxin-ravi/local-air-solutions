/**
 * Image picker with a large preview and drag & drop — UI only. The parent uploads the chosen file
 * and passes back the URL.
 */

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { IMAGE_UPLOAD } from '@/constants/ui';
import { cn } from '@/lib/utils';

export interface ImageUploadProps {
  /** Absolute URL of the current image, if any. */
  previewUrl?: string;
  uploading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
  /** Called when the picked file fails the type/size check. */
  onReject?: (message: string) => void;
}

const MAX_MB = Math.round(IMAGE_UPLOAD.MAX_BYTES / 1048576);

export function ImageUpload({ previewUrl, uploading, disabled, invalid, onSelect, onClear, onReject }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = disabled || uploading;

  const pick = (file?: File) => {
    if (!file) return;
    if (!(IMAGE_UPLOAD.MIME_TYPES as readonly string[]).includes(file.type)) return onReject?.('Only JPG, PNG or WebP images are allowed');
    if (file.size > IMAGE_UPLOAD.MAX_BYTES) return onReject?.(`Image must be under ${MAX_MB} MB`);
    onSelect(file);
  };
  const browse = () => !busy && input.current?.click();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div
        role="button"
        tabIndex={0}
        aria-label={previewUrl ? 'Change image' : 'Upload image'}
        onClick={browse}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && browse()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) pick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'group relative flex aspect-[16/10] w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors sm:w-64',
          previewUrl ? 'border-transparent bg-slate-100' : 'bg-slate-50 hover:border-brand-blue-200 hover:bg-brand-blue-50/40',
          dragging && 'border-brand-blue bg-brand-blue-50',
          invalid && 'border-destructive',
          busy && 'cursor-not-allowed',
        )}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Service" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-slate-900/40 group-hover:opacity-100">
              <RefreshCw className="mr-1.5 h-4 w-4" /> Replace
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center px-4 text-center text-muted-foreground">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-blue shadow-sm ring-1 ring-slate-200">
              <ImagePlus className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-brand-navy">{dragging ? 'Drop to upload' : 'Click or drag a photo here'}</span>
            <span className="mt-0.5 text-xs">JPG, PNG or WebP · up to {MAX_MB} MB</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <p className="font-medium text-brand-navy">{previewUrl ? 'Photo added' : 'No photo yet'}</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          Use a clear landscape photo (about 1200 × 750). It appears on the service card in the customer app; without one the app shows its built-in photo.
        </p>
        {previewUrl && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={browse}>
              <RefreshCw /> Replace
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClear} className="text-destructive hover:bg-red-50">
              <Trash2 /> Remove
            </Button>
          </div>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={IMAGE_UPLOAD.ACCEPT}
        className="hidden"
        onChange={(ev) => {
          pick(ev.target.files?.[0]);
          ev.target.value = '';
        }}
      />
    </div>
  );
}
