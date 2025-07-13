<div align="center">
  <img style="width: 20%" src="src/assets/cockpit-logo.png"><br>
</div>

<div align="center">
  <h1>Cockpit - A Modern Ground Control Software</h1>

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

  <p><strong>An intuitive, customizable, and powerful ground control station software for remote vehicles of all types</strong></p>

Cockpit is a web-based ground control station that aims to improve how you interact with remote vehicles. Whether you're piloting underwater ROVs, surface boats, aerial drones, or ground rovers, Cockpit provides an intuitive and highly customizable interface that adapts to your needs.

### ✨ Key Highlights

- **🌐 Universal Platform**: Runs in your browser or as a native desktop application
- **🎨 Fully Customizable**: Drag-and-drop widget interface that adapts to your workflow
- **🚀 Multi-Vehicle Support**: Control submarines, boats, drones and rovers from different interfaces in the same application
- **📹 Advanced Video**: Support for as many video streams as you need, with recording, snapshots, and real-time statistics
- **🗺️ Mission Planning**: Sophisticated waypoint planning with automated survey patterns
- **🎮 Joystick Support**: Extensive gamepad support with customizable button mappings
- **🔧 Extensible**: Advanced plugin system with DIY widgets, custom actions, data-lake variables, and input elements
- **📊 Data Rich**: Comprehensive telemetry logging and real-time data visualization

---

## 🚀 Quick Start

### Accessing Cockpit

#### - Option 1: Try it Online
If you just want to take a look at Cockpit, you can visit our **[live demo](https://docs.bluerobotics.com/cockpit)** to experience it instantly in your browser.

#### - Option 2: Download the Native App (Recommended)
Download the [latest release](https://blueos.cloud/cockpit/docs/latest/usage/installation/#self-contained-application) of our native desktop app for your platform.
It offers the best performance, as well as all the features available in the app.

We have dedicated builds for every Desktop platform, so make sure you're using the correct one to have the best possible experience.
- **Windows**: `.exe`
- **macOS (Intel)**: `x64 .dmg`
- **macOS (Apple Silicon)**: `arm64 .dmg`
- **Linux**: `.AppImage`
- **Steam OS**: `.Flatpak`

#### - Option 3: Install the BlueOS Extension
If you're using BlueOS, you can install Cockpit [from the Extensions page](https://blueos.cloud/docs/stable/usage/advanced/#extensions).


#### - Option 4: Docker (for Developers)
```bash
docker run -p 8080:8080 bluerobotics/cockpit:latest
```

Once you have Cockpit running, it's time to connect to your vehicle:

### Connecting to your vehicle

If you're running Cockpit as a BlueOS extension, it should automatically connect to your vehicle, but if you're running the native app and you have BlueOS in your vehicle, you can use the Vehicle Discovery dialog to easily connect to it. If for some reason you missed this dialog during boot you can just head to `Menu>Settings>General` and find the "Search for vehicles" button there.

If you have your vehicle connected through a serial interface, like a [USB-Serial radio](https://ardupilot.org/plane/docs/common-telemetry-landingpage.html#common-telemetry-landingpage), you should [manually configure the connection address]((https://blueos.cloud/cockpit/docs/latest/usage/getting-started/#general-configuration)). To do that activate the checkmark for "Mavlink2Rest connection" under `Menu>Settings>General` and use `serial:path/to/serial/device?baudrate=desired-baudrate` there.

### Streaming video

If you want to stream video from your vehicle and you're not using BlueOS, you will need to run [`mavlink-camera-manager`](https://github.com/mavlink/mavlink-camera-manager) manually in the same machine as Cockpit, activate the checkmark for "WebRTC connection" and use `ws://127.0.0.1:6020` there.

---

## 🖥️ Browser vs Desktop: What's the Difference?

Most of the motivation behind having distinct versions with different features is tied to browsers' limitations -- more specifically, the need for secure context to access the most powerful APIs (e.g., filesystem, geolocation, serial communication), which is usually not the case when you're serving Cockpit from a hosted webpage with issued certificates. To overcome this, we moved to shipping additional features in a native app, built over [Electron](https://www.electronjs.org/), which also enables us to embed functionality beyond what the browser can provide.

Below is a table summarizing the current status, but in general, you can expect more features and better performance on the native app:

<div align="center">

| **Feature** | **🌐 Browser** | **🖥️ Desktop** |
|-------------|---------------|----------------|
| **Joystick Support** | Only when tab and window are in focus  | ✅ Window can be unfocused and in the background |
| **Video/Snapshots** | Needs to be downloaded | ✅ Saved directly to your folders |
| **Vehicle Discovery** | ❌ Not available | ✅ Auto-scan for vehicles in the network|
| **Updates** | Manual updates required | ✅ Auto-updates / update notifications |
| **System Monitoring** | Memory usage only | ✅ CPU and Memory tracking |
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
Vehicle support is currently focused on ArduPilot-based autopilots communicating over MAVLink.

Since Cockpit was created and is maintained by Blue Robotics, we actively test the application every day against ArduSub and ArduRover vehicles, which we sell, so you can expect the best experience with ROVs and boats.

We currently consider the application to fully cover direct control for both _submarines_ and _boats_, and partially cover automated missions. Currently, Cockpit supports creating missions with basic waypoints and polygon-based surveys. Missions requiring advanced navigation commands and control structures, like loitering, geofencing, and servo control, are not yet supported.

Aerial vehicles (including those running ArduCopter and ArduPlane autopilot firmware) have initial support, including dedicated widgets for _takeoff_ and _landing_.

ArduCopter support has been physically tested, but the primary development team doesn't perform regular tests on any aerial vehicles, so use it at your own risk (also, PRs are very much welcome!).

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
- **Responsive design** that works on almost any screen size
- **Custom themes** with customizable colors and glass effects

### 🎮 **Vehicle Control**
- **[ArduPilot](https://ardupilot.org/) support** for submarines, drones, aerial vehicles and rovers
- **[MAVLink protocol](https://mavlink.io/en/)** for reliable communication
- **[Joystick integration](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#joysticks)** with support for almost any controller, including custom ones
- **Custom button mappings** for different vehicle types
- **Real-time telemetry** with customizable data displays

### 📹 **Video Streaming**
- **[WebRTC-based streaming](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#webrtc-video-player)** for low-latency video
- **Multi-stream support** with customizable screen placement
- **[Video recording](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#webrtc-video-recorder)** with automatic processing and telemetry overlay generation
- **Snapshot capture** with GPS metadata
- **Video statistics** for monitoring stream quality

### 🗺️ **Mission Planning**
- **Interactive map interface** with drag-and-drop waypoints
- **Survey generation** for automated area coverage
- **Points of interest** management
- **Mission import/export** for easy backup and reuse
- **Real-time mission monitoring** and execution

### 📊 **Data Management**
- **[Data Lake](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#data-lake)** for centralized variable storage and retrieval
- **[Telemetry logging](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#telemetry)** with customizable video overlay
- **Real-time [plotting](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#data-plotting)** and [indicators](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#very-generic-indicators) for easy visualization

### 🔌 **Extensibility**
- **Plugin architecture** for custom widgets
- **JavaScript API** for external integrations
- **HTTP actions** for calling external services
- **MAVLink actions** for sending custom commands
- **JavaScript actions** for completely custom integrations

---

## 📦 Available Widgets

Cockpit provides an extensive list of widgets for you to customize your experience. They are divided into Regular and Mini Widgets and can be placed [anywhere on your screen](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#display-breakdown), including freely in your Views or inside Containers like the top and bottom bars.

You can read more about the available widgets in our [docs](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#widgets).

---

## 🚀 Advanced Features

One of our goals in Cockpit is to provide powerful integration tools, so you can interface with any system, no matter how complex it is. To accomplish that, we designed tools like the [Cockpit Actions](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#cockpit-actions-1), which allow you to perform custom tasks (e.g., run arbitrary code, call external APIs), and the [Data Lake](https://blueos.cloud/cockpit/docs/latest/usage/advanced/#data-lake), which provides a centralized place for you to store and retrieve data.

Be sure to check our docs for more information on how to take advantage of these powerful tools.

---

## ⚠️ Current Limitations

While Cockpit is a powerful and feature-rich ground control station, there are some current limitations to be aware of:

### 📹 **Video Processing Constraints**
Cockpit records video in "chunks" at each second and then reconstructs them into a complete video file through a processing step. For longer recordings, this reconstruction process can exceed your computer's memory capacity.

- [**Recommended limit**](https://github.com/bluerobotics/cockpit/issues/2004): Keep recordings under **30 minutes** for reliable in-app processing
- **For longer recordings**: Use our [online processing tool](https://cockpit-online-processing.rlehmk.dev/) to process video chunks in batches (e.g. 1000 chunks each time) and then combine the resulting files with an external video editing software, like [LosslessCut](https://mifi.no/losslesscut/)
- **Processing capability varies** by computer specifications - systems with more RAM can handle longer recordings. Testing before critical missions is encouraged

### 🚁 **Vehicle Support Gaps**
- [**PX4 autopilots**](https://github.com/bluerobotics/cockpit/issues/2008): Currently not supported, though MAVLink communication is implemented
- **Aerial and Ground vehicles**: Although recognized by the application, those types of vehicles have limited support and testing
- **Contributions welcome**: We're actively seeking community help to add support for PX4 vehicles as well as improve the support for Aerial and Ground vehicles on Ardupilot

### 🗺️ **Mission Planning Limitations**
- **Basic waypoints only**: Current mission planning supports "pass by" waypoints and polygon surveys
- [**No MAVLink command support**](https://github.com/bluerobotics/cockpit/issues/1737): Advanced waypoints with specific MAVLink commands (loitering, conditional actions, servo control) are not yet implemented
- **Geofencing**: Not currently supported in mission planning

> 💡 **Help Us Improve**: Many of these limitations represent opportunities for community contributions. Check our [GitHub Issues](https://github.com/bluerobotics/cockpit/issues) for specific areas where help is needed!

---

## 🏗️ Architecture

Cockpit is built with modern web technologies, which help us advance development quickly and easily receive external contributions. Here you can find part of our stack:

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

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js** 18+ and **yarn** package manager
- **Git** with submodule support

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

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

The development server will start at `http://localhost:5173` with hot reloading enabled.

### Backend Services (Optional)
For video support, Cockpit relies on a backend service called [mavlink-camera-manager](https://github.com/mavlink/mavlink-camera-manager).
This service is included by default on [BlueOS](https://github.com/bluerobotics/blueos), but if you want to use Cockpit without BlueOS installed on your vehicle, you should install it in the vehicle or in your top-side computer.

### Vehicle Simulation
If you don't have a vehicle, or prefer to test the application against a simulated one, you can do it with our Docker Compose:
```bash
# Start ArduSub simulation
docker-compose -f sim.yml --profile ardusub up

# Other profiles: arducopter, ardurover, arduplane
```

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
    <a href="https://www.youtube.com/bluerobotics">📺 YouTube</a>
  </p>
</div>

---

<div align="center">
  <p>⭐ <strong>Star us on GitHub</strong> if you find Cockpit useful!</p>
  <p>Made with 💙 by the Blue Robotics team and contributors worldwide</p>
</div>
