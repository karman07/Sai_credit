'use client';
import React, { useState, useEffect } from 'react';
import {
  Zap, Save, RefreshCw, CheckCircle2, AlertCircle,
  BarChart2, FileText, DollarSign, Settings,
} from 'lucide-react';
import { subscriptionsApi } from '../lib/api';

interface PaygConfig {
  id: string;
  country: string;
  status: string;
  pricePerInterviewRupees: number;
  pricePerResumeRupees: number;
  minBudgetRupees: number;
  maxBudgetRupees: number;
}

const COUNTRIES = [
  { code: 'IN', label: 'India (INR ₹)', symbol: '₹' },
  { code: 'US', label: 'Global (USD $)', symbol: '$' },
];

const DEFAULTS_BY_COUNTRY = {
  IN: {
    pricePerInterviewRupees: 49,
    pricePerResumeRupees: 29,
    minBudgetRupees: 99,
    maxBudgetRupees: 5000,
  },
  US: {
    pricePerInterviewRupees: 0.99,
    pricePerResumeRupees: 0.49,
    minBudgetRupees: 1.99,
    maxBudgetRupees: 99.99,
  },
} as const;

export function AdminPaygPricing() {
  const [country, setCountry]         = useState('IN');
  const [config, setConfig]           = useState<PaygConfig | null>(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Local form state
  const [interviewPrice, setInterviewPrice] = useState('');
  const [resumePrice, setResumePrice]       = useState('');
  const [minBudget, setMinBudget]           = useState('');
  const [maxBudget, setMaxBudget]           = useState('');

  const symbol = COUNTRIES.find(c => c.code === country)?.symbol ?? '₹';

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await subscriptionsApi.getPaygConfig(country);
      setConfig(data);
      if (data) {
        setInterviewPrice(String(data.pricePerInterviewRupees));
        setResumePrice(String(data.pricePerResumeRupees));
        setMinBudget(String(data.minBudgetRupees));
        setMaxBudget(String(data.maxBudgetRupees));
      } else {
        const defaults = DEFAULTS_BY_COUNTRY[country as keyof typeof DEFAULTS_BY_COUNTRY] ?? DEFAULTS_BY_COUNTRY.IN;
        setInterviewPrice(String(defaults.pricePerInterviewRupees));
        setResumePrice(String(defaults.pricePerResumeRupees));
        setMinBudget(String(defaults.minBudgetRupees));
        setMaxBudget(String(defaults.maxBudgetRupees));
      }
    } catch (e: any) {
      setError(e.message || 'Could not load PAYG config.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, [country]);

  const handleSave = async () => {
    const interview = parseFloat(interviewPrice);
    const resume = parseFloat(resumePrice);
    const min = parseFloat(minBudget);
    const max = parseFloat(maxBudget);

    if ([interview, resume, min, max].some(v => Number.isNaN(v) || v < 0)) {
      setError('Please enter valid non-negative values for all PAYG fields.');
      return;
    }

    if (min > max) {
      setError('Minimum monthly budget cannot be greater than maximum monthly budget.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await subscriptionsApi.updatePaygConfig({
        country,
        pricePerInterviewRupees: interview,
        pricePerResumeRupees:    resume,
        minBudgetRupees:         min,
        maxBudgetRupees:         max,
      });
      setSuccess(true);
      await loadConfig();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save PAYG config.');
    } finally {
      setSaving(false);
    }
  };

  const interviewsForMin   = minBudget    ? Math.floor(parseFloat(minBudget)    / parseFloat(interviewPrice || '1')) : 0;
  const resumesForMin      = minBudget    ? Math.floor(parseFloat(minBudget)    / parseFloat(resumePrice || '1')) : 0;
  const interviewsForMax   = maxBudget    ? Math.floor(parseFloat(maxBudget)    / parseFloat(interviewPrice || '1')) : 0;
  const resumesForMax      = maxBudget    ? Math.floor(parseFloat(maxBudget)    / parseFloat(resumePrice || '1')) : 0;

  return (
    <section className="payg-card glass-card">
      <header className="payg-card-header">
        <div className="payg-title-wrap">
          <span className="payg-title-icon" aria-hidden="true">
            <Zap className="w-4 h-4 text-white" />
          </span>
          <div>
            <h3 className="payg-title">Pay-as-You-Go Pricing</h3>
            <p className="payg-subtitle">Set per-unit prices users are charged on the PAYG plan</p>
          </div>
        </div>

        <div className="payg-header-actions">
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="payg-select"
            aria-label="Select country"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>

          <button
            onClick={loadConfig}
            disabled={loading}
            className="payg-refresh-btn"
            aria-label="Refresh PAYG config"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="payg-card-body">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        ) : (
          <>
            <div className="payg-grid">
              {[
                {
                  icon: <BarChart2 className="w-4 h-4" />,
                  label: 'Price per Interview',
                  hint: 'Charged each time a user starts a mock interview',
                  value: interviewPrice,
                  setter: setInterviewPrice,
                  id: 'payg-interview-price',
                },
                {
                  icon: <FileText className="w-4 h-4" />,
                  label: 'Price per Resume Scan',
                  hint: 'Charged each time a user runs a full resume analysis',
                  value: resumePrice,
                  setter: setResumePrice,
                  id: 'payg-resume-price',
                },
                {
                  icon: <DollarSign className="w-4 h-4" />,
                  label: 'Minimum Monthly Budget',
                  hint: 'Lowest amount a user can commit per month',
                  value: minBudget,
                  setter: setMinBudget,
                  id: 'payg-min-budget',
                },
                {
                  icon: <Settings className="w-4 h-4" />,
                  label: 'Maximum Monthly Budget',
                  hint: 'Highest amount a user can commit per month',
                  value: maxBudget,
                  setter: setMaxBudget,
                  id: 'payg-max-budget',
                },
              ].map(item => (
                <div key={item.id} className="payg-input-card">
                  <label htmlFor={item.id} className="payg-field-label">
                    <span className="payg-field-icon">{item.icon}</span>
                    {item.label}
                  </label>
                  <div className="payg-input-wrap">
                    <span className="payg-currency" aria-hidden="true">
                      {symbol}
                    </span>
                    <input
                      id={item.id}
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.value}
                      onChange={e => item.setter(e.target.value)}
                      className="payg-input"
                    />
                  </div>
                  <p className="payg-field-hint">{item.hint}</p>
                </div>
              ))}
            </div>

            {interviewPrice && resumePrice && minBudget && maxBudget && (
              <section className="payg-preview">
                <p className="payg-preview-kicker">What Users See</p>
                <div className="payg-preview-grid">
                  <div className="payg-preview-col">
                    <p className="payg-preview-heading">At min budget ({symbol}{minBudget}/mo):</p>
                    <p>Up to <strong>{interviewsForMin}</strong> interviews</p>
                    <p>Up to <strong>{resumesForMin}</strong> resumes</p>
                  </div>
                  <div className="payg-preview-col">
                    <p className="payg-preview-heading">At max budget ({symbol}{maxBudget}/mo):</p>
                    <p>Up to <strong>{interviewsForMax}</strong> interviews</p>
                    <p>Up to <strong>{resumesForMax}</strong> resumes</p>
                  </div>
                </div>
              </section>
            )}

            {error && (
              <div className="payg-error-banner">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <footer className="payg-footer">
              <button
                onClick={handleSave}
                disabled={saving}
                className="payg-save-btn"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : success ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                ) : (
                  <><Save className="w-4 h-4" /> Save PAYG Pricing</>
                )}
              </button>
              <p className="payg-footer-note">
                Changes take effect for all new users.
              </p>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}
