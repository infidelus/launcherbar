# Launcher Bar (Cinnamon Applet)

Launcher Bar is a lightweight vertical launcher applet for the Cinnamon desktop.
It is configured via a simple JSON file and reloads automatically when the file is saved.

Launcher Bar is inspired by Command Launcher, with a focus on simple, file-based configuration, and has been tested on Linux Mint 22.

---

## Features

- Vertical launcher bar for any Cinnamon panel
- Supports:
  - Desktop applications
  - Custom executables
  - Wine applications (with environment variables)
- Optional dividers for grouping launchers
- Automatic reload on configuration changes
- Minimal dependencies and stable behaviour

---

## Installation

Clone the repository and copy the applet directory into Cinnamon’s applet path:

```bash
git clone https://github.com/infidelus/launcherbar.git
cp -r launcherbar@infidelus ~/.local/share/cinnamon/applets/
```

Then reload Cinnamon or restart the desktop session.

## Configuration

Launcher Bar is configured using a JSON file located at:

```
~/.config/cinnamon-launcher-bar/config.json
```

The applet automatically reloads when this file is saved.

An example configuration is provided in:

```
examples/config.example.json
```

## Example Configuration

Launchers are organised into named groups, which are displayed sequentially in the panel.

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

```
{ "desktop": "firefox.desktop" }
```

### Custom executable

```
{
  "name": "My App",
  "exec": ["/path/to/executable"],
  "iconPath": "/path/to/icon.png"
}

```

### Divider

```
{ "type": "divider" }
```

## Notes

- Configuration changes are applied automatically when the file is saved
- Invalid JSON will display a warning icon in the panel
- Paths containing spaces are fully supported

## License

MIT
