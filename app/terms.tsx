import React from 'react';
import { LegalPageView } from '@/components/LegalPageView';

export default function TermsScreen() {
  return (
    <LegalPageView
      title="Terms of Service"
      htmlPath="/legal-pages/terms.html"
    />
  );
}
