<div align="center">
  <img src="./public/images/cockpit-banner.png"><br>
</div>

------------------------

An intuitive and customizable cross-platform ground control station for remote vehicles of all types.

# Development

Cockpit is typically installed as an Electron application or BlueOS Extension, but for development purposes it is valuable to run it locally.

To do so, you should first [install bun](https://bun.sh/docs/installation). We really recomend following their documented instructions, as it was already reported by some that installing `bun` from alternatives like Snap has not worked properly.

With `bun` installed, you can enter the repository folder and follow the steps below:

```
bun install
```

and then run the server locally with:

```
bun run dev --host
```

Then you should see a prompt with the local IP and port that can be accessed through a browser, such as `localhost:5173`.