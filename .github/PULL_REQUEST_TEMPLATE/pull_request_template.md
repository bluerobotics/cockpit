<!-- Thank you for contributing to Cockpit!

This template helps us to understand, review, and document changes.
Not all sections will be relevant, so please delete sections you know
are not impacted by this pull request, or leave them as-is if you're
not sure what to include. -->

## New Features
<!-- Which new features does this pull request introduce?
Please list new widgets, functionalities, or interface elements, with a description
of what is included, why it is helpful/necessary (including Issues it resolves),
sources of relevant ideas (including discussions and inspiration), and ideas for
future expansion (if you have them).

example:
| Name | Description | Purpose | Sources | Future |
|---|---|---|---|---|
| ... | ... | Fixes #124 | Discussed in [this forum post](...) | Could be expanded to include ... |
-->
| Name | Description | Purpose | Sources | Future |
|---|---|---|---|---|

## Modified Features
<!-- Which existing features have you changed / impacted?
Describe changed items in nested bullets.
Unchanged items/sub-sections can be deleted.

example:
- Joystick mapping
  - Fixes incorrect button numbering for Xbox Series X controller
-->
### Setup
- Users
- Profiles
- Mission planning
- Joystick mapping
- Autopilot connection (MAVLink)
- Video connection
- View layout / edit mode
- Widgets
- Data lake
- Actions

### Vehicle usage
- View switching
- Flight modes
- Mission execution
- Core telemetry information
- Vehicle safety
- Video stream switching
- Joystick stability
- Connection stability
- MAVLink message monitoring
- Vehicle integrity

### Post usage analysis
- Application logs
- Video recordings
- Telemetry subtitle recordings

## Tests Required to Merge (by dev and/or testers)
<!-- delete a sub-section if there were no such changes -->
### Text/display changes
- [ ] Open Cockpit
- [ ] Confirm the change displays as expected
  <!-- include screenshots/recordings if possible -->
- [ ] Test multiple screen sizes
  - [ ] Steam deck
  - [ ] 1080p laptop screen

### Functionality changes
- [ ] Connect to the vehicle
  - [ ] Connect a joystick, and confirm at least one button and one axis works
- [ ] Confirm existing widgets load as expected
- [ ] Check that memory usage seems bounded
- [ ] Test critical vehicle functions
  - [ ] Arm and disarm
  - [ ] Switch flight modes
- [ ] Switch users without unexpected errors
