/**
 * CustomerSkeleton Component
 * 
 * Loading skeleton for customer cards to improve perceived performance.
 */

import React from 'react';

interface CustomerSkeletonProps {
  count?: number;
}

const SkeletonPulse: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({ 
  width = '100%', 
  height = '20px', 
  style 
}) => (
  <div
    style={{
      width,
      height,
      backgroundColor: '#E5E7EB',
      borderRadius: '4px',
      animation: 'pulse 1.5s ease-in-out infinite',
      ...style
    }}
  />
);

export const CustomerSkeleton: React.FC<CustomerSkeletonProps> = ({ count = 1 }) => {
  // Add CSS animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ flex: 1 }}>
              {/* Name and reference */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <SkeletonPulse width="200px" height="24px" />
                <SkeletonPulse width="60px" height="20px" style={{ borderRadius: '12px' }} />
              </div>
              
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <SkeletonPulse width="80px" height="32px" style={{ borderRadius: '4px' }} />
                <SkeletonPulse width="80px" height="32px" style={{ borderRadius: '4px' }} />
                <SkeletonPulse width="80px" height="32px" style={{ borderRadius: '4px' }} />
              </div>
              
              {/* Address */}
              <SkeletonPulse width="300px" height="16px" style={{ marginBottom: '4px' }} />
              <SkeletonPulse width="250px" height="16px" style={{ marginBottom: '8px' }} />
              
              {/* Notes */}
              <SkeletonPulse width="400px" height="14px" />
              
              {/* Jobs section */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #E5E7EB' }}>
                <SkeletonPulse width="100px" height="16px" style={{ marginBottom: '8px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <SkeletonPulse width="150px" height="28px" style={{ borderRadius: '4px' }} />
                </div>
              </div>
            </div>
            
            {/* Add Job button */}
            <SkeletonPulse width="90px" height="40px" style={{ borderRadius: '6px' }} />
          </div>
        </div>
      ))}
    </>
  );
};