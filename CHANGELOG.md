# Changelog

All notable changes to Launcher Bar are documented here.
Versions follow [Semantic Versioning](https://semver.org/): MAJOR.MINOR.PATCH.

## [1.1.0] - 2026-07-09

### Fixed
- Changing the config path in applet settings now moves the file monitor to
  the new location; previously edits to the new file were not detected until
  Cinnamon restarted
- File monitor now uses `WATCH_MOVES`, so editors that save atomically
  (write-temp-then-rename) reliably trigger a reload
- Horizontal (top/bottom) panels are now laid out correctly; previously the
  bar was always vertical regardless of panel orientation
- The `.launcherbar-applet` style class is now actually applied to the
  applet, so the container rules in `stylesheet.css` take effect

### Added
- Desktop notification when a launcher fails to start, instead of failing
  silently
- Desktop-file items without an explicit `name` now use the application's
  own name as the tooltip

### Changed
- Replaced deprecated `box.add()` calls with `add_child()`

## [1.0.0] - Initial release

- Vertical launcher bar for Cinnamon panels
- JSON configuration with automatic reload on save
- Desktop applications, custom executables, and Wine applications with
  per-item environment variables
- Dividers, custom icons, compact mode
