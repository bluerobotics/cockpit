<div align="center">
  <img style="width: 20%" src="src/assets/cockpit-logo.png"><br>
</div>

<div align="center">
  <h1>Cockpit - A Modern Ground Control Software</h1>
  <p><strong>An intuitive, customizable, and powerful ground control station software for remote vehicles of all types</strong></p>

  <p>
    <a href="https://docs.bluerobotics.com/cockpit">🌐 Live Demo</a> •
    <a href="https://blueos.cloud/cockpit/docs/latest/usage/installation/">📦 Install</a> •
    <a href="https://blueos.cloud/cockpit/docs">📖 Documentation</a> •
    <a href="https://discuss.bluerobotics.com/c/bluerobotics-software/cockpit">💬 Community</a>
  </p>
</div>

<br>

<div align="center">
  <img style="width: 65%" src="./public/images/screen.png"><br>
</div>

<br>

[![Test, Build and Deploy Images](https://github.com/bluerobotics/cockpit/actions/workflows/ci.yml/badge.svg)](https://github.com/bluerobotics/cockpit/actions/workflows/ci.yml)
![Downloads](https://img.shields.io/github/downloads/bluerobotics/cockpit/total?label=Downloads)
[![Latest Beta](https://img.shields.io/github/v/tag/bluerobotics/cockpit.svg?label=Latest%20Beta)](https://github.com/bluerobotics/cockpit/releases)
[![Docker](https://img.shields.io/docker/v/bluerobotics/cockpit?label=Docker)](https://hub.docker.com/r/bluerobotics/cockpit/tags)

---

## 🎯 What is Cockpit?

Cockpit is a modern, web-based ground control station that revolutionizes how you interact with remote vehicles. Whether you're piloting underwater ROVs, aerial drones, surface boats, or ground rovers, Cockpit provides an intuitive and highly customizable interface that adapts to your needs.

### ✨ Key Highlights

- **🌐 Universal Platform**: Runs in your browser or as a native desktop application
- **🎨 Fully Customizable**: Drag-and-drop widget interface that adapts to your workflow
- **🚀 Multi-Vehicle Support**: Control submarines, boats, drones and rovers from one interface
- **📹 Advanced Video**: Support for as many video streams as you need, with recording, snapshots, and real-time statistics
- **🗺️ Mission Planning**: Sophisticated waypoint planning with automated survey patterns
- **🎮 Joystick Support**: Extensive gamepad support with customizable button mappings
- **🔧 Extensible**: Advanced plugin system with DIY widgets, custom actions, data-lake variables, and input elements
- **📊 Data Rich**: Comprehensive telemetry logging and real-time data visualization

---

## 🚀 Quick Start

### Option 1: Try it Online
If you just want to take a look at Cockpit, you can visit our **[live demo](https://docs.bluerobotics.com/cockpit)** to experience it instantly in your browser.

### Option 2: Download Desktop App (Recommended)
Download the [latest release](https://blueos.cloud/cockpit/docs/latest/usage/installation/#self-contained-application) of our native desktop app for your platform.
It offers the best performance, as well as all the features available in the app.

We have dedicated builds for every Desktop platform, so make sure you're using the correct one to have the best possible experience.
- **Windows**: `.exe`
- **macOS (Intel)**: `x64 .dmg`
- **macOS (Intel)**: `arm64 .dmg`
- **Linux**: `.AppImage`
- **Steam OS**: `.Flatpak`

### Option 3: BlueOS Extension
If you're using BlueOS, Cockpit is available as a pre-installed extension.


### Option 4: Docker (for Developers)
```bash
docker run -p 8080:8080 bluerobotics/cockpit:latest
```

---

## 🖥️ Browser vs Desktop: What's the Difference?

<div align="center">

| **Feature** | **🌐 Browser** | **🖥️ Desktop** |
|-------------|---------------|----------------|
| **Joystick Support** | Only when tab and window are in focus  | ✅ Window can be unfocused and in the background |
| **Video/Snapshots** | Needs to be downloaded | ✅ Saved directly to your folders |
| **Vehicle Discovery** | ❌ Not available | ✅ Auto-scan for vehicles in the network|
| **Updates** | Manual updates | ✅ Auto-updates with notifications |
| **System Monitoring** | Memory-only | ✅ CPU and Memory tracking |
| **Workspace Capture** | ❌ Not available | ✅ Full interface screenshots |
| **Performance** | Standard | ✅ Optimized build for each system |
| **Installation** | ✅ No install needed | Requires download |
| **Multi-platform** | ✅ Any device | Windows, macOS, Linux |

</div>

### 🎯 **Quick Decision Guide**

**Choose Desktop** for complete experience, auto-updates, system integration, and optimal performance.
**Choose Browser** for testing, quick access, or when you can't install applications.

> **💡 Pro Tip**: Start with the [live demo](https://docs.bluerobotics.com/cockpit) to get familiar with Cockpit, then download the desktop app for regular use to unlock all capabilities!

---

## 🎛️ Supported Vehicles
Cockpit currently supports ArduPilot-based vehicles, communicating over MAVLink.

Since Cockpit was created and is maintained by Blue Robotics, we actively test the application every day against ArduSub and ArduRover vehicles, which we sell, so you can expect the best experience with ROVs and boats.

We currently consider the application to fully cover direct control for both Submarines and Boats, and partially cover automated missions. Currently Cockpit supports creating those with basic waypoints and polygon-based surveys. Missions requiring advanced navigation commands and control structures, like loitering, geofencing and servo control, are not yet supported.

Aerial vehicles (including those running ArduCopter and ArduPlane autopilot firmware) have initial support, including dedicated widgets for Takeoff and Landing.

ArduCopter support has been physically tested, but the primary development team don't perform regular tests on any aerial vehicles, so use it at your own risk.

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="src/assets/brov2-marker.png" width="80"><br>
        <strong>Submarines</strong><br>
        <em>ArduSub</em>
      </td>
      <td align="center">
        <img src="src/assets/blueboat-marker.png" width="80"><br>
        <strong>Surface Boats</strong><br>
        <em>ArduRover</em>
      </td>
      <td align="center">
        <img src="src/assets/arducopter-top-view.png" width="80"><br>
        <strong>Drones</strong><br>
        <em>ArduCopter</em>
      </td>
    </tr>
  </table>
</div>

---

## 🎨 Features Overview

### 🖥️ **Customizable Interface**
- **Drag-and-drop widgets** for complete layout control
- **Multiple [views](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#views)** for different operational modes
- **Responsive design** that works on all screen sizes
- **Custom themes** with customizable colors and glass effects

### 🎮 **Vehicle Control**
- **[ArduPilot](https://ardupilot.org/) support** for submarines, drones, planes, and rovers
- **[MAVLink protocol](https://mavlink.io/en/)** for reliable communication
- **[Joystick integration](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#joysticks)** with support for Xbox, PlayStation, and other controllers
- **Custom button mappings** for different vehicle types
- **Real-time telemetry** with customizable data displays

### 📹 **Video Streaming**
- **[WebRTC-based streaming](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#webrtc-video-player)** for low-latency video
- **Multi-stream support** with stream mapping
- **[Video recording](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#webrtc-video-recorder)** with automatic processing and metadata
- **Snapshot capture** with GPS coordinates and telemetry
- **Video statistics** for monitoring stream quality

### 🗺️ **Mission Planning**
- **Interactive map interface** with drag-and-drop waypoints
- **Survey generation** for automated area coverage
- **Points of interest** management
- **Mission import/export** for easy backup and reuse
- **Real-time mission monitoring** and execution

### 📊 **Data Management**
- **[Data Lake](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#data-lake)** for centralized variable storage
- **[Telemetry logging](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#telemetry)** with customizable parameters
- **Export capabilities** for data analysis
- **Real-time [plotting](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#data-plotting)** and visualization

### 🔌 **Extensibility**
- **Plugin architecture** for custom widgets
- **JavaScript API** for external integrations
- **HTTP actions** for calling external services
- **BlueOS extensions** support
- **Custom actions** with full JavaScript execution

---

## 📦 [Available Widgets](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#widgets)

### 📹 **Video & Visual**
- **Video Player**: Multi-stream video with controls
- **Attitude Indicator**: Aircraft-style attitude display
- **Compass**: Traditional and HUD-style compass
- **Virtual Horizon**: 3D attitude visualization
- **Depth HUD**: Submarine-style depth indicator

### 🗺️ **Navigation**
- **Map**: Interactive map with vehicle tracking
- **Plotter**: Real-time data plotting
- **Image View**: Static image display with overlays

### 🎛️ **Controls & Status**
- **Mini Widgets Bar**: Compact status indicators
- **Alerter**: System alerts and notifications
- **Battery Indicator**: Power status monitoring
- **Mode Selector**: Flight mode switching
- **Armer Button**: Vehicle arming controls

### 🔧 **Custom & Advanced**
- **DIY Widget**: Build your own custom interfaces
- **IFrame**: Embed external web content
- **Collapsible Container**: Organize widgets efficiently
- **External Widgets**: Load widgets from BlueOS extensions

---

## 🚀 Advanced Features

### ⚡ **[Cockpit Actions](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#cockpit-actions-1)**
Powerful automation system that lets you trigger custom behaviors through buttons, joysticks, or programmatically.

**Built-in Actions:**
- View navigation (next/previous view, full screen toggle)
- Vehicle control (arm/disarm, recording start/stop)
- Interface control (toggle top/bottom bars)

**Custom Action Types:**
- 🌐 **HTTP Requests**: Call external APIs, servers, or camera endpoints
- 📡 **MAVLink Messages**: Send specific MAVLink commands to vehicles
- 💾 **JavaScript**: Execute custom code with full access to Cockpit APIs
- 🔗 **Action Links**: Automatically trigger actions, timed or when data-lake variables change

### 📊 **Data-Lake Variables**
Central data management system for sharing information across Cockpit components.

**Features:**
- **Multi-type Support**: Store strings, numbers, or boolean values
- **Persistence**: Variables can survive between sessions
- **Real-time Updates**: Components automatically sync when variables change
- **MAVLink Integration**: All variables in the MAVLink stream are automatically available
- **External Access**: Available through JavaScript API for custom widgets

**Use Cases:**
- Share sensor data between widgets
- Control actuators with the joystick or visual components
- Store user preferences and settings
- Create custom telemetry displays
- Enable inter-widget communication

### 🎨 **DIY Widgets**
Create completely custom widgets using HTML, CSS, and JavaScript with full access to Cockpit's systems.

**Capabilities:**
- **Code Editors**: Built-in Monaco editors for HTML, CSS, and JavaScript
- **Live Preview**: See changes in real-time as you code
- **Data-Lake Access**: Read and write variables through [our APIs](src/libs/cosmos.ts)
- **Import/Export**: Share widget configurations as JSON files
- **Keyboard Shortcuts**: Cmd/Ctrl + Enter to apply, navigation shortcuts

**Example Use Cases:**
- Custom control panels for specific missions
- Specialized data visualizations
- Integration with external devices
- Vehicle-specific interfaces

### 🎛️ **Input Widgets & Custom Elements**
Pre-built interactive components for creating sophisticated control interfaces within Collapsible Container widgets.

**Available Elements:**
- 🔘 **Button**: Trigger Cockpit actions with customizable styling
- ☑️ **Checkbox**: Boolean input with data-lake variable binding
- 🎛️ **Dial**: Rotary control for numeric values with custom ranges
- 📋 **Dropdown**: Selection input with configurable options
- 🏷️ **Label**: Display text with dynamic content from variables
- 🎚️ **Slider**: Linear control for numeric inputs with tooltips
- 🔄 **Switch**: Toggle control for boolean values

**Features:**
- **Data-Lake Integration**: All elements can read/write to data-lake variables
- **Action Binding**: Buttons can trigger any Cockpit action
- **Layout Control**: Flexible alignment and sizing options
- **Real-time Updates**: Elements automatically reflect variable changes
- **Customizable Styling**: Colors, sizes, and appearances fully configurable

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js** 18+ and **yarn** package manager
- **Git** with submodule support

### Quick Development Start
```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/bluerobotics/cockpit.git
cd cockpit

# Install dependencies
yarn install

# Start development server
yarn dev --host

# Start Electron development server
yarn dev:electron --host
```

The development server will start at `http://localhost:5173` with hot reload enabled.

### Backend Services (Optional)
For full functionality, Cockpit relies on some backend services.
Those services are included by default on [BlueOS](https://github.com/bluerobotics/blueos), but if you want to use Cockpit without having BlueOS installed in your vehicle, you should install the following on the vehicle or on your top-side computer:

1. **MAVLink streaming**: [mavlink2rest](https://github.com/mavlink/mavlink2rest) (on port 6040)
2. **Video Streaming**: [mavlink-camera-manager](https://github.com/mavlink/mavlink-camera-manager) (on port 6021)

**Note**: MAVLink Camera Manager is only needed if you want to stream video.

### Vehicle Simulation
If you don't have a vehicle, or prefer to test the application against a simulated one, you can do it with our Docker Compose:
```bash
# Start ArduSub simulation
docker-compose -f sim.yml --profile ardusub up

# Other profiles: arducopter, ardurover, arduplane
```

---

## 🏗️ Architecture

Cockpit is built with modern web technologies:

- **Frontend**: Vue.js 3 with TypeScript and Composition API
- **UI Library**: Vuetify 3 for Material Design components
- **Build System**: Vite for fast development and optimized builds
- **Desktop**: Electron for native application packaging
- **Communication**: WebSocket and WebRTC for real-time data

---

## 🤝 Contributing

We welcome contributions! We don't have a contribution guide yet, but you can help us in different ways:

- 🐛 **Bug Reports**: Help us improve by reporting issues
- 💡 **Feature Requests**: Suggest new capabilities
- 🔧 **Code Contributions**: Submit pull requests
- 📝 **Documentation**: Improve our [docs](https://blueos.cloud/cockpit/docs) and examples

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📚 Documentation & Support

- **📖 User Documentation**: [blueos.cloud/docs/extensions/cockpit](https://blueos.cloud/cockpit/docs)
- **💬 Community Forum**: [discuss.bluerobotics.com](https://discuss.bluerobotics.com/c/bluerobotics-software/cockpit)
- **🐛 Issue Tracker**: [GitHub Issues](https://github.com/bluerobotics/cockpit/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/bluerobotics/cockpit/discussions)

---

## 📄 License

Cockpit is dual-licensed:
- **AGPL-3.0**: For open-source use
- **Commercial License**: For proprietary applications

See [LICENSE.md](LICENSE.md) for details.

---

## 🏢 About Blue Robotics

<div align="center">
  <img src="./src/assets/blue-robotics-white-name-logo.png" width="200">
  <p><strong>On a mission to enable the future of marine robotics</strong></p>
  <p>
    <a href="https://bluerobotics.com">🌐 Website</a> •
    <a href="https://github.com/bluerobotics">🐙 GitHub</a> •
    <a href="https://www.youtube.com/bluerobotics">📺 YouTube</a> •
  </p>
</div>

---

<div align="center">
  <p>⭐ <strong>Star us on GitHub</strong> if you find Cockpit useful!</p>
  <p>Made with 💙 by the Blue Robotics team and contributors worldwide</p>
</div>
