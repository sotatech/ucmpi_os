Changelog
[Unreleased]

Documentation and testing refinements in progress.

[2.1.0] – 2025-09-21
Added

Watchdog control

Implemented MQTT-based control for /pi page buttons: Run, Pause, Reboot.

GPIO pin 13 now toggles as a heartbeat when watchdog is running.

Pause stops heartbeat, Reboot triggers system restart.

Comfort buttons

Added support for /comfort page buttons: Tap, Hold 5s, Hold 15s, Hold 30s.

Events are published as MQTT messages on topic uhai/manager/alert.

Each duration maps to a human-readable message.

Changed

GPIO handling

Migrated to pigpio-client using IPv6 (::1:8888) for stable local connection.

Configured watchdog input (pin 12) and alert button (pin 20) with correct pull-up/down modes.

Cleaned up duplicate and legacy GPIO setup code.

Logging

Removed noisy debug logs from watchdog/comfort handling.

Kept essential logs for state changes and MQTT events.

Removed DEBUG USER: admin banner from /pi page (base_layout.html.hbs).

Startup behavior

Fixed false “Comfort button tapped” event by removing function_button(500) auto-trigger.

install.sh

Updated to install and enable pigpiod as a systemd service.

Configured pigpiod to listen on IPv6 loopback (::1:8888).

Added safety checks to ensure pigpio-client can connect immediately after boot.

Simplified package installation and service enablement to reduce first-time setup issues.

Fixed

Watchdog control messages (MQTT payloads were previously arriving as Buffer).

Comfort buttons now reliably publish MQTT events.

pigpiod service configured to start at boot and listen on IPv6 loopback.

Versioning

package.json bumped from 2.0.0.2 → 2.1.0.

Reflects major functional improvements in GPIO, watchdog control, and comfort buttons.

[2.0.0] – 2025-09-21 (baseline from 21st September snapshot)

Initial working version of manager.js.

Basic watchdog heartbeat and comfort button logic present but incomplete.

pigpiod connection issues unresolved.

Debug banners visible in UI.