# LazeAway

LazeAway is an Electron + React desktop controller for GRBL-based diode lasers (150×200mm workspace). It provides artwork import, raster/photo engraving with tone control and outline mode, vector cutting, live connection/streaming with bounded in-flight buffering, jog controls, and a visual bed preview centered at workspace origin (0,0).

## Features
- Centered workspace (0,0 at dead center of 150×200mm bed)
- GRBL streaming with RX-buffer-safe in-flight window (ok/error tracking)
- Raster engraving with bidirectional scanlines, darkness/tone control, invert, outline mode
- Vector artwork import (SVG) and raster (PNG/JPG/WebP/GIF/BMP)
- Built-in Texas outline templates and picture outlines
- Persistent artwork library (userData)
- Connection, jog pad, console, G-code preview, test fire, emergency stop

## Development


\
pm install\`n

\
pm run dev\`n
## Build


\
pm run build\`n
\
pm run dist\`n
## Safety
- Eye protection required for any active laser output. Never leave unattended.
- USB-C data + 24V power both required on typical 6W/diode rigs.
- Use in a ventilated area; follow local regulations.

