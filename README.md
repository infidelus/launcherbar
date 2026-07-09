# Launcher Bar (Cinnamon Applet)

Launcher Bar is a lightweight launcher applet for the Cinnamon desktop.
It is configured via a simple JSON file and reloads automatically when the file is saved.

Launcher Bar is inspired by Command Launcher, with a focus on simple, file-based configuration, and has been tested on Linux Mint 22.

---

## Features

- Launcher bar for any Cinnamon panel, vertical or horizontal
- Supports:
  - Desktop applications
  - Custom executables
  - Wine applications (with environment variables)
- Optional dividers for grouping launchers
- Automatic reload on configuration changes
- Desktop notification if a launcher fails to start
- Minimal dependencies and stable behaviour

---

## Installation

### Symlink (recommended)

Keep the repository wherever you like and link the applet folder into
Cinnamon's applet path. Updates are then a matter of `git pull`, and the
install survives a reinstall of the operating system if the repository lives
on a separate drive.

```bash
git clone https://github.com/infidelus/launcherbar.git
ln -s "$(pwd)/launcherbar/launcherbar@infidelus" \
      ~/.local/share/cinnamon/applets/launcherbar@infidelus
```

### Copy

If you would rather not keep a live checkout:

```bash
git clone https://github.com/infidelus/launcherbar.git
cp -r launcherbar/launcherbar@infidelus ~/.local/share/cinnamon/applets/
```

Either way, reload Cinnamon afterwards (`Alt+F2`, then `r`) and add the
applet from *Panel → Applets*.

## Configuration

Launcher Bar is configured using a JSON file located at:

```
~/.config/cinnamon-launcher-bar/config.json
```

The applet automatically reloads when this file is saved. The path can be
changed in the applet's settings, and the file can be opened for editing
from the applet's right-click menu.

An example configuration is provided in `examples/config.example.json`.

## Example Configuration

Launchers are organised into named groups, which are displayed sequentially
in the panel, separated by dividers.

```json
{
  "groups": {
    "Default": {
      "items": [
        { "desktop": "firefox.desktop" },

        {
          "name": "Custom App",
          "exec": ["/full/path/to/executable"],
          "iconPath": "/full/path/to/icon.png"
        },

        { "type": "divider" },

        {
          "name": "Wine App",
          "exec": [
            "wine",
            "/path/to/app.exe"
          ],
          "env": {
            "WINEPREFIX": "/path/to/wineprefix"
          }
        }
      ]
    }
  }
}
```

## Supported Item Types

### Desktop application

The tooltip and icon are taken from the desktop entry unless overridden.

```json
{ "desktop": "firefox.desktop" }
```

### Custom executable

`exec` is an argument vector, not a shell command line, so paths containing
spaces need no quoting or escaping. Desktop-entry field codes such as `%u`
are not supported and should be omitted.

```json
{
  "name": "My App",
  "exec": ["/path/to/executable"],
  "iconPath": "/path/to/icon.png"
}
```

### Wine application

Any environment variable may be set for the launched process.

```json
{
  "name": "Windows App",
  "exec": ["wine", "/path/to/app.exe"],
  "env": { "WINEPREFIX": "/path/to/prefix" },
  "iconPath": "/path/to/icon.png"
}
```

### Divider

```json
{ "type": "divider" }
```

## Icon Resolution

Icons are resolved in this order:

1. The icon from the desktop entry, if `desktop` is set
2. `iconPath`, an absolute path to an image file
3. `icon`, the name of an icon in the current theme
4. A generic executable icon

## Settings

| Setting | Description |
| --- | --- |
| Path to launcher configuration file | Location of `config.json` |
| Launcher icon size | 16–64 pixels |
| Compact icon spacing | Reduces padding between launchers |

## Notes

- Configuration changes are applied automatically when the file is saved
- Invalid JSON displays a warning icon in the panel; hover it for the error
- Paths containing spaces are fully supported

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
