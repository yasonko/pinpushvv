export const readmeMd = `
# Pinterest Assistant Extension (Manifest V3 - Clipboard-Only Edition)

A 100% Policy-Safe, compliant companion extension for Pinterest creators.

### 📋 Clipboard-Only Architecture
- 🛡️ **Zero DOM Manipulation**: The extension NEVER automatically pastes, injects, types, or modifies Pinterest webpage fields.
- 📋 **Individual Copy Controls**:
  - **Copy Title**: Copies only the generated title to your clipboard with visual confirmation (\`✓ Copied\`).
  - **Copy Description**: Copies only the generated description.
  - **Copy Destination URL**: Copies only the target link.
  - **Copy Alt Text**: Copies only the SEO accessibility alt text.
  - **Copy Tags**: Copies generated tags (supports comma-separated or #hashtag format).
- ⚡ **Prominent "COPY ALL" Button**: Copies all Pinterest metadata in the exact required order:
  1. Title
  2. Description
  3. Destination URL
  4. Alt SEO Text
  5. Tags
- 👁️ **Persistent Metadata Display**: All fields remain visible, formatted, and editable in real-time within the extension UI.
- ⚡ **Queue Navigation**: Step through batches of generated pins with \`[◀ Prev]\` and \`[Next ▶]\` or \`[📋 Copy All & Next Pin ▶]\`.
- 📷 **Image Preview & Quick Download**: View the thumbnail and download high-resolution pin images with 1 click.

### 📥 Installation Instructions
1. Extract the downloaded \`copy-to-pinterest-assistant-extension.zip\` into a folder.
2. Open Google Chrome (or Brave / Edge / Arc) and navigate to \`chrome://extensions\`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. Open Pinterest Pin Builder (\`https://www.pinterest.com/pin-builder/\`).
6. Click any **Copy** button in the assistant and press **Ctrl+V** (or **Cmd+V**) into the respective field!
`.trim();
