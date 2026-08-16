import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSchema } from './schemas/form-schema.schema';
import { UpdateFormSchemaDtoType } from './form-schemas.dto';

const CHECKLIST_OPTS = ['Pending', 'Received', 'Not Required'];
const DONE_PENDING   = ['Pending', 'Done'];

const DEFAULT_NEW_CASE: any = {
  formId: 'new-case',
  sections: [
    {
      id: 'customer-info',
      title: 'Customer Info',
      fields: [
        { key: 'firstName',         label: 'First Name / Full Name', type: 'text',    required: true,  placeholder: 'First name or full name', defaultValue: '', options: [], order: 1,  isCore: true, isActive: true },
        { key: 'lastName',          label: 'Last Name',              type: 'text',    required: true,  placeholder: 'Last name',              defaultValue: '', options: [], order: 2,  isCore: true, isActive: true },
        { key: 'fatherName',        label: "Father's Name",          type: 'text',    required: false, placeholder: "Father's name",          defaultValue: '', options: [], order: 3,  isCore: true, isActive: true },
        { key: 'contact',           label: 'Contact Number',         type: 'tel',     required: true,  placeholder: '+91 XXXXX XXXXX',        defaultValue: '', options: [], order: 4,  isCore: true, isActive: true },
        { key: 'altContact',        label: 'Alternate Contact',      type: 'tel',     required: false, placeholder: 'Optional',               defaultValue: '', options: [], order: 5,  isCore: true, isActive: true },
        { key: 'state',             label: 'State',                  type: 'select',  required: false, placeholder: '',                       defaultValue: '', options: [], order: 6,  isCore: true, isActive: true },
        { key: 'location',          label: 'City',                   type: 'select',  required: true,  placeholder: '',                       defaultValue: '', options: [], order: 7,  isCore: true, isActive: true },
        { key: 'residentialStatus', label: 'Residential Status',     type: 'select',  required: false, placeholder: '',                       defaultValue: 'Own', options: ['Own', 'Rented', 'Family Owned'], order: 8, isCore: true, isActive: true },
        { key: 'ebillOwner',        label: 'E-Bill Owner',           type: 'boolean', required: false, placeholder: '',                       defaultValue: 'Yes', options: [], order: 9, isCore: true, isActive: true },
      ],
    },
    {
      id: 'vehicle-loan',
      title: 'Vehicle & Loan',
      fields: [
        { key: 'product',        label: 'Product Type',        type: 'select',  required: true,  placeholder: '',                      defaultValue: '',    options: [], order: 1,  isCore: true, isActive: true },
        { key: 'loanType',       label: 'Loan Type',           type: 'select',  required: false, placeholder: '',                      defaultValue: 'New', options: ['New', 'Used', 'Refinance'], order: 2, isCore: true, isActive: true },
        { key: 'vehicleModel',   label: 'Vehicle Model',       type: 'text',    required: false, placeholder: 'e.g. Maruti Swift 2024', defaultValue: '',    options: [], order: 3, isCore: true, isActive: true },
        { key: 'regNumber',      label: 'Registration Number', type: 'text',    required: false, placeholder: 'e.g. MH02-AB-1234',     defaultValue: '',    options: [], order: 4, isCore: true, isActive: true },
        { key: 'ownerSerial',    label: 'Owner Serial',        type: 'select',  required: false, placeholder: '',                      defaultValue: '1st', options: ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th+'], order: 5, isCore: true, isActive: true },
        { key: 'existingInsurer',label: 'Existing Insurer',    type: 'text',    required: false, placeholder: 'Insurance company',     defaultValue: '',    options: [], order: 6, isCore: true, isActive: true },
        { key: 'hypothecation',  label: 'Hypothecation',       type: 'boolean', required: false, placeholder: '',                      defaultValue: 'Yes', options: [], order: 7, isCore: true, isActive: true },
        { key: 'nocRequired',    label: 'NOC Required',        type: 'boolean', required: false, placeholder: '',                      defaultValue: 'No',  options: [], order: 8, isCore: true, isActive: true },
        { key: 'challanCount',   label: 'Challan Count',       type: 'number',  required: false, placeholder: '',                      defaultValue: '0',   options: [], order: 9, isCore: true, isActive: true },
        { key: 'loanAmount',     label: 'Loan Amount (₹)',     type: 'number',  required: true,  placeholder: 'e.g. 850000',           defaultValue: '',    options: [], order: 10, isCore: true, isActive: true },
      ],
    },
    {
      id: 'bank-dealer',
      title: 'Bank & Dealer',
      fields: [
        { key: 'bank',      label: 'Bank / NBFC', type: 'select', required: true,  placeholder: '',                 defaultValue: '',  options: [], order: 1, isCore: true, isActive: true },
        { key: 'branch',    label: 'Branch',      type: 'text',   required: false, placeholder: 'Branch name',      defaultValue: '',  options: [], order: 2, isCore: true, isActive: true },
        { key: 'bmName',    label: 'BM Name',     type: 'text',   required: false, placeholder: 'Business Manager', defaultValue: '',  options: [], order: 3, isCore: true, isActive: true },
        { key: 'bmContact', label: 'BM Contact',  type: 'tel',    required: false, placeholder: '+91 XXXXX XXXXX',  defaultValue: '',  options: [], order: 4, isCore: true, isActive: true },
        { key: 'executive', label: 'Executive',   type: 'text',   required: false, placeholder: 'Executive name',   defaultValue: '',  options: [], order: 5, isCore: true, isActive: true },
        { key: 'dealer',    label: 'Dealer',      type: 'select', required: true,  placeholder: '',                 defaultValue: '',  options: [], order: 6, isCore: true, isActive: true },
        { key: 'payoutPct', label: 'Payout %',    type: 'number', required: false, placeholder: '',                 defaultValue: '1', options: [], order: 7, isCore: true, isActive: true },
      ],
    },
  ],
};

const DEFAULT_RTO: any = {
  formId: 'rto',
  sections: [
    {
      id: 'ownership',
      title: 'Ownership',
      fields: [
        { key: 'rtoOwnershipType', label: 'Ownership Type',   type: 'select',  required: false, placeholder: '', defaultValue: 'Banker',   options: ['Banker', 'Dealer', 'Sai Credit Solutions'], order: 1, isCore: true, isActive: true },
        { key: 'rtoOwnership',     label: 'RTO Ownership',    type: 'select',  required: false, placeholder: '', defaultValue: 'Pending',  options: CHECKLIST_OPTS, order: 2, isCore: true, isActive: true },
        { key: 'rtoReceiving',     label: 'RTO Receiving',    type: 'boolean', required: false, placeholder: '', defaultValue: 'No',       options: [], order: 3, isCore: true, isActive: true },
      ],
    },
    {
      id: 'document-checklist',
      title: 'Document Checklist',
      fields: [
        { key: 'challanCheck',   label: 'Challan Check',   type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: CHECKLIST_OPTS, order: 1, isCore: true, isActive: true },
        { key: 'bankNocCheck',   label: 'Bank NOC',        type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: CHECKLIST_OPTS, order: 2, isCore: true, isActive: true },
        { key: 'nocHoldAmt',     label: 'NOC Hold (₹)',    type: 'number', required: false, placeholder: '', defaultValue: '0',       options: [], order: 3, isCore: true, isActive: true },
        { key: 'insuranceCheck', label: 'Insurance Check', type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: CHECKLIST_OPTS, order: 4, isCore: true, isActive: true },
        { key: 'hypothecation',  label: 'Hypothecation',   type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: CHECKLIST_OPTS, order: 5, isCore: true, isActive: true },
        { key: 'aadhaarMatch',   label: 'Aadhaar Match',   type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: CHECKLIST_OPTS, order: 6, isCore: true, isActive: true },
        { key: 'aadhaarMismatchNote', label: 'Aadhaar Mismatch Note', type: 'text', required: false, placeholder: 'Optional note', defaultValue: '', options: [], order: 7, isCore: true, isActive: true },
        { key: 'pendingDocuments', label: 'Pending Documents', type: 'text', required: false, placeholder: 'RC, Form 35, Insurance...', defaultValue: '', options: [], order: 8, isCore: true, isActive: true },
        { key: 'balancePayment',   label: 'Balance Payment (₹)', type: 'number', required: false, placeholder: '', defaultValue: '0', options: [], order: 9, isCore: true, isActive: true },
      ],
    },
    {
      id: 'verification-approval',
      title: 'Verification & Approval',
      fields: [
        { key: 'verification',       label: 'Verification',          type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: DONE_PENDING, order: 1, isCore: true, isActive: true },
        { key: 'approval',           label: 'Approval',              type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: DONE_PENDING, order: 2, isCore: true, isActive: true },
        { key: 'approvalDate',       label: 'Approval Date',         type: 'date',   required: false, placeholder: '', defaultValue: '', options: [], order: 3, isCore: true, isActive: true },
        { key: 'insuranceEndorsement', label: 'Insurance Endorsement', type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: DONE_PENDING, order: 4, isCore: true, isActive: true },
        { key: 'remarks',            label: 'Remarks',               type: 'text',   required: false, placeholder: 'Optional remarks', defaultValue: '', options: [], order: 5, isCore: true, isActive: true },
      ],
    },
  ],
};

const DEFAULT_INSURANCE: any = {
  formId: 'insurance',
  sections: [
    {
      id: 'policy-info',
      title: 'Policy Info',
      fields: [
        { key: 'insurer',       label: 'Insurer',        type: 'select', required: true,  placeholder: '', defaultValue: '', options: [], order: 1, isCore: true, isActive: true },
        { key: 'coverageType',  label: 'Coverage Type',  type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Comprehensive', 'Third Party', 'Zero Dep', 'Fire & Theft'], order: 2, isCore: true, isActive: true },
        { key: 'vehicleType',   label: 'Vehicle Type',   type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Car', 'Two Wheeler', 'Truck', 'Commercial'], order: 3, isCore: true, isActive: true },
        { key: 'ownerType',     label: 'Owner Type',     type: 'select', required: false, placeholder: '', defaultValue: 'Bank', options: ['Bank', 'Sai Credit', 'Dealer'], order: 4, isCore: true, isActive: true },
        { key: 'policyId',      label: 'Link to Policy', type: 'select', required: false, placeholder: '', defaultValue: '', options: [], order: 5, isCore: true, isActive: true },
      ],
    },
    {
      id: 'details',
      title: 'Entry Details',
      fields: [
        { key: 'insuredName',   label: 'Insured Name',     type: 'text',   required: false, placeholder: 'Name of insured person', defaultValue: '', options: [], order: 1, isCore: true, isActive: true },
        { key: 'agentName',     label: 'Insurance Agent',  type: 'text',   required: false, placeholder: 'Agent name',            defaultValue: '', options: [], order: 2, isCore: true, isActive: true },
        { key: 'premiumAmount', label: 'Premium (₹)',      type: 'number', required: false, placeholder: '',                       defaultValue: '0', options: [], order: 3, isCore: true, isActive: true },
        { key: 'holdAmount',    label: 'Hold Amount (₹)',  type: 'number', required: false, placeholder: '',                       defaultValue: '0', options: [], order: 4, isCore: true, isActive: true },
        { key: 'customerName',  label: 'Customer Name',    type: 'text',   required: false, placeholder: 'Auto-filled from case',  defaultValue: '', options: [], order: 5, isCore: true, isActive: true },
        { key: 'vehicleModel',  label: 'Vehicle Model',    type: 'text',   required: false, placeholder: 'Model / Reg. No.',       defaultValue: '', options: [], order: 6, isCore: true, isActive: true },
        { key: 'startDate',     label: 'Start Date',       type: 'date',   required: true,  placeholder: '',                       defaultValue: '', options: [], order: 7, isCore: true, isActive: true },
        { key: 'endDate',       label: 'End Date',         type: 'date',   required: true,  placeholder: '',                       defaultValue: '', options: [], order: 8, isCore: true, isActive: true },
        { key: 'reminderDate',  label: 'Reminder Date',    type: 'date',   required: false, placeholder: '',                       defaultValue: '', options: [], order: 9, isCore: true, isActive: true },
        { key: 'renewal',       label: 'Tag for Renewal',  type: 'boolean',required: false, placeholder: '',                       defaultValue: 'No', options: [], order: 10, isCore: true, isActive: true },
      ],
    },
  ],
};

const DEFAULT_PAYOUT: any = {
  formId: 'payout',
  sections: [
    {
      id: 'invoice-details',
      title: 'Invoice Details',
      fields: [
        { key: 'businessMonth', label: 'Business Month',  type: 'text',   required: true,  placeholder: 'YYYY-MM',              defaultValue: '',       options: [], order: 1, isCore: true, isActive: true },
        { key: 'invoiceDate',   label: 'Invoice Date',    type: 'date',   required: false, placeholder: '',                     defaultValue: '',       options: [], order: 2, isCore: true, isActive: true },
        { key: 'company',       label: 'Company',         type: 'text',   required: false, placeholder: 'SAI Credit Solutions', defaultValue: 'SAI Credit Solutions', options: [], order: 3, isCore: true, isActive: true },
        { key: 'invoiceStatus', label: 'Invoice Status',  type: 'select', required: false, placeholder: '',                     defaultValue: 'Draft',  options: ['Draft', 'Submitted', 'Not Submitted'], order: 4, isCore: true, isActive: true },
        { key: 'invoiceNumber', label: 'Invoice Number',  type: 'text',   required: false, placeholder: 'e.g. SAI/2026-27/001', defaultValue: '',       options: [], order: 5, isCore: true, isActive: true },
        { key: 'invoiceAmount', label: 'Invoice Amount (₹)', type: 'number', required: false, placeholder: '0',                defaultValue: '0',      options: [], order: 6, isCore: true, isActive: true },
      ],
    },
    {
      id: 'commission-gst',
      title: 'Commission & GST',
      fields: [
        { key: 'commission',  label: 'Commission (₹)', type: 'number', required: false, placeholder: '0', defaultValue: '0', options: [], order: 1, isCore: true, isActive: true },
        { key: 'cgstAmount',  label: 'CGST (₹) @ 9%', type: 'number', required: false, placeholder: '0', defaultValue: '0', options: [], order: 2, isCore: true, isActive: true },
        { key: 'sgstAmount',  label: 'SGST (₹) @ 9%', type: 'number', required: false, placeholder: '0', defaultValue: '0', options: [], order: 3, isCore: true, isActive: true },
        { key: 'totalAmount', label: 'Total Amount (₹)', type: 'number', required: false, placeholder: '0', defaultValue: '0', options: [], order: 4, isCore: true, isActive: true },
      ],
    },
    {
      id: 'payout-info',
      title: 'Payout Info',
      fields: [
        { key: 'payoutStatus', label: 'Payout Status', type: 'select', required: false, placeholder: '', defaultValue: 'Pending', options: ['Pending', 'Received', 'Not Applicable'], order: 1, isCore: true, isActive: true },
        { key: 'payoutDate',   label: 'Payout Date',   type: 'date',   required: false, placeholder: '', defaultValue: '',        options: [], order: 2, isCore: true, isActive: true },
        { key: 'remarks',      label: 'Remarks',       type: 'text',   required: false, placeholder: 'Optional notes', defaultValue: '', options: [], order: 3, isCore: true, isActive: true },
      ],
    },
  ],
};

const DEFAULT_INSURANCE_LEAD: any = {
  formId: 'insurance-lead',
  sections: [
    {
      id: 'contact-info',
      title: 'Contact Information',
      fields: [
        { key: 'firstName',        label: 'First Name',          type: 'text',    required: true,  placeholder: 'First name',              defaultValue: '', options: [], order: 1,  isCore: true, isActive: true },
        { key: 'lastName',         label: 'Last Name',           type: 'text',    required: true,  placeholder: 'Last name',               defaultValue: '', options: [], order: 2,  isCore: true, isActive: true },
        { key: 'contact',          label: 'Primary Contact',     type: 'tel',     required: true,  placeholder: '+91 XXXXX XXXXX',         defaultValue: '', options: [], order: 3,  isCore: true, isActive: true },
        { key: 'altContact',       label: 'Alternate Contact',   type: 'tel',     required: false, placeholder: 'Optional',                defaultValue: '', options: [], order: 4,  isCore: false, isActive: true },
        { key: 'location',         label: 'Area / Town',         type: 'text',    required: false, placeholder: 'Area / Town',             defaultValue: '', options: [], order: 5,  isCore: false, isActive: true },
        { key: 'state',            label: 'State',               type: 'select',  required: false, placeholder: '',                        defaultValue: '', options: [], order: 6,  isCore: false, isActive: true },
      ],
    },
    {
      id: 'vehicle-insurance',
      title: 'Vehicle & Insurance',
      fields: [
        { key: 'vehicleType',      label: 'Vehicle Type',        type: 'select',  required: false, placeholder: '', defaultValue: '', options: ['Car', 'Truck', 'Two Wheeler', 'Commercial', 'Other'], order: 1,  isCore: false, isActive: true },
        { key: 'vehicleModel',     label: 'Vehicle Model',       type: 'text',    required: false, placeholder: 'e.g. Swift Dzire',        defaultValue: '', options: [], order: 2,  isCore: false, isActive: true },
        { key: 'regNumber',        label: 'Registration Number', type: 'text',    required: false, placeholder: 'PB-XX-XXXX',             defaultValue: '', options: [], order: 3,  isCore: false, isActive: true },
        { key: 'vehicleYear',      label: 'Vehicle Year',        type: 'number',  required: false, placeholder: 'e.g. 2020',              defaultValue: '', options: [], order: 4,  isCore: false, isActive: true },
        { key: 'existingInsurer',  label: 'Existing Insurer',    type: 'text',    required: false, placeholder: 'Current insurance company', defaultValue: '', options: [], order: 5, isCore: false, isActive: true },
        { key: 'policyExpiryDate', label: 'Policy Expiry Date',  type: 'date',    required: false, placeholder: '',                        defaultValue: '', options: [], order: 6,  isCore: false, isActive: true },
      ],
    },
    {
      id: 'lead-details',
      title: 'Lead Details',
      fields: [
        { key: 'status',           label: 'Status',              type: 'select',  required: true,  placeholder: '', defaultValue: 'new', options: ['new', 'contacted', 'interested', 'converted', 'lost'], order: 1, isCore: true,  isActive: true },
        { key: 'source',           label: 'Source',              type: 'select',  required: false, placeholder: '', defaultValue: 'other', options: ['walk_in', 'referral', 'campaign', 'online', 'other'], order: 2, isCore: false, isActive: true },
        { key: 'followUpDate',     label: 'Follow-up Date',      type: 'date',    required: false, placeholder: '',                        defaultValue: '', options: [], order: 3,  isCore: false, isActive: true },
        { key: 'assignedTo',       label: 'Assigned To',         type: 'select',  required: false, placeholder: '',                        defaultValue: '', options: [], order: 4,  isCore: false, isActive: true },
        { key: 'remarks',          label: 'Remarks',             type: 'text',    required: false, placeholder: 'Notes, call summary…',    defaultValue: '', options: [], order: 5,  isCore: false, isActive: true },
      ],
    },
  ],
};

// ── Per-product extra fields (isCore:false — land in LoanCase.customFields) ──
// Car Loan / Commercial Vehicle Loan keep using the existing hardcoded vehicle
// fields above; these 5 are the genuinely new, non-vehicle products.

const DEFAULT_PRODUCT_PL: any = {
  formId: 'product-fields:pl',
  sections: [{
    id: 'personal-loan-details', title: 'Personal Loan Details',
    fields: [
      { key: 'purpose',        label: 'Loan Purpose',            type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Medical', 'Travel', 'Wedding', 'Education', 'Debt Consolidation', 'Home Renovation', 'Other'], order: 1, isCore: false, isActive: true },
      { key: 'employmentType', label: 'Employment Type',         type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Salaried', 'Self-Employed', 'Business Owner', 'Professional'], order: 2, isCore: false, isActive: true },
      { key: 'monthlyIncome',  label: 'Monthly Income (₹)',      type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 3, isCore: false, isActive: true },
      { key: 'companyName',    label: 'Company / Employer Name', type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 4, isCore: false, isActive: true },
    ],
  }],
};

const DEFAULT_PRODUCT_BL: any = {
  formId: 'product-fields:bl',
  sections: [{
    id: 'business-details', title: 'Business Details',
    fields: [
      { key: 'businessName',         label: 'Business Name',            type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 1, isCore: false, isActive: true },
      { key: 'businessType',         label: 'Business Type',            type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Proprietorship', 'Partnership', 'Pvt Ltd', 'LLP', 'Other'], order: 2, isCore: false, isActive: true },
      { key: 'annualTurnover',       label: 'Annual Turnover (₹)',      type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 3, isCore: false, isActive: true },
      { key: 'businessVintageYears', label: 'Business Vintage (Years)', type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 4, isCore: false, isActive: true },
      { key: 'gstNumber',            label: 'GST Number',               type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 5, isCore: false, isActive: true },
    ],
  }],
};

const DEFAULT_PRODUCT_HL: any = {
  formId: 'product-fields:hl',
  sections: [{
    id: 'property-details', title: 'Property Details',
    fields: [
      { key: 'propertyAddress',   label: 'Property Address',   type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 1, isCore: false, isActive: true },
      { key: 'propertyType',      label: 'Property Type',      type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Apartment', 'Independent House', 'Plot + Construction', 'Under Construction'], order: 2, isCore: false, isActive: true },
      { key: 'propertyValue',     label: 'Property Value (₹)', type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 3, isCore: false, isActive: true },
      { key: 'constructionStage', label: 'Construction Stage', type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Ready to Move', 'Under Construction', 'Resale'], order: 4, isCore: false, isActive: true },
    ],
  }],
};

const DEFAULT_PRODUCT_LAP: any = {
  formId: 'product-fields:lap',
  sections: [{
    id: 'property-details', title: 'Property Details',
    fields: [
      { key: 'propertyAddress',         label: 'Property Address',              type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 1, isCore: false, isActive: true },
      { key: 'propertyType',            label: 'Property Type',                 type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Residential', 'Commercial', 'Industrial'], order: 2, isCore: false, isActive: true },
      { key: 'propertyValue',           label: 'Property Value (₹)',            type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 3, isCore: false, isActive: true },
      { key: 'loanToValuePct',          label: 'Loan-to-Value (%)',             type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 4, isCore: false, isActive: true },
      { key: 'existingLoanOutstanding', label: 'Existing Loan Outstanding (₹)', type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 5, isCore: false, isActive: true },
    ],
  }],
};

const DEFAULT_PRODUCT_EL: any = {
  formId: 'product-fields:el',
  sections: [{
    id: 'education-details', title: 'Education Details',
    fields: [
      { key: 'institutionName',     label: 'Institution Name',        type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 1, isCore: false, isActive: true },
      { key: 'courseName',          label: 'Course Name',             type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 2, isCore: false, isActive: true },
      { key: 'courseDurationYears', label: 'Course Duration (Years)', type: 'number', required: false, placeholder: '', defaultValue: '', options: [], order: 3, isCore: false, isActive: true },
      { key: 'coApplicantName',     label: 'Co-Applicant Name',       type: 'text',   required: false, placeholder: '', defaultValue: '', options: [], order: 4, isCore: false, isActive: true },
      { key: 'coApplicantRelation', label: 'Co-Applicant Relation',   type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Father', 'Mother', 'Guardian', 'Spouse', 'Other'], order: 5, isCore: false, isActive: true },
      { key: 'admissionStatus',     label: 'Admission Status',        type: 'select', required: false, placeholder: '', defaultValue: '', options: ['Confirmed', 'Provisional', 'Awaiting'], order: 6, isCore: false, isActive: true },
    ],
  }],
};

// Car Loan / CVL already have their 8 vehicle fields hardcoded in the app (not
// managed here); seed one empty section so admins can still add extra fields
// on top via Form Builder (which can't create new sections, only fields within one).
const DEFAULT_PRODUCT_EMPTY_SECTION = (formId: string) => ({
  formId,
  sections: [{ id: 'extra-details', title: 'Extra Details', fields: [] }],
});

const DEFAULTS: Record<string, any> = {
  'new-case':       DEFAULT_NEW_CASE,
  'rto':            DEFAULT_RTO,
  'insurance':      DEFAULT_INSURANCE,
  'payout':         DEFAULT_PAYOUT,
  'insurance-lead': DEFAULT_INSURANCE_LEAD,
  'product-fields:car': DEFAULT_PRODUCT_EMPTY_SECTION('product-fields:car'),
  'product-fields:cvl': DEFAULT_PRODUCT_EMPTY_SECTION('product-fields:cvl'),
  'product-fields:pl':  DEFAULT_PRODUCT_PL,
  'product-fields:bl':  DEFAULT_PRODUCT_BL,
  'product-fields:hl':  DEFAULT_PRODUCT_HL,
  'product-fields:lap': DEFAULT_PRODUCT_LAP,
  'product-fields:el':  DEFAULT_PRODUCT_EL,
};

@Injectable()
export class FormSchemasService {
  constructor(@InjectModel(FormSchema.name) private readonly model: Model<FormSchema>) {}

  async list(): Promise<FormSchema[]> {
    const existing = await this.model.find().lean().exec();
    const existingIds = new Set(existing.map((d: any) => d.formId));
    for (const formId of Object.keys(DEFAULTS)) {
      if (!existingIds.has(formId)) {
        await this.model.create(DEFAULTS[formId]);
      }
    }
    return this.model.find().lean().exec() as unknown as FormSchema[];
  }

  async getOrCreate(formId: string): Promise<FormSchema> {
    let doc = await this.model.findOne({ formId }).lean().exec();
    if (!doc) {
      const seed = DEFAULTS[formId] ?? { formId, sections: [] };
      doc = await this.model.create(seed);
    }
    return doc as unknown as FormSchema;
  }

  async update(formId: string, dto: UpdateFormSchemaDtoType): Promise<FormSchema> {
    const doc = await this.model.findOneAndUpdate(
      { formId },
      { $set: { sections: dto.sections } },
      { new: true, upsert: true },
    ).lean().exec();
    return doc as unknown as FormSchema;
  }
}
