# Legal Pages for Authentic Intelligence Labs

This directory contains the Privacy Policy and Terms of Service pages for the Authentic Intelligence Labs mobile application.

## Files

- **privacy.html** - Privacy Policy page (GDPR and CCPA compliant)
- **terms.html** - Terms of Service page
- **README.md** - This file with deployment instructions

## Deployment Instructions

### 1. Legal Review (REQUIRED)

**⚠️ CRITICAL: Before deploying these pages, you MUST have them reviewed by a qualified legal professional.**

These documents are template starting points and need to be:
- Reviewed for compliance with all applicable laws in your jurisdiction
- Customized for your specific business practices
- Updated with accurate contact information and company details
- Verified to match your actual data handling procedures

### 2. Hosting Options

#### Option A: Upload to Your Website

If you have a website at `authenticintelligencelabs.com`:

1. Upload `privacy.html` to your web server
2. Configure your server to serve it at: `https://www.authenticintelligencelabs.com/privacy`
3. Upload `terms.html` to your web server
4. Configure your server to serve it at: `https://www.authenticintelligencelabs.com/terms`

**Example for Apache (.htaccess):**
```apache
RewriteEngine On
RewriteRule ^privacy$ /legal-pages/privacy.html [L]
RewriteRule ^terms$ /legal-pages/terms.html [L]
```

**Example for Nginx:**
```nginx
location = /privacy {
    alias /path/to/legal-pages/privacy.html;
}
location = /terms {
    alias /path/to/legal-pages/terms.html;
}
```

#### Option B: Add to React/Next.js Website

If your website uses React or Next.js:

1. Convert HTML to React components
2. Add routes for `/privacy` and `/terms`
3. Import the content into your pages

#### Option C: Use Static Site Hosting

Deploy to services like:
- **Netlify**: Drag and drop the legal-pages folder
- **Vercel**: Connect your repository and deploy
- **GitHub Pages**: Push to a gh-pages branch
- **AWS S3 + CloudFront**: Upload files and configure routing

### 3. Update Email Addresses

Before deployment, update the placeholder email addresses in both files:

- `privacy@authenticintelligencelabs.com` - for privacy inquiries
- `legal@authenticintelligencelabs.com` - for legal inquiries

Make sure these email addresses are:
- Active and monitored regularly
- Set up with proper forwarding to responsible parties
- Configured to respond within 30 days (required by GDPR/CCPA)

### 4. Link from Mobile App

Once deployed, add links to these pages in your mobile app:

#### In your Settings screen (app/settings.tsx):

```typescript
import * as WebBrowser from 'expo-web-browser';

// Add these functions
const openPrivacyPolicy = async () => {
  await WebBrowser.openBrowserAsync('https://www.authenticintelligencelabs.com/privacy');
};

const openTermsOfService = async () => {
  await WebBrowser.openBrowserAsync('https://www.authenticintelligencelabs.com/terms');
};

// Add these TouchableOpacity items in your settings UI
<TouchableOpacity onPress={openPrivacyPolicy}>
  <Text>Privacy Policy</Text>
</TouchableOpacity>

<TouchableOpacity onPress={openTermsOfService}>
  <Text>Terms of Service</Text>
</TouchableOpacity>
```

#### In your Login/Signup screen (app/login.tsx):

Add text like:
```typescript
<Text style={styles.legalText}>
  By signing up, you agree to our{' '}
  <Text style={styles.link} onPress={openTermsOfService}>
    Terms of Service
  </Text>
  {' '}and{' '}
  <Text style={styles.link} onPress={openPrivacyPolicy}>
    Privacy Policy
  </Text>
</Text>
```

### 5. App Store Requirements

Both Apple App Store and Google Play Store require privacy policies:

#### Apple App Store
- Add privacy policy URL in App Store Connect
- Include link in app (usually in Settings)
- Must be accessible without creating an account

#### Google Play Store
- Add privacy policy URL in Google Play Console
- Required before publishing
- Must be publicly accessible

### 6. Update Schedule

These documents should be reviewed and updated:
- **Annually** at minimum
- **Immediately** when data practices change
- **Whenever** you add new features that collect data
- **If** laws change in your jurisdiction or user locations

When you update:
1. Change the "Last Updated" date
2. Notify users of material changes (via email or in-app notification)
3. Keep archived copies of previous versions

### 7. Compliance Checklist

Before going live, verify:

- [ ] Legal review completed by qualified attorney
- [ ] Company information is accurate (name, address)
- [ ] Email addresses are set up and monitored
- [ ] Pages are accessible at the correct URLs
- [ ] Links work from the mobile app
- [ ] Privacy policy URL added to App Store Connect
- [ ] Privacy policy URL added to Google Play Console
- [ ] Supabase provider settings updated with correct redirect URLs
- [ ] User notification system ready for future updates
- [ ] Backup copies stored securely

### 8. Important Notes

#### Data Collection Accuracy
The privacy policy reflects the current data practices identified in the app code:
- User profiles (name, email, profile picture)
- Goals, tasks, and progress data
- Wellness and relationship tracking
- Journal entries and reflections
- Photos uploaded by users
- Device and usage information

**If you add new data collection features, you MUST update the privacy policy.**

#### Third-Party Services Listed
- Google OAuth (authentication)
- Supabase (backend and database)
- AWS (infrastructure via Supabase)

**If you integrate analytics, advertising, or other services, you MUST update both documents.**

#### Jurisdiction
The terms specify Utah law and jurisdiction. Verify this is appropriate for your business structure and user base.

## Technical Details

### File Specifications
- **Format**: Standalone HTML5
- **Styling**: Inline CSS (no external dependencies)
- **Responsive**: Mobile-friendly design
- **Accessibility**: Semantic HTML with proper heading hierarchy
- **Print-friendly**: Includes print-specific styles

### Browser Compatibility
These pages work in all modern browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contact Information

For questions about these legal documents:

**Salt City Digital Design**
1428 E Granada Dr
Sandy, Utah 84093
United States

**Email**:
- Privacy inquiries: privacy@authenticintelligencelabs.com
- Legal inquiries: legal@authenticintelligencelabs.com

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 10, 2025 | Initial creation |

---

**Disclaimer**: These documents are provided as templates and do not constitute legal advice. Consult with a qualified attorney before using them in production.
