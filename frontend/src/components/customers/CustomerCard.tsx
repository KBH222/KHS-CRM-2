/**
 * CustomerCard Component
 * 
 * Displays a customer card with their information and associated jobs.
 * Features:
 * - Click to navigate to customer details
 * - Quick action buttons (Email, Call, Text)
 * - Clickable address (opens in maps)
 * - Jobs list with edit/delete functionality
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer, Job } from '../../types';

interface CustomerCardProps {
  customer: Customer;
  jobs: Job[];
  onEditJob: (customer: Customer, job: Job) => void;
  onDeleteJob: (jobId: string) => void;
  onAddJob: (customer: Customer) => void;
}

// Reference color mapping
const REFERENCE_COLORS: Record<string, string> = {
  'HOD': '#10B981',
  'Yelp': '#F59E0B',
  'default': '#3B82F6'
};

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  jobs,
  onEditJob,
  onDeleteJob,
  onAddJob
}) => {
  const navigate = useNavigate();

  const handleEmailClick = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:${email}`;
  };

  const handlePhoneClick = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const phoneNumber = phone.replace(/\D/g, '');
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleAddressClick = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const formatAddress = (address: string) => {
    const parts = address.split(', ');
    if (parts.length >= 3) {
      const street = parts[0];
      const cityStateZip = parts.slice(1).join(', ');
      return { street, cityStateZip };
    }
    return { street: address, cityStateZip: null };
  };

  const { street, cityStateZip } = formatAddress(customer.address);

  return (
    <div
      onClick={() => navigate(`/customers/${customer.id}`)}
      style={{
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        border: '1px solid #E5E7EB'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          {/* Name and Reference */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '18.4px', fontWeight: '600' }}>{customer.name}</h3>
            {customer.reference && (
              <span style={{
                padding: '2px 8px',
                backgroundColor: REFERENCE_COLORS[customer.reference] || REFERENCE_COLORS.default,
                color: 'white',
                borderRadius: '12px',
                fontSize: '11.5px',
                fontWeight: '500'
              }}>
                {customer.reference}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <button
              onClick={(e) => handleEmailClick(customer.email, e)}
              title="Email customer"
              style={{ 
                background: 'none',
                border: '1px solid #3B82F6',
                color: '#3B82F6',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '13.8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ✉️ Email
            </button>
            <button
              onClick={(e) => handlePhoneClick(customer.phone, e)}
              title="Call customer"
              style={{ 
                background: 'none',
                border: '1px solid #3B82F6',
                color: '#3B82F6',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '13.8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              📞 Call
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `sms:${customer.phone.replace(/\D/g, '')}`;
              }}
              title="Text customer"
              style={{ 
                background: 'none',
                border: '1px solid #3B82F6',
                color: '#3B82F6',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '13.8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              💬 Text
            </button>
          </div>

          {/* Address */}
          <button
            onClick={(e) => handleAddressClick(customer.address, e)}
            style={{ 
              background: 'none',
              border: 'none',
              color: '#6B7280',
              textDecoration: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              font: 'inherit',
              fontSize: '12.65px',
              display: 'block',
              lineHeight: '1.3',
              textAlign: 'left',
              marginBottom: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#3B82F6';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#6B7280';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            <div>{street}</div>
            {cityStateZip && <div>{cityStateZip}</div>}
          </button>

          {/* Notes */}
          {customer.notes && (
            <p style={{ 
              fontSize: '12.65px', 
              color: '#9CA3AF',
              fontStyle: 'italic',
              margin: '0',
              lineHeight: '1.3',
              paddingTop: '4px'
            }}>
              {customer.notes}
            </p>
          )}
          
          {/* Jobs List */}
          {jobs.length > 0 && (
            <div style={{ 
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #E5E7EB'
            }}>
              <p style={{ 
                fontSize: '13.8px', 
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Jobs ({jobs.length}):
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditJob(customer, job);
                      }}
                      style={{
                        width: '140px',
                        background: 'none',
                        border: '1px solid #D1D5DB',
                        color: '#374151',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '12.65px',
                        textAlign: 'left',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F3F4F6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {job.title}
                    </button>
                    
                    {/* Photo count */}
                    {job.photos && job.photos.length > 0 && (
                      <span style={{
                        fontSize: '11.5px',
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        📸 {job.photos.length}
                      </span>
                    )}
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete the job "${job.title}"?`)) {
                          onDeleteJob(job.id);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#DC2626',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Delete job"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Job button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddJob(customer);
          }}
          style={{
            backgroundColor: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13.8px',
            fontWeight: '500',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Add Job
        </button>
      </div>
    </div>
  );
};