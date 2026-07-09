const Applet = imports.ui.applet;
const St = imports.gi.St;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

class LauncherBar extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Panel orientation: LEFT/RIGHT panels are vertical, TOP/BOTTOM horizontal
        this._orientation = orientation;

        this.actor.track_hover = false;
        this.actor.reactive = true;
        this.actor.can_focus = false;

        // Apply the container style class so stylesheet.css rules take effect
        this.actor.add_style_class_name("launcherbar-applet");

        // Kill panel hover tint without breaking menus
        this.actor.connect("enter-event", () => {
            this.actor.remove_style_pseudo_class("hover");
        });
        this.actor.connect("leave-event", () => {
            this.actor.remove_style_pseudo_class("hover");
        });
        this.actor.connect("allocation-changed", () => {
            this.actor.remove_style_pseudo_class("hover");
        });

        // Settings
        this.settings = new Settings.AppletSettings(
            this, metadata.uuid, instanceId
        );

        // configPath needs the file monitor moving as well as a reload
        this.settings.bind("configPath", "configPath", () => this._onConfigPathChanged());
        this.settings.bind("iconSize", "iconSize", () => this.reload());
        this.settings.bind("compactMode", "compactMode", () => this.reload());

        // Context menu: Edit configuration
        this._applet_context_menu.addAction(
            "Edit configuration",
            () => {
                let path = this._expandHome(this.configPath);
                Util.spawnCommandLine(`xdg-open "${path}"`);
            }
        );

        // Container — orientation is applied in reload()
        this.box = new St.BoxLayout({
            vertical: this._isVertical(),
            style_class: "launcherbar-box"
        });

        // Prevent inner hover affecting panel
        this.box.reactive = false;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.add_child(this.box);

        this._monitor = null;
        this._reloadTimeout = null;

        this.reload();
        this._setupFileMonitor();
    }

    on_editConfig() {
        let path = this._expandHome(this.configPath);

        // Must be deferred or it fails when called from the settings dialog
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            Util.spawnCommandLine(`xdg-open "${path}"`);
            return GLib.SOURCE_REMOVE;
        });
    }

    on_orientation_changed(orientation) {
        this._orientation = orientation;
        this.reload();
    }

    on_applet_removed_from_panel() {
        if (this._monitor)
            this._monitor.cancel();

        if (this._reloadTimeout)
            GLib.source_remove(this._reloadTimeout);
    }

    _isVertical() {
        // A panel on the left or right edge lays its applets out vertically
        return this._orientation === St.Side.LEFT ||
               this._orientation === St.Side.RIGHT;
    }

    _expandHome(path) {
        return path.replace(/^~/, GLib.get_home_dir());
    }

    _onConfigPathChanged() {
        // Re-point the file monitor at the new location, then rebuild
        this._setupFileMonitor();
        this.reload();
    }

    reload() {
        this.box.destroy_all_children();
        this.box.vertical = this._isVertical();

        if (this._isVertical())
            this.actor.set_y_align(St.Align.START);

        let path = this._expandHome(this.configPath);
        let file = Gio.File.new_for_path(path);

        if (!file.query_exists(null)) {
            this._addError(`Missing config:\n${path}`);
            return;
        }

        try {
            let [, contents] = file.load_contents(null);
            let config = JSON.parse(contents.toString());
            this._buildUI(config);
        } catch (e) {
            this._addError(`Config error:\n${e}`);
        }
    }

    _setupFileMonitor() {
        if (this._monitor) {
            this._monitor.cancel();
            this._monitor = null;
        }

        let path = this._expandHome(this.configPath);
        let file = Gio.File.new_for_path(path);

        try {
            // WATCH_MOVES catches editors that save atomically by writing a
            // temporary file and renaming it over the original
            this._monitor = file.monitor_file(
                Gio.FileMonitorFlags.WATCH_MOVES, null
            );

            this._monitor.connect("changed", () => {
                if (this._reloadTimeout)
                    GLib.source_remove(this._reloadTimeout);

                this._reloadTimeout = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    300,
                    () => {
                        this.reload();
                        this._reloadTimeout = null;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
        } catch (e) {
            global.logError(e);
        }
    }

    _addError(message) {
        let label = new St.Label({
            text: "!",
            style_class: "launcherbar-error"
        });

        new Tooltips.Tooltip(label, message);
        this.box.add_child(label);
    }

    _buildUI(config) {
        let size = this.iconSize || 32;
        let pad = this.compactMode ? 2 : 6;

        // Pad along the axis of flow: top/bottom on a vertical bar,
        // left/right on a horizontal one
        let padding = this._isVertical() ? `${pad}px 0` : `0 ${pad}px`;

        let firstGroup = true;

        if (!config.groups)
            return;

        for (let groupName in config.groups) {
            let group = config.groups[groupName];

            if (!firstGroup) {
                this.box.add_child(this._makeDivider());
            }
            firstGroup = false;

            for (let item of group.items || []) {

                // Divider item
                if (item.type === "divider") {
                    this.box.add_child(this._makeDivider());
                    continue;
                }

                let icon = this._resolveIcon(item, size);

                let button = new St.Button({
                    child: icon,
                    reactive: true,
                    can_focus: true,
                    track_hover: true,
                    style_class: "launcherbar-button",
                    style: `
                        padding: ${padding};
                        border-radius: 6px;
                    `
                });

                // Tooltip: explicit name, else the desktop entry's own name
                new Tooltips.Tooltip(button, this._itemLabel(item));

                button.connect("clicked", () => {
                    this._launchItem(item);
                });

                this.box.add_child(button);
            }
        }
    }

    _itemLabel(item) {
        if (item.name)
            return item.name;

        if (item.desktop) {
            let appInfo = Gio.DesktopAppInfo.new(item.desktop);
            if (appInfo)
                return appInfo.get_name() || "";
        }

        return "";
    }

    _makeDivider() {
        // A thin rule across the bar, perpendicular to the direction of flow
        let style = this._isVertical()
            ? "height: 1px; margin: 8px 0; background-color: rgba(255,255,255,0.15);"
            : "width: 1px; margin: 0 8px; background-color: rgba(255,255,255,0.15);";

        return new St.Widget({ style: style });
    }

    _resolveIcon(item, size) {
        // Desktop file
        if (item.desktop) {
            let appInfo = Gio.DesktopAppInfo.new(item.desktop);
            if (appInfo && appInfo.get_icon()) {
                return new St.Icon({
                    gicon: appInfo.get_icon(),
                    icon_size: size
                });
            }
        }

        // Explicit icon path
        if (item.iconPath) {
            let file = Gio.File.new_for_path(item.iconPath);
            if (file.query_exists(null)) {
                return new St.Icon({
                    gicon: new Gio.FileIcon({ file }),
                    icon_size: size
                });
            }
        }

        // Theme icon name
        if (item.icon) {
            return new St.Icon({
                icon_name: item.icon,
                icon_size: size
            });
        }

        // Fallback
        return new St.Icon({
            icon_name: "application-x-executable",
            icon_size: size
        });
    }

    _launchItem(item) {
        // Desktop app
        if (item.desktop) {
            let appInfo = Gio.DesktopAppInfo.new(item.desktop);
            if (appInfo) {
                try {
                    appInfo.launch([], null);
                } catch (e) {
                    this._launchFailed(this._itemLabel(item) || item.desktop, e);
                }
                return;
            }

            this._launchFailed(item.desktop, "Desktop entry not found");
            return;
        }

        // Custom exec
        if (!item.exec)
            return;

        try {
            let argv = Array.isArray(item.exec) ? item.exec : [item.exec];

            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.NONE
            });

            if (item.env) {
                for (let key in item.env) {
                    launcher.setenv(key, item.env[key], true);
                }
            }

            launcher.spawnv(argv);
        } catch (e) {
            this._launchFailed(this._itemLabel(item) || String(item.exec), e);
        }
    }

    _launchFailed(what, error) {
        // Failures were previously silent; now tell the user why
        global.logError(`Launcher Bar: failed to launch ${what}: ${error}`);
        Main.notify("Launcher Bar", `Failed to launch ${what}\n${error}`);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new LauncherBar(metadata, orientation, panelHeight, instanceId);
}
