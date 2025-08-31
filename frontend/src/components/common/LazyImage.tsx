/**
 * LazyImage Component
 * 
 * Image component with lazy loading, error handling, and loading states.
 * Uses Intersection Observer for efficient lazy loading.
 */

import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
  threshold?: number;
  rootMargin?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Cpath d="M50 30c5.5 0 10 4.5 10 10s-4.5 10-10 10-10-4.5-10-10 4.5-10 10-10zm0 25c-11 0-20 9-20 20v5h40v-5c0-11-9-20-20-20z" fill="%23d1d5db"/%3E%3C/svg%3E';

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = PLACEHOLDER_IMAGE,
  className,
  style,
  onClick,
  loading = 'lazy',
  threshold = 0.1,
  rootMargin = '50px',
  onLoad,
  onError
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [imageLoading, setImageLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement) return;

    // For native lazy loading support
    if ('loading' in HTMLImageElement.prototype && loading === 'lazy') {
      setImageSrc(src);
      return;
    }

    // Intersection Observer for browsers without native lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(imageElement);

    return () => {
      if (observerRef.current && imageElement) {
        observerRef.current.unobserve(imageElement);
      }
    };
  }, [src, loading, threshold, rootMargin]);

  const handleLoad = () => {
    setImageLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setImageLoading(false);
    setHasError(true);
    setImageSrc(placeholder);
    onError?.();
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
        ...style
      }}
      className={className}
    >
      {imageLoading && !hasError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}
        >
          <div 
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
        </div>
      )}
      
      <img
        ref={imageRef}
        src={imageSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          cursor: onClick ? 'pointer' : 'default',
          opacity: imageLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
      
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '12px'
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🖼️</div>
          <div>Failed to load</div>
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};