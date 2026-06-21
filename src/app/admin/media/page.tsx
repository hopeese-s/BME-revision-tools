'use client';

import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Image,
  Upload,
  Trash2,
  Copy,
  CheckCircle2,
  Link,
  Search,
  FileImage,
} from 'lucide-react';
import { initDb } from '@/lib/db';
import type { UUID, MediaAsset } from '@/types/schema';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminMediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<UUID | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------------------------------------------------
  // Load
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const db = await initDb();
      setAssets(await db.mediaAssets.toArray());
      setIsLoading(false);
    }
    load();
  }, []);

  // -----------------------------------------------------------------------
  // Toast
  // -----------------------------------------------------------------------
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------
  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showToast('Only image and video files supported');
      return;
    }

    const db = await initDb();
    const id = uuidv4() as UUID;

    // Read file as base64 data URL
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const asset: MediaAsset = {
        id,
        filename: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        data_url: dataUrl,
        tags: [],
        module_id: null,
        uploaded_at: new Date().toISOString(),
        _sync_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      await db.mediaAssets.put(asset);
      setAssets(await db.mediaAssets.toArray());
      showToast(`Uploaded "${file.name}" ✓`);
    };

    reader.onerror = () => {
      showToast('Failed to read file');
    };

    reader.readAsDataURL(file);
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------
  async function deleteAsset(id: UUID) {
    if (!confirm('Delete this media asset? This cannot be undone.')) return;
    const db = await initDb();
    await db.mediaAssets.delete(id);
    setAssets(await db.mediaAssets.toArray());
    showToast('Media deleted');
  }

  // -----------------------------------------------------------------------
  // Copy data URL
  // -----------------------------------------------------------------------
  function copyDataUrl(asset: MediaAsset) {
    navigator.clipboard.writeText(asset.data_url).then(() => {
      setCopiedId(asset.id);
      showToast('Data URL copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  // -----------------------------------------------------------------------
  // Drag & Drop
  // -----------------------------------------------------------------------
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------
  const filtered = searchQuery
    ? assets.filter(a => a.filename.toLowerCase().includes(searchQuery.toLowerCase()) || a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
    : assets;

  const images = filtered.filter(a => a.mime_type.startsWith('image/'));
  const videos = filtered.filter(a => a.mime_type.startsWith('video/'));
  const totalBytes = assets.reduce((sum, a) => sum + a.file_size_bytes, 0);
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // -----------------------------------------------------------------------
  // Styles
  // -----------------------------------------------------------------------
  const labelStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ink-faint)',
    marginBottom: 4,
    display: 'block',
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-8" style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12" style={{ backgroundColor: 'var(--cream-dark)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 text-sm font-semibold animate-in slide-in-from-top-2"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            backgroundColor: 'var(--ink)',
            color: 'var(--cream)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink)' }}
        >
          Media Library
        </h1>
        <p
          className="text-sm"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink-muted)' }}
        >
          Upload and manage images and videos for image occlusion, scenario illustrations, and signal content.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { icon: FileImage, label: 'Total', value: `${assets.length}` },
          { icon: Image, label: 'Images', value: `${images.length}` },
          { icon: Link, label: 'Videos', value: `${videos.length}` },
          { icon: Upload, label: 'Size', value: formatBytes(totalBytes) },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            style={{ padding: '1rem', backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.08)' }}
          >
            <Icon size={16} strokeWidth={2} style={{ color: 'var(--ink-faint)', marginBottom: 4 }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: "'Fraunces', Georgia, serif" }}>
              {value}
            </div>
            <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--ink-faint)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '3rem',
          marginBottom: '2rem',
          textAlign: 'center',
          transition: 'all 0.2s',
          border: `2px dashed ${isDragging ? 'var(--amber)' : 'rgba(26, 19, 9, 0.15)'}`,
          backgroundColor: isDragging ? 'rgba(196, 90, 27, 0.04)' : '#FDFBF7',
          cursor: 'pointer',
        }}
      >
        <Upload size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px', color: isDragging ? 'var(--amber)' : 'var(--ink-faint)' }} />
        <p
          className="text-sm font-semibold mb-1"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", color: isDragging ? 'var(--amber)' : 'var(--ink-muted)' }}
        >
          {isDragging ? 'Drop files here' : 'Drag & drop images or videos here'}
        </p>
        <p
          className="text-xs"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink-faint)' }}
        >
          or click to browse — PNG, JPEG, WebP (max 10 MB per file)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
          multiple
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <Search
          size={16}
          strokeWidth={1.5}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }}
        />
        <input
          type="text"
          placeholder="Search by filename..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            fontFamily: "'Inter', system-ui, sans-serif",
            border: '1px solid rgba(26, 19, 9, 0.15)',
            backgroundColor: '#FDFBF7',
            padding: '8px 12px 8px 40px',
            fontSize: '0.8125rem',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
        />
      </div>

      {/* Gallery */}
      {filtered.length === 0 ? (
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: '#FDFBF7',
            border: '1px solid rgba(26, 19, 9, 0.06)',
            color: 'var(--ink-faint)',
          }}
        >
          <Image size={40} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p className="text-sm" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {searchQuery ? 'No matching files. Try a different search.' : 'No media uploaded yet. Drag & drop files above.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {filtered.map(asset => (
            <div
              key={asset.id}
              className="group overflow-hidden transition-all duration-200"
              style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.08)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.08)'; }}
            >
              {/* Thumbnail */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', backgroundColor: 'var(--cream-dark)', overflow: 'hidden' }}>
                {asset.mime_type.startsWith('image/') ? (
                  <img
                    src={asset.data_url}
                    alt={asset.filename}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Link size={28} strokeWidth={1} style={{ color: 'var(--ink-faint)', opacity: 0.3 }} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div
                  className="text-xs font-semibold mb-1 truncate"
                  style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink)' }}
                  title={asset.filename}
                >
                  {asset.filename}
                </div>
                <div
                  style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', color: 'var(--ink-faint)' }}
                >
                  {asset.mime_type} · {formatBytes(asset.file_size_bytes)}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => copyDataUrl(asset)}
                    className="imp-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      border: '1px solid',
                      backgroundColor: copiedId === asset.id ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                      color: copiedId === asset.id ? '#059669' : 'var(--ink-muted)',
                      borderColor: copiedId === asset.id ? 'rgba(5, 150, 105, 0.2)' : 'rgba(26, 19, 9, 0.15)',
                      flex: 1,
                    }}
                  >
                    {copiedId === asset.id ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2.5} />}
                    {copiedId === asset.id ? 'Copied' : 'Copy URL'}
                  </button>
                  <button
                    onClick={() => deleteAsset(asset.id)}
                    className="imp-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      border: '1px solid',
                      flex: 1,
                      backgroundColor: 'transparent',
                      color: '#dc2626',
                      borderColor: 'rgba(220, 38, 38, 0.2)',
                    }}
                  >
                    <Trash2 size={12} strokeWidth={2.5} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}