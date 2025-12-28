const Applet = imports.ui.applet;
const St = imports.gi.St;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

class LauncherBar extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.actor.track_hover = false;
        this.actor.reactive = true;
        this.actor.can_focus = false;

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

        this.settings.bind("configPath", "configPath", this.reload);
        this.settings.bind("iconSize", "iconSize", this.reload);
        this.settings.bind("compactMode", "compactMode", this.reload);

        // Context menu: Edit configuration
        this._applet_context_menu.addAction(
            "Edit configuration",
            () => {
                let path = this._expandHome(this.configPath);
                Util.spawnCommandLine(`xdg-open "${path}"`);
            }
        );

        // Container
        this.box = new St.BoxLayout({
            vertical: true,
            y_align: St.Align.START,
            style_class: "launcherbar-box"
        });

        // Prevent inner hover affecting panel
        this.box.reactive = false;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.add_child(this.box);
        this.actor.set_y_align(St.Align.START);

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

    on_applet_removed_from_panel() {
        if (this._monitor)
            this._monitor.cancel();

        if (this._reloadTimeout)
            GLib.source_remove(this._reloadTimeout);
    }

    _expandHome(path) {
        return path.replace(/^~/, GLib.get_home_dir());
    }

    reload() {
        this.box.destroy_all_children();

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
            this._monitor = file.monitor_file(
                Gio.FileMonitorFlags.NONE, null
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
        this.box.add(label);
    }

    _buildUI(config) {
        let size = this.iconSize || 32;
        let padding = this.compactMode ? "2px 0" : "6px 0";
        let firstGroup = true;

        if (!config.groups)
            return;

        for (let groupName in config.groups) {
            let group = config.groups[groupName];

            if (!firstGroup) {
                this.box.add(this._makeDivider());
            }
            firstGroup = false;

            for (let item of group.items || []) {

                // Divider item
                if (item.type === "divider") {
                    this.box.add(this._makeDivider());
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

                // Tooltip
                new Tooltips.Tooltip(button, item.name || "");

                button.connect("clicked", () => {
                    this._launchItem(item);
                });

                this.box.add(button);
            }
        }
    }

    _makeDivider() {
        return new St.Widget({
            style: "height: 1px; margin: 8px 0; background-color: rgba(255,255,255,0.15);"
        });
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
                appInfo.launch([], null);
                return;
            }
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
            global.logError(e);
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new LauncherBar(metadata, orientation, panelHeight, instanceId);
}

