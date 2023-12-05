<div align="center">
  <img src="./public/images/cockpit-banner.png"><br>
</div>

------------------------

An intuitive and customizable cross-platform ground control station for remote vehicles of all types.

# Development

## Installing Cockpit
Cockpit is typically installed as an Electron application or BlueOS Extension, but for development purposes it is valuable to run it locally.

First of all, you need to clone the repository and it's submodules. Don't forget to clone the submodules as they are needed for Cockpit to run:

```
git clone --recurse-submodules git@github.com:bluerobotics/cockpit.git
```

After that you should [install bun](https://bun.sh/docs/installation). We really recomend following their documented instructions, as it was already reported by some that installing `bun` from alternatives like Snap has not worked properly.

With `bun` installed, you can enter the repository folder and follow the steps below:

```
bun install
```

and then run the server locally with:

```
bun run dev --host
```

Then you should see a prompt with the local IP and port that can be accessed through a browser, such as `localhost:5173`.

## Installing backend providers

Cockpit is currently a frontend-only application. That means it relies on data offered by other backend solutions, which are not built-in.

If you have a [BlueOS](https://github.com/bluerobotics/BlueOS) instance running, there's no need to install any backend, as BlueOS already provides everything.

If that's not your case and you want to install the necessary backends, follow the instructions below:

1. Install a MAVLink router. We recommend [mavp2p](https://github.com/bluenviron/mavp2p) or [MAVLink Router](https://github.com/mavlink-router/mavlink-router).
2. Run the MAVLink router, connecting it to your vehicle or [SITL instance](https://ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html).
3. Install [mavlink2rest](https://github.com/mavlink/mavlink2rest).
4. Run `mavlink2rest`, pointing it to the endpoint provided by the MAVLink router. Remember to serve the API over the 6040 port by running it with `--server 0.0.0.0:6040`.
5. [Optional] If you want to work with video streaming, install [Mavlink Camera Manager](https://github.com/mavlink/mavlink-camera-manager).

## Connecting to your vehicle

Follow the instructions provided [here](https://docs.bluerobotics.com/ardusub-zola/software/control-station/Cockpit-0.0/advanced-usage/#general) to connect Cockpit to your vehicle.

If you're running a BlueOS instance, just put the IP address of it in "Global vehicle address" and click the "apply" button.

If you're serving `mavlink2rest` in the same machine as Cockpit, activate the checkmark for "Mavlink2Rest connection" and use `ws://127.0.0.1:6040/v1/ws/mavlink` there (if you're running a mavlink2rest version before 0.11.15, omit the `/v1` in the URL).

If you're serving `mavlink-camera-manager` in the same machine as Cockpit, activate the checkmark for "WebRTC connection" and use `ws://127.0.0.1:6020` there.
