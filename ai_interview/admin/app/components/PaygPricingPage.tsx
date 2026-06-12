'use client';
import React from 'react';
import { Zap } from 'lucide-react';
import { AdminPaygPricing } from './AdminPaygPricing';

export default function PaygPricingPage() {
  return (
    <div className="payg-page-shell">
      {/* Header */}
      <div className="payg-page-head animate-fadeIn">
        <h1 className="payg-page-title">
          <span className="payg-page-title-icon" aria-hidden="true">
            <Zap size={20} style={{ color: '#6c63ff' }} />
          </span>
          Pay-as-You-Go Pricing
        </h1>
        <p className="payg-page-subtitle">
          Manage per-unit costs and budget constraints for current and new users
        </p>
      </div>

      <div className="animate-fadeIn" style={{ animationDelay: '100ms' }}>
        <AdminPaygPricing />
      </div>
    </div>
  );
}
