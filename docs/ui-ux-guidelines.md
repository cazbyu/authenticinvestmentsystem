# UI & UX Guidelines

## Toolbar Edit Icon for Custom Timelines

An edit icon appears in the application's toolbar. Selecting this icon opens the `ManageCustomTimelinesModal`.

### Purpose
- Allows users to create, edit, or remove custom timelines.
- Serves as a maintenance entry point for timeline data.

### Accessibility
- The edit icon is always available in the toolbar regardless of the current state of timeline data. This ensures that even when no timelines exist or existing data cannot be loaded, users can still open the `ManageCustomTimelinesModal`.

### Recovery from Malformed Timelines
- When timeline data becomes malformed or corrupted, users can access the `ManageCustomTimelinesModal` through the toolbar edit icon to correct or delete problematic entries. This provides a reliable recovery path without relying on the timeline view itself.

