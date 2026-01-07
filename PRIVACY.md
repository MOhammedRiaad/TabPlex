# Privacy Policy for TabBoard

**Last Updated**: January 2026

## Overview

TabBoard is committed to protecting your privacy. This privacy policy explains how TabBoard handles your data.

## Data Collection

**TabBoard collects NO personal data and transmits NO data to external servers.**

### What Data is Stored Locally

TabBoard stores the following data **exclusively on your local device**:

1. **Tab Information**
    - URLs of tabs you organize
    - Tab titles
    - Favicons (website icons)
    - Tab metadata (creation time, last accessed)

2. **Tasks**
    - Task titles and descriptions
    - Due dates and priority levels
    - Completion status
    - Checklists and sub-items
    - Associated tab references

3. **Notes**
    - Note content (text/markdown)
    - Creation and modification timestamps
    - Associated board/folder/tab references

4. **Browsing Sessions**
    - Session start and end times
    - Associated tab IDs
    - Session summaries (if provided by you)

5. **Browser History** (Optional)
    - History items you explicitly choose to import
    - Visit timestamps and counts
    - Only stored if you use the "Load Recent History" feature

6. **Canvas Drawings**
    - Drawing elements (shapes, text, paths)
    - Canvas metadata and settings

7. **User Preferences**
    - Theme selection (light/dark/system)
    - Timer settings (work/break durations)
    - UI preferences

## Data Storage Location

All data is stored using:

- **IndexedDB**: Browser's local database (for structured data)
- **chrome.storage.local**: Chrome's local storage API (for settings and sync)

**Important**: This data never leaves your device. There are no servers, no cloud storage, and no data transmission.

## Chrome Permissions Explained

TabBoard requests the following permissions to function:

### Required Permissions

1. **`tabs`**
    - **Purpose**: Read tab URLs and titles to organize them
    - **Usage**: Only when you explicitly add tabs to boards
    - **Data Access**: Tab URL, title, favicon

2. **`tabGroups`**
    - **Purpose**: Integration with Chrome's native tab groups
    - **Usage**: Optional feature for advanced tab organization

3. **`storage`**
    - **Purpose**: Save your boards, tasks, notes, and settings
    - **Usage**: All data stored locally in your browser
    - **Data Access**: Everything you create in TabBoard

4. **`history`**
    - **Purpose**: Allow you to import browser history
    - **Usage**: Only when you click "Load Recent History"
    - **Data Access**: Browser history (only when requested)

5. **`notifications`**
    - **Purpose**: Send task reminders and timer alerts
    - **Usage**: When tasks are due or timer completes
    - **Data Access**: Task titles for notification display

6. **`<all_urls>` (Host Permissions)**
    - **Purpose**: Capture favicons from any website
    - **Usage**: Display website icons in tab cards
    - **Data Access**: Favicon URLs only

### How Permissions Are Used

- **No Background Tracking**: TabBoard does not monitor your browsing
- **Explicit Actions Only**: Data is only captured when you explicitly add tabs or import history
- **No Analytics**: We do not track how you use the extension
- **No Telemetry**: No usage statistics are collected

## Data Sharing

**TabBoard does NOT share any data with third parties.**

- ❌ No data sent to external servers
- ❌ No analytics or tracking services
- ❌ No advertising networks
- ❌ No data brokers
- ❌ No cloud synchronization
- ✅ 100% local, 100% private

## Data Security

### Local Security

- Data stored using browser's secure storage APIs
- Protected by your browser's security model
- Encrypted at rest (browser-level encryption)

### No Network Transmission

- Zero network requests for data storage
- No API calls to external services
- No data uploaded or downloaded

## Your Data Rights

### Full Control

- **Access**: View all your data within the extension
- **Export**: Download all data as JSON file
- **Delete**: Remove all data by uninstalling the extension
- **Modify**: Edit or delete individual items anytime

### Data Portability

- Export feature creates a complete JSON backup
- Import feature restores data from backup
- No vendor lock-in - your data is yours

### Data Deletion

To completely remove all TabBoard data:

1. **Option 1**: Uninstall the extension from Chrome
2. **Option 2**: Clear browser data for the extension
3. **Option 3**: Use Chrome's "Clear browsing data" for site data

## Children's Privacy

TabBoard does not knowingly collect data from children under 13. Since we collect no personal data and all data is stored locally, the extension is safe for all ages when used appropriately.

## Changes to Privacy Policy

We may update this privacy policy to reflect:

- Changes in Chrome extension requirements
- New features that affect data handling
- User feedback and clarifications

**Notification of Changes**:

- Major changes will be communicated via extension update notes
- Privacy policy version and date updated at the top
- Continued use after updates constitutes acceptance

## Contact Information

For privacy-related questions or concerns:

- **GitHub Issues**: [Repository URL]
- **Email**: [Contact Email]

## Compliance

### GDPR Compliance (EU Users)

- **Data Minimization**: We collect only what's necessary (locally)
- **Right to Access**: Export feature provides full data access
- **Right to Erasure**: Uninstall removes all data
- **Data Portability**: JSON export enables data transfer
- **No Data Processing**: No personal data sent to processors

### CCPA Compliance (California Users)

- **No Sale of Data**: We do not sell personal information
- **No Sharing**: We do not share personal information
- **Right to Know**: All data visible within extension
- **Right to Delete**: Uninstall removes all data

### Chrome Web Store Policies

TabBoard complies with:

- Chrome Web Store Developer Program Policies
- User Data Privacy requirements
- Limited Use disclosure requirements

## Technical Details

### Data Storage Specifications

- **IndexedDB**: Structured data (boards, tabs, tasks, notes)
- **chrome.storage.local**: Settings and preferences
- **Storage Limits**:
    - IndexedDB: Browser-dependent (typically 50-100MB+)
    - chrome.storage.local: 10MB limit

### No External Dependencies

- No third-party SDKs for analytics
- No advertising frameworks
- No crash reporting services
- No A/B testing platforms

## Transparency Commitment

TabBoard is committed to transparency:

- **Open Source**: Code available for review
- **No Hidden Features**: All functionality documented
- **Clear Permissions**: Explicit explanation of why each permission is needed
- **User Control**: You decide what data to create and store

---

**Summary**: TabBoard is a privacy-first extension. All your data stays on your device. We never collect, transmit, or share your personal information.

**Questions?** We're happy to clarify any privacy concerns. Please reach out through our GitHub repository.
