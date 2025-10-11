import React from 'react';
import { LegalPageView } from '@/components/LegalPageView';

export default function PrivacyScreen() {
  return (
    <LegalPageView
      title="Privacy Policy"
      htmlPath="/legal-pages/privacy.html"
    />
  );
}
