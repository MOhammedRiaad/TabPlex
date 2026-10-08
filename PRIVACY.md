# Privacy Policy for TabPlex

**Last Updated**: October 2026

## Overview

TabPlex is committed to protecting your privacy. This privacy policy explains how TabPlex handles your data.

## Data Collection

**TabPlex collects NO personal data and transmits NO data to external servers.**

### What Data is Stored Locally

TabPlex stores the following data **exclusively on your local device**:

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
    - Park & Resume contexts: the titles, addresses and icons of the tabs saved with a task, your "where I left off" note, an optional on-device summary, and a short history of when the task was started, parked and resumed (used for the local analytics)

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
    - Your name for the Today greeting, only if you type one in Settings → Profile (TabPlex does not read your Google account or email)

## Data Storage Location

All data is stored using:

- **IndexedDB**: Browser's local database (for structured data)
- **chrome.storage.local**: Chrome's local storage API (for settings and sync)

**Important**: This data never leaves your device. There are no servers, no cloud storage, and no data transmission.

## Chrome Permissions Explained

TabPlex requests the following permissions to function:

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
    - **Data Access**: Everything you create in TabPlex

4. **`history`**
    - **Purpose**: Allow you to import browser history
    - **Usage**: Only when you click "Load Recent History"
    - **Data Access**: Browser history (only when requested)

5. **`notifications`**
    - **Purpose**: Send task reminders and timer alerts, and (if you turn it on) suggest a parked task for a page you open
    - **Usage**: When tasks are due or timer completes; for suggestions, when a page you open is on the same site as a parked task's tabs
    - **Data Access**: Task titles and the page title for notification display. Suggestions compare the page's site with your parked tasks' saved tabs on your device; nothing is sent anywhere

6. **`sessions`**
    - **Purpose**: Restore recently closed tabs and windows
    - **Usage**: Used in the "Sessions" view to show recent browsing history
    - **Data Access**: Recently closed tab URLs and titles

7. **`bookmarks`**
    - **Purpose**: Manage and organize your browser bookmarks
    - **Usage**: View, search, and organize bookmarks within the Bookmarks Manager
    - **Data Access**: Read and write access to your browser bookmarks

8. **`favicon`**
    - **Purpose**: Show website icons for tabs, bookmarks and quick links
    - **Usage**: Icons come from Chrome's own local favicon cache (`chrome-extension://…/_favicon/`)
    - **Data Access**: None leaves your device; no third-party icon service is contacted

**No website access**: TabPlex requests no host permissions. It cannot read or change the content of the web pages you visit; it only sees tab titles and addresses through the `tabs` permission.

### How Permissions Are Used

- **No Background Tracking**: TabPlex does not monitor your browsing
- **Explicit Actions Only**: Data is only captured when you explicitly add tabs or import history
- **No Analytics**: We do not track how you use the extension
- **No Telemetry**: No usage statistics are collected

## Data Sharing

**TabPlex does NOT share any data with third parties.**

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

### On-device AI summaries (optional, off by default)

If you turn on **On-device AI summaries** in Settings, TabPlex uses Chrome's built-in Summarizer API to write a one-line summary when you park a task. The model (Gemini Nano) runs inside Chrome on your computer:

- The input is the task title and description, your note, and the titles and addresses (host and path only, without query strings) of the parked tabs
- Nothing is sent to TabPlex, Google or any other server by this feature
- Chrome downloads the model once, directly from Google, the first time you turn the setting on; that download is managed by Chrome and contains none of your data
- The summary is stored locally with the task and can be removed by parking again or deleting the task

### On-device AI features (optional)

"Organize tabs", "New task from tabs", session names and the note helpers can use Chrome's built-in AI model (Gemini Nano), which runs on your computer:

- TabPlex sends it the titles and addresses (host and path only, without query strings) of the tabs you choose, and any hint you type
- The note helpers (✨ AI in the note editor) send it the text of the note you're editing, only when you pick a helper
- The model's answer stays in your browser, and nothing changes until you confirm it
- No tab or note data is sent to TabPlex, Google or any other server by these features
- Without the model (another browser, or a device that can't run it) the features use simple local rules instead
- Turn them off in Settings → On-device AI

## Your Data Rights

### Full Control

- **Access**: View all your data within the extension
- **Export**: Download all data as JSON file
- **Delete**: Remove all data by uninstalling the extension
- **Modify**: Edit or delete individual items anytime

### Data Portability

- Export feature creates a JSON backup of your boards, tabs, tasks, notes, sessions, history, canvases and settings (the optional tldraw canvas is not included yet)
- Import feature restores data from backup
- No vendor lock-in - your data is yours

### Data Deletion

To completely remove all TabPlex data:

1. **Option 1**: Uninstall the extension from Chrome
2. **Option 2**: Clear browser data for the extension
3. **Option 3**: Use Chrome's "Clear browsing data" for site data

## Children's Privacy

TabPlex does not knowingly collect data from children under 13. Since we collect no personal data and all data is stored locally, the extension is safe for all ages when used appropriately.

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

TabPlex complies with:

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

TabPlex is committed to transparency:

- **Source available**: The code is public on GitHub for review (proprietary licence, see LICENSE)
- **No Hidden Features**: All functionality documented
- **Clear Permissions**: Explicit explanation of why each permission is needed
- **User Control**: You decide what data to create and store

---

**Summary**: TabPlex is a privacy-first extension. All your data stays on your device. We never collect, transmit, or share your personal information.

**Questions?** We're happy to clarify any privacy concerns. Please reach out through our GitHub repository.
